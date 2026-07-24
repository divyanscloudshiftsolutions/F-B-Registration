"""Payroll runs, components, adjustments + extend payroll_records."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "payroll_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("salary_calc_basis", sa.String(30), nullable=False, server_default="fixed_30"),
        sa.Column("attendance_locked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("employee_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("gross_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("total_deductions", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("net_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("calculated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("calculated_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paid_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("payment_date", sa.Date(), nullable=True),
        sa.Column("payment_method", sa.String(50), nullable=True),
        sa.Column("payment_reference", sa.String(120), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("month", "year"),
    )

    op.add_column("payroll_records", sa.Column("payroll_run_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_payroll_records_run",
        "payroll_records",
        "payroll_runs",
        ["payroll_run_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_payroll_records_payroll_run_id", "payroll_records", ["payroll_run_id"])

    op.add_column("payroll_records", sa.Column("monthly_salary", sa.Numeric(12, 2), server_default="0"))
    op.add_column("payroll_records", sa.Column("calendar_days", sa.Integer(), server_default="0"))
    op.add_column("payroll_records", sa.Column("working_days", sa.Numeric(5, 1), server_default="0"))
    op.add_column("payroll_records", sa.Column("week_off_days", sa.Numeric(5, 1), server_default="0"))
    op.add_column("payroll_records", sa.Column("holiday_days", sa.Numeric(5, 1), server_default="0"))
    op.add_column("payroll_records", sa.Column("expected_hours", sa.Numeric(8, 2), server_default="0"))
    op.add_column("payroll_records", sa.Column("worked_hours", sa.Numeric(8, 2), server_default="0"))
    op.add_column("payroll_records", sa.Column("other_deductions", sa.Numeric(12, 2), server_default="0"))
    op.add_column("payroll_records", sa.Column("other_earnings", sa.Numeric(12, 2), server_default="0"))
    op.add_column("payroll_records", sa.Column("flags", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb")))

    # Widen attendance day columns from int to numeric
    op.alter_column(
        "payroll_records",
        "days_present",
        existing_type=sa.Integer(),
        type_=sa.Numeric(5, 1),
        postgresql_using="days_present::numeric",
    )
    op.alter_column(
        "payroll_records",
        "days_absent",
        existing_type=sa.Integer(),
        type_=sa.Numeric(5, 1),
        postgresql_using="days_absent::numeric",
    )
    op.alter_column(
        "payroll_records",
        "days_leave_paid",
        existing_type=sa.Integer(),
        type_=sa.Numeric(5, 1),
        postgresql_using="days_leave_paid::numeric",
    )
    op.alter_column(
        "payroll_records",
        "days_leave_unpaid",
        existing_type=sa.Integer(),
        type_=sa.Numeric(5, 1),
        postgresql_using="days_leave_unpaid::numeric",
    )
    op.alter_column(
        "payroll_records",
        "salary_structure_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
    )

    # Status was created as varchar(9) for "processed"; widen for new workflow values
    op.alter_column(
        "payroll_records",
        "status",
        existing_type=sa.String(9),
        type_=sa.String(30),
        existing_nullable=False,
        postgresql_using="status::varchar(30)",
    )

    op.execute("UPDATE payroll_records SET status = 'calculated' WHERE status = 'processed'")

    op.create_table(
        "payroll_components",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("payroll_record_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("payroll_records.id", ondelete="CASCADE"), nullable=False),
        sa.Column("component_type", sa.String(20), nullable=False),
        sa.Column("component_code", sa.String(40), nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("calculation_source", sa.String(40), nullable=False, server_default="system"),
    )
    op.create_index("ix_payroll_components_payroll_record_id", "payroll_components", ["payroll_record_id"])

    op.create_table(
        "payroll_adjustments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("payroll_record_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("payroll_records.id", ondelete="CASCADE"), nullable=False),
        sa.Column("component_type", sa.String(20), nullable=False),
        sa.Column("component_code", sa.String(40), nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_payroll_adjustments_payroll_record_id", "payroll_adjustments", ["payroll_record_id"])


def downgrade() -> None:
    op.drop_table("payroll_adjustments")
    op.drop_table("payroll_components")
    op.drop_column("payroll_records", "flags")
    op.drop_column("payroll_records", "other_earnings")
    op.drop_column("payroll_records", "other_deductions")
    op.drop_column("payroll_records", "worked_hours")
    op.drop_column("payroll_records", "expected_hours")
    op.drop_column("payroll_records", "holiday_days")
    op.drop_column("payroll_records", "week_off_days")
    op.drop_column("payroll_records", "working_days")
    op.drop_column("payroll_records", "calendar_days")
    op.drop_column("payroll_records", "monthly_salary")
    op.drop_constraint("fk_payroll_records_run", "payroll_records", type_="foreignkey")
    op.drop_index("ix_payroll_records_payroll_run_id", table_name="payroll_records")
    op.drop_column("payroll_records", "payroll_run_id")
    op.drop_table("payroll_runs")
