"""
APScheduler setup — runs inside FastAPI lifespan.

Jobs:
  - Every 6 hours: full scraping pipeline
  - Every hour: auto-expire past-deadline opportunities
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.database import get_db_context

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def _run_scrape_pipeline() -> None:
    """Scrape all sources, extract opportunities, generate alerts."""
    from app.services.scraper.pipeline import run_pipeline
    from app.services.embedder import embed_pending

    logger.info("[scheduler] Starting scrape pipeline...")
    try:
        with get_db_context() as db:
            stats = await run_pipeline(db)
            logger.info(f"[scheduler] Scrape done: {stats}")

            embedded = await embed_pending(db)
            logger.info(f"[scheduler] Embedded {embedded} opportunities")
    except Exception as e:
        logger.error(f"[scheduler] Scrape pipeline failed: {e}")


async def _expire_opportunities() -> None:
    """Mark past-deadline opportunities as inactive."""
    from app.services.scraper.pipeline import _expire_past_deadlines

    logger.info("[scheduler] Expiring past-deadline opportunities...")
    try:
        with get_db_context() as db:
            count = _expire_past_deadlines(db)
            logger.info(f"[scheduler] Expired {count} opportunities")
    except Exception as e:
        logger.error(f"[scheduler] Expiry job failed: {e}")


def start_scheduler() -> None:
    """Register jobs and start the scheduler."""
    scheduler.add_job(
        _run_scrape_pipeline,
        "interval",
        hours=6,
        id="scrape_pipeline",
        replace_existing=True,
        next_run_time=None,  # don't run immediately on startup
    )

    scheduler.add_job(
        _expire_opportunities,
        "interval",
        hours=1,
        id="expire_opportunities",
        replace_existing=True,
        next_run_time=None,
    )

    scheduler.start()
    logger.info("[scheduler] Started — scrape every 6h, expire every 1h")


def stop_scheduler() -> None:
    """Gracefully shut down the scheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[scheduler] Stopped")


@asynccontextmanager
async def scheduler_lifespan(app):
    """FastAPI lifespan context manager for the scheduler."""
    start_scheduler()
    yield
    stop_scheduler()
