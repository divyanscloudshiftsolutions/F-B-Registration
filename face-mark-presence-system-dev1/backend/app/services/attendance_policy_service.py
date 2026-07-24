from datetime import datetime, time, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import Attendance, AttendancePolicy, AttendanceType, EmploymentType, RecordStatus, User
from app.timeutil import get_app_timezone, local_day_bounds_utc, to_local_date


DEFAULT_POLICY = {
    "shift_start_time": "09:00",
    "shift_end_time": "18:00",
    "late_grace_minutes": 15,
    "half_day_hours": Decimal("4.0"),
    "full_day_hours": Decimal("8.0"),
    "overtime_after_hours": Decimal("8.0"),
}

PART_TIME_DEFAULTS = {
    **DEFAULT_POLICY,
    "shift_start_time": "10:00",
    "shift_end_time": "14:00",
    "half_day_hours": Decimal("2.0"),
    "full_day_hours": Decimal("4.0"),
    "overtime_after_hours": Decimal("4.0"),
}

INTERN_DEFAULTS = {
    **DEFAULT_POLICY,
    "shift_start_time": "10:00",
    "shift_end_time": "17:00",
    "half_day_hours": Decimal("3.0"),
    "full_day_hours": Decimal("6.0"),
    "overtime_after_hours": Decimal("6.0"),
}

DEFAULTS_BY_CODE = {
    "part-time": PART_TIME_DEFAULTS,
    "intern": INTERN_DEFAULTS,
}


