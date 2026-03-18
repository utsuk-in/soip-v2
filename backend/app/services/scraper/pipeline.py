"""
Pipeline orchestrator — scrape → store raw → chunk → extract → upsert → link → expire.

Data lineage:
  raw markdown → scrape_pages (full content preserved)
                → content_chunks (semantic chunks for embedding)
                → opportunities (structured extraction)
  Chunks are linked back to both the raw page and the extracted opportunity.
"""

import asyncio
import json
import logging
import re
import calendar
from datetime import date, datetime, timezone, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.opportunity import Opportunity
from app.utils.enums import OpportunityCategory, OpportunityStatus
from app.models.scrape import ContentChunk, ScrapePage
from app.models.source import Source
from app.services.chunker import Chunk, chunk_markdown, content_hash
from app.services.scraper.client import scrape_detail_url, scrape_source
from app.services.scraper.extractor import ExtractedOpportunity, extract_opportunities
from app.services.taxonomy import normalize_domains

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

    concurrency = int(getattr(settings, "scrape_concurrency", 1) or 1)
    if concurrency <= 1:
        for source in sources:
            try:
                source_stats = await _process_source(db, source)
                for key in ("new", "updated", "skipped", "chunks"):
                    stats[key] += source_stats.get(key, 0)
            except Exception as e:
                logger.error(f"Pipeline failed for {source.name}: {e}")
                stats["errors"] += 1
    else:
        sem = asyncio.Semaphore(concurrency)

        async def _run_one(src: Source) -> dict:
            async with sem:
                local_db = SessionLocal()
                try:
                    return await _process_source(local_db, src)
                except Exception as e:
                    logger.error(f"Pipeline failed for {src.name}: {e}")
                    return {"errors": 1}
                finally:
                    local_db.close()

        results = await asyncio.gather(*[_run_one(s) for s in sources])
        for res in results:
            if res.get("errors"):
                stats["errors"] += res.get("errors", 0)
            for key in ("new", "updated", "skipped", "chunks"):
                stats[key] += res.get(key, 0)

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
    stats = {"new": 0, "updated": 0, "skipped": 0, "chunks": 0, "errors": 0}
    logger.info(f"Processing source: {source.name} ({source.base_url})")

    # --- Step 1: Scrape ---
    # Use create_task + asyncio.wait instead of wait_for to avoid Python <3.12 hang.
    scrape_timeout = float(getattr(settings, "scrape_timeout_seconds", 300.0))
    scrape_task = asyncio.create_task(scrape_source(source))
    done, pending = await asyncio.wait([scrape_task], timeout=scrape_timeout)
    if pending:
        scrape_task.cancel()
        logger.error(f"Scrape timeout for {source.name} after {scrape_timeout:.0f}s")
        return stats
    if scrape_task.exception():
        logger.error(f"Scrape failed for {source.name}: {scrape_task.exception()}")
        return stats
    markdown = scrape_task.result()
    if not markdown:
        logger.warning(f"No content from {source.name}")
        return stats

    logger.info(f"Scraped {len(markdown)} chars from {source.name}")

    listing_url = source.config.get("listing_url", source.base_url)
    new_hash = content_hash(markdown)

    # --- Step 2: Store raw content (always, even if unchanged) ---
    scrape_page = _store_raw_page(db, source, listing_url, markdown, new_hash)
    # Commit so concurrent item sessions can reference scrape_page_id safely.
    db.commit()
    db.refresh(scrape_page)

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
    extract_timeout = float(getattr(settings, "extraction_timeout_seconds", 180.0))
    extract_task = asyncio.create_task(extract_opportunities(markdown, listing_url))
    done, pending = await asyncio.wait([extract_task], timeout=extract_timeout)
    if pending:
        extract_task.cancel()
        logger.error("Extraction timeout for %s after %.0fs", listing_url, extract_timeout)
        source.last_scraped_at = datetime.now(timezone.utc)
        db.commit()
        return stats
    if extract_task.exception():
        logger.error("Extraction failed for %s: %s", listing_url, extract_task.exception())
        source.last_scraped_at = datetime.now(timezone.utc)
        db.commit()
        return stats
    extracted = extract_task.result()
    if not extracted:
        logger.warning(f"No opportunities extracted from {source.name}")
        source.last_scraped_at = datetime.now(timezone.utc)
        db.commit()
        return stats

    detail_concurrency = int(getattr(settings, "detail_concurrency", 1) or 1)

    async def _process_item(item: ExtractedOpportunity) -> dict:
        local_db = SessionLocal()

        async def _process_item_inner(item_inner: ExtractedOpportunity) -> dict:
            detail_error: str | None = None
            # Always fetch detail page for full data (all sources)
            detail_timeout = float(getattr(settings, "detail_timeout_seconds", 120.0))
            detail_task = asyncio.create_task(_enrich_from_detail(local_db, source, item_inner))
            done, pending = await asyncio.wait([detail_task], timeout=detail_timeout)
            if pending:
                detail_task.cancel()
                detail_error = f"detail_enrich_timeout after {detail_timeout:.0f}s"
                logger.warning(
                    "Detail enrich timeout (title=%s url=%s): %s",
                    item_inner.title, item_inner.url, detail_error,
                )
            elif detail_task.exception():
                detail_error = f"detail_enrich_failed: {detail_task.exception()}"
                logger.warning(
                    "Detail enrich failed (title=%s url=%s): %s",
                    item_inner.title, item_inner.url, detail_task.exception(),
                )
            else:
                item_inner = detail_task.result()
            # is_active is derived solely from deadline fields
            item_inner.is_active = _is_active_from_deadline(item_inner)
            # # Exclude closed opportunities entirely
            # if item_inner.is_active is False:
            #     if item_inner.url:
            #         existing = local_db.query(Opportunity).filter(Opportunity.application_link == item_inner.url).first()
            #         if existing:
            #             if existing.is_active:
            #                 existing.is_active = False
            #                 existing.status = OpportunityStatus.EXPIRED
            #                 existing.updated_at = datetime.now(timezone.utc)
            #             if item_inner.deadline_at and existing.deadline_at != item_inner.deadline_at:
            #                 existing.deadline_at = item_inner.deadline_at
            #             if item_inner.deadline and existing.deadline != item_inner.deadline:
            #                 existing.deadline = item_inner.deadline
            #             local_db.flush()
            #     local_db.commit()
            #     return {"status": "skipped", "item": item_inner, "opp_id": None}

            result, opp_id = _upsert_opportunity(local_db, source, item_inner, scrape_page.id)
            if detail_error and opp_id:
                try:
                    existing = local_db.query(Opportunity).filter(Opportunity.id == opp_id).first()
                    if existing:
                        existing.processing_error = detail_error[:2000]
                except Exception:
                    pass
            local_db.commit()
            return {"status": result, "item": item_inner, "opp_id": opp_id}

        try:
            item_timeout = float(getattr(settings, "item_processing_timeout_seconds", 240.0))
            item_task = asyncio.create_task(_process_item_inner(item))
            done, pending = await asyncio.wait([item_task], timeout=item_timeout)
            if pending:
                item_task.cancel()
                error_msg = f"item_processing_timeout after {item_timeout:.0f}s"
                logger.error(
                    "Item processing timeout (title=%s url=%s): %s",
                    item.title, item.url, error_msg,
                )
                if item.url:
                    try:
                        existing = local_db.query(Opportunity).filter(
                            Opportunity.application_link == item.url
                        ).first()
                        if existing:
                            existing.processing_error = error_msg[:2000]
                            local_db.commit()
                    except Exception:
                        pass
                return {"status": "error", "item": item, "opp_id": None}
            return item_task.result()
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Item processing failed ({item.title}): {error_msg}")
            if item.url:
                try:
                    existing = local_db.query(Opportunity).filter(
                        Opportunity.application_link == item.url
                    ).first()
                    if existing:
                        existing.processing_error = error_msg[:2000]
                        local_db.commit()
                except Exception:
                    pass
            return {"status": "error", "item": item, "opp_id": None}
        finally:
            local_db.close()

    # --- Step 7: Upsert opportunities and link chunks ---
    if detail_concurrency <= 1:
        results = []
        for item in extracted:
            results.append(await _process_item(item))
    else:
        sem = asyncio.Semaphore(detail_concurrency)

        async def _run_with_sem(item: ExtractedOpportunity) -> dict:
            async with sem:
                return await _process_item(item)

        results = await asyncio.gather(*[_run_with_sem(item) for item in extracted])

    for res in results:
        status = res.get("status")
        item = res.get("item")
        opp_id = res.get("opp_id")
        if status == "error":
            stats["errors"] += 1
            continue
        if status == "skipped":
            stats["skipped"] += 1
            continue
        stats[status] += 1
        if opp_id and item:
            if item.detail_scrape_page_id:
                _link_detail_chunks(db, item.detail_scrape_page_id, opp_id)
            matched_chunk_id = _link_chunks_to_opportunity(db, chunk_models, item, opp_id)
            if matched_chunk_id:
                _attach_chunk_reference(db, opp_id, matched_chunk_id)

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
        .delete(synchronize_session=False)
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
    seen_hashes: set[str] = set()
    for chunk in chunks:
        chunk_hash = content_hash(chunk.content)
        if chunk_hash in seen_hashes:
            continue
        seen_hashes.add(chunk_hash)
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
) -> UUID | None:
    """Link chunks that contain the opportunity title to the opportunity record."""
    title_lower = item.title.lower()
    matched_chunk_id: UUID | None = None
    for chunk in chunk_models:
        if title_lower in chunk.content.lower():
            chunk.opportunity_id = opp_id
            if matched_chunk_id is None:
                matched_chunk_id = chunk.id
    return matched_chunk_id


