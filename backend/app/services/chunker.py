"""
Chunker — splits raw markdown into semantic chunks for embedding.

Strategy:
  1. Split on natural boundaries (## headers, ---, blank-line-separated blocks)
  2. Keep each chunk between 100–500 tokens (approx 4 chars/token)
  3. Overlap: prepend the last sentence of the previous chunk for continuity
  4. Each chunk is self-contained enough for embedding + retrieval
"""

import hashlib
import logging
import re
from dataclasses import dataclass

logger = logging.getLogger(__name__)

_MIN_CHUNK_CHARS = 200
_MAX_CHUNK_CHARS = 2000
_OVERLAP_CHARS = 100

_SECTION_SPLIT = re.compile(r"\n(?=#{1,3}\s)|(?:\n---+\n)|\n{3,}")


@dataclass
class Chunk:
    index: int
    content: str
    token_estimate: int


def chunk_markdown(raw_content: str) -> list[Chunk]:
    """Split markdown into semantic chunks with overlap."""
    if not raw_content or len(raw_content.strip()) < _MIN_CHUNK_CHARS:
        if raw_content and raw_content.strip():
            return [Chunk(index=0, content=raw_content.strip(), token_estimate=_estimate_tokens(raw_content))]
        return []

    sections = _split_into_sections(raw_content)
    chunks = _merge_small_sections(sections)

    result: list[Chunk] = []
    prev_tail = ""

    for i, text in enumerate(chunks):
        if prev_tail and i > 0:
            text = prev_tail + "\n" + text

        result.append(Chunk(
            index=i,
            content=text.strip(),
            token_estimate=_estimate_tokens(text),
        ))

        prev_tail = _get_tail(text, _OVERLAP_CHARS)

    logger.debug(f"Chunked {len(raw_content)} chars into {len(result)} chunks")
    return result


def content_hash(text: str) -> str:
    """SHA-256 hash of content for change detection."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _split_into_sections(text: str) -> list[str]:
    """Split on markdown headers, horizontal rules, and triple newlines."""
    parts = _SECTION_SPLIT.split(text)
    return [p.strip() for p in parts if p and p.strip()]


def _merge_small_sections(sections: list[str]) -> list[str]:
    """Merge sections that are too small; split ones that are too large."""
    merged: list[str] = []
    buffer = ""

    for section in sections:
        if len(buffer) + len(section) < _MAX_CHUNK_CHARS:
            buffer = (buffer + "\n\n" + section).strip() if buffer else section
        else:
            if buffer:
                merged.append(buffer)
            if len(section) > _MAX_CHUNK_CHARS:
                merged.extend(_split_long_section(section))
                buffer = ""
            else:
                buffer = section

    if buffer:
        merged.append(buffer)

    return merged


def _split_long_section(text: str) -> list[str]:
    """Break a long section into chunks at paragraph or sentence boundaries."""
    paragraphs = text.split("\n\n")
    chunks: list[str] = []
    buffer = ""

    for para in paragraphs:
        if len(buffer) + len(para) < _MAX_CHUNK_CHARS:
            buffer = (buffer + "\n\n" + para).strip() if buffer else para
        else:
            if buffer:
                chunks.append(buffer)
            if len(para) > _MAX_CHUNK_CHARS:
                for i in range(0, len(para), _MAX_CHUNK_CHARS):
                    chunks.append(para[i : i + _MAX_CHUNK_CHARS].strip())
                buffer = ""
            else:
                buffer = para

    if buffer:
        chunks.append(buffer)

    return chunks


def _get_tail(text: str, max_chars: int) -> str:
    """Get the last ~max_chars of text, breaking at a sentence boundary."""
    if len(text) <= max_chars:
        return text
    tail = text[-max_chars:]
    sentence_break = tail.find(". ")
    if sentence_break > 0:
        return tail[sentence_break + 2 :]
    return tail


def _estimate_tokens(text: str) -> int:
    """Rough token estimate (~4 chars per token for English)."""
    return max(1, len(text) // 4)
