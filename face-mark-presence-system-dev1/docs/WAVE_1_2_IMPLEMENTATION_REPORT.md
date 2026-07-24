# Wave 1 & 2 Implementation Report

**Date:** 2026-07-23  
**Scope:** Existing-feature fixes only (auth/kiosk security + DayStatus freshness + payroll lock integrity)  
**Migrations:** None

---

## 1. Files changed

### Backend

| File | Change |
|---|---|
| `backend/app/security.py` | **New** — weak-secret helpers, kiosk token validation (`secrets.compare_digest`) |
| `backend/app/config.py` | `allow_public_employee_registration` (default false), `kiosk_api_token` |
| `backend/app/main.py` | Use `assert_production_secret_safe` (same production guard, shared helper) |
| `backend/app/routers/auth.py` | Block public employee register unless config flag true |
| `backend/app/routers/attendance.py` | Kiosk token on `/quick`; DayStatus refresh after create/update/delete/checkin/checkout/quick |
| `backend/app/routers/leaves.py` | Map payroll-lock `ValueError` → HTTP 409 |
| `backend/app/services/leave_service.py` | Lock check **before** approve mutation; reuse `assert_attendance_month_writable` |
| `backend/app/services/day_status_engine.py` | `local_work_date`, `refresh_user_days`, `refresh_for_timestamps` |
| `backend/.env.example` | Document `ALLOW_PUBLIC_EMPLOYEE_REGISTRATION`, `KIOSK_API_TOKEN` |
| `backend/requirements-dev.txt` | **New** — pytest, httpx |
| `backend/tests/*` | Wave 1 + Wave 2 regression tests |

### Frontend

| File | Change |
|---|---|
| `src/services/quickAttendanceService.ts` | Send `X-Kiosk-Token` from `VITE_KIOSK_TOKEN` |
| `src/pages/Register.tsx` | Closed registration message + link to login |
| `src/pages/Index.tsx` | Remove public register CTAs → Sign In |
| `src/components/AuthForm.tsx` | Remove Register link |
| `src/components/AdminAuthForm.tsx` | Clarify bootstrap-only admin register link |
| `.env.example` | `VITE_KIOSK_TOKEN` |

### Docs

| File | Change |
|---|---|
| `docs/IMPLEMENTATION_PLAN.md` | Mark Wave 1/2 items complete |
| `docs/WAVE_1_2_IMPLEMENTATION_REPORT.md` | This report |

---

## 2. Functions changed (key)

| Function | Role |
|---|---|
| `validate_kiosk_token` / `require_kiosk_token` | Gate `/api/attendance/quick` |
| `assert_production_secret_safe` | Production weak `SECRET_KEY` refusal |
| `register_user` | 403 when public registration disabled |
| `register_admin` | Unchanged bootstrap (zero admins only) — verified |
| `_ensure_writable` | Unchanged semantics (409 on lock) |
| `_refresh_day_status` | Calls `DayStatusEngine.refresh_for_timestamps` after mutation |
| `DayStatusEngine.refresh_for_timestamps` | Resolve one employee + affected local dates (±1 if adjacent) |
| `LeaveService._assert_date_range_writable` | Pre-approve lock across months in leave range |
| `LeaveService.approve_or_reject` | Lock → mutate → regenerate (approve only) |

---

## 3. Security behavior — before / after

| Item | Before | After |
|---|---|---|
| `POST /api/auth/register` | Open | **403** unless `ALLOW_PUBLIC_EMPLOYEE_REGISTRATION=true` |
| `POST /api/auth/admin/register` | Bootstrap if 0 admins, else 403 | **Same** (preserved) |
| `POST /api/attendance/quick` | Unauthenticated | Requires `X-Kiosk-Token` matching `KIOSK_API_TOKEN` (fail closed if unset → 503) |
| Production weak `SECRET_KEY` | Refused at startup | **Same** (shared helper + tests) |
| Employee JWT → admin APIs | Blocked via `get_current_admin` | **Verified** with test; not redesigned |

---

## 4. Attendance freshness — before / after

