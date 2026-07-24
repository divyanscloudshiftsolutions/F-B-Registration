# Wave 3 Correctness Report

**Date:** 2026-07-23  
**Scope:** Existing-feature correctness only (employment, holiday/week-off integrity, compensation, half-day, timezone, Profile)  
**Migrations:** None  
**Status:** PASS

---

## 1. Executive summary

Wave 3 closed the P1 correctness gaps without new product modules or schema changes:

- DayStatusEngine skips (and deletes stale) ADS outside `joining_date` / `termination_date`
- Holiday and week-off mutations: payroll lock → mutate → DayStatus refresh
- Published roster only refreshes ADS; draft does not
- Payroll honors existing `1.5x` / `2x` / `normal` / `ot` / `comp_off` without double-paying
- Half-day uses `AttendancePolicy.half_day_hours`
- Business dates use `APP_TIMEZONE` (`Asia/Kolkata` default) via `app/timeutil.py`
- Profile monthly hours/OT come from `GET /api/hr/day-status/summary` (no 160h assumption)

Wave 1 + Wave 2 protections remain intact (48 backend tests green).

---

## 2. Files changed

### Backend

| File | Change |
|---|---|
| `backend/app/timeutil.py` | **New** — `get_app_timezone`, `local_now`, `local_today`, `to_local_date`, `local_day_bounds_utc` |
| `backend/app/config.py` | `app_timezone` default `Asia/Kolkata` |
| `backend/app/services/day_status_engine.py` | Employment clamp; policy `half_day_hours`; TZ via `to_local_date` |
| `backend/app/services/policy_mutation.py` | **New** — lock helpers, affected employees, ADS refresh, writable future week-off dates |
| `backend/app/services/holiday_weekoff_service.py` | Lock + refresh on holiday/policy mutations |
| `backend/app/services/payroll_service.py` | `premium_extra_factor` + `_worked_day_premium` |
| `backend/app/services/roster_service.py` | Published lock+refresh; draft no ADS refresh |
| `backend/app/routers/weekoffs.py` | Approved create/update/delete: lock + refresh |
| `backend/app/routers/hr.py` | Holiday/policy lock → HTTP 409 |
| `backend/app/routers/rosters.py` | Lock 409; `local_today` for week defaults |
| `backend/app/routers/attendance.py` | `local_today` / `local_day_bounds_utc` |
| `backend/app/routers/dashboard.py` | `local_today` |
| `backend/app/services/leave_service.py` | `local_today` for business “today” / year |
| `backend/.env.example` | `APP_TIMEZONE=Asia/Kolkata` |
| `backend/tests/test_wave3_correctness.py` | **New** Wave 3 regression suite |
| `backend/tests/test_wave2_day_status.py` | IST-aware `local_work_date` assertion |

### Frontend

| File | Change |
|---|---|
| `src/pages/Profile.tsx` | Remove 160h client calc; load monthly day-status summary |

### Docs

| File | Change |
|---|---|
| `docs/IMPLEMENTATION_PLAN.md` | P1-1…P1-9 → DONE; Wave 3 marked complete |
| `docs/WAVE_3_CORRECTNESS_REPORT.md` | This report |

---

## 3. Employment-boundary behavior

**Fields reused (no migration):** `User.joining_date`, `User.termination_date`.

**Rule in `DayStatusEngine.is_within_employment`:**

- `work_date < joining_date` → outside
- `work_date > termination_date` (when set) → outside

**Outside window:** delete any stale ADS row; `resolve_day` returns `None` (no ABSENT/LOP/PRESENT/LEAVE/WEEK_OFF/HOLIDAY).

Payroll already proration-clamps joining/termination; DayStatus now agrees so timesheet cannot invent pre-join LOP.

---

## 4. Holiday mutation behavior

**Order:** `assert_dates_writable` → mutate → `refresh_employees_on_dates` → commit.

| Operation | Lock dates | Refresh |
|---|---|---|
| Create | new date | affected employees × new date |
| Update | old + new date | old∪new employees × old∪new dates |
| Delete (soft) | old date | affected × old date |

Affected employees from existing `HolidayAppliesTo` (all / department / employment_type).

Locked month → `ValueError` → HTTP **409**; holiday unchanged.

---

## 5. Week-off mutation behavior

| Source | Behavior |
|---|---|
| Week-off **policy** create/update/assign | Refresh writable/future matching weekdays only (skip locked months); no historical locked rewrite |
| Week-off **request** approved create/update/delete | Lock date → mutate → refresh ADS |
| Pending week-off request | No lock/refresh (not authoritative) |
| **Published** roster assignment edit / publish / unpublish | Lock → mutate → refresh |
| **Draft** roster edit | No ADS refresh |

