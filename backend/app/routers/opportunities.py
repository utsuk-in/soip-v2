from datetime import date
import asyncio
import math
import logging
import time
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import or_, func, select, over, literal_column

from app.database import get_db
from app.models.opportunity import Opportunity
from app.utils.enums import OpportunityCategory, OpportunityMode
from app.models.user import User
from app.schemas.opportunity import OpportunityBrief, OpportunityOut, OpportunityListResponse
from app.services.embedder import embed_query
from app.services.relevance import rerank_for_user
from app.services.reranker import rerank_with_cross_encoder
from app.services.taxonomy import normalize_domains
from app.services.retriever import ScoredOpportunity, recommend_retrieve
from app.services.relevance_explainer import (
    ExplanationOpportunity,
    generate_relevance_explanations,
)
from app.config import settings
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api/opportunities", tags=["opportunities"])
logger = logging.getLogger(__name__)

# Per-user response cache: {user_id: (timestamp, limit, response_list)}
_recommended_cache: dict[UUID, tuple[float, int, list]] = {}
_RECOMMENDED_TTL = 300  # 5 minutes


def invalidate_recommended_cache(user_id: UUID) -> None:
    """Clear the recommended-opportunities cache for a specific user."""
    _recommended_cache.pop(user_id, None)

_optional_bearer = HTTPBearer(auto_error=False)


def _optional_current_user(
    credentials=Depends(_optional_bearer),
    db: Session = Depends(get_db),
):
    """Extract current user from token if present, otherwise return None."""
    if credentials is None:
        return None
    from jose import JWTError, jwt as jose_jwt
    from app.config import settings as _settings
    try:
        payload = jose_jwt.decode(
            credentials.credentials, _settings.jwt_secret, algorithms=[_settings.jwt_algorithm]
        )
        user_id_raw = payload.get("sub")
        if not user_id_raw:
            return None
        user = db.query(User).filter(User.id == UUID(user_id_raw)).first()
        return user if user and user.is_active else None
    except (JWTError, ValueError):
        return None


