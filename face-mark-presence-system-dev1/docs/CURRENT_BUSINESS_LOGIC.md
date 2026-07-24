# Present Sir — Current Business Logic

**Audit date:** 2026-07-22  
**Rule:** Formulas and behaviors below are taken from actual code with sources.

---

## 1. Authentication

### Password

- Hash: `passlib` bcrypt — `hash_password` / `verify_password`  
  Source: `backend/app/services/core.py`

### JWT

```
payload = { sub: user_id, role: role, exp: utc_now + ACCESS_TOKEN_EXPIRE_MINUTES }
alg = HS256, key = settings.secret_key
```

Source: `core.py` `create_access_token`; default TTL 1440 min — `config.py`.

### Employee vs admin

| Step | Employee | Admin |
|---|---|---|
| Register | Open `/api/auth/register` → role=user | Only if zero admins |
| Login | Rejects admin accounts | Rejects employee accounts |
| Token storage | `attendanceToken` | `adminToken` |
| API guard | `get_current_user` | `get_current_admin` (DB role) |

JWT `role` claim is **not** what enforces admin APIs; DB `user_role` is.

### Logout

Frontend clears storage only. **NOT IMPLEMENTED:** revocation.

---

## 2. Employee management

### Create (admin)

Source: `employee_service.py` via `POST /api/users/employees`

1. Validate email unique; resolve department.
2. Generate `employee_code` (6-digit increment).
3. Hash password; create User (status Active, employment_type string).
4. Optional salary → `PayrollService.assign_salary_structure` (deactivates prior structures).
5. `LeaveService.ensure_balances_for_user` for all active leave types for current year.

### Read / Update

Admin GET/PATCH employee. Status can be set (e.g. Inactive) via update — **UNVERIFIED** exact UI enum list beyond Active default.

### Delete

**NOT IMPLEMENTED** as API. Soft deactivate via status update only if UI sends it.

### Fields that exist

employee_code, department, designation, employment_type (string), joining_date, termination_date, salary structure, bank, PAN, UAN, ESI, documents_metadata, status, face enrollment (separate tables).

---

## 3. Face enrollment

**Flow:** Camera (FE) → JPEG samples → `POST /api/face/register-multiple/{user_id}` → OpenCV detect → 64×64 gray flatten L2 → store samples + ensemble mean → MinIO images.

| Rule | Value | Source |
|---|---|---|
| Min samples | 3 | `config.min_face_samples` |
| Max samples | 8 | `config.max_face_samples` |
| Embedding | float64 BYTEA, dim 4096 | `face_service._embedding_from_face` |
| Version | `opencv_v1` | config |
| Replace | Prior active embeddings set `is_active=False` | `register_multiple_faces` |
| No face | `FaceRegistrationError` | |
| Multiple faces | Error on strict first cascade attempt | `_detect_face` |
| Who can enroll | Self or admin | face router ACL |
| Delete face API | **NOT IMPLEMENTED** as dedicated delete (re-register deactivates old) |

Quality gates: `utils/image_quality.py` (size, brightness, contrast, sharpness).

---

## 4. Face recognition

**Library:** OpenCV Haar only — **not** a DNN face model.

**Similarity:** cosine similarity of L2-normalized vectors (`_confidence`).

**Search:** All active ensemble embeddings for Active employees (full scan).

**Thresholds:**

| Check | Rule |
|---|---|
| Best ≥ | `face_match_threshold` (0.85) |
| Best − 2nd ≥ | `face_match_margin` (0.08) |
| Median sample ≥ | 0.85 |
| Peak sample ≥ | 0.88 (= threshold + 0.03) |

Source: `face_service.py` `_validate_match`, `recognize_face` lines ~234–342; `config.py` 33–36.

**Performance:** O(N employees) per recognition — no indexing.

---

## 5. Quick attendance (`/quick-attendance`)

Source: `routers/attendance.py` `quick_face_attendance` 168–268; FE `QuickAttendance.tsx`.

1. Public multipart upload (optional `employee_code`).
2. `recognize_face` → user.
3. Optional code must match `user.employee_code`.
4. State machine on **local calendar day** punches (non-rejected):
   - 0 check-ins → **check-in**
   - check-ins > check-outs → **check-out**
   - else → **completed** (400 error; shows last checkout time)
5. Status `approved`, method `face`; policy flags applied.
6. FE auto-resets after 5 seconds.

**Cooldown:** none beyond completed-day block.  
**Multiple sessions/day:** blocked for face/quick after one completed pair.  
**Timezone:** `_local_day_bounds` uses server local from UTC.astimezone().  
**Midnight:** new local day resets counts.

---

## 6. Logged-in attendance

### Face (Dashboard)

`POST /checkin` / `/checkout` with verify against **current user’s** ensemble (not open recognition). Same state guards. Auto-approved.

