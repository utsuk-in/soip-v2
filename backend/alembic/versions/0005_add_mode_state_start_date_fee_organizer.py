"""Add mode, state, start_date, fee_type, organizer columns to opportunities

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-13
"""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

CITY_TO_STATE = {
    "bengaluru": "Karnataka",
    "bangalore": "Karnataka",
    "mumbai": "Maharashtra",
    "pune": "Maharashtra",
    "nagpur": "Maharashtra",
    "hyderabad": "Telangana",
    "chennai": "Tamil Nadu",
    "coimbatore": "Tamil Nadu",
    "kolkata": "West Bengal",
    "ahmedabad": "Gujarat",
    "surat": "Gujarat",
    "jaipur": "Rajasthan",
    "jodhpur": "Rajasthan",
    "lucknow": "Uttar Pradesh",
    "noida": "Uttar Pradesh",
    "varanasi": "Uttar Pradesh",
    "chandigarh": "Punjab",
    "bhopal": "Madhya Pradesh",
    "indore": "Madhya Pradesh",
    "thiruvananthapuram": "Kerala",
    "kochi": "Kerala",
    "bhubaneswar": "Odisha",
    "patna": "Bihar",
    "ranchi": "Jharkhand",
    "new delhi": "Delhi",
    "delhi": "Delhi",
    "gurgaon": "Haryana",
    "gurugram": "Haryana",
    "guwahati": "Assam",
    "visakhapatnam": "Andhra Pradesh",
    "vijayawada": "Andhra Pradesh",
    "dehradun": "Uttarakhand",
    "shimla": "Himachal Pradesh",
    "gangtok": "Sikkim",
    "panaji": "Goa",
    "raipur": "Chhattisgarh",
}

INDIAN_STATES = [
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
    "Delhi",
    "Jammu and Kashmir",
    "Ladakh",
    "Chandigarh",
    "Puducherry",
]


def upgrade() -> None:
    op.execute("CREATE TYPE opportunitymode AS ENUM ('online', 'offline', 'hybrid')")
    op.execute("CREATE TYPE feetype AS ENUM ('free', 'paid')")

    op.add_column(
        "opportunities",
        sa.Column(
            "mode",
            sa.Enum(
                "online", "offline", "hybrid", name="opportunitymode", create_type=False
            ),
            nullable=True,
            server_default="online",
        ),
    )
    op.add_column("opportunities", sa.Column("state", sa.String(100), nullable=True))
    op.add_column("opportunities", sa.Column("start_date", sa.Date(), nullable=True))
    op.add_column(
        "opportunities",
        sa.Column(
            "fee_type",
            sa.Enum("free", "paid", name="feetype", create_type=False),
            nullable=True,
        ),
    )
    op.add_column(
        "opportunities", sa.Column("organizer", sa.String(300), nullable=True)
    )

    conn = op.get_bind()

    conn.execute(sa.text("UPDATE opportunities SET mode = 'online' WHERE mode IS NULL"))

    conn.execute(
        sa.text("""
        UPDATE opportunities SET mode = 'hybrid'
        WHERE domain_tags::jsonb ? 'online' AND domain_tags::jsonb ? 'offline'
    """)
    )

    conn.execute(
        sa.text("""
        UPDATE opportunities SET mode = 'offline'
        WHERE mode = 'online'
        AND length(location) > 0
        AND lower(location) NOT IN ('online', '', 'virtual', 'remote')
        AND lower(location) NOT LIKE '%online%'
        AND lower(location) NOT LIKE '%virtual%'
        AND lower(location) NOT LIKE '%remote%'
    """)
    )

    conn.execute(
        sa.text("""
        UPDATE opportunities SET mode = 'hybrid'
        WHERE mode = 'offline'
        AND domain_tags::jsonb ? 'online'
    """)
    )

    for city, state in CITY_TO_STATE.items():
        conn.execute(
            sa.text(
                "UPDATE opportunities SET state = :state WHERE state IS NULL AND lower(location) LIKE :pattern"
            ),
            {"state": state, "pattern": f"%{city}%"},
        )

    for state_name in INDIAN_STATES:
        conn.execute(
            sa.text(
                "UPDATE opportunities SET state = :state WHERE state IS NULL AND lower(location) LIKE :pattern"
            ),
            {"state": state_name, "pattern": f"%{state_name.lower()}%"},
        )

    conn.execute(
        sa.text("""
        UPDATE opportunities
        SET domain_tags = (
            SELECT COALESCE(jsonb_agg(tag), '["general"]'::jsonb)
            FROM jsonb_array_elements_text(domain_tags::jsonb) AS tag
            WHERE lower(tag::text) NOT IN ('online', 'offline')
        )
        WHERE domain_tags::jsonb ? 'online' OR domain_tags::jsonb ? 'offline'
    """)
    )

    conn.execute(
        sa.text("""
        UPDATE opportunities
        SET domain_tags = '["general"]'::json
        WHERE domain_tags IS NULL OR domain_tags::text IN ('null', '[]')
    """)
    )

    op.alter_column("opportunities", "mode", nullable=False, server_default="online")

    op.create_index("ix_opportunities_mode", "opportunities", ["mode"])
    op.create_index("ix_opportunities_state", "opportunities", ["state"])
    op.create_index("ix_opportunities_start_date", "opportunities", ["start_date"])


def downgrade() -> None:
    op.drop_index("ix_opportunities_start_date", table_name="opportunities")
    op.drop_index("ix_opportunities_state", table_name="opportunities")
    op.drop_index("ix_opportunities_mode", table_name="opportunities")
    op.drop_column("opportunities", "organizer")
    op.drop_column("opportunities", "fee_type")
    op.drop_column("opportunities", "start_date")
    op.drop_column("opportunities", "state")
    op.drop_column("opportunities", "mode")
    op.execute("DROP TYPE IF EXISTS feetype")
    op.execute("DROP TYPE IF EXISTS opportunitymode")
