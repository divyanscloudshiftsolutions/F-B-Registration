# Present Sir — Gap Analysis (Current vs Required)

**Audit date:** 2026-07-22  
**Required target architecture (from audit brief):**

```
Attendance + Leave + Holiday + Week-Off + Attendance Policy
        ↓
Daily Attendance Resolution
        ↓
Monthly Attendance Summary
        ↓
Payroll Pre-check
        ↓
Payroll Calculation
        ↓
Review → Approval → Payslip → Payment
```

**This document does not implement changes.** It compares verified current code to that target.

---

## 1. Leave

| Aspect | Current | Required | Gap |
|---|---|---|---|
| Request/approve | IMPLEMENTED | Required | Low |
| Types / balances | IMPLEMENTED | Required | Low |
| Paid/unpaid/half-day | IMPLEMENTED | Required | Low |
| Impact on daily resolution | On approve → regenerate | Always reflected | Medium — pending leave does not change day status until approved (likely correct) |
| Impact on payroll | Via lop/payable fractions | Required | Low |
| Sandwich / holiday overlap | Skip OFF days in count | Clarify policy | Document; currently “sandwich OFF” |
| Comp-off | Backend earn/consume | Required often | Medium — FE leave types can flag; HR UI create limited |

**WHAT EXISTS:** Full leave service + FE employee/admin.  
**REUSE:** `leave_service.py`, models, Leaves UI.  
**MODIFY:** Optional auto day-status on apply if product wants “tentative”; usually approve-only is fine.  
**MISSING:** Richer leave reports; stronger Profile vs week-off UX clarity.  
**DO NOT REUSE:** Profile’s independent hour math as payroll input.

---

## 2. Holiday

| Aspect | Current | Required | Gap |
|---|---|---|---|
| Calendar CRUD | IMPLEMENTED | Required | Low |
| Affect expected hours | expected=0 non-working | Required | Low |
| Affect attendance resolution | Priority 1 in engine | Required | Low |
| Affect payroll | Payable if paid; premium if worked | Required | Medium — premium ignores 1.5x/2x/ot enum |
| Scope dept/type | Model supports | Required | Low (UI may not expose all apply_to options fully — PARTIAL UI) |

**REUSE:** `holidays` + `_find_holiday` + HRPolicies.  
**MODIFY:** `_apply_calculation` premium to honor `HolidayWorkCompensation`.  
**MISSING:** Optional holiday workflows if needed.  
**DO NOT REUSE:** Hardcoded weekend assumptions (none in engine — good).

---

## 3. Week-Off

| Aspect | Current | Required | Gap |
|---|---|---|---|
| Configurable policy | fixed JSON weekdays | Required | Low |
| Rotational | Roster `is_week_off` | Required | Medium — policy_type rotational not fully productized |
| Affect resolution | Yes | Required | Low |
| Affect payroll | Payable/premium | Required | Same premium gap |
| Employee request | weekoff_requests API weak; Profile uses leave | Clarify | High UX inconsistency |

**REUSE:** weekoff_policies, roster OFF, engine `_is_week_off`.  
**MODIFY:** Unify employee “request OFF” UX (leave vs weekoff_requests).  
**MISSING:** Full rotational policy engine beyond roster.  
**DO NOT REUSE:** FE default `[5,6]` as system truth (it is form default only).

---

## 4. Attendance Resolution (Daily)

| Aspect | Current | Required | Gap |
|---|---|---|---|
| Engine exists | `DayStatusEngine` | Required | — |
| Priority chain | Holiday→WO→Leave→Att→Absent | Required | Low |
| Materialized store | `attendance_daily_summaries` | Required | — |
| Trigger on attendance write | **NOT on punch** | Should stay fresh | **HIGH** |
| Pending punches | Ignored | Decide | HIGH — treat as absent until approved |
| Joining/termination in engine | Not filtered | Should not LOP pre/post employment | Medium |

**WHAT EXISTS / REUSE:** Entire `day_status_engine.py` — this is the correct spine.  
**MODIFY:** Call `resolve_day` / regenerate on attendance create/update/approve/delete; optionally clamp employment window.  
**MISSING:** Real-time hook.  
**DO NOT REUSE:** Parallel FE calculations (Profile 160h) as authority.

---

## 5. Timesheet

| Aspect | Current | Required | Gap |
|---|---|---|---|
| Source | Day status API | Monthly resolution view | Low if engine fresh |
| Storage | Dynamic summaries | OK | — |
| Alignment with payroll | Same ADS | Required | Depends on regenerate |

**REUSE:** Timesheet page + `hr/day-status/timesheet`.  
**MODIFY:** None structural if day-status freshness fixed.  
**MISSING:** Employee self-service timesheet (optional).

---

## 6. Payroll

| Aspect | Current | Required | Gap |
|---|---|---|---|
| Pre-check | Dashboard precheck | Required | Low |
| Calculation | `_apply_calculation` | Required | Medium gaps (premium, ESI, pending att) |
| Review/approve/paid | Full run states | Required | Low |
| Payslip | PDF on approve | Required | Low |
| Payment | mark-paid metadata | Required | Low (no bank transfer integration — NOT IMPLEMENTED) |
| Snapshot immutability | Lock + reopen rules | Required | Low |
| Present/absent/LOP/leave/WO/hol | From engine | Required | Naming `days_absent`=LOP; pending invisible |

**SPECIAL PAYROLL CHECKLIST** — see `CURRENT_SYSTEM_AUDIT.md` Special Investigation table (all 18 items).

**REUSE:** `payroll_runs`, components, adjustments, FE Payroll.tsx, reportlab.  
**MODIFY:** Premium multipliers; consider payable-based salary modes; ESI if required; rename/clarify absent vs LOP.  
**MISSING:** Payment gateway; statutory ESI; automatic OT approval policy option.  
**DO NOT REUSE:** Legacy `process_monthly` as primary UX (still present but deprecated client-side).  
**DO NOT rebuild** divisor/package logic from scratch — extend `_apply_calculation`.

---

## 7. Target pipeline vs current

| Stage | Status |
|---|---|
| Attendance + Leave + Holiday + Week-Off + Policy | MOSTLY EXISTS |
| Daily Attendance Resolution | EXISTS but **stale triggers** |
| Monthly Attendance Summary | EXISTS (`monthly_summary`) |
| Payroll Pre-check | EXISTS |
| Payroll Calculation | EXISTS |
| Review | EXISTS (`under_review`) |
| Approval | EXISTS |
| Payslip | EXISTS |
| Payment | EXISTS as status/metadata only |

---

## 8. What should NOT be reused

1. OpenCV pixel embeddings as long-term biometric accuracy strategy (functional but weak vs DNN).  
2. Profile.tsx client-side overtime (160h).  
3. Unauthenticated kiosk without compensating control (VPN/device auth/API key).  
4. `weekoffService` + leave “week-off” dual paths without consolidation.  
5. UTC-date “today” endpoints for IST ops without explicit timezone setting.  
6. Treating `days_absent` as pure absences in reports without renaming.

---

## 9. Contradictions found

| Topic | Contradiction |
|---|---|
| Week-off request | Backend weekoffs API vs Profile applies leave |
| Holiday compensation | Enum 1.5x/2x vs payroll always 1× premium |
| Today’s date | Local bounds in quick state vs UTC date in `/attendance/today` |
| Half-day threshold | Policy `half_day_hours` vs engine `expected*0.5` |
| Employment type | String on user vs `employment_types` table IDs |
| React Query | Provider present; pages don’t use `useQuery` |
| Redux | In package.json; unused |
| standard_work_days=26 | Configured; unused by payroll |
