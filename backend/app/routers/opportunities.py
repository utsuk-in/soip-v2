from datetime import date
import math
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import or_, func, select

from app.database import get_db
from app.models.opportunity import Opportunity, OpportunityCategory
from app.models.user import User
from app.schemas.opportunity import OpportunityBrief, OpportunityOut, OpportunityListResponse
from app.services.embedder import embed_query
from app.services.relevance import rerank_for_user
from app.services.reranker import rerank_with_cross_encoder
from app.services.taxonomy import normalize_domains
from app.services.retriever import ScoredOpportunity, hybrid_retrieve
from app.services.query_parser import ParsedQuery
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api/opportunities", tags=["opportunities"])


@router.get("", response_model=OpportunityListResponse)
def browse_opportunities(
    category: str | None = None,
    domain: str | None = None,
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
        normalized = _normalize_categories([category])
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
    if not profile_text:
        return (
            db.query(Opportunity)
            .filter(Opportunity.is_active.is_(True))
            .order_by(Opportunity.created_at.desc())
            .limit(limit)
            .all()
        )

    query_embedding = await embed_query(profile_text)

    parsed = ParsedQuery(intent="explore", search_text=profile_text)
    parsed.domains = normalize_domains((current_user.interests or []) + (current_user.skills or []))
    candidates = await hybrid_retrieve(db, parsed, query_embedding, limit=30)

    candidates = rerank_with_cross_encoder(profile_text, candidates)
    ranked = rerank_for_user(current_user, candidates)
    top_ids = [o.id for o in ranked if o.url][:limit]

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
    return sorted(opps, key=lambda o: id_order.get(o.id, 999))


@router.get("/{opportunity_id}", response_model=OpportunityOut)
def get_opportunity(
    opportunity_id: UUID,
    db: Session = Depends(get_db),
):
    opp = db.query(Opportunity).filter(Opportunity.id == opportunity_id).first()
    if not opp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opportunity not found",
        )
    return opp


def _build_profile_query(user: User) -> str:
    """Build a natural-language query from the user's profile for recommendation."""
    parts: list[str] = []
    if user.interests:
        parts.append(f"interested in {', '.join(user.interests)}")
    if user.skills:
        parts.append(f"skilled in {', '.join(user.skills)}")
    if user.aspirations:
        parts.append(f"looking for {', '.join(user.aspirations)}")
    if user.degree_type:
        parts.append(f"{user.degree_type} student")
    return " ".join(parts)


def _normalize_domains(raw: list[str]) -> list[str]:
    # Backward-compatible alias
    return normalize_domains(raw)


def _split_list_param(value: str) -> list[str]:
    if not value:
        return []
    parts = [v.strip() for v in value.split(",")]
    return [p for p in parts if p]


def _normalize_categories(raw: list[str]) -> list[OpportunityCategory]:
    normalized: list[OpportunityCategory] = []
    for item in raw:
        if not item:
            continue
        try:
            normalized.append(OpportunityCategory(item))
            continue
        except ValueError:
            pass
        try:
            normalized.append(OpportunityCategory[item.upper()])
        except KeyError:
            continue
    return normalized
