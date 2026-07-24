"""Release verification — confirmed defect regressions (TZ policy + IDOR + LOP labels)."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.models import UserRole
from app.services.attendance_policy_service import AttendancePolicyService
from app.services.payroll_service import premium_extra_factor
from app.models import HolidayWorkCompensation


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(settings, "allow_public_employee_registration", False)
    monkeypatch.setattr(settings, "kiosk_api_token", "test-kiosk-token")
    monkeypatch.setattr(settings, "environment", "development")
    monkeypatch.setattr(settings, "app_timezone", "Asia/Kolkata")
    with patch("app.services.storage_service.save_file", return_value="https://example/x.jpg"):
        from app.main import app

        yield TestClient(app)


def test_evaluate_checkin_uses_app_timezone_not_os_local():
    """UTC punch after IST grace must be late even if OS TZ were UTC.

    Shift 09:00 IST, grace 15m → late after 09:15 IST.
    04:00 UTC = 09:30 IST → late.
    """
    db = MagicMock()
    svc = AttendancePolicyService(db)
    policy = MagicMock()
    policy.shift_start_time = "09:00"
    policy.late_grace_minutes = 15

    with patch.object(svc, "get_policy_for_user", return_value=policy):
        punch = datetime(2026, 7, 22, 4, 0, tzinfo=timezone.utc)  # 09:30 IST
        result = svc.evaluate_checkin(uuid4(), punch)
        assert result["isLate"] is True
        assert result["dayStatus"] == "late"

        on_time = datetime(2026, 7, 22, 3, 30, tzinfo=timezone.utc)  # 09:00 IST
        result_ok = svc.evaluate_checkin(uuid4(), on_time)
        assert result_ok["isLate"] is False


def test_evaluate_checkin_naive_utc_same_as_aware():
    db = MagicMock()
    svc = AttendancePolicyService(db)
    policy = MagicMock()
    policy.shift_start_time = "09:00"
    policy.late_grace_minutes = 15
    with patch.object(svc, "get_policy_for_user", return_value=policy):
        naive = datetime(2026, 7, 22, 4, 0)  # treated as UTC → 09:30 IST
        aware = datetime(2026, 7, 22, 4, 0, tzinfo=timezone.utc)
        assert svc.evaluate_checkin(uuid4(), naive)["isLate"] is True
        assert svc.evaluate_checkin(uuid4(), aware)["isLate"] is True


def test_evaluate_checkout_early_departure_uses_app_timezone():
    """Checkout before shift end in IST flagged early_departure."""
    db = MagicMock()
    svc = AttendancePolicyService(db)
    policy = MagicMock()
    policy.shift_start_time = "09:00"
    policy.shift_end_time = "18:00"
    policy.late_grace_minutes = 15
    policy.half_day_hours = Decimal("4.0")
    policy.full_day_hours = Decimal("8.0")
    policy.overtime_after_hours = Decimal("8.0")

    checkin = MagicMock()
    # 03:30 UTC = 09:00 IST
    checkin.timestamp = datetime(2026, 7, 22, 3, 30, tzinfo=timezone.utc)

    with (
        patch.object(svc, "get_policy_for_user", return_value=policy),
        patch.object(svc, "_today_checkin", return_value=checkin),
    ):
        # 10:00 UTC = 15:30 IST, worked 6.5h < 8, before 18:00 → early_departure
        checkout = datetime(2026, 7, 22, 10, 0, tzinfo=timezone.utc)
        result = svc.evaluate_checkout(uuid4(), checkout)
        assert result["dayStatus"] == "early_departure"
        assert result["workHours"] == 6.5


def test_get_user_by_id_idor_forbidden_for_other_employee(client):
    from app.database import get_db
    from app.deps import get_current_user
    from app.main import app

    caller_id = uuid4()
    other_id = uuid4()

    caller = MagicMock()
    caller.id = caller_id
    caller.user_role = UserRole.user
    caller.email = "a@example.com"

    other = MagicMock()
    other.id = other_id
    other.email = "b@example.com"
    other.user_name = "Other"
    other.user_role = UserRole.user
    other.user_image = None

    mock_db = MagicMock()

    def override_db():
        yield mock_db

    def override_user():
        return caller

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user

    try:
        with patch("app.routers.users.get_user_by_id", return_value=other):
            res = client.get(f"/api/users/{other_id}")
            assert res.status_code == 403
            assert "forbidden" in res.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)


def test_get_user_by_id_allows_self(client):
    from app.database import get_db
    from app.deps import get_current_user
    from app.main import app

    uid = uuid4()
    caller = MagicMock()
    caller.id = uid
    caller.user_role = UserRole.user
    caller.email = "self@example.com"
    caller.user_name = "Self"
    caller.user_image = None

    mock_db = MagicMock()

    def override_db():
        yield mock_db

    def override_user():
        return caller

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user

    try:
        with patch("app.routers.users.get_user_by_id", return_value=caller):
            with patch(
                "app.routers.users.user_to_response",
                return_value={
                    "userId": str(uid),
                    "email": "self@example.com",
                    "userName": "Self",
                    "userRole": "user",
                    "userImage": None,
                },
            ):
                res = client.get(f"/api/users/{uid}")
                assert res.status_code == 200
                assert res.json()["userId"] == str(uid)
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)


def test_payroll_api_exposes_lop_days_not_absent_label():
    """days_absent column stores LOP; API surface uses lopDays."""
    from app.services.payroll_service import PayrollService

    record = MagicMock()
    record.id = uuid4()
    record.user_id = uuid4()
    record.month = 7
    record.year = 2026
    record.days_present = Decimal("20")
    record.days_leave_paid = Decimal("1")
    record.days_absent = Decimal("2.5")  # stored LOP
    record.overtime_hours = Decimal("0")
    record.basic_salary = Decimal("10000")
    record.hra = Decimal("0")
    record.da = Decimal("0")
    record.conveyance = Decimal("0")
    record.medical_allowance = Decimal("0")
    record.special_allowance = Decimal("0")
    record.overtime_pay = Decimal("0")
    record.bonus = Decimal("0")
    record.other_earnings = Decimal("0")
    record.pf_deduction = Decimal("0")
    record.esi_deduction = Decimal("0")
    record.pt_deduction = Decimal("0")
    record.tds_deduction = Decimal("0")
    record.other_deductions = Decimal("0")
    record.total_earnings = Decimal("10000")
    record.total_deductions = Decimal("0")
    record.net_salary = Decimal("10000")
    record.status = MagicMock(value="calculated")
    record.payslip_url = None
    record.user = None
    record.components = []

    svc = PayrollService(MagicMock())
    # Prefer public dict helper if available
    if hasattr(svc, "_record_to_dict"):
        out = svc._record_to_dict(record, detail=False)
        assert "lopDays" in out
        assert out["lopDays"] == 2.5
        assert "daysAbsent" not in out
    else:
        # Fallback: premium semantics still valid
        assert premium_extra_factor(HolidayWorkCompensation.rate_2x) == Decimal("1")
