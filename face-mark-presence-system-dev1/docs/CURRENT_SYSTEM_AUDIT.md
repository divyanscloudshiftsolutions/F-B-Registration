# Present Sir — Current System Audit

**Audit date:** 2026-07-22  
**Scope:** Verified baseline from actual repository code only  
**Rule:** No assumptions from filenames, UI labels, or expected HRMS behavior  
**Code modifications:** None (documentation only)

---

## Executive Summary

### 1. What Present Sir currently does

Present Sir is a monorepo face-recognition attendance + HRMS application:

- **Employees** register/login, enroll faces, check in/out (face or manual), request leave, view payslips.
- **Admins** manage employees, settings (departments, employment types, document types, attendance policies), holidays, week-off policies, leave types, weekly shift roster, attendance approval, timesheet (from day-status engine), overtime approvals, and a multi-step payroll cycle (draft → calculated → under review → approved → paid) with PDF payslips.
- **Public kiosk** at `/quick-attendance` recognizes faces without login and auto check-in/check-out.

### 2. Overall architecture

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind + shadcn/Radix |
| Backend | FastAPI 0.115 + Uvicorn |
| ORM | SQLAlchemy 2.0 |
| DB | PostgreSQL (`presentsir`) via `psycopg` |
| Migrations | Alembic (8 revisions) |
| Auth | JWT (HS256) + bcrypt; separate localStorage keys for employee/admin |
| Face | OpenCV Haar cascade + 64×64 grayscale L2-normalized pixel vectors |
| Storage | MinIO/S3 via boto3 (local storage disabled at runtime) |
| PDF | reportlab |
| Deploy | CloudShift home server (`192.168.1.150`), ports 8001/8080; `backend/docker-compose.yml` is Postgres-only |

### 3. What is working correctly (verified)

- Separate employee/admin login endpoints with role rejection cross-check.
- Backend admin enforcement via `get_current_admin` (DB `user_role`, not frontend-only).
- Face enrollment (3–8 samples) → individual embeddings + ensemble mean vector.
- Face / quick attendance auto-approved; manual attendance pending.
- Attendance month lock when payroll run is calculated/approved/paid.
- Leave apply/approve with balances, half-day, comp-off consume, sandwich skip of holiday/week-off days.
- Holiday + week-off policy + roster week-off → Day Status Engine.
- Timesheet and payroll both consume `attendance_daily_summaries` via Day Status Engine.
- Payroll run lifecycle with recalculation, adjustments, reopen, CSV/XLSX export, payslip PDF on approve.
- Payslip IDOR guard on `GET /api/payroll/slip/{id}` for employees.

### 4. What is partially implemented

- **Day status freshness:** Engine exists and is used by payroll/timesheet, but **attendance punches do not regenerate day status** (only leave approve, payroll calculate, OT sync, or admin “Rebuild”).
- **Holiday/week-off work compensation:** Enum supports `normal/ot/1.5x/2x/comp_off`; payroll premium is always **1× extra daily rate**, not the configured multiplier.
- **Rotational week-off:** Model/policy type exists; UI creates `fixed` policies; rotational offs rely on published roster `is_week_off`.
- **Employee week-off requests** (`weekoff_requests` API): backend exists; Profile “week-off” UI actually calls **leave apply**, not weekoffs API. `weekoffService.ts` is largely unused.
- **ESI/UAN fields:** Stored on user; **not used in payroll deductions**.
- **`standard_work_days_per_month = 26`** in config: **not used** by payroll divisor logic.
- React Query / Redux declared but unused for data fetching (pages use `useEffect` + `useState`).

### 5. What is missing / NOT IMPLEMENTED

- Hard delete of employees (no DELETE employee endpoint).
- Server-side logout / token revocation.
- Background schedulers / cron.
- Deep-learning face model (InsightFace/face_recognition) — pixel-vector only.
- ESI contribution calculation.
- Automatic day-status update on every attendance write.
- Employee-facing roster UI (`GET /api/rosters/my-week` exported but unused in pages).
- Cooldown on quick attendance (only “already completed today” block).
- Explicit timezone configuration (`Asia/Kolkata`) — relies on server local + UTC mix.

