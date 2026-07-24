"""Wave 1 auth registration + admin role enforcement tests."""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

# Avoid MinIO/storage init side effects during import where possible.
from app.config import settings


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(settings, "allow_public_employee_registration", False)
    monkeypatch.setattr(settings, "kiosk_api_token", "test-kiosk-token")
    monkeypatch.setattr(settings, "environment", "development")
    # storage_service may require minio; patch save_file used by attendance
    with patch("app.services.storage_service.save_file", return_value="https://example/x.jpg"):
        from app.main import app

        yield TestClient(app)


def test_public_employee_registration_blocked(client):
    response = client.post(
        "/api/auth/register",
        json={"email": "new@example.com", "password": "password123", "user_name": "New User"},
    )
    assert response.status_code == 403
    assert "disabled" in response.json()["detail"].lower()


def test_admin_registration_blocked_when_admin_exists(client, monkeypatch):
    mock_db = MagicMock()
    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.count.return_value = 1

    from app.database import get_db
    from app.main import app

    def override_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_db
    try:
        response = client.post(
            "/api/auth/admin/register",
            json={"email": "admin2@example.com", "password": "password123", "user_name": "Admin2"},
        )
        assert response.status_code == 403
        assert "closed" in response.json()["detail"].lower()
    finally:
        app.dependency_overrides.clear()


def test_quick_attendance_requires_kiosk_token(client):
    files = {"file": ("face.jpg", b"not-a-real-image", "image/jpeg")}
    response = client.post("/api/attendance/quick", files=files)
    assert response.status_code == 401


def test_quick_attendance_rejects_invalid_kiosk_token(client):
    files = {"file": ("face.jpg", b"not-a-real-image", "image/jpeg")}
    response = client.post(
        "/api/attendance/quick",
        files=files,
        headers={"X-Kiosk-Token": "wrong"},
    )
    assert response.status_code == 401


def test_quick_attendance_valid_token_reaches_lock_or_recognition(client, monkeypatch):
    """With valid token, request proceeds past kiosk auth into existing logic."""
    from app.database import get_db
    from app.main import app
    from app.services.payroll_service import assert_attendance_month_writable

    mock_db = MagicMock()

    def override_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_db
    try:
        # Force lock so we never need real face recognition
        with patch(
            "app.routers.attendance.assert_attendance_month_writable",
            side_effect=ValueError("Attendance for 07/2026 is locked because payroll is approved/paid."),
        ):
            files = {"file": ("face.jpg", b"not-a-real-image", "image/jpeg")}
            response = client.post(
                "/api/attendance/quick",
                files=files,
                headers={"X-Kiosk-Token": "test-kiosk-token"},
            )
            assert response.status_code == 409
            assert "locked" in response.json()["detail"].lower()
    finally:
        app.dependency_overrides.clear()


def test_get_current_admin_rejects_employee_role():
    from app.deps import get_current_admin
    from app.models import User, UserRole

    employee = User(
        id=uuid4(),
        email="e@example.com",
        password_hash="x",
        user_name="Emp",
        user_role=UserRole.user,
    )
    with pytest.raises(HTTPException) as exc:
        get_current_admin(current_user=employee)
    assert exc.value.status_code == 403
