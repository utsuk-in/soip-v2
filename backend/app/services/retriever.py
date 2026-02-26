"""
Hybrid retriever — chunk-level vector search + opportunity-level FTS + chunk FTS,
fused with Reciprocal Rank Fusion (RRF).

Retrieval flow:
  1. Vector search on ALL content_chunks (linked or orphaned)
  2. Full-text search on opportunities (keyword matching)
  3. Full-text search on content_chunks (keyword matching on raw content)
  4. RRF fusion across all channels
  5. Deduplicate by opportunity_id where possible
"""

import logging
from dataclasses import dataclass, field
from datetime import date
from typing import Optional
from uuid import UUID

from sqlalchemy import text as sa_text
from sqlalchemy.orm import Session

from app.models.opportunity import OpportunityCategory
from app.services.taxonomy import normalize_domains
from app.services.query_parser import ParsedQuery

logger = logging.getLogger(__name__)

_RRF_K = 60
_CANDIDATE_LIMIT = 30


@dataclass
class ScoredOpportunity:
    id: UUID
    title: str
    description: str
    category: str
    domain_tags: list[str] = field(default_factory=list)
    eligibility: Optional[str] = None
    benefits: Optional[str] = None
    deadline: Optional[date] = None
    url: str = ""
    source_url: str = ""
    confidence: Optional[float] = None
    chunk_context: Optional[str] = None

    vector_rank: Optional[int] = None
    fts_rank: Optional[int] = None
    chunk_fts_rank: Optional[int] = None
    hybrid_score: float = 0.0
    relevance_score: float = 0.0


async def hybrid_retrieve(
    db: Session,
    query: ParsedQuery,
    query_embedding: list[float],
    limit: int = 10,
) -> list[ScoredOpportunity]:
    """Run chunk vector + opportunity FTS + chunk FTS, fuse with RRF."""

    chunk_results = _chunk_vector_search(db, query, query_embedding)
    fts_results = _fts_search(db, query)
    chunk_fts_results = _chunk_fts_search(db, query)

    fused = _rrf_fuse(chunk_results, fts_results, chunk_fts_results)

    top = sorted(fused.values(), key=lambda o: o.hybrid_score, reverse=True)
    return top[:limit]


def _chunk_vector_search(
    db: Session,
    query: ParsedQuery,
    query_embedding: list[float],
) -> list[ScoredOpportunity]:
    """Semantic search on ALL chunks — LEFT JOIN to opportunities so orphans are included."""

    where_clauses = ["c.embedding IS NOT NULL"]
    opp_filters = []
    params: dict = {"qe": str(query_embedding), "lim": _CANDIDATE_LIMIT}

    categories = _normalize_categories(query.categories)
    if categories:
        placeholders = ", ".join(f":cat_{i}" for i in range(len(categories)))
        opp_filters.append(f"o.category IN ({placeholders})")
        for i, cat in enumerate(categories):
            params[f"cat_{i}"] = cat.name

    if query.deadline_before:
        opp_filters.append("(o.deadline IS NULL OR o.deadline <= :dl_before)")
        params["dl_before"] = query.deadline_before.isoformat()

    if query.deadline_after:
        opp_filters.append("(o.deadline IS NULL OR o.deadline >= :dl_after)")
        params["dl_after"] = query.deadline_after.isoformat()

    domains = normalize_domains(query.domains)
    if domains:
        placeholders = ", ".join(f":dom_{i}" for i in range(len(domains)))
        opp_filters.append(f"o.domain_tags::jsonb ?| array[{placeholders}]")
        for i, dom in enumerate(domains):
            params[f"dom_{i}"] = dom

    where = " AND ".join(where_clauses)

    # When an opportunity is linked, it must be active with valid deadline.
    # Orphan chunks (no linked opportunity) are always included.
    having_clause = "(o.id IS NULL OR (o.is_active = true AND (o.deadline IS NULL OR o.deadline >= CURRENT_DATE)))"
    if opp_filters:
        having_clause += " AND (o.id IS NULL OR (" + " AND ".join(opp_filters) + "))"

    sql = sa_text(f"""
        SELECT c.id AS chunk_id,
               c.content AS chunk_content,
               c.source_id,
               c.opportunity_id,
               o.id AS opp_id, o.title, o.description, o.category, o.domain_tags,
               o.eligibility, o.benefits, o.deadline, o.url, o.source_url,
               o.confidence,
               s.name AS source_name,
               s.base_url AS s_base_url,
               c.embedding <=> :qe AS distance
        FROM content_chunks c
        LEFT JOIN opportunities o ON c.opportunity_id = o.id
        LEFT JOIN sources s ON c.source_id = s.id
        WHERE {where}
          AND {having_clause}
        ORDER BY c.embedding <=> :qe
        LIMIT :lim
    """)

    rows = db.execute(sql, params).fetchall()

    # Deduplicate: keep best chunk per opportunity, orphans get their own entry
    seen_opps: dict[UUID, int] = {}
    results: list[ScoredOpportunity] = []
    rank = 0

    for row in rows:
        opp_id = row.opp_id

        if opp_id and opp_id in seen_opps:
            continue

        rank += 1

        if opp_id:
            seen_opps[opp_id] = rank
            results.append(ScoredOpportunity(
                id=opp_id,
                title=row.title,
                description=row.description,
                category=row.category or "other",
                domain_tags=row.domain_tags or [],
                eligibility=row.eligibility,
                benefits=row.benefits,
                deadline=row.deadline,
                url=row.url or "",
                source_url=row.source_url or row.s_base_url or "",
                confidence=row.confidence,
                chunk_context=row.chunk_content,
                vector_rank=rank,
            ))
        else:
            # Orphan chunk — synthesize a result from chunk content + source info
            results.append(ScoredOpportunity(
                id=row.chunk_id,
                title=_extract_title_from_chunk(row.chunk_content),
                description=row.chunk_content[:500],
                category="other",
                source_url=row.s_base_url or "",
                chunk_context=row.chunk_content,
                vector_rank=rank,
            ))

    logger.debug(f"Chunk vector search: {len(results)} results ({len(seen_opps)} linked, {len(results) - len(seen_opps)} orphan)")
    return results


