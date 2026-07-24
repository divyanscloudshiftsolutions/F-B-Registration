from datetime import date, datetime, timedelta, timezone
from uuid import UUID, uuid4

from sqlalchemy.orm import Session, joinedload

from app.models import (
    RosterAssignment,
    RosterStatus,
    ShiftTemplate,
    User,
    UserRole,
    WeeklyRoster,
)
from app.services.day_status_engine import DayStatusEngine
from app.services.payroll_service import assert_attendance_month_writable


class RosterServiceError(Exception):
    pass


DEFAULT_SHIFTS = [
    {"name": "Morning", "code": "MORNING", "start_time": "06:00", "end_time": "14:00", "color": "#0ea5e9", "sort_order": 1},
    {"name": "General", "code": "GENERAL", "start_time": "09:00", "end_time": "18:00", "color": "#3b82f6", "sort_order": 2},
    {"name": "Evening", "code": "EVENING", "start_time": "14:00", "end_time": "22:00", "color": "#8b5cf6", "sort_order": 3},
    {"name": "Night", "code": "NIGHT", "start_time": "22:00", "end_time": "06:00", "color": "#1e293b", "sort_order": 4},
]


def monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def sunday_of(week_start: date) -> date:
    return week_start + timedelta(days=6)


def week_dates(week_start: date) -> list[date]:
    return [week_start + timedelta(days=i) for i in range(7)]


