"""admin configurable settings

Revision ID: a1b2c3d4e5f6
Revises: 6368bc812453
Create Date: 2026-07-02 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "6368bc812453"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("departments", sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False))

    op.create_table(
        "employment_types",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("code", sa.String(length=20), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )

    op.create_table(
        "document_types",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("key", sa.String(length=50), nullable=False),
        sa.Column("label", sa.String(length=100), nullable=False),
        sa.Column("is_required", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )

    op.create_table(
        "attendance_policies",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("shift_start_time", sa.String(length=5), nullable=False),
        sa.Column("shift_end_time", sa.String(length=5), nullable=False),
        sa.Column("late_grace_minutes", sa.Integer(), nullable=False),
        sa.Column("half_day_hours", sa.Numeric(precision=4, scale=2), nullable=False),
        sa.Column("full_day_hours", sa.Numeric(precision=4, scale=2), nullable=False),
        sa.Column("overtime_after_hours", sa.Numeric(precision=4, scale=2), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.add_column("attendance", sa.Column("work_hours", sa.Numeric(precision=5, scale=2), nullable=True))
    op.add_column("attendance", sa.Column("day_status", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("attendance", "day_status")
    op.drop_column("attendance", "work_hours")
    op.drop_table("attendance_policies")
    op.drop_table("document_types")
    op.drop_table("employment_types")
    op.drop_column("departments", "is_active")
