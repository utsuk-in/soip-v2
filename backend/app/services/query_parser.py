"""
Query understanding — GPT-4o-mini parses natural language into structured filters.

Converts "What AI hackathons can I join before April?" into:
  ParsedQuery(intent="search", search_text="AI hackathons",
              categories=["hackathon"], domains=["AI"],
              deadline_before=date(2026,4,30))
"""

import json
import logging
from dataclasses import dataclass, field
from datetime import date
from typing import Optional

from openai import AsyncOpenAI

from app.config import settings
from app.services.taxonomy import normalize_domains

logger = logging.getLogger(__name__)

_client = AsyncOpenAI(api_key=settings.openai_api_key)

_SYSTEM_PROMPT = """\
You parse student opportunity queries into structured JSON for a search engine.

Return ONLY valid JSON with these fields:
{
  "intent": "search" | "ask" | "explore",
  "search_text": "semantic search query (rewrite for embedding similarity)",
  "categories": ["hackathon","grant","fellowship","internship","competition","scholarship","program"] or null,
  "domains": ["AI","climate","fintech","healthcare","web3","robotics","education","social-impact"] or null,
  "deadline_before": "YYYY-MM-DD" or null,
  "deadline_after": "YYYY-MM-DD" or null
}

Rules:
- "intent" = "search" when looking for specific opportunities, "ask" for general \
questions, "explore" for broad browsing
- "search_text" should be a clean semantic query, NOT the raw user message
- Only include "categories" / "domains" if the user explicitly or implicitly mentions them
- For temporal phrases like "this month", "before April", "next week", compute the \
actual date using today's date provided below
- Return null (not empty arrays) when a filter does not apply
"""


@dataclass
class ParsedQuery:
    intent: str = "search"
    search_text: str = ""
    categories: Optional[list[str]] = None
    domains: Optional[list[str]] = None
    deadline_before: Optional[date] = None
    deadline_after: Optional[date] = None


async def understand_query(message: str) -> ParsedQuery:
    """Use GPT-4o-mini to parse intent, filters, and a clean search phrase."""
    try:
        response = await _client.chat.completions.create(
            model=settings.openai_model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Today is {date.today().isoformat()}.\nQuery: \"{message}\"",
                },
            ],
            temperature=0.0,
            max_tokens=256,
        )
        return _parse_response(response.choices[0].message.content, message)

    except Exception as e:
        logger.error(f"Query understanding failed: {e}")
        return ParsedQuery(intent="search", search_text=message)


def _parse_response(raw_json: str, fallback_text: str) -> ParsedQuery:
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError:
        return ParsedQuery(intent="search", search_text=fallback_text)

    deadline_before = _parse_date(data.get("deadline_before"))
    deadline_after = _parse_date(data.get("deadline_after"))

    return ParsedQuery(
        intent=data.get("intent", "search"),
        search_text=data.get("search_text") or fallback_text,
        categories=data.get("categories"),
        domains=normalize_domains(data.get("domains")),
        deadline_before=deadline_before,
        deadline_after=deadline_after,
    )


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except (ValueError, TypeError):
        return None
