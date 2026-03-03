"""Rename opportunitycategory enum values from UPPERCASE to lowercase

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-03
"""

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

_RENAMES = [
    ("HACKATHON", "hackathon"),
    ("GRANT", "grant"),
    ("FELLOWSHIP", "fellowship"),
    ("INTERNSHIP", "internship"),
    ("COMPETITION", "competition"),
    ("SCHOLARSHIP", "scholarship"),
    ("PROGRAM", "program"),
    ("OTHER", "other"),
]


def upgrade() -> None:
    for old, new in _RENAMES:
        op.execute(f"ALTER TYPE opportunitycategory RENAME VALUE '{old}' TO '{new}'")


def downgrade() -> None:
    for old, new in _RENAMES:
        op.execute(f"ALTER TYPE opportunitycategory RENAME VALUE '{new}' TO '{old}'")