### 6. Most serious logical problems

1. **Day status not updated on attendance** → timesheet/payroll can be stale until regenerate/calculate.  
2. **Pending manual attendance = invisible to Day Status Engine** (only `approved` punches count) → unpaid LOP until admin approves.  
3. **`days_absent` in payroll stores LOP days**, not pure absences (includes unpaid leave).  
4. **Worked holiday premium ignores configured 1.5x/2x** multipliers.  
5. **DayStatusEngine does not filter joining/termination** when generating daily rows → pre-join/post-term days can appear ABSENT in summaries (payroll eligibility/proration separately mitigate salary impact).  
6. **Profile overtime uses hardcoded 160 hours/month** independently of backend engine.  
7. **UTC vs local day boundaries** inconsistently applied across attendance “today”, dashboard, and day-status windows.

### 7. Most serious security problems

| Severity | Issue |
|---|---|
| **CRITICAL** | `POST /api/attendance/quick` is **unauthenticated** — anyone who can reach the API can attempt face recognition and mark attendance. |
| **HIGH** | Public `POST /api/auth/register` creates employees without admin approval. |
| **HIGH** | Default/weak `SECRET_KEY` in `config.py`; production guard exists but only when `ENVIRONMENT=production`. |
| **HIGH** | Default `database_url` in `config.py` embeds credentials (dev default). |
| **MEDIUM** | JWT in localStorage (XSS risk); 24h expiry; no refresh/revocation. |
| **MEDIUM** | Face biometric data (embeddings + images) in MinIO/DB; kiosk exposes recognition. |
| **LOW** | Admin bootstrap register open until first admin exists (by design). |

### 8. Payroll readiness assessment

**Partially ready for production HR payroll** if day status is rebuilt before calculate and OT is approved. Core formula is implemented (package proration, LOP, PF/PT/TDS, approved OT, holiday premium, adjustments, run states, payslips). Gaps: compensation multipliers, ESI, stale day status, pending attendance invisibility, misleading absent column, unpaid leave folded into LOP.

### 9. Leave / Holiday / Week-Off readiness

| Module | Readiness |
|---|---|
| Leave | Strong backend + employee/admin UI; connected to day status on approve |
| Holiday | CRUD + engine consumption; UI create/delete; patch unused in UI |
| Week-off | Policies + assign + roster OFF; legacy weekoff_requests underused |

### 10. Recommended next development step

**Do not redesign payroll from scratch.** First close the day-status freshness gap: regenerate day status on attendance create/update/approve/delete (and document the single source of truth). Then audit holiday premium vs compensation enum, then tighten kiosk auth.

---

## Readiness Scores

| Area | Score | Why |
|---|---|---|
| **Attendance** | **7/10** | Face/manual/quick flows work; policy flags work; lock works. Gaps: no live day-status update; timezone quirks; one session/day for face/quick; pending invisible to engine. |
| **Timesheet** | **7/10** | Admin UI reads Day Status Engine (same source as payroll). Stale until regenerate. |
| **Leave** | **8/10** | Types, balances, apply, approve, half-day, carry-forward, comp-off, sandwich skip. Reject path + attendance conflicts present. |
| **Holiday** | **7/10** | Model + admin CRUD + engine. Premium multipliers not honored in payroll. |
| **Week-Off** | **6/10** | Fixed policies + roster OFF + paid flag. Rotational partial. Legacy requests + Profile UX mismatch. |
| **Payroll** | **7/10** | Full run lifecycle + formulas + PDF. Gaps above. |
| **Security** | **4/10** | Role checks exist, but public kiosk + open registration + secret defaults are serious. |

---

## Phase 1 — Repository Architecture

### Stack inventory

