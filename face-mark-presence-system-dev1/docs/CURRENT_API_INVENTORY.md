# Present Sir — Current API Inventory

**Audit date:** 2026-07-22  
**Backend mount:** all routers under `/api` (`backend/app/main.py`)  
**Frontend client:** `src/lib/api.ts` (`VITE_API_URL` or Vite proxy)

Auth modes: **none** | **user** (`attendanceToken`) | **admin** (`adminToken`) | **any authenticated** (`get_current_user`)

---

## 1. Health

| Method | Endpoint | Auth | Handler | FE usage |
|---|---|---|---|---|
| GET | `/api/health` | none | `main.health_check` | UNVERIFIED / monitoring |

---

## 2. Auth — `routers/auth.py`

| Method | Endpoint | Auth | Handler | Request | Response | Tables | FE usage |
|---|---|---|---|---|---|---|---|
| POST | `/api/auth/register` | none | `register_user` | UserRegisterRequest | UserResponse | users | AuthContext.register |
| POST | `/api/auth/login` | none | `login_user` | UserLoginRequest | TokenResponse | users | AuthContext.login |
| POST | `/api/auth/admin/register` | none* | `register_admin` | UserRegisterRequest | AdminResponse | users | AdminContext.register (*only if 0 admins) |
| POST | `/api/auth/admin/login` | none | `login_admin` | UserLoginRequest | TokenResponse | users | AdminContext.login |
| GET | `/api/auth/me` | user | `get_me` | — | UserResponse | users | AuthContext |
| PATCH | `/api/auth/me` | user (employee) | `update_me` | UserProfileUpdate | UserResponse | users | register image update |
| GET | `/api/auth/admin/me` | admin | `get_admin_me` | — | AdminResponse | users | AdminContext |

---

## 3. Users — `routers/users.py`

| Method | Endpoint | Auth | Handler | Tables | FE usage |
|---|---|---|---|---|---|
| GET | `/api/users/departments` | admin | `list_departments` | departments | (also settings path preferred) |
| GET | `/api/users` | admin | `list_users` | users | Users, HRPolicies |
| POST | `/api/users/employees` | admin | `create_employee` | users, salary, leave_balances | AddEmployeeDialog |
| GET | `/api/users/employees/{user_id}` | admin | `get_employee` | users | Users |
| PATCH | `/api/users/employees/{user_id}` | admin | `update_employee` | users, salary | Users |
| GET | `/api/users/by-email/{email}` | user | `get_user_by_email_route` | users | service exists; page usage sparse |
| GET | `/api/users/{user_id}` | user | `get_user` | users | service exists; sparse |

**NOT IMPLEMENTED:** `DELETE /api/users/employees/{id}`

---

## 4. Attendance — `routers/attendance.py`

| Method | Endpoint | Auth | Handler | Tables | FE usage |
|---|---|---|---|---|---|
| POST | `/api/attendance/checkin` | user | `face_checkin` | attendance, faces, storage | Dashboard / faceService |
| POST | `/api/attendance/checkout` | user | `face_checkout` | attendance | Dashboard / faceService |
| POST | `/api/attendance/quick` | **none** | `quick_face_attendance` | attendance | QuickAttendance |
| GET | `/api/attendance/today` | admin | `today_attendance` | attendance | admin Attendance (via related) |
| GET | `/api/attendance` | user (scoped) | `list_attendance` | attendance | admin Attendance (admin token) |
| GET | `/api/attendance/month` | admin | `list_current_month_attendance` | attendance | admin Attendance |
| GET | `/api/attendance/email/{email}` | user | `list_attendance_by_email` | attendance | useAttendance |
| GET | `/api/attendance/{record_id}` | user | `get_attendance` | attendance | service; sparse |
| POST | `/api/attendance` | user | `create_attendance` | attendance | useAttendance manual |
| PATCH | `/api/attendance/{record_id}` | user/admin rules | `update_attendance` | attendance | admin Attendance approve |
| DELETE | `/api/attendance/{record_id}` | admin | `delete_attendance` | attendance | admin Attendance |

---

## 5. Face — `routers/face.py`

