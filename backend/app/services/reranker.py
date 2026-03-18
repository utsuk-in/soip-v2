"""
Cross-encoder reranker service (local).
Uses sentence-transformers CrossEncoder when available.
Falls back to no-op if dependencies/model are unavailable.
"""

from __future__ import annotations

import logging
from collections import OrderedDict
from functools import lru_cache
import hashlib
from typing import Iterable, List

from app.config import settings
from app.services.retriever import ScoredOpportunity

logger = logging.getLogger(__name__)

_DEFAULT_CACHE_SIZE = 2048


class _ScoreCache:
    def __init__(self, max_size: int) -> None:
        self.max_size = max_size
        self._data: OrderedDict[str, float] = OrderedDict()

    def get(self, key: str) -> float | None:
        if key not in self._data:
            return None
        value = self._data.pop(key)
        self._data[key] = value
        return value

    def set(self, key: str, value: float) -> None:
        if key in self._data:
            self._data.pop(key)
        self._data[key] = value
        if len(self._data) > self.max_size:
            self._data.popitem(last=False)


_score_cache = _ScoreCache(max_size=_DEFAULT_CACHE_SIZE)


def _cache_key(query: str, doc: str) -> str:
    h = hashlib.sha256()
    h.update(query.encode("utf-8"))
    h.update(b"\n")
    h.update(doc.encode("utf-8"))
    return h.hexdigest()


def _build_doc_text(opp: ScoredOpportunity) -> str:
    parts = [
        f"Title: {opp.title}",
        f"Category: {opp.category}",
    ]
    if opp.domain_tags:
        parts.append(f"Domains: {', '.join(opp.domain_tags)}")
    if opp.description:
        parts.append(f"Description: {opp.description}")
    if opp.eligibility:
        parts.append(f"Eligibility: {opp.eligibility}")
    if opp.benefits:
        parts.append(f"Benefits: {opp.benefits}")
    if opp.deadline:
        parts.append(f"Deadline: {opp.deadline.isoformat()}")
    if opp.application_link:
        parts.append(f"URL: {opp.application_link}")
    return "\n".join(parts)


@lru_cache(maxsize=1)
def _load_cross_encoder():
    try:
        from sentence_transformers import CrossEncoder
    except Exception as e:
        logger.warning(f"CrossEncoder not available: {e}")
        return None

    try:
        model = CrossEncoder(settings.rerank_model)
        logger.info(f"Loaded cross-encoder model: {settings.rerank_model}")
        return model
    except Exception as e:
        logger.error(f"Failed to load cross-encoder model '{settings.rerank_model}': {e}")
        return None


def warmup():
    """Pre-load the cross-encoder model so first request isn't slow."""
    if settings.rerank_enabled:
        _load_cross_encoder()


def rerank_with_cross_encoder(
    query: str,
    candidates: List[ScoredOpportunity],
    top_k: int | None = None,
) -> List[ScoredOpportunity]:
    """Rerank candidates using a cross-encoder. Returns reordered list.

    If dependencies or model are unavailable, returns candidates unchanged.
    """
    if not settings.rerank_enabled:
        return candidates

    if not query or not candidates:
        return candidates

    model = _load_cross_encoder()
    if model is None:
        return candidates

    k = top_k or settings.rerank_top_k
    subset = candidates[:k]
    pairs: list[tuple[str, str]] = []
    cache_keys: list[str] = []
    cached_scores: list[float | None] = []
    for o in subset:
        doc = _build_doc_text(o)
        key = _cache_key(query, doc)
        cache_keys.append(key)
        cached = _score_cache.get(key)
        cached_scores.append(cached)
        pairs.append((query, doc))

    try:
        scores: list[float | None] = [None] * len(pairs)
        to_score = []
        to_score_idx = []
        for idx, cached in enumerate(cached_scores):
            if cached is None:
                to_score.append(pairs[idx])
                to_score_idx.append(idx)
            else:
                scores[idx] = cached

        if to_score:
            new_scores = model.predict(to_score, batch_size=settings.rerank_batch_size)
            for offset, idx in enumerate(to_score_idx):
                score = float(new_scores[offset])
                _score_cache.set(cache_keys[idx], score)
                scores[idx] = score

        # If nothing was scored, return as-is
        if not any(s is not None for s in scores):
            return candidates
    except Exception as e:
        logger.error(f"Cross-encoder rerank failed: {e}")
        return candidates

    scored = [(o, float(s)) for o, s in zip(subset, scores) if s is not None]
    if not scored:
        return candidates
    scored.sort(key=lambda x: x[1], reverse=True)

    reranked = [o for o, _ in scored]
    # Append remainder in original order
    if len(candidates) > k:
        reranked.extend(candidates[k:])
    return reranked
