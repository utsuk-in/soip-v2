import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.interaction_log import InteractionLog
from app.models.opportunity import Opportunity
from app.models.user import User
from app.schemas.feedback import FeedbackCreate, FeedbackOut, FeedbackBatchOut
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api/feedback", tags=["feedback"])
logger = logging.getLogger(__name__)

FEEDBACK_ACTIONS = ("thumbs_up", "thumbs_down")


@router.post("", response_model=FeedbackOut)
def submit_feedback(
    body: FeedbackCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit or update feedback (thumbs up/down) for an opportunity."""
    # Verify opportunity exists
    opp = db.query(Opportunity).filter(Opportunity.id == body.opportunity_id).first()
    if not opp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opportunity not found",
        )

    # Check for existing feedback
    existing = (
        db.query(InteractionLog)
        .filter(
            InteractionLog.user_id == current_user.id,
            InteractionLog.opportunity_id == body.opportunity_id,
            InteractionLog.action.in_(FEEDBACK_ACTIONS),
        )
        .first()
    )

    if existing:
        existing.action = body.value
        existing.metadata_ = {"source": body.source}
        db.commit()
        db.refresh(existing)
        return FeedbackOut(
            id=existing.id,
            opportunity_id=existing.opportunity_id,
            value=existing.action,
            source=existing.metadata_.get("source", body.source),
            created_at=existing.created_at,
        )

    log = InteractionLog(
        user_id=current_user.id,
        opportunity_id=body.opportunity_id,
        action=body.value,
        category=opp.category.value
        if hasattr(opp.category, "value")
        else str(opp.category),
        metadata_={"source": body.source},
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return FeedbackOut(
        id=log.id,
        opportunity_id=log.opportunity_id,
        value=log.action,
        source=log.metadata_.get("source", body.source),
        created_at=log.created_at,
    )


@router.get("/batch", response_model=FeedbackBatchOut)
def batch_get_feedback(
    opportunity_ids: str = Query(..., description="Comma-separated opportunity UUIDs"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fetch the current user's feedback for a batch of opportunities."""
    try:
        ids = [UUID(uid.strip()) for uid in opportunity_ids.split(",") if uid.strip()]
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID in opportunity_ids",
        )

    if not ids:
        return FeedbackBatchOut(feedbacks={})

    rows = (
        db.query(InteractionLog)
        .filter(
            InteractionLog.user_id == current_user.id,
            InteractionLog.opportunity_id.in_(ids),
            InteractionLog.action.in_(FEEDBACK_ACTIONS),
        )
        .all()
    )

    feedbacks = {str(row.opportunity_id): row.action for row in rows}
    return FeedbackBatchOut(feedbacks=feedbacks)
