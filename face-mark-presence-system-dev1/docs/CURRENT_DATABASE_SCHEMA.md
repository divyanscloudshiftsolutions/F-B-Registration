# Present Sir — Current Database Schema

**Source of truth:** `backend/app/models.py`  
**Migrations:** `backend/alembic/versions/` (8 revisions)  
**Audit date:** 2026-07-22 — verified from models + migrations only

---

## 1. Enumerations

| Enum | Values | Lines (approx) |
|---|---|---|
| `UserRole` | `user`, `admin` | 25+ |
| `AttendanceType` | `check-in`, `check-out`, `week-off` | |
| `AttendanceMethod` | `face`, `manual`, `geolocation` | |
| `RecordStatus` | `pending`, `approved`, `rejected` | |
| `LeaveStatus` | `pending`, `approved`, `rejected`, `cancelled` | |
| `LeaveDuration` | `full_day`, `first_half`, `second_half` | |
| `PayrollStatus` | `draft`, `processed`, `calculated`, `under_review`, `ready`, `review`, `missing_salary`, `approved`, `paid`, `cancelled`, `excluded` | |
| `PayrollRunStatus` | `draft`, `calculated`, `under_review`, `approved`, `paid`, `cancelled` | |
| `SalaryCalcBasis` | `calendar_days`, `working_days`, `fixed_30`, `attendance_hours` | |
| `PayrollComponentType` | `earning`, `deduction` | |
| `RosterStatus` | `draft`, `published` | |
| `HolidayType` | `public`, `company`, `optional` | |
| `HolidayAppliesTo` | `all`, `department`, `employment_type` | |
| `HolidayWorkCompensation` | `normal`, `ot`, `1.5x`, `2x`, `comp_off` | |
| `WeekOffPolicyType` | `fixed`, `rotational` | |
| `DayAttendanceStatus` | `PRESENT`, `ABSENT`, `PAID_LEAVE`, `UNPAID_LEAVE`, `HOLIDAY`, `WORKED_HOLIDAY`, `WEEK_OFF`, `WORKED_WEEK_OFF`, `HALF_PRESENT_HALF_PAID_LEAVE`, `HALF_PRESENT_HALF_LOP`, `LATE`, `HALF_DAY`, `EARLY_DEPARTURE` | |
| `OvertimeApprovalStatus` | `pending`, `approved`, `rejected` | |

---

## 2. Table inventory

| Table / Model | Purpose | PK | Important FKs |
|---|---|---|---|
| `users` / User | Employees + admins | `id` UUID | `department_id`, `weekoff_policy_id` |
| `departments` | Org units | `id` | — |
| `employment_types` | Full-time / Part-time / etc. | `id` | — |
| `document_types` | Required doc catalog | `id` | — |
| `attendance_policies` | Shift rules per employment type | `id` | `employment_type_id` UNIQUE CASCADE |
| `face_embeddings` | Per-sample face vectors | `id` | `user_id` CASCADE |
| `employee_ensemble_embeddings` | Mean embedding per user/version | `id` | `user_id` CASCADE |
| `attendance` | Punch records | `id` | `user_id` CASCADE |
| `weekoff_requests` | Legacy ad-hoc week-off requests | `id` | `user_id` |
| `leave_types` | Leave catalog | `id` | — |
| `leave_requests` | Leave applications | `id` | `user_id`, `leave_type_id`, `approved_by` |
| `leave_balances` | Annual balances | `id` | `user_id`, `leave_type_id` (unique with year) |
| `salary_structures` | Active pay package | `id` | `user_id` |
| `payroll_runs` | Monthly payroll cycle | `id` | unique `(month, year)` |
| `payroll_records` | Per-employee month snapshot | `id` | `user_id`, `payroll_run_id`, `salary_structure_id`; unique `(user_id, month, year)` |
| `payroll_components` | Line items | `id` | `payroll_record_id` |
| `payroll_adjustments` | Manual adjustments | `id` | `payroll_record_id`, `created_by` |
| `shift_templates` | Shift definitions | `id` | — |
| `weekly_rosters` | Week document Mon–Sun | `id` | unique `week_start` |
| `roster_assignments` | Employee×day shift/OFF | `id` | `roster_id`, `user_id`, `shift_template_id` |
| `holidays` | Holiday calendar | `id` | optional `department_id` |
| `weekoff_policies` | Fixed/rotational policies | `id` | — |
| `comp_off_balances` | Earned comp-off credits | `id` | `user_id`, optional `used_leave_request_id` |
| `attendance_daily_summaries` | Resolved day status | `id` | `user_id`, unique `(user_id, work_date)` |
| `overtime_approvals` | OT approve workflow | `id` | `user_id`, unique `(user_id, work_date)` |

---

## 3. Model details

### 3.1 `users`

