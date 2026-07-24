"""Wave 2 — DayStatus refresh helpers + leave payroll-lock ordering."""

from __future__ import annotations

from datetime import date, datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.services.day_status_engine import DayStatusEngine
from app.services.leave_service import LeaveService
from app.services.payroll_service import assert_attendance_month_writable, is_attendance_month_locked


def test_local_work_date_tz_aware():
    # 18:30 UTC → 00:00 next day IST
    ts = datetime(2026, 7, 22, 18, 30, tzinfo=timezone.utc)
    assert DayStatusEngine.local_work_date(ts) == date(2026, 7, 23)


def test_local_work_date_plain_date():
    assert DayStatusEngine.local_work_date(date(2026, 7, 22)) == date(2026, 7, 22)


def test_refresh_for_timestamps_calls_resolve_once_per_unique_day():
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

    with patch.object(engine, "resolve_day") as resolve:
        ts = datetime(2026, 7, 15, 10, 0, tzinfo=timezone.utc)
        engine.refresh_for_timestamps(user_id, ts, ts, commit=False, include_adjacent=False)
        assert resolve.call_count == 1
        assert resolve.call_args[0][1] == DayStatusEngine.local_work_date(ts)


def test_refresh_for_timestamps_adjacent_expands_days():
    db = MagicMock()
    engine = DayStatusEngine(db)
    user_id = uuid4()
    user = MagicMock()
    q = MagicMock()
    db.query.return_value = q
    q.options.return_value = q
    q.filter.return_value = q
    q.first.return_value = user

    with patch.object(engine, "resolve_day") as resolve:
        ts = datetime(2026, 7, 15, 10, 0, tzinfo=timezone.utc)
        engine.refresh_for_timestamps(user_id, ts, commit=False, include_adjacent=True)
        assert resolve.call_count == 3


def test_refresh_user_days_raises_when_user_missing():
    db = MagicMock()
    engine = DayStatusEngine(db)
    q = MagicMock()
    db.query.return_value = q
    q.options.return_value = q
    q.filter.return_value = q
    q.first.return_value = None

    with pytest.raises(ValueError, match="Employee not found"):
        engine.refresh_user_days(uuid4(), [date(2026, 7, 1)], commit=False)


def test_assert_attendance_month_writable_when_locked():
    db = MagicMock()
    run = MagicMock()
    run.attendance_locked = True
    run.status = "approved"
    q = MagicMock()
    db.query.return_value = q
    q.filter.return_value = q
    q.first.return_value = run

    assert is_attendance_month_locked(db, date(2026, 7, 10)) is True
    with pytest.raises(ValueError, match="locked"):
        assert_attendance_month_writable(db, date(2026, 7, 10))


def test_leave_approve_checks_lock_before_mutation():
    db = MagicMock()
    svc = LeaveService(db)
    request_id = uuid4()
    admin_id = uuid4()

    leave_req = MagicMock()
    leave_req.id = request_id
    leave_req.status = MagicMock()
    from app.models import LeaveStatus

    leave_req.status = LeaveStatus.pending
    leave_req.start_date = date(2026, 7, 1)
    leave_req.end_date = date(2026, 7, 3)
    leave_req.user_id = uuid4()
    leave_req.leave_type_id = uuid4()
    leave_req.total_days = 3
    leave_req.leave_type = None

    q = MagicMock()
    db.query.return_value = q
    q.options.return_value = q
    q.filter.return_value = q
    q.first.side_effect = [leave_req, None]  # request, then balance

    with patch.object(
        svc,
        "_assert_date_range_writable",
        side_effect=ValueError("Attendance for 07/2026 is locked because payroll is approved/paid."),
    ) as lock_check:
        with pytest.raises(ValueError, match="locked"):
            svc.approve_or_reject(request_id, True, admin_id)
        lock_check.assert_called_once_with(date(2026, 7, 1), date(2026, 7, 3))
        # Must not commit when lock fails
        db.commit.assert_not_called()


def test_leave_reject_does_not_require_lock_check():
    """Pending leave never entered ADS; reject only clears pending balance."""
    db = MagicMock()
    svc = LeaveService(db)
    request_id = uuid4()
    admin_id = uuid4()

    from app.models import LeaveStatus
    from decimal import Decimal

    leave_req = MagicMock()
    leave_req.id = request_id
    leave_req.status = LeaveStatus.pending
    leave_req.start_date = date(2026, 7, 1)
    leave_req.end_date = date(2026, 7, 1)
    leave_req.user_id = uuid4()
    leave_req.leave_type_id = uuid4()
    leave_req.total_days = Decimal("1")
    leave_req.leave_type = None

    balance = MagicMock()
    balance.pending_days = Decimal("1")

    q = MagicMock()
    db.query.return_value = q
    q.options.return_value = q
    q.filter.return_value = q
    q.first.side_effect = [leave_req, balance]

    with patch.object(svc, "_assert_date_range_writable") as lock_check:
        result = svc.approve_or_reject(request_id, False, admin_id, reason="no")
        lock_check.assert_not_called()
        assert result.status == LeaveStatus.rejected
        db.commit.assert_called_once()


def test_leave_assert_date_range_checks_each_month():
    db = MagicMock()
    svc = LeaveService(db)
    calls: list[date] = []

    def fake_assert(_db, when):
        calls.append(when if isinstance(when, date) else when)

    with patch("app.services.leave_service.assert_attendance_month_writable", side_effect=fake_assert):
        svc._assert_date_range_writable(date(2026, 6, 28), date(2026, 7, 2))
    assert date(2026, 6, 28) in calls or any(d.month == 6 for d in calls)
    assert any(d.month == 7 for d in calls)