| # | Topic | Actual |
|---|---|---|
| 1 | Frontend | React 18, Vite 5, TypeScript, React Router 6 |
| 2 | Backend | FastAPI (`backend/app/main.py`) |
| 3 | Database | PostgreSQL |
| 4 | ORM | SQLAlchemy 2.0 + Alembic |
| 5 | Auth | JWT (`python-jose`) + bcrypt (`passlib`); Bearer header |
| 6 | Face | OpenCV Haar + numpy pixel embeddings (`face_service.py`) |
| 7 | File storage | MinIO/S3 (`storage_backend=minio`); legacy `/static` mount |
| 8 | API | `/api/*` routers included in `main.py` |
| 9 | Config | `pydantic-settings` `backend/app/config.py` + `.env`; frontend `VITE_API_URL` / `VITE_PROXY_TARGET` |
| 10 | Deploy | `deploy/project.json`, `docs/DEPLOYMENT.md`, `.cursor/rules/cloudshift-home-server-deploy.mdc` |
| 11 | Docker | `backend/docker-compose.yml` — Postgres 16 only (no app containers) |
| 12 | Migrations | 8 Alembic versions under `backend/alembic/versions/` |
| 13 | Background jobs | **NOT IMPLEMENTED** |
| 14 | External integrations | MinIO/S3 object storage only (no email/SMS/payment gateway found) |
| 15 | PDF | reportlab in `PayrollService._generate_payslip_pdf` |
| 16 | Logging | Python `logging` in face service; file logs on server (`face-backend.log`) — no structured app-wide logging framework |
| 17 | Error handling | Per-router `HTTPException`; no global exception handler |
| 18 | Validation | Pydantic schemas (backend); zod/react-hook-form in deps (frontend forms) |
| 19 | State | React Context (Auth/Admin); React Query wired but largely unused; Redux in package.json **unused** |
| 20 | UI | Tailwind + shadcn/ui (Radix) + lucide-react + sonner |

### Repository tree (important paths)

```
face-mark-presence-system/
├── src/                          # Frontend application
│   ├── main.tsx                  # React entry
│   ├── App.tsx                   # Router + providers
│   ├── contexts/                 # AuthContext, AdminContext
│   ├── pages/                    # Employee + admin pages
│   ├── pages/admin/              # Admin pages
│   ├── components/               # Shared + FaceDetection, ManualCheckIn
│   ├── components/admin/         # AdminLayout, AddEmployeeDialog, ...
│   ├── components/ui/            # shadcn primitives
│   ├── services/                 # API clients
│   ├── hooks/                    # useAttendance, toast, mobile
│   └── lib/                      # api.ts, timesheetUtils, Model
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI entry
│   │   ├── config.py             # Settings
│   │   ├── database.py           # Engine/session
│   │   ├── deps.py               # Auth dependencies
│   │   ├── models.py             # All SQLAlchemy models
│   │   ├── schemas.py            # Pydantic I/O
│   │   ├── routers/              # HTTP endpoints
│   │   ├── services/             # Business logic
│   │   ├── storage/              # MinIO/local backends
│   │   └── utils/                # image_quality
│   ├── alembic/versions/         # Migrations
│   ├── scripts/                  # seed, migrate uploads
│   ├── uploads/                  # Legacy local files
│   ├── docker-compose.yml
│   └── requirements.txt
├── docs/                         # Spec + this audit
├── deploy/project.json
├── public/
└── package.json
```

### Directory responsibilities

| Path | Purpose | Important files | Dependencies |
|---|---|---|---|
| `src/` | SPA UI | `App.tsx`, pages, services | Vite, React, Tailwind |
| `backend/app/routers/` | HTTP API surface | `attendance.py`, `payroll.py`, `leaves.py`, `hr.py` | FastAPI, deps, services |
| `backend/app/services/` | Domain logic | `day_status_engine.py`, `payroll_service.py`, `face_service.py` | models, config, storage |
| `backend/app/models.py` | Schema | All tables/enums | SQLAlchemy |
| `backend/alembic/` | Schema evolution | 8 revision files | Alembic |
| `docs/` | Product + audit docs | Spec MD + CURRENT_* | — |

---

## Phase 2 — Application Entry Points

### Backend startup

Source: `backend/app/main.py`

1. Load `settings` from env (`.env`).
2. If `ENVIRONMENT=production` and weak `SECRET_KEY` → `RuntimeError` (lines 17–21).
3. Create FastAPI app.
4. Add CORS middleware (`settings.cors_origin_list`).
5. Include routers under `/api`.
6. Mount `/static` on `upload_dir`.
7. Expose `GET /api/health`.

