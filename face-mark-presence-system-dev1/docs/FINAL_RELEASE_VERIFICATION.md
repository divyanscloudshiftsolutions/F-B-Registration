# Present Sir — Final Release Verification

**Date:** 2026-07-23  
**Scope:** Final stabilization & release verification (Waves 1–3 already complete)  
**Migrations:** None

---

## Release Decision

**READY WITH KNOWN ISSUES**

Automated regression and confirmed defect fixes are green. Remaining items are non-blocking known limitations (manual UAT smoke still required on the deployment environment before production cutover).

---

## Baseline (zero-change)

| Check | Result |
|---|---|
| Backend tests | **48 passed** |
| Frontend production build | **PASS** |
| Backend import/startup | **PASS** (`Present Sir API`, `APP_TIMEZONE=Asia/Kolkata`) |
| Warnings | DeprecationWarnings from FastAPI/Starlette `asyncio.iscoroutinefunction` (library); Pydantic alias warnings on register schema — non-blocking |

---

## Final Architecture Verification

| Rule | Status |
|---|---|
| DayStatusEngine = authoritative daily resolver | **CONFIRMED** |
| `attendance_daily_summaries` = downstream SoT for Timesheet / Profile / Payroll | **CONFIRMED** |
| Raw punches = audit evidence; PENDING ignored by engine | **CONFIRMED** (Wave 2 tests) |
| Payroll lock = historical mutation boundary | **CONFIRMED** (attendance / leave / holiday / week-off / published roster) |

---

## Functional Verification

Evidence is primarily automated tests + static code path review. Live DB face recognition and full payroll cycle require manual smoke on staging.

| Journey | Result | Evidence |
|---|---|---|
| Employee Auth | **PASS** | Registration blocked (`test_public_employee_registration_blocked`); JWT role isolation (`test_get_current_admin_rejects_employee_role`) |
| Admin Auth | **PASS** | Bootstrap-only when admin exists (`test_admin_registration_blocked_when_admin_exists`) |
| Face Enrollment | **PARTIAL** | Code paths + authz present (`face.py` `_ensure_face_access`); no live camera/OpenCV fixture in CI |
| Face Attendance | **PARTIAL** | Lock → mutate → ADS refresh wired (`test_create_attendance_order_lock_then_refresh`); live recognition needs smoke |
| Manual Attendance | **PASS** (logic) | PENDING ignored by DayStatus; approve refreshes; lock → 409 |
| Quick Attendance | **PASS** | Fail-closed kiosk (`test_kiosk_*`, `test_quick_attendance_*`) |
| Leave | **PASS** (logic) | Lock-before-approve (`test_leave_approve_checks_lock_before_mutation`); reject no lock |
| Holiday | **PASS** | Lock + ADS refresh (`test_create/update/delete_holiday_*`) |
| Week-Off | **PASS** | Policy future writable refresh; approved requests lock+refresh |
| Roster | **PASS** | Draft no ADS; published lock+refresh (`test_draft_roster_*`, `test_published_roster_*`) |
| Employment boundaries | **PASS** | Clamp + stale ADS delete (`test_is_within_employment_*`, `test_resolve_day_outside_*`) |
| Half-day | **PASS** | Policy `half_day_hours` (`test_half_day_*`) |
| Timezone | **PASS** | `APP_TIMEZONE` + policy late/early (`test_utc_*`, `test_evaluate_checkin_uses_app_timezone_*`) |
| Timesheet | **PASS** (contract) | Admin Timesheet uses `getTimesheetFromDayStatus` / ADS |
| Profile | **PASS** | `getMonthlyDayStatus`; no 160h calc |
| Payroll | **PARTIAL** | Premium/LOP/lock unit-covered; full create→paid cycle needs manual |
| Payslip | **PASS** (authz) | `/slip/{id}` employee self-only; PDF labels LOP |

---

## Payroll Correctness

| Item | Status |
|---|---|
| Employment boundaries | PASS (engine + payroll proration) |
| Half-day | PASS (`half_day_hours`) |
| LOP | PASS — `days_absent` column stores LOP; API/UI/PDF/CSV use **LOP** / `lopDays` |
| OT | PASS — approved OT minutes only |
| Holiday 1.5x / 2x | PASS — extra +0.5 / +1.0 beyond package day |
| Week-off compensation | PASS — same premium path |
| Payroll lock | PASS — mutations blocked |
| Snapshot immutability | PASS — approved/paid not auto-recalculated |

---

## Security Verification

| Item | Status |
|---|---|
| Public employee registration | Disabled by default |
| Kiosk | Fail-closed if token missing/invalid |
| JWT role isolation | Employee cannot use admin deps |
| **IDOR `GET /api/users/{id}`** | **FIXED** this release — employees restricted to self (aligned with by-email) |
| Payslip authorization | Employee cannot read another slip |
| Face data | Self/admin only (`_ensure_face_access`) |
| Production secrets | Weak `SECRET_KEY` rejected in production |
| Documents | Upload requires auth; cross-user MinIO URL leakage not fully automated — see Known Issues |

---

## Timezone Verification

