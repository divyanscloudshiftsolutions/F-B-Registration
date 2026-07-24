"""Overtime approval workflow — payroll consumes approved minutes only."""

from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.models import (
    AttendanceDailySummary,
    OvertimeApproval,
    OvertimeApprovalStatus,
    User,
)
from app.services.day_status_engine import DayStatusEngine


class OvertimeService:
    def __init__(self, db: Session):
        self.db = db

    def sync_month(self, month: int, year: int) -> dict:
        """Create/update pending OT rows from day status overtime_minutes."""
        engine = DayStatusEngine(self.db)
        engine.regenerate_month(month, year)
        start = date(year, month, 1)
        end = date(year, month, monthrange(year, month)[1])
        rows = (
            self.db.query(AttendanceDailySummary)
            .filter(
                AttendanceDailySummary.work_date >= start,
                AttendanceDailySummary.work_date <= end,
                AttendanceDailySummary.overtime_minutes > 0,
            )
            .all()
        )
        created = 0
        updated = 0
        for r in rows:
            existing = (
                self.db.query(OvertimeApproval)
                .filter(
                    OvertimeApproval.user_id == r.user_id,
                    OvertimeApproval.work_date == r.work_date,
                )
                .first()
            )
            if existing:
                if existing.status == OvertimeApprovalStatus.pending:
                    existing.calculated_minutes = r.overtime_minutes
                    updated += 1
                continue
            self.db.add(
                OvertimeApproval(
                    id=uuid4(),
                    user_id=r.user_id,
                    work_date=r.work_date,
                    calculated_minutes=r.overtime_minutes,
                    approved_minutes=0,
                    status=OvertimeApprovalStatus.pending,
                )
            )
            created += 1
        self.db.commit()
        return {"created": created, "updated": updated, "month": month, "year": year}

    def list_month(self, month: int, year: int, status: str | None = None) -> list[dict]:
        start = date(year, month, 1)
        end = date(year, month, monthrange(year, month)[1])
        q = self.db.query(OvertimeApproval).filter(
            OvertimeApproval.work_date >= start, OvertimeApproval.work_date <= end
        )
        if status:
            q = q.filter(OvertimeApproval.status == OvertimeApprovalStatus(status))
        items = q.order_by(OvertimeApproval.work_date.desc()).all()
        user_ids = {i.user_id for i in items}
        users = {
            u.id: u
            for u in self.db.query(User).filter(User.id.in_(user_ids)).all()
        } if user_ids else {}
        return [self._to_dict(i, users.get(i.user_id)) for i in items]

    def review(
        self,
        approval_id: UUID,
        *,
        approved: bool,
        approved_minutes: int | None,
        admin_id: UUID,
        notes: str | None = None,
    ) -> dict:
        row = self.db.query(OvertimeApproval).filter(OvertimeApproval.id == approval_id).first()
        if not row:
            raise ValueError("OT approval not found")
        if approved:
            mins = approved_minutes if approved_minutes is not None else row.calculated_minutes
            row.approved_minutes = max(0, int(mins))
            row.status = OvertimeApprovalStatus.approved
        else:
            row.approved_minutes = 0
            row.status = OvertimeApprovalStatus.rejected
        row.notes = notes
        row.reviewed_by = admin_id
        row.reviewed_at = datetime.now(timezone.utc)
        self.db.commit()
        user = self.db.query(User).filter(User.id == row.user_id).first()
        return self._to_dict(row, user)

    def approved_minutes_for_month(self, user_id: UUID, month: int, year: int) -> int:
        start = date(year, month, 1)
        end = date(year, month, monthrange(year, month)[1])
        rows = (
            self.db.query(OvertimeApproval)
            .filter(
                OvertimeApproval.user_id == user_id,
                OvertimeApproval.work_date >= start,
                OvertimeApproval.work_date <= end,
                OvertimeApproval.status == OvertimeApprovalStatus.approved,
            )
            .all()
        )
        return sum(r.approved_minutes or 0 for r in rows)

    def _to_dict(self, row: OvertimeApproval, user: User | None) -> dict:
        return {
            "id": str(row.id),
            "userId": str(row.user_id),
            "userName": user.user_name if user else None,
            "employeeCode": user.employee_code if user else None,
            "workDate": row.work_date.isoformat(),
            "calculatedMinutes": row.calculated_minutes,
            "approvedMinutes": row.approved_minutes,
            "calculatedHours": round((row.calculated_minutes or 0) / 60, 2),
            "approvedHours": round((row.approved_minutes or 0) / 60, 2),
            "status": row.status.value,
            "notes": row.notes,
            "reviewedAt": row.reviewed_at.isoformat() if row.reviewed_at else None,
        }
