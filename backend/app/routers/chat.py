from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.chat import ChatMessage, ChatSession
from app.models.opportunity import Opportunity
from app.models.user import User
from app.models.interaction_log import InteractionLog
from app.schemas.chat import (
    ChatMessageOut,
    ChatRequest,
    ChatResponse,
    ChatSessionDetail,
    ChatSessionOut,
    SatisfactionRequest,
    SatisfactionOut,
)
from app.schemas.opportunity import OpportunityOut
from app.services.chat import handle_chat_message
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def send_message(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    assistant_msg, cited_opps, session_id = await handle_chat_message(
        db=db,
        user=current_user,
        message=body.message,
        session_id=body.session_id,
        opportunity_id=body.opportunity_id,
    )

    return ChatResponse(
        message=ChatMessageOut.model_validate(assistant_msg),
        cited_opportunities=[OpportunityOut.model_validate(o) for o in cited_opps],
        session_id=session_id,
    )


@router.get("/sessions", response_model=list[ChatSessionOut])
def list_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.created_at.desc())
        .limit(50)
        .all()
    )
    return sessions


@router.get("/sessions/{session_id}", response_model=ChatSessionDetail)
def get_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(ChatSession)
        .filter(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )

    # Collect all cited opportunity IDs across all messages in one query
    all_opp_ids: set[str] = set()
    for m in messages:
        if m.cited_opportunity_ids:
            all_opp_ids.update(m.cited_opportunity_ids)

    opp_map: dict[str, OpportunityOut] = {}
    if all_opp_ids:
        opps = db.query(Opportunity).filter(Opportunity.id.in_(all_opp_ids)).all()
        opp_map = {str(o.id): OpportunityOut.model_validate(o) for o in opps}

    msg_outs = []
    for m in messages:
        msg_out = ChatMessageOut.model_validate(m)
        if m.cited_opportunity_ids:
            msg_out.cited_opportunities = [
                opp_map[oid] for oid in m.cited_opportunity_ids if oid in opp_map
            ]
        msg_outs.append(msg_out)

    return ChatSessionDetail(
        session=ChatSessionOut.model_validate(session),
        messages=msg_outs,
    )


SATISFACTION_ACTIONS = ("chat_helpful_yes", "chat_helpful_no")


@router.post("/satisfaction", response_model=SatisfactionOut)
def submit_satisfaction(
    body: SatisfactionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record whether a chat response was helpful (yes/no)."""
    action = f"chat_helpful_{body.response}"

    # Prevent duplicate submission for the same message
    existing = (
        db.query(InteractionLog)
        .filter(
            InteractionLog.user_id == current_user.id,
            InteractionLog.action.in_(SATISFACTION_ACTIONS),
            InteractionLog.metadata_.op("->>")(  # type: ignore[union-attr]
                "message_id"
            )
            == str(body.message_id),
        )
        .first()
    )

    if existing:
        return SatisfactionOut(
            id=existing.id,
            message_id=body.message_id,
            response=existing.action.replace("chat_helpful_", ""),
            created_at=existing.created_at,
        )

    log = InteractionLog(
        user_id=current_user.id,
        action=action,
        metadata_={
            "session_id": str(body.session_id),
            "message_id": str(body.message_id),
            "query_text": body.query_text,
        },
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return SatisfactionOut(
        id=log.id,
        message_id=body.message_id,
        response=body.response,
        created_at=log.created_at,
    )


@router.get("/satisfaction/batch")
def batch_get_satisfaction(
    message_ids: str = Query(..., description="Comma-separated message UUIDs"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return existing satisfaction responses for a list of message IDs."""
    ids = [uid.strip() for uid in message_ids.split(",") if uid.strip()]
    if not ids:
        return {"responses": {}}

    rows = (
        db.query(InteractionLog)
        .filter(
            InteractionLog.user_id == current_user.id,
            InteractionLog.action.in_(SATISFACTION_ACTIONS),
        )
        .all()
    )

    responses: dict[str, str] = {}
    for row in rows:
        mid = (row.metadata_ or {}).get("message_id")
        if mid and mid in ids:
            responses[mid] = row.action.replace("chat_helpful_", "")

    return {"responses": responses}