**NOT IMPLEMENTED:** explicit DB create-all on startup; Alembic is the migration path.  
**NOT IMPLEMENTED:** global exception handlers.  
**Auth middleware:** not middleware — FastAPI dependencies (`deps.py`).

### Frontend startup

Source: `src/main.tsx` → `src/App.tsx`

```
Browser
→ createRoot(App)
→ QueryClientProvider
→ AuthProvider + AdminProvider
→ BrowserRouter
→ Route (public | ProtectedRoute | AdminProtectedRoute)
→ Page
→ apiRequest (src/lib/api.ts) + Bearer token
→ Vite proxy /api → backend :8001 (vite.config.ts)
→ FastAPI router → service → PostgreSQL / MinIO
```

### Auth token storage

| Role | Token key | Profile key |
|---|---|---|
| Employee | `attendanceToken` | `attendanceUser` |
| Admin | `adminToken` | `attendanceAdmin` |

Source: `src/lib/api.ts`, `AuthContext.tsx`, `AdminContext.tsx`.

---

## Phase 3 — Route Inventory (summary)

Full endpoint tables: see `docs/CURRENT_API_INVENTORY.md`.

### Frontend routes

| Route | Component | Auth | Role |
|---|---|---|---|
| `/` | Index | none | public |
| `/quick-attendance` | QuickAttendance | none | public kiosk |
| `/login`, `/register` | Login, Register | none | public |
| `/dashboard` | Dashboard | user | employee |
| `/history` | History | user | employee |
| `/face-enrollment` | FaceEnrollment | user | employee |
| `/profile` | Profile | user | employee |
| `/leave` | Leave | user | employee |
| `/payslips` | Payslips | user | employee |
| `/admin/login`, `/admin/register` | AdminLogin/Register | none | public |
| `/admin/*` | AdminLayout children | admin | admin |

### Backend ↔ frontend mismatches (high level)

| Finding | Detail |
|---|---|
| Backend unused / underused by FE | `POST /api/face/recognize`, `POST /api/face/verify`, `GET /api/rosters/my-week`, legacy `GET/PUT /api/settings/attendance-policy`, most `weekoffs` CRUD from pages, `PATCH` holiday/leave-type/weekoff-policy (service exists, UI often create/delete only) |
| FE dead / misleading | `weekoffService.ts` vs Profile using leave; payroll `process-monthly` / `report` marked deprecated in service comments |
| Public API risk | `/api/attendance/quick` no auth |

---

## Phase 4 — Authentication & Authorization

### Employee login flow (actual)

1. `POST /api/auth/login` (`routers/auth.py` `login_user`, ~45–57)  
2. Lookup user by email; reject if `user_role == admin`  
3. Require `user_role == user` + `verify_password` (bcrypt)  
4. `create_access_token(user_id, role)` — JWT HS256, exp = now UTC + `access_token_expire_minutes` (default 1440)  
   Source: `services/core.py`  
5. Frontend stores token in `attendanceToken`, fetches `GET /api/auth/me`  
6. Subsequent calls: `Authorization: Bearer` with `auth: "user"`

### Admin login flow (actual)

1. `POST /api/auth/admin/login` (~86–98)  
2. Reject if role is employee  
3. Require admin + password verify  
4. Same JWT structure (`sub` + `role` claim)  
5. Stored in `adminToken`; `GET /api/auth/admin/me` checks admin role

### Are tokens separate?

- **Storage keys:** yes (frontend).  
- **Token format:** same JWT algorithm/secret; distinguished by payload `role` and DB `user_role`.  
- **Validation:** `get_current_user` uses JWT `sub` only; role for admin APIs comes from **DB** via `get_current_admin`.

### Can employee token access admin APIs?

**No** (for endpoints using `get_current_admin`). Employee JWT authenticates as that user; `user_role != admin` → 403.

### Can admin token access employee APIs?

