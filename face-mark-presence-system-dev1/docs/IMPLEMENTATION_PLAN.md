# Present Sir — Existing-Feature Fix Backlog

**Source:** Post-audit prioritization (2026-07-23)  
**Rule:** Fix existing features first. Do not add new product modules until this backlog is closed.  
**Architecture spine:** DayStatusEngine → `attendance_daily_summaries` → Timesheet + Payroll (same data)

---

## Core correctness chain (immediate target)

```
1. Authentication / security fixes
        ↓
2. Attendance mutation correctness
        ↓
3. DayStatusEngine refresh on every attendance write
        ↓
4. Employment + roster + leave resolution polish
        ↓
5. attendance_daily_summaries as single SoT
   ┌────┴────┐
Timesheet   Payroll
   │           │
same data   same data
        ↓
6. Payroll locking / snapshot correctness
```

---

## Status legend

| Tag | Meaning |
|---|---|
| **OPEN** | Needs implementation or hardening |
| **PARTIAL** | Partially true in code; gaps remain |
| **VERIFY** | Audit suggests mostly done — confirm with tests before closing |
| **DONE** | Verified in code; keep regression coverage |

---

## P0 — Correctness & security (do first)

| ID | Area | Fix required | Status | Code notes |
|---|---|---|---|---|
| P0-1 | Admin Auth | Remove/protect public admin registration | **DONE** | Bootstrap only when zero admins; FE clarifies bootstrap. Wave 1. |
| P0-2 | Employee Auth | Remove/protect public employee registration if admin-created only | **DONE** | `ALLOW_PUBLIC_EMPLOYEE_REGISTRATION=false` default; FE register closed. Wave 1. |
| P0-3 | Secrets | Reject production startup with default/weak `SECRET_KEY` | **DONE** | `assert_production_secret_safe` + tests. Wave 1. |
| P0-4 | Quick Attendance | Secure existing kiosk endpoint | **DONE** | `X-Kiosk-Token` / `KIOSK_API_TOKEN` + `VITE_KIOSK_TOKEN`. Wave 1. |
| P0-5 | Attendance → Day Status | Regenerate DayStatusEngine after create/update/approve/reject/delete | **DONE** | Refresh after attendance mutations. Wave 2. |
| P0-6 | Payroll Lock | Every attendance mutation respects locked payroll periods | **DONE** | Attendance paths + leave **approve** lock-before-mutate. Wave 2. |
| P0-7 | Manual Attendance | PENDING never contributes to payable attendance until approved | **DONE** | Verified engine filter; preserved after refresh hooks. |

### P0 acceptance criteria

- [x] Public admin register closed or bootstrap-only with documented ops procedure  
- [x] Public employee register closed or gated  
- [x] Production refuses weak secrets (verified on deploy env)  
- [x] Kiosk cannot mark attendance without a controlled credential  
- [x] Any attendance status change updates `attendance_daily_summaries` for the affected local date(s)  
- [x] Locked/approved/paid payroll months reject attendance **and** leave-driven day-status mutations that would alter that month  
- [x] Pending punches never appear as PRESENT/payable in ADS  

**Wave 1 + Wave 2 completed 2026-07-23.** See `docs/WAVE_1_2_IMPLEMENTATION_REPORT.md`.

---

## P1 — Resolution & pay-rule fidelity

