from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User

security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)


def _decode_token(token: str) -> UUID:
    """Decode a JWT and return the user UUID, or raise 401."""
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        user_id_raw: str | None = payload.get("sub")
        if user_id_raw is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )
        try:
            return UUID(user_id_raw)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


def _get_user_by_id(db: Session, user_id: UUID) -> User:
    """Look up a user by ID, raising 401 if not found or inactive."""
    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security_optional),
    db: Session = Depends(get_db),
) -> User:
    """Extract and validate user from JWT bearer token or admin HTTP-only cookie."""
    token: str | None = None

    if credentials:
        token = credentials.credentials

    # Fall back to the admin HTTP-only cookie (used when the frontend
    # sends credentials via cookie instead of an Authorization header).
    if not token:
        token = request.cookies.get("soip_admin_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    user_id = _decode_token(token)
    return _get_user_by_id(db, user_id)


def get_current_admin(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security_optional),
    db: Session = Depends(get_db),
) -> User:
    """Authenticate an admin from the Authorization header or the HTTP-only cookie."""
    token: str | None = None

    # Prefer Authorization header if present
    if credentials:
        token = credentials.credentials

    # Fall back to HTTP-only cookie
    if not token:
        token = request.cookies.get("soip_admin_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    user_id = _decode_token(token)
    user = _get_user_by_id(db, user_id)

    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user
