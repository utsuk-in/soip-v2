"""
CLI entry point: `python -m app.services.scraper`

Usage:
    python -m app.services.scraper              # run full pipeline
    python -m app.services.scraper --seed-only  # only seed sources
"""

import asyncio
import logging
import sys
import time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("scraper")


def main() -> None:
    seed_only = "--seed-only" in sys.argv

    from app.database import get_db_context

    if seed_only:
        from app.services.scraper.seed import seed_sources

        logger.info("Seeding opportunity sources...")
        with get_db_context() as db:
            count = seed_sources(db)
        logger.info(f"Done — {count} sources added.")
    else:
        from app.services.scraper.pipeline import run_pipeline

        async def _run() -> dict:
            with get_db_context() as db:
                return await run_pipeline(db)

        logger.info("Starting scraping pipeline...")
        t0 = time.monotonic()
        stats = asyncio.run(_run())
        elapsed = time.monotonic() - t0
        minutes, seconds = divmod(elapsed, 60)
        duration_str = (
            f"{int(minutes)}m {seconds:.1f}s" if minutes else f"{seconds:.1f}s"
        )
        logger.info(f"Done — {stats} | elapsed: {duration_str}")


if __name__ == "__main__":
    main()
