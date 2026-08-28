# Daily Technical & Architectural Issues Log — August 17, 2026

---

## Issue 15: Brand Logo Container Light Theme Accessibility Correction

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Brand logo application icon theme and contrast accessibility styling |
| **Problems Identified** | In the light theme, the brand logo container style (`.premium-logo-glow`) relied on the CSS custom variable `var(--glow-rgb)` to render its background gradient. However, `var(--glow-rgb)` was not defined globally under `:root`, leaving the background transparent. This caused the white icon inside the container to overlay directly on the white sidebar, rendering the application icon completely invisible. |
| **Resolution** | Refactored the `.premium-logo-glow` CSS selector in `index.css` to directly bind the background color to the defined theme primary variables (`var(--color-primary)` and `var(--color-primary-border)`). This ensures a solid, high-contrast purple container background in the light theme and a solid gold background in the dark theme, restoring full visibility to the white icon. |
| **Activities Completed** | Updated CSS variables rendering, verified contrast ratios, toggled light and dark modes, and verified production bundling output. |
| **Files / Modules Updated** | `web-frontend/src/styles/index.css` |

---

## Issue 16: Primary Button Icon Contrast and Color Inheritability

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Primary buttons icon contrast and text color matching styling |
| **Problems Identified** | In the light theme, the `+` icon inside the "Open for Seating" button (and other primary buttons) displayed in dark gray (`#71717A` / `#52525B`) instead of white. This created a visual style mismatch, making it fail to contrast correctly with the button's background design. |
| **Resolution** | Appended a specific style rule in `index.css` overriding the `.nav-icon-badge` color for `.primary-btn` and `.premium-btn-primary` selectors in both light and dark modes to use `currentColor !important`. This forces the icon inside the badge to dynamically inherit the exact text color of its parent button (white or black depending on active status). |
| **Activities Completed** | Refactored button icon style bindings, checked contrast in light mode, validated responsiveness, and compiled the project cleanly. |
| **Files / Modules Updated** | `web-frontend/src/styles/index.css` |

---

## Issue 17: Button Icon Badge Sizing and Padding Customizability (Editability)

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Primary buttons icon container box-sizing and padding editability styling |
| **Problems Identified** | The button icon badge style (`.nav-icon-badge`) inside buttons used strict `!important` declarations for its width, height, and border properties. Concurrently, it was set to `box-sizing: content-box`. This prevented developers from editing the inner padding or sizing from React component markup using standard classes (such as `p-0.5`). |
| **Resolution** | Removed the `!important` flags from width, height, and border styles in `index.css`. Swapped `box-sizing` to `border-box` so that padding classes cleanly shrink the inner icon instead of expanding the outer dimensions. Applied custom `p-0.5` padding classes on table creations and "Open for Seating" buttons in `TableManagement.tsx` to align the `+` icon badge cleanly. |
| **Activities Completed** | Refactored CSS constraints, changed box-sizing behaviors, applied padding classes, verified styling, and ran production builds. |
| **Files / Modules Updated** | `web-frontend/src/styles/index.css`, `web-frontend/src/components/admin/TableManagement.tsx` |

---

## Issue 18: Button Icon Badge Background and Border Visibility

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Primary buttons icon badge container visual presence and contrast styling |
| **Problems Identified** | The button icon badge background and border-colors were overridden to `transparent` globally for light and dark modes in `index.css`. This caused the glass-morphism borders and container shading of the `+` icon badge in the "Open for Seating" button to be completely invisible, making the padding inside the badge container unobservable. |
| **Resolution** | Appended a specific style rule in `index.css` overriding the background and borders of `.nav-icon-badge` nested inside `.primary-btn` and `.premium-btn-primary` selectors. Set these to a semi-transparent white background (`rgba(255, 255, 255, 0.18) !important`) and a crisp solid white outline (`border: 1px solid rgba(255, 255, 255, 0.3) !important`) in all themes. This makes the badge container shape and padding clearly visible on both purple and gold button colors. |
| **Activities Completed** | Refactored override CSS rules, tested styling visibility in light theme, verified visual padding boundaries, and ran production builds successfully. |
| **Files / Modules Updated** | `web-frontend/src/styles/index.css` |

