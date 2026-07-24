"""Attendance Day Status Engine.

Resolves each employee+date into a final AttendanceDailySummary that
Timesheet and Payroll consume. Priority:

  Holiday → Week-Off → Approved Leave → Attendance → Absent

Attendance on holiday/week-off upgrades to WORKED_HOLIDAY / WORKED_WEEK_OFF.
"""

from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy.orm import Session, joinedload

from app.models import (
    Attendance,
    AttendanceDailySummary,
    AttendanceType,
    CompOffBalance,
    DayAttendanceStatus,
    Holiday,
    HolidayAppliesTo,
    HolidayWorkCompensation,
    LeaveDuration,
    LeaveRequest,
    LeaveStatus,
    RecordStatus,
    RosterAssignment,
    User,
    UserRole,
    WeekOffPolicy,
    WeekOffRequest,
)
from app.services.attendance_policy_service import AttendancePolicyService
from app.timeutil import to_local_date


class DayStatusEngine:
    VERSION = "v1"
    COMP_OFF_EXPIRY_DAYS = 90

    def __init__(self, db: Session):
        self.db = db
        self.policy_service = AttendancePolicyService(db)

    @staticmethod
    def local_work_date(when: datetime | date) -> date:
        """Calendar date used for day-status resolution (APP_TIMEZONE)."""
        result = to_local_date(when)
        assert result is not None
        return result

    @staticmethod
    def is_within_employment(user: User, work_date: date) -> bool:
        if user.joining_date and work_date < user.joining_date:
            return False
        if user.termination_date and work_date > user.termination_date:
            return False
        return True

    def _delete_summary(self, user_id: UUID, work_date: date) -> None:
        self.db.query(AttendanceDailySummary).filter(
            AttendanceDailySummary.user_id == user_id,
            AttendanceDailySummary.work_date == work_date,
        ).delete(synchronize_session=False)

    def refresh_user_days(
        self,
        user_id: UUID,
        work_dates: list[date] | set[date],
        *,
        commit: bool = True,
    ) -> list[date]:
        """Re-resolve specific employee dates into attendance_daily_summaries (upsert)."""
        user = (
            self.db.query(User)
            .options(joinedload(User.department), joinedload(User.weekoff_policy))
            .filter(User.id == user_id)
            .first()
        )
        if not user:
            raise ValueError("Employee not found for day-status refresh")

        unique = sorted({d for d in work_dates if d is not None})
        resolved: list[date] = []
        for work_date in unique:
            result = self.resolve_day(user, work_date, commit=False)
            if result is not None:
                resolved.append(work_date)
        if commit:
            self.db.commit()
        return resolved

    def refresh_for_timestamps(
        self,
        user_id: UUID,
        *timestamps: datetime | date | None,
        commit: bool = True,
        include_adjacent: bool = False,
    ) -> list[date]:
        """Refresh day status for local dates of the given punch timestamps.

        Set include_adjacent=True when overnight ±6h pairing may require neighboring days.
        """
        dates: set[date] = set()
        for ts in timestamps:
            if ts is None:
                continue
            d = self.local_work_date(ts)
            dates.add(d)
            if include_adjacent:
                dates.add(d - timedelta(days=1))
                dates.add(d + timedelta(days=1))
        return self.refresh_user_days(user_id, dates, commit=commit)

    def regenerate_month(self, month: int, year: int, user_id: UUID | None = None) -> dict:
        start = date(year, month, 1)
        end = date(year, month, monthrange(year, month)[1])
        return self.regenerate_range(start, end, user_id=user_id)

    def regenerate_range(self, start: date, end: date, user_id: UUID | None = None) -> dict:
        q = self.db.query(User).filter(User.user_role == UserRole.user)
        if user_id:
            q = q.filter(User.id == user_id)
        else:
            q = q.filter((User.status == "Active") | (User.status.is_(None)))
        employees = q.options(joinedload(User.department), joinedload(User.weekoff_policy)).all()

        processed = 0
        for emp in employees:
            d = start
            while d <= end:
                if self.resolve_day(emp, d, commit=False) is not None:
                    processed += 1
                d += timedelta(days=1)
        self.db.commit()
        return {"processedDays": processed, "employees": len(employees), "from": start.isoformat(), "to": end.isoformat()}

    def resolve_day(self, user: User, work_date: date, commit: bool = True) -> AttendanceDailySummary | None:
        # Outside employment window: remove stale ADS, do not create ABSENT/LOP.
        if not self.is_within_employment(user, work_date):
            self._delete_summary(user.id, work_date)
            if commit:
                self.db.commit()
            return None

        holiday = self._find_holiday(user, work_date)
        is_week_off = self._is_week_off(user, work_date)
        leave = self._find_approved_leave(user.id, work_date)
        check_in, check_out, worked_minutes = self._attendance_pair(user.id, work_date)
        has_attendance = check_in is not None

        policy = self.policy_service.get_policy_for_user(user.id)
        expected_minutes = int(float(policy.full_day_hours) * 60)
        overtime_after = int(float(policy.overtime_after_hours) * 60)
        # Canonical half-day threshold from AttendancePolicy.half_day_hours (not expected/2).
        half_day_minutes = int(float(policy.half_day_hours) * 60)

        def present_from_worked() -> Decimal:
            return Decimal("1") if worked_minutes >= half_day_minutes else Decimal("0.5")

        status: DayAttendanceStatus
        present = Decimal("0")
        paid_leave = Decimal("0")
        unpaid_leave = Decimal("0")
        payable = Decimal("0")
        lop = Decimal("0")
        is_working_day = True
        notes: str | None = None
        overtime_minutes = 0

        if holiday:
            is_working_day = False
            if has_attendance:
                status = DayAttendanceStatus.worked_holiday
                present = present_from_worked()
                payable = present
                overtime_minutes = max(0, worked_minutes - overtime_after)
                notes = f"Worked on holiday: {holiday.name}"
                self._maybe_earn_comp_off(user.id, work_date, holiday.work_compensation, "worked_holiday")
            else:
                status = DayAttendanceStatus.holiday
                if holiday.is_paid:
                    payable = Decimal("1")
                notes = f"Holiday: {holiday.name}"
        elif is_week_off:
            is_working_day = False
            if has_attendance:
                status = DayAttendanceStatus.worked_week_off
                present = present_from_worked()
                payable = present
                overtime_minutes = max(0, worked_minutes - overtime_after)
                notes = "Worked on week-off"
                week_policy = self._weekoff_policy_for(user)
                compensation = week_policy.work_compensation if week_policy else HolidayWorkCompensation.comp_off
                self._maybe_earn_comp_off(user.id, work_date, compensation, "worked_week_off")
            else:
                status = DayAttendanceStatus.week_off
                week_policy = self._weekoff_policy_for(user)
                if not week_policy or week_policy.is_paid:
                    payable = Decimal("1")
                notes = "Week off"
        elif leave:
            leave_type = leave.leave_type
            is_paid = bool(leave_type and leave_type.is_paid)
            duration = leave.duration or LeaveDuration.full_day
            half = duration in (LeaveDuration.first_half, LeaveDuration.second_half)

            if has_attendance and half:
                present = Decimal("0.5")
                if is_paid:
                    status = DayAttendanceStatus.half_present_half_paid_leave
                    paid_leave = Decimal("0.5")
                    payable = Decimal("1")
                else:
                    status = DayAttendanceStatus.half_present_half_lop
                    unpaid_leave = Decimal("0.5")
                    payable = Decimal("0.5")
                    lop = Decimal("0.5")
            elif half:
                if is_paid:
                    status = DayAttendanceStatus.paid_leave
                    paid_leave = Decimal("0.5")
                    payable = Decimal("0.5")
                else:
                    status = DayAttendanceStatus.unpaid_leave
                    unpaid_leave = Decimal("0.5")
                    lop = Decimal("0.5")
            else:
                if is_paid:
                    status = DayAttendanceStatus.paid_leave
                    paid_leave = Decimal("1")
                    payable = Decimal("1")
                else:
                    status = DayAttendanceStatus.unpaid_leave
                    unpaid_leave = Decimal("1")
                    lop = Decimal("1")
            notes = f"Leave: {leave_type.code if leave_type else 'N/A'}"
        elif has_attendance:
            overtime_minutes = max(0, worked_minutes - overtime_after)
            day_status = None
            if check_out:
                # reuse punch-level flags if present
                day_status = check_out.day_status or (check_in.day_status if check_in else None)
            elif check_in:
                day_status = check_in.day_status

            if day_status == "late":
                status = DayAttendanceStatus.late
                present = Decimal("1")
                payable = Decimal("1")
            elif day_status == "half_day":
                status = DayAttendanceStatus.half_day
                present = Decimal("0.5")
                payable = Decimal("0.5")
            elif day_status == "early_departure":
                status = DayAttendanceStatus.early_departure
                present = present_from_worked()
                payable = present
            else:
                # Align with policy: below half_day_hours → half day even without punch flag.
                if worked_minutes and worked_minutes < half_day_minutes:
                    status = DayAttendanceStatus.half_day
                    present = Decimal("0.5")
                    payable = Decimal("0.5")
                else:
                    status = DayAttendanceStatus.present
                    present = Decimal("1")
                    payable = Decimal("1")
        else:
            # No attendance on a working day → ABSENT / LOP
            status = DayAttendanceStatus.absent
            lop = Decimal("1")
            notes = "Absent"

        summary = (
            self.db.query(AttendanceDailySummary)
            .filter(
                AttendanceDailySummary.user_id == user.id,
                AttendanceDailySummary.work_date == work_date,
            )
            .first()
        )
        if not summary:
            summary = AttendanceDailySummary(id=uuid4(), user_id=user.id, work_date=work_date)
            self.db.add(summary)

        summary.is_working_day = is_working_day
        summary.attendance_status = status
        summary.expected_minutes = expected_minutes if is_working_day else 0
        summary.worked_minutes = worked_minutes
        summary.overtime_minutes = overtime_minutes
        summary.present_fraction = present
        summary.paid_leave_fraction = paid_leave
        summary.unpaid_leave_fraction = unpaid_leave
        summary.payable_day_fraction = payable
        summary.lop_day_fraction = lop
        summary.is_holiday = holiday is not None
        summary.holiday_id = holiday.id if holiday else None
        summary.is_week_off = is_week_off and holiday is None
        summary.leave_request_id = leave.id if leave else None
        summary.leave_type_id = leave.leave_type_id if leave else None
        summary.check_in_at = check_in.timestamp if check_in else None
        summary.check_out_at = check_out.timestamp if check_out else None
        summary.notes = notes
        summary.calculation_version = self.VERSION
        summary.calculated_at = datetime.now(timezone.utc)

        if commit:
            self.db.commit()
            self.db.refresh(summary)
        return summary

    def monthly_summary(self, user_id: UUID, month: int, year: int) -> dict:
        start = date(year, month, 1)
        end = date(year, month, monthrange(year, month)[1])
        rows = (
            self.db.query(AttendanceDailySummary)
            .filter(
                AttendanceDailySummary.user_id == user_id,
                AttendanceDailySummary.work_date >= start,
                AttendanceDailySummary.work_date <= end,
            )
            .order_by(AttendanceDailySummary.work_date)
            .all()
        )
        if not rows:
            self.regenerate_month(month, year, user_id=user_id)
            rows = (
                self.db.query(AttendanceDailySummary)
                .filter(
                    AttendanceDailySummary.user_id == user_id,
                    AttendanceDailySummary.work_date >= start,
                    AttendanceDailySummary.work_date <= end,
                )
                .order_by(AttendanceDailySummary.work_date)
                .all()
            )

        def sum_field(attr: str) -> float:
            return float(sum((getattr(r, attr) or 0) for r in rows))

        return {
            "userId": str(user_id),
            "month": month,
            "year": year,
            "calendarDays": monthrange(year, month)[1],
            "workingDays": sum(1 for r in rows if r.is_working_day),
            "present": sum_field("present_fraction"),
            "paidLeave": sum_field("paid_leave_fraction"),
            "unpaidLeave": sum_field("unpaid_leave_fraction"),
            "holidays": sum(1 for r in rows if r.is_holiday and not r.worked_minutes),
            "weekOffs": sum(1 for r in rows if r.is_week_off and not r.worked_minutes),
            "workedHoliday": sum(1 for r in rows if r.attendance_status == DayAttendanceStatus.worked_holiday),
            "workedWeekOff": sum(1 for r in rows if r.attendance_status == DayAttendanceStatus.worked_week_off),
            "payableDays": sum_field("payable_day_fraction"),
            "lopDays": sum_field("lop_day_fraction"),
            "expectedMinutes": sum(r.expected_minutes for r in rows),
            "workedMinutes": sum(r.worked_minutes for r in rows),
            "overtimeMinutes": sum(r.overtime_minutes for r in rows),
            "days": [self.summary_to_dict(r) for r in rows],
        }

    def summary_to_dict(self, r: AttendanceDailySummary) -> dict:
        return {
            "id": str(r.id),
            "userId": str(r.user_id),
            "workDate": r.work_date.isoformat(),
            "isWorkingDay": r.is_working_day,
            "attendanceStatus": r.attendance_status.value if r.attendance_status else None,
            "expectedMinutes": r.expected_minutes,
            "workedMinutes": r.worked_minutes,
            "overtimeMinutes": r.overtime_minutes,
            "presentFraction": float(r.present_fraction or 0),
            "paidLeaveFraction": float(r.paid_leave_fraction or 0),
            "unpaidLeaveFraction": float(r.unpaid_leave_fraction or 0),
            "payableDayFraction": float(r.payable_day_fraction or 0),
            "lopDayFraction": float(r.lop_day_fraction or 0),
            "isHoliday": r.is_holiday,
            "isWeekOff": r.is_week_off,
            "notes": r.notes,
            "checkInAt": r.check_in_at.isoformat() if r.check_in_at else None,
            "checkOutAt": r.check_out_at.isoformat() if r.check_out_at else None,
        }

    # ---- helpers ----

    def _find_holiday(self, user: User, work_date: date) -> Holiday | None:
        holidays = (
            self.db.query(Holiday)
            .filter(Holiday.holiday_date == work_date, Holiday.is_active.is_(True))
            .all()
        )
        for h in holidays:
            if h.applies_to == HolidayAppliesTo.all:
                return h
            if h.applies_to == HolidayAppliesTo.department and h.department_id and user.department_id == h.department_id:
                return h
            if (
                h.applies_to == HolidayAppliesTo.employment_type
                and h.employment_type
                and user.employment_type
                and h.employment_type.lower() == user.employment_type.lower()
            ):
                return h
        return None

    def _weekoff_policy_for(self, user: User) -> WeekOffPolicy | None:
        if user.weekoff_policy and user.weekoff_policy.is_active:
            return user.weekoff_policy
        return (
            self.db.query(WeekOffPolicy)
            .filter(WeekOffPolicy.is_default.is_(True), WeekOffPolicy.is_active.is_(True))
            .first()
        )

    def _is_week_off(self, user: User, work_date: date) -> bool:
        # 1) Published roster assignment for this date (rotational + explicit offs)
        from app.models import RosterStatus, WeeklyRoster

        roster_off = (
            self.db.query(RosterAssignment)
            .join(WeeklyRoster, RosterAssignment.roster_id == WeeklyRoster.id)
            .filter(
                RosterAssignment.user_id == user.id,
                RosterAssignment.work_date == work_date,
                RosterAssignment.is_week_off.is_(True),
                WeeklyRoster.status == RosterStatus.published,
            )
            .first()
        )
        if roster_off:
            return True

        # 2) Approved custom week-off request
        start_dt = datetime.combine(work_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        end_dt = datetime.combine(work_date, datetime.max.time()).replace(tzinfo=timezone.utc)
        custom = (
            self.db.query(WeekOffRequest)
            .filter(
                WeekOffRequest.user_id == user.id,
                WeekOffRequest.status == RecordStatus.approved,
                WeekOffRequest.date >= start_dt,
                WeekOffRequest.date <= end_dt,
            )
            .first()
        )
        if custom:
            return True

        # 3) Fixed policy weekdays (0=Mon ... 6=Sun)
        # Rotational policies without a published roster day are not week-offs here.
        policy = self._weekoff_policy_for(user)
        if policy and policy.policy_type.value == "fixed":
            days = policy.week_off_days or []
            return work_date.weekday() in days
        return False

    def _find_approved_leave(self, user_id: UUID, work_date: date) -> LeaveRequest | None:
        return (
            self.db.query(LeaveRequest)
            .options(joinedload(LeaveRequest.leave_type))
            .filter(
                LeaveRequest.user_id == user_id,
                LeaveRequest.status == LeaveStatus.approved,
                LeaveRequest.start_date <= work_date,
                LeaveRequest.end_date >= work_date,
            )
            .first()
        )

    def _attendance_pair(
        self, user_id: UUID, work_date: date
    ) -> tuple[Attendance | None, Attendance | None, int]:
        start = datetime.combine(work_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        end = datetime.combine(work_date, datetime.max.time()).replace(tzinfo=timezone.utc)
        # Only APPROVED punches count toward day status / payroll (pending & rejected ignored)
        records = (
            self.db.query(Attendance)
            .filter(
                Attendance.user_id == user_id,
                Attendance.timestamp >= start - timedelta(hours=6),
                Attendance.timestamp <= end + timedelta(hours=6),
                Attendance.status == RecordStatus.approved,
                Attendance.type.in_([AttendanceType.check_in, AttendanceType.check_out]),
            )
            .order_by(Attendance.timestamp.asc())
            .all()
        )
        day_records = [r for r in records if to_local_date(r.timestamp) == work_date]
        check_ins = [r for r in day_records if r.type == AttendanceType.check_in]
        check_outs = [r for r in day_records if r.type == AttendanceType.check_out]
        check_in = check_ins[0] if check_ins else None
        check_out = check_outs[-1] if check_outs else None
        worked = 0
        if check_in and check_out:
            if check_out.work_hours is not None:
                worked = int(float(check_out.work_hours) * 60)
            else:
                delta = check_out.timestamp - check_in.timestamp
                worked = max(0, int(delta.total_seconds() // 60))
        return check_in, check_out, worked

    def _maybe_earn_comp_off(
        self,
        user_id: UUID,
        work_date: date,
        compensation: HolidayWorkCompensation,
        source: str,
    ) -> None:
        if compensation != HolidayWorkCompensation.comp_off:
            return
        exists = (
            self.db.query(CompOffBalance)
            .filter(
                CompOffBalance.user_id == user_id,
                CompOffBalance.earned_date == work_date,
                CompOffBalance.source == source,
            )
            .first()
        )
        if exists:
            return
        self.db.add(
            CompOffBalance(
                id=uuid4(),
                user_id=user_id,
                earned_date=work_date,
                expiry_date=work_date + timedelta(days=self.COMP_OFF_EXPIRY_DAYS),
                days=Decimal("1"),
                source=source,
                status="available",
            )
        )
