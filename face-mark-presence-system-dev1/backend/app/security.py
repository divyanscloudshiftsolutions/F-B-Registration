"""Shared security helpers (secrets, kiosk token). Keep small — no auth redesign."""

from __future__ import annotations

import secrets

from fastapi import Header, HTTPException, status

from app.config import settings

WEAK_SECRET_KEYS = frozenset(
    {
        "dev-secret-key-change-in-production",
        "change-this-to-a-long-random-secret-key",
        "secret",
        "changeme",
    }
)


def is_weak_secret_key(secret_key: str) -> bool:
    return secret_key.strip() in WEAK_SECRET_KEYS or len(secret_key.strip()) < 16


def assert_production_secret_safe(environment: str, secret_key: str) -> None:
    """Raise RuntimeError when production would start with a weak/default SECRET_KEY."""
    if environment.lower() == "production" and is_weak_secret_key(secret_key):
        raise RuntimeError(
            "Refusing to start: SECRET_KEY is weak/default while ENVIRONMENT=production. "
            "Set a long random SECRET_KEY in the server .env."
        )


def validate_kiosk_token(provided: str | None) -> None:
    """Fail closed: missing config or bad token rejects the request."""
    expected = (settings.kiosk_api_token or "").strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Kiosk attendance is not configured. Set KIOSK_API_TOKEN on the server.",
        )
    if not provided or not secrets.compare_digest(provided.strip(), expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing kiosk token",
        )


def require_kiosk_token(
    x_kiosk_token: str | None = Header(default=None, alias="X-Kiosk-Token"),
) -> None:
    validate_kiosk_token(x_kiosk_token)
