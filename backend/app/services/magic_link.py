"""Magic link generation and validation."""

import logging
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.magic_link import MagicLinkToken
from app.models.user import User
from app.services.auth import create_access_token
from app.config import settings

logger = logging.getLogger(__name__)

MAGIC_LINK_EXPIRY_HOURS = 72


def create_magic_link(db: Session, user_id: UUID) -> MagicLinkToken:
    """Generate a new magic link token for a user."""
    token_str = secrets.token_urlsafe(48)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=MAGIC_LINK_EXPIRY_HOURS)

    token = MagicLinkToken(
        user_id=user_id,
        token=token_str,
        expires_at=expires_at,
    )
    db.add(token)
    db.flush()

    url = f"{settings.frontend_base_url}/magic-link?token={token_str}"
    logger.info("Magic link for user %s: %s", user_id, url)
    print(f"[MAGIC LINK] {url}")

    return token


def validate_and_consume_magic_link(db: Session, token_str: str) -> str | None:
    """Validate a magic link token. Returns a JWT access token or None if invalid."""
    token = (
        db.query(MagicLinkToken)
        .filter(MagicLinkToken.token == token_str)
        .first()
    )
    if not token:
        return None

    now = datetime.now(timezone.utc)
    if token.used_at is not None:
        return None
    if token.expires_at.replace(tzinfo=timezone.utc) < now:
        return None

    # Mark as used
    token.used_at = now

    # Activate the user
    user = db.query(User).filter(User.id == token.user_id).first()
    if not user or not user.is_active:
        return None

    user.last_login_at = now
    db.commit()

    return create_access_token(user.id)
