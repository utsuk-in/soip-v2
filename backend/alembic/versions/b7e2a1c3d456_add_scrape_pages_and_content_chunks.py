"""add scrape_pages and content_chunks

Revision ID: b7e2a1c3d456
Revises: aa95312127c4
Create Date: 2026-02-24 14:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

revision: str = "b7e2a1c3d456"
down_revision: Union[str, None] = "aa95312127c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "scrape_pages",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("source_id", sa.UUID(), nullable=False),
        sa.Column("url", sa.String(length=1000), nullable=False),
        sa.Column("raw_content", sa.Text(), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("content_length", sa.Integer(), nullable=False),
        sa.Column(
            "scraped_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["source_id"], ["sources.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_scrape_pages_source_id", "scrape_pages", ["source_id"], unique=False
    )
    op.create_index(
        "ix_scrape_pages_source_url", "scrape_pages", ["source_id", "url"], unique=False
    )
    op.create_index(
        "ix_scrape_pages_content_hash", "scrape_pages", ["content_hash"], unique=False
    )

    op.create_table(
        "content_chunks",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("scrape_page_id", sa.UUID(), nullable=False),
        sa.Column("source_id", sa.UUID(), nullable=False),
        sa.Column("opportunity_id", sa.UUID(), nullable=True),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("token_estimate", sa.Integer(), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["scrape_page_id"], ["scrape_pages.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["source_id"], ["sources.id"]),
        sa.ForeignKeyConstraint(
            ["opportunity_id"], ["opportunities.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_content_chunks_scrape_page_id",
        "content_chunks",
        ["scrape_page_id"],
        unique=False,
    )
    op.create_index(
        "ix_content_chunks_source_id",
        "content_chunks",
        ["source_id"],
        unique=False,
    )
    op.create_index(
        "ix_content_chunks_opportunity_id",
        "content_chunks",
        ["opportunity_id"],
        unique=False,
    )
    op.create_index(
        "ix_content_chunks_embedding_hnsw",
        "content_chunks",
        ["embedding"],
        unique=False,
        postgresql_using="hnsw",
        postgresql_with={"m": 16, "ef_construction": 64},
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )


def downgrade() -> None:
    op.drop_index(
        "ix_content_chunks_embedding_hnsw",
        table_name="content_chunks",
        postgresql_using="hnsw",
        postgresql_with={"m": 16, "ef_construction": 64},
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )
    op.drop_index("ix_content_chunks_opportunity_id", table_name="content_chunks")
    op.drop_index("ix_content_chunks_source_id", table_name="content_chunks")
    op.drop_index("ix_content_chunks_scrape_page_id", table_name="content_chunks")
    op.drop_table("content_chunks")
    op.drop_index("ix_scrape_pages_content_hash", table_name="scrape_pages")
    op.drop_index("ix_scrape_pages_source_url", table_name="scrape_pages")
    op.drop_index("ix_scrape_pages_source_id", table_name="scrape_pages")
    op.drop_table("scrape_pages")
