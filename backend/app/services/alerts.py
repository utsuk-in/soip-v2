"""
Alert generation — creates alerts for users when new relevant opportunities appear.
"""

import logging
from datetime import date

from sqlalchemy.orm import Session

from app.models.alert import UserAlert
from app.models.opportunity import Opportunity
from app.models.user import User

logger = logging.getLogger(__name__)

_RELEVANCE_THRESHOLD = 0.35  # minimum tag overlap ratio to trigger an alert


def generate_alerts_for_new_opportunities(
    db: Session,
    new_opportunity_ids: list,
) -> int:
    """Create alerts for users whose profile matches newly scraped opportunities."""
    if not new_opportunity_ids:
        return 0

    opportunities = (
        db.query(Opportunity)
        .filter(Opportunity.id.in_(new_opportunity_ids))
        .all()
    )
    users = (
        db.query(User)
        .filter(User.is_onboarded.is_(True), User.is_active.is_(True))
        .all()
    )

    if not users or not opportunities:
        return 0

    created = 0
    for opp in opportunities:
        opp_tags = set(t.lower() for t in (opp.domain_tags or []))
        opp_category = (
            opp.category.value if hasattr(opp.category, "value") else str(opp.category)
        ).lower()

        for user in users:
            user_tags = set(
                s.lower() for s in ((user.interests or []) + (user.skills or []))
            )
            user_aspirations = set(s.lower() for s in (user.aspirations or []))

            tag_overlap = len(opp_tags & user_tags)
            tag_ratio = tag_overlap / max(len(opp_tags), 1)
            category_match = opp_category in user_aspirations

            if tag_ratio >= _RELEVANCE_THRESHOLD or category_match:
                reason = _build_reason(opp, tag_overlap, category_match)

                existing = (
                    db.query(UserAlert)
                    .filter(
                        UserAlert.user_id == user.id,
                        UserAlert.opportunity_id == opp.id,
                    )
                    .first()
                )
                if existing:
                    continue

                alert = UserAlert(
                    user_id=user.id,
                    opportunity_id=opp.id,
                    reason=reason,
                )
                db.add(alert)
                created += 1

    db.commit()
    logger.info(f"Generated {created} alerts for {len(new_opportunity_ids)} new opportunities")
    return created


def _build_reason(opp: Opportunity, tag_overlap: int, category_match: bool) -> str:
    category = (
        opp.category.value if hasattr(opp.category, "value") else str(opp.category)
    )
    parts = [f"New {category}"]

    if tag_overlap > 0:
        parts.append("matching your interests")
    elif category_match:
        parts.append("matching what you're looking for")

    deadline_str = ""
    if opp.deadline:
        days = (opp.deadline - date.today()).days
        if 0 <= days <= 14:
            deadline_str = f" — deadline in {days} days"

    return f"{' '.join(parts)}: {opp.title}{deadline_str}"
