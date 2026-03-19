from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.config import settings as app_settings
from app.database import get_db
from app.models.interaction_log import InteractionLog
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.schemas.user import UserOut
from app.services.auth import authenticate_user, create_access_token, register_user
from app.utils.dependencies import get_current_user
from app.services.taxonomy import merge_domains_with_raw
from app.models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    try:
        user = register_user(
            db,
            email=body.email,
            password=body.password,
            first_name=body.first_name,
            academic_background=body.academic_background,
            year_of_study=body.year_of_study,
            state=body.state,
            skills=merge_domains_with_raw(body.skills) or body.skills,
            interests=merge_domains_with_raw(body.interests) or body.interests,
            aspirations=body.aspirations,
            university_id=body.university_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    token = create_access_token(user.id)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, body.email, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user.last_login_at = datetime.now(timezone.utc)
    db.add(InteractionLog(user_id=user.id, action="login"))
    db.commit()

    token = create_access_token(user.id)

    # For admin users, also set an HTTP-only cookie
    if user.role == "admin":
        response = JSONResponse(content={"access_token": token, "token_type": "bearer"})
        response.set_cookie(
            key="soip_admin_token",
            value=token,
            httponly=True,
            secure=not app_settings.debug,
            samesite="strict",
            path="/api",
            max_age=app_settings.jwt_expire_minutes * 60,
        )
        return response

    return TokenResponse(access_token=token)


@router.get("/magic-link", response_model=TokenResponse)
def magic_link_login(token: str = Query(...), db: Session = Depends(get_db)):
    """Validate a magic link token and return a JWT."""
    from app.services.magic_link import validate_and_consume_magic_link

    access_token = validate_and_consume_magic_link(db, token)
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired magic link",
        )

    return TokenResponse(access_token=access_token)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
