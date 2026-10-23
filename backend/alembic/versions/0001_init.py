"""events, orders, participants + демо-событие

Revision ID: 0001
Revises:
"""
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "events",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("venue", sa.String(200), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("capacity", sa.Integer, nullable=False),
        sa.Column("sold", sa.Integer, nullable=False, server_default="0"),
        sa.CheckConstraint("sold >= 0 AND sold <= capacity", name="ck_events_sold_range"),
    )
    op.create_table(
        "orders",
        sa.Column("id", sa.Uuid, primary_key=True),
        sa.Column("event_id", sa.Integer, sa.ForeignKey("events.id"), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("total_rub", sa.Integer, nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("idempotency_key", sa.String(100), unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "participants",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("order_id", sa.Uuid, sa.ForeignKey("orders.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("position", sa.Integer, nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("age", sa.Integer, nullable=False),
        sa.Column("ticket_type", sa.String(10), nullable=False),
        sa.Column("price_rub", sa.Integer, nullable=False),
    )
    op.execute(
        "INSERT INTO events (id, title, venue, starts_at, capacity) VALUES "
        "(1, 'Вечер в обсерватории: Сатурн', 'Городская обсерватория, ул. Звёздная, 12', "
        "'2026-11-14 19:00:00+03', 12)"
    )


def downgrade() -> None:
    op.drop_table("participants")
    op.drop_table("orders")
    op.drop_table("events")