| Item | Status |
|---|---|
| `APP_TIMEZONE` default Asia/Kolkata | PASS |
| Attendance / dashboard today | PASS (`local_today`, `local_day_bounds_utc`) |
| DayStatus work date | PASS (`to_local_date`) |
| **Late/early policy** | **FIXED** — no longer uses OS-local `.astimezone()` |
| Leave conflict dates / month list | Fixed to APP_TIMEZONE bounds |
| Midnight IST vs UTC | Covered by Wave 3 + release policy tests |

---

## Defects Found

### RV-1 — Attendance policy late/early depended on OS timezone

| | |
|---|---|
| **Severity** | **HIGH** (correctness / cross-host inconsistency) |
| **Feature** | Attendance policy evaluation |
| **Reproduction** | Punch `04:00 UTC` with shift 09:00 IST + 15m grace; on a UTC OS host, naive `.astimezone()` treated wall clock as 04:00 → not late; expected late (09:30 IST) |
| **Expected** | Late/early/shift interpretation use `APP_TIMEZONE` |
| **Actual** | Used process-local `astimezone()`; check-in day window used timestamp `.date()` |
| **Root cause** | Pre-Wave-3 leftover in `attendance_policy_service` |
| **Fix** | `_as_app_local`, `local_day_bounds_utc` for same-day check-in pairing; also leave conflict bounds + kiosk checkout display + month list |
| **Regression test** | `test_evaluate_checkin_uses_app_timezone_not_os_local`, `test_evaluate_checkout_early_departure_uses_app_timezone` |

### RV-2 — Employee IDOR on `GET /api/users/{user_id}`

| | |
|---|---|
| **Severity** | **BLOCKER** (cross-user PII) |
| **Feature** | Users API |
| **Reproduction** | Authenticated employee A calls `GET /api/users/{B_id}` → 200 with B’s email/name |
| **Expected** | 403 for other employees (same as `/by-email`) |
| **Actual** | Any authenticated user could fetch any user id |
| **Root cause** | Missing role/self check on route |
| **Fix** | Restrict employees to self; admins unrestricted |
| **Regression test** | `test_get_user_by_id_idor_forbidden_for_other_employee`, `test_get_user_by_id_allows_self` |

### Cleanup candidates reviewed (no code change)

| Candidate | Decision |
|---|---|
| Profile “week-off” UX | **NOT A DEFECT** — UI already titled “Request Leave”, uses Leave API; leftover variable names only |
| Payroll `days_absent` naming | **NOT A DEFECT for release** — stores LOP; API/UI/PDF/CSV already say LOP/`lopDays`; column rename would need migration |

---

## Known Issues

1. **Live face recognition / camera / MinIO** not exercised in CI — require staging smoke.  
2. **Full payroll run → payslip PDF** end-to-end not automated — require manual process.  
3. **Upload endpoints** authenticate but do not bind uploaded object ACLs per employee; risk if URLs are guessed/shared (MEDIUM, operational).  
4. **Library DeprecationWarnings** (FastAPI/Starlette asyncio helpers) — non-functional.  
5. Internal DB column `payroll_records.days_absent` legacy name vs LOP semantics — documented; no migration for naming-only.

---

## Deferred Enhancements (NOT required for this release)

- Leave cancellation UX  
- New OT approval product features beyond existing approvals  
- ESI / payment gateway / sandwich leave  
- Rotational scheduling product expansion  
- Face model replacement  
- Rename `days_absent` column  

---

## Configuration Checklist

Set on production (never commit real secrets):

```env
ENVIRONMENT=production
SECRET_KEY=<long-random-strong-secret>
DATABASE_URL=postgresql+psycopg://...
APP_TIMEZONE=Asia/Kolkata
ALLOW_PUBLIC_EMPLOYEE_REGISTRATION=false
KIOSK_API_TOKEN=<long-random-token>
# Frontend must match:
# VITE_KIOSK_TOKEN=<same as KIOSK_API_TOKEN>
CORS_ORIGINS=...,https://facemark.app.cloudshiftsolutions.in
# MinIO / face thresholds as existing .env.example
```

Production must refuse weak `SECRET_KEY`. Kiosk must fail closed if token empty.

---

## Manual Smoke Checklist

See `docs/RELEASE_SMOKE_CHECKLIST.md`.

---

## Final Test Results

| Suite | Result |
|---|---|
| Backend `pytest tests/` | **54 passed** (48 baseline + 6 release) |
| Frontend `npm run build` | **PASS** (baseline; no FE code changes this verification) |
| Backend startup/import | **PASS** |
| Lint (`npm run lint`) | Not required for gate; available but not treated as release blocker |

---

## Release Recommendation

**READY FOR STAGING / UAT**

Reasons:

- Wave 1–3 invariants hold under automated regression (54 tests).  
- Two confirmed release defects (policy TZ, user IDOR) fixed with tests.  
- No migrations.  
- Production cutover should follow successful execution of `RELEASE_SMOKE_CHECKLIST.md` on the CloudShift host (`192.168.1.150` / deployed URL), especially face, payroll cycle, and lock 409 paths.

After successful staging smoke with no new blockers: promote to **READY FOR PRODUCTION**.