@router.get("", response_model=OpportunityListResponse)
def browse_opportunities(
    category: str | None = None,
    domain: str | None = None,
    location: str | None = None,
    mode: str | None = None,
    state: str | None = None,
    search: str | None = None,
    deadline_before: date | None = None,
    deadline_after: date | None = None,
    active_only: bool = True,
    sort: str = Query(default="newest", pattern="^(newest|deadline|relevance)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Opportunity)

    if active_only:
        query = query.filter(Opportunity.is_active.is_(True))
        query = query.filter(
            (Opportunity.deadline.is_(None)) | (Opportunity.deadline >= date.today())
        )

    if category:
        normalized = _normalize_categories(_split_list_param(category))
        if normalized:
            query = query.filter(Opportunity.category.in_([c for c in normalized]))

    if domain:
        domains = normalize_domains(_split_list_param(domain))
        if domains:
            conditions = []
            for d in domains:
                tag = func.jsonb_array_elements_text(
                    Opportunity.domain_tags.cast(JSONB)
                ).table_valued("value").alias("tag")
                conditions.append(
                    select(1)
                    .select_from(tag)
                    .where(func.lower(tag.c.value) == d.lower())
                    .exists()
                )
            query = query.filter(or_(*conditions))

    if location:
        locations = _split_list_param(location)
        if locations:
            loc_conditions = []
            for loc in locations:
                loc = loc.strip().lower()
                if not loc:
                    continue
                loc_conditions.append(func.lower(Opportunity.location).ilike(f"%{loc}%"))
                loc_conditions.append(func.lower(Opportunity.state).ilike(f"%{loc}%"))
            if loc_conditions:
                query = query.filter(or_(*loc_conditions))

    if mode:
        modes = _split_list_param(mode)
        valid_modes = []
        for m in modes:
            m = m.strip().lower()
            try:
                valid_modes.append(OpportunityMode(m))
            except ValueError:
                continue
        if valid_modes:
            query = query.filter(Opportunity.mode.in_(valid_modes))

    if state:
        states = _split_list_param(state)
        if states:
            geo_terms = _geo_state_search_terms(states)
            geo_conditions = []
            for term in geo_terms:
                pattern = f"%{term}%"
                geo_conditions.append(func.lower(Opportunity.state).ilike(pattern))
                geo_conditions.append(func.lower(Opportunity.location).ilike(pattern))
            query = query.filter(or_(*geo_conditions))

    if deadline_before:
        query = query.filter(
            (Opportunity.deadline.is_(None)) | (Opportunity.deadline <= deadline_before)
        )

    if deadline_after:
        query = query.filter(
            (Opportunity.deadline.is_(None)) | (Opportunity.deadline >= deadline_after)
        )

    if search:
        like_pattern = f"%{search}%"
        query = query.filter(
            Opportunity.title.ilike(like_pattern)
            | Opportunity.description.ilike(like_pattern)
        )

    if sort == "deadline":
        query = query.order_by(Opportunity.deadline.asc().nullslast())
    elif sort == "newest":
        query = query.order_by(Opportunity.created_at.desc())
    else:
        query = query.order_by(Opportunity.created_at.desc())

    offset = (page - 1) * page_size

    # Single query: fetch items + total count via window function (one DB round trip)
    count_col = func.count(Opportunity.id).over().label("_total")
    rows = query.add_columns(count_col).offset(offset).limit(page_size).all()

    if rows:
        items = [row[0] for row in rows]
        total = rows[0][1]
    else:
        items = []
        total = 0

    # Truncate heavy text fields for list views — full text is served by the detail endpoint
    _truncate_for_listing(items)

    total_pages = math.ceil(total / page_size) if page_size else 1
    return OpportunityListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )


@router.get("/recommended", response_model=list[OpportunityOut])
async def recommended_opportunities(
    limit: int = Query(default=12, ge=1, le=50),
    explain: bool = Query(default=False, description="Generate LLM explanations (slower)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Personalized top-N based on user profile + relevance scoring."""
    t0 = time.monotonic()

    # Check per-user response cache
    cached = _recommended_cache.get(current_user.id)
    if cached and (time.monotonic() - cached[0]) < _RECOMMENDED_TTL and cached[1] >= limit:
        logger.info("Recommended: cache hit for user %s (%.0fms)", current_user.id, (time.monotonic() - t0) * 1000)
        return cached[2][:limit]

    profile_text = _build_profile_query(current_user)
    domains = normalize_domains((current_user.interests or []) + (current_user.skills or []))
    categories = _extract_profile_categories(current_user)

    # Retrieve pool only needs to be ~2x the final limit
    retrieve_pool = min(limit * 2, 30)

    candidates: list[ScoredOpportunity] = []
    if profile_text:
        logger.info("Recommended: user=%s profile_query=%s", current_user.id, profile_text[:80])

        query_embedding = await embed_query(profile_text)
        t_embed = time.monotonic()
        logger.info("Recommended: embed done (%.0fms)", (t_embed - t0) * 1000)

        candidates = await asyncio.to_thread(
            lambda: recommend_retrieve(
                db, query_embedding,
                search_text=profile_text,
                categories=categories or None,
                domains=domains or None,
                limit=retrieve_pool,
            )
        )
        t_retrieve = time.monotonic()
        logger.info("Recommended: retrieve done (%d candidates, %.0fms)", len(candidates), (t_retrieve - t_embed) * 1000)

        if settings.rerank_enabled:
            candidates = await asyncio.to_thread(rerank_with_cross_encoder, profile_text, candidates)
            t_rerank = time.monotonic()
            logger.info("Recommended: cross-encoder done (%.0fms)", (t_rerank - t_retrieve) * 1000)

        candidates = rerank_for_user(current_user, candidates)

    top_ids = [o.id for o in candidates if o.application_link][:limit]
    existing_ids = set(top_ids)

    if len(top_ids) < limit and (domains or categories):
        fallback_query = db.query(Opportunity).filter(Opportunity.is_active.is_(True))
        if categories:
            fallback_query = fallback_query.filter(Opportunity.category.in_(categories))
        if domains:
            conditions = []
            for d in domains:
                tag = func.jsonb_array_elements_text(
                    Opportunity.domain_tags.cast(JSONB)
                ).table_valued("value").alias("tag")
                conditions.append(
                    select(1)
                    .select_from(tag)
                    .where(func.lower(tag.c.value) == d.lower())
                    .exists()
                )
            fallback_query = fallback_query.filter(or_(*conditions))
        fallback_items = (
            fallback_query.order_by(Opportunity.created_at.desc())
            .limit(limit * 2)
            .all()
        )
        for opp in fallback_items:
            if opp.id not in existing_ids:
                top_ids.append(opp.id)
                existing_ids.add(opp.id)
            if len(top_ids) >= limit:
                break

    if not top_ids:
        return (
            db.query(Opportunity)
            .filter(Opportunity.is_active.is_(True))
            .order_by(Opportunity.created_at.desc())
            .limit(limit)
            .all()
        )

    explanation_candidates = [c for c in candidates if c.id in existing_ids][:limit]

    opps = await asyncio.to_thread(
        lambda: db.query(Opportunity).filter(Opportunity.id.in_(top_ids)).all()
    )
    t_load = time.monotonic()
    logger.info("Recommended: DB load done (%.0fms)", (t_load - t0) * 1000)

    if explain:
        explanation_input = [
            ExplanationOpportunity(
                id=str(o.id),
                title=o.title,
                category=o.category if isinstance(o.category, str) else str(o.category),
                domain_tags=o.domain_tags,
                description=o.description,
                deadline=o.deadline.isoformat() if o.deadline else None,
                location=None,
            )
            for o in explanation_candidates
        ]
        explanations = await generate_relevance_explanations(
            user=current_user,
            query_text=profile_text,
            opportunities=explanation_input,
        )
    else:
        explanations = _deterministic_explanations(current_user, explanation_candidates)

    id_order = {uid: i for i, uid in enumerate(top_ids)}
    sorted_opps = sorted(opps, key=lambda o: id_order.get(o.id, 999))

    if explanations:
        for opp in sorted_opps:
            text = explanations.get(str(opp.id))
            if text:
                setattr(opp, "relevance_explanation", text)

    _recommended_cache[current_user.id] = (time.monotonic(), limit, sorted_opps)
    logger.info("Recommended: total %.0fms, returned %d opps", (time.monotonic() - t0) * 1000, len(sorted_opps))

    return sorted_opps


def _deterministic_explanations(
    user: User,
    candidates: list[ScoredOpportunity],
) -> dict[str, str]:
    """Instant, zero-cost explanations from profile/tag overlap."""
    user_tags = set(
        t.lower() for t in (user.interests or [])
    ) | set(
        t.lower() for t in (user.skills or [])
    )
    result: dict[str, str] = {}
    for opp in candidates:
        opp_tags = set(t.lower() for t in (opp.domain_tags or []))
        overlap = user_tags & opp_tags
        cat = opp.category
        if hasattr(cat, "value"):
            cat = cat.value
        parts: list[str] = []
        if overlap:
            parts.append(f"This {cat or 'opportunity'} aligns with your interest in {', '.join(sorted(overlap))}.")
        elif cat:
            parts.append(f"This {cat} may match your profile.")
        if parts:
            result[str(opp.id)] = " ".join(parts)
    return result


@router.get("/stats")
def opportunity_stats(
    db: Session = Depends(get_db),
):
    """Return count of active opportunities per category."""
    rows = (
        db.query(Opportunity.category, func.count(Opportunity.id))
        .filter(Opportunity.is_active.is_(True))
        .group_by(Opportunity.category)
        .all()
    )
    return {
        row[0].value if hasattr(row[0], "value") else str(row[0]): row[1]
        for row in rows
    }


@router.get("/stats/by-state")
def opportunity_stats_by_state(
    mode: str | None = Query(default="offline"),
    category: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """Lightweight state-level counts for the HackMap. Returns {state_name: count}."""
    q = db.query(Opportunity.state, Opportunity.location).filter(
        Opportunity.is_active.is_(True),
        (Opportunity.deadline.is_(None)) | (Opportunity.deadline >= date.today()),
    )
    if mode:
        try:
            q = q.filter(Opportunity.mode == OpportunityMode(mode.strip().lower()))
        except ValueError:
            pass
    if category:
        normalized = _normalize_categories(_split_list_param(category))
        if normalized:
            q = q.filter(Opportunity.category.in_(normalized))

    rows = q.all()

    counts: dict[str, int] = {}
    for state_val, location_val in rows:
        geo = _match_to_geo_state(state_val or location_val or "")
        if geo:
            counts[geo] = counts.get(geo, 0) + 1
    return counts


_CITY_STATE_MAP: dict[str, str] = {
    "bangalore": "Karnataka", "bengaluru": "Karnataka",
    "mumbai": "Maharashtra", "pune": "Maharashtra", "nagpur": "Maharashtra",
    "delhi": "NCT of Delhi", "new delhi": "NCT of Delhi",
    "noida": "Uttar Pradesh", "lucknow": "Uttar Pradesh",
    "gurgaon": "Haryana", "gurugram": "Haryana",
    "hyderabad": "Telangana",
    "chennai": "Tamil Nadu", "coimbatore": "Tamil Nadu",
    "kolkata": "West Bengal",
    "ahmedabad": "Gujarat", "surat": "Gujarat",
    "jaipur": "Rajasthan",
    "chandigarh": "Chandigarh",
    "bhopal": "Madhya Pradesh", "indore": "Madhya Pradesh",
    "thiruvananthapuram": "Kerala", "kochi": "Kerala",
    "bhubaneswar": "Odisha",
    "patna": "Bihar",
    "ranchi": "Jharkhand",
    "guwahati": "Assam",
    "visakhapatnam": "Andhra Pradesh", "vijayawada": "Andhra Pradesh",
    "dehradun": "Uttarakhand",
    "shimla": "Himachal Pradesh",
    "gangtok": "Sikkim",
    "panaji": "Goa",
    "raipur": "Chhattisgarh",
}

_KNOWN_STATES: set[str] = {
    "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh",
    "goa", "gujarat", "haryana", "himachal pradesh", "jharkhand", "karnataka",
    "kerala", "madhya pradesh", "maharashtra", "manipur", "meghalaya",
    "mizoram", "nagaland", "odisha", "punjab", "rajasthan", "sikkim",
    "tamil nadu", "telangana", "tripura", "uttar pradesh", "uttarakhand",
    "west bengal", "delhi", "nct of delhi", "jammu & kashmir", "ladakh",
    "chandigarh", "puducherry",
}

_STATE_NAME_NORMALIZE: dict[str, str] = {
    "delhi": "NCT of Delhi",
    "jammu and kashmir": "Jammu & Kashmir",
}


# Reverse lookup: geo state name → all search terms (state + city names)
_GEO_STATE_TERMS: dict[str, list[str]] = {}
for _city, _st in _CITY_STATE_MAP.items():
    _GEO_STATE_TERMS.setdefault(_st, []).append(_city)
for _s in _KNOWN_STATES:
    _canonical = _STATE_NAME_NORMALIZE.get(_s, _s.title())
    _GEO_STATE_TERMS.setdefault(_canonical, []).append(_s)


def _geo_state_search_terms(state_names: list[str]) -> list[str]:
    """Return all search terms (state names + city names) for geo-state matching."""
    terms: list[str] = []
    for name in state_names:
        terms.append(name.lower())
        for term in _GEO_STATE_TERMS.get(name, []):
            if term.lower() not in terms:
                terms.append(term.lower())
    return terms


def _match_to_geo_state(location: str) -> str | None:
    if not location:
        return None
    loc = location.lower().strip()
    # Direct state match
    for state in _KNOWN_STATES:
        if loc == state or state in loc:
            canonical = _STATE_NAME_NORMALIZE.get(state, state.title())
            return canonical
    # City lookup
    for city, state in _CITY_STATE_MAP.items():
        if city in loc:
            return state
    return None


@router.get("/search", response_model=list[OpportunityBrief])
def search_opportunities(
    q: str = Query(..., min_length=1, description="Search query string"),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Direct keyword search across opportunity fields using ILIKE for partial matching."""
    from sqlalchemy import String, cast as sa_cast

    words = [w.strip() for w in q.split() if len(w.strip()) >= 2]
    if not words:
        return []

    query = db.query(Opportunity).filter(
        Opportunity.is_active.is_(True),
        (Opportunity.deadline.is_(None)) | (Opportunity.deadline >= date.today()),
    )

    word_conditions = []
    for word in words:
        pattern = f"%{word}%"
        word_conditions.append(
            or_(
                Opportunity.title.ilike(pattern),
                Opportunity.description.ilike(pattern),
                Opportunity.eligibility.ilike(pattern),
                Opportunity.benefits.ilike(pattern),
                sa_cast(Opportunity.domain_tags, String).ilike(pattern),
                Opportunity.organizer.ilike(pattern),
            )
        )
    query = query.filter(or_(*word_conditions))

    results = query.order_by(Opportunity.created_at.desc()).limit(limit).all()
    return results


@router.get("/{opportunity_id}", response_model=OpportunityOut)
def get_opportunity(
    opportunity_id: UUID,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(_optional_current_user),
):
    opp = db.query(Opportunity).filter(Opportunity.id == opportunity_id).first()
    if not opp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opportunity not found",
        )
    if current_user:
        from app.models.interaction_log import InteractionLog
        log = InteractionLog(
            user_id=current_user.id,
            opportunity_id=opp.id,
            action="view",
            category=opp.category.value if opp.category else None,
        )
        db.add(log)
        db.commit()
    return opp


_LISTING_MAX_DESC = 400
_LISTING_MAX_TEXT = 250


def _truncate_for_listing(items: list[Opportunity]) -> None:
    """Trim heavy text columns in-place for list/card views.

    Full content is still available via GET /api/opportunities/{id}.
    """
    for opp in items:
        if opp.description and len(opp.description) > _LISTING_MAX_DESC:
            opp.__dict__["description"] = opp.description[:_LISTING_MAX_DESC] + "…"
        if opp.eligibility and len(opp.eligibility) > _LISTING_MAX_TEXT:
            opp.__dict__["eligibility"] = opp.eligibility[:_LISTING_MAX_TEXT] + "…"
        if opp.benefits and len(opp.benefits) > _LISTING_MAX_TEXT:
            opp.__dict__["benefits"] = opp.benefits[:_LISTING_MAX_TEXT] + "…"


def _build_profile_query(user: User) -> str:
    """Build a natural-language profile query that embeds close to opportunity descriptions."""
    aspirations = [s for s in (user.aspirations or []) if str(s).strip()]
    interests = [s for s in (user.interests or []) if str(s).strip()]
    skills = [s for s in (user.skills or []) if str(s).strip()]
    academic = user.academic_background.strip() if user.academic_background else ""

    parts: list[str] = []
    if aspirations:
        parts.append(f"{', '.join(aspirations)} opportunities")
    if interests:
        parts.append(f"in {', '.join(interests)}")
    if skills:
        parts.append(f"for someone skilled in {', '.join(skills)}")
    if academic:
        parts.append(f"studying {academic}")

    return " ".join(parts).strip()


def _extract_profile_categories(user: User) -> list[OpportunityCategory]:
    """Infer category filters from profile fields (interests/skills/aspirations)."""
    raw_terms = []
    if user.interests:
        raw_terms.extend(user.interests)
    if user.skills:
        raw_terms.extend(user.skills)
    if user.aspirations:
        raw_terms.extend(user.aspirations)
    normalized = _normalize_categories([str(t).strip().lower() for t in raw_terms if t])
    # Deduplicate while preserving order
    seen = set()
    out: list[OpportunityCategory] = []
    for cat in normalized:
        if cat not in seen:
            seen.add(cat)
            out.append(cat)
    return out


def _normalize_domains(raw: list[str]) -> list[str]:
    # Backward-compatible alias
    return normalize_domains(raw)


def _split_list_param(value: str) -> list[str]:
    if not value:
        return []
    parts = [v.strip() for v in value.split(",")]
    return [p for p in parts if p]


def _normalize_categories(raw: list[str]) -> list[OpportunityCategory]:
    alias_map = {
        "hackathons": "hackathon",
        "internships": "internship",
        "grants": "grant",
        "fellowships": "fellowship",
        "competitions": "competition",
        "scholarships": "scholarship",
    }
    normalized: list[OpportunityCategory] = []
    for item in raw:
        if not item:
            continue
        key = str(item).strip().lower()
        key = alias_map.get(key, key)
        try:
            normalized.append(OpportunityCategory(key))
            continue
        except ValueError:
            pass
        try:
            normalized.append(OpportunityCategory[key.upper()])
        except KeyError:
            continue
    return normalized
