# Present Sir — User Manual Coverage Checklist

**Purpose:** Internal verification that `docs/PRESENT_SIR_USER_MANUAL.md` covers every current user-facing Staff and Admin flow.  
**Date:** July 2026  
**Source of truth:** Current frontend routes (`src/App.tsx`), pages under `src/pages`, admin layout nav.

Legend:

- **Yes** — Documented with step-by-step / field-level detail  
- **Partial** — Mentioned; limited UI surface  
- **N/A** — Not available to that role in current UI  
- **Excluded** — Exists only in backend / not exposed in current UI (listed in exclusions)

| Module | Flow | Staff Manual | Admin Manual | Verified From Code |
|---|---|---|---|---|
| Home | Landing `/` Sign In / Quick Attendance | Yes | N/A | `Index.tsx` |
| Auth | Employee login `/login` | Yes §1 | N/A | `Login.tsx`, `AuthForm` |
| Auth | Public employee register | Yes (closed) | N/A | `Register.tsx` |
| Auth | Admin login `/admin/login` | N/A | Yes §14 | `AdminLogin.tsx` |
| Auth | Admin bootstrap register | N/A | Yes (setup note only) | `AdminRegister.tsx` |
| Auth | Log out | Yes | Yes | `Header.tsx`, `AdminLayout.tsx` |
| Nav | Staff menus | Yes §2 | N/A | `Header.tsx` |
| Nav | Admin sidebar | N/A | Yes §15 | `AdminLayout.tsx` |
| Dashboard | Today check-in/out | Yes §2 | N/A | `Dashboard.tsx` |
| Dashboard | Face attendance + location | Yes §4 | N/A | `Dashboard.tsx`, FaceDetection, GeolocationTracker |
| Dashboard | Manual attendance | Yes §5 | N/A | `ManualCheckIn.tsx` |
| Dashboard | Enrollment banner | Yes §2–3 | N/A | `Dashboard.tsx` |
| Face | Self enrollment `/face-enrollment` | Yes §3 | N/A | `FaceEnrollment.tsx` |
| Face | Admin enroll from Employees | N/A | Yes §19 | Users Face dialog |
| History | Filters + detail | Yes §7 | N/A | `History.tsx`, `AttendanceFilters.tsx` |
| Profile | Overview + monthly hours | Yes §8, §12 | N/A | `Profile.tsx` |
| Profile | Simple leave request | Yes §8 | N/A | `Profile.tsx` |
| Leave | Balances + full request | Yes §9–10 | N/A | `Leave.tsx` |
| Leave | Half day duration | Yes §10 | Yes §26 | `Leave.tsx`, HRPolicies |
| Leave | Admin approve/reject | N/A | Yes §25 | `Leaves.tsx` |
| Leave | Carry-forward / rebuild day status | N/A | Yes §25 | `Leaves.tsx` |
| Payslips | Employee list + PDF | Yes §13 | Yes §34 | `Payslips.tsx`, Payroll |
| Kiosk | Quick Attendance | Yes Part 3 | Setup note | `QuickAttendance.tsx` |
| Employees | List / search | N/A | Yes §16 | `Users.tsx` |
| Employees | Create (all tabs) | N/A | Yes §17 | `AddEmployeeDialog.tsx` |
| Employees | Edit | N/A | Yes §18 | `AddEmployeeDialog.tsx` |
| Admin Dashboard | KPIs | N/A | Yes §15 | `AdminDashboard.tsx` |
| Admin Dashboard | Pending Approve/Reject | N/A | Yes §15, §21 | `AdminDashboard.tsx` |
| Attendance | Admin browse/filter | N/A | Yes §20 | `Attendance.tsx` |
| Attendance | Admin edit/delete on Attendance page | N/A | Excluded (not in UI) | Attendance page read-only |
| Timesheet | Month day rows | N/A | Yes §27 | `Timesheet.tsx` |
| Roster | Draft/Publish/OFF/Shifts | N/A | Yes §24 | `Roster.tsx` |
| HR Policies | Holidays + compensation | N/A | Yes §22 | `HRPolicies.tsx` |
| HR Policies | Week-off policy + assign | N/A | Yes §23 | `HRPolicies.tsx` |
| HR Policies | Leave types | N/A | Yes §26 | `HRPolicies.tsx` |
| Settings | Departments | N/A | Yes §38 | `AdminSettings.tsx` |
| Settings | Employment types | N/A | Yes §39 | `AdminSettings.tsx` |
| Settings | Document types | N/A | Yes §40 | `AdminSettings.tsx` |
| Settings | Attendance policies | N/A | Yes §37 | `AdminSettings.tsx` |
| Payroll | Lifecycle Calculate→Approve→Paid | N/A | Yes §28–35 | `Payroll.tsx` |
| Payroll | Pre-check | N/A | Yes §31 | `Payroll.tsx` |
| Payroll | Adjustments | N/A | Yes §32 | `Payroll.tsx` |
| Payroll | CSV/Excel export | N/A | Yes §29 | `Payroll.tsx` |
| Overtime | Sync + approve | N/A | Yes §41 | `OvertimeApprovals.tsx` |
| Week-off | Employee dedicated WO request page | Excluded | N/A | No Staff route |
| Holiday | Dept/employment-type UI scope | N/A | Partial (UI defaults org-wide) | Form `appliesTo: "all"` only |
| Terminology | Statuses / methods / compensation | Yes Part 5 | Yes Part 5 | Models + UI labels |
| Permissions | Role matrix | Yes | Yes | Routes + nav |

