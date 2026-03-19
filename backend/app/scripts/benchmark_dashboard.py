#!/usr/bin/env python3
"""
Benchmark: Student Dashboard Load Time

Measures the real API latency for the student dashboard, comparing:

  OLD flow (sequential, explanations blocking):
    1. GET /recommended          (included LLM explanation call)
    2. GET /opportunities        (browse fallback, waited for step 1)
    3. GET /feedback/batch       (waited for step 2)
    Total = sum of all three

  NEW flow (parallel, explanations non-blocking):
    1. GET /recommended  }
    2. GET /opportunities}       fired in parallel
    3. GET /feedback/batch       fired after IDs known
    --- cards visible here ---
    4. GET /explanations         fired in background (doesn't block UI)
    Total (cards visible) = max(step1, step2) + step3
    Total (with explanations) = above + step4

Usage:
    python scripts/benchmark_dashboard.py --base-url http://localhost:8000 --token <jwt>

    To get a JWT token, log in as a student and copy from browser devtools
    (localStorage "soip_token" or sessionStorage "soip_admin_token").
"""

import argparse
import asyncio
import time
import sys

try:
    import httpx
except ImportError:
    print("This script requires httpx. Install it with: pip install httpx")
    sys.exit(1)


async def timed_get(
    client: httpx.AsyncClient, url: str, label: str
) -> tuple[str, float, httpx.Response]:
    """Make a GET request and return (label, elapsed_ms, response)."""
    start = time.perf_counter()
    resp = await client.get(url)
    elapsed = (time.perf_counter() - start) * 1000
    return label, elapsed, resp


async def run_benchmark(base_url: str, token: str, runs: int = 3):
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(
        base_url=base_url, headers=headers, timeout=60
    ) as client:
        # Quick health check
        try:
            r = await client.get("/api/auth/me")
            if r.status_code != 200:
                print(f"Auth check failed ({r.status_code}). Is your token valid?")
                sys.exit(1)
            user = r.json()
            print(
                f"Authenticated as: {user.get('first_name', '?')} ({user.get('email', '?')})\n"
            )
        except httpx.ConnectError:
            print(f"Cannot connect to {base_url}. Is the server running?")
            sys.exit(1)

        old_totals = []
        new_card_totals = []
        new_full_totals = []
        timings_log = []

        for run_i in range(1, runs + 1):
            print(f"── Run {run_i}/{runs} ──")

            # ── Measure individual endpoint latencies ──
            _, t_rec, resp_rec = await timed_get(
                client, "/api/opportunities/recommended?limit=20", "/recommended"
            )
            rec_data = resp_rec.json() if resp_rec.status_code == 200 else []

            _, t_browse, _ = await timed_get(
                client,
                "/api/opportunities?sort=newest&page_size=60",
                "/opportunities (browse)",
            )

            # Collect IDs for feedback + explanations
            opp_ids = list(
                {o["id"] for o in (rec_data if isinstance(rec_data, list) else [])}
            )[:16]
            ids_param = ",".join(opp_ids) if opp_ids else ""

            _, t_feedback, _ = await timed_get(
                client,
                f"/api/feedback/batch?opportunity_ids={ids_param}"
                if ids_param
                else "/api/feedback/batch?opportunity_ids=",
                "/feedback/batch",
            )

            _, t_explain, _ = await timed_get(
                client,
                f"/api/opportunities/explanations?opportunity_ids={ids_param}"
                if ids_param
                else "/api/opportunities/explanations?opportunity_ids=",
                "/explanations",
            )

            # ── Simulate OLD flow (sequential, explanations in /recommended) ──
            # Old /recommended included the LLM call, so its time ≈ t_rec + t_explain
            old_recommended = t_rec + t_explain
            old_total = old_recommended + t_browse + t_feedback

            # ── Simulate NEW flow (parallel, explanations async) ──
            # recommended + browse fire in parallel
            new_parallel = max(t_rec, t_browse)
            new_cards_visible = new_parallel + t_feedback
            new_full = new_cards_visible + t_explain  # explanations load after

            old_totals.append(old_total)
            new_card_totals.append(new_cards_visible)
            new_full_totals.append(new_full)

            timings_log.append(
                {
                    "recommended": t_rec,
                    "browse": t_browse,
                    "feedback": t_feedback,
                    "explanations": t_explain,
                }
            )

            print(f"  /recommended ......... {t_rec:>7.0f} ms")
            print(f"  /opportunities ....... {t_browse:>7.0f} ms")
            print(f"  /feedback/batch ...... {t_feedback:>7.0f} ms")
            print(f"  /explanations ........ {t_explain:>7.0f} ms")
            print()
            print(f"  OLD total (sequential + LLM blocking):  {old_total:>7.0f} ms")
            print(
                f"  NEW cards visible (parallel, no LLM):   {new_cards_visible:>7.0f} ms"
            )
            print(f"  NEW full (cards + explanations fade-in): {new_full:>7.0f} ms")
            print()

        # ── Summary ──
        avg_old = sum(old_totals) / len(old_totals)
        avg_new_cards = sum(new_card_totals) / len(new_card_totals)
        avg_new_full = sum(new_full_totals) / len(new_full_totals)
        speedup = avg_old / avg_new_cards if avg_new_cards > 0 else float("inf")

        print("=" * 56)
        print("SUMMARY (averaged over {} runs)".format(runs))
        print("=" * 56)

        # Average per-endpoint
        avg_rec = sum(t["recommended"] for t in timings_log) / runs
        avg_brw = sum(t["browse"] for t in timings_log) / runs
        avg_fb = sum(t["feedback"] for t in timings_log) / runs
        avg_exp = sum(t["explanations"] for t in timings_log) / runs

        print(f"  /recommended avg ......... {avg_rec:>7.0f} ms")
        print(f"  /opportunities avg ....... {avg_brw:>7.0f} ms")
        print(f"  /feedback/batch avg ...... {avg_fb:>7.0f} ms")
        print(f"  /explanations avg ........ {avg_exp:>7.0f} ms")
        print()
        print(f"  OLD flow (user waits):     {avg_old:>7.0f} ms")
        print(
            f"  NEW flow (cards visible):  {avg_new_cards:>7.0f} ms  ← user sees content here"
        )
        print(
            f"  NEW flow (full render):    {avg_new_full:>7.0f} ms  ← explanations fade in"
        )
        print()
        print(f"  Speedup (time-to-cards):   {speedup:.1f}x faster")
        print(f"  Time saved:                {avg_old - avg_new_cards:.0f} ms")
        print()


def main():
    parser = argparse.ArgumentParser(
        description="Benchmark student dashboard load time"
    )
    parser.add_argument(
        "--base-url", default="http://localhost:8000", help="Backend API base URL"
    )
    parser.add_argument(
        "--token", required=True, help="JWT token for an authenticated student"
    )
    parser.add_argument(
        "--runs", type=int, default=3, help="Number of benchmark runs (default: 3)"
    )
    args = parser.parse_args()

    asyncio.run(run_benchmark(args.base_url, args.token, args.runs))


if __name__ == "__main__":
    main()