def _upsert_opportunity(
    db: Session, source: Source, item: ExtractedOpportunity, scrape_page_id: UUID
) -> tuple[str, UUID | None]:
    """Insert or update a single opportunity. Returns (status, opportunity_id)."""
    opp_url = item.url or _generate_url(source.base_url, item.title)

    item.domain_tags = _coerce_domain_tags(item.domain_tags) or ["general"]
    item.raw_domain_tags = _coerce_domain_tags(item.raw_domain_tags)

    existing = db.query(Opportunity).filter(Opportunity.application_link == opp_url).first()

    if existing:
        status = _apply_changes(db, existing, item, scrape_page_id)
        return status, existing.id

    category = _coerce_category(item.category)
    opp_status = OpportunityStatus.OPEN if item.is_active else OpportunityStatus.EXPIRED

    opp = Opportunity(
        title=item.title,
        description=item.description,
        category=category,
        domain_tags=normalize_domains(item.domain_tags) or ["general"],
        raw_domain_tags=item.raw_domain_tags or [],
        eligibility=item.eligibility,
        benefits=item.benefits,
        deadline=item.deadline,
        deadline_at=item.deadline_at,
        application_link=opp_url,
        location=item.location or "online",
        source_id=source.id,
        source_url=source.base_url,
        scrape_page_id=scrape_page_id,
        confidence=item.confidence,
        status=opp_status,
        is_active=bool(item.is_active),
        processing_error=None,
        scraped_at=datetime.now(timezone.utc),
    )
    db.add(opp)
    db.flush()
    return "new", opp.id