**Yes**, for endpoints that only require `get_current_user` (e.g. leave types, some attendance list with scoping). Admin is a `User` row. Some endpoints additionally require employee role (e.g. `PATCH /api/auth/me`, leave apply, roster my-week).

### Logout

Frontend clears localStorage only. **NOT IMPLEMENTED:** server-side invalidation.

### Registration

- Employee: open `POST /api/auth/register`.  
- Admin: only when `admin_count == 0`.  
- Preferred employee creation: admin `POST /api/users/employees` (sets code, dept, salary, leave balances).

### Security weaknesses

See Executive Summary §7 and Phase 25 in this file / GAP doc.

---

## Phases 5–20 — Pointers

Detailed documentation is split to avoid a single unreadable mega-file:

| Topic | Document |
|---|---|
| Models, fields, ER | `docs/CURRENT_DATABASE_SCHEMA.md` |
| Every API + FE usage | `docs/CURRENT_API_INVENTORY.md` |
| Auth, face, attendance, leave, holiday, week-off, payroll formulas | `docs/CURRENT_BUSINESS_LOGIC.md` |
| Mermaid flows + connection matrix | `docs/CURRENT_DATA_FLOW.md` |
| Current vs required architecture | `docs/GAP_ANALYSIS.md` |
| Recommended phases | `docs/IMPLEMENTATION_PLAN.md` |

### Critical business facts (verified)

**Attendance day:** local calendar day for check-in state (`_local_day_bounds` in `attendance.py` 38–43); day-status uses date + UTC window with `astimezone().date()` filter.

**Check-in vs check-out (quick):** `_attendance_state` — 0 check-ins → check-in; more check-ins than check-outs → check-out; equal nonzero → completed (blocked). Source: `attendance.py` 67–79, 206–232.

**Face match:** cosine similarity ≥ 0.85; margin ≥ 0.08 vs second best; median sample ≥ 0.85; peak ≥ 0.88. Source: `config.py` 33–36, `face_service.py` 234–254, 288–342.

**Payroll net (simplified actual formula):**

```
package = (basic+hra+da+conveyance+medical+special) * period_factor
daily_rate = package / divisor   # divisor default 30
gross = package + approved_ot_pay + premium_pay + adj_earn
lop_amount = daily_rate * lopDays
net = gross - (lop_amount + pf + pt + tds + adj_ded)
```

Source: `payroll_service.py` `_apply_calculation` 675–768.

**Day status priority:** Holiday → Week-off → Approved leave → Attendance → Absent.  
Source: `day_status_engine.py` `resolve_day` 73–190.

---

## Phase 21 — Cross-module connectivity (summary)

| Flow | Status |
|---|---|
| Employee → Face enrollment → Attendance | **CONNECTED** |
| Attendance → Day Status | **PARTIALLY CONNECTED** (not on punch; on regenerate/calculate/leave approve) |
| Day Status → Timesheet | **CONNECTED** |
| Day Status → Payroll | **CONNECTED** (at calculate) |
| Leave approve → Day Status → Payroll | **CONNECTED** |
| Holiday/Week-off config → Day Status | **CONNECTED** |
| Holiday compensation enum → Payroll premium | **PARTIALLY CONNECTED** (comp-off path yes; 1.5x/2x no) |
| Salary structure → Payroll | **CONNECTED** |
| Payroll approve → Payslip PDF | **CONNECTED** |

---

## Phase 24 — Date / Time / Timezone

| Pattern | Where | Risk |
|---|---|---|
| Store timestamps UTC | attendance, payroll audit fields | OK if consistently converted |
| “Today” via `utc.astimezone()` local | `attendance._local_day_bounds` | Depends on **server OS timezone** (IST only if server is IST) |
| “Today” via `timezone.utc.date()` | `attendance.today_attendance`, `dashboard.py` | **UTC date**, can differ from IST near midnight |
| Day-status week-off request window | UTC midnight–max for date | Boundary skew |
| Frontend `Date` / date-fns | Leave, timesheet filters | Browser local TZ |
| **Asia/Kolkata explicit** | **NOT FOUND** | UNVERIFIED for IST unless server TZ is set |

---

## Phase 25 — Security Audit (condensed)

