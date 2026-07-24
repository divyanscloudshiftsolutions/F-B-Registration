"""Application timezone helpers for business-date resolution.

Timestamps remain UTC in storage. Work dates / "today" use APP_TIMEZONE.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from app.config import settings


def get_app_timezone() -> ZoneInfo:
    return ZoneInfo(settings.app_timezone)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def local_now() -> datetime:
    return utc_now().astimezone(get_app_timezone())


def local_today() -> date:
    return local_now().date()


def to_local_date(when: datetime | date | None) -> date | None:
    """Convert a timestamp to the application-local calendar date."""
    if when is None:
        return None
    if isinstance(when, date) and not isinstance(when, datetime):
        return when
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    return when.astimezone(get_app_timezone()).date()


def local_day_bounds_utc(on: date | None = None) -> tuple[datetime, datetime]:
    """UTC timestamps covering the full local calendar day."""
    tz = get_app_timezone()
    day = on or local_today()
    start_local = datetime.combine(day, datetime.min.time(), tzinfo=tz)
    end_local = datetime.combine(day, datetime.max.time(), tzinfo=tz)
    return start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)
