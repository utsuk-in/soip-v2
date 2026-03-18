"""Engagement report service — university-scoped analytics."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.models.interaction_log import InteractionLog
from app.models.magic_link import MagicLinkToken
from app.models.opportunity import Opportunity
from app.models.user import User
from app.schemas.admin import (
    CategoryBreakdown,
    EngagementBucket,
    EngagementReport,
    FeedbackSummary,
    MagicLinkStats,
    TopOpportunity,
    WeeklyTrend,
)


def _get_student_ids(db: Session, university_id: UUID) -> list[UUID]:
    rows = (
        db.query(User.id)
        .filter(User.university_id == university_id, User.role == "student")
        .all()
    )
    return [r.id for r in rows]


def get_engagement_report(db: Session, university_id: UUID, weeks: int = 8) -> EngagementReport:
    student_ids = _get_student_ids(db, university_id)

    if not student_ids:
        return EngagementReport(
            top_opportunities=[],
            category_breakdown=[],
            engagement_distribution=[
                EngagementBucket(bucket="0", count=0),
                EngagementBucket(bucket="1-5", count=0),
                EngagementBucket(bucket="5+", count=0),
            ],
            weekly_trends=[],
            magic_link_stats=MagicLinkStats(total_sent=0, total_used=0, open_rate=0.0),
            feedback_summary=FeedbackSummary(thumbs_up=0, thumbs_down=0, positive_rate=0.0),
        )

    # Top viewed opportunities
    top_opps_rows = (
        db.query(
            InteractionLog.opportunity_id,
            func.count(InteractionLog.id).label("cnt"),
        )
        .filter(
            InteractionLog.user_id.in_(student_ids),
            InteractionLog.action == "view",
            InteractionLog.opportunity_id.isnot(None),
        )
        .group_by(InteractionLog.opportunity_id)
        .order_by(func.count(InteractionLog.id).desc())
        .limit(10)
        .all()
    )
    top_opportunities = []
    for row in top_opps_rows:
        opp = db.query(Opportunity.title).filter(Opportunity.id == row.opportunity_id).first()
        top_opportunities.append(TopOpportunity(
            opportunity_id=row.opportunity_id,
            title=opp.title if opp else "Unknown",
            view_count=row.cnt,
        ))

    # Category breakdown
    cat_rows = (
        db.query(
            InteractionLog.category,
            func.count(InteractionLog.id).label("cnt"),
        )
        .filter(
            InteractionLog.user_id.in_(student_ids),
            InteractionLog.action == "view",
            InteractionLog.category.isnot(None),
        )
        .group_by(InteractionLog.category)
        .order_by(func.count(InteractionLog.id).desc())
        .all()
    )
    category_breakdown = [CategoryBreakdown(category=r.category, count=r.cnt) for r in cat_rows]

    # Engagement distribution
    interaction_counts = (
        db.query(
            InteractionLog.user_id,
            func.count(InteractionLog.id).label("cnt"),
        )
        .filter(InteractionLog.user_id.in_(student_ids))
        .group_by(InteractionLog.user_id)
        .all()
    )
    counts_map = {r.user_id: r.cnt for r in interaction_counts}
    bucket_0 = sum(1 for sid in student_ids if counts_map.get(sid, 0) == 0)
    bucket_1_5 = sum(1 for sid in student_ids if 1 <= counts_map.get(sid, 0) <= 5)
    bucket_5p = sum(1 for sid in student_ids if counts_map.get(sid, 0) > 5)
    engagement_distribution = [
        EngagementBucket(bucket="0", count=bucket_0),
        EngagementBucket(bucket="1-5", count=bucket_1_5),
        EngagementBucket(bucket="5+", count=bucket_5p),
    ]

    # Weekly trends
    cutoff = datetime.now(timezone.utc) - timedelta(weeks=weeks)
    weekly_rows = (
        db.query(
            func.date_trunc("week", InteractionLog.created_at).label("week"),
            func.count(InteractionLog.id).label("cnt"),
        )
        .filter(
            InteractionLog.user_id.in_(student_ids),
            InteractionLog.created_at >= cutoff,
        )
        .group_by(func.date_trunc("week", InteractionLog.created_at))
        .order_by(func.date_trunc("week", InteractionLog.created_at))
        .all()
    )
    weekly_trends = [
        WeeklyTrend(week=r.week.strftime("%Y-%m-%d"), interactions=r.cnt)
        for r in weekly_rows
    ]

    # Feedback summary (thumbs up/down on recommendations)
    thumbs_up = (
        db.query(func.count(InteractionLog.id))
        .filter(
            InteractionLog.user_id.in_(student_ids),
            InteractionLog.action == "thumbs_up",
        )
        .scalar() or 0
    )
    thumbs_down = (
        db.query(func.count(InteractionLog.id))
        .filter(
            InteractionLog.user_id.in_(student_ids),
            InteractionLog.action == "thumbs_down",
        )
        .scalar() or 0
    )
    total_feedback = thumbs_up + thumbs_down
    positive_rate = round(thumbs_up / total_feedback * 100, 1) if total_feedback > 0 else 0.0

    # Magic link stats
    total_sent = (
        db.query(func.count(MagicLinkToken.id))
        .join(User, MagicLinkToken.user_id == User.id)
        .filter(User.university_id == university_id)
        .scalar() or 0
    )
    total_used = (
        db.query(func.count(MagicLinkToken.id))
        .join(User, MagicLinkToken.user_id == User.id)
        .filter(User.university_id == university_id, MagicLinkToken.used_at.isnot(None))
        .scalar() or 0
    )
    open_rate = (total_used / total_sent * 100) if total_sent > 0 else 0.0

    return EngagementReport(
        top_opportunities=top_opportunities,
        category_breakdown=category_breakdown,
        engagement_distribution=engagement_distribution,
        weekly_trends=weekly_trends,
        magic_link_stats=MagicLinkStats(
            total_sent=total_sent,
            total_used=total_used,
            open_rate=round(open_rate, 1),
        ),
        feedback_summary=FeedbackSummary(
            thumbs_up=thumbs_up,
            thumbs_down=thumbs_down,
            positive_rate=positive_rate,
        ),
    )
