from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.university import University
from app.models.user import User
from app.schemas.user import ProfileUpdate, UniversityOut, UserOut
from app.utils.dependencies import get_current_user
from app.services.auth import hash_password
from app.services.taxonomy import merge_domains_with_raw
from app.routers.opportunities import invalidate_recommended_cache

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/profile", response_model=UserOut)
def get_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/profile", response_model=UserOut)
def update_profile(
    body: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    update_data = body.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    # Handle password separately — hash it and store, don't setattr directly
    new_password = update_data.pop("password", None)
    if new_password:
        current_user.password_hash = hash_password(new_password)

    for field, value in update_data.items():
        setattr(current_user, field, value)

    # Normalize skills + interests for consistent matching
    if current_user.skills is not None:
        current_user.skills = (
            merge_domains_with_raw(current_user.skills) or current_user.skills
        )
    if current_user.interests is not None:
        current_user.interests = (
            merge_domains_with_raw(current_user.interests) or current_user.interests
        )

    has_profile_fields = all(
        [
            current_user.first_name,
            current_user.academic_background,
            current_user.skills,
            current_user.interests,
            current_user.aspirations,
            current_user.year_of_study,
            current_user.state,
        ]
    )
    if has_profile_fields and not current_user.is_onboarded:
        current_user.is_onboarded = True

    db.commit()
    db.refresh(current_user)

    invalidate_recommended_cache(current_user.id)

    return current_user


@router.get("/universities", response_model=list[UniversityOut])
def list_universities(
    q: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(University).order_by(University.name)
    if q:
        query = query.filter(University.name.ilike(f"%{q}%"))
    return query.limit(100).all()