class RosterService:
    def __init__(self, db: Session):
        self.db = db

    # ---- Shift templates ----

    def ensure_default_shifts(self) -> None:
        if self.db.query(ShiftTemplate).count() > 0:
            return
        for item in DEFAULT_SHIFTS:
            self.db.add(ShiftTemplate(id=uuid4(), **item, is_active=True))
        self.db.commit()

    def list_shifts(self, active_only: bool = True) -> list[ShiftTemplate]:
        self.ensure_default_shifts()
        q = self.db.query(ShiftTemplate)
        if active_only:
            q = q.filter(ShiftTemplate.is_active.is_(True))
        return q.order_by(ShiftTemplate.sort_order, ShiftTemplate.name).all()

    def create_shift(self, data: dict) -> ShiftTemplate:
        code = data["code"].strip().upper()
        if self.db.query(ShiftTemplate).filter(ShiftTemplate.code == code).first():
            raise RosterServiceError(f"Shift code '{code}' already exists")
        shift = ShiftTemplate(
            id=uuid4(),
            name=data["name"].strip(),
            code=code,
            start_time=data.get("start_time", "09:00"),
            end_time=data.get("end_time", "18:00"),
            color=data.get("color", "#3b82f6"),
            is_active=data.get("is_active", True),
            sort_order=data.get("sort_order", 0),
        )
        self.db.add(shift)
        self.db.commit()
        self.db.refresh(shift)
        return shift

    def update_shift(self, shift_id: UUID, data: dict) -> ShiftTemplate:
        shift = self.db.query(ShiftTemplate).filter(ShiftTemplate.id == shift_id).first()
        if not shift:
            raise RosterServiceError("Shift not found")
        if "name" in data and data["name"] is not None:
            shift.name = data["name"].strip()
        if "code" in data and data["code"] is not None:
            code = data["code"].strip().upper()
            existing = (
                self.db.query(ShiftTemplate)
                .filter(ShiftTemplate.code == code, ShiftTemplate.id != shift_id)
                .first()
            )
            if existing:
                raise RosterServiceError(f"Shift code '{code}' already exists")
            shift.code = code
        for field in ("start_time", "end_time", "color", "is_active", "sort_order"):
            if field in data and data[field] is not None:
                setattr(shift, field, data[field])
        self.db.commit()
        self.db.refresh(shift)
        return shift

    def delete_shift(self, shift_id: UUID) -> None:
        shift = self.db.query(ShiftTemplate).filter(ShiftTemplate.id == shift_id).first()
        if not shift:
            raise RosterServiceError("Shift not found")
        in_use = (
            self.db.query(RosterAssignment)
            .filter(RosterAssignment.shift_id == shift_id)
            .count()
        )
        if in_use:
            shift.is_active = False
            self.db.commit()
            return
        self.db.delete(shift)
        self.db.commit()

    # ---- Weekly roster ----

    def get_or_create_week(self, week_start: date, created_by: UUID | None = None) -> WeeklyRoster:
        week_start = monday_of(week_start)
        roster = (
            self.db.query(WeeklyRoster)
            .options(
                joinedload(WeeklyRoster.assignments).joinedload(RosterAssignment.user),
                joinedload(WeeklyRoster.assignments).joinedload(RosterAssignment.shift),
            )
            .filter(WeeklyRoster.week_start == week_start)
            .first()
        )
        if roster:
            return roster

        roster = WeeklyRoster(
            id=uuid4(),
            week_start=week_start,
            week_end=sunday_of(week_start),
            status=RosterStatus.draft,
            created_by=created_by,
        )
        self.db.add(roster)
        self.db.commit()
        self.db.refresh(roster)
        return (
            self.db.query(WeeklyRoster)
            .options(
                joinedload(WeeklyRoster.assignments).joinedload(RosterAssignment.user),
                joinedload(WeeklyRoster.assignments).joinedload(RosterAssignment.shift),
            )
            .filter(WeeklyRoster.id == roster.id)
            .first()
        )

    def list_active_employees(self, department_id: UUID | None = None) -> list[User]:
        q = (
            self.db.query(User)
            .options(joinedload(User.department))
            .filter(User.user_role == UserRole.user)
            .filter((User.status == "Active") | (User.status.is_(None)))
        )
        if department_id:
            q = q.filter(User.department_id == department_id)
        return q.order_by(User.user_name).all()

    def upsert_assignments(self, roster_id: UUID, assignments: list[dict]) -> WeeklyRoster:
        roster = self.db.query(WeeklyRoster).filter(WeeklyRoster.id == roster_id).first()
        if not roster:
            raise RosterServiceError("Roster not found")

        is_published = roster.status == RosterStatus.published
        affected: list[tuple[UUID, date]] = []

        for item in assignments:
            user_id = UUID(str(item["user_id"]))
            work_date = item["work_date"]
            if isinstance(work_date, str):
                work_date = date.fromisoformat(work_date)

            if work_date < roster.week_start or work_date > roster.week_end:
                raise RosterServiceError(f"Date {work_date} is outside roster week")

            if is_published:
                assert_attendance_month_writable(self.db, work_date)

            shift_id = item.get("shift_id")
            if shift_id:
                shift_id = UUID(str(shift_id))
            is_week_off = bool(item.get("is_week_off", False))
            if is_week_off:
                shift_id = None

            existing = (
                self.db.query(RosterAssignment)
                .filter(
                    RosterAssignment.roster_id == roster_id,
                    RosterAssignment.user_id == user_id,
                    RosterAssignment.work_date == work_date,
                )
                .first()
            )
            if existing:
                existing.shift_id = shift_id
                existing.is_week_off = is_week_off
                existing.notes = item.get("notes")
            else:
                self.db.add(
                    RosterAssignment(
                        id=uuid4(),
                        roster_id=roster_id,
                        user_id=user_id,
                        work_date=work_date,
                        shift_id=shift_id,
                        is_week_off=is_week_off,
                        notes=item.get("notes"),
                    )
                )
            affected.append((user_id, work_date))

        roster.updated_at = datetime.now(timezone.utc)
        self.db.flush()
        # Draft roster is not authoritative for DayStatus — only refresh when published.
        if is_published and affected:
            engine = DayStatusEngine(self.db)
            for uid, d in affected:
                engine.refresh_user_days(uid, [d], commit=False)
        self.db.commit()
        return self.get_or_create_week(roster.week_start)

    def _assert_roster_dates_writable(self, roster: WeeklyRoster) -> list[RosterAssignment]:
        assignments = (
            self.db.query(RosterAssignment).filter(RosterAssignment.roster_id == roster.id).all()
        )
        for a in assignments:
            assert_attendance_month_writable(self.db, a.work_date)
        return assignments

    def _refresh_assignments(self, assignments: list[RosterAssignment]) -> None:
        if not assignments:
            return
        engine = DayStatusEngine(self.db)
        by_user: dict[UUID, list[date]] = {}
        for a in assignments:
            by_user.setdefault(a.user_id, []).append(a.work_date)
        for uid, dates in by_user.items():
            engine.refresh_user_days(uid, dates, commit=False)

    def publish(self, roster_id: UUID) -> WeeklyRoster:
        roster = self.db.query(WeeklyRoster).filter(WeeklyRoster.id == roster_id).first()
        if not roster:
            raise RosterServiceError("Roster not found")
        assignments = self._assert_roster_dates_writable(roster)
        roster.status = RosterStatus.published
        roster.published_at = datetime.now(timezone.utc)
        roster.updated_at = datetime.now(timezone.utc)
        self.db.flush()
        self._refresh_assignments(assignments)
        self.db.commit()
        return self.get_or_create_week(roster.week_start)

    def unpublish(self, roster_id: UUID) -> WeeklyRoster:
        roster = self.db.query(WeeklyRoster).filter(WeeklyRoster.id == roster_id).first()
        if not roster:
            raise RosterServiceError("Roster not found")
        assignments = self._assert_roster_dates_writable(roster)
        roster.status = RosterStatus.draft
        roster.published_at = None
        roster.updated_at = datetime.now(timezone.utc)
        self.db.flush()
        # After unpublish, re-resolve so roster OFF no longer applies
        self._refresh_assignments(assignments)
        self.db.commit()
        return self.get_or_create_week(roster.week_start)

    def copy_from_previous(self, week_start: date, created_by: UUID | None = None) -> WeeklyRoster:
        week_start = monday_of(week_start)
        prev_start = week_start - timedelta(days=7)
        prev = (
            self.db.query(WeeklyRoster)
            .options(joinedload(WeeklyRoster.assignments))
            .filter(WeeklyRoster.week_start == prev_start)
            .first()
        )
        if not prev or not prev.assignments:
            raise RosterServiceError("No previous week roster to copy from")

        roster = self.get_or_create_week(week_start, created_by=created_by)
        # Clear existing assignments for this week
        self.db.query(RosterAssignment).filter(RosterAssignment.roster_id == roster.id).delete()

        for a in prev.assignments:
            self.db.add(
                RosterAssignment(
                    id=uuid4(),
                    roster_id=roster.id,
                    user_id=a.user_id,
                    work_date=a.work_date + timedelta(days=7),
                    shift_id=a.shift_id,
                    is_week_off=a.is_week_off,
                    notes=a.notes,
                )
            )
        roster.status = RosterStatus.draft
        roster.published_at = None
        roster.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        return self.get_or_create_week(week_start)

    def apply_shift_to_employee_week(
        self,
        roster_id: UUID,
        user_id: UUID,
        shift_id: UUID | None,
        is_week_off: bool = False,
        skip_dates: list[date] | None = None,
    ) -> WeeklyRoster:
        roster = self.db.query(WeeklyRoster).filter(WeeklyRoster.id == roster_id).first()
        if not roster:
            raise RosterServiceError("Roster not found")
        skip = set(skip_dates or [])
        payload = []
        for d in week_dates(roster.week_start):
            if d in skip:
                continue
            payload.append(
                {
                    "user_id": str(user_id),
                    "work_date": d,
                    "shift_id": str(shift_id) if shift_id and not is_week_off else None,
                    "is_week_off": is_week_off,
                }
            )
        return self.upsert_assignments(roster_id, payload)

    def build_week_response(self, roster: WeeklyRoster, department_id: UUID | None = None) -> dict:
        employees = self.list_active_employees(department_id)
        dates = week_dates(roster.week_start)
        by_key: dict[tuple[str, str], RosterAssignment] = {}
        for a in roster.assignments or []:
            by_key[(str(a.user_id), a.work_date.isoformat())] = a

        rows = []
        for emp in employees:
            days = []
            for d in dates:
                key = (str(emp.id), d.isoformat())
                a = by_key.get(key)
                if a:
                    days.append(self._assignment_dict(a))
                else:
                    days.append(
                        {
                            "id": None,
                            "userId": str(emp.id),
                            "workDate": d.isoformat(),
                            "shiftId": None,
                            "shiftName": None,
                            "shiftCode": None,
                            "startTime": None,
                            "endTime": None,
                            "color": None,
                            "isWeekOff": False,
                            "notes": None,
                        }
                    )
            rows.append(
                {
                    "userId": str(emp.id),
                    "userName": emp.user_name,
                    "employeeCode": emp.employee_code,
                    "departmentName": emp.department.name if emp.department else None,
                    "employmentType": emp.employment_type,
                    "days": days,
                }
            )

        return {
            "id": str(roster.id),
            "weekStart": roster.week_start.isoformat(),
            "weekEnd": roster.week_end.isoformat(),
            "status": roster.status.value,
            "notes": roster.notes,
            "publishedAt": roster.published_at.isoformat() if roster.published_at else None,
            "dates": [d.isoformat() for d in dates],
            "employees": rows,
        }

    def _assignment_dict(self, a: RosterAssignment) -> dict:
        shift = a.shift
        return {
            "id": str(a.id),
            "userId": str(a.user_id),
            "workDate": a.work_date.isoformat(),
            "shiftId": str(a.shift_id) if a.shift_id else None,
            "shiftName": shift.name if shift else None,
            "shiftCode": shift.code if shift else None,
            "startTime": shift.start_time if shift else None,
            "endTime": shift.end_time if shift else None,
            "color": shift.color if shift else ("#94a3b8" if a.is_week_off else None),
            "isWeekOff": a.is_week_off,
            "notes": a.notes,
        }

    def shift_to_dict(self, s: ShiftTemplate) -> dict:
        return {
            "id": str(s.id),
            "name": s.name,
            "code": s.code,
            "startTime": s.start_time,
            "endTime": s.end_time,
            "color": s.color,
            "isActive": s.is_active,
            "sortOrder": s.sort_order,
        }
