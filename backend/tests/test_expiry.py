"""Tests for auto-expiry of past-deadline opportunities (SOIP-101 / SOIP-305)."""

import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy.orm import Session

from app.models.opportunity import Opportunity
from app.utils.enums import OpportunityCategory, OpportunityStatus
from app.services.scraper.pipeline import _expire_past_deadlines


def _make_opportunity(
    db: Session,
    suffix: str,
    *,
    deadline: date | None = None,
    is_active: bool = True,
    status: str = OpportunityStatus.OPEN.value,
) -> Opportunity:
    opp = Opportunity(
        title=f"Expiry Test {suffix}",
        description="Auto-expiry test fixture",
        category=OpportunityCategory.HACKATHON,
        domain_tags=["test"],
        application_link=f"https://example.com/expiry-test/{suffix}/{uuid.uuid4()}",
        source_url="https://example.com/source",
        deadline=deadline,
        is_active=is_active,
        status=status,
    )
    db.add(opp)
    db.commit()
    db.refresh(opp)
    return opp


def _cleanup_expiry(db: Session, suffix: str) -> None:
    db.query(Opportunity).filter(
        Opportunity.title.like(f"Expiry Test {suffix}%")
    ).delete()
    db.commit()


class TestExpirePastDeadlines:
    """Unit tests for _expire_past_deadlines()."""

    def test_past_deadline_gets_expired(self, db_session: Session, unique_id: str):
        """An active opportunity with a past deadline should be marked expired."""
        try:
            opp = _make_opportunity(
                db_session,
                unique_id,
                deadline=date.today() - timedelta(days=1),
            )

            count = _expire_past_deadlines(db_session)

            assert count >= 1
            db_session.refresh(opp)
            assert opp.is_active is False
            assert opp.status == OpportunityStatus.EXPIRED.value
        finally:
            _cleanup_expiry(db_session, unique_id)

    def test_future_deadline_stays_active(self, db_session: Session, unique_id: str):
        """An opportunity with a future deadline should remain active."""
        try:
            opp = _make_opportunity(
                db_session,
                unique_id,
                deadline=date.today() + timedelta(days=30),
            )

            _expire_past_deadlines(db_session)

            db_session.refresh(opp)
            assert opp.is_active is True
            assert opp.status == OpportunityStatus.OPEN.value
        finally:
            _cleanup_expiry(db_session, unique_id)

    def test_no_deadline_stays_active(self, db_session: Session, unique_id: str):
        """An opportunity with no deadline should remain active."""
        try:
            opp = _make_opportunity(
                db_session,
                unique_id,
                deadline=None,
            )

            _expire_past_deadlines(db_session)

            db_session.refresh(opp)
            assert opp.is_active is True
            assert opp.status == OpportunityStatus.OPEN.value
        finally:
            _cleanup_expiry(db_session, unique_id)

    def test_already_expired_not_updated_again(self, db_session: Session, unique_id: str):
        """An already-expired opportunity should not be touched (is_active=False skips it)."""
        try:
            opp = _make_opportunity(
                db_session,
                unique_id,
                deadline=date.today() - timedelta(days=10),
                is_active=False,
                status=OpportunityStatus.EXPIRED.value,
            )
            original_updated_at = opp.updated_at

            count = _expire_past_deadlines(db_session)

            # The function filters is_active=True, so this record should be skipped
            db_session.refresh(opp)
            assert opp.updated_at == original_updated_at
        finally:
            _cleanup_expiry(db_session, unique_id)

    def test_today_deadline_stays_active(self, db_session: Session, unique_id: str):
        """An opportunity whose deadline is today should remain active (deadline < today, not <=)."""
        try:
            opp = _make_opportunity(
                db_session,
                unique_id,
                deadline=date.today(),
            )

            _expire_past_deadlines(db_session)

            db_session.refresh(opp)
            assert opp.is_active is True
            assert opp.status == OpportunityStatus.OPEN.value
        finally:
            _cleanup_expiry(db_session, unique_id)

    def test_returns_expired_count(self, db_session: Session, unique_id: str):
        """The function should return the number of newly expired opportunities."""
        try:
            _make_opportunity(
                db_session,
                f"{unique_id}-a",
                deadline=date.today() - timedelta(days=1),
            )
            _make_opportunity(
                db_session,
                f"{unique_id}-b",
                deadline=date.today() - timedelta(days=5),
            )
            _make_opportunity(
                db_session,
                f"{unique_id}-c",
                deadline=date.today() + timedelta(days=10),
            )

            count = _expire_past_deadlines(db_session)

            assert count >= 2
        finally:
            _cleanup_expiry(db_session, f"{unique_id}-a")
            _cleanup_expiry(db_session, f"{unique_id}-b")
            _cleanup_expiry(db_session, f"{unique_id}-c")


class TestExpiredExcludedFromFeed:
    """Verify expired opportunities are excluded from student-facing endpoints (SOIP-306)."""

    def test_browse_excludes_already_expired(self, client, db_session: Session, unique_id: str):
        """Opportunity already marked is_active=False should not appear in default browse."""
        try:
            opp = _make_opportunity(
                db_session,
                unique_id,
                deadline=date.today() - timedelta(days=1),
                is_active=False,
                status=OpportunityStatus.EXPIRED.value,
            )

            resp = client.get("/api/opportunities")
            assert resp.status_code == 200
            ids = [o["id"] for o in resp.json()["items"]]
            assert str(opp.id) not in ids
        finally:
            _cleanup_expiry(db_session, unique_id)

    def test_browse_excludes_past_deadline_not_yet_expired_by_scheduler(
        self, client, db_session: Session, unique_id: str
    ):
        """Opportunity with past deadline but is_active=True (scheduler not run yet)
        should still be excluded from the default browse view."""
        try:
            opp = _make_opportunity(
                db_session,
                unique_id,
                deadline=date.today() - timedelta(days=1),
                is_active=True,  # scheduler hasn't run yet
                status=OpportunityStatus.OPEN.value,
            )

            resp = client.get("/api/opportunities")
            assert resp.status_code == 200
            ids = [o["id"] for o in resp.json()["items"]]
            assert str(opp.id) not in ids
        finally:
            _cleanup_expiry(db_session, unique_id)

    def test_browse_includes_past_deadline_when_show_expired(
        self, client, db_session: Session, unique_id: str
    ):
        """When active_only=false, past-deadline opportunities should be visible."""
        try:
            opp = _make_opportunity(
                db_session,
                unique_id,
                deadline=date.today() - timedelta(days=1),
                is_active=False,
                status=OpportunityStatus.EXPIRED.value,
            )

            resp = client.get("/api/opportunities?active_only=false")
            assert resp.status_code == 200
            ids = [o["id"] for o in resp.json()["items"]]
            assert str(opp.id) in ids
        finally:
            _cleanup_expiry(db_session, unique_id)

    def test_browse_includes_active_with_future_deadline(
        self, client, db_session: Session, unique_id: str
    ):
        """Active opportunities with future deadlines should always appear."""
        try:
            opp = _make_opportunity(
                db_session,
                unique_id,
                deadline=date.today() + timedelta(days=30),
            )

            resp = client.get("/api/opportunities")
            assert resp.status_code == 200
            ids = [o["id"] for o in resp.json()["items"]]
            assert str(opp.id) in ids
        finally:
            _cleanup_expiry(db_session, unique_id)