def _apply_changes(
    db: Session, existing: Opportunity, item: ExtractedOpportunity, scrape_page_id: UUID
) -> str:
    """Compare and apply field-level changes. Returns 'updated' or 'skipped'."""
    changed = False

    item.domain_tags = _coerce_domain_tags(item.domain_tags) or ["general"]
    item.raw_domain_tags = _coerce_domain_tags(item.raw_domain_tags)

    if item.description and existing.description != item.description:
        existing.description = item.description
        changed = True
    if item.deadline and existing.deadline != item.deadline:
        existing.deadline = item.deadline
        changed = True
    if item.deadline_at and existing.deadline_at != item.deadline_at:
        existing.deadline_at = item.deadline_at
        changed = True
    if item.eligibility and existing.eligibility != item.eligibility:
        existing.eligibility = item.eligibility
        changed = True
    if item.benefits and existing.benefits != item.benefits:
        existing.benefits = item.benefits
        changed = True
    if item.domain_tags:
        normalized_new = normalize_domains(item.domain_tags)
        normalized_existing = normalize_domains(existing.domain_tags or [])
        if normalized_new != normalized_existing:
            existing.domain_tags = normalized_new
            changed = True
    if item.raw_domain_tags is not None:
        if (item.raw_domain_tags or []) != (existing.raw_domain_tags or []):
            existing.raw_domain_tags = item.raw_domain_tags
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
    if existing.is_active != bool(item.is_active):
        existing.is_active = bool(item.is_active)
        changed = True
    if item.location and existing.location != item.location:
        existing.location = item.location
        changed = True
    if scrape_page_id and existing.scrape_page_id != scrape_page_id:
        existing.scrape_page_id = scrape_page_id
        changed = True

    if not changed:
        return "skipped"

    # Sync status with is_active
    new_status = OpportunityStatus.OPEN if existing.is_active else OpportunityStatus.EXPIRED
    if existing.status != new_status:
        existing.status = new_status
    # Clear any previous processing error on successful re-process
    existing.processing_error = None
    existing.updated_at = datetime.now(timezone.utc)
    existing.scraped_at = datetime.now(timezone.utc)
    existing.embedding = None
    return "updated"


