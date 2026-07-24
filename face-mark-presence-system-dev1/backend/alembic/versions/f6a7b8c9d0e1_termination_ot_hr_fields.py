"""Employee HR fields + overtime approvals."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "f6a7b8c9d0e1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("designation", sa.String(100), nullable=True))
    op.add_column("users", sa.Column("termination_date", sa.Date(), nullable=True))
    op.add_column("users", sa.Column("uan_number", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("esi_number", sa.String(20), nullable=True))

    op.create_table(
        "overtime_approvals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column("calculated_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("approved_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("user_id", "work_date", name="uq_ot_approval_user_date"),
    )
    op.create_index("ix_overtime_approvals_user_id", "overtime_approvals", ["user_id"])
    op.create_index("ix_overtime_approvals_work_date", "overtime_approvals", ["work_date"])


def downgrade() -> None:
    op.drop_table("overtime_approvals")
    op.drop_column("users", "esi_number")
    op.drop_column("users", "uan_number")
    op.drop_column("users", "termination_date")
    op.drop_column("users", "designation")
