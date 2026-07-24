from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.models import (
    Attendance,
    AttendanceType,
    LeaveBalance,
    LeaveDuration,
    LeaveRequest,
    LeaveStatus,
    LeaveType,
    RecordStatus,
    User,
)
from app.services.day_status_engine import DayStatusEngine
from app.services.payroll_service import assert_attendance_month_writable
from app.timeutil import local_day_bounds_utc, local_today, to_local_date


class LeaveService:
    def __init__(self, db: Session):
        self.db = db

    def _assert_date_range_writable(self, start: date, end: date) -> None:
        """Reject leave mutations that would alter ADS in a payroll-locked month."""
        checked_months: set[tuple[int, int]] = set()
        d = start
        while d <= end:
            key = (d.year, d.month)
            if key not in checked_months:
                assert_attendance_month_writable(self.db, d)
                checked_months.add(key)
            d += timedelta(days=1)

    def list_types(self, include_inactive: bool = False) -> list[LeaveType]:
        q = self.db.query(LeaveType)
        if not include_inactive:
            q = q.filter(LeaveType.is_active.is_(True))
        return q.order_by(LeaveType.name).all()

    def upsert_type(self, data: dict, type_id: UUID | None = None) -> LeaveType:
        if type_id:
            leave_type = self.db.query(LeaveType).filter(LeaveType.id == type_id).first()
            if not leave_type:
                raise ValueError("Leave type not found")
        else:
            code = data["code"].strip().upper()
            if self.db.query(LeaveType).filter(LeaveType.code == code).first():
                raise ValueError(f"Leave code '{code}' already exists")
            leave_type = LeaveType(code=code)
            self.db.add(leave_type)

        leave_type.name = data.get("name", leave_type.name if type_id else data["name"])
        if "code" in data and data["code"] and type_id:
            leave_type.code = data["code"].strip().upper()
        for field in (
            "max_days_per_year",
            "is_paid",
            "carry_forward",
            "is_active",
            "allow_half_day",
            "requires_approval",
            "max_consecutive_days",
            "document_after_days",
            "is_comp_off",
        ):
            if field in data and data[field] is not None:
                setattr(leave_type, field, data[field])
        self.db.commit()
        self.db.refresh(leave_type)
        return leave_type

    def get_balances(self, user_id: UUID, year: int | None = None) -> list[LeaveBalance]:
        year = year or local_today().year
        self.ensure_balances_for_user_id(user_id, year)
        return (
            self.db.query(LeaveBalance)
            .options(joinedload(LeaveBalance.leave_type))
            .filter(LeaveBalance.user_id == user_id, LeaveBalance.year == year)
            .all()
        )

    def _count_leave_days(
        self,
        user_id: UUID,
        start: date,
        end: date,
        duration: LeaveDuration,
    ) -> Decimal:
        """Count leave days excluding holidays and week-offs (sandwich OFF by default)."""
        if duration in (LeaveDuration.first_half, LeaveDuration.second_half):
            if start != end:
                raise ValueError("Half-day leave must be a single date")
            return Decimal("0.5")

        engine = DayStatusEngine(self.db)
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError("User not found")

        days = Decimal("0")
        d = start
        while d <= end:
            if engine._find_holiday(user, d) or engine._is_week_off(user, d):
                d += timedelta(days=1)
                continue
            days += Decimal("1")
            d += timedelta(days=1)
        return days

    def apply_leave(self, user_id: UUID, data: dict) -> LeaveRequest:
        leave_type = self.db.query(LeaveType).filter(LeaveType.id == data["leave_type_id"]).first()
        if not leave_type or not leave_type.is_active:
            raise ValueError("Invalid leave type")

        start = data["start_date"] if isinstance(data["start_date"], date) else date.fromisoformat(str(data["start_date"]))
        end = data["end_date"] if isinstance(data["end_date"], date) else date.fromisoformat(str(data["end_date"]))
        if end < start:
            raise ValueError("End date cannot be before start date")

        duration_raw = data.get("duration") or LeaveDuration.full_day.value
        duration = LeaveDuration(duration_raw) if not isinstance(duration_raw, LeaveDuration) else duration_raw
        if duration != LeaveDuration.full_day and not leave_type.allow_half_day:
            raise ValueError("Half-day not allowed for this leave type")

        total_days = self._count_leave_days(user_id, start, end, duration)
        if total_days <= 0:
            raise ValueError("No leave days to deduct (all dates are holiday/week-off)")

        if leave_type.document_after_days and total_days >= leave_type.document_after_days:
            if not data.get("attachment_url"):
                raise ValueError(
                    f"Attachment required for leaves of {leave_type.document_after_days}+ days"
                )

        if leave_type.is_comp_off:
            available_co = self._available_comp_off_days(user_id)
            if total_days > available_co:
                raise ValueError(f"Insufficient comp-off balance. Available: {available_co}")

        if leave_type.max_consecutive_days and duration == LeaveDuration.full_day:
            span = (end - start).days + 1
            if span > leave_type.max_consecutive_days:
                raise ValueError(f"Maximum consecutive days allowed: {leave_type.max_consecutive_days}")

        year = start.year
        self.ensure_balances_for_user_id(user_id, year)
        balance = (
            self.db.query(LeaveBalance)
            .filter(
                LeaveBalance.user_id == user_id,
                LeaveBalance.leave_type_id == leave_type.id,
                LeaveBalance.year == year,
            )
            .first()
        )
        if balance and not leave_type.is_comp_off:
            available = (balance.total_days or Decimal("0")) - (balance.used_days or Decimal("0")) - (balance.pending_days or Decimal("0"))
            if total_days > available and leave_type.is_paid:
                raise ValueError(f"Insufficient leave balance. Available: {available}")

        # Conflict: attendance already present
        conflicts = self._attendance_conflicts(user_id, start, end)
        request = LeaveRequest(
            user_id=user_id,
            leave_type_id=leave_type.id,
            start_date=start,
            end_date=end,
            total_days=total_days,
            duration=duration,
            reason=data["reason"],
            attachment_url=data.get("attachment_url"),
            status=LeaveStatus.pending,
        )
        self.db.add(request)
        if balance:
            balance.pending_days = (balance.pending_days or Decimal("0")) + total_days
        self.db.commit()
        self.db.refresh(request)
        request._attendance_conflicts = conflicts  # type: ignore[attr-defined]
        return request

    def _attendance_conflicts(self, user_id: UUID, start: date, end: date) -> list[str]:
        start_dt, _ = local_day_bounds_utc(start)
        _, end_dt = local_day_bounds_utc(end)
        records = (
            self.db.query(Attendance)
            .filter(
                Attendance.user_id == user_id,
                Attendance.timestamp >= start_dt,
                Attendance.timestamp <= end_dt,
                Attendance.status != RecordStatus.rejected,
                Attendance.type == AttendanceType.check_in,
            )
            .all()
        )
        return sorted(
            {
                d.isoformat()
                for r in records
                if (d := to_local_date(r.timestamp)) is not None
            }
        )

    def list_requests(self, user_id: UUID | None = None, status: str | None = None) -> list[LeaveRequest]:
        query = self.db.query(LeaveRequest).options(
            joinedload(LeaveRequest.leave_type),
            joinedload(LeaveRequest.user),
        )
        if user_id:
            query = query.filter(LeaveRequest.user_id == user_id)
        if status:
            query = query.filter(LeaveRequest.status == LeaveStatus(status))
        return query.order_by(LeaveRequest.created_at.desc()).all()

    def approve_or_reject(
        self, request_id: UUID, approved: bool, admin_id: UUID, reason: str | None = None
    ) -> LeaveRequest:
        request = (
            self.db.query(LeaveRequest)
            .options(joinedload(LeaveRequest.leave_type))
            .filter(LeaveRequest.id == request_id)
            .first()
        )
        if not request:
            raise ValueError("Leave request not found")
        if request.status != LeaveStatus.pending:
            raise ValueError("Only pending requests can be actioned")

        # Approval regenerates day status for the leave range — must not alter locked payroll months.
        # Rejection only clears pending balances (pending leave never entered ADS), but we still
        # refuse actions that could confuse ops when the period is already locked.
        if approved:
            self._assert_date_range_writable(request.start_date, request.end_date)

        balance = (
            self.db.query(LeaveBalance)
            .filter(
                LeaveBalance.user_id == request.user_id,
                LeaveBalance.leave_type_id == request.leave_type_id,
                LeaveBalance.year == request.start_date.year,
            )
            .first()
        )
        if balance:
            balance.pending_days = max(Decimal("0"), (balance.pending_days or Decimal("0")) - request.total_days)

        if approved:
            request.status = LeaveStatus.approved
            request.approved_by = admin_id
            if balance:
                balance.used_days = (balance.used_days or Decimal("0")) + request.total_days
            if request.leave_type and request.leave_type.is_comp_off:
                self._consume_comp_off(request.user_id, request.total_days, request.id)
            # Recompute daily summaries for leave dates
            DayStatusEngine(self.db).regenerate_range(request.start_date, request.end_date, user_id=request.user_id)
        else:
            request.status = LeaveStatus.rejected
            request.rejection_reason = reason
            request.approved_by = admin_id

        self.db.commit()
        self.db.refresh(request)
        return request

    def _available_comp_off_days(self, user_id: UUID) -> Decimal:
        from app.models import CompOffBalance

        today = local_today()
        rows = (
            self.db.query(CompOffBalance)
            .filter(
                CompOffBalance.user_id == user_id,
                CompOffBalance.status == "available",
                CompOffBalance.expiry_date >= today,
            )
            .all()
        )
        return sum((r.days or Decimal("0") for r in rows), Decimal("0"))

    def _consume_comp_off(self, user_id: UUID, days_needed: Decimal, leave_request_id: UUID) -> None:
        from app.models import CompOffBalance

        today = local_today()
        remaining = Decimal(str(days_needed))
        rows = (
            self.db.query(CompOffBalance)
            .filter(
                CompOffBalance.user_id == user_id,
                CompOffBalance.status == "available",
                CompOffBalance.expiry_date >= today,
            )
            .order_by(CompOffBalance.expiry_date.asc(), CompOffBalance.earned_date.asc())
            .all()
        )
        for row in rows:
            if remaining <= 0:
                break
            available = Decimal(str(row.days or 0))
            if available <= 0:
                continue
            if available <= remaining:
                remaining -= available
                row.days = Decimal("0")
                row.status = "used"
                row.used_leave_request_id = leave_request_id
            else:
                row.days = available - remaining
                remaining = Decimal("0")
                # partial use — mark notes; keep available if residual > 0
                row.notes = (row.notes or "") + f" | partial use for leave {leave_request_id}"
        if remaining > 0:
            raise ValueError(f"Insufficient comp-off balance to approve. Short by {remaining}")

    def carry_forward_balances(self, from_year: int, to_year: int | None = None) -> dict:
        """Carry forward unused paid leave where LeaveType.carry_forward is True."""
        to_year = to_year or from_year + 1
        carried = 0
        for leave_type in self.list_types():
            if not leave_type.carry_forward or not leave_type.is_paid:
                continue
            balances = (
                self.db.query(LeaveBalance)
                .filter(LeaveBalance.leave_type_id == leave_type.id, LeaveBalance.year == from_year)
                .all()
            )
            for bal in balances:
                unused = (bal.total_days or Decimal("0")) - (bal.used_days or Decimal("0"))
                if unused <= 0:
                    continue
                self.ensure_balances_for_user_id(bal.user_id, to_year)
                next_bal = (
                    self.db.query(LeaveBalance)
                    .filter(
                        LeaveBalance.user_id == bal.user_id,
                        LeaveBalance.leave_type_id == leave_type.id,
                        LeaveBalance.year == to_year,
                    )
                    .first()
                )
                if next_bal:
                    # Add unused on top of annual allocation once
                    base = Decimal(str(leave_type.max_days_per_year))
                    next_bal.total_days = base + unused
                    carried += 1
        self.db.commit()
        return {"fromYear": from_year, "toYear": to_year, "balancesUpdated": carried}

    def ensure_balances_for_user(self, user: User, year: int | None = None):
        self.ensure_balances_for_user_id(user.id, year)

    def ensure_balances_for_user_id(self, user_id: UUID, year: int | None = None):
        year = year or local_today().year
        for leave_type in self.list_types():
            exists = (
                self.db.query(LeaveBalance)
                .filter(
                    LeaveBalance.user_id == user_id,
                    LeaveBalance.leave_type_id == leave_type.id,
                    LeaveBalance.year == year,
                )
                .first()
            )
            if not exists:
                self.db.add(
                    LeaveBalance(
                        user_id=user_id,
                        leave_type_id=leave_type.id,
                        year=year,
                        total_days=Decimal(str(leave_type.max_days_per_year)),
                        used_days=Decimal("0"),
                        pending_days=Decimal("0"),
                    )
                )
        self.db.commit()

    def type_to_dict(self, t: LeaveType) -> dict:
        return {
            "id": str(t.id),
            "name": t.name,
            "code": t.code,
            "maxDaysPerYear": t.max_days_per_year,
            "isPaid": t.is_paid,
            "carryForward": t.carry_forward,
            "isActive": t.is_active,
            "allowHalfDay": t.allow_half_day,
            "requiresApproval": t.requires_approval,
            "maxConsecutiveDays": t.max_consecutive_days,
            "documentAfterDays": t.document_after_days,
            "isCompOff": t.is_comp_off,
        }

    def request_to_dict(self, r: LeaveRequest) -> dict:
        conflicts = getattr(r, "_attendance_conflicts", None)
        return {
            "id": str(r.id),
            "userId": str(r.user_id),
            "userName": r.user.user_name if r.user else None,
            "leaveTypeId": str(r.leave_type_id),
            "leaveTypeCode": r.leave_type.code if r.leave_type else None,
            "leaveTypeName": r.leave_type.name if r.leave_type else None,
            "isPaid": r.leave_type.is_paid if r.leave_type else None,
            "startDate": r.start_date.isoformat(),
            "endDate": r.end_date.isoformat(),
            "totalDays": float(r.total_days),
            "duration": r.duration.value if r.duration else "full_day",
            "reason": r.reason,
            "attachmentUrl": r.attachment_url,
            "status": r.status.value,
            "rejectionReason": r.rejection_reason,
            "createdAt": r.created_at.isoformat() if r.created_at else None,
            "attendanceConflicts": conflicts,
        }

    def balance_to_dict(self, b: LeaveBalance) -> dict:
        available = float((b.total_days or 0) - (b.used_days or 0) - (b.pending_days or 0))
        return {
            "id": str(b.id),
            "userId": str(b.user_id),
            "leaveTypeId": str(b.leave_type_id),
            "leaveTypeCode": b.leave_type.code if b.leave_type else None,
            "leaveTypeName": b.leave_type.name if b.leave_type else None,
            "isPaid": b.leave_type.is_paid if b.leave_type else None,
            "year": b.year,
            "totalDays": float(b.total_days or 0),
            "usedDays": float(b.used_days or 0),
            "pendingDays": float(b.pending_days or 0),
            "availableDays": available,
        }
