from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    first_name: str | None = None
    academic_background: str | None = None
    year_of_study: str | None = None
    state: str | None = None
    skills: list[str] = []
    interests: list[str] = []
    aspirations: list[str] = []
    university_id: UUID | None = None
    is_onboarded: bool = False
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    """Onboarding + profile edit payload."""
    first_name: str | None = None
    academic_background: str | None = None
    year_of_study: str | None = None
    state: str | None = None
    skills: list[str] | None = None
    interests: list[str] | None = None
    aspirations: list[str] | None = None
    university_id: UUID | None = None


class UniversityOut(BaseModel):
    id: UUID
    name: str
    city: str | None = None
    state: str | None = None
    country: str = "India"
    website: str | None = None

    model_config = {"from_attributes": True}
