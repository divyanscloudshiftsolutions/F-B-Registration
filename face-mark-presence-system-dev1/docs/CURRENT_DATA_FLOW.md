# Present Sir — Current Data Flow

**Audit date:** 2026-07-22  
**Based on actual code paths only**

---

## 1. Application startup

```mermaid
flowchart TD
  B[Browser] --> M[src/main.tsx]
  M --> A[App.tsx providers]
  A --> R[React Router]
  R --> P[Page]
  P --> API[src/lib/api.ts]
  API --> V[Vite proxy /api]
  V --> F[FastAPI main.py]
  F --> RT[Router]
  RT --> SVC[Service]
  SVC --> DB[(PostgreSQL)]
  SVC --> S3[(MinIO)]
```

---

## 2. Employee authentication

```mermaid
sequenceDiagram
  participant FE as AuthContext
  participant API as POST /api/auth/login
  participant DB as users
  participant JWT as create_access_token
  FE->>API: email + password
  API->>DB: get_user_by_email
  API->>API: reject if admin; verify bcrypt
  API->>JWT: sub=id, role=user
  JWT-->>FE: access_token
  FE->>FE: localStorage attendanceToken
  FE->>API: GET /api/auth/me Bearer
```

Admin flow identical with `/api/auth/admin/login` and `adminToken`.

---

## 3. Face enrollment → recognition → attendance

```mermaid
flowchart LR
  CAM[Camera JPEG] --> REG[POST face/register-multiple]
  REG --> EMB[face_embeddings]
  REG --> ENS[employee_ensemble_embeddings]
  REG --> OBJ[MinIO faces/]
  CAM2[Camera] --> Q[POST attendance/quick]
  Q --> REC[recognize_face all ensembles]
  REC --> ST[attendance state machine]
  ST --> ATT[(attendance approved)]
  CAM3[Dashboard camera] --> CI[POST checkin/checkout]
  CI --> VER[verify_user_face]
  VER --> ATT
```

---

## 4. Manual attendance → approval

```mermaid
flowchart TD
  D[Dashboard ManualCheckIn] --> P[POST /api/attendance method=manual]
  P --> PEN[attendance status=pending]
  PEN --> ADM[Admin Attendance PATCH approved]
  ADM --> OK[status=approved]
  OK -.->|NOT automatic| DSE[DayStatusEngine]
  note1[Day status updates only on regenerate / payroll calculate / leave approve / OT sync]
```

---

## 5. Leave → day status → payroll

```mermaid
flowchart TD
  E[Employee Leave.tsx] --> A[POST /leaves/apply]
  A --> LR[(leave_requests pending)]
  A --> BAL[(leave_balances pending_days++)]
  ADM[Admin approve] --> AP[PUT /leaves/id/approve]
  AP --> BAL2[used_days++; pending--]
  AP --> DSE[DayStatusEngine.regenerate_range]
  DSE --> ADS[(attendance_daily_summaries)]
  ADS --> TS[Admin Timesheet]
  ADS --> PAY[Payroll calculate_run]
  PAY --> PR[(payroll_records snapshot)]
  PR --> PDF[Payslip on approve]
```

---

## 6. Holiday / week-off → day status

```mermaid
flowchart TD
  H[HRPolicies holidays] --> HT[(holidays)]
  W[Week-off policies + assign] --> WP[(weekoff_policies)]
  WP --> U[users.weekoff_policy_id]
  R[Published roster OFF] --> RA[(roster_assignments.is_week_off)]
  HT --> DSE[resolve_day priority]
  U --> DSE
  RA --> DSE
  WR[weekoff_requests approved] --> DSE
  DSE --> ADS[(attendance_daily_summaries)]
```

---

## 7. Payroll cycle

```mermaid
stateDiagram-v2
  [*] --> Draft
  Draft --> Calculated: calculate_run\n(regenerate day status,\nlock attendance)
  Calculated --> UnderReview: submit-review
  UnderReview --> Approved: approve\n(generate PDFs)
  Calculated --> Approved: approve
  Approved --> Paid: mark-paid
  Approved --> UnderReview: reopen
  Paid --> [*]
```

```mermaid
flowchart TD
  UI[Admin Payroll page] --> DASH[GET payroll/dashboard]
  DASH --> ENS[ensure run]
  UI --> CALC[POST runs/id/calculate]
  CALC --> DSE[DayStatusEngine.regenerate_month]
  CALC --> SUM[monthly_summary per emp]
  SUM --> APPL[_apply_calculation]
  APPL --> REC[payroll_records + components]
  UI --> APR[approve]
  APR --> PDF[_generate_payslip_pdf]
  PDF --> MINIO[MinIO payslips/]
  EMP[Employee Payslips] --> MY[GET my-payslips]
```

---

## 8. Cross-module connection matrix

```mermaid
flowchart TB
  subgraph sources
    ATT[Attendance punches]
    LV[Leave]
    HOL[Holiday]
    WO[Week-Off / Roster]
    POL[Attendance Policy]
    SAL[Salary structure]
  end
  subgraph resolve
    DSE[Day Status Engine]
    ADS[attendance_daily_summaries]
  end
  subgraph outputs
    TS[Timesheet]
    OT[OT approvals]
    PAY[Payroll]
    SLIP[Payslip]
  end
  ATT -.->|PARTIAL: no auto regenerate| DSE
  LV -->|on approve CONNECTED| DSE
  HOL -->|CONNECTED| DSE
  WO -->|CONNECTED| DSE
  POL -->|CONNECTED| DSE
  DSE --> ADS
  ADS -->|CONNECTED| TS
  ADS -->|CONNECTED| OT
  ADS -->|on calculate CONNECTED| PAY
  SAL -->|CONNECTED| PAY
  PAY -->|on approve CONNECTED| SLIP
```

| Arrow | Classification | Why |
|---|---|---|
| Employee → Face → Attendance | CONNECTED | Enroll + checkin/quick |
| Attendance → Day Status | PARTIALLY CONNECTED | No hook on punch; regenerate elsewhere |
| Leave → Day Status | CONNECTED | regenerate_range on approve |
| Holiday/Week-off → Day Status | CONNECTED | resolve_day reads config/roster |
| Day Status → Timesheet | CONNECTED | timesheet API |
| Day Status → Payroll | CONNECTED | calculate regenerates then reads |
| Compensation enum → Premium $ | PARTIALLY CONNECTED | comp_off yes; 1.5x/2x no |
| Salary → Payroll | CONNECTED | structures |
| Payroll → Payslip | CONNECTED | PDF on approve |

---

## 9. Duplicated calculation islands

```mermaid
flowchart LR
  P1[AttendancePolicyService work_hours] --> ATT[attendance.work_hours]
  P2[DayStatusEngine worked_minutes] --> ADS
  P3[Profile.tsx differenceInHours + 160 OT] --> UI[Employee Profile display]
  ADS --> PAY
  ADS --> TS
  P3 -.->|NOT CONNECTED to ADS/PAY| X[Divergent]
```

**Single source of truth intent:** `attendance_daily_summaries` via DayStatusEngine.  
**Reality:** Profile and any raw attendance UIs can diverge until regenerate.
