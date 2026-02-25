"""
Pipeline orchestrator — scrape → store raw → chunk → extract → upsert → link → expire.

Data lineage:
  raw markdown → scrape_pages (full content preserved)
                → content_chunks (semantic chunks for embedding)
                → opportunities (structured extraction)
  Chunks are linked back to both the raw page and the extracted opportunity.
"""

import logging
import re
import calendar
from datetime import date, datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.opportunity import Opportunity, OpportunityCategory
from app.models.scrape import ContentChunk, ScrapePage
from app.models.source import Source
from app.services.chunker import Chunk, chunk_markdown, content_hash
from app.services.scraper.client import scrape_detail_url, scrape_source
from app.services.scraper.extractor import ExtractedOpportunity, extract_opportunities

logger = logging.getLogger(__name__)
_ONLINE_OFFLINE_TAGS = ("online", "offline")


async def run_pipeline(db: Session) -> dict:
    """Run the full scraping pipeline for all enabled sources."""
    sources = db.query(Source).filter(Source.is_enabled.is_(True)).all()

    if not sources:
        logger.warning("No enabled sources found. Run seed first.")
        return {"sources": 0, "new": 0, "updated": 0, "skipped": 0, "chunks": 0, "errors": 0}

    stats = {
        "sources": len(sources),
        "new": 0,
        "updated": 0,
        "skipped": 0,
        "chunks": 0,
        "errors": 0,
    }

    for source in sources:
        try:
            source_stats = await _process_source(db, source)
            for key in ("new", "updated", "skipped", "chunks"):
                stats[key] += source_stats.get(key, 0)
        except Exception as e:
            logger.error(f"Pipeline failed for {source.name}: {e}")
            stats["errors"] += 1

    expired = _expire_past_deadlines(db)

    logger.info(
        f"Pipeline complete: {stats['sources']} sources, "
        f"{stats['new']} new, {stats['updated']} updated, "
        f"{stats['skipped']} unchanged, {stats['chunks']} chunks, "
        f"{stats['errors']} errors, {expired} expired"
    )
    return stats


async def _process_source(db: Session, source: Source) -> dict:
    """Scrape, store raw content, chunk, extract, and upsert."""
    stats = {"new": 0, "updated": 0, "skipped": 0, "chunks": 0}
    logger.info(f"Processing source: {source.name} ({source.base_url})")

    # --- Step 1: Scrape ---
    markdown = await scrape_source(source)
    if not markdown:
        logger.warning(f"No content from {source.name}")
        return stats

    logger.info(f"Scraped {len(markdown)} chars from {source.name}")

    listing_url = source.config.get("listing_url", source.base_url)
    new_hash = content_hash(markdown)

    # --- Step 2: Store raw content (always, even if unchanged) ---
    scrape_page = _store_raw_page(db, source, listing_url, markdown, new_hash)

    # --- Step 3: Check if content changed since last scrape ---
    prev_page = (
        db.query(ScrapePage)
        .filter(
            ScrapePage.source_id == source.id,
            ScrapePage.url == listing_url,
            ScrapePage.id != scrape_page.id,
        )
        .order_by(ScrapePage.scraped_at.desc())
        .first()
    )
    content_changed = prev_page is None or prev_page.content_hash != new_hash

    if not content_changed:
        logger.info(f"Content unchanged for {source.name}, skipping extraction")
        source.last_scraped_at = datetime.now(timezone.utc)
        db.commit()
        return stats

    # --- Step 4: Retire stale chunks from previous runs for this source ---
    stale_count = _retire_stale_chunks(db, source)
    if stale_count:
        logger.info(f"Retired {stale_count} stale chunks from {source.name}")

    # --- Step 5: Create semantic chunks ---
    chunks = chunk_markdown(markdown)
    chunk_models = _store_chunks(db, scrape_page, source, chunks)
    stats["chunks"] = len(chunk_models)
    logger.info(f"Created {len(chunk_models)} chunks from {source.name}")

    # --- Step 6: Extract structured opportunities ---
    extracted = await extract_opportunities(markdown, listing_url)
    if not extracted:
        logger.warning(f"No opportunities extracted from {source.name}")
        source.last_scraped_at = datetime.now(timezone.utc)
        db.commit()
        return stats

    # --- Step 7: Upsert opportunities and link chunks ---
    for item in extracted:
        item = await _enrich_from_unstop_detail(source, item)
        result, opp_id = _upsert_opportunity(db, source, item)
        stats[result] += 1
        if opp_id:
            _link_chunks_to_opportunity(db, chunk_models, item, opp_id)

    source.last_scraped_at = datetime.now(timezone.utc)
    db.commit()

    logger.info(
        f"Source {source.name}: "
        f"{stats['new']} new, {stats['updated']} updated, "
        f"{stats['skipped']} unchanged, {stats['chunks']} chunks"
    )
    return stats


