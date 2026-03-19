"""Admin foundation: role, invite fields, magic_link_tokens, interaction_logs

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-06
"""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- users table additions ---
    op.add_column(
        "users",
        sa.Column("role", sa.String(20), server_default="student", nullable=False),
    )
    op.add_column(
        "users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column("users", sa.Column("department", sa.String(200), nullable=True))
    op.add_column("users", sa.Column("roll_number", sa.String(100), nullable=True))
    op.add_column("users", sa.Column("invited_by_id", sa.UUID(), nullable=True))
    op.add_column(
        "users", sa.Column("invited_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_foreign_key(
        "fk_users_invited_by", "users", "users", ["invited_by_id"], ["id"]
    )

    # --- magic_link_tokens ---
    op.create_table(
        "magic_link_tokens",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "user_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )

    # --- interaction_logs ---
    op.create_table(
        "interaction_logs",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "user_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "opportunity_id",
            sa.UUID(),
            sa.ForeignKey("opportunities.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column("metadata_", sa.JSON(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )
    op.create_index("ix_interaction_logs_user_id", "interaction_logs", ["user_id"])
    op.create_index(
        "ix_interaction_logs_created_at", "interaction_logs", ["created_at"]
    )


def downgrade() -> None:
    op.drop_table("interaction_logs")
    op.drop_table("magic_link_tokens")
    op.drop_constraint("fk_users_invited_by", "users", type_="foreignkey")
    op.drop_column("users", "invited_at")
    op.drop_column("users", "invited_by_id")
    op.drop_column("users", "roll_number")
    op.drop_column("users", "department")
    op.drop_column("users", "last_login_at")
    op.drop_column("users", "role")