| Field | Type | Null | Default | Purpose |
|---|---|---|---|---|
| id | UUID | N | uuid4 | PK |
| email | String(255) | N | — | Login, unique |
| password_hash | String(255) | N | — | bcrypt hash |
| user_name | String(255) | N | — | Display name |
| user_role | Enum | N | `user` | `user` \| `admin` |
| user_image | Text | Y | — | Profile/face photo URL |
| phone | String(20) | Y | — | Contact |
| employee_code | String(50) | Y | — | Unique employee ID |
| department_id | UUID FK | Y | — | Department |
| designation | String(100) | Y | — | Job title |
| joining_date | Date | Y | — | Payroll proration |
| termination_date | Date | Y | — | Payroll eligibility |
| employment_type | String(30) | Y | `Full-time` | String name (not FK to employment_types.id) |
| status | String(20) | Y | `Active` | Active/Inactive etc. |
| aadhaar_number | String(12) | Y | — | KYC |
| pan_number | String(10) | Y | — | KYC / payslip |
| uan_number | String(20) | Y | — | Stored; **not used in PF calc beyond display** |
| esi_number | String(20) | Y | — | Stored; **ESI deduction NOT IMPLEMENTED** |
| bank_account_number / bank_ifsc / bank_name | String | Y | — | Payslip bank block |
| documents_metadata | JSONB | — | `{}` | Uploaded docs map |
| weekoff_policy_id | UUID FK | Y | — | SET NULL on delete |
| created_at | DateTime(tz) | — | now() | Audit |

**Written by:** auth register, employee_service create/update, profile PATCH.  
**Read by:** almost all services.  
**Note:** `employment_type` is a **string**, while `employment_types` is a separate table keyed by code/name for policies — potential inconsistency.

**Delete:** No admin DELETE endpoint. FK CASCADE would wipe attendance/faces/leaves if a user row were deleted at DB level.

### 3.2 `departments`

`id`, `name`, `code` (unique), `description`, `is_active` (default True), `created_at`. Soft-delete via `is_active`.

### 3.3 `employment_types`

`id`, `name`, `code` (unique), `is_active`, `sort_order`, `created_at`.

### 3.4 `document_types`

`id`, `key` (unique), `label`, `is_required`, `is_active`, `sort_order`.

### 3.5 `attendance_policies`

| Field | Default | Purpose |
|---|---|---|
| employment_type_id | FK unique | One policy per employment type |
| shift_start_time | `"09:00"` | Late calculation |
| shift_end_time | `"18:00"` | Early departure |
| late_grace_minutes | 15 | Grace after start |
| half_day_hours | 4.0 | Checkout half-day flag |
| full_day_hours | 8.0 | Expected minutes in day engine |
| overtime_after_hours | 8.0 | OT threshold |

**Consumed by:** `AttendancePolicyService`, `DayStatusEngine`.

### 3.6 Face tables

**`face_embeddings`:** `embedding_vector` BYTEA (float64 bytes of 4096-dim L2 vector), `reference_image_url`, `embedding_version` default `opencv_v1`, `is_active`, `is_primary`, quality/angle/expression metadata.

**`employee_ensemble_embeddings`:** mean of active samples; unique `(user_id, embedding_version)`.

### 3.7 `attendance`

| Field | Purpose |
|---|---|
| timestamp | Punch time (tz-aware) |
| type | check-in / check-out / week-off |
| method | face / manual / geolocation |
| status | pending / approved / rejected |
| location | JSONB lat/lng |
| image_url | Photo |
| face_confidence | Match score |
| work_hours | Set on checkout by policy service |
| day_status | late / half_day / early_departure / present notes |

**Day engine only reads `status == approved`.**

### 3.8 Leave schema

**`leave_types`:** code, name, `max_days_per_year`, `is_paid`, `allow_half_day`, `requires_approval`, `carry_forward`, `is_comp_off`, `max_consecutive_days`, `document_after_days`, active flag.

**`leave_requests`:** dates, duration, reason, status, attachment, rejection_reason, approved_by.

**`leave_balances`:** unique `(user_id, leave_type_id, year)` — `total_days`, `used_days`, `pending_days`.

**`comp_off_balances`:** earned_date, expiry_date, days, source, status available/used.

### 3.9 Holiday / week-off

**`holidays`:** `holiday_date`, type, applies_to, department_id, `is_paid`, `work_compensation`, `is_active`.

**`weekoff_policies`:** `policy_type`, `week_off_days` JSONB (0=Mon…6=Sun), `is_paid`, `work_compensation`, `is_default`.

**`weekoff_requests`:** per-date request with status (legacy path).

### 3.10 Roster

**`shift_templates`:** name, code, start/end, color.  
**`weekly_rosters`:** `week_start` (Monday), status draft/published.  
**`roster_assignments`:** unique `(roster_id, user_id, work_date)`, `is_week_off`, optional shift FK.

