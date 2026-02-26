import enum
import uuid

from sqlalchemy import (
    Column,
    String,
    Text,
    Boolean,
    Float,
    Date,
    DateTime,
    JSON,
    ForeignKey,
    Index,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID, ENUM
from pgvector.sqlalchemy import Vector

from app.models.base import Base


class OpportunityCategory(str, enum.Enum):
    HACKATHON = "hackathon"
    GRANT = "grant"
    FELLOWSHIP = "fellowship"
    INTERNSHIP = "internship"
    COMPETITION = "competition"
    SCHOLARSHIP = "scholarship"
    PROGRAM = "program"
    OTHER = "other"


class Opportunity(Base):
    __tablename__ = "opportunities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    category = Column(
        ENUM(OpportunityCategory, name="opportunitycategory", create_type=False),
        nullable=False,
    )
    domain_tags = Column(JSON, nullable=False, default=list)
    raw_domain_tags = Column(JSON, nullable=True)
    eligibility = Column(Text, nullable=True)
    benefits = Column(Text, nullable=True)
    deadline = Column(Date, nullable=True)
    deadline_at = Column(DateTime(timezone=True), nullable=True)
    url = Column(String(1000), unique=True, nullable=False)
    source_id = Column(
        UUID(as_uuid=True), ForeignKey("sources.id"), nullable=True
    )
    scrape_page_id = Column(
        UUID(as_uuid=True), ForeignKey("scrape_pages.id"), nullable=True, index=True
    )
    content_chunk_id = Column(
        UUID(as_uuid=True), ForeignKey("content_chunks.id"), nullable=True, index=True
    )
    source_url = Column(String(1000), nullable=False)
    confidence = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True)
    scraped_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    embedding = Column(Vector(1536), nullable=True)

    __table_args__ = (
        Index("ix_opportunities_category", "category"),
        Index("ix_opportunities_deadline", "deadline"),
        Index("ix_opportunities_is_active", "is_active"),
        Index(
            "ix_opportunities_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
        Index(
            "ix_opportunities_fts",
            text(
                "to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))"
            ),
            postgresql_using="gin",
        ),
    )
