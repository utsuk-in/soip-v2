"""
Password reset service — handles forgot-password requests and token-based resets.

Rate-limited to settings.password_reset_max_per_hour per email per hour.
Tokens expire after settings.password_reset_expire_minutes minutes.
"""

import logging
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.models.password_reset import PasswordResetToken
from app.models.user import User
from app.services.auth import hash_password
from app.services.email_service import send_password_reset_email

logger = logging.getLogger(__name__)

DISABLED_HASH = "!disabled"


def request_password_reset(db: Session, email: str) -> None:
    """Handle a forgot-password request.

    Always returns None (caller returns a generic 200) to prevent user enumeration.
    Silently skips sending if the user is ineligible.
    """
    user = db.query(User).filter(User.email == email).first()

    # Silently bail for non-existent, inactive, not-onboarded, or magic-link-only users
    if not user:
        return
    if not user.is_active:
        return
    if not user.is_onboarded:
        return
    if user.password_hash == DISABLED_HASH:
        return

    # Rate limit: count tokens created in the last hour for this user
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    recent_count = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.created_at >= one_hour_ago,
        )
        .count()
    )
    if recent_count >= settings.password_reset_max_per_hour:
        raise RateLimitExceeded()

    # Invalidate any previous unused tokens for this user
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at.is_(None),
    ).update({"used_at": datetime.now(timezone.utc)})

    # Generate new token
    token_str = secrets.token_urlsafe(48)
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.password_reset_expire_minutes
    )
    reset_token = PasswordResetToken(
        user_id=user.id,
        token=token_str,
        expires_at=expires_at,
    )
    db.add(reset_token)
    db.commit()

    # Send email
    reset_url = f"{settings.frontend_base_url}/reset-password?token={token_str}"
    send_password_reset_email(
        to_email=user.email,
        reset_url=reset_url,
        token_validity_minutes=settings.password_reset_expire_minutes,
    )


def reset_password(db: Session, token_str: str, new_password: str) -> None:
    """Consume a password reset token and update the user's password.

    Raises ValueError on invalid, expired, or already-used tokens.
    """
    reset_token = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token == token_str)
        .first()
    )
    if not reset_token:
        raise ValueError("Invalid or expired reset link")

    if reset_token.used_at is not None:
        raise ValueError("This reset link has already been used")

    now = datetime.now(timezone.utc)
    if reset_token.expires_at.replace(tzinfo=timezone.utc) < now:
        raise ValueError("This reset link has expired")

    # Look up user and verify still eligible
    user = db.query(User).filter(User.id == reset_token.user_id).first()
    if not user or not user.is_active:
        raise ValueError("Invalid or expired reset link")

    # Update password and mark token as used
    user.password_hash = hash_password(new_password)
    reset_token.used_at = now
    db.commit()


class RateLimitExceeded(Exception):
    """Raised when a user exceeds the password reset rate limit."""

    pass