Published `is_week_off=True` feeds DayStatusEngine.

### 3.11 Payroll schema

**`salary_structures`:** basic, hra, da, conveyance, medical, special, hourly_rate, overtime_rate, pf_deduction_percent, pt_deduction_amount, tds_percent, effective_from, is_active.

**`payroll_runs`:** month/year unique; status; `salary_calc_basis`; `attendance_locked`; aggregate totals; calculated/approved/paid audit fields; payment method/reference.

**`payroll_records`:** snapshot columns for days/hours/earnings/deductions/net; `flags` JSONB; `payslip_url`. **Immutable after approve** via service rules (not DB trigger).

**`payroll_components` / `payroll_adjustments`:** itemized lines; adjustments survive as manual source.

### 3.12 `attendance_daily_summaries`

Materialized resolution per employee per date:

- Flags: `is_working_day`, `is_holiday`, `is_week_off`
- Fractions: present, paid_leave, unpaid_leave, payable, lop
- Minutes: expected, worked, overtime
- Links: holiday_id, leave_request_id, leave_type_id
- Punch times: check_in_at, check_out_at
- `attendance_status` enum, `calculation_version`, `notes`

**This is the intended single source of truth for timesheet + payroll inputs.**

### 3.13 `overtime_approvals`

`calculated_minutes`, `approved_minutes`, status, reviewed_by/at. Payroll pays **approved** minutes only.

---

## 4. ER relationships (actual)

```
Department 1──* User
WeekOffPolicy 1──* User
User 1──* FaceEmbedding
User 1──* EmployeeEnsembleEmbedding
User 1──* Attendance
User 1──* WeekOffRequest
User 1──* LeaveRequest
User 1──* LeaveBalance
User 1──* SalaryStructure
User 1──* PayrollRecord
User 1──* AttendanceDailySummary
User 1──* CompOffBalance
User 1──* OvertimeApproval
User 1──* RosterAssignment

LeaveType 1──* LeaveRequest
LeaveType 1──* LeaveBalance

EmploymentType 1──1 AttendancePolicy

PayrollRun 1──* PayrollRecord
PayrollRecord 1──* PayrollComponent
PayrollRecord 1──* PayrollAdjustment

WeeklyRoster 1──* RosterAssignment
ShiftTemplate 1──* RosterAssignment

Holiday (optional Department)
```

---

## 5. Schema observations

| Finding | Detail |
|---|---|
| Unused / underused columns | `User.esi_number` (no ESI calc); `config.standard_work_days_per_month` not a DB column but unused setting; `AttendanceType.week-off` vs separate weekoff systems |
| Duplicate concepts | `weekoff_requests` + `weekoff_policies` + roster `is_week_off`; `employment_type` string vs `employment_types` table |
| Suspicious nullables | Many HR fields nullable → employees can enter payroll path with missing salary (flagged `missing_salary` / excluded) |
| Hardcoded defaults | Policy 09:00–18:00, 15 grace, 4/8 hours; user status Active; employment Full-time |
| UI vs DB | FE expects day-status fractions — present in `attendance_daily_summaries` |
| Never exposed | Some internal columns (embedding BYTEA) correctly not sent to FE; ensemble vectors server-only |
| Naming | `days_absent` on payroll_records stores LOP days from engine `lopDays` |
| Snapshot | Payroll records are calculated snapshots; attendance changes after lock blocked; after approve requires reopen |

---

## 6. Migration chain

| Rev | Purpose |
|---|---|
| `04d228688419` | Initial users, attendance, weekoff_requests |
| `6368bc812453` | HRMS face/leave/salary/payroll/departments |
| `a1b2c3d4e5f6` | employment_types, document_types, attendance_policies |
| `b2c3d4e5f6a7` | policy per employment_type |
| `c3d4e5f6a7b8` | shift roster tables |
| `d4e5f6a7b8c9` | holidays, weekoff_policies, daily summaries, leave enhancements |
| `e5f6a7b8c9d0` | payroll_runs, components, adjustments |
| `f6a7b8c9d0e1` | designation, termination, UAN/ESI, overtime_approvals |

---

## 7. Attendance-related schema focus

Primary punch store: **`attendance`**.  
Resolved day: **`attendance_daily_summaries`**.  
Policy: **`attendance_policies`**.  
OT workflow: **`overtime_approvals`**.

## 8. Leave-related schema focus

`leave_types` → `leave_requests` → updates `leave_balances` → regenerates `attendance_daily_summaries` → feeds payroll.

## 9. Payroll-related schema focus

`salary_structures` (live config) → `payroll_runs` + `payroll_records` (monthly snapshot) → `payroll_components` / `payroll_adjustments` → `payslip_url` on record.
