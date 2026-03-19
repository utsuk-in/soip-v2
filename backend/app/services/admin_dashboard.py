"""Admin dashboard service — university-scoped metrics and student management."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.interaction_log import InteractionLog
from app.models.magic_link import MagicLinkToken
from app.models.user import User
from app.schemas.admin import (
    DashboardMetrics,
    StudentActivity,
    StudentListItem,
    StudentListResponse,
)


def get_dashboard_metrics(db: Session, university_id: UUID) -> DashboardMetrics:
    base = db.query(User).filter(
        User.university_id == university_id,
        User.role == "student",
    )

    total_invited = base.count()
    total_activated = base.filter(User.is_onboarded).count()
    activation_rate = (
        (total_activated / total_invited * 100) if total_invited > 0 else 0.0
    )

    student_ids = [r.id for r in base.with_entities(User.id).all()]

    total_views = 0
    total_applications = 0
    if student_ids:
        total_views = (
            db.query(func.count(InteractionLog.id))
            .filter(
                InteractionLog.user_id.in_(student_ids), InteractionLog.action == "view"
            )
            .scalar()
            or 0
        )
        total_applications = (
            db.query(func.count(InteractionLog.id))
            .filter(
                InteractionLog.user_id.in_(student_ids),
                InteractionLog.action == "apply",
            )
            .scalar()
            or 0
        )

    return DashboardMetrics(
        total_invited=total_invited,
        total_activated=total_activated,
        activation_rate=round(activation_rate, 1),
        total_views=total_views,
        total_applications=total_applications,
    )


def get_student_list(
    db: Session,
    university_id: UUID,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    status_filter: str | None = None,
    *,
    name: str | None = None,
    email: str | None = None,
    department: str | None = None,
    year_of_study: str | None = None,
) -> StudentListResponse:
    query = db.query(User).filter(
        User.university_id == university_id,
        User.role == "student",
    )

    # Global search (name + email combined)
    if search:
        like = f"%{search}%"
        query = query.filter(User.first_name.ilike(like) | User.email.ilike(like))

    # Per-column text filters
    TEXT_FILTERS = {"name": User.first_name, "email": User.email}
    col_params = {"name": name, "email": email}
    for param_key, col_attr in TEXT_FILTERS.items():
        val = col_params.get(param_key)
        if val:
            query = query.filter(col_attr.ilike(f"%{val}%"))

    # Per-column exact-match filters
    EXACT_FILTERS = {"department": User.department, "year_of_study": User.year_of_study}
    exact_params = {"department": department, "year_of_study": year_of_study}
    for param_key, col_attr in EXACT_FILTERS.items():
        val = exact_params.get(param_key)
        if val:
            query = query.filter(col_attr == val)

    # Status filter
    if status_filter == "active":
        query = query.filter(User.is_onboarded)
    elif status_filter == "invited":
        query = query.filter(~User.is_onboarded)

    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(User.created_at.desc()).offset(offset).limit(page_size).all()

    # Batch-fetch the most recent magic link token for each non-onboarded student
    now = datetime.now(timezone.utc)
    token_status_map: dict[UUID, str] = {}

    non_onboarded_ids = [u.id for u in items if not u.is_onboarded]
    if non_onboarded_ids:
        # Subquery: latest created_at per user_id
        latest_subq = (
            db.query(
                MagicLinkToken.user_id,
                func.max(MagicLinkToken.created_at).label("max_created_at"),
            )
            .filter(MagicLinkToken.user_id.in_(non_onboarded_ids))
            .group_by(MagicLinkToken.user_id)
            .subquery()
        )
        latest_tokens = (
            db.query(MagicLinkToken)
            .join(
                latest_subq,
                (MagicLinkToken.user_id == latest_subq.c.user_id)
                & (MagicLinkToken.created_at == latest_subq.c.max_created_at),
            )
            .all()
        )
        for token in latest_tokens:
            if token.used_at is not None:
                status = "used"
            elif token.expires_at.replace(tzinfo=timezone.utc) < now:
                status = "expired"
            else:
                status = "valid"
            token_status_map[token.user_id] = status

    list_items = []
    for u in items:
        item = StudentListItem.model_validate(u)
        if not u.is_onboarded:
            item.invite_token_status = token_status_map.get(u.id)
        list_items.append(item)

    return StudentListResponse(
        items=list_items,
        total=total,
        page=page,
        page_size=page_size,
    )


def get_student_activity(db: Session, student_id: UUID) -> StudentActivity:
    total_views = (
        db.query(func.count(InteractionLog.id))
        .filter(InteractionLog.user_id == student_id, InteractionLog.action == "view")
        .scalar()
        or 0
    )
    total_logins = (
        db.query(func.count(InteractionLog.id))
        .filter(InteractionLog.user_id == student_id, InteractionLog.action == "login")
        .scalar()
        or 0
    )

    recent = (
        db.query(InteractionLog)
        .filter(InteractionLog.user_id == student_id)
        .order_by(InteractionLog.created_at.desc())
        .limit(20)
        .all()
    )

    recent_activity = []
    for log in recent:
        entry = {
            "action": log.action,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        if log.opportunity_id:
            from app.models.opportunity import Opportunity

            opp = (
                db.query(Opportunity.title)
                .filter(Opportunity.id == log.opportunity_id)
                .first()
            )
            if opp:
                entry["opportunity_title"] = opp.title
        recent_activity.append(entry)

    return StudentActivity(
        total_views=total_views,
        total_logins=total_logins,
        recent_activity=recent_activity,
    )