---

## Issue 19: Direct Assign → Stop Check-In Table Release — Draft Fallback Recovery

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Direct Assign Check-In lifecycle where a table is locked as `in_checkin` without creating a reservation and must be released to `available` when the receptionist stops Check-In. |
| **Problems Identified** | After Direct Assign, if the receptionist refreshed the page, switched browser tabs, or returned to the Check-In page later, the active React `selectedTableId` could be empty while the table ID still existed inside the persisted `bar_incomplete_checkin` draft. Stop Check-In therefore attempted to unlock an empty table ID, leaving the table stuck in `in_checkin` in PostgreSQL and Redis. |
| **Resolution** | Updated the Stop Check-In and reset/abandon cleanup paths to recover the table ID from the persisted incomplete Check-In draft when the active React state is unavailable. The effective unlock target is now derived from `selectedTableId || draftTableId` before the draft is deleted. Direct Assign tables without a pending reservation are returned to `available`, while reservation-based Check-In continues to use reservation-aware rollback behavior. |
| **Activities Completed** | Audited `handleAbandonCheckIn`, `handleResetWizard`, Stop Check-In confirmation flow, localStorage draft handling, `api.unlockTable()`, backend unlock logic, PostgreSQL table state and Redis lock cleanup. Verified Direct Assign Stop Check-In after normal navigation, browser tab switching and page refresh. Verified `npx tsc --noEmit` and `npm run build`. |
| **Files / Modules Updated** | `web-frontend/src/pages/CheckInPage.tsx`, `web-frontend/src/api.ts`, backend table unlock route/service where applicable |

---

## Issue 20: Direct Assign Input Validation — Pre-Lock Validation Boundary

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Tables Page Direct Assign flow must validate customer information and guest headcount before the table is locked and before navigation to Check-In. |
| **Problems Identified** | Invalid or incomplete values could previously progress from the Assign Table dialog into Check-In and rely entirely on downstream validation. This created an unnecessary opportunity to lock a table with invalid customer/headcount data and increased the risk of inconsistent Check-In state. |
| **Resolution** | Added an early validation boundary inside the Tables Page Assign submission flow. Guest count is validated as a positive integer, decimal values are rejected, and the requested count cannot exceed the selected table's capacity. Customer name, phone, email and duplicate phone/email/check-in validation are also performed before table locking and navigation. Invalid submissions do not lock the table, write draft data or navigate to Check-In. |
| **Activities Completed** | Audited `handleReserveSubmit` and related Assign Table state. Added/verified numeric, decimal, capacity, customer-format and duplicate validation. Verified that valid Direct Assign requests proceed to Check-In while invalid requests remain on the Assign dialog. Verified that Direct Assign does not create an unnecessary reservation. |
| **Files / Modules Updated** | `web-frontend/src/pages/TablesPage.tsx`, `web-frontend/src/api.ts`, related backend validation endpoints |

---

## Issue 21: Direct Assign vs Reservation Lifecycle Separation — Table State Integrity

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Maintain two independent table workflows: Reservation → Assign → Check-In and Direct Assign → Check-In, with different rollback states. |
| **Problems Identified** | Both workflows enter `in_checkin`, but their Stop Check-In outcomes are different. Treating every unlocked table identically could incorrectly convert a reservation table to `available` or leave a Direct Assign table unnecessarily represented as a reservation. |
| **Resolution** | Preserved reservation-aware backend unlock behavior. Reservation-based Check-In returns to `reserved` when the underlying `PENDING` reservation remains active. Direct Assign has no reservation and returns directly to `available`. Direct Assign identification is preserved through the Check-In draft/state without creating a database reservation solely for lifecycle tracking. |
| **Activities Completed** | Traced table status transitions, reservation lookup behavior, Direct Assign lock flow, Stop Check-In cleanup, PostgreSQL status updates and Redis lock deletion. Verified both lifecycle paths independently and confirmed that Direct Assign does not generate an unwanted reservation card. |
| **Files / Modules Updated** | `web-frontend/src/pages/CheckInPage.tsx`, `web-frontend/src/pages/TablesPage.tsx`, backend `routes.ts`, `TableService.ts`, related reservation services |

