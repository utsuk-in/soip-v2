"""Tests for chat satisfaction prompt (SOIP-117 / SOIP-358)."""

import uuid

from sqlalchemy.orm import Session

from app.models.chat import ChatMessage, ChatSession
from app.models.interaction_log import InteractionLog
from app.models.user import User
from app.services.auth import create_access_token, hash_password


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_user(db: Session, suffix: str) -> User:
    user = User(
        email=f"test-sat-{suffix}@example.com",
        password_hash=hash_password("Password123!"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _create_session_and_message(db: Session, user_id, suffix: str):
    session = ChatSession(user_id=user_id, title=f"test-sat-{suffix}")
    db.add(session)
    db.commit()
    db.refresh(session)

    msg = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=f"test-sat-{suffix}-reply",
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return session, msg


def _cleanup(db: Session, suffix: str):
    db.query(InteractionLog).filter(
        InteractionLog.action.in_(("chat_helpful_yes", "chat_helpful_no"))
    ).delete()
    db.query(ChatMessage).filter(
        ChatMessage.content.like(f"%test-sat-{suffix}%")
    ).delete()
    db.query(ChatSession).filter(
        ChatSession.title.like(f"%test-sat-{suffix}%")
    ).delete()
    db.query(User).filter(User.email.like(f"%test-sat-{suffix}%")).delete()
    db.commit()


class TestSatisfactionEndpoint:
    """Tests for POST /api/chat/satisfaction."""

    def test_submit_yes(self, client, db_session: Session, unique_id: str):
        """Submitting 'yes' should store the response and return it."""
        try:
            user = _create_user(db_session, unique_id)
            session, msg = _create_session_and_message(db_session, user.id, unique_id)
            token = create_access_token(user.id)

            resp = client.post(
                "/api/chat/satisfaction",
                headers=_auth_headers(token),
                json={
                    "message_id": str(msg.id),
                    "session_id": str(session.id),
                    "query_text": "show me hackathons",
                    "response": "yes",
                },
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["response"] == "yes"
            assert data["message_id"] == str(msg.id)

            # Verify DB row
            row = (
                db_session.query(InteractionLog)
                .filter(
                    InteractionLog.user_id == user.id,
                    InteractionLog.action == "chat_helpful_yes",
                )
                .first()
            )
            assert row is not None
            assert row.metadata_["session_id"] == str(session.id)
            assert row.metadata_["query_text"] == "show me hackathons"
        finally:
            _cleanup(db_session, unique_id)

    def test_submit_no(self, client, db_session: Session, unique_id: str):
        """Submitting 'no' should store the response and return it."""
        try:
            user = _create_user(db_session, unique_id)
            session, msg = _create_session_and_message(db_session, user.id, unique_id)
            token = create_access_token(user.id)

            resp = client.post(
                "/api/chat/satisfaction",
                headers=_auth_headers(token),
                json={
                    "message_id": str(msg.id),
                    "session_id": str(session.id),
                    "query_text": "AI internships",
                    "response": "no",
                },
            )
            assert resp.status_code == 200
            assert resp.json()["response"] == "no"
        finally:
            _cleanup(db_session, unique_id)

    def test_duplicate_submission_returns_original(
        self, client, db_session: Session, unique_id: str
    ):
        """Submitting satisfaction for the same message twice returns the original response."""
        try:
            user = _create_user(db_session, unique_id)
            session, msg = _create_session_and_message(db_session, user.id, unique_id)
            token = create_access_token(user.id)
            payload = {
                "message_id": str(msg.id),
                "session_id": str(session.id),
                "query_text": "fellowships",
                "response": "yes",
            }

            # First submission
            resp1 = client.post(
                "/api/chat/satisfaction",
                headers=_auth_headers(token),
                json=payload,
            )
            assert resp1.status_code == 200

            # Second submission (different response value — still returns original)
            payload["response"] = "no"
            resp2 = client.post(
                "/api/chat/satisfaction",
                headers=_auth_headers(token),
                json=payload,
            )
            assert resp2.status_code == 200
            assert resp2.json()["response"] == "yes"  # original kept

            # Only one row in DB
            count = (
                db_session.query(InteractionLog)
                .filter(
                    InteractionLog.user_id == user.id,
                    InteractionLog.action.in_(("chat_helpful_yes", "chat_helpful_no")),
                )
                .count()
            )
            assert count == 1
        finally:
            _cleanup(db_session, unique_id)

    def test_requires_auth(self, client):
        """Satisfaction endpoint should require authentication."""
        resp = client.post(
            "/api/chat/satisfaction",
            json={
                "message_id": str(uuid.uuid4()),
                "session_id": str(uuid.uuid4()),
                "query_text": "test",
                "response": "yes",
            },
        )
        assert resp.status_code in (401, 403)

    def test_invalid_response_rejected(
        self, client, db_session: Session, unique_id: str
    ):
        """Only 'yes' or 'no' should be accepted as response values."""
        try:
            user = _create_user(db_session, unique_id)
            token = create_access_token(user.id)

            resp = client.post(
                "/api/chat/satisfaction",
                headers=_auth_headers(token),
                json={
                    "message_id": str(uuid.uuid4()),
                    "session_id": str(uuid.uuid4()),
                    "query_text": "test",
                    "response": "maybe",
                },
            )
            assert resp.status_code == 422
        finally:
            _cleanup(db_session, unique_id)
