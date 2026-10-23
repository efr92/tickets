"""seat_holds: временная бронь мест

Revision ID: 0002
Revises: 0001
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "seat_holds",
        sa.Column("id", sa.Uuid, primary_key=True),
        sa.Column("event_id", sa.Integer, sa.ForeignKey("events.id"), nullable=False),
        sa.Column("seats", sa.Integer, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("seats > 0", name="ck_seat_holds_positive"),
    )
    op.create_index("ix_seat_holds_event_expires", "seat_holds", ["event_id", "expires_at"])


def downgrade() -> None:
    op.drop_index("ix_seat_holds_event_expires", table_name="seat_holds")
    op.drop_table("seat_holds")
