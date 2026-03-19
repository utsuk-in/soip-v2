"""Dedicated unit tests for feedback submission and retrieval (SOIP-137 / SOIP-500)."""

import uuid

from sqlalchemy.orm import Session

from app.models.interaction_log import InteractionLog
from app.models.opportunity import Opportunity
from app.models.university import University
from app.models.user import User
from app.services.auth import create_access_token, hash_password
from app.utils.enums import OpportunityCategory


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_university(db: Session, suffix: str) -> University:
    uni = University(
        name=f"fb-test-{suffix}",
        city="Test City",
        state="TS",
        country="India",
        website="https://example.edu",
    )
    db.add(uni)
    db.commit()
    db.refresh(uni)
    return uni


def _create_user(db: Session, suffix: str) -> User:
    user = User(
        email=f"fb-test-{suffix}@example.com",
        password_hash=hash_password("Password123!"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _create_opportunity(db: Session, suffix: str) -> Opportunity:
    opp = Opportunity(
        title=f"Feedback Test Opp {suffix}",
        description="Test description for feedback",
        category=OpportunityCategory.HACKATHON,
        domain_tags=["AI"],
        eligibility="Students",
        benefits="Experience",
        deadline=None,
        application_link=f"https://example.com/fb-opps/{suffix}/{uuid.uuid4()}",
        source_url="https://example.com/source",
        is_active=True,
    )
    db.add(opp)
    db.commit()
    db.refresh(opp)
    return opp


def _cleanup(db: Session, suffix: str) -> None:
    test_users = db.query(User.id).filter(User.email.like(f"%fb-test-{suffix}%")).all()
    test_user_ids = [u[0] for u in test_users] if test_users else []
    if test_user_ids:
        db.query(InteractionLog).filter(
            InteractionLog.user_id.in_(test_user_ids)
        ).delete(synchronize_session=False)
    db.query(Opportunity).filter(
        Opportunity.title.like(f"%Feedback Test Opp {suffix}%")
    ).delete()
    db.query(User).filter(User.email.like(f"%fb-test-{suffix}%")).delete()
    db.query(University).filter(University.name.like(f"%fb-test-{suffix}%")).delete()
    db.commit()


class TestFeedbackSubmission:
    """Tests for POST /api/feedback — submit and update feedback."""

    def test_submit_thumbs_up_from_feed(
        self, client, db_session: Session, unique_id: str
    ):
        """Submitting thumbs_up from feed should persist correctly."""
        try:
            user = _create_user(db_session, unique_id)
            opp = _create_opportunity(db_session, unique_id)
            token = create_access_token(user.id)

            resp = client.post(
                "/api/feedback",
                headers=_auth_headers(token),
                json={
                    "opportunity_id": str(opp.id),
                    "value": "thumbs_up",
                    "source": "feed",
                },
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["value"] == "thumbs_up"
            assert data["source"] == "feed"
            assert data["opportunity_id"] == str(opp.id)

            # Verify DB row
            row = (
                db_session.query(InteractionLog)
                .filter(
                    InteractionLog.user_id == user.id,
                    InteractionLog.opportunity_id == opp.id,
                    InteractionLog.action == "thumbs_up",
                )
                .first()
            )
            assert row is not None
            assert row.metadata_.get("source") == "feed"
        finally:
            _cleanup(db_session, unique_id)

    def test_submit_thumbs_down_from_chat(
        self, client, db_session: Session, unique_id: str
    ):
        """Submitting thumbs_down from chat should persist correctly."""
        try:
            user = _create_user(db_session, unique_id)
            opp = _create_opportunity(db_session, unique_id)
            token = create_access_token(user.id)

            resp = client.post(
                "/api/feedback",
                headers=_auth_headers(token),
                json={
                    "opportunity_id": str(opp.id),
                    "value": "thumbs_down",
                    "source": "chat",
                },
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["value"] == "thumbs_down"
            assert data["source"] == "chat"
        finally:
            _cleanup(db_session, unique_id)

    def test_update_feedback_replaces_value(
        self, client, db_session: Session, unique_id: str
    ):
        """Resubmitting feedback should update (not duplicate) the existing row."""
        try:
            user = _create_user(db_session, unique_id)
            opp = _create_opportunity(db_session, unique_id)
            token = create_access_token(user.id)

            # Submit thumbs_up first
            client.post(
                "/api/feedback",
                headers=_auth_headers(token),
                json={
                    "opportunity_id": str(opp.id),
                    "value": "thumbs_up",
                    "source": "feed",
                },
            )

            # Update to thumbs_down
            resp = client.post(
                "/api/feedback",
                headers=_auth_headers(token),
                json={
                    "opportunity_id": str(opp.id),
                    "value": "thumbs_down",
                    "source": "feed",
                },
            )
            assert resp.status_code == 200
            assert resp.json()["value"] == "thumbs_down"

            # Only one row should exist
            count = (
                db_session.query(InteractionLog)
                .filter(
                    InteractionLog.user_id == user.id,
                    InteractionLog.opportunity_id == opp.id,
                    InteractionLog.action.in_(("thumbs_up", "thumbs_down")),
                )
                .count()
            )
            assert count == 1
        finally:
            _cleanup(db_session, unique_id)

    def test_update_feedback_changes_source(
        self, client, db_session: Session, unique_id: str
    ):
        """Resubmitting from a different source should update the source metadata."""
        try:
            user = _create_user(db_session, unique_id)
            opp = _create_opportunity(db_session, unique_id)
            token = create_access_token(user.id)

            # Submit from feed
            client.post(
                "/api/feedback",
                headers=_auth_headers(token),
                json={
                    "opportunity_id": str(opp.id),
                    "value": "thumbs_up",
                    "source": "feed",
                },
            )

            # Resubmit from chat
            resp = client.post(
                "/api/feedback",
                headers=_auth_headers(token),
                json={
                    "opportunity_id": str(opp.id),
                    "value": "thumbs_down",
                    "source": "chat",
                },
            )
            assert resp.status_code == 200
            assert resp.json()["source"] == "chat"

            # Verify DB metadata updated
            row = (
                db_session.query(InteractionLog)
                .filter(
                    InteractionLog.user_id == user.id,
                    InteractionLog.opportunity_id == opp.id,
                    InteractionLog.action.in_(("thumbs_up", "thumbs_down")),
                )
                .first()
            )
            assert row is not None
            assert row.metadata_.get("source") == "chat"
        finally:
            _cleanup(db_session, unique_id)


class TestFeedbackBatchGet:
    """Tests for GET /api/feedback/batch — batch retrieval."""

    def test_batch_get_returns_correct_mapping(
        self, client, db_session: Session, unique_id: str
    ):
        """Batch get should return feedback for submitted opps only."""
        try:
            user = _create_user(db_session, unique_id)
            opp1 = _create_opportunity(db_session, f"{unique_id}-a")
            opp2 = _create_opportunity(db_session, f"{unique_id}-b")
            opp3 = _create_opportunity(db_session, f"{unique_id}-c")
            token = create_access_token(user.id)

            # Submit for opp1 and opp2 only
            client.post(
                "/api/feedback",
                headers=_auth_headers(token),
                json={
                    "opportunity_id": str(opp1.id),
                    "value": "thumbs_up",
                    "source": "feed",
                },
            )
            client.post(
                "/api/feedback",
                headers=_auth_headers(token),
                json={
                    "opportunity_id": str(opp2.id),
                    "value": "thumbs_down",
                    "source": "chat",
                },
            )

            ids = f"{opp1.id},{opp2.id},{opp3.id}"
            resp = client.get(
                f"/api/feedback/batch?opportunity_ids={ids}",
                headers=_auth_headers(token),
            )
            assert resp.status_code == 200
            feedbacks = resp.json()["feedbacks"]
            assert feedbacks[str(opp1.id)] == "thumbs_up"
            assert feedbacks[str(opp2.id)] == "thumbs_down"
            assert str(opp3.id) not in feedbacks
        finally:
            _cleanup(db_session, f"{unique_id}-a")
            _cleanup(db_session, f"{unique_id}-b")
            _cleanup(db_session, f"{unique_id}-c")
            _cleanup(db_session, unique_id)

    def test_batch_get_invalid_uuid_returns_400(
        self, client, db_session: Session, unique_id: str
    ):
        """Passing invalid UUIDs should return 400."""
        try:
            user = _create_user(db_session, unique_id)
            token = create_access_token(user.id)

            resp = client.get(
                "/api/feedback/batch?opportunity_ids=not-a-uuid",
                headers=_auth_headers(token),
            )
            assert resp.status_code == 400
        finally:
            _cleanup(db_session, unique_id)


class TestFeedbackEdgeCases:
    """Tests for error handling and auth requirements."""

    def test_feedback_nonexistent_opportunity_returns_404(
        self, client, db_session: Session, unique_id: str
    ):
        """Submitting feedback for a nonexistent opportunity should return 404."""
        try:
            user = _create_user(db_session, unique_id)
            token = create_access_token(user.id)

            resp = client.post(
                "/api/feedback",
                headers=_auth_headers(token),
                json={
                    "opportunity_id": str(uuid.uuid4()),
                    "value": "thumbs_up",
                    "source": "feed",
                },
            )
            assert resp.status_code == 404
        finally:
            _cleanup(db_session, unique_id)

    def test_feedback_requires_authentication(self, client):
        """Submitting feedback without auth should return 401 or 403."""
        resp = client.post(
            "/api/feedback",
            json={
                "opportunity_id": str(uuid.uuid4()),
                "value": "thumbs_up",
                "source": "feed",
            },
        )
        assert resp.status_code in (401, 403)
