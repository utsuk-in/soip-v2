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


def _truncate_for_bcrypt(password: str) -> str:
    """Truncate password to 72 bytes (UTF-8) so bcrypt accepts it."""
    if not isinstance(password, str):
        password = str(password)
    encoded = password.encode("utf-8")
    if len(encoded) <= _BCRYPT_MAX_BYTES:
        return password
    return encoded[:_BCRYPT_MAX_BYTES].decode("utf-8", errors="ignore")


def hash_password(password: str) -> str:
    return pwd_context.hash(_truncate_for_bcrypt(password))


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(_truncate_for_bcrypt(plain), hashed)


def create_access_token(user_id: UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.jwt_expire_minutes
    )
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def register_user(db: Session, email: str, password: str, university_id: str | None = None) -> User:
    """Create a new user. Raises ValueError if email already taken."""
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise ValueError("Email already registered")

    user = User(
        email=email,
        password_hash=hash_password(password),
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