def _attach_chunk_reference(db: Session, opp_id: UUID, chunk_id: UUID) -> None:
    opp = db.query(Opportunity).filter(Opportunity.id == opp_id).first()
    if not opp:
        return
    if opp.content_chunk_id != chunk_id:
        opp.content_chunk_id = chunk_id


def _link_detail_chunks(db: Session, scrape_page_id: UUID, opp_id: UUID) -> None:
    """Link all chunks from a detail page to the opportunity."""
    db.query(ContentChunk).filter(
        ContentChunk.scrape_page_id == scrape_page_id
    ).update({"opportunity_id": opp_id}, synchronize_session=False)


def _expire_past_deadlines(db: Session) -> int:
    """Mark opportunities with past deadlines as inactive.

    Auto-expiry behaviour (SOIP-101 / SOIP-307)
    ============================================
    **When it runs:**
      - Every 1 hour via APScheduler (see scheduler.py → _expire_opportunities)
      - Can also be triggered manually (see below)

    **What it does:**
      UPDATE opportunities
      SET is_active = false, status = 'expired', updated_at = now()
      WHERE deadline < CURRENT_DATE AND is_active = true

    **Manual trigger for testing:**
      >>> from app.database import get_db_context
      >>> from app.services.scraper.pipeline import _expire_past_deadlines
      >>> with get_db_context() as db:
      ...     count = _expire_past_deadlines(db)
      ...     print(f"Expired {count} opportunities")

    **Edge cases:**
      - Opportunities with no deadline (deadline IS NULL) are left active.
      - Opportunities whose deadline is today are kept active (strict < comparison).
      - Already-expired records (is_active=False) are skipped to avoid redundant updates.
    """
    count = (
        db.query(Opportunity)
        .filter(
            Opportunity.deadline < date.today(),
            Opportunity.is_active.is_(True),
        )
        .update({
            "is_active": False,
            "status": OpportunityStatus.EXPIRED.value,
            "updated_at": datetime.now(timezone.utc),
        })
    )
    db.commit()
    logger.info(f"Expired {count} past-deadline opportunities")
    return count


def _generate_url(base_url: str, title: str) -> str:
    """Generate a deterministic URL slug when the extractor doesn't find one."""
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:80]
    return f"{base_url.rstrip('/')}#/{slug}"


