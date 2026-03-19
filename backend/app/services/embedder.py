"""
Embedding service — OpenAI text-embedding-3-small for batch vector generation.

Embeds both:
  - content_chunks (primary — used for RAG retrieval, enriched with source context)
  - opportunities (secondary — used for /recommended endpoint)
"""

import hashlib
import logging
import time
from typing import Sequence

from openai import AsyncOpenAI
from sqlalchemy.orm import Session

from app.config import settings
from app.models.opportunity import Opportunity
from app.models.scrape import ContentChunk
from app.models.source import Source

logger = logging.getLogger(__name__)

_client = AsyncOpenAI(api_key=settings.openai_api_key)

_BATCH_SIZE = 100

# In-memory cache for query embeddings (profile text rarely changes)
_EMBED_CACHE: dict[str, tuple[list[float], float]] = {}
_EMBED_CACHE_TTL = 600  # 10 minutes
_EMBED_CACHE_MAX = 128


# ── Chunk embeddings (primary for RAG) ──


def _enrich_chunk_text(chunk: ContentChunk, source_name: str, source_url: str) -> str:
    """Prepend source context to chunk content for higher-quality embeddings.

    This ensures that semantically identical text from different sources
    produces distinct embeddings, and gives the model context about where
    the information comes from.
    """
    return f"Source: {source_name} | {source_url}\n---\n{chunk.content}"


async def embed_chunks(
    db: Session,
    chunks: Sequence[ContentChunk],
    source_lookup: dict | None = None,
) -> int:
    """Batch-embed content chunks with source context and store vectors."""
    if not chunks:
        return 0

    if source_lookup is None:
        source_lookup = _build_source_lookup(db)

    embedded = 0
    for i in range(0, len(chunks), _BATCH_SIZE):
        batch = chunks[i : i + _BATCH_SIZE]
        texts = []
        for c in batch:
            src = source_lookup.get(str(c.source_id))
            if src:
                texts.append(_enrich_chunk_text(c, src["name"], src["url"]))
            else:
                texts.append(c.content)

        try:
            response = await _client.embeddings.create(
                model=settings.openai_embedding_model,
                input=texts,
            )
            for chunk, data in zip(batch, response.data):
                chunk.embedding = data.embedding
                embedded += 1

            db.commit()
            logger.info(
                f"Embedded chunk batch {i // _BATCH_SIZE + 1}: {len(batch)} chunks"
            )
        except Exception as e:
            logger.error(f"Chunk embedding batch {i // _BATCH_SIZE + 1} failed: {e}")
            db.rollback()

    logger.info(f"Embedded {embedded}/{len(chunks)} chunks total")
    return embedded


async def embed_pending_chunks(db: Session) -> int:
    """Find all chunks missing embeddings and generate them with source context."""
    pending = db.query(ContentChunk).filter(ContentChunk.embedding.is_(None)).all()
    if not pending:
        logger.info("No pending chunk embeddings")
        return 0

    logger.info(f"Found {len(pending)} chunks without embeddings")
    source_lookup = _build_source_lookup(db)
    return await embed_chunks(db, pending, source_lookup)


def _build_source_lookup(db: Session) -> dict:
    """Cache source metadata for enrichment."""
    sources = db.query(Source.id, Source.name, Source.base_url).all()
    return {str(s.id): {"name": s.name, "url": s.base_url} for s in sources}


# ── Opportunity embeddings (secondary for /recommended) ──


def prepare_embedding_text(opp: Opportunity) -> str:
    """Build a structured text block optimized for semantic embedding."""
    parts = [
        f"Title: {opp.title}",
        f"Category: {opp.category.value if hasattr(opp.category, 'value') else opp.category}",
        f"Domains: {', '.join(opp.domain_tags or [])}",
        f"Description: {opp.description}",
    ]
    if opp.eligibility:
        parts.append(f"Eligibility: {opp.eligibility}")
    if opp.benefits:
        parts.append(f"Benefits: {opp.benefits}")
    if opp.deadline:
        parts.append(f"Deadline: {opp.deadline.isoformat()}")
    return "\n".join(parts)


async def embed_opportunities(db: Session, opportunities: Sequence[Opportunity]) -> int:
    """Batch-embed opportunities and store vectors."""
    if not opportunities:
        return 0

    embedded = 0
    for i in range(0, len(opportunities), _BATCH_SIZE):
        batch = opportunities[i : i + _BATCH_SIZE]
        texts = [prepare_embedding_text(opp) for opp in batch]

        try:
            response = await _client.embeddings.create(
                model=settings.openai_embedding_model,
                input=texts,
            )
            for opp, data in zip(batch, response.data):
                opp.embedding = data.embedding
                embedded += 1

            db.commit()
        except Exception as e:
            logger.error(f"Opportunity embedding batch failed: {e}")
            db.rollback()

    return embedded


async def embed_query(text: str) -> list[float]:
    """Embed a single query string for retrieval, with in-memory TTL cache."""
    cache_key = hashlib.sha256(text.encode()).hexdigest()
    now = time.monotonic()

    cached = _EMBED_CACHE.get(cache_key)
    if cached and (now - cached[1]) < _EMBED_CACHE_TTL:
        logger.debug("embed_query cache hit")
        return cached[0]

    response = await _client.embeddings.create(
        model=settings.openai_embedding_model,
        input=[text],
    )
    embedding = response.data[0].embedding

    if len(_EMBED_CACHE) >= _EMBED_CACHE_MAX:
        oldest_key = min(_EMBED_CACHE, key=lambda k: _EMBED_CACHE[k][1])
        del _EMBED_CACHE[oldest_key]
    _EMBED_CACHE[cache_key] = (embedding, now)

    return embedding


async def embed_pending(db: Session) -> int:
    """Embed all pending chunks + opportunities."""
    chunk_count = await embed_pending_chunks(db)

    pending_opps = (
        db.query(Opportunity)
        .filter(Opportunity.embedding.is_(None), Opportunity.is_active.is_(True))
        .all()
    )
    opp_count = await embed_opportunities(db, pending_opps) if pending_opps else 0

    logger.info(f"Embed pending: {chunk_count} chunks, {opp_count} opportunities")
    return chunk_count + opp_count