| Sev | Issue | Source |
|---|---|---|
| CRITICAL | Unauthenticated quick attendance | `attendance.py` `quick_face_attendance` 168–173 |
| HIGH | Open employee self-registration | `auth.py` `register_user` |
| HIGH | Default secrets/DB URL in Settings | `config.py` 7–8 |
| MEDIUM | JWT localStorage; long TTL | `api.ts`, `config.py` |
| MEDIUM | Biometric embeddings + face images | `face_service.py`, MinIO |
| MEDIUM | Upload endpoints allow several folders | `upload.py` |
| LOW | CORS allow_methods/headers `*` | `main.py` 29–35 |
| Mitigated | Payslip employee IDOR check | `payroll.py` 363–364 |
| Mitigated | Weak secret refused in production | `main.py` 17–21 |
| Mitigated | Admin APIs need `get_current_admin` | `deps.py` 36–39 |

SQL injection: SQLAlchemy ORM parameterized queries — low risk for audited paths.  
Password hashing: bcrypt via passlib — verified.

---

## Phase 26 — Logical bugs (selected)

| Problem | Current behavior | Why | Impact |
|---|---|---|---|
| Stale day status | Punch does not call engine | No hook in attendance router | Wrong timesheet/payroll until rebuild |
| Pending = absent | Engine filters `approved` only | `_attendance_pair` | LOP until approval |
| Premium ≠ compensation | Always 1× daily_rate extra | `_apply_calculation` 719–727 | Wrong OT/holiday pay |
| Profile OT 160h | Independent FE calc | `Profile.tsx` 96 | Misleading employee stats |
| UTC today endpoints | UTC calendar date | `today_attendance` 273 | Wrong “today” near IST midnight |
| Multiple sessions | Face/quick block after one pair; manual create less guarded | state machine vs `POST /attendance` | Inconsistent |
| Cascade delete | User FK CASCADE on attendance/face/leave | models | Deleting user (if ever) wipes history — but **no employee DELETE API** today |

---

## Phase 28 — Feature matrix (abbreviated)

| Feature | FE | BE | DB | Connected | Status |
|---|---|---|---|---|---|
| Employee auth | Y | Y | Y | Y | COMPLETE |
| Admin auth | Y | Y | Y | Y | COMPLETE |
| Employee CRUD | Y (no delete) | Y (no delete) | Y | Y | PARTIAL |
| Face enrollment | Y | Y | Y | Y | COMPLETE |
| Face recognition | Y | Y | Y | Y | COMPLETE (pixel model) |
| Quick attendance | Y | Y | Y | Y | COMPLETE (insecure) |
| Logged-in face attendance | Y | Y | Y | Y | COMPLETE |
| Manual attendance | Y | Y | Y | PARTIAL (pending→engine) | PARTIAL |
| Attendance approval | Y | Y | Y | Y | COMPLETE |
| Attendance policies | Y | Y | Y | Y | COMPLETE |
| Timesheet | Y | Y | Y | PARTIAL (stale) | PARTIAL |
| Leave request/approval | Y | Y | Y | Y | COMPLETE |
| Leave balance | Y | Y | Y | Y | COMPLETE |
| Paid/unpaid leave | Y | Y | Y | Y | COMPLETE |
| Half-day leave | Y | Y | Y | Y | COMPLETE |
| Holiday calendar | Y | Y | Y | Y | COMPLETE |
| Week-off policy | Y | Y | Y | Y | PARTIAL |
| Rotational week-off | Partial (roster) | Partial | Y | Partial | PARTIAL |
| Comp-off | Partial UI | Y | Y | Y | PARTIAL |
| Salary config | Y | Y | Y | Y | COMPLETE |
| Payroll processing | Y | Y | Y | Y | PARTIAL |
| LOP | Y | Y | Y | Y | COMPLETE |
| OT payroll | Y | Y | Y | Y (approved only) | PARTIAL |
| Payroll approval/paid | Y | Y | Y | Y | COMPLETE |
| Payslip PDF | Y | Y | Y | Y | COMPLETE |
| Employee payslip access | Y | Y | Y | Y | COMPLETE |

