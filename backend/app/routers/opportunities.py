from datetime import date
import math
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import or_, func, select

from app.database import get_db
from app.models.opportunity import Opportunity
from app.utils.enums import OpportunityCategory
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
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api/opportunities", tags=["opportunities"])
logger = logging.getLogger(__name__)

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
            if loc_conditions:
                query = query.filter(or_(*loc_conditions))

    if mode:
        modes = _split_list_param(mode)
        if modes:
            mode_conditions = []
            for m in modes:
                m = m.strip().lower()
                if not m:
                    continue
                tag = func.jsonb_array_elements_text(
                    Opportunity.domain_tags.cast(JSONB)
                ).table_valued("value").alias("tag")
                mode_conditions.append(
                    select(1)
                    .select_from(tag)
                    .where(func.lower(tag.c.value) == m)
                    .exists()
                )
                mode_conditions.append(func.lower(Opportunity.location).ilike(f"%{m}%"))
                if m == "online":
                    mode_conditions.append(func.lower(Opportunity.location).ilike("%virtual%"))
                    mode_conditions.append(func.lower(Opportunity.location).ilike("%remote%"))
            if mode_conditions:
                query = query.filter(or_(*mode_conditions))

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

    total = query.order_by(None).count()
    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()
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
    limit: int = Query(default=10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Personalized top-N based on user profile + relevance scoring."""
    profile_text = _build_profile_query(current_user)
    domains = normalize_domains((current_user.interests or []) + (current_user.skills or []))
    categories = _extract_profile_categories(current_user)

    candidates: list[ScoredOpportunity] = []
    if profile_text:
        logger.info(
            "Recommended: profile_query=%s domains=%s categories=%s user_id=%s",
            profile_text,
            domains,
            [c.value for c in categories],
            getattr(current_user, "id", None),
        )
        query_embedding = await embed_query(profile_text)
        # Direct opportunity vector search (single HNSW query) + FTS fusion
        candidates = recommend_retrieve(
            db, query_embedding,
            search_text=profile_text,
            categories=categories or None,
            domains=domains or None,
            limit=50,
        )
        logger.info("Recommended: candidates_pre_rerank=%d", len(candidates))
        candidates = rerank_with_cross_encoder(profile_text, candidates)
        logger.info("Recommended: candidates_post_cross_encoder=%d", len(candidates))
        candidates = rerank_for_user(current_user, candidates)
        logger.info("Recommended: candidates_post_profile_rerank=%d", len(candidates))

    top_ids = [o.id for o in candidates if o.application_link][:limit]
    existing_ids = set(top_ids)

    # Fallback: if retrieval is sparse, fill from direct filtered query.
    if len(top_ids) < limit and (domains or categories):
        logger.info("Recommended: Fallback to direct db filter")
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

    opps = db.query(Opportunity).filter(Opportunity.id.in_(top_ids)).all()
    id_order = {uid: i for i, uid in enumerate(top_ids)}
    sorted_opps = sorted(opps, key=lambda o: id_order.get(o.id, 999))

    return sorted_opps


@router.get("/explanations")
async def get_explanations(
    opportunity_ids: str = Query(..., description="Comma-separated opportunity UUIDs"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate relevance explanations for a set of opportunities (non-blocking).

    Called by the frontend *after* cards are already rendered so the user
    doesn't wait for the LLM round-trip.
    """
    raw_ids = [s.strip() for s in opportunity_ids.split(",") if s.strip()]
    if not raw_ids:
        return {"explanations": {}}

    # Cap to 15 to stay within LLM token limits
    raw_ids = raw_ids[:15]

    try:
        uuids = [UUID(rid) for rid in raw_ids]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid opportunity ID format")

    opps = db.query(Opportunity).filter(Opportunity.id.in_(uuids)).all()
    if not opps:
        return {"explanations": {}}

    profile_text = _build_profile_query(current_user)
    explanations = await generate_relevance_explanations(
        user=current_user,
        query_text=profile_text,
        opportunities=[
            ExplanationOpportunity(
                id=str(o.id),
                title=o.title,
                category=o.category.value if hasattr(o.category, "value") else str(o.category),
                domain_tags=o.domain_tags,
                description=o.description,
                deadline=o.deadline.isoformat() if o.deadline else None,
                location=o.location,
            )
            for o in opps
        ],
    )
    return {"explanations": explanations}


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
