"""Integration tests for scraper pipeline helpers (SOIP-240)."""

import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.opportunity import Opportunity
from app.models.source import Source
from app.models.scrape import ScrapePage
from app.utils.enums import OpportunityCategory, OpportunityStatus
from app.services.scraper.extractor import ExtractedOpportunity
from app.services.scraper.pipeline import (
    _coerce_category,
    _coerce_domain_tags,
    _expire_past_deadlines,
    _is_active_from_deadline,
    _upsert_opportunity,
)


def _make_source(db: Session, suffix: str) -> Source:
    source = Source(
        name=f"pipeline-test-{suffix}",
        base_url=f"https://example.com/pipeline-test/{suffix}/{uuid.uuid4()}",
        scraper_type="test",
        is_enabled=True,
        config={},
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


def _make_scrape_page(db: Session, source: Source) -> ScrapePage:
    page = ScrapePage(
        source_id=source.id,
        url=source.base_url,
        raw_content="test content",
        content_hash="testhash",
        content_length=12,
    )
    db.add(page)
    db.commit()
    db.refresh(page)
    return page


def _make_extracted(suffix: str, **overrides) -> ExtractedOpportunity:
    defaults = dict(
        title=f"Pipeline Test Opp {suffix}",
        description="A test opportunity for pipeline tests",
        category="hackathon",
        domain_tags=["AI", "general"],
        url=f"https://example.com/pipeline-opps/{suffix}/{uuid.uuid4()}",
        location="online",
        confidence=0.9,
        is_active=True,
    )
    defaults.update(overrides)
    return ExtractedOpportunity(**defaults)


def _cleanup_pipeline(db: Session, suffix: str) -> None:
    db.query(Opportunity).filter(
        Opportunity.title.like(f"%Pipeline Test Opp {suffix}%")
    ).delete()
    db.query(ScrapePage).filter(ScrapePage.raw_content == "test content").delete()
    db.query(Source).filter(Source.name.like(f"%pipeline-test-{suffix}%")).delete()
    db.commit()


class TestExpirePastDeadlinesIdempotent:
    """Verify _expire_past_deadlines is idempotent."""

    def test_expire_twice_second_returns_zero(
        self, db_session: Session, unique_id: str
    ):
        """Running expiry twice should return 0 on the second run."""
        try:
            opp = Opportunity(
                title=f"Pipeline Test Opp {unique_id}",
                description="Idempotent test",
                category=OpportunityCategory.HACKATHON,
                domain_tags=["test"],
                application_link=f"https://example.com/pipeline-opps/{unique_id}/{uuid.uuid4()}",
                source_url="https://example.com/source",
                deadline=date.today() - timedelta(days=1),
                is_active=True,
                status=OpportunityStatus.OPEN.value,
            )
            db_session.add(opp)
            db_session.commit()

            first = _expire_past_deadlines(db_session)
            assert first >= 1

            second = _expire_past_deadlines(db_session)
            # The same record should not be expired again
            assert second == 0
        finally:
            _cleanup_pipeline(db_session, unique_id)


class TestUpsertOpportunity:
    """Tests for _upsert_opportunity()."""

    def test_upsert_new_opportunity(self, db_session: Session, unique_id: str):
        """Upserting a new item should create a DB row and return 'new'."""
        try:
            source = _make_source(db_session, unique_id)
            page = _make_scrape_page(db_session, source)
            item = _make_extracted(unique_id)

            status, opp_id = _upsert_opportunity(db_session, source, item, page.id)
            db_session.commit()

            assert status == "new"
            assert opp_id is not None

            opp = db_session.query(Opportunity).filter(Opportunity.id == opp_id).first()
            assert opp is not None
            assert opp.title == item.title
            assert opp.category == OpportunityCategory.HACKATHON
            assert opp.is_active is True
        finally:
            _cleanup_pipeline(db_session, unique_id)

    def test_upsert_existing_updates_fields(self, db_session: Session, unique_id: str):
        """Upserting with changed description should return 'updated'."""
        try:
            source = _make_source(db_session, unique_id)
            page = _make_scrape_page(db_session, source)
            item = _make_extracted(unique_id)

            _upsert_opportunity(db_session, source, item, page.id)
            db_session.commit()

            # Upsert again with changed description
            item.description = "Updated description for pipeline test"
            status, opp_id = _upsert_opportunity(db_session, source, item, page.id)
            db_session.commit()

            assert status == "updated"
            opp = db_session.query(Opportunity).filter(Opportunity.id == opp_id).first()
            assert opp.description == "Updated description for pipeline test"
        finally:
            _cleanup_pipeline(db_session, unique_id)

    def test_upsert_existing_skips_unchanged(self, db_session: Session, unique_id: str):
        """Upserting identical data should return 'skipped'."""
        try:
            source = _make_source(db_session, unique_id)
            page = _make_scrape_page(db_session, source)
            item = _make_extracted(unique_id)

            _upsert_opportunity(db_session, source, item, page.id)
            db_session.commit()

            # Upsert again with same data
            status, _ = _upsert_opportunity(db_session, source, item, page.id)

            assert status == "skipped"
        finally:
            _cleanup_pipeline(db_session, unique_id)


class TestIsActiveFromDeadline:
    """Tests for _is_active_from_deadline() with various deadline combinations."""

    def test_future_deadline_is_active(self):
        item = _make_extracted("future", deadline=date.today() + timedelta(days=30))
        assert _is_active_from_deadline(item) is True

    def test_past_deadline_is_inactive(self):
        item = _make_extracted("past", deadline=date.today() - timedelta(days=1))
        assert _is_active_from_deadline(item) is False

    def test_today_deadline_is_active(self):
        item = _make_extracted("today", deadline=date.today())
        assert _is_active_from_deadline(item) is True

    def test_no_deadline_is_active(self):
        item = _make_extracted("none", deadline=None)
        assert _is_active_from_deadline(item) is True

    def test_future_deadline_at_is_active(self):
        future_dt = datetime.now(timezone.utc) + timedelta(hours=1)
        item = _make_extracted("future-dt", deadline_at=future_dt)
        assert _is_active_from_deadline(item) is True

    def test_past_deadline_at_is_inactive(self):
        past_dt = datetime.now(timezone.utc) - timedelta(hours=1)
        item = _make_extracted("past-dt", deadline_at=past_dt)
        assert _is_active_from_deadline(item) is False

    def test_deadline_at_takes_precedence_over_deadline(self):
        """When both deadline_at and deadline are set, deadline_at wins."""
        future_dt = datetime.now(timezone.utc) + timedelta(hours=1)
        item = _make_extracted(
            "both",
            deadline=date.today() - timedelta(days=1),  # past
            deadline_at=future_dt,  # future — should win
        )
        assert _is_active_from_deadline(item) is True


class TestCoerceCategory:
    """Tests for _coerce_category()."""

    def test_valid_category(self):
        assert _coerce_category("hackathon") == OpportunityCategory.HACKATHON

    def test_valid_category_uppercase(self):
        assert _coerce_category("HACKATHON") == OpportunityCategory.HACKATHON

    def test_valid_category_mixed_case(self):
        assert _coerce_category("Fellowship") == OpportunityCategory.FELLOWSHIP

    def test_invalid_category_returns_other(self):
        assert _coerce_category("banana") == OpportunityCategory.OTHER

    def test_none_returns_other(self):
        assert _coerce_category(None) == OpportunityCategory.OTHER

    def test_empty_string_returns_other(self):
        assert _coerce_category("") == OpportunityCategory.OTHER


class TestCoerceDomainTags:
    """Tests for _coerce_domain_tags()."""

    def test_list_input(self):
        assert _coerce_domain_tags(["AI", "fintech"]) == ["AI", "fintech"]

    def test_json_string_input(self):
        assert _coerce_domain_tags('["AI", "fintech"]') == ["AI", "fintech"]

    def test_comma_separated_string(self):
        assert _coerce_domain_tags("AI, fintech, web3") == ["AI", "fintech", "web3"]

    def test_none_input(self):
        assert _coerce_domain_tags(None) == []

    def test_empty_string(self):
        assert _coerce_domain_tags("") == []

    def test_empty_list(self):
        assert _coerce_domain_tags([]) == []

    def test_single_value_string(self):
        assert _coerce_domain_tags("AI") == ["AI"]

    def test_strips_whitespace(self):
        assert _coerce_domain_tags(["  AI  ", " fintech "]) == ["AI", "fintech"]
