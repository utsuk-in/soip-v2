"""Normalize opportunity domain tags + user profile tags to canonical taxonomy."""

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.opportunity import Opportunity
from app.models.user import User
from app.services.taxonomy import normalize_domains


def normalize_all(db: Session) -> None:
    opps = db.query(Opportunity).all()
    for opp in opps:
        normalized = normalize_domains(opp.domain_tags or [])
        if normalized and normalized != (opp.domain_tags or []):
            opp.domain_tags = normalized
    users = db.query(User).all()
    for user in users:
        if user.skills:
            user.skills = normalize_domains(user.skills) or user.skills
        if user.interests:
            user.interests = normalize_domains(user.interests) or user.interests
    db.commit()


if __name__ == "__main__":
    db = SessionLocal()
    try:
        normalize_all(db)
        print("Normalized opportunity domain tags and user profile tags")
    finally:
        db.close()
