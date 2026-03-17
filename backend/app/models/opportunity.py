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
from app.utils.enums import OpportunityCategory, OpportunityStatus, OpportunityMode, FeeType

__all__ = ["Opportunity", "OpportunityCategory", "OpportunityStatus", "OpportunityMode", "FeeType"]


class Opportunity(Base):
    __tablename__ = "opportunities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    category = Column(
        ENUM(
            OpportunityCategory,
            name="opportunitycategory",
            create_type=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    domain_tags = Column(JSON, nullable=False, default=list)
    raw_domain_tags = Column(JSON, nullable=True)
    eligibility = Column(Text, nullable=True)
    benefits = Column(Text, nullable=True)
    deadline = Column(Date, nullable=True)
    deadline_at = Column(DateTime(timezone=True), nullable=True)
    application_link = Column(String(1000), unique=True, nullable=False)
    location = Column(String(500), nullable=False, server_default="")
    mode = Column(
        ENUM(
            OpportunityMode,
            name="opportunitymode",
            create_type=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        server_default="online",
    )
    state = Column(String(100), nullable=True)
    start_date = Column(Date, nullable=True)
    fee_type = Column(
        ENUM(
            FeeType,
            name="feetype",
            create_type=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=True,
    )
    organizer = Column(String(300), nullable=True)
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
    status = Column(
        ENUM(
            OpportunityStatus,
            name="opportunitystatus",
            create_type=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        server_default="open",
    )
    is_active = Column(Boolean, default=True)
    processing_error = Column(Text, nullable=True)
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
        Index("ix_opportunities_status", "status"),
        Index("ix_opportunities_mode", "mode"),
        Index("ix_opportunities_state", "state"),
        Index("ix_opportunities_start_date", "start_date"),
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