class AttendancePolicyService:
    def __init__(self, db: Session):
        self.db = db

    def _defaults_for_employment_type(self, employment_type: EmploymentType | None) -> dict:
        if employment_type and employment_type.code in DEFAULTS_BY_CODE:
            return DEFAULTS_BY_CODE[employment_type.code].copy()
        return DEFAULT_POLICY.copy()

    def get_default_policy(self) -> AttendancePolicy:
        policy = (
            self.db.query(AttendancePolicy)
            .filter(AttendancePolicy.employment_type_id.is_(None))
            .first()
        )
        if not policy:
            policy = AttendancePolicy(**DEFAULT_POLICY)
            self.db.add(policy)
            self.db.commit()
            self.db.refresh(policy)
        return policy

    def get_policy_for_employment_type(self, employment_type_id: UUID | None) -> AttendancePolicy:
        if employment_type_id:
            policy = (
                self.db.query(AttendancePolicy)
                .filter(AttendancePolicy.employment_type_id == employment_type_id)
                .first()
            )
            if policy:
                return policy

            employment_type = (
                self.db.query(EmploymentType).filter(EmploymentType.id == employment_type_id).first()
            )
            if employment_type:
                policy = AttendancePolicy(
                    employment_type_id=employment_type_id,
                    **self._defaults_for_employment_type(employment_type),
                )
                self.db.add(policy)
                self.db.commit()
                self.db.refresh(policy)
                return policy

        return self.get_default_policy()

    def _resolve_employment_type(self, user: User) -> EmploymentType | None:
        if not user.employment_type:
            return None
        value = user.employment_type.strip()
        return (
            self.db.query(EmploymentType)
            .filter(
                (EmploymentType.code == value.lower())
                | (EmploymentType.name == value)
                | (EmploymentType.code == value)
            )
            .first()
        )

    def get_policy_for_user(self, user_id: UUID) -> AttendancePolicy:
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return self.get_default_policy()
        employment_type = self._resolve_employment_type(user)
        if employment_type:
            return self.get_policy_for_employment_type(employment_type.id)
        return self.get_default_policy()

    def list_policies(self) -> list[dict]:
        employment_types = (
            self.db.query(EmploymentType)
            .filter(EmploymentType.is_active.is_(True))
            .order_by(EmploymentType.sort_order, EmploymentType.name)
            .all()
        )
        results = []
        for employment_type in employment_types:
            policy = self.get_policy_for_employment_type(employment_type.id)
            results.append(self._policy_response(policy, employment_type))
        return results

    def _policy_response(self, policy: AttendancePolicy, employment_type: EmploymentType | None = None) -> dict:
        et = employment_type or policy.employment_type
        return {
            "id": str(policy.id),
            "employmentTypeId": str(et.id) if et else None,
            "employmentTypeName": et.name if et else "Default",
            "employmentTypeCode": et.code if et else "default",
            "shiftStartTime": policy.shift_start_time,
            "shiftEndTime": policy.shift_end_time,
            "lateGraceMinutes": policy.late_grace_minutes,
            "halfDayHours": float(policy.half_day_hours),
            "fullDayHours": float(policy.full_day_hours),
            "overtimeAfterHours": float(policy.overtime_after_hours),
            "updatedAt": policy.updated_at.isoformat() if policy.updated_at else None,
        }

    def update_policy_for_employment_type(self, employment_type_id: UUID, data: dict) -> AttendancePolicy:
        policy = self.get_policy_for_employment_type(employment_type_id)
        return self._apply_update(policy, data)

    def update_default_policy(self, data: dict) -> AttendancePolicy:
        policy = self.get_default_policy()
        return self._apply_update(policy, data)

    def _apply_update(self, policy: AttendancePolicy, data: dict) -> AttendancePolicy:
        for field in (
            "shift_start_time",
            "shift_end_time",
            "late_grace_minutes",
            "half_day_hours",
            "full_day_hours",
            "overtime_after_hours",
        ):
            if field in data and data[field] is not None:
                value = data[field]
                if field.endswith("_hours"):
                    value = Decimal(str(value))
                setattr(policy, field, value)
        policy.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(policy)
        return policy

    def _parse_time(self, value: str) -> time:
        hour, minute = value.split(":")
        return time(int(hour), int(minute))

    def _as_app_local(self, when: datetime) -> datetime:
        """Interpret a punch timestamp in APP_TIMEZONE (naive values treated as UTC)."""
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
        return when.astimezone(get_app_timezone())

    def _today_checkin(self, user_id, checkout_time: datetime) -> Attendance | None:
        work_date = to_local_date(checkout_time)
        assert work_date is not None
        start, end = local_day_bounds_utc(work_date)
        return (
            self.db.query(Attendance)
            .filter(
                Attendance.user_id == user_id,
                Attendance.type == AttendanceType.check_in,
                Attendance.timestamp >= start,
                Attendance.timestamp <= end,
                Attendance.status == RecordStatus.approved,
            )
            .order_by(Attendance.timestamp.asc())
            .first()
        )

    def evaluate_checkin(self, user_id, checkin_time: datetime) -> dict:
        policy = self.get_policy_for_user(user_id)
        shift_start = self._parse_time(policy.shift_start_time)
        local = self._as_app_local(checkin_time)
        tz = get_app_timezone()
        grace_end_dt = datetime.combine(local.date(), shift_start, tzinfo=tz) + timedelta(
            minutes=policy.late_grace_minutes
        )
        is_late = local > grace_end_dt
        return {"isLate": is_late, "dayStatus": "late" if is_late else None}

    def evaluate_checkout(self, user_id, checkout_time: datetime) -> dict:
        policy = self.get_policy_for_user(user_id)
        checkin = self._today_checkin(user_id, checkout_time)
        if not checkin:
            return {"workHours": None, "dayStatus": None, "note": None}

        checkin_ts = checkin.timestamp
        if checkin_ts.tzinfo is None:
            checkin_ts = checkin_ts.replace(tzinfo=timezone.utc)
        if checkout_time.tzinfo is None:
            checkout_time = checkout_time.replace(tzinfo=timezone.utc)

        delta = checkout_time - checkin_ts
        work_hours = Decimal(str(round(delta.total_seconds() / 3600, 2)))

        checkin_eval = self.evaluate_checkin(user_id, checkin_ts)
        is_late = checkin_eval["isLate"]

        half_day = Decimal(str(policy.half_day_hours))
        full_day = Decimal(str(policy.full_day_hours))
        overtime_after = Decimal(str(policy.overtime_after_hours))

        if work_hours < half_day:
            day_status = "half_day"
        elif work_hours >= full_day:
            day_status = "present"
        else:
            day_status = "present"

        if is_late and day_status == "present":
            day_status = "late"

        shift_end = self._parse_time(policy.shift_end_time)
        local_out = self._as_app_local(checkout_time)
        if local_out.time() < shift_end and work_hours < full_day:
            day_status = "early_departure"

        overtime_hours = max(Decimal("0"), work_hours - overtime_after)
        note_parts = [f"Worked {work_hours}h"]
        if overtime_hours > 0:
            note_parts.append(f"OT {overtime_hours}h")
        note_parts.append(day_status.replace("_", " ").title())

        return {
            "workHours": float(work_hours),
            "dayStatus": day_status,
            "overtimeHours": float(overtime_hours),
            "note": " · ".join(note_parts),
        }

    def apply_checkin_flags(self, record: Attendance) -> None:
        eval_result = self.evaluate_checkin(record.user_id, record.timestamp)
        if eval_result["isLate"]:
            record.day_status = "late"
            record.note = (record.note or "") + " · Late arrival"

    def apply_checkout_flags(self, record: Attendance) -> None:
        eval_result = self.evaluate_checkout(record.user_id, record.timestamp)
        record.work_hours = eval_result.get("workHours")
        record.day_status = eval_result.get("dayStatus")
        if eval_result.get("note"):
            base = record.note or "Face verified check-out"
            record.note = f"{base} · {eval_result['note']}"
