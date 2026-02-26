"""add opportunity deadline_at

Revision ID: 3c4c7c2d9e8a
Revises: 9f2c1d5b7d21
Create Date: 2026-02-26 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "3c4c7c2d9e8a"
down_revision: Union[str, None] = "9f2c1d5b7d21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("opportunities", sa.Column("deadline_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_opportunities_deadline_at", "opportunities", ["deadline_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_opportunities_deadline_at", table_name="opportunities")
    op.drop_column("opportunities", "deadline_at")