def _fts_search(
    db: Session,
    query: ParsedQuery,
) -> list[ScoredOpportunity]:
    """Full-text search on opportunities."""

    search_text = query.search_text
    if not search_text or not search_text.strip():
        return []

    where_clauses = [
        "is_active = true",
        "(deadline IS NULL OR deadline >= CURRENT_DATE)",
        "to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')) @@ plainto_tsquery('english', :q)",
    ]
    params: dict = {"q": search_text, "lim": _CANDIDATE_LIMIT}

    if query.deadline_before:
        where_clauses.append("(deadline IS NULL OR deadline <= :dl_before)")
        params["dl_before"] = query.deadline_before.isoformat()

    if query.deadline_after:
        where_clauses.append("(deadline IS NULL OR deadline >= :dl_after)")
        params["dl_after"] = query.deadline_after.isoformat()

    domains = normalize_domains(query.domains)
    if domains:
        placeholders = ", ".join(f":dom_{i}" for i in range(len(domains)))
        where_clauses.append(f"domain_tags::jsonb ?| array[{placeholders}]")
        for i, dom in enumerate(domains):
            params[f"dom_{i}"] = dom

    where = " AND ".join(where_clauses)

    sql = sa_text(f"""
        SELECT id, title, description, category, domain_tags,
               eligibility, benefits, deadline, url, source_url, confidence,
               ts_rank(
                   to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')),
                   plainto_tsquery('english', :q)
               ) AS rank
        FROM opportunities
        WHERE {where}
        ORDER BY rank DESC
        LIMIT :lim
    """)

    rows = db.execute(sql, params).fetchall()

    results: list[ScoredOpportunity] = []
    for rank, row in enumerate(rows, start=1):
        results.append(ScoredOpportunity(
            id=row.id,
            title=row.title,
            description=row.description,
            category=row.category,
            domain_tags=row.domain_tags or [],
            eligibility=row.eligibility,
            benefits=row.benefits,
            deadline=row.deadline,
            url=row.url,
            source_url=row.source_url,
            confidence=row.confidence,
            fts_rank=rank,
        ))

    logger.debug(f"FTS returned {len(results)} results")
    return results