def _retire_stale_chunks(db: Session, source: Source) -> int:
    """Delete old chunks for this source before inserting fresh ones.

    Raw pages are preserved (scrape_pages) for audit trail — only the
    derived chunks are replaced since they'll be regenerated from the
    new content.
    """
    count = (
        db.query(ContentChunk)
        .filter(ContentChunk.source_id == source.id)
        .delete(synchronize_session="fetch")
    )
    if count:
        db.flush()
    return count


def _store_raw_page(
    db: Session, source: Source, url: str, raw_content: str, hash_val: str
) -> ScrapePage:
    """Persist the full raw markdown — nothing is discarded."""
    page = ScrapePage(
        source_id=source.id,
        url=url,
        raw_content=raw_content,
        content_hash=hash_val,
        content_length=len(raw_content),
    )
    db.add(page)
    db.flush()
    return page


def _store_chunks(
    db: Session, scrape_page: ScrapePage, source: Source, chunks: list[Chunk]
) -> list[ContentChunk]:
    """Persist semantic chunks linked to the raw page."""
    models = []
    for chunk in chunks:
        m = ContentChunk(
            scrape_page_id=scrape_page.id,
            source_id=source.id,
            chunk_index=chunk.index,
            content=chunk.content,
            token_estimate=chunk.token_estimate,
        )
        db.add(m)
        models.append(m)
    db.flush()
    return models


def _link_chunks_to_opportunity(
    db: Session,
    chunk_models: list[ContentChunk],
    item: ExtractedOpportunity,
    opp_id: UUID,
) -> None:
    """Link chunks that contain the opportunity title to the opportunity record."""
    title_lower = item.title.lower()
    for chunk in chunk_models:
        if title_lower in chunk.content.lower():
            chunk.opportunity_id = opp_id


def _upsert_opportunity(
    db: Session, source: Source, item: ExtractedOpportunity
) -> tuple[str, UUID | None]:
    """Insert or update a single opportunity. Returns (status, opportunity_id)."""
    opp_url = item.url or _generate_url(source.base_url, item.title)

    existing = db.query(Opportunity).filter(Opportunity.url == opp_url).first()

    if existing:
        status = _apply_changes(db, existing, item)
        return status, existing.id

    try:
        category = OpportunityCategory(item.category)
    except ValueError:
        category = OpportunityCategory.OTHER

    opp = Opportunity(
        title=item.title,
        description=item.description,
        category=category,
        domain_tags=item.domain_tags,
        eligibility=item.eligibility,
        benefits=item.benefits,
        deadline=item.deadline,
        url=opp_url,
        source_id=source.id,
        source_url=source.base_url,
        confidence=item.confidence,
        is_active=True,
        scraped_at=datetime.now(timezone.utc),
    )
    db.add(opp)
    db.flush()
    return "new", opp.id


def _apply_changes(
    db: Session, existing: Opportunity, item: ExtractedOpportunity
) -> str:
    """Compare and apply field-level changes. Returns 'updated' or 'skipped'."""
    changed = False

    if item.description and existing.description != item.description:
        existing.description = item.description
        changed = True
    if item.deadline and existing.deadline != item.deadline:
        existing.deadline = item.deadline
        changed = True
    if item.eligibility and existing.eligibility != item.eligibility:
        existing.eligibility = item.eligibility
        changed = True
    if item.benefits and existing.benefits != item.benefits:
        existing.benefits = item.benefits
        changed = True
    if item.domain_tags:
        normalized_new = _normalize_domain_tags(item.domain_tags)
        normalized_existing = _normalize_domain_tags(existing.domain_tags or [])
        if normalized_new != normalized_existing:
            existing.domain_tags = normalized_new
            changed = True
    if item.category:
        try:
            new_category = OpportunityCategory(item.category)
        except ValueError:
            new_category = OpportunityCategory.OTHER
        if existing.category != new_category:
            existing.category = new_category
            changed = True
    if item.confidence is not None and existing.confidence != item.confidence:
        existing.confidence = item.confidence
        changed = True

    if not changed:
        return "skipped"

    existing.updated_at = datetime.now(timezone.utc)
    existing.scraped_at = datetime.now(timezone.utc)
    existing.embedding = None
    return "updated"