| Method | Endpoint | Auth | FE usage |
|---|---|---|---|
| POST | `/api/face/register-multiple/{user_id}` | self or admin | FaceEnrollment, admin dialog |
| POST | `/api/face/verify/{user_id}` | user | faceService exported; **largely unused by pages** |
| POST | `/api/face/recognize` | user | **UNUSED by frontend** (kiosk uses attendance/quick) |
| GET | `/api/face/embedding-status/{user_id}` | user | Dashboard, admin enroll |
| POST | `/api/face/regenerate-ensemble/{user_id}` | admin | UNVERIFIED FE usage |

---

## 6. Leaves — `routers/leaves.py`

| Method | Endpoint | Auth | FE usage |
|---|---|---|---|
| GET | `/api/leaves/types` | user | Leave.tsx |
| GET | `/api/leaves/balance/{user_id}` | user (ACL) | Leave.tsx |
| POST | `/api/leaves/apply` | employee | Leave.tsx, Profile week-off form |
| GET | `/api/leaves/requests` | user/admin scoped | Leave, admin Leaves |
| PUT | `/api/leaves/{request_id}/approve` | admin | admin Leaves (approve/reject body) |
| POST | `/api/leaves/carry-forward` | admin | admin Leaves |

---

## 7. Payroll — `routers/payroll.py`

| Method | Endpoint | Auth | FE usage |
|---|---|---|---|
| POST | `/api/payroll/salary-structure` | admin | via employee create/update path |
| GET | `/api/payroll/salary-structure/{user_id}` | user ACL | employee flows |
| GET | `/api/payroll/dashboard` | admin | admin Payroll |
| GET | `/api/payroll/runs` | admin | history |
| POST | `/api/payroll/runs/ensure` | admin | dashboard ensure |
| GET | `/api/payroll/runs/{run_id}/precheck` | admin | dashboard |
| POST | `/api/payroll/precheck` | admin | dashboard |
| POST | `/api/payroll/runs/{run_id}/calculate` | admin | Payroll |
| POST | `/api/payroll/runs/{run_id}/submit-review` | admin | Payroll |
| POST | `/api/payroll/runs/{run_id}/approve` | admin | Payroll |
| POST | `/api/payroll/runs/{run_id}/mark-paid` | admin | Payroll |
| POST | `/api/payroll/runs/{run_id}/reopen` | admin | Payroll |
| PUT | `/api/payroll/runs/{run_id}/settings` | admin | salary basis |
| GET | `/api/payroll/runs/{run_id}/export.csv` | admin | Payroll raw fetch |
| GET | `/api/payroll/runs/{run_id}/export.xlsx` | admin | Payroll raw fetch |
| GET | `/api/payroll/records/{record_id}` | admin | drawer |
| POST | `/api/payroll/records/{record_id}/recalculate` | admin | drawer |
| POST | `/api/payroll/records/{record_id}/adjustments` | admin | drawer |
| GET | `/api/payroll/my-payslips` | user | Payslips.tsx |
| POST | `/api/payroll/process-monthly` | admin | **deprecated in FE service** |
| GET | `/api/payroll/report` | admin | **deprecated in FE service** |
| GET | `/api/payroll/slip/{payroll_id}` | user ACL | available; Payslips uses URL from list |

---

## 8. HR — `routers/hr.py`

| Method | Endpoint | Auth | FE usage |
|---|---|---|---|
| GET/POST | `/api/hr/holidays` | admin | HRPolicies |
| PATCH/DELETE | `/api/hr/holidays/{id}` | admin | DELETE used; PATCH service exists |
| GET/POST | `/api/hr/weekoff-policies` | admin | HRPolicies |
| PATCH | `/api/hr/weekoff-policies/{id}` | admin | service; UI sparse |
| POST | `/api/hr/weekoff-policies/assign` | admin | HRPolicies |
| GET/POST | `/api/hr/leave-types` | admin | HRPolicies |
| PATCH | `/api/hr/leave-types/{id}` | admin | service; UI sparse |
| POST | `/api/hr/day-status/regenerate` | admin | Leaves “Rebuild day status” |
| GET | `/api/hr/day-status/summary` | user | **FE export unused in pages** |
| GET | `/api/hr/day-status/timesheet` | admin | admin Timesheet |

---

## 9. Rosters — `routers/rosters.py`

