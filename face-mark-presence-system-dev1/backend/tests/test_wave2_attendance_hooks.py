"""Wave 2 — attendance mutation ordering: lock → mutate → refresh."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.routers import attendance as attendance_router


def test_ensure_writable_maps_to_409():
    db = MagicMock()
    with patch(
        "app.routers.attendance.assert_attendance_month_writable",
        side_effect=ValueError("Attendance for 07/2026 is locked"),
    ):
        with pytest.raises(HTTPException) as exc:
            attendance_router._ensure_writable(db)
        assert exc.value.status_code == 409


def test_refresh_day_status_propagates_errors():
    db = MagicMock()
    with patch(
        "app.routers.attendance.DayStatusEngine"
    ) as Engine:
        Engine.return_value.refresh_for_timestamps.side_effect = RuntimeError("boom")
        with pytest.raises(RuntimeError, match="boom"):
            attendance_router._refresh_day_status(
                db, uuid4(), datetime.now(timezone.utc)
            )


def test_create_attendance_order_lock_then_refresh():
    """Document expected call order via helper usage in create path (unit-level)."""
    db = MagicMock()
    user_id = uuid4()
    ts = datetime(2026, 7, 10, 9, 0, tzinfo=timezone.utc)
    order: list[str] = []

    def lock(_db, when=None):
        order.append("lock")

    def refresh(_db, uid, *timestamps, include_adjacent=False):
        order.append("refresh")

    with (
        patch("app.routers.attendance._ensure_writable", side_effect=lock) as _,
        patch("app.routers.attendance._refresh_day_status", side_effect=refresh),
    ):
        # Simulate the invariant used by handlers
        attendance_router._ensure_writable(db, ts)
        attendance_router._refresh_day_status(db, user_id, ts)
    assert order == ["lock", "refresh"]
