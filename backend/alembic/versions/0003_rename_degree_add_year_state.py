"""Rename degree_type to academic_background, add year_of_study and state columns

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-03
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "degree_type",
        new_column_name="academic_background",
        type_=sa.String(255),
        existing_type=sa.String(50),
        existing_nullable=True,
    )
    op.add_column("users", sa.Column("year_of_study", sa.String(50), nullable=True))
    op.add_column("users", sa.Column("state", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "state")
    op.drop_column("users", "year_of_study")
    op.alter_column(
        "users",
        "academic_background",
        new_column_name="degree_type",
        type_=sa.String(50),
        existing_type=sa.String(255),
        existing_nullable=True,
    )
