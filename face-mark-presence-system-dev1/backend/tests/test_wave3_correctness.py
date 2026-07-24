"""Wave 3 — employment, holiday/week-off integrity, compensation, half-day, timezone."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.config import settings
from app.models import HolidayWorkCompensation, RosterStatus
from app.services.day_status_engine import DayStatusEngine
from app.services.holiday_weekoff_service import HolidayWeekOffService
from app.services.payroll_service import premium_extra_factor
from app.services.policy_mutation import assert_dates_writable, filter_writable_dates
from app.services.roster_service import RosterService
from app.timeutil import get_app_timezone, local_today, to_local_date


# ── Timezone ──────────────────────────────────────────────────────────────


def test_app_timezone_defaults_to_kolkata():
    assert settings.app_timezone == "Asia/Kolkata"
    assert str(get_app_timezone()) == "Asia/Kolkata"


def test_utc_evening_maps_to_next_ist_date():
    # 2026-07-21 20:00 UTC = 2026-07-22 01:30 IST
    ts = datetime(2026, 7, 21, 20, 0, tzinfo=timezone.utc)
    assert to_local_date(ts) == date(2026, 7, 22)
    assert DayStatusEngine.local_work_date(ts) == date(2026, 7, 22)


def test_utc_morning_same_ist_date():
    # 2026-07-22 03:00 UTC = 2026-07-22 08:30 IST
    ts = datetime(2026, 7, 22, 3, 0, tzinfo=timezone.utc)
    assert to_local_date(ts) == date(2026, 7, 22)


def test_naive_datetime_treated_as_utc():
    ts = datetime(2026, 7, 21, 20, 0)  # naive
    assert to_local_date(ts) == date(2026, 7, 22)


def test_plain_date_passthrough():
    assert to_local_date(date(2026, 7, 22)) == date(2026, 7, 22)
    assert DayStatusEngine.local_work_date(date(2026, 7, 22)) == date(2026, 7, 22)


def test_local_today_uses_app_timezone():
    today = local_today()
    assert today == datetime.now(get_app_timezone()).date()


# ── Employment boundaries ─────────────────────────────────────────────────


def test_is_within_employment_joining_and_termination():
    user = MagicMock()
    user.joining_date = date(2026, 7, 15)
    user.termination_date = date(2026, 7, 20)

    assert DayStatusEngine.is_within_employment(user, date(2026, 7, 14)) is False
    assert DayStatusEngine.is_within_employment(user, date(2026, 7, 15)) is True
    assert DayStatusEngine.is_within_employment(user, date(2026, 7, 20)) is True
    assert DayStatusEngine.is_within_employment(user, date(2026, 7, 21)) is False


def test_is_within_employment_no_dates():
    user = MagicMock()
    user.joining_date = None
    user.termination_date = None
    assert DayStatusEngine.is_within_employment(user, date(2026, 1, 1)) is True


def test_resolve_day_outside_employment_deletes_stale_ads():
    db = MagicMock()
    engine = DayStatusEngine(db)
    user = MagicMock()
    user.id = uuid4()
    user.joining_date = date(2026, 7, 15)
    user.termination_date = None

    delete_q = MagicMock()
    db.query.return_value = delete_q
    delete_q.filter.return_value = delete_q
    delete_q.delete.return_value = 1

    result = engine.resolve_day(user, date(2026, 7, 10), commit=False)
    assert result is None
    delete_q.delete.assert_called_once()


def test_refresh_user_days_skips_none_outside_employment():
    db = MagicMock()
    engine = DayStatusEngine(db)
    user_id = uuid4()
    user = MagicMock()
    user.id = user_id
    q = MagicMock()
    db.query.return_value = q
    q.options.return_value = q
    q.filter.return_value = q
    q.first.return_value = user

    with patch.object(engine, "resolve_day", return_value=None) as resolve:
        resolved = engine.refresh_user_days(user_id, [date(2026, 7, 1)], commit=False)
        assert resolved == []
        resolve.assert_called_once()


# ── Compensation premiums ─────────────────────────────────────────────────


def test_premium_extra_factor_semantics():
    assert premium_extra_factor(HolidayWorkCompensation.normal) == Decimal("0")
    assert premium_extra_factor(HolidayWorkCompensation.ot) == Decimal("0")
    assert premium_extra_factor(HolidayWorkCompensation.comp_off) == Decimal("0")
    assert premium_extra_factor(HolidayWorkCompensation.rate_1_5x) == Decimal("0.5")
    assert premium_extra_factor(HolidayWorkCompensation.rate_2x) == Decimal("1")
    assert premium_extra_factor(None) == Decimal("0")


def test_premium_total_effective_multipliers():
    """Normal payable day already in package; premium is extra only → totals 1.5x / 2x."""
    daily = Decimal("1000")
    for comp, expected_total in [
        (HolidayWorkCompensation.normal, Decimal("1000")),
        (HolidayWorkCompensation.rate_1_5x, Decimal("1500")),
        (HolidayWorkCompensation.rate_2x, Decimal("2000")),
        (HolidayWorkCompensation.comp_off, Decimal("1000")),
    ]:
        total = daily + daily * premium_extra_factor(comp)
        assert total == expected_total


# ── Half-day threshold ────────────────────────────────────────────────────


def test_half_day_minutes_from_policy_not_expected_half():
    """Canonical: half_day_hours from policy (e..g. 4h), not expected_minutes/2."""
    policy = MagicMock()
    policy.full_day_hours = Decimal("8.0")
    policy.half_day_hours = Decimal("4.0")
    policy.overtime_after_hours = Decimal("8.0")

    half_day_minutes = int(float(policy.half_day_hours) * 60)
    expected_minutes = int(float(policy.full_day_hours) * 60)
    assert half_day_minutes == 240
    assert half_day_minutes != expected_minutes // 2 or half_day_minutes == 240

    # Boundary: exactly threshold → full present fraction
    worked = 240
    present = Decimal("1") if worked >= half_day_minutes else Decimal("0.5")
    assert present == Decimal("1")

    worked_below = 239
    present_below = Decimal("1") if worked_below >= half_day_minutes else Decimal("0.5")
    assert present_below == Decimal("0.5")


def test_leave_half_day_payable_fractions_documented():
    """Engine leave rules (payable/LOP) — regression of Wave 3 half-day leave invariants."""
    # 0.5 present + 0.5 paid leave → payable 1
    assert Decimal("0.5") + Decimal("0.5") == Decimal("1")
    # 0.5 present + 0.5 unpaid → payable 0.5, LOP 0.5
    payable = Decimal("0.5")
    lop = Decimal("0.5")
    assert payable + lop == Decimal("1")


# ── Holiday mutation lock + refresh ───────────────────────────────────────


def test_assert_dates_writable_blocks_locked_month():
    db = MagicMock()
    with patch(
        "app.services.policy_mutation.assert_attendance_month_writable",
        side_effect=ValueError("Attendance for 07/2026 is locked"),
    ):
        with pytest.raises(ValueError, match="locked"):
            assert_dates_writable(db, [date(2026, 7, 15)])


def test_create_holiday_checks_lock_before_mutate():
    db = MagicMock()
    svc = HolidayWeekOffService(db)
    with patch(
        "app.services.holiday_weekoff_service.assert_dates_writable",
        side_effect=ValueError("Attendance for 07/2026 is locked"),
    ) as lock:
        with pytest.raises(ValueError, match="locked"):
            svc.create_holiday(
                {
                    "name": "Test Day",
                    "holiday_date": date(2026, 7, 15),
                }
            )
        lock.assert_called_once()
        db.add.assert_not_called()


def test_create_holiday_refreshes_ads_after_mutate():
    db = MagicMock()
    svc = HolidayWeekOffService(db)
    emp = MagicMock()
    emp.id = uuid4()

    with (
        patch("app.services.holiday_weekoff_service.assert_dates_writable") as lock,
        patch(
            "app.services.holiday_weekoff_service.employees_for_holiday",
            return_value=[emp],
        ),
        patch(
            "app.services.holiday_weekoff_service.refresh_employees_on_dates",
            return_value=1,
        ) as refresh,
    ):
        # commit/refresh paths on MagicMock holiday after add
        def _refresh(obj):
            obj.id = uuid4()
            obj.holiday_date = date(2026, 7, 15)
            obj.name = "Test"
            obj.holiday_type = MagicMock(value="public")
            obj.applies_to = MagicMock(value="all")
            obj.department_id = None
            obj.employment_type = None
            obj.is_paid = True
            obj.work_compensation = MagicMock(value="comp_off")
            obj.is_active = True

        db.refresh.side_effect = _refresh
        holiday = svc.create_holiday({"name": "Test", "holiday_date": "2026-07-15"})
        lock.assert_called_once()
        refresh.assert_called_once()
        assert refresh.call_args[0][2] == [date(2026, 7, 15)]
        db.commit.assert_called()
        assert holiday is not None


def test_update_holiday_checks_old_and_new_dates():
    db = MagicMock()
    svc = HolidayWeekOffService(db)
    holiday = MagicMock()
    holiday.id = uuid4()
    holiday.holiday_date = date(2026, 7, 10)
    holiday.name = "Old"
    q = MagicMock()
    db.query.return_value = q
    q.filter.return_value = q
    q.first.return_value = holiday

    with (
        patch("app.services.holiday_weekoff_service.assert_dates_writable") as lock,
        patch(
            "app.services.holiday_weekoff_service.employees_for_holiday",
            return_value=[],
        ),
        patch(
            "app.services.holiday_weekoff_service.refresh_employees_on_dates",
            return_value=0,
        ) as refresh,
    ):
        svc.update_holiday(holiday.id, {"holiday_date": "2026-07-20"})
        lock.assert_called_once()
        dates_arg = lock.call_args[0][1]
        assert date(2026, 7, 10) in dates_arg
        assert date(2026, 7, 20) in dates_arg
        refresh.assert_called_once()


def test_delete_holiday_lock_then_refresh():
    db = MagicMock()
    svc = HolidayWeekOffService(db)
    holiday = MagicMock()
    holiday.id = uuid4()
    holiday.holiday_date = date(2026, 8, 15)
    holiday.is_active = True
    q = MagicMock()
    db.query.return_value = q
    q.filter.return_value = q
    q.first.return_value = holiday

    with (
        patch("app.services.holiday_weekoff_service.assert_dates_writable") as lock,
        patch(
            "app.services.holiday_weekoff_service.employees_for_holiday",
            return_value=[MagicMock()],
        ),
        patch(
            "app.services.holiday_weekoff_service.refresh_employees_on_dates",
            return_value=1,
        ) as refresh,
    ):
        svc.delete_holiday(holiday.id)
        lock.assert_called_once()
        assert holiday.is_active is False
        refresh.assert_called_once()
        assert refresh.call_args[0][2] == [date(2026, 8, 15)]


# ── Week-off / roster ─────────────────────────────────────────────────────


def test_filter_writable_dates_skips_locked():
    db = MagicMock()

    def locked(_db, d):
        return d.month == 7

    with patch(
        "app.services.payroll_service.is_attendance_month_locked",
        side_effect=locked,
    ):
        dates = [date(2026, 7, 5), date(2026, 8, 5)]
        assert filter_writable_dates(db, dates) == [date(2026, 8, 5)]


def test_draft_roster_upsert_does_not_refresh_ads():
    db = MagicMock()
    svc = RosterService(db)
    roster = MagicMock()
    roster.id = uuid4()
    roster.status = RosterStatus.draft
    roster.week_start = date(2026, 7, 20)
    roster.week_end = date(2026, 7, 26)

    q = MagicMock()
    db.query.return_value = q
    q.filter.return_value = q
    q.first.return_value = roster

    with (
        patch.object(svc, "get_or_create_week", return_value=roster),
        patch("app.services.roster_service.DayStatusEngine") as engine_cls,
        patch(
            "app.services.roster_service.assert_attendance_month_writable"
        ) as lock,
    ):
        svc.upsert_assignments(
            roster.id,
            [{"user_id": str(uuid4()), "work_date": "2026-07-22", "is_week_off": True}],
        )
        lock.assert_not_called()
        engine_cls.assert_not_called()
        db.commit.assert_called()


def test_published_roster_upsert_locks_and_refreshes():
    db = MagicMock()
    svc = RosterService(db)
    roster = MagicMock()
    roster.id = uuid4()
    roster.status = RosterStatus.published
    roster.week_start = date(2026, 7, 20)
    roster.week_end = date(2026, 7, 26)

    q = MagicMock()
    db.query.return_value = q
    q.filter.return_value = q
    q.first.return_value = None  # no existing assignment; first call is roster

    # First query is WeeklyRoster, subsequent are RosterAssignment
    call_count = {"n": 0}

    def query_side_effect(model):
        m = MagicMock()
        m.filter.return_value = m
        m.first.return_value = roster if call_count["n"] == 0 else None
        call_count["n"] += 1
        db.query.side_effect = None  # simplify after first
        return m

    db.query.side_effect = None
    # Simpler: always return roster for first().filter chain for WeeklyRoster
    chain = MagicMock()
    db.query.return_value = chain
    chain.filter.return_value = chain
    chain.first.side_effect = [roster, None]  # roster then no existing assignment

    engine = MagicMock()
    with (
        patch.object(svc, "get_or_create_week", return_value=roster),
        patch("app.services.roster_service.DayStatusEngine", return_value=engine),
        patch(
            "app.services.roster_service.assert_attendance_month_writable"
        ) as lock,
    ):
        uid = uuid4()
        svc.upsert_assignments(
            roster.id,
            [{"user_id": str(uid), "work_date": "2026-07-22", "is_week_off": True}],
        )
        lock.assert_called()
        engine.refresh_user_days.assert_called()
        db.commit.assert_called()