def _expire_past_deadlines(db: Session) -> int:
    """Mark opportunities with past deadlines as inactive."""
    count = (
        db.query(Opportunity)
        .filter(
            Opportunity.deadline < date.today(),
            Opportunity.is_active.is_(True),
        )
        .update({"is_active": False, "updated_at": datetime.now(timezone.utc)})
    )
    db.commit()
    logger.info(f"Expired {count} past-deadline opportunities")
    return count


def _generate_url(base_url: str, title: str) -> str:
    """Generate a deterministic URL slug when the extractor doesn't find one."""
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:80]
    return f"{base_url.rstrip('/')}#/{slug}"


async def _enrich_from_unstop_detail(
    source: Source, item: ExtractedOpportunity
) -> ExtractedOpportunity:
    """Use Unstop detail page text to improve description, mode tags, and deadline."""
    if not item.url or "unstop.com/" not in item.url.lower():
        return item

    detail_markdown = await scrape_detail_url(item.url, source)
    if not detail_markdown:
        return item

    improved_desc = _extract_unstop_description(detail_markdown)
    if improved_desc and len(improved_desc) > len(item.description):
        item.description = improved_desc

    inferred_tags = _infer_online_offline_tags(detail_markdown)
    if inferred_tags:
        merged = _normalize_domain_tags((item.domain_tags or []) + inferred_tags)
        item.domain_tags = merged or ["general"]

    parsed_deadline = _extract_unstop_registration_close(detail_markdown)
    if parsed_deadline:
        item.deadline = parsed_deadline

    return item


def _extract_unstop_description(markdown: str) -> Optional[str]:
    start_match = re.search(
        r"##\s+All that you need to know about.*?\n",
        markdown,
        flags=re.IGNORECASE,
    )
    if not start_match:
        return None

    tail = markdown[start_match.end():]
    end_markers = (
        "Read More",
        "## Feedback",
        "##  Frequently Asked Questions/Discussions",
        "Updated On:",
    )
    end = len(tail)
    for marker in end_markers:
        pos = tail.find(marker)
        if pos != -1 and pos < end:
            end = pos

    section = tail[:end]
    section = re.sub(r"!\[[^\]]*\]\([^)]+\)", " ", section)
    section = re.sub(r"\n{2,}", "\n", section)
    section = re.sub(r"[ \t]{2,}", " ", section)
    section = section.replace("false", " ")
    cleaned = section.strip()
    if len(cleaned) < 80:
        return None
    return cleaned[:2500]


def _infer_online_offline_tags(markdown: str) -> list[str]:
    lowered = markdown.lower()
    tags: list[str] = []
    for tag in _ONLINE_OFFLINE_TAGS:
        if re.search(rf"\b{tag}\b", lowered):
            tags.append(tag)
    return tags


def _extract_unstop_registration_close(markdown: str) -> Optional[date]:
    match = re.search(
        r"Registrations?\s+Close\s*:\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})",
        markdown,
        flags=re.IGNORECASE,
    )
    if not match:
        return None
    raw = match.group(1).strip()
    try:
        return datetime.strptime(raw, "%d %B %Y").date()
    except ValueError:
        try:
            return datetime.strptime(raw, "%d %b %Y").date()
        except ValueError:
            month_map = {
                "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
                "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
            }
            parts = raw.split()
            if len(parts) != 3:
                return None
            try:
                day = int(parts[0])
                month = month_map.get(parts[1][:3].lower())
                year = int(parts[2])
                if not month:
                    return None
                last_day = calendar.monthrange(year, month)[1]
                # Some pages occasionally publish impossible dates (e.g. 29 Feb on non-leap years).
                safe_day = min(day, last_day)
                return date(year, month, safe_day)
            except Exception:
                return None


def _normalize_domain_tags(tags: list[str]) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for tag in tags:
        if not tag:
            continue
        value = str(tag).strip().lower()
        if not value or value in seen:
            continue
        seen.add(value)
        normalized.append(value)
    return normalized
