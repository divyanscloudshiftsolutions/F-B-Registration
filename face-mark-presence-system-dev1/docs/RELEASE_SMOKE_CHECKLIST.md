# Present Sir — Release Smoke Checklist

Use this on **staging / production** after deploy. Check each box only after observing the result.

**Environment:** ________________  
**Build / commit:** ________________  
**Tester:** ________________  
**Date:** ________________  

---

## Infrastructure

- [ ] Backend healthy (`/api` or health check responds)
- [ ] Frontend loads (no blank/error shell)
- [ ] `ENVIRONMENT=production` (or staging equivalent) set
- [ ] Strong `SECRET_KEY` configured (app starts; weak key rejected in production)
- [ ] `APP_TIMEZONE=Asia/Kolkata` (or intended zone) active
- [ ] `ALLOW_PUBLIC_EMPLOYEE_REGISTRATION=false`
- [ ] `KIOSK_API_TOKEN` set and matches `VITE_KIOSK_TOKEN`
- [ ] CORS includes production frontend origin
- [ ] MinIO / object storage reachable for photos & payslips
- [ ] Logs writable (`face-backend.log` / `face-frontend.log` as deployed)

---

## Auth

- [ ] Employee login → employee dashboard
- [ ] Admin login → admin dashboard
- [ ] Public employee registration blocked
- [ ] Admin bootstrap registration blocked when an admin already exists
- [ ] Employee JWT cannot open admin-only pages/APIs

---

## Employees & face

- [ ] Admin create employee
- [ ] Face enrollment (multiple angles) succeeds
- [ ] Enrollment error paths acceptable (no face / bad image) without crashing UI
- [ ] Employee face check-in
- [ ] Employee face check-out
- [ ] Dashboard / today attendance reflects punches

---

## Attendance variants

- [ ] Manual attendance created as PENDING
- [ ] PENDING does not count as payable day in Timesheet/ADS
- [ ] Admin approve → ADS / Timesheet update
- [ ] Admin reject → remains excluded
- [ ] Kiosk attendance with valid token works
- [ ] Kiosk without token / wrong token blocked

---

## Leave / holiday / week-off / roster

- [ ] Leave request → admin approval → balances update → Timesheet reflects leave
- [ ] Half-day paid leave + half present → payable day = 1 (spot-check)
- [ ] Holiday create reflects in Timesheet for applicable employees
- [ ] Holiday remove restores normal day resolution
- [ ] Week-off / published roster OFF reflects in Timesheet
- [ ] Draft roster edit does **not** change Timesheet until publish

---

## Employment / half-day / Profile

- [ ] Mid-month joiner: no pre-join LOP on Timesheet or Payroll
- [ ] Half-day policy (`half_day_hours` ≠ full/2) behaves as configured
- [ ] Profile worked / expected / OT hours match Admin Timesheet for same month

---

## Payroll & payslip

- [ ] Process test payroll run (create → calculate → review)
- [ ] LOP deduction matches ADS LOP days
- [ ] Worked holiday/week-off **1.5x** premium looks correct (not 2.5x/3x)
- [ ] Worked holiday/week-off **2x** premium looks correct
- [ ] `comp_off` / `normal` do not add unexpected cash premium
- [ ] Approve / generate payslip
- [ ] Payslip PDF opens; LOP labeled correctly
- [ ] Mark paid (if used)
- [ ] Employee can open own payslip
- [ ] Employee **cannot** open another employee’s payslip

---

## Payroll lock (critical)

After payroll is locked (approved/paid per product rules):

- [ ] Locked attendance create/edit/delete → **409**
- [ ] Locked quick attendance → **409**
- [ ] Locked leave approval → **409**; leave/balance/ADS unchanged
- [ ] Locked holiday create/edit/delete → **409**; holiday unchanged
- [ ] Locked published roster / week-off authoritative change → **409**
- [ ] Approved/paid payslip amounts unchanged after later unrelated edits in other months

---

## Timezone spot-check

- [ ] Near local midnight: dashboard today, attendance today, kiosk day, and Timesheet date agree
- [ ] Late arrival after grace matches APP_TIMEZONE wall clock (not server OS TZ)

---

## Sign-off

| Role | Name | Result | Notes |
|---|---|---|---|
| QA / Ops | | PASS / FAIL | |
| Product / Owner | | GO / NO-GO | |

**Overall:** READY FOR PRODUCTION / HOLD  

**Blockers found:** ________________