| ID | Area | Fix required | Status | Code notes |
|---|---|---|---|---|
| P1-1 | Day Status | Clamp resolution to `joining_date` / `termination_date` | **DONE** | Outside window: delete stale ADS, return `None` (no ABSENT/LOP). Wave 3. |
| P1-2 | Roster | Only published roster assignments affect week-off/day status | **DONE** | Published upsert/publish/unpublish: lock + ADS refresh; draft does not refresh. Wave 3. |
| P1-3 | Holiday Pay | `1.5x` / `2x` compensation must affect payroll | **DONE** | `premium_extra_factor`: +0.5 / +1.0 beyond package day. Wave 3. |
| P1-4 | Week-Off Pay | Worked week-off compensation consistent with holiday rules | **DONE** | Same `_worked_day_premium` path using week-off policy compensation. Wave 3. |
| P1-5 | Timesheet | Always read `attendance_daily_summaries`; remove parallel calcs | **DONE** | Admin Timesheet + Profile use day-status summary APIs. Wave 3. |
| P1-6 | Profile | Remove hardcoded/client-side 160h monthly OT/hour calc | **DONE** | Profile loads `GET /api/hr/day-status/summary`. Wave 3. |
| P1-7 | Half Day | Resolve `half_day_hours` vs `expected_hours × 0.5` | **DONE** | Engine uses `AttendancePolicy.half_day_hours`. Wave 3. |
| P1-8 | Timezone | Same configured TZ for attendance, dashboard, kiosk, `/today` | **DONE** | `APP_TIMEZONE` + `app/timeutil.py`; attendance/dashboard/engine. Wave 3. |
| P1-9 | Overnight | Day resolution around midnight / overnight shifts | **DONE** | TZ-aware `local_work_date` + IST/UTC midnight tests; ±6h pairing preserved. Wave 3. |

### P1 acceptance criteria

- [x] Pre-join / post-termination days are not LOP/ABSENT in ADS  
- [x] Draft roster OFF never affects ADS  
- [x] Worked holiday/week-off pay matches configured compensation  
- [x] Timesheet and payroll numbers for the same month match ADS  
- [x] Profile does not invent OT hours  
- [x] One half-day rule used everywhere  
- [x] All “today” windows use one timezone setting  
- [x] Overnight fixture tests pass  

---

## P2 — Consistency, payroll integrity, authz, face reliability

| ID | Area | Fix required | Status | Code notes |
|---|---|---|---|---|
| P2-1 | Leave | Day-status regen consistent on approve/reject/cancel | **PARTIAL** | Approve regenerates range; verify reject/cancel paths. Combine with P0-6 lock. |
| P2-2 | Comp-Off | Earn/consume stays synchronized with balances | **PARTIAL** | Earn on worked holiday/WO; consume on approve. Add sync checks. |
| P2-3 | Week-Off UX | Profile leave-based “week-off” vs `/api/weekoffs` inconsistency | **OPEN** | Profile calls `applyLeave`; `weekoffService` largely unused. |
| P2-4 | Payroll Labels | `days_absent` displayed/used as LOP where semantics differ | **OPEN** | Record field stores `lopDays`. Rename UI/API labels. |
| P2-5 | Payroll Recalc | Approved/paid snapshots cannot silently change | **VERIFY / PARTIAL** | Service blocks recalc when locked; ensure leave/ADS regen cannot mutate inputs under lock (P0-6). |
| P2-6 | Payroll Pre-check | Stale/unresolved attendance cannot pass processing | **OPEN** | Precheck should require ADS freshness / no pending punches in period / regenerate before calculate (calculate already regenerates — harden precheck messaging). |
| P2-7 | Face Recognition | Reliability/performance without model replacement | **OPEN** | Full-scan ensembles; thresholds/tuning/caching only. |
| P2-8 | Face Enrollment | Consistent no-face / multi-face / duplicate / error handling | **PARTIAL** | Errors exist; unify FE+BE messaging. |
| P2-9 | Authorization | IDOR / role enforcement audit on existing endpoints | **OPEN** | Spot-check list/by-email/slip/upload paths. |
| P2-10 | Documents/Payslips | No cross-employee private file access | **PARTIAL** | Payslip IDOR guarded on `/slip/{id}`; verify MinIO URLs + uploads. |

---

## P3 — Hygiene

| ID | Area | Fix required | Status |
|---|---|---|---|
| P3-1 | Error Handling | Standardize API errors + FE error states | **OPEN** |
| P3-2 | Validation | Remove FE/BE validation mismatches | **OPEN** |
| P3-3 | Dead Code | Remove unused Redux / unused React Query usage / dead services after confirm | **OPEN** |
| P3-4 | Configuration | Resolve unused `standard_work_days_per_month=26` (use or remove) | **OPEN** |

---

## Implementation waves (map backlog → work order)

### Wave 1 — Auth & secrets (P0-1 … P0-4, part of P0-3)

