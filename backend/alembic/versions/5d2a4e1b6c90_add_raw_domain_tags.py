"""add raw_domain_tags to opportunities

Revision ID: 5d2a4e1b6c90
Revises: 3c4c7c2d9e8a
Create Date: 2026-02-26 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "5d2a4e1b6c90"
down_revision: Union[str, None] = "3c4c7c2d9e8a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("opportunities", sa.Column("raw_domain_tags", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("opportunities", "raw_domain_tags")