---

## Issue 22: Stale `in_checkin` State & Redis Lock Self-Healing

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Automatic reconciliation of tables left in `in_checkin` when the corresponding Redis lock expires, disappears or becomes inconsistent with PostgreSQL state. |
| **Problems Identified** | Tables could remain permanently stuck in `in_checkin` when a browser session ended unexpectedly or a Redis lock disappeared before the database table status was restored. This could make the table unavailable to other receptionists despite no active Check-In session existing. |
| **Resolution** | Verified and strengthened stale-state reconciliation so the backend checks the authoritative database state together with Redis lock state and active pending reservations before deciding whether a table can be released. Tables without an active lock or valid pending reservation can be safely restored to their appropriate state. |
| **Activities Completed** | Audited Redis table lock keys, PostgreSQL `in_checkin` status, active reservation checks and the system reconciliation flow. Tested stale `in_checkin` scenarios and expired Redis lock scenarios. Verified that affected Direct Assign tables can return to `available` and reservation-backed tables retain their reservation lifecycle. |
| **Files / Modules Updated** | `backend/TokenService.ts`, `backend/routes.ts`, `TableService.ts`, Redis lock/reconciliation logic |

---

## Issue 23: Tables & Reservations Real-Time State Synchronization

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Keep Tables Page, Reservations Page and Check-In state synchronized immediately after assignment, table switching, locking, unlocking and Stop Check-In operations. |
| **Problems Identified** | Table state changes could previously exist correctly in the backend while another page continued displaying stale frontend data until a manual browser refresh. This created a multi-user synchronization gap where released or locked tables were not immediately represented in the UI. |
| **Resolution** | Verified and corrected the synchronization paths so table and reservation state is refreshed/updated after important lifecycle mutations. Locking, table switching, Stop Check-In and release operations now propagate their updated state without depending on a manual browser refresh. |
| **Activities Completed** | Tested Tables → Assign, Reservation → Assign, table switching, Stop Check-In, Direct Assign release and cross-page state updates. Verified that `in_checkin`, `reserved` and `available` states are reflected correctly across relevant UI surfaces. |
| **Files / Modules Updated** | `web-frontend/src/pages/TablesPage.tsx`, `web-frontend/src/pages/CheckInPage.tsx`, Reservations components, API/state synchronization logic |

---

## Issue 24: Complete Database / API / Component / State Dependency Audit

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | End-to-end architectural audit of the Bar Management System's database, backend APIs, React components, Redis state and browser-persisted state across Tables, Reservations, Check-In, Assignment and Session workflows. |
| **Problems Identified** | The growing number of fixes across table locking, reservations, Check-In drafts, Redis locks and frontend synchronization created a risk of hidden dependencies, duplicated lifecycle logic, unused fields, stale state references, inconsistent status transitions and frontend/backend mismatches. A complete dependency trace is required before further architectural changes. |
| **Resolution** | Initiated a comprehensive audit covering every relevant PostgreSQL table and attribute, relationship, API endpoint, backend service, React component, Redis key/state, localStorage/sessionStorage dependency and lifecycle transition. The audit specifically checks for orphaned fields, incorrect relationships, unused APIs, duplicated logic, missing cleanup paths, race conditions and state synchronization mismatches. |
| **Activities Completed** | Defined the audit scope and traced the current Table, Reservation, Check-In, Direct Assign, Redis lock, draft persistence and synchronization lifecycles. Verified the relationship between frontend state, backend APIs, PostgreSQL status and Redis state. Established the audit as the next architectural verification layer after functional bug fixes. |
| **Files / Modules Updated** | Audit scope covers `TablesPage.tsx`, `CheckInPage.tsx`, Reservations components, `api.ts`, backend `routes.ts`, `TableService.ts`, `TokenService.ts`, Redis lock/reconciliation logic, PostgreSQL schema and localStorage/sessionStorage dependencies |