---

## Special investigation — Payroll item checklist

| Item | Data source | Calculation | Payroll impact | Status | Gap |
|---|---|---|---|---|---|
| Present days | `sum(present_fraction)` | Day engine | Stored `days_present` | IMPLEMENTED | Excludes paid leave (by design) |
| Absent days | `lopDays` mapped to `days_absent` | Engine | LOP amount | PARTIAL | Name ≠ pure absent |
| Working days | `is_working_day` count | Engine | Divisor option | IMPLEMENTED | |
| Expected hours | `sum(expected_minutes)/60` | Engine | Stored | IMPLEMENTED | |
| Actual hours | `sum(worked_minutes)/60` | Engine | Stored | IMPLEMENTED | |
| Paid leave | `paid_leave_fraction` | Engine | Payable, no LOP | IMPLEMENTED | |
| Unpaid leave | `unpaid_leave_fraction` + LOP | Engine | LOP $ | IMPLEMENTED | Folded into absent field |
| LOP | `lop_day_fraction` | Engine | `daily_rate * lop` | IMPLEMENTED | |
| Holidays | Engine holiday flags | Payable if paid | Premium if worked | PARTIAL | Multipliers ignored |
| Week-offs | Policy/roster/request | Payable if paid | Premium if worked | PARTIAL | Same |
| Worked holidays/offs | Status enums | Premium 1× | Earning | PARTIAL | |
| Overtime | Engine minutes → OT approvals | `rate * approved_hours` | Earning | PARTIAL | Needs admin approve |
| Manual attendance | Attendance rows pending | Invisible until approved | Indirect | PARTIAL | |
| Pending attendance | status=pending | Not in engine | Looks absent | LIKELY BUG |
| Approved attendance | status=approved | Used | Yes | IMPLEMENTED | |
| Joining date | User.joining_date | period_factor | Prorate package | IMPLEMENTED | Engine rows still generated |
| Termination date | User.termination_date | period_factor + eligibility | Prorate / exclude | IMPLEMENTED | Same |

---

## Special investigation — Duplicated rules

| Concept | Locations | Consistent? |
|---|---|---|
| Worked minutes | Policy checkout flags vs DayStatus `_attendance_pair` | Mostly; float vs int |
| Half-day | Policy `half_day_hours` vs engine `expected*0.5` | Same for defaults; can diverge |
| OT minutes | Both use `worked - overtime_after` | Yes |
| Profile hours/OT | Frontend only (160h) | **Diverges** from backend |
| Timesheet vs Payroll | Both DayStatusEngine | **Aligned** when regenerated |

---

## Special investigation — Hardcoded business rules

| Constant | Value | Location | Impact |
|---|---|---|---|
| Fixed divisor | 30 | `payroll_service._divisor` | Default daily rate |
| PF % | 12 | `config.pf_percentage` | Statutory |
| PF base cap | 15000 | `config.pf_max_limit` | Statutory |
| PT | 200 | `config.pt_amount` | Statutory |
| Work days/month | 26 | `config` | **UNUSED** in payroll |
| TDS threshold | 250000 annual | `_apply_calculation` | TDS gate |
| Face threshold/margin | 0.85 / 0.08 | config | Recognition |
| Min/max face samples | 3 / 8 | config | Enrollment |
| Comp-off expiry | 90 days | `day_status_engine` | Comp-off |
| High LOP / high OT flags | ≥3 days / >20h | `_build_flags` | Review flags |
| Default week-off UI | Sat+Sun `[5,6]` | `HRPolicies.tsx` | UI default only |
| Profile OT | 160 hours | `Profile.tsx` | Display only |
| Token TTL | 1440 min | config | Session length |

---

## Conclusion

Present Sir already has a substantial HRMS spine: face attendance, leave, holiday/week-off policies, day-status engine, and a stateful payroll cycle. The verified baseline shows the largest correctness risks are **day-status freshness**, **pending attendance vs LOP**, **holiday premium multipliers**, and **kiosk/auth security** — not a total absence of leave/holiday/payroll modules.

Next step: see `docs/IMPLEMENTATION_PLAN.md`.