---

## Features intentionally excluded (not current end-user UI)

| Item | Reason |
|---|---|
| Public employee self-registration | Disabled; Register page shows closed message |
| Day-to-day Admin self-registration | Bootstrap only when zero admins |
| Dedicated Staff Week-Off request module | No Staff page; leave used for time off |
| Holiday applicability UI (department / employment type) | Backend supports; Admin holiday form uses all |
| Week-off policy “If employee works” selector in UI | Sent as default `comp_off`; not shown as field |
| Attendance Approve/Reject on `/admin/attendance` | Approve/Reject only on Admin Dashboard |
| Leave cancellation workflow for Staff | Not implemented as Staff action |
| Bank payment transfer from Present Sir | Mark as Paid records status only |
| Developer/API/architecture docs | Out of scope for user manual |

---

## Screenshot placeholders in user manual

| Placeholder path | Topic |
|---|---|
| `./images/user-manual/employee-login.png` | Staff login |
| `./images/user-manual/employee-dashboard.png` | Staff dashboard |
| `./images/user-manual/face-enrollment.png` | Face registration |
| `./images/user-manual/face-attendance.png` | Face attendance |
| `./images/user-manual/attendance-history.png` | History |
| `./images/user-manual/employee-profile.png` | Profile |
| `./images/user-manual/employee-payslips.png` | Staff payslips |
| `./images/user-manual/admin-login.png` | Admin login |
| `./images/user-manual/admin-dashboard.png` | Admin dashboard |
| `./images/user-manual/admin-employees.png` | Employees |
| `./images/user-manual/admin-attendance.png` | Admin attendance |
| `./images/user-manual/admin-roster.png` | Roster |
| `./images/user-manual/admin-timesheet.png` | Timesheet |
| `./images/user-manual/admin-payroll.png` | Payroll |
| `./images/user-manual/payslip.png` | Payslip |
| `./images/user-manual/quick-attendance.png` | Kiosk |

---

## Coverage counts (approximate flow sections)

| Area | Count |
|---|---|
| Staff flow sections (§1–13 + kiosk staff use) | 14 |
| Admin flow sections (§14–41) | 28 |
| Screenshot placeholders | 16 |
| Unverified UI flows | NONE (documented from current JSX) |
