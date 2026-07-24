"""Add weekly shift roster tables

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "shift_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("code", sa.String(30), nullable=False),
        sa.Column("start_time", sa.String(5), nullable=False, server_default="09:00"),
        sa.Column("end_time", sa.String(5), nullable=False, server_default="18:00"),
        sa.Column("color", sa.String(20), nullable=False, server_default="#3b82f6"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("code"),
    )

    op.create_table(
        "weekly_rosters",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("week_end", sa.Date(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("week_start", name="uq_weekly_rosters_week_start"),
    )
    op.create_index("ix_weekly_rosters_week_start", "weekly_rosters", ["week_start"])

    op.create_table(
        "roster_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "roster_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("weekly_rosters.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column(
            "shift_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("shift_templates.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("is_week_off", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("roster_id", "user_id", "work_date", name="uq_roster_user_date"),
    )
    op.create_index("ix_roster_assignments_roster_id", "roster_assignments", ["roster_id"])
    op.create_index("ix_roster_assignments_user_id", "roster_assignments", ["user_id"])
    op.create_index("ix_roster_assignments_work_date", "roster_assignments", ["work_date"])

    # Seed default shifts
    op.execute(
        """
        INSERT INTO shift_templates (id, name, code, start_time, end_time, color, is_active, sort_order)
        VALUES
          (gen_random_uuid(), 'Morning', 'MORNING', '06:00', '14:00', '#0ea5e9', true, 1),
          (gen_random_uuid(), 'General', 'GENERAL', '09:00', '18:00', '#3b82f6', true, 2),
          (gen_random_uuid(), 'Evening', 'EVENING', '14:00', '22:00', '#8b5cf6', true, 3),
          (gen_random_uuid(), 'Night', 'NIGHT', '22:00', '06:00', '#1e293b', true, 4)
        """
    )


def downgrade() -> None:
    op.drop_index("ix_roster_assignments_work_date", table_name="roster_assignments")
    op.drop_index("ix_roster_assignments_user_id", table_name="roster_assignments")
    op.drop_index("ix_roster_assignments_roster_id", table_name="roster_assignments")
    op.drop_table("roster_assignments")
    op.drop_index("ix_weekly_rosters_week_start", table_name="weekly_rosters")
    op.drop_table("weekly_rosters")
    op.drop_table("shift_templates")