| Method | Endpoint | Auth | FE usage |
|---|---|---|---|
| CRUD shifts | `/api/rosters/shifts` | admin | Roster (GET/POST; PATCH/DELETE sparse) |
| GET | `/api/rosters/week` | admin | Roster |
| PUT | `/api/rosters/week/{id}/assignments` | admin | Roster |
| POST | `.../apply-week`, `publish`, `unpublish` | admin | Roster |
| POST | `/api/rosters/week/copy-previous` | admin | Roster |
| GET | `/api/rosters/my-week` | employee | **UNUSED by pages** |

---

## 10. Overtime — `routers/overtime.py`

| Method | Endpoint | Auth | FE usage |
|---|---|---|---|
| POST | `/api/overtime/sync` | admin | OvertimeApprovals |
| GET | `/api/overtime` | admin | OvertimeApprovals |
| PUT | `/api/overtime/{id}/review` | admin | OvertimeApprovals |

---

## 11. Weekoffs — `routers/weekoffs.py`

| Method | Endpoint | Auth | FE usage |
|---|---|---|---|
| GET/POST/PATCH/DELETE | `/api/weekoffs`… | user/admin | **`weekoffService.ts` exists; pages prefer leave apply on Profile** |

---

## 12. Upload — `routers/upload.py`

| Method | Endpoint | Auth | FE usage |
|---|---|---|---|
| POST | `/api/upload` | user | fileUploadService, leave attachments |
| POST | `/api/upload/admin` | admin | employee documents |

---

## 13. Dashboard — `routers/dashboard.py`

| Method | Endpoint | Auth | FE usage |
|---|---|---|---|
| GET | `/api/dashboard/stats` | admin | AdminDashboard (via payrollService helper) |
| GET | `/api/dashboard/attendance-today` | admin | AdminDashboard |

---

## 14. Settings — `routers/settings.py`

| Method | Endpoint | Auth | FE usage |
|---|---|---|---|
| CRUD | `/api/settings/departments` | admin | AdminSettings |
| CRUD | `/api/settings/employment-types` | admin | AdminSettings |
| CRUD | `/api/settings/document-types` | admin | AdminSettings |
| GET/PUT | `/api/settings/attendance-policies` / `{et_id}` | admin | AdminSettings |
| GET/PUT | `/api/settings/attendance-policy` | admin | **legacy; FE service exported unused** |

---

## 15. Frontend route → primary APIs

| FE route | Primary APIs |
|---|---|
| `/dashboard` | face status, checkin/checkout, POST attendance, GET attendance/email |
| `/quick-attendance` | POST attendance/quick |
| `/face-enrollment` | register-multiple |
| `/leave` | leaves types/balance/apply/requests |
| `/payslips` | payroll/my-payslips |
| `/admin/payroll` | payroll dashboard + run actions + exports |
| `/admin/timesheet` | hr/day-status/timesheet |
| `/admin/leaves` | leaves requests/approve, carry-forward, day-status regenerate |
| `/admin/hr-policies` | hr holidays/weekoff/leave-types |
| `/admin/roster` | rosters/* |
| `/admin/settings` | settings/* |
| `/admin/overtime` | overtime/* |
| `/admin/users` | users, employees, face enroll, upload |
| `/admin/attendance` | attendance list/patch/delete |

---

## 16. Contract mismatch notes

| Issue | Detail |
|---|---|
| Auth mode mismatch risk | Some admin pages call endpoints with `auth: "admin"` while backend accepts any user with admin role — OK if adminToken used |
| Quick attendance | FE sends multipart file + optional employee_code; BE matches |
| Leave approve | PUT with approved boolean + rejection reason |
| Payroll exports | FE uses raw `fetch` + admin token (not `apiRequest`) for blob download — intentional |
| Deprecated payroll endpoints | Still on backend; FE marks process-monthly/report deprecated |
| Day-status summary | Backend ready; employee dashboard does **not** call it (Profile uses raw attendance math instead) |

---

## 17. Endpoints unused / weakly used by frontend

- `POST /api/face/recognize`
- `POST /api/face/verify/{user_id}` (exported, little UI)
- `GET /api/rosters/my-week`
- `GET /api/hr/day-status/summary`
- Weekoffs CRUD (vs leave-based Profile form)
- Legacy settings attendance-policy single endpoints
- `POST /api/payroll/process-monthly`, `GET /api/payroll/report` (deprecated client)
