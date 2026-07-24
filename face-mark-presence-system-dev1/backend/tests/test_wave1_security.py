"""Wave 1 security unit tests — no database required."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.security import (
    assert_production_secret_safe,
    is_weak_secret_key,
    validate_kiosk_token,
)


def test_weak_secret_detection():
    assert is_weak_secret_key("dev-secret-key-change-in-production")
    assert is_weak_secret_key("secret")
    assert is_weak_secret_key("short")
    assert not is_weak_secret_key("a-sufficiently-long-random-production-secret")


def test_production_rejects_weak_secret():
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        assert_production_secret_safe("production", "dev-secret-key-change-in-production")


def test_production_accepts_strong_secret():
    assert_production_secret_safe("production", "a-sufficiently-long-random-production-secret")


def test_development_allows_weak_secret():
    assert_production_secret_safe("development", "dev-secret-key-change-in-production")


def test_kiosk_token_rejects_when_unconfigured(monkeypatch):
    from app import security

    monkeypatch.setattr(security.settings, "kiosk_api_token", "")
    with pytest.raises(HTTPException) as exc:
        validate_kiosk_token("anything")
    assert exc.value.status_code == 503


def test_kiosk_token_rejects_missing(monkeypatch):
    from app import security

    monkeypatch.setattr(security.settings, "kiosk_api_token", "valid-kiosk-token-value")
    with pytest.raises(HTTPException) as exc:
        validate_kiosk_token(None)
    assert exc.value.status_code == 401


def test_kiosk_token_rejects_invalid(monkeypatch):
    from app import security

    monkeypatch.setattr(security.settings, "kiosk_api_token", "valid-kiosk-token-value")
    with pytest.raises(HTTPException) as exc:
        validate_kiosk_token("wrong-token")
    assert exc.value.status_code == 401


def test_kiosk_token_accepts_valid(monkeypatch):
    from app import security

    monkeypatch.setattr(security.settings, "kiosk_api_token", "valid-kiosk-token-value")
    validate_kiosk_token("valid-kiosk-token-value")