def _apply_unstop_detail_parsing(
    item: ExtractedOpportunity, detail_markdown: str
) -> ExtractedOpportunity:
    """Apply Unstop-specific parsing (description, benefits, tags, deadlines)."""
    improved_desc = _extract_unstop_description(detail_markdown)
    if improved_desc:
        if not item.description or len(improved_desc) > len(item.description) or len(item.description) < 200:
            item.description = improved_desc

    improved_benefits = _extract_unstop_benefits(detail_markdown)
    if improved_benefits:
        if not item.benefits or len(improved_benefits) > len(item.benefits):
            item.benefits = improved_benefits

    inferred_tags = _infer_online_offline_tags(detail_markdown)
    if inferred_tags:
        merged = normalize_domains((item.domain_tags or []) + inferred_tags)
        item.domain_tags = merged or ["general"]

    parsed_deadline = _extract_unstop_registration_close(detail_markdown)
    if parsed_deadline:
        item.deadline = parsed_deadline
    parsed_deadline_at = _extract_unstop_registration_close_datetime(detail_markdown)
    if parsed_deadline_at:
        item.deadline_at = parsed_deadline_at

    return item


async def _enrich_from_detail(
    db: Session, source: Source, item: ExtractedOpportunity
) -> ExtractedOpportunity:
    """Fetch detail page for any source, store raw content/chunks, and extract full data."""
    if not item.url:
        return item

    detail_markdown = await scrape_detail_url(item.url, source)
    if not detail_markdown:
        return item

    _store_detail_page_and_chunks(db, source, item, detail_markdown)

    # Extract from detail markdown for better accuracy
    extracted = await extract_opportunities(detail_markdown, item.url)
    if extracted:
        best = _pick_best_match(extracted, item)
        if best:
            if not best.url and item.url:
                best.url = item.url
            item = best

    # Apply Unstop-specific parsing on detail markdown (if applicable)
    if item.url and "unstop.com/" in item.url.lower():
        item = _apply_unstop_detail_parsing(item, detail_markdown)
    else:
        # Generic fallback if description looks truncated
        if _is_truncated_description(item.description):
            fallback = _extract_generic_description(detail_markdown)
            if fallback and len(fallback) > len(item.description or ""):
                item.description = fallback

    return item


def _extract_unstop_description(markdown: str) -> Optional[str]:
    patterns = [
        r"##\s+All that you need to know about.*?\n",
        r"##\s+About\s+the\s+Opportunity.*?\n",
        r"##\s+About.*?\n",
        r"##\s+Overview.*?\n",
    ]
    start_match = None
    for pattern in patterns:
        match = re.search(pattern, markdown, flags=re.IGNORECASE)
        if match:
            start_match = match
            break
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
    return cleaned


def _is_truncated_description(desc: str | None) -> bool:
    if not desc:
        return True
    text = desc.strip()
    if text.endswith("...") or "https..." in text or "http..." in text:
        return True
    return False


def _extract_generic_description(markdown: str) -> Optional[str]:
    """Best-effort long description from detail markdown for non-Unstop sources."""
    if not markdown:
        return None
    text = re.sub(r"!\[[^\]]*\]\([^)]+\)", " ", markdown)  # remove images
    text = re.sub(r"\[[^\]]+\]\([^)]+\)", " ", text)  # remove markdown links
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)

    # Split into blocks and pick the longest meaningful block
    blocks = [b.strip() for b in re.split(r"\n#{1,4}\s+|\n\n", text) if b.strip()]
    candidates = [b for b in blocks if len(b) >= 200]
    if not candidates:
        return None
    best = max(candidates, key=len)
    # Cap to avoid overly large fields
    return best[:5000]