| Work | Primary files |
|---|---|
| Gate/disable admin register | `backend/app/routers/auth.py`, `src/pages/admin/AdminRegister.tsx` |
| Gate/disable employee register | `auth.py`, `src/pages/Register.tsx`, `AuthContext` |
| Kiosk credential | `attendance.py` quick handler, `QuickAttendance.tsx`, `config.py` |
| Secret defaults cleanup | `config.py`, `.env.example`, deploy docs |

**No migrations** expected (unless kiosk tokens table chosen).

### Wave 2 — Attendance mutations + DayStatus refresh + lock (P0-5 … P0-7, P0-6)

| Work | Primary files |
|---|---|
| After create/update/delete attendance → `resolve_day` | `routers/attendance.py`, helper in `day_status_engine.py` |
| Approve/reject status change → refresh ADS | same |
| Leave approve/reject/cancel → lock check + regen | `leave_service.py`, `routers/leaves.py` |
| Regression: pending ignored | tests around `_attendance_pair` |

**No new tables.** Keep `attendance_daily_summaries` as SoT.

### Wave 3 — Correctness (P1-1 … P1-9) — **DONE 2026-07-23**

Absorbed former Wave 3–5 backlog items into one correctness wave. See `docs/WAVE_3_CORRECTNESS_REPORT.md`.

| Work | Primary files |
|---|---|
| Clamp joining/termination | `day_status_engine.py` |
| Holiday/week-off lock + ADS refresh | `holiday_weekoff_service.py`, `policy_mutation.py`, `weekoffs.py`, `roster_service.py` |
| Holiday/week-off multipliers | `payroll_service.py` (`premium_extra_factor`, `_worked_day_premium`) |
| Remove Profile 160h | `src/pages/Profile.tsx` |
| Half-day single rule | `day_status_engine.py` ← `AttendancePolicy.half_day_hours` |
| `APP_TIMEZONE` | `config.py`, `timeutil.py`, attendance/dashboard/leave/rosters |

### Wave 4 — (renumbered) Payroll integrity & labels (P2-4 … P2-6)

| Work | Primary files |
|---|---|
| Label LOP vs absent | schemas, Payroll FE, exports |
| Precheck freshness / pending punches | `payroll_service` precheck |
| Snapshot immutability regression | approve/paid + leave attempt |

### Wave 5 — Face, authz, documents (P2-7 … P2-10)

Tuning + IDOR pass + media ACL review.

### Wave 8 — Hygiene (P3)

Errors, validation alignment, dead code, unused config.

---

## Explicit non-goals (until backlog cleared)

- New leave/holiday/payroll product modules beyond fixing existing behavior  
- Replacing OpenCV face model (P2 allows tuning only; full model swap is later/optional)  
- Payment gateway / bank transfer integrations  
- Greenfield payroll rewrite — extend `_apply_calculation` and run lifecycle  

---

## What already aligns (do not re-architect)

| Piece | Keep |
|---|---|
| `DayStatusEngine` priority chain | Holiday → Week-off → Leave → Attendance → Absent |
| `attendance_daily_summaries` | Materialized SoT for timesheet + payroll |
| Payroll run states | draft → calculated → under_review → approved → paid |
| Attendance lock helper | `assert_attendance_month_writable` — extend coverage, don’t replace |
| Admin Timesheet data source | Already day-status API |
| PENDING ≠ payable | Already in engine — preserve after refresh hooks |

---

## Suggested first commit series (when implementation starts)

1. **auth-security:** close public registers + kiosk gate + secret defaults  
2. **day-status-on-attendance:** resolve_day hooks + tests  
3. **payroll-lock-leave:** leave mutations respect locked months  
4. **employment-clamp + half-day + tz**  
5. **holiday-weekoff-premium**  
6. **profile/timesheet cleanup + payroll labels/precheck**  

---

## Related docs

- `docs/CURRENT_SYSTEM_AUDIT.md` — verified baseline  
- `docs/GAP_ANALYSIS.md` — current vs required  
- `docs/CURRENT_BUSINESS_LOGIC.md` — formulas  
- `docs/CURRENT_DATA_FLOW.md` — connection matrix  
