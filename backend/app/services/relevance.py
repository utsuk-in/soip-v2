"""
Profile-aware re-ranking — deterministic, zero-LLM-cost scoring
that boosts results matching the user's skills, interests, and aspirations.
"""

from datetime import date

from app.models.user import User
from app.services.retriever import ScoredOpportunity
from app.utils.enums import OpportunityCategory

# Weights for the final relevance score
W_HYBRID = 0.35
W_TAG_OVERLAP = 0.30
W_CATEGORY = 0.20
W_STATE = 0.10
W_URGENCY = 0.05

_URGENCY_WINDOW_DAYS = 14


def rerank_for_user(
    user: User,
    candidates: list[ScoredOpportunity],
) -> list[ScoredOpportunity]:
    """Re-score candidates against the user's profile and sort by relevance."""
    if not candidates:
        return candidates

    user_tags = set(_lower_list(user.interests) + _lower_list(user.skills))
    user_categories = _extract_user_categories(user)
    user_state = (user.state or "").strip().lower()

    for opp in candidates:
        opp_tags = set(t.lower() for t in (opp.domain_tags or []))

        tag_overlap = len(opp_tags & user_tags) if user_tags else 0
        tag_score = tag_overlap / max(len(opp_tags), 1)

        cat_lower = (opp.category or "").lower()
        category_match = 1.0 if cat_lower in user_categories else 0.0

        urgency = _deadline_urgency(opp.deadline)

        state_score = _state_proximity(user_state, opp)

        opp.relevance_score = (
            W_HYBRID * opp.hybrid_score
            + W_TAG_OVERLAP * tag_score
            + W_CATEGORY * category_match
            + W_STATE * state_score
            + W_URGENCY * urgency
        )

    return sorted(candidates, key=lambda o: o.relevance_score, reverse=True)


def _state_proximity(user_state: str, opp: ScoredOpportunity) -> float:
    """0.0 → 1.0 state proximity; 1.0 = same state, 0.3 = online (no state), 0.0 = different state."""
    if not user_state:
        return 0.0
    opp_state = getattr(opp, "state", None)
    opp_state = (opp_state or "").strip().lower()
    if opp_state and opp_state == user_state:
        return 1.0
    if not opp_state:
        # Online opportunities — don't penalize for being location-free
        return 0.3
    return 0.0


def _deadline_urgency(deadline: date | None) -> float:
    """0.0 → 1.0 urgency score; 1.0 = deadline is today, 0.0 = no deadline or > 14 days."""
    if not deadline:
        return 0.0
    days_left = (deadline - date.today()).days
    if days_left < 0:
        return 0.0
    return max(0.0, (_URGENCY_WINDOW_DAYS - days_left) / _URGENCY_WINDOW_DAYS)


def _lower_list(items: list | None) -> list[str]:
    return [s.lower() for s in (items or [])]


def _extract_user_categories(user: User) -> set[str]:
    alias_map = {
        "hackathons": "hackathon",
        "internships": "internship",
        "grants": "grant",
        "fellowships": "fellowship",
        "competitions": "competition",
        "scholarships": "scholarship",
    }
    raw_terms = _lower_list(user.aspirations) + _lower_list(user.interests) + _lower_list(user.skills)
    categories: set[str] = set()
    for term in raw_terms:
        key = alias_map.get(term, term)
        try:
            categories.add(OpportunityCategory(key).value)
            continue
        except ValueError:
            pass
        try:
            categories.add(OpportunityCategory[key.upper()].value)
        except KeyError:
            continue
    return categories
