"""
Validate scrape results: opportunity counts by source, Unstop content snippet, and search for a given title (e.g. CryptNit2 2026).
Run from repo root: cd backend && . .venv/bin/activate && python -m app.scripts.validate_scrape
Optional: python -m app.scripts.validate_scrape "CryptNit2"
"""

import sys
from sqlalchemy import func

from app.database import get_db_context
from app.models import Opportunity, Source, ScrapePage


def main() -> None:
    search_title = (sys.argv[1:] or [None])[0]

    with get_db_context() as db:
        # Count opportunities per source
        counts = (
            db.query(Source.name, Source.base_url, func.count(Opportunity.id).label("count"))
            .outerjoin(Opportunity, Source.id == Opportunity.source_id)
            .group_by(Source.id, Source.name, Source.base_url)
            .order_by(Source.name)
            .all()
        )
        print("=== Opportunities per source ===\n")
        for name, base_url, count in counts:
            print(f"  {count:4d}  {name}  ({base_url})")

        # Unstop: latest scrape_page content snippet
        unstop = db.query(Source).filter(Source.base_url.like("%unstop.com%")).first()
        if unstop:
            print("\n=== Unstop: latest scrape (raw content snippet) ===\n")
            latest = (
                db.query(ScrapePage)
                .filter(ScrapePage.source_id == unstop.id)
                .order_by(ScrapePage.scraped_at.desc())
                .first()
            )
            if latest:
                raw = latest.raw_content or ""
                print(f"  URL: {latest.url}")
                print(f"  Length: {len(raw)} chars")
                print(f"  First 800 chars:\n  ---\n  {raw[:800]}\n  ---")
                if "Cookies Disabled" in raw or "Please Wait" in raw:
                    print("\n  >>> Likely cause: page returned cookie/error screen instead of listings.")
            else:
                print("  No scrape_pages found for Unstop.")

            # List Unstop opportunity titles
            opps = (
                db.query(Opportunity.title, Opportunity.url)
                .filter(Opportunity.source_id == unstop.id)
                .order_by(Opportunity.created_at.desc())
                .limit(30)
                .all()
            )
            print("\n=== Unstop: recent opportunity titles (up to 30) ===\n")
            for title, url in opps:
                print(f"  - {title}")
            if not opps:
                print("  (none)")

        # Search by title substring
        if search_title:
            print(f"\n=== Search: title contains '{search_title}' ===\n")
            found = (
                db.query(Opportunity.title, Opportunity.url, Source.name)
                .join(Source, Opportunity.source_id == Source.id)
                .filter(Opportunity.title.ilike(f"%{search_title}%"))
                .all()
            )
            if found:
                for title, url, src in found:
                    print(f"  {title}  |  {src}  |  {url}")
            else:
                print("  No opportunities found.")
                # Check if it appears in any raw content
                pages = (
                    db.query(ScrapePage.url, ScrapePage.raw_content, ScrapePage.content_length)
                    .join(Source, ScrapePage.source_id == Source.id)
                    .filter(Source.base_url.like("%unstop.com%"))
                    .order_by(ScrapePage.scraped_at.desc())
                    .limit(3)
                    .all()
                )
                for url, raw, length in pages:
                    if raw and search_title in raw:
                        print(f"  Found in scrape content: {url} ({length} chars)")
                        break
                else:
                    print("  Not found in Unstop scrape content either (cookie/error page likely).")


if __name__ == "__main__":
    main()