---

## 6. Payroll compensation before/after

**Before:** premium ≈ `daily_rate × (workedHoliday + workedWeekOff)` — ignored compensation enum → overstated / wrong.

**After (extra beyond package day already paid via payable days):**

| Setting | Extra cash premium | Effective total for that day* |
|---|---|---|
| `normal` | 0 | 1× |
| `ot` | 0 (existing OT approval path) | 1× cash; OT via approvals |
| `comp_off` | 0 | 1× cash; comp-off earn in engine |
| `1.5x` | +0.5 × daily_rate × present_fraction | 1.5× |
| `2x` | +1.0 × daily_rate × present_fraction | 2× |

\*Assumes the worked day is already included as a payable day in the package/LOP math (no double 2×+2× = 3×).

`daily_rate` still uses existing divisor/`_divisor` logic. Approved/paid runs remain immutable (no auto-recalc).

---

## 7. Half-day canonical rule

**Canonical:** `AttendancePolicy.half_day_hours` (minutes = hours × 60).

**Removed conflict:** engine no longer uses `expected_minutes * 0.5` as the threshold.

Leave half-day fractions unchanged:

- 0.5 present + 0.5 paid leave → payable 1  
- 0.5 present + 0.5 unpaid → payable 0.5, LOP 0.5  

---

## 8. Timezone strategy

- Config: `APP_TIMEZONE` / `settings.app_timezone` (default `Asia/Kolkata`)
- Helpers: `backend/app/timeutil.py`
- Storage timestamps remain UTC; business dates resolve in APP_TIMEZONE
- Consumers: attendance “today”, dashboard, DayStatus `local_work_date`, leave year/today, roster week defaults, policy mutation “today”

---

## 9. Profile before/after

**Before:** client punch aggregation + hardcoded `workedHours - 160` OT.

**After:** `getMonthlyDayStatus` → worked/expected/overtime minutes and week-offs from ADS monthly summary. Visual layout preserved.

---

## 10. Tests added

`backend/tests/test_wave3_correctness.py`:

- Employment clamp + stale ADS delete
- Premium factors / 1.5× / 2× totals
- Half-day policy threshold vs expected/2
- Holiday create lock-before-mutate; update old+new; delete refresh
- Writable date filter; draft roster no refresh; published roster lock+refresh
- APP_TIMEZONE / IST midnight UTC→local date

Wave 2 `local_work_date` assertion updated for IST.

---

## 11–12. Tests executed / results

| Suite | Result |
|---|---|
| `pytest tests/` (Wave 1+2+3) | **48 passed** |
| `npm run build` | **PASS** |
| Backend import (`app.main`) | **PASS** |

---

## 13. Migrations

**No.** Employment end date already existed as `termination_date`. Timezone is config. Compensation/half-day use existing columns/enums.

---

## 14. Deferred issues

- Leave cancel UX / full P2 leave cancel path polish  
- Profile still uses leave form labeled historically as “week-off” (P2-3 UX inconsistency)  
- `ot` compensation remains “no cash premium” — does not invent a new OT workflow  
- Some non-business `date.today()` usages (e.g. payroll `payment_date` default, document upload stamps) left as-is  
- Punch-level `attendance_policy_service` late checks may still use process-local `astimezone()` for wall-clock; day boundaries for ADS use APP_TIMEZONE  

---

## 15. Operational configuration

Set on server if not already:

```env
APP_TIMEZONE=Asia/Kolkata
```

(Already defaulted in code; document in `backend/.env` for ops clarity.)

---

## 16. Risks / manual smoke tests

1. Mid-month joiner → Timesheet/Payroll: no pre-join LOP  
2. Create/delete holiday → ADS/Timesheet update; locked month → 409  
3. Published roster week-off toggle → ADS update; draft → no ADS change  
4. Worked holiday `1.5x` / `2x` → payroll premium line matches semantics above  
5. Policy half-day hours ≠ full/2 → DayStatus uses configured hours  
6. Near local midnight → dashboard / attendance today / quick / ADS agree  
7. Profile hours/OT match admin Timesheet month totals  

---

## Quality gate checklist

1. Previous tests pass — yes (48)  
2. New tests pass — yes  
3. Frontend production build — yes  
4. Backend starts — yes  
5. No unnecessary migration — yes  
6. No unrelated features — yes  
7. No duplicate SoT — yes  
8. DayStatusEngine authoritative — yes  
9. ADS authoritative downstream — yes  
10. Locked payroll immutable via holiday/WO/roster — yes  
11. No Profile 160h — yes  
12. Timezone centralized — yes  
13. Diff scoped to Wave 3 — yes  
14. Docs updated — yes  
