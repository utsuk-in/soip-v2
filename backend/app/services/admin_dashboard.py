"""Admin dashboard service — university-scoped metrics and student management."""

from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.interaction_log import InteractionLog
from app.models.user import User
from app.schemas.admin import DashboardMetrics, StudentActivity, StudentListItem, StudentListResponse


def get_dashboard_metrics(db: Session, university_id: UUID) -> DashboardMetrics:
    base = db.query(User).filter(
        User.university_id == university_id,
        User.role == "student",
    )

    total_invited = base.count()
    total_activated = base.filter(User.is_onboarded).count()
    activation_rate = (total_activated / total_invited * 100) if total_invited > 0 else 0.0

    student_ids = [r.id for r in base.with_entities(User.id).all()]

    total_views = 0
    total_applications = 0
    if student_ids:
        total_views = (
            db.query(func.count(InteractionLog.id))
            .filter(InteractionLog.user_id.in_(student_ids), InteractionLog.action == "view")
            .scalar() or 0
        )
        total_applications = (
            db.query(func.count(InteractionLog.id))
            .filter(InteractionLog.user_id.in_(student_ids), InteractionLog.action == "apply")
            .scalar() or 0
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
) -> StudentListResponse:
    query = db.query(User).filter(
        User.university_id == university_id,
        User.role == "student",
    )

    if search:
        like = f"%{search}%"
        query = query.filter(
            User.first_name.ilike(like) | User.email.ilike(like)
        )

    if status_filter == "active":
        query = query.filter(User.is_onboarded)
    elif status_filter == "invited":
        query = query.filter(~User.is_onboarded)

    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(User.created_at.desc()).offset(offset).limit(page_size).all()

    return StudentListResponse(
        items=[StudentListItem.model_validate(u) for u in items],
        total=total,
        page=page,
        page_size=page_size,
    )


def get_student_activity(db: Session, student_id: UUID) -> StudentActivity:
    total_views = (
        db.query(func.count(InteractionLog.id))
        .filter(InteractionLog.user_id == student_id, InteractionLog.action == "view")
        .scalar() or 0
    )
    total_logins = (
        db.query(func.count(InteractionLog.id))
        .filter(InteractionLog.user_id == student_id, InteractionLog.action == "login")
        .scalar() or 0
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
            opp = db.query(Opportunity.title).filter(Opportunity.id == log.opportunity_id).first()
            if opp:
                entry["opportunity_title"] = opp.title
        recent_activity.append(entry)

    return StudentActivity(
        total_views=total_views,
        total_logins=total_logins,
        recent_activity=recent_activity,
    )
