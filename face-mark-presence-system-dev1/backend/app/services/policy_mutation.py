"""Shared helpers for holiday/week-off mutations: lock → mutate → ADS refresh."""

from __future__ import annotations

import logging
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.models import (
    Holiday,
    HolidayAppliesTo,
    User,
    UserRole,
    WeekOffPolicy,
)
from app.services.day_status_engine import DayStatusEngine
from app.services.payroll_service import assert_attendance_month_writable
from app.timeutil import local_today

logger = logging.getLogger(__name__)


def assert_dates_writable(db: Session, dates: list[date] | set[date]) -> None:
    checked: set[tuple[int, int]] = set()
    for d in dates:
        if d is None:
            continue
        key = (d.year, d.month)
        if key in checked:
            continue
        assert_attendance_month_writable(db, d)
        checked.add(key)


def employees_for_holiday(db: Session, holiday: Holiday) -> list[User]:
    q = (
        db.query(User)
        .options(joinedload(User.department), joinedload(User.weekoff_policy))
        .filter(User.user_role == UserRole.user)
        .filter((User.status == "Active") | (User.status.is_(None)))
    )
    if holiday.applies_to == HolidayAppliesTo.department and holiday.department_id:
        q = q.filter(User.department_id == holiday.department_id)
    elif holiday.applies_to == HolidayAppliesTo.employment_type and holiday.employment_type:
        # Match case-insensitively in Python after fetch to mirror DayStatusEngine
        users = q.all()
        target = holiday.employment_type.lower()
        return [u for u in users if u.employment_type and u.employment_type.lower() == target]
    return q.all()


def employees_for_weekoff_policy(db: Session, policy: WeekOffPolicy) -> list[User]:
    q = (
        db.query(User)
        .options(joinedload(User.department), joinedload(User.weekoff_policy))
        .filter(User.user_role == UserRole.user)
        .filter((User.status == "Active") | (User.status.is_(None)))
    )
    users = q.all()
    if policy.is_default:
        # Default policy applies to users with no assignment or this policy.
        return [u for u in users if u.weekoff_policy_id is None or u.weekoff_policy_id == policy.id]
    return [u for u in users if u.weekoff_policy_id == policy.id]


def refresh_employees_on_dates(
    db: Session,
    employees: list[User],
    dates: list[date] | set[date],
    *,
    commit: bool = False,
) -> int:
    engine = DayStatusEngine(db)
    unique_dates = sorted({d for d in dates if d is not None})
    count = 0
    for emp in employees:
        for d in unique_dates:
            if engine.resolve_day(emp, d, commit=False) is not None:
                count += 1
    if commit:
        db.commit()
    return count


def writable_future_weekoff_dates(week_off_days: list[int], *, days_ahead: int = 62) -> list[date]:
    """Dates from local today through days_ahead matching weekday ints (0=Mon…6=Sun).

    Used for recurring policy edits: refresh writable/future dates only; skip locked months.
    """
    today = local_today()
    out: list[date] = []
    for i in range(days_ahead + 1):
        d = today + timedelta(days=i)
        if d.weekday() in (week_off_days or []):
            out.append(d)
    return out


def filter_writable_dates(db: Session, dates: list[date]) -> list[date]:
    """Keep dates whose payroll month is not locked (for policy edits spanning history)."""
    from app.services.payroll_service import is_attendance_month_locked

    return [d for d in dates if not is_attendance_month_locked(db, d)]
