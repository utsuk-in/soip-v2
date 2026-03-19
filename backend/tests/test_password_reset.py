"""Tests for the forgot-password / reset-password flow (SOIP-737)."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.orm import Session

from app.models.password_reset import PasswordResetToken
from app.models.user import User
from app.services.auth import create_access_token, hash_password, verify_password


PREFIX = "pwreset-test"


def _create_user(
    db: Session,
    suffix: str,
    *,
    is_onboarded: bool = True,
    is_active: bool = True,
    password: str = "Password123!",
    password_hash_override: str | None = None,
) -> User:
    user = User(
        email=f"{PREFIX}-{suffix}@example.com",
        password_hash=password_hash_override or hash_password(password),
        is_onboarded=is_onboarded,
        is_active=is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _cleanup(db: Session, suffix: str) -> None:
    users = db.query(User).filter(User.email.like(f"%{PREFIX}-{suffix}%")).all()
    for u in users:
        db.query(PasswordResetToken).filter(PasswordResetToken.user_id == u.id).delete()
    db.query(User).filter(User.email.like(f"%{PREFIX}-{suffix}%")).delete()
    db.commit()


class TestForgotPassword:
    """Tests for POST /api/auth/forgot-password."""

    def test_happy_path_creates_token(self, client, db_session: Session, unique_id: str):
        """Valid request should return 200 and create a reset token."""
        try:
            user = _create_user(db_session, unique_id)

            resp = client.post(
                "/api/auth/forgot-password",
                json={"email": user.email},
            )
            assert resp.status_code == 200
            assert "reset link has been sent" in resp.json()["message"].lower()

            # Verify token was created in DB
            token = (
                db_session.query(PasswordResetToken)
                .filter(PasswordResetToken.user_id == user.id)
                .first()
            )
            assert token is not None
            assert token.used_at is None
            assert token.expires_at > datetime.now(timezone.utc)
        finally:
            _cleanup(db_session, unique_id)

    def test_nonexistent_email_returns_200(self, client):
        """Non-existent email should still return 200 (no user enumeration)."""
        resp = client.post(
            "/api/auth/forgot-password",
            json={"email": f"nonexistent-{uuid.uuid4()}@example.com"},
        )
        assert resp.status_code == 200

    def test_inactive_user_returns_200_no_token(self, client, db_session: Session, unique_id: str):
        """Inactive user should get 200 but no token created."""
        try:
            user = _create_user(db_session, unique_id, is_active=False)

            resp = client.post(
                "/api/auth/forgot-password",
                json={"email": user.email},
            )
            assert resp.status_code == 200

            count = (
                db_session.query(PasswordResetToken)
                .filter(PasswordResetToken.user_id == user.id)
                .count()
            )
            assert count == 0
        finally:
            _cleanup(db_session, unique_id)

    def test_not_onboarded_user_returns_200_no_token(self, client, db_session: Session, unique_id: str):
        """Not-onboarded user should get 200 but no token created."""
        try:
            user = _create_user(db_session, unique_id, is_onboarded=False)

            resp = client.post(
                "/api/auth/forgot-password",
                json={"email": user.email},
            )
            assert resp.status_code == 200

            count = (
                db_session.query(PasswordResetToken)
                .filter(PasswordResetToken.user_id == user.id)
                .count()
            )
            assert count == 0
        finally:
            _cleanup(db_session, unique_id)

    def test_magic_link_only_user_returns_200_no_token(self, client, db_session: Session, unique_id: str):
        """User with disabled password (magic-link-only) gets 200 but no token."""
        try:
            user = _create_user(db_session, unique_id, password_hash_override="!disabled")

            resp = client.post(
                "/api/auth/forgot-password",
                json={"email": user.email},
            )
            assert resp.status_code == 200

            count = (
                db_session.query(PasswordResetToken)
                .filter(PasswordResetToken.user_id == user.id)
                .count()
            )
            assert count == 0
        finally:
            _cleanup(db_session, unique_id)

    def test_new_token_invalidates_old_tokens(self, client, db_session: Session, unique_id: str):
        """Requesting a new token should invalidate previous unused tokens."""
        try:
            user = _create_user(db_session, unique_id)

            # First request
            client.post("/api/auth/forgot-password", json={"email": user.email})
            first_token = (
                db_session.query(PasswordResetToken)
                .filter(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))
                .first()
            )
            assert first_token is not None
            first_token_id = first_token.id

            # Second request
            client.post("/api/auth/forgot-password", json={"email": user.email})
            db_session.expire_all()

            # First token should now be marked used
            old_token = db_session.query(PasswordResetToken).filter(PasswordResetToken.id == first_token_id).first()
            assert old_token.used_at is not None

            # New unused token should exist
            active_tokens = (
                db_session.query(PasswordResetToken)
                .filter(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))
                .count()
            )
            assert active_tokens == 1
        finally:
            _cleanup(db_session, unique_id)

    def test_rate_limit_returns_429(self, client, db_session: Session, unique_id: str):
        """4th request within an hour should return 429."""
        try:
            user = _create_user(db_session, unique_id)

            for i in range(3):
                resp = client.post("/api/auth/forgot-password", json={"email": user.email})
                assert resp.status_code == 200

            resp = client.post("/api/auth/forgot-password", json={"email": user.email})
            assert resp.status_code == 429
            assert "too many" in resp.json()["detail"].lower()
        finally:
            _cleanup(db_session, unique_id)


class TestResetPassword:
    """Tests for POST /api/auth/reset-password."""

    def _get_valid_token(self, client, db_session: Session, user: User) -> str:
        """Helper: request a reset and return the raw token string."""
        client.post("/api/auth/forgot-password", json={"email": user.email})
        db_session.expire_all()
        token = (
            db_session.query(PasswordResetToken)
            .filter(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))
            .first()
        )
        return token.token

    def test_happy_path_resets_password(self, client, db_session: Session, unique_id: str):
        """Valid token + new password should update the user's password."""
        try:
            user = _create_user(db_session, unique_id, password="OldPassword1!")
            token_str = self._get_valid_token(client, db_session, user)

            resp = client.post(
                "/api/auth/reset-password",
                json={"token": token_str, "new_password": "NewPassword1!"},
            )
            assert resp.status_code == 200
            assert "successfully" in resp.json()["message"].lower()

            # Verify new password works
            db_session.expire_all()
            updated_user = db_session.query(User).filter(User.id == user.id).first()
            assert verify_password("NewPassword1!", updated_user.password_hash)
            assert not verify_password("OldPassword1!", updated_user.password_hash)
        finally:
            _cleanup(db_session, unique_id)

    def test_can_login_with_new_password(self, client, db_session: Session, unique_id: str):
        """After reset, user should be able to login with the new password."""
        try:
            user = _create_user(db_session, unique_id, password="OldPassword1!")
            token_str = self._get_valid_token(client, db_session, user)

            client.post(
                "/api/auth/reset-password",
                json={"token": token_str, "new_password": "NewPassword1!"},
            )

            # Login with new password
            resp = client.post(
                "/api/auth/login",
                json={"email": user.email, "password": "NewPassword1!"},
            )
            assert resp.status_code == 200
            assert "access_token" in resp.json()

            # Old password should fail
            resp = client.post(
                "/api/auth/login",
                json={"email": user.email, "password": "OldPassword1!"},
            )
            assert resp.status_code == 401
        finally:
            _cleanup(db_session, unique_id)

    def test_invalid_token_returns_400(self, client):
        """Bogus token should return 400."""
        resp = client.post(
            "/api/auth/reset-password",
            json={"token": "totally-invalid-token", "new_password": "NewPassword1!"},
        )
        assert resp.status_code == 400

    def test_expired_token_returns_400(self, client, db_session: Session, unique_id: str):
        """Expired token should return 400."""
        try:
            user = _create_user(db_session, unique_id)
            token_str = self._get_valid_token(client, db_session, user)

            # Manually expire the token
            token_row = (
                db_session.query(PasswordResetToken)
                .filter(PasswordResetToken.token == token_str)
                .first()
            )
            token_row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
            db_session.commit()

            resp = client.post(
                "/api/auth/reset-password",
                json={"token": token_str, "new_password": "NewPassword1!"},
            )
            assert resp.status_code == 400
            assert "expired" in resp.json()["detail"].lower()
        finally:
            _cleanup(db_session, unique_id)

    def test_used_token_returns_400(self, client, db_session: Session, unique_id: str):
        """Already-used token should return 400."""
        try:
            user = _create_user(db_session, unique_id)
            token_str = self._get_valid_token(client, db_session, user)

            # Use the token
            resp = client.post(
                "/api/auth/reset-password",
                json={"token": token_str, "new_password": "NewPassword1!"},
            )
            assert resp.status_code == 200

            # Try again
            resp = client.post(
                "/api/auth/reset-password",
                json={"token": token_str, "new_password": "AnotherPass1!"},
            )
            assert resp.status_code == 400
            assert "already been used" in resp.json()["detail"].lower()
        finally:
            _cleanup(db_session, unique_id)

    def test_short_password_returns_422(self, client, db_session: Session, unique_id: str):
        """Password shorter than 8 chars should be rejected by schema validation."""
        try:
            user = _create_user(db_session, unique_id)
            token_str = self._get_valid_token(client, db_session, user)

            resp = client.post(
                "/api/auth/reset-password",
                json={"token": token_str, "new_password": "short"},
            )
            assert resp.status_code == 422
        finally:
            _cleanup(db_session, unique_id)
