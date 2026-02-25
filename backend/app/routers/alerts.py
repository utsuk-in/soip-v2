from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.alert import UserAlert
from app.models.user import User
from app.schemas.alert import AlertOut
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
def list_alerts(
    unread_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(UserAlert).filter(UserAlert.user_id == current_user.id)
    if unread_only:
        query = query.filter(UserAlert.is_read.is_(False))
    return query.order_by(UserAlert.created_at.desc()).limit(50).all()


@router.put("/{alert_id}/read", response_model=AlertOut)
def mark_read(
    alert_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = (
        db.query(UserAlert)
        .filter(UserAlert.id == alert_id, UserAlert.user_id == current_user.id)
        .first()
    )
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )
    alert.is_read = True
    db.commit()
    db.refresh(alert)
    return alert
