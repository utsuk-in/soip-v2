import json
import logging
import re
from dataclasses import dataclass
from typing import Iterable

from openai import AsyncOpenAI

from app.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)

_client = AsyncOpenAI(api_key=settings.openai_api_key)

_MAX_SENTENCES = 3
_MIN_SENTENCES = 1
_BATCH_SIZE = 10


@dataclass(frozen=True)
class ExplanationOpportunity:
    id: str
    title: str
    category: str | None = None
    domain_tags: list[str] | None = None
    location: str | None = None
    deadline: str | None = None
    description: str | None = None


def _build_profile_context(user: User) -> str:
    parts = [
        f"Name: {user.first_name or 'Student'}",
        f"Academic Background: {user.academic_background or 'Not specified'}",
        f"Year of Study: {user.year_of_study or 'Not specified'}",
        f"State: {user.state or 'Not specified'}",
        f"Skills: {', '.join(user.skills or []) or 'Not specified'}",
        f"Interests: {', '.join(user.interests or []) or 'Not specified'}",
        f"Looking for: {', '.join(user.aspirations or []) or 'Not specified'}",
    ]
    return "\n".join(f"- {p}" for p in parts)


def _has_context(user: User, query_text: str | None) -> bool:
    if query_text and query_text.strip():
        return True
    return any(
        [
            user.academic_background,
            user.year_of_study,
            user.state,
            user.skills,
            user.interests,
            user.aspirations,
        ]
    )


def _split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p.strip() for p in parts if p.strip()]


def _clean_explanation(text: str) -> str | None:
    if not text or not text.strip():
        return None
    sentences = _split_sentences(text)
    if len(sentences) < _MIN_SENTENCES:
        return None
    trimmed = sentences[:_MAX_SENTENCES]
    return " ".join(trimmed).strip()


def _fallback_explanation(user: User, opp: ExplanationOpportunity) -> str | None:
    """Deterministic fallback when LLM explanation is unavailable."""
    user_tags = set((t.lower() for t in (user.interests or []))) | set(
        (t.lower() for t in (user.skills or []))
    )
    opp_tags = set(t.lower() for t in (opp.domain_tags or []))
    overlap = user_tags & opp_tags

    cat = opp.category
    if hasattr(cat, "value"):
        cat = cat.value

    parts: list[str] = []
    if overlap:
        parts.append(
            f"This {cat or 'opportunity'} aligns with your interest in {', '.join(sorted(overlap))}."
        )
    elif cat:
        parts.append(f"This {cat} may match your profile.")

    return " ".join(parts) if parts else None


async def generate_relevance_explanations(
    user: User,
    query_text: str | None,
    opportunities: Iterable[ExplanationOpportunity],
) -> dict[str, str]:
    opps = list(opportunities)
    if not opps or not _has_context(user, query_text):
        return {}

    # Fire all batches concurrently for maximum throughput
    tasks = []
    for batch_start in range(0, len(opps), _BATCH_SIZE):
        batch = opps[batch_start : batch_start + _BATCH_SIZE]
        tasks.append(_generate_batch(user, query_text, batch))

    import asyncio

    batch_results = await asyncio.gather(*tasks, return_exceptions=True)

    all_explanations: dict[str, str] = {}
    for result in batch_results:
        if isinstance(result, dict):
            all_explanations.update(result)

    for opp in opps:
        if str(opp.id) not in all_explanations:
            fallback = _fallback_explanation(user, opp)
            if fallback:
                all_explanations[str(opp.id)] = fallback

    return all_explanations


async def _generate_batch(
    user: User,
    query_text: str | None,
    opps: list[ExplanationOpportunity],
) -> dict[str, str]:
    """Generate explanations for a batch using integer indices instead of UUIDs."""
    index_to_id: dict[str, str] = {}
    opp_lines = []

    for idx, opp in enumerate(opps):
        index_to_id[str(idx)] = opp.id
        domains = ", ".join(opp.domain_tags or [])
        cat = opp.category
        if hasattr(cat, "value"):
            cat = cat.value
        opp_lines.append(
            f"- index: {idx}\n"
            f"  title: {opp.title}\n"
            f"  category: {cat or 'other'}\n"
            f"  domain_tags: {domains or 'none'}\n"
            f"  description: {(opp.description or '')[:240]}"
        )

    system_prompt = (
        "You write short relevance explanations for students. "
        "Each explanation must be 1-3 sentences, friendly, and mention at least one "
        "specific detail from the student's profile or query. "
        "Keep it concise and avoid bullet points."
    )

    user_prompt = (
        "Student profile:\n"
        f"{_build_profile_context(user)}\n\n"
        f"Query context: {query_text or 'Not provided'}\n\n"
        "Opportunities:\n"
        f"{chr(10).join(opp_lines)}\n\n"
        "Return JSON ONLY. Use the integer index as key:\n"
        "{\n"
        '  "explanations": {\n'
        '    "0": "<1-3 sentence explanation>",\n'
        '    "1": "<1-3 sentence explanation>"\n'
        "  }\n"
        "}"
    )

    # Dynamic token budget: ~120 tokens per explanation + overhead
    max_tokens = min(4096, len(opps) * 120 + 100)

    try:
        response = await _client.chat.completions.create(
            model=settings.openai_model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.4,
            max_tokens=max_tokens,
        )
        payload = json.loads(response.choices[0].message.content or "{}")
        raw = payload.get("explanations", {}) if isinstance(payload, dict) else {}

        cleaned: dict[str, str] = {}
        for idx_str, real_id in index_to_id.items():
            text = raw.get(idx_str) if isinstance(raw, dict) else None
            cleaned_text = _clean_explanation(text or "")
            if cleaned_text:
                cleaned[real_id] = cleaned_text
        return cleaned
    except Exception as e:
        logger.error(f"Relevance explanation batch failed: {e}")
        return {}
