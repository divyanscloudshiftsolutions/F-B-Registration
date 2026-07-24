"""Leave holiday weekoff daily summary engine

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-07-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("leave_types", sa.Column("allow_half_day", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("leave_types", sa.Column("requires_approval", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("leave_types", sa.Column("max_consecutive_days", sa.Integer(), nullable=True))
    op.add_column("leave_types", sa.Column("document_after_days", sa.Integer(), nullable=True))
    op.add_column("leave_types", sa.Column("is_comp_off", sa.Boolean(), nullable=False, server_default=sa.text("false")))

    op.add_column(
        "leave_requests",
        sa.Column("duration", sa.String(20), nullable=False, server_default="full_day"),
    )
    op.add_column("leave_requests", sa.Column("attachment_url", sa.Text(), nullable=True))

    op.create_table(
        "weekoff_policies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("code", sa.String(30), nullable=False),
        sa.Column("policy_type", sa.String(20), nullable=False, server_default="fixed"),
        sa.Column("week_off_days", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("is_paid", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("work_compensation", sa.String(20), nullable=False, server_default="comp_off"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("code"),
    )

    op.add_column(
        "users",
        sa.Column("weekoff_policy_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("weekoff_policies.id", ondelete="SET NULL"), nullable=True),
    )

    op.create_table(
        "holidays",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("holiday_date", sa.Date(), nullable=False),
        sa.Column("holiday_type", sa.String(20), nullable=False, server_default="public"),
        sa.Column("applies_to", sa.String(30), nullable=False, server_default="all"),
        sa.Column("department_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("departments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("employment_type", sa.String(50), nullable=True),
        sa.Column("is_paid", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("work_compensation", sa.String(20), nullable=False, server_default="comp_off"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_holidays_holiday_date", "holidays", ["holiday_date"])

    op.create_table(
        "comp_off_balances",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("earned_date", sa.Date(), nullable=False),
        sa.Column("expiry_date", sa.Date(), nullable=False),
        sa.Column("days", sa.Numeric(4, 1), nullable=False, server_default="1"),
        sa.Column("source", sa.String(40), nullable=False, server_default="worked_week_off"),
        sa.Column("status", sa.String(20), nullable=False, server_default="available"),
        sa.Column("used_leave_request_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leave_requests.id"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_comp_off_balances_user_id", "comp_off_balances", ["user_id"])

    op.create_table(
        "attendance_daily_summaries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column("is_working_day", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("attendance_status", sa.String(40), nullable=False),
        sa.Column("expected_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("worked_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("overtime_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("present_fraction", sa.Numeric(3, 2), nullable=False, server_default="0"),
        sa.Column("paid_leave_fraction", sa.Numeric(3, 2), nullable=False, server_default="0"),
        sa.Column("unpaid_leave_fraction", sa.Numeric(3, 2), nullable=False, server_default="0"),
        sa.Column("payable_day_fraction", sa.Numeric(3, 2), nullable=False, server_default="0"),
        sa.Column("lop_day_fraction", sa.Numeric(3, 2), nullable=False, server_default="0"),
        sa.Column("is_holiday", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("holiday_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("holidays.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_week_off", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("leave_request_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leave_requests.id", ondelete="SET NULL"), nullable=True),
        sa.Column("leave_type_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leave_types.id", ondelete="SET NULL"), nullable=True),
        sa.Column("check_in_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("check_out_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("calculation_version", sa.String(20), nullable=False, server_default="v1"),
        sa.Column("calculated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("user_id", "work_date", name="uq_daily_summary_user_date"),
    )
    op.create_index("ix_attendance_daily_summaries_user_id", "attendance_daily_summaries", ["user_id"])
    op.create_index("ix_attendance_daily_summaries_work_date", "attendance_daily_summaries", ["work_date"])

    # Seed default week-off policy (Sat+Sun) and Comp-Off leave type
    op.execute(
        """
        INSERT INTO weekoff_policies (id, name, code, policy_type, week_off_days, is_paid, work_compensation, is_active, is_default)
        VALUES (gen_random_uuid(), 'Standard Office', 'STANDARD', 'fixed', '[5, 6]'::jsonb, true, 'comp_off', true, true)
        """
    )
    op.execute(
        """
        INSERT INTO leave_types (id, name, code, max_days_per_year, is_paid, carry_forward, is_active, allow_half_day, requires_approval, is_comp_off)
        SELECT gen_random_uuid(), 'Comp-Off', 'CO', 0, true, false, true, true, true, true
        WHERE NOT EXISTS (SELECT 1 FROM leave_types WHERE code = 'CO')
        """
    )


def downgrade() -> None:
    op.drop_index("ix_attendance_daily_summaries_work_date", table_name="attendance_daily_summaries")
    op.drop_index("ix_attendance_daily_summaries_user_id", table_name="attendance_daily_summaries")
    op.drop_table("attendance_daily_summaries")
    op.drop_index("ix_comp_off_balances_user_id", table_name="comp_off_balances")
    op.drop_table("comp_off_balances")
    op.drop_index("ix_holidays_holiday_date", table_name="holidays")
    op.drop_table("holidays")
    op.drop_column("users", "weekoff_policy_id")
    op.drop_table("weekoff_policies")
    op.drop_column("leave_requests", "attachment_url")
    op.drop_column("leave_requests", "duration")
    op.drop_column("leave_types", "is_comp_off")
    op.drop_column("leave_types", "document_after_days")
    op.drop_column("leave_types", "max_consecutive_days")
    op.drop_column("leave_types", "requires_approval")
    op.drop_column("leave_types", "allow_half_day")
