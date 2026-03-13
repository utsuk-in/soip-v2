import uuid

from sqlalchemy import Column, String, Boolean, DateTime, JSON, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    university_id = Column(
        UUID(as_uuid=True), ForeignKey("universities.id"), nullable=True
    )

    first_name = Column(String(100), nullable=True)
    academic_background = Column(String(255), nullable=True)
    year_of_study = Column(String(50), nullable=True)
    state = Column(String(100), nullable=True)
    skills = Column(JSON, default=list)
    interests = Column(JSON, default=list)
    aspirations = Column(JSON, default=list)

    role = Column(String(20), nullable=False, server_default="student")
    department = Column(String(200), nullable=True)
    roll_number = Column(String(100), nullable=True)
    invited_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    invited_at = Column(DateTime(timezone=True), nullable=True)

    is_onboarded = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
