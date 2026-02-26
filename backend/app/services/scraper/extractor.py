"""
GPT-4o-mini extraction — converts raw markdown into structured opportunity data.

Handles large pages by splitting into segments and extracting from each,
then deduplicating across segments. Tolerates truncated JSON responses.
"""

import json
import logging
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from openai import AsyncOpenAI

from app.config import settings
from app.services.taxonomy import normalize_domains

logger = logging.getLogger(__name__)

_client = AsyncOpenAI(api_key=settings.openai_api_key)

_SYSTEM_PROMPT = """\
You are an expert data extractor for student opportunities (hackathons, grants, \
fellowships, internships, competitions, scholarships, programs).

Given markdown content from a webpage, extract ALL distinct opportunities into a \
structured JSON array.

For each opportunity, extract:
- title: The opportunity name (required)
- description: The complete opportunity description as written on the page. Do not summarize or truncate. Preserve key details and sections in plain text. (required)
- category: One of: hackathon, grant, fellowship, internship, competition, \
scholarship, program, other (required)
- domain_tags: List of relevant domains, Add domain tags relevant to the title and description. some examples like but not limited to ["AI", "climate", "fintech", \
"healthcare", "web3", "robotics", "education", "social-impact", "general", \
"online", "offline"] — include "online" or "offline" if the opportunity format is stated (required, at least 1)
- eligibility: Who can apply — degree level, year, nationality, age, etc. (if mentioned)
- benefits: What winners/participants get — prize money, stipend, mentorship, \
certificate, perks, cash prizes, etc. (if mentioned under rewards and prizes or similar)
- deadline: Application/registration deadline in YYYY-MM-DD format only. \
Use the current year when only day/month are given. If unclear or relative ("tomorrow", "next week"), leave null.
- url: Direct link to the opportunity page (if available, null otherwise)
- is_active: true if open, false if closed/ended (if explicitly stated)
- deadline_at: Full deadline timestamp with timezone (ISO 8601) if explicitly shown (e.g., 2026-02-26T12:26:00+05:30)
- confidence: Your confidence in the extraction accuracy from 0.0 to 1.0

Rules:
- Only extract REAL opportunities, not navigation links or ads
- If the page lists multiple opportunities, extract each one separately
- Use the current year for deadlines when only month/day are given
- Set confidence lower (0.3-0.6) when key fields are guessed or ambiguous
- Set confidence higher (0.7-1.0) when fields are clearly stated
- Return {"opportunities": [...]} as the top-level JSON structure
- If no opportunities are found, return {"opportunities": []}
"""

_VALID_CATEGORIES = frozenset(
    {"hackathon", "grant", "fellowship", "internship",
     "competition", "scholarship", "program", "other"}
)

_CATEGORY_FUZZY_MAP = {
    "hack": "hackathon",
    "fund": "grant",
    "intern": "internship",
    "scholar": "scholarship",
    "compete": "competition",
    "fellow": "fellowship",
    "programme": "program",
}

_SEGMENT_CHARS = 15_000  # each LLM call gets at most this much content
_SEGMENT_OVERLAP = 500   # overlap between segments to avoid splitting an opportunity
_MAX_OUTPUT_TOKENS = 8192
_MIN_CONTENT_LENGTH = 50


@dataclass
class ExtractedOpportunity:
    title: str
    description: str
    category: str
    domain_tags: list[str] = field(default_factory=lambda: ["general"])
    raw_domain_tags: list[str] = field(default_factory=list)
    eligibility: Optional[str] = None
    benefits: Optional[str] = None
    deadline: Optional[date] = None
    deadline_at: Optional[datetime] = None
    url: Optional[str] = None
    confidence: float = 0.5
    is_active: bool = True
    detail_scrape_page_id: Optional[UUID] = None