def _chunk_fts_search(
    db: Session,
    query: ParsedQuery,
) -> list[ScoredOpportunity]:
    """Full-text search directly on chunk content — catches keywords the
    structured opportunity fields might have missed."""

    search_text = query.search_text
    if not search_text or not search_text.strip():
        return []

    params: dict = {"q": search_text, "lim": _CANDIDATE_LIMIT}
    domain_filter = ""
    domains = normalize_domains(query.domains)
    if domains:
        placeholders = ", ".join(f":dom_{i}" for i in range(len(domains)))
        domain_filter = f" AND (o.domain_tags::jsonb ?| array[{placeholders}])"
        for i, dom in enumerate(domains):
            params[f"dom_{i}"] = dom

    sql = sa_text("""
        SELECT c.id AS chunk_id,
               c.content AS chunk_content,
               c.opportunity_id,
               o.id AS opp_id, o.title, o.description, o.category, o.domain_tags,
               o.eligibility, o.benefits, o.deadline, o.url, o.source_url,
               o.confidence,
               s.base_url AS s_base_url,
               ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', :q)) AS rank
        FROM content_chunks c
        LEFT JOIN opportunities o ON c.opportunity_id = o.id
        LEFT JOIN sources s ON c.source_id = s.id
        WHERE to_tsvector('english', c.content) @@ plainto_tsquery('english', :q)
          AND (o.id IS NULL OR (o.is_active = true AND (o.deadline IS NULL OR o.deadline >= CURRENT_DATE)))
    """ + domain_filter + """
        ORDER BY rank DESC
        LIMIT :lim
    """)

    rows = db.execute(sql, params).fetchall()

    seen_opps: set[UUID] = set()
    results: list[ScoredOpportunity] = []
    rank_num = 0

    for row in rows:
        opp_id = row.opp_id
        if opp_id and opp_id in seen_opps:
            continue
        rank_num += 1

        if opp_id:
            seen_opps.add(opp_id)
            results.append(ScoredOpportunity(
                id=opp_id,
                title=row.title,
                description=row.description,
                category=row.category or "other",
                domain_tags=row.domain_tags or [],
                eligibility=row.eligibility,
                benefits=row.benefits,
                deadline=row.deadline,
                url=row.url or "",
                source_url=row.source_url or row.s_base_url or "",
                confidence=row.confidence,
                chunk_context=row.chunk_content,
                chunk_fts_rank=rank_num,
            ))
        else:
            results.append(ScoredOpportunity(
                id=row.chunk_id,
                title=_extract_title_from_chunk(row.chunk_content),
                description=row.chunk_content[:500],
                category="other",
                source_url=row.s_base_url or "",
                chunk_context=row.chunk_content,
                chunk_fts_rank=rank_num,
            ))

    logger.debug(f"Chunk FTS returned {len(results)} results")
    return results


def _normalize_categories(
    raw: Optional[list[str]],
) -> list[OpportunityCategory]:
    if not raw:
        return []
    normalized: list[OpportunityCategory] = []
    for item in raw:
        if isinstance(item, OpportunityCategory):
            normalized.append(item)
            continue
        if not item:
            continue
        try:
            normalized.append(OpportunityCategory(item))
            continue
        except ValueError:
            pass
        try:
            normalized.append(OpportunityCategory[item.upper()])
        except KeyError:
            continue
    return normalized


def _normalize_domains(raw: Optional[list[str]]) -> list[str]:
    # Backward-compatible alias
    return normalize_domains(raw)


def _rrf_fuse(
    chunk_results: list[ScoredOpportunity],
    fts_results: list[ScoredOpportunity],
    chunk_fts_results: list[ScoredOpportunity],
) -> dict[UUID, ScoredOpportunity]:
    """Reciprocal Rank Fusion across three retrieval channels."""
    merged: dict[UUID, ScoredOpportunity] = {}

    for opp in chunk_results:
        merged[opp.id] = opp

    for opp in fts_results:
        if opp.id in merged:
            merged[opp.id].fts_rank = opp.fts_rank
        else:
            merged[opp.id] = opp

    for opp in chunk_fts_results:
        if opp.id in merged:
            merged[opp.id].chunk_fts_rank = opp.chunk_fts_rank
            if not merged[opp.id].chunk_context and opp.chunk_context:
                merged[opp.id].chunk_context = opp.chunk_context
        else:
            merged[opp.id] = opp

    for opp in merged.values():
        score = 0.0
        if opp.vector_rank is not None:
            score += 1.0 / (_RRF_K + opp.vector_rank)
        if opp.fts_rank is not None:
            score += 1.0 / (_RRF_K + opp.fts_rank)
        if opp.chunk_fts_rank is not None:
            score += 0.8 / (_RRF_K + opp.chunk_fts_rank)

        score += _freshness_boost(opp.deadline)
        opp.hybrid_score = score

    return merged


def _freshness_boost(deadline: Optional[date]) -> float:
    """Boost opportunities with deadlines in the next 14 days."""
    if not deadline:
        return 0.0
    days_left = (deadline - date.today()).days
    if days_left < 0:
        return 0.0
    if days_left <= 14:
        return 0.005 * (14 - days_left) / 14
    return 0.0


def _extract_title_from_chunk(content: str) -> str:
    """Best-effort title extraction from an orphan chunk's first line."""
    first_line = content.strip().split("\n")[0]
    clean = first_line.lstrip("#").strip()
    if len(clean) > 120:
        clean = clean[:117] + "..."
    return clean or "Untitled Opportunity"