---

## Issue 25: Capacity Warning Modal — Keep Current Table / Change Table Actions Restored

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Check-In page headcount stepper capacity enforcement. When the guest count reaches or exceeds the selected table's maximum capacity and the user attempts to increment further, a capacity warning modal must appear with two distinct actions: **Keep Current Table** and **Change Table**. |
| **Problems Identified** | The capacity warning with its two required action buttons (Keep Current Table / Change Table) had been lost during prior Direct Assign bug-fix iterations. All headcount inputs (+ button, manual numeric input, quick-select presets) were directly capping the value at `maxCapacity` via inline toast messages, without presenting the dual-action modal that allows the receptionist to either stay with the current table at its maximum capacity or release the table and navigate to the seating stage with the higher attempted headcount. Additionally, the previous bug where "Keep Current Table" incorrectly incremented the count (e.g., 4 → 5 on a capacity-4 table) needed to remain permanently fixed. |
| **Resolution** | Introduced `handlePersonsCountChange(val)` as a centralized interceptor for all headcount mutations. This function checks whether the attempted value exceeds the selected table's individual capacity (distinct from the global `maxCapacity`). If exceeded, it stores the attempted count in `attemptedPersonsCount` state and opens `showCapacityWarning` modal without committing the value to `personsCount`. **Keep Current Table** (`handleKeepTable`) reverts `personsCount` to the table's capacity and closes the warning. **Change Table** (`handleChangeTable`) calls `api.unlockTable()` to release the current table, clears selection, commits the attempted count, and navigates to Stage 2 (Table Seating). A reactive `useEffect` also triggers the warning for pre-filled data scenarios. |
| **Activities Completed** | Added state hooks (`showCapacityWarning`, `hasDismissedCapacityWarning`, `attemptedPersonsCount`). Implemented `handlePersonsCountChange`, `handleKeepTable`, `handleChangeTable` handlers. Routed all headcount controls (minus button, plus button, numeric text input, quick-select preset buttons) through `handlePersonsCountChange`. Rendered `renderCapacityWarningModal` at `z-[100]`. Verified TypeScript compilation (`npx tsc --noEmit` — exit code 0) and production build (`npm run build` — exit code 0). |
| **Files / Modules Updated** | `web-frontend/src/pages/CheckInPage.tsx` |

---

## Issue 26: Stop Check-In Confirmation Modal — Wizard Header and Incomplete Check-In Prompt

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Check-In page stop/abort workflow. Both the wizard header button and the "Incomplete Check-In Found" resume prompt require a confirmation modal before executing the destructive stop action that unlocks the table and resets state. |
| **Problems Identified** | The "Close & Start New" label did not clearly communicate the destructive nature of the action (table unlock, state reset). There was no confirmation step — clicking the button immediately reset the wizard and unlocked the table without user confirmation, risking accidental data loss during active check-in sessions. |
| **Resolution** | Renamed "Close & Start New" to **"STOP CHECK-IN"** across both the wizard progress header and the incomplete check-in resume prompt. Wrapped both triggers with `handleStopCheckInWithConfirmation()` which opens a dedicated confirmation modal (`renderStopCheckInConfirmModal`) with **"YES — Stop Check-In"** and **"NO — Continue Check-In"** buttons. The YES button is auto-focused. Keyboard shortcuts are wired: `Enter` triggers YES, `Escape` triggers NO. The modal renders at `z-[100]` above all other UI layers. The wizard header button was restyled as a red outline button (`bg-red-500/5 border border-red-500/20`) for clear visual distinction as a destructive action. |
| **Activities Completed** | Added state hooks (`showStopCheckInConfirmModal`, `onConfirmStop`). Implemented `handleStopCheckInWithConfirmation` and keyboard event listener `useEffect`. Created `renderStopCheckInConfirmModal` JSX block. Updated both the wizard header button and the incomplete check-in prompt button labels and styles. Mounted the modal in both the continue-prompt early return and the main layout return. Verified TypeScript and production build pass. |
| **Files / Modules Updated** | `web-frontend/src/pages/CheckInPage.tsx` |


