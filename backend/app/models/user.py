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
    degree_type = Column(String(50), nullable=True)
    skills = Column(JSON, default=list)
    interests = Column(JSON, default=list)
    aspirations = Column(JSON, default=list)

    is_onboarded = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