| Item | Before | After |
|---|---|---|
| Check-in / check-out / quick / create / update / delete | Mutate only | Lock → mutate → `flush` → `resolve_day` (via refresh helpers) → `commit` |
| PENDING manual punch | Ignored by engine | Still ignored; ADS still refreshed (typically ABSENT/unchanged payable) |
| Approve pending → approved | Status change only | Status change + ADS refresh |
| Date move A→B | **Not supported** by `AttendanceUpdateRequest` (no timestamp field) | Documented; N/A |

---

## 5. Payroll-lock behavior

| Path | Behavior |
|---|---|
| Attendance checkin/checkout/quick/create/update/delete | `_ensure_writable` **first**; on lock → 409; no mutation; no ADS change |
| Leave **approve** spanning locked month | `_assert_date_range_writable` **first**; on lock → ValueError → HTTP 409; no balance/status/ADS change |
| Leave **reject** (pending only) | No ADS impact historically; lock not required; balances pending cleared |

---

## 6. Leave-lock behavior

- Approve: all months in `[start_date, end_date]` checked before any write.
- Reject: no DayStatus regeneration (pending leave never in ADS).
- Cancel of approved leave: **NOT IMPLEMENTED** in codebase — deferred.

---

## 7. Tests added

| File | Coverage |
|---|---|
| `tests/test_wave1_security.py` | Weak secret, kiosk token accept/reject/unconfigured |
| `tests/test_wave1_auth_api.py` | Public register 403, admin register closed, kiosk 401/409 lock path, employee≠admin |
| `tests/test_wave2_day_status.py` | refresh helpers, leave lock-before-mutate, reject path |
| `tests/test_wave2_attendance_hooks.py` | 409 mapping, refresh error propagation, lock→refresh order |

---

## 8. Tests executed

```text
backend/venv/Scripts/python.exe -m pytest tests/ -v
→ 26 passed
```

```text
npm run build
→ success (exit 0)
```

---

## 9. Test results

**26 passed**, 0 failed (Wave 1 + Wave 2).

---

## 10. Remaining risks / ops notes

1. **Deploy must set** `KIOSK_API_TOKEN` (backend) and matching `VITE_KIOSK_TOKEN` (frontend). Empty backend token → kiosk returns **503**.
2. Existing local `backend/.env` may lack `KIOSK_API_TOKEN` until ops updates it.
3. Full end-to-end face recognition against live DB/MinIO was not exercised in automated tests (mocked past kiosk auth into lock path).
4. Holiday/week-off CRUD still does **not** auto-refresh ADS (pre-existing). Documented below — not fixed in this wave.
5. `include_adjacent=True` refreshes ±1 day around punches (cheap insurance for overnight window); not a full month regenerate.

---

## 11. Intentionally NOT fixed (later waves)

| Item | Why deferred |
|---|---|
| Holiday 1.5x / 2x payroll multipliers | Explicitly out of Wave 1–2 scope |
| Joining/termination clamp in DayStatusEngine | Next wave (P1-1) |
| Profile 160h OT client calc | P1-6 |
| Unified timezone `APP_TIMEZONE` | P1-8 |
| Week-off Profile vs `/api/weekoffs` UX | P2-3 |
| Payroll `days_absent` label semantics | P2-4 |
| Holiday/week-off edit → DayStatus refresh + lock | Discovered: CRUD does not regenerate ADS today; add when touching P1 holiday pay |
| Face model replacement | Out of scope |
| Leave cancel of approved requests | Endpoint does not exist |
| Attendance timestamp edit (date A→B) | Schema does not allow timestamp on PATCH |

---

## Verified existing behavior (inspected, not rewritten)

- Production weak `SECRET_KEY` refusal  
- DayStatusEngine uses **approved** punches only  
- Published roster only for week-off  
- Attendance mutations already had payroll lock (extended leave approve)  
- Admin Timesheet already reads day-status API  
- Payroll consumes `attendance_daily_summaries`  
- Admin bootstrap registration when zero admins  

---

## Ops checklist after deploy

- [ ] Set `KIOSK_API_TOKEN` on server `.env`  
- [ ] Set `VITE_KIOSK_TOKEN` in frontend `.env.local` to the **same** value; rebuild/restart frontend  
- [ ] Confirm `ALLOW_PUBLIC_EMPLOYEE_REGISTRATION` is unset/false  
- [ ] Confirm `ENVIRONMENT=production` with strong `SECRET_KEY`  
- [ ] Smoke: employee login, admin login, admin create employee, kiosk with token, locked-month punch → 409  
