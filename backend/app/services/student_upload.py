"""Validate and upload student records from parsed Excel data."""

import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.admin import MagicLinkResult, StudentRow, UploadSummary
from app.services.magic_link import create_magic_link, MAGIC_LINK_EXPIRY_HOURS
from app.services.email_service import send_invite_email
from app.config import settings

logger = logging.getLogger(__name__)

DISABLED_PASSWORD_HASH = "!disabled"


def find_duplicate_emails(db: Session, emails: list[str]) -> list[str]:
    """Return emails that already exist in the DB."""
    if not emails:
        return []
    existing = (
        db.query(User.email)
        .filter(User.email.in_(emails))
        .all()
    )
    return [row.email for row in existing]


def confirm_upload(
    db: Session,
    students: list[StudentRow],
    admin_user: User,
) -> UploadSummary:
    """Create student User records and generate magic links."""
    emails = [s.email for s in students]
    existing_emails = set(find_duplicate_emails(db, emails))

    invited = 0
    failed = 0
    duplicate_skipped = 0
    invited_students: list[MagicLinkResult] = []

    for student in students:
        if student.email in existing_emails:
            duplicate_skipped += 1
            continue

        try:
            with db.begin_nested():
                user = User(
                    email=student.email,
                    password_hash=DISABLED_PASSWORD_HASH,
                    first_name=student.name,
                    university_id=admin_user.university_id,
                    department=student.department,
                    year_of_study=student.year_of_study,
                    roll_number=student.roll_number,
                    role="student",
                    invited_by_id=admin_user.id,
                    invited_at=datetime.now(timezone.utc),
                    is_onboarded=False,
                )
                db.add(user)
                db.flush()
                ml_token = create_magic_link(db, user.id)

            link_url = f"{settings.frontend_base_url}/magic-link?token={ml_token.token}"
            invited_students.append(MagicLinkResult(
                student_id=user.id,
                email=student.email,
                magic_token=ml_token.token,
                magic_link_url=link_url,
            ))
            invited += 1

            send_invite_email(
                to_email=student.email,
                student_name=student.name,
                magic_link_url=link_url,
                token_validity_hours=MAGIC_LINK_EXPIRY_HOURS,
            )
        except Exception as e:
            logger.error("Failed to invite %s: %s", student.email, e)
            failed += 1

    db.commit()

    return UploadSummary(
        total=len(students),
        invited=invited,
        failed=failed,
        duplicate_skipped=duplicate_skipped,
        invited_students=invited_students,
    )
