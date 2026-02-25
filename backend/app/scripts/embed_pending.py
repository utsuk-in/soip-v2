"""
Generate embeddings for all pending content chunks and opportunities.

Run after `make scrape` so that RAG (chat) and personalized recommendations work.
From repo root: make embed
Or: cd backend && . .venv/bin/activate && python -m app.scripts.embed_pending
"""

import asyncio
import logging
import sys

from app.database import get_db_context
from app.services.embedder import embed_pending

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def main() -> None:
    async def run() -> int:
        with get_db_context() as db:
            count = await embed_pending(db)
        return count

    try:
        count = asyncio.run(run())
        logger.info("Done. Total embedded: %d (chunks + opportunities)", count)
        sys.exit(0)
    except Exception as e:
        logger.exception("Embed failed: %s", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