def _extract_unstop_benefits(markdown: str) -> Optional[str]:
    """Extract rewards/prizes section from Unstop detail pages."""
    patterns = [
        r"##\s+Rewards\s+and\s+Prizes.*?\n",
        r"##\s+Rewards\s+&\s+Recognition.*?\n",
        r"##\s+Rewards.*?\n",
        r"##\s+Prizes.*?\n",
        r"##\s+Prize.*?\n",
        r"##\s+Awards.*?\n",
        r"##\s+Prize\s+Pool.*?\n",
        r"##\s+Prize\s+Money.*?\n",
    ]
    start = None
    for pattern in patterns:
        match = re.search(pattern, markdown, flags=re.IGNORECASE)
        if match:
            start = match
            break
    if not start:
        return None

    tail = markdown[start.end():]
    end_markers = (
        "## ",
        "### ",
        "#### ",
        "## Eligibility",
        "## Registration",
        "## Timeline",
        "## Rules",
        "## FAQs",
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
    cleaned = section.strip()
    if len(cleaned) < 20:
        return None
    return cleaned


def _infer_online_offline_tags(markdown: str) -> list[str]:
    lowered = markdown.lower()
    tags: list[str] = []
    for tag in _ONLINE_OFFLINE_TAGS:
        if re.search(rf"\b{tag}\b", lowered):
            tags.append(tag)
    return tags


def _is_active_from_deadline(item: ExtractedOpportunity) -> bool:
    """Return active status derived solely from deadline fields."""
    now = datetime.now(timezone.utc)
    if item.deadline_at:
        return item.deadline_at >= now
    if item.deadline:
        return item.deadline >= date.today()
    return True


def _extract_unstop_registration_close(markdown: str) -> Optional[date]:
    dt = _extract_unstop_registration_close_datetime(markdown)
    if dt is None:
        return None
    return dt.date()


def _extract_unstop_registration_close_datetime(markdown: str) -> Optional[datetime]:
    match = re.search(
        r"Registrations?\s+Close\s*:\s*([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{2,4},\s*[0-9]{1,2}:[0-9]{2}\s*[AP]M)\s*([A-Z]{2,4})?",
        markdown,
        flags=re.IGNORECASE,
    )
    if not match:
        return None
    raw = match.group(1).strip()
    tz = (match.group(2) or "IST").upper()
    try:
        naive = datetime.strptime(raw, "%d %b %y, %I:%M %p")
    except ValueError:
        try:
            naive = datetime.strptime(raw, "%d %b %Y, %I:%M %p")
        except ValueError:
            try:
                naive = datetime.strptime(raw, "%d %B %Y, %I:%M %p")
            except ValueError:
                return None
    if tz == "IST":
        return naive.replace(tzinfo=timezone(timedelta(hours=5, minutes=30)))
    return naive.replace(tzinfo=timezone.utc)


def _store_detail_page_and_chunks(
    db: Session,
    source: Source,
    item: ExtractedOpportunity,
    detail_markdown: str,
) -> None:
    """Store detail page raw content + chunks and attach scrape_page_id to item."""
    try:
        detail_hash = content_hash(detail_markdown)
        detail_page = _store_raw_page(db, source, item.url, detail_markdown, detail_hash)
        item.detail_scrape_page_id = detail_page.id
        detail_chunks = chunk_markdown(detail_markdown)
        _store_chunks(db, detail_page, source, detail_chunks)
    except Exception:
        pass


def _pick_best_match(
    extracted: list[ExtractedOpportunity],
    seed: ExtractedOpportunity,
) -> ExtractedOpportunity | None:
    """Pick best extracted opportunity from detail page based on URL or title."""
    if seed.url:
        for opp in extracted:
            if opp.url and opp.url.strip().lower() == seed.url.strip().lower():
                return opp
    seed_title = (seed.title or "").strip().lower()
    if seed_title:
        for opp in extracted:
            if opp.title and opp.title.strip().lower() == seed_title:
                return opp
    return extracted[0] if extracted else None


def _normalize_domain_tags(tags: list[str]) -> list[str]:
    # Backward-compatible alias
    return normalize_domains(tags)


def _coerce_domain_tags(raw) -> list[str]:
    """Normalize domain tag input into a list of strings."""
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(x).strip() for x in raw if str(x).strip()]
    if isinstance(raw, str):
        text = raw.strip()
        if not text:
            return []
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(x).strip() for x in parsed if str(x).strip()]
        except Exception:
            pass
        return [t.strip() for t in text.split(",") if t.strip()]
    return [str(raw).strip()] if str(raw).strip() else []


def _coerce_category(raw: str | None) -> OpportunityCategory:
    """Coerce category string into enum, tolerating casing."""
    if not raw:
        return OpportunityCategory.OTHER
    normalized = str(raw).strip().lower()
    try:
        return OpportunityCategory(normalized)
    except ValueError:
        return OpportunityCategory.OTHER
