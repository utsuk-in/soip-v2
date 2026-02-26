"""add opportunity lineage refs

Revision ID: 9f2c1d5b7d21
Revises: aa95312127c4
Create Date: 2026-02-25 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "9f2c1d5b7d21"
down_revision: Union[str, None] = "b7e2a1c3d456"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("opportunities", sa.Column("scrape_page_id", sa.UUID(), nullable=True))
    op.add_column("opportunities", sa.Column("content_chunk_id", sa.UUID(), nullable=True))

    op.create_index("ix_opportunities_scrape_page_id", "opportunities", ["scrape_page_id"], unique=False)
    op.create_index("ix_opportunities_content_chunk_id", "opportunities", ["content_chunk_id"], unique=False)

    op.create_foreign_key(
        "fk_opportunities_scrape_page_id",
        "opportunities",
        "scrape_pages",
        ["scrape_page_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_opportunities_content_chunk_id",
        "opportunities",
        "content_chunks",
        ["content_chunk_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_opportunities_content_chunk_id", "opportunities", type_="foreignkey")
    op.drop_constraint("fk_opportunities_scrape_page_id", "opportunities", type_="foreignkey")

    op.drop_index("ix_opportunities_content_chunk_id", table_name="opportunities")
    op.drop_index("ix_opportunities_scrape_page_id", table_name="opportunities")

    op.drop_column("opportunities", "content_chunk_id")
    op.drop_column("opportunities", "scrape_page_id")