async def extract_opportunities(
    markdown: str, source_url: str
) -> list[ExtractedOpportunity]:
    """Extract structured opportunities, splitting large content into segments."""
    if not markdown or len(markdown.strip()) < _MIN_CONTENT_LENGTH:
        logger.warning(f"Skipping extraction for {source_url}: content too short")
        return []

    segments = _split_into_segments(markdown)
    max_segments = getattr(settings, "extraction_max_segments", 0) or 0
    if max_segments > 0:
        segments = segments[:max_segments]
        logger.info(f"Extracting from first {len(segments)} segment(s) only (extraction_max_segments={max_segments}) for {source_url}")
    else:
        logger.info(f"Extracting from {len(segments)} segment(s) for {source_url}")

    all_results: list[ExtractedOpportunity] = []
    for i, segment in enumerate(segments):
        segment_results = await _extract_segment(segment, source_url, i + 1, len(segments))
        all_results.extend(segment_results)

    deduped = _deduplicate(all_results)
    logger.info(f"Extracted {len(deduped)} unique opportunities from {source_url} ({len(all_results)} before dedup)")
    for i, opp in enumerate(deduped, 1):
        logger.info(
            "[EXTRACT] opportunity %s: title=%s | deadline=%s | domain_tags=%s | category=%s",
            i, repr(opp.title[:60]), opp.deadline, opp.domain_tags, opp.category,
        )
    return deduped


async def _extract_segment(
    content: str, source_url: str, seg_num: int, total_segs: int
) -> list[ExtractedOpportunity]:
    """Run extraction LLM call on a single segment."""
    seg_label = f"segment {seg_num}/{total_segs}"

    try:
        response = await _client.chat.completions.create(
            model=settings.openai_model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Source URL: {source_url}\n"
                        f"Today's date: {date.today().isoformat()}\n"
                        f"Segment: {seg_label}\n\n"
                        f"Content:\n{content}"
                    ),
                },
            ],
            temperature=0.0,
            max_tokens=_MAX_OUTPUT_TOKENS,
        )

        raw = response.choices[0].message.content
        finish_reason = response.choices[0].finish_reason

        if finish_reason == "length":
            logger.warning(f"Output truncated for {source_url} ({seg_label}), attempting JSON repair")
            return _parse_response_with_repair(raw, source_url)

        return _parse_response(raw, source_url)

    except Exception as e:
        logger.error(f"Extraction failed for {source_url} ({seg_label}): {e}")
        return []


def _split_into_segments(markdown: str) -> list[str]:
    """Split large content into overlapping segments for separate LLM calls."""
    if len(markdown) <= _SEGMENT_CHARS:
        return [markdown]

    segments: list[str] = []
    start = 0
    while start < len(markdown):
        end = start + _SEGMENT_CHARS

        if end < len(markdown):
            # Try to break at a paragraph or header boundary
            breakpoint = _find_break(markdown, end - 500, end)
            if breakpoint > start:
                end = breakpoint

        segments.append(markdown[start:end])
        start = end - _SEGMENT_OVERLAP

    return segments


def _find_break(text: str, search_start: int, search_end: int) -> int:
    """Find a clean break point (double newline or header) in the given range."""
    chunk = text[search_start:search_end]

    for pattern in ["\n\n", "\n#", "\n---"]:
        idx = chunk.rfind(pattern)
        if idx >= 0:
            return search_start + idx + len(pattern)

    return search_end


def _parse_response(
    raw_json: str, source_url: str
) -> list[ExtractedOpportunity]:
    """Parse JSON response into ExtractedOpportunity objects."""
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError:
        logger.warning(f"Invalid JSON from extraction for {source_url}, attempting repair")
        return _parse_response_with_repair(raw_json, source_url)

    items = data.get("opportunities", [])
    results: list[ExtractedOpportunity] = []

    for item in items:
        try:
            opp = _parse_single(item)
            if opp:
                results.append(opp)
        except Exception as e:
            logger.warning(f"Skipping malformed opportunity: {e}")

    logger.info(f"Parsed {len(results)} opportunities from {source_url}")
    return results


