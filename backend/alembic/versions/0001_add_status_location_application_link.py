"""Add status, location, processing_error columns; rename url to application_link

Revision ID: 0001
Revises:
Create Date: 2026-03-02
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "0001"
down_revision = "5d2a4e1b6c90"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create the new ENUM type for opportunity status
    opportunitystatus = postgresql.ENUM(
        "open",
        "coming_soon",
        "expired",
        name="opportunitystatus",
    )
    opportunitystatus.create(op.get_bind(), checkfirst=True)

    # 2. Rename url → application_link
    op.alter_column("opportunities", "url", new_column_name="application_link")

    # 3. Add status column (NOT NULL, default 'open' for existing rows)
    op.add_column(
        "opportunities",
        sa.Column(
            "status",
            sa.Enum("open", "coming_soon", "expired", name="opportunitystatus"),
            nullable=False,
            server_default="open",
        ),
    )

    # 4. Add location column (NOT NULL, default '' for existing rows)
    op.add_column(
        "opportunities",
        sa.Column("location", sa.String(500), nullable=False, server_default=""),
    )

    # 5. Add processing_error column (nullable)
    op.add_column(
        "opportunities",
        sa.Column("processing_error", sa.Text(), nullable=True),
    )

    # 6. Add index on status
    op.create_index("ix_opportunities_status", "opportunities", ["status"])

    # 7. Backfill status from is_active for existing rows
    op.execute("UPDATE opportunities SET status = 'expired' WHERE is_active = false")
    op.execute("UPDATE opportunities SET status = 'open' WHERE is_active = true")


def downgrade() -> None:
    op.drop_index("ix_opportunities_status", table_name="opportunities")
    op.drop_column("opportunities", "processing_error")
    op.drop_column("opportunities", "location")
    op.drop_column("opportunities", "status")
    op.alter_column("opportunities", "application_link", new_column_name="url")

    sa.Enum(name="opportunitystatus").drop(op.get_bind(), checkfirst=True)
