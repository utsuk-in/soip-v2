import uuid

from sqlalchemy import Column, String, Boolean, DateTime, JSON, func
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


class Source(Base):
    __tablename__ = "sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    base_url = Column(String(500), nullable=False, unique=True)
    scraper_type = Column(String(50), nullable=False)
    is_enabled = Column(Boolean, default=True)
    config = Column(JSON, default=dict)
    last_scraped_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