### Manual

`POST /api/attendance` via `useAttendance` with method `manual`, status **pending**, optional geo + photo. Admin approves via PATCH.

### Status meanings (`RecordStatus`)

| Status | Meaning in code |
|---|---|
| pending | Awaiting admin (manual default) |
| approved | Counts for day engine / hours |
| rejected | Excluded from today’s open-session counts |

### Punch-level `day_status` strings

Set by `AttendancePolicyService`: `late`, `half_day`, `early_departure`, `present` (and notes). Consumed later by DayStatusEngine when mapping to enums.

---

## 7. Attendance core calculations

### Working duration (checkout)

```
work_hours = (checkout_ts - checkin_ts).total_seconds() / 3600
```

Source: `attendance_policy_service.evaluate_checkout`.

Stored on checkout record as `work_hours`.

### Day engine worked minutes

```
if checkout.work_hours: worked_minutes = work_hours * 60
else: worked_minutes = (checkout - checkin).total_seconds() // 60
```

Only **approved** punches; first check-in, last check-out; ±6h window then filter by local date.  
Source: `day_status_engine._attendance_pair`.

### Expected minutes

```
expected_minutes = full_day_hours * 60   # 0 if not working day
```

### OT minutes (engine)

```
overtime_minutes = max(0, worked_minutes - overtime_after_hours*60)
```

### Late

```
is_late = local_checkin_time > shift_start + late_grace_minutes
```

### Half-day (policy on checkout)

```
if work_hours < half_day_hours → day_status = half_day
```

Engine maps punch `half_day` → present/payable 0.5.

**Important:** Attendance punches **do not** call `DayStatusEngine.resolve_day`. Summaries refresh on leave approve, payroll calculate, OT sync, or admin regenerate.

---

## 8. Attendance policies

Per **employment type** (via policy table + user.employment_type string matching). Defaults in `attendance_policy_service.py`:

| Type | Shift | Half | Full | OT after | Grace |
|---|---|---|---|---|---|
| Full-time | 09:00–18:00 | 4h | 8h | 8h | 15m |
| Part-time | 10:00–14:00 | 2h | 4h | 4h | 15m |
| Intern | 10:00–17:00 | 3h | 6h | 6h | 15m |

Assignment: global per employment type, not per employee (except employment_type field on user).  
Location restrictions: **NOT IMPLEMENTED** as geo fence (geo stored optionally only).

---

## 9. Timesheet

Admin `/admin/timesheet` → `GET /api/hr/day-status/timesheet` → rows from `attendance_daily_summaries` (engine may regenerate month if empty).

**Does not store a separate timesheet table** — dynamic from daily summaries.  
Filters: month/year/date/search/status on FE (`timesheetUtils.ts`).

Formulas for hours/OT/LOP = engine fields (expected/worked/overtime minutes, lop fraction).

---

## 10. Leave

### Apply (employee)

Validations (`leave_service.apply_leave`):

- Active leave type; date order; half-day rules; document after N days; consecutive cap; paid balance (`total - used - pending`); unpaid skips balance; comp-off checks available credits.
- Day count skips holidays & week-offs (**sandwich OFF**).
- Half-day single date = 0.5.

### Approve

Moves pending→used; consumes comp-off FIFO; **`DayStatusEngine.regenerate_range`**.

### Reject

Returns pending days.

### Payroll impact

| Leave | Day status | Payable | LOP |
|---|---|---|---|
| Paid full | PAID_LEAVE | 1 | 0 |
| Unpaid full | UNPAID_LEAVE | 0 | 1 |
| Half paid + present | HALF_PRESENT_HALF_PAID_LEAVE | 1 | 0 |
| Half unpaid + present | HALF_PRESENT_HALF_LOP | 0.5 | 0.5 |

### Feature status

| Feature | Status |
|---|---|
| Request / approve | IMPLEMENTED |
| Balances / types | IMPLEMENTED |
| Paid / unpaid | IMPLEMENTED |
| Half-day | IMPLEMENTED |
| Comp-off type | IMPLEMENTED (backend) |
| Affect attendance day status | IMPLEMENTED on approve |
| Affect payroll | IMPLEMENTED via engine → LOP/payable |
| Overlap holiday/week-off | Days skipped in count; all-off range rejected |

---

## 11. Holiday

| Aspect | Actual |
|---|---|
| Table | `holidays` |
| Admin UI | HRPolicies create/list/delete |
| Scope | applies_to all / department / employment_type |
| Paid | `is_paid` → payable 1 if not worked |
| Worked | WORKED_HOLIDAY; may earn comp-off if compensation=comp_off |
| Expected hours | 0 (non-working day) |
| Payroll premium | Always `daily_rate * worked_holiday_count` (ignores 1.5x/2x enum) |

---

## 12. Week-off

**Not hardcoded Saturday/Sunday in backend engine.** Week-off if:

1. Published roster assignment `is_week_off`, else  
2. Approved `WeekOffRequest` for date, else  
3. Fixed policy: `work_date.weekday() in week_off_days` (0=Mon…6=Sun)

Default **UI** form uses `[5,6]` (Sat/Sun) — frontend default only (`HRPolicies.tsx`).

Rotational: policy type exists; practical rotational offs via roster.

Impact: same as holiday for payable/LOP/premium paths in engine/payroll.

Legacy `weekoff_requests` API underused; Profile “week-off” submits **leave**.

---

## 13. Day Status Engine (priority)

Source: `day_status_engine.resolve_day` 73–190

1. Holiday (± worked)  
2. Week-off (± worked)  
3. Approved leave (± half + attendance)  
4. Attendance (late / half_day / early_departure / present)  
5. Else ABSENT lop=1

Monthly summary aggregates fractions and minute sums — consumed by payroll.

---

## 14. Payroll

### UI cycle

`/admin/payroll` → dashboard(month,year) → Calculate → Submit review → Approve (PDF) → Mark paid; optional Reopen from approved.

### Employee selection

Active role=user, status Active; skip if joining after period end or terminated before period start (`_active_employees`).

### Missing salary

Employees without structure get flags / missing_salary / excluded paths in dashboard precheck — **do not invent pay**.

### Exact formulas

Source: `payroll_service._apply_calculation` 675–768; `_divisor` 655–663

```
package0 = basic+hra+da+conveyance+medical+special
period_factor = eligible_days / calendar_days   # joining/termination clamp
package = package0 * period_factor

divisor =
  calendar_days | max(workingDays,1) | max(expectedMinutes/60,1) | 30 (fixed_30 default)

daily_rate = package / divisor

ot_hours = approved_ot_minutes / 60
overtime_pay = overtime_rate * ot_hours   # if rate set

premium_pay = daily_rate * (workedHoliday + workedWeekOff)

lop_amount = daily_rate * lopDays

pf_base = min((basic+da)*period_factor, pf_max_limit)
pf = pf_base * pf_percent / 100
pt = pt_amount if period_factor > 0 else 0
tds = package * tds_percent/100 if package*12 > 250000 and tds_percent > 0 else 0

gross = package + overtime_pay + premium_pay + adj_earn
deductions = lop_amount + pf + pt + tds + adj_ded
net = gross - deductions
```

### What exists / not

| Item | Status |
|---|---|
| Gross / net / LOP / OT approved / PF / PT / TDS | IMPLEMENTED |
| Allowances in structure | IMPLEMENTED |
| Bonuses | Via manual adjustments only |
| ESI | NOT IMPLEMENTED |
| 1.5x/2x holiday multipliers | NOT IMPLEMENTED in pay calc |
| Employer PF | NOT IMPLEMENTED |

### Immutability

- Calculate sets `attendance_locked=True` and regenerates day status.  
- Approved/paid: no recalc/adjust; attendance writes 409.  
- Reopen approved → under_review; **cannot reopen paid**.  
- Unique `(user_id, month, year)` on records; unique `(month, year)` on runs.

---

## 15. Payslip

- Generated on **approve** with reportlab A4.  
- Path `payslips/{year}/{month}/{user_id}.pdf` in MinIO.  
- Employee: `GET /api/payroll/my-payslips` filtered to own records.  
- `GET /api/payroll/slip/{id}` forbids other employees’ IDs.

Fields include name, code, designation, dept, PAN/UAN/ESI/bank, attendance summary, earnings/deductions, net.

---

## 16. Settings consumption

| Setting | Consumed by |
|---|---|
| Departments | Employees, roster filter, holidays optional |
| Employment types | Attendance policies; user.employment_type string must align |
| Document types | Employee docs UI |
| Attendance policies | Punch flags + day engine expected/OT |
| Holidays / week-off / leave types | Day engine + leave service |
| Roster publish | Week-off detection |

---

## 17. Critical function notes (selected)

### `DayStatusEngine.resolve_day`

PURPOSE: Materialize one day of HR truth.  
READS: holidays, weekoff, leave, attendance, policy.  
WRITES: `attendance_daily_summaries`, maybe `comp_off_balances`.  
CALLERS: regenerate_month/range, leave approve, payroll calculate, OT sync, HR regenerate.

### `PayrollService._apply_calculation`

PURPOSE: Fill payroll_record snapshot + components.  
SECURITY: admin-only via router.  
SIDE EFFECTS: deletes/recreates system components.

### `FaceRecognitionService.recognize_face`

PURPOSE: Identify employee for kiosk.  
SECURITY: used from unauthenticated quick endpoint — risk.

### `quick_face_attendance`

PURPOSE: Auto in/out.  
VALIDATION: recognition + optional code + state machine + payroll lock.
