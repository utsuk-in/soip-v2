"""
Raw content storage — full data lineage from scrape to embedding.

scrape_pages: raw markdown per URL per scrape run (nothing discarded)
content_chunks: semantic chunks derived from raw pages, with embeddings
"""

import uuid

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    Index,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import Vector

from app.models.base import Base


class ScrapePage(Base):
    """Raw scraped content — one row per URL per scrape run."""

    __tablename__ = "scrape_pages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id = Column(
        UUID(as_uuid=True), ForeignKey("sources.id"), nullable=False, index=True
    )
    url = Column(String(1000), nullable=False)
    raw_content = Column(Text, nullable=False)
    content_hash = Column(String(64), nullable=False)
    content_length = Column(Integer, nullable=False)
    scraped_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_scrape_pages_source_url", "source_id", "url"),
        Index("ix_scrape_pages_content_hash", "content_hash"),
    )


class ContentChunk(Base):
    """Semantic chunks for embedding and retrieval.

    Each chunk traces back to the raw page it came from and (optionally)
    the opportunity it was matched to after extraction.
    """

    __tablename__ = "content_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scrape_page_id = Column(
        UUID(as_uuid=True),
        ForeignKey("scrape_pages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_id = Column(
        UUID(as_uuid=True), ForeignKey("sources.id"), nullable=False, index=True
    )
    opportunity_id = Column(
        UUID(as_uuid=True),
        ForeignKey("opportunities.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    token_estimate = Column(Integer, nullable=False)
    embedding = Column(Vector(1536), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index(
            "ix_content_chunks_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )
