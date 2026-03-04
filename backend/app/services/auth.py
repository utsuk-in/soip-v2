"""
Auth service — password hashing (bcrypt) and JWT token management.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from jose import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Bcrypt only uses the first 72 bytes of the password; longer inputs cause an error.
_BCRYPT_MAX_BYTES = 72


def _truncate_password_bytes(password: str | bytes) -> bytes:
    """Truncate password to 72 bytes (UTF-8) so bcrypt accepts it. Returns bytes so
    the bcrypt library never receives more than 72 bytes."""
    if isinstance(password, bytes):
        return password[:_BCRYPT_MAX_BYTES]
    raw = password.encode("utf-8") if isinstance(password, str) else str(password).encode("utf-8")
    return raw[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    truncated = _truncate_password_bytes(password)
    return pwd_context.hash(truncated.decode("utf-8", errors="replace"))


def verify_password(plain: str, hashed: str) -> bool:
    truncated = _truncate_password_bytes(plain)
    return pwd_context.verify(truncated.decode("utf-8", errors="replace"), hashed)


def create_access_token(user_id: UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.jwt_expire_minutes
    )
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def register_user(
    db: Session,
    email: str,
    password: str,
    first_name: str,
    academic_background: str,
    year_of_study: str,
    state: str,
    skills: list[str],
    interests: list[str],
    aspirations: list[str],
    university_id: UUID | None = None,
) -> User:
    """Create a new user with full profile. Raises ValueError if email already taken."""
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise ValueError("Email already registered")

    user = User(
        email=email,
        password_hash=hash_password(password),
        first_name=first_name,
        academic_background=academic_background,
        year_of_study=year_of_study,
        state=state,
        skills=skills,
        interests=interests,
        aspirations=aspirations,
        is_onboarded=True,
    )
    if university_id:
        user.university_id = university_id

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    """Verify credentials. Returns the User or None."""
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        return None
    return user
