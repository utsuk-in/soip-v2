"""Tests for auto-expiry of past-deadline opportunities (SOIP-101 / SOIP-305)
and deadline parsing edge cases (SOIP-93)."""

import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.opportunity import Opportunity
from app.utils.enums import OpportunityCategory, OpportunityStatus
from app.services.scraper.pipeline import (
    _expire_past_deadlines,
    _extract_unstop_registration_close_datetime,
    _is_active_from_deadline,
)
from app.services.scraper.extractor import ExtractedOpportunity


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

    def test_already_expired_not_updated_again(
        self, db_session: Session, unique_id: str
    ):
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

    def test_browse_excludes_already_expired(
        self, client, db_session: Session, unique_id: str
    ):
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


class TestStatusBadgeField:
    """Verify the API returns the correct status field for each opportunity state (SOIP-266)."""

    def test_open_opportunity_returns_open_status(
        self, client, db_session: Session, unique_id: str
    ):
        """An open opportunity should have status='open' in the API response."""
        try:
            opp = _make_opportunity(
                db_session,
                unique_id,
                deadline=date.today() + timedelta(days=30),
                status=OpportunityStatus.OPEN.value,
            )

            resp = client.get("/api/opportunities")
            assert resp.status_code == 200
            match = next(
                (o for o in resp.json()["items"] if o["id"] == str(opp.id)), None
            )
            assert match is not None
            assert match["status"] == "open"
        finally:
            _cleanup_expiry(db_session, unique_id)

    def test_coming_soon_opportunity_returns_coming_soon_status(
        self, client, db_session: Session, unique_id: str
    ):
        """A coming_soon opportunity should have status='coming_soon' in the API response."""
        try:
            opp = _make_opportunity(
                db_session,
                unique_id,
                deadline=date.today() + timedelta(days=30),
                status=OpportunityStatus.COMING_SOON.value,
            )

            resp = client.get("/api/opportunities")
            assert resp.status_code == 200
            match = next(
                (o for o in resp.json()["items"] if o["id"] == str(opp.id)), None
            )
            assert match is not None
            assert match["status"] == "coming_soon"
        finally:
            _cleanup_expiry(db_session, unique_id)

    def test_expired_opportunity_status_not_in_default_feed(
        self, client, db_session: Session, unique_id: str
    ):
        """Expired opportunities should not appear in the default feed at all."""
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

    def test_expired_status_visible_when_show_expired(
        self, client, db_session: Session, unique_id: str
    ):
        """When active_only=false, expired opportunities return status='expired'."""
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
            match = next(
                (o for o in resp.json()["items"] if o["id"] == str(opp.id)), None
            )
            assert match is not None
            assert match["status"] == "expired"
        finally:
            _cleanup_expiry(db_session, unique_id)


class TestUnstopDeadlineParsing:
    """Edge-case tests for _extract_unstop_registration_close_datetime (SOIP-93)."""

    def test_two_digit_year(self):
        """'20 Mar 26, 11:59 PM IST' should parse to 2026-03-20."""
        md = "Registration Close: 20 Mar 26, 11:59 PM IST"
        result = _extract_unstop_registration_close_datetime(md)
        assert result is not None
        assert result.year == 2026
        assert result.month == 3
        assert result.day == 20
        assert result.hour == 23
        assert result.minute == 59

    def test_four_digit_year(self):
        """'20 Mar 2026, 11:59 PM IST' should parse correctly."""
        md = "Registration Close: 20 Mar 2026, 11:59 PM IST"
        result = _extract_unstop_registration_close_datetime(md)
        assert result is not None
        assert result.year == 2026
        assert result.month == 3
        assert result.day == 20

    def test_full_month_name(self):
        """'20 March 2026, 11:59 PM IST' should parse correctly."""
        md = "Registration Close: 20 March 2026, 11:59 PM IST"
        result = _extract_unstop_registration_close_datetime(md)
        assert result is not None
        assert result.year == 2026
        assert result.month == 3

    def test_missing_timezone_defaults_ist(self):
        """When no timezone suffix, should default to IST (+05:30)."""
        md = "Registration Close: 15 Apr 26, 6:00 PM"
        result = _extract_unstop_registration_close_datetime(md)
        assert result is not None
        ist = timezone(timedelta(hours=5, minutes=30))
        assert result.tzinfo is not None
        assert result.utcoffset() == ist.utcoffset(None)

    def test_garbage_input_returns_none(self):
        """Non-date strings should return None."""
        for text in ["TBD", "Rolling basis", "ASAP", "No deadline", ""]:
            result = _extract_unstop_registration_close_datetime(
                f"Registration Close: {text}"
            )
            assert result is None, f"Expected None for input: {text}"

    def test_no_registration_close_marker_returns_none(self):
        """Text without 'Registration Close' marker should return None."""
        result = _extract_unstop_registration_close_datetime(
            "Deadline: 20 Mar 2026, 11:59 PM IST"
        )
        assert result is None

    def test_leap_year_feb29(self):
        """Feb 29 in a leap year (2028) should parse correctly."""
        md = "Registration Close: 29 Feb 28, 11:59 PM IST"
        result = _extract_unstop_registration_close_datetime(md)
        assert result is not None
        assert result.month == 2
        assert result.day == 29
        assert result.year == 2028

    def test_invalid_feb29_non_leap_returns_none(self):
        """Feb 29 in a non-leap year (2027) should return None."""
        md = "Registration Close: 29 Feb 27, 11:59 PM IST"
        result = _extract_unstop_registration_close_datetime(md)
        assert result is None


class TestIsActiveFromDeadlineEdgeCases:
    """Edge-case tests for _is_active_from_deadline (SOIP-93)."""

    def _make_item(self, **kwargs) -> ExtractedOpportunity:
        defaults = dict(
            title="Edge Case Test",
            description="Test",
            category="hackathon",
        )
        defaults.update(kwargs)
        return ExtractedOpportunity(**defaults)

    def test_deadline_at_just_ahead_is_active(self):
        """deadline_at slightly in the future should be active (>= comparison)."""
        ahead = datetime.now(timezone.utc) + timedelta(seconds=5)
        item = self._make_item(deadline_at=ahead)
        assert _is_active_from_deadline(item) is True

    def test_deadline_date_today_is_active(self):
        """deadline == today should be active (>= comparison)."""
        item = self._make_item(deadline=date.today())
        assert _is_active_from_deadline(item) is True

    def test_deadline_yesterday_is_inactive(self):
        """deadline == yesterday should be inactive."""
        item = self._make_item(deadline=date.today() - timedelta(days=1))
        assert _is_active_from_deadline(item) is False

    def test_deadline_at_one_second_ago_is_inactive(self):
        """deadline_at just past should be inactive."""
        past = datetime.now(timezone.utc) - timedelta(seconds=1)
        item = self._make_item(deadline_at=past)
        assert _is_active_from_deadline(item) is False

    def test_no_deadline_fields_is_active(self):
        """No deadline or deadline_at should default to active."""
        item = self._make_item()
        assert _is_active_from_deadline(item) is True

    def test_deadline_at_with_ist_timezone(self):
        """deadline_at with IST timezone should be compared correctly."""
        ist = timezone(timedelta(hours=5, minutes=30))
        future = datetime.now(ist) + timedelta(hours=1)
        item = self._make_item(deadline_at=future)
        assert _is_active_from_deadline(item) is True
