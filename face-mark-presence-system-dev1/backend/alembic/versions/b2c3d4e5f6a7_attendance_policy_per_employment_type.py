"""attendance policy per employment type

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-02 14:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "attendance_policies",
        sa.Column("employment_type_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_attendance_policies_employment_type_id",
        "attendance_policies",
        "employment_types",
        ["employment_type_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_unique_constraint(
        "uq_attendance_policies_employment_type_id",
        "attendance_policies",
        ["employment_type_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_attendance_policies_employment_type_id", "attendance_policies", type_="unique")
    op.drop_constraint("fk_attendance_policies_employment_type_id", "attendance_policies", type_="foreignkey")
    op.drop_column("attendance_policies", "employment_type_id")