def _parse_response_with_repair(
    raw_json: str, source_url: str
) -> list[ExtractedOpportunity]:
    """Attempt to salvage data from truncated JSON.

    Strategy: close any open brackets/braces and parse what we can.
    Even if the last opportunity is incomplete, we get the ones before it.
    """
    repaired = raw_json.rstrip()

    # Close array and object if truncated mid-way
    if not repaired.endswith("}"):
        # Find the last complete opportunity object (ends with })
        last_brace = repaired.rfind("}")
        if last_brace > 0:
            repaired = repaired[:last_brace + 1]

    # Close the array
    if repaired.count("[") > repaired.count("]"):
        repaired += "]"
    # Close the outer object
    if repaired.count("{") > repaired.count("}"):
        repaired += "}"

    try:
        data = json.loads(repaired)
        items = data.get("opportunities", [])
        results = []
        for item in items:
            try:
                opp = _parse_single(item)
                if opp:
                    results.append(opp)
            except Exception:
                pass
        logger.info(f"Repaired JSON: salvaged {len(results)} opportunities from {source_url}")
        return results
    except json.JSONDecodeError:
        logger.error(f"JSON repair failed for {source_url}, raw length={len(raw_json)}")
        return []


def _deduplicate(opps: list[ExtractedOpportunity]) -> list[ExtractedOpportunity]:
    """Remove duplicates across segments by URL or normalized title."""
    seen_urls: set[str] = set()
    seen_titles: set[str] = set()
    unique: list[ExtractedOpportunity] = []

    for opp in opps:
        key_url = (opp.url or "").strip().lower()
        key_title = re.sub(r"\s+", " ", opp.title.lower().strip())

        if key_url and key_url in seen_urls:
            continue
        if key_title in seen_titles:
            continue

        if key_url:
            seen_urls.add(key_url)
        seen_titles.add(key_title)
        unique.append(opp)

    return unique


def _parse_single(item: dict) -> Optional[ExtractedOpportunity]:
    """Parse a single opportunity dict into a dataclass."""
    title = (item.get("title") or "").strip()
    description = (item.get("description") or "").strip()
    if not title or not description:
        return None

    deadline = None
    deadline_at = None
    if item.get("deadline"):
        try:
            deadline = datetime.strptime(item["deadline"], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            pass
    if item.get("deadline_at"):
        try:
            deadline_at = datetime.fromisoformat(str(item["deadline_at"]))
        except (ValueError, TypeError):
            deadline_at = None

    raw_active = item.get("is_active", True)
    is_active = True
    if isinstance(raw_active, bool):
        is_active = raw_active
    elif isinstance(raw_active, str):
        lowered = raw_active.strip().lower()
        if "closed" in lowered or "ended" in lowered:
            is_active = False
        elif "open" in lowered:
            is_active = True

    # Heuristic: if description explicitly mentions closed
    desc_lower = description.lower()
    if "closed" in desc_lower or "registrations closed" in desc_lower:
        is_active = False

    raw_tags = item.get("domain_tags") or ["general"]
    normalized_tags = normalize_domains(raw_tags) or ["general"]

    return ExtractedOpportunity(
        title=title,
        description=description,
        category=_normalize_category(item.get("category", "other")),
        domain_tags=normalized_tags,
        raw_domain_tags=raw_tags,
        eligibility=item.get("eligibility"),
        benefits=item.get("benefits"),
        deadline=deadline,
        deadline_at=deadline_at,
        url=item.get("url"),
        confidence=min(1.0, max(0.0, float(item.get("confidence", 0.5)))),
        is_active=is_active,
    )


def _normalize_category(raw: str) -> str:
    """Normalize category string to a valid enum value."""
    normalized = raw.strip().lower()
    if normalized in _VALID_CATEGORIES:
        return normalized
    for prefix, cat in _CATEGORY_FUZZY_MAP.items():
        if prefix in normalized:
            return cat
    return "other"
