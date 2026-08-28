# Daily Technical & Architectural Issues Log — August 25, 2026

---

## Issue 1: Assign & Reserve Table Dialog Real-Time Inline Validation Alignment

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Floor plan table assignment & reservation dialog UX alignment with Check-In page validation rules. |
| **Problems Identified** | The Assign Table and Reserve Table dialog in `TablesPage.tsx` lacked real-time duplicate checks and inline field warning alerts. Users could enter invalid phone numbers, invalid emails, or duplicate contacts without immediate inline feedback below the input fields, leading to form rejection only after submission. |
| **Resolution** | Integrated strict real-time inline validation into the modal matching `CheckInPage.tsx`. Implemented format validation regexes for name, phone, and email, active token conflict detection, and a debounced (400ms) duplicate lookup via `api.validateDuplicate`. Added immediate inline warning alerts and error border styling directly below each input field, disabling the submit button until all fields satisfy validation. |
| **Activities Completed** | Verified real-time inline error rendering, duplicate phone/email detection, responsive modal layout across desktop and mobile viewports, and clean TypeScript compilation (`tsc --noEmit`). |
| **Files / Modules Updated** | `web-frontend/src/pages/TablesPage.tsx` |

---

## Issue 2: Administration Table Lock / Release Synchronization & Stale Check-In Draft Invalidation

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Table status lock synchronization between Administration Floor Plan, Redis locking engine, and Check-In draft states. |
| **Problems Identified** | When an administrator released a locked table (`in_checkin` or `maintenance`), local storage drafts (`bar_incomplete_checkin`) remained persisted on client browsers. Affected users were continually prompted to resume abandoned check-in flows for tables that were already released. |
| **Resolution** | Connected `handleToggleLockTable` in `TableManagement.tsx` to `api.unlockTable(id, true)` and `api.patchTableStatus()`, purging matching local storage keys upon release. Updated `CheckInPage.tsx` to validate saved drafts against current table states on mount and reactively dismiss stale "Resume Check-In" prompts when a table lock is released by an admin. |
| **Activities Completed** | Validated Redis lock deletion, local draft clearing, prompt dismissal, and verified that active occupied customer sessions remain strictly protected from accidental release. |
| **Files / Modules Updated** | `web-frontend/src/components/admin/TableManagement.tsx`, `web-frontend/src/pages/CheckInPage.tsx` |

---

## Issue 3: Table Lock & Reservation Attribution with Confirmation Alert Modals in Administration Side Panel

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Administration table inspection drawer UX enhancement with staff lock/reservation attribution, 2x2 action grid, and confirmation alert modals. |
| **Problems Identified** | Administrators had no visibility into which staff member locked a table or created a pending reservation when inspecting a table. Additionally, administrators lacked a dedicated action to clear abandoned reservations, and table release actions were performed without defensive confirmation dialogs. |
| **Resolution** | Enhanced `backend/src/routes.ts` (`GET /tables`, `POST /tables/:id/lock`, `PATCH /tables/:id/status`, `GET /reservations`) to record and return `lockedBy`, `lockedByRole`, `lockedAt`, and relational reservation `user` metadata. Added **Table Lock Information** and **Reservation Details** cards in the inspection side panel. Implemented dedicated **Release Table** and **Clear Reservation** confirmation alert modals. Restructured administration actions into a 2x2 grid with distinct color variations (blue for reservations, amber for locks, purple for edits, red for deletions) and dynamic enabled/disabled states. |
| **Activities Completed** | Verified side panel metadata rendering, modal confirmation workflows, responsive drawer behavior, and full TypeScript build verification (`tsc --noEmit` code 0). |
| **Files / Modules Updated** | `backend/src/routes.ts`, `web-frontend/src/types/index.ts`, `web-frontend/src/services/api.ts`, `web-frontend/src/components/admin/TableManagement.tsx` |

---

## Issue 4: Redundant Table Transfer Action Removal from Administration Floor Plan

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Administration table inspection side panel UI decluttering and redundant action removal. |
| **Problems Identified** | The table inspection drawer for occupied tables included an unused `Transfer` button that cluttered the session action row without backing workflow. |
| **Resolution** | Removed the redundant `Transfer` button from the occupied table drawer action layout in `TableManagement.tsx` and widened the primary session extension control into a clean, full-width action button. |
| **Activities Completed** | Verified clean drawer layout, responsive action alignment across viewports, and zero TypeScript compilation errors. |
| **Files / Modules Updated** | `web-frontend/src/components/admin/TableManagement.tsx` |

---

## Issue 5: Email QR Verification Table Resolution and Session Activation Fix

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | QR code verification and payment confirmation session activation pipeline resilience. |
| **Problems Identified** | When completing check-in payment after verifying customer QR codes, the system produced a `Table S-01 not found` error. The frontend QR scanner omitted restoring `selectedTableId` into state, while backend SQL locking omitted selecting `table_id`, preventing fallback table resolution. |
| **Resolution** | Updated `CheckInPage.tsx` (`handleVerifyQR` & `executeFinalCheckIn`) to restore `selectedTableId` and fallback to token table numbers. Updated `TokenService.ts` (`activatePendingSession`) and `routes.ts` (`checkInPendingHandler`) to select `table_id` and implement multi-tier table resolution (normalized table number + place type, table number alone, or token-assigned table ID). |
| **Activities Completed** | Verified end-to-end QR scan verification, payment receipt activation, table status occupation transition, and verified TypeScript compilation (`tsc --noEmit` code 0). |
| **Files / Modules Updated** | `web-frontend/src/pages/CheckInPage.tsx`, `backend/src/services/TokenService.ts`, `backend/src/routes.ts` |

---

## Issue 6: Occupied Table Release Persistence with 'This table was closed by Admin' Audit Trail & Extend Session Integration

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Administration floor plan occupied table force-release data persistence, financial auditing, and session extension modal integration. |
| **Problems Identified** | Force-releasing occupied tables from Administration → Tables previously cleared the table record without properly closing the associated active session in the database or archiving complete financial breakdown metrics (initial + extension payments, customer contact, headcount, closure timestamp). In addition, the drawer's `Extend Session` button was not connected to the extension modal. |
| **Resolution** | Enhanced `PUT /tables/:tableId/release` in `backend/src/routes.ts` to gracefully invoke `tokenService.closeSession` for active/extended tokens, update `TableOccupancyLog`, and write structured audit records to `SyncLog` with closure reason `"MANUAL"` and reason detail `"This table was closed by Admin"`. Enhanced the release confirmation modal in `TableManagement.tsx` to display customer name, phone, email, headcount, initial payment, extended payment, and total amount before confirming release. Connected `Extend Session` button in `TableManagement.tsx` to `ExtendSessionModal` to allow administrators to extend active table sessions seamlessly. |
| **Activities Completed** | Verified end-to-end occupied table release, financial breakdown calculation, database status transitions to `CLOSED`, audit log recording with `"This table was closed by Admin"` note, and zero TypeScript compilation errors (`tsc --noEmit` code 0). |
| **Files / Modules Updated** | `backend/src/routes.ts`, `web-frontend/src/services/api.ts`, `web-frontend/src/components/admin/TableManagement.tsx` |

---

## Issue 7: Active Session Conflict Logic Refinement for Table Locking and Maintenance Transitions

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Floor plan table lock and maintenance status validation refinement in backend routes. |
| **Problems Identified** | In `PATCH /tables/:id/status`, the active session check queried tokens with status `[ACTIVE, EXTENDED, EXPIRED]`. Because historical expired sessions were included in the query, unoccupied available tables with past expired tokens incorrectly threw `CONFLICT_ACTIVE_SESSION ("Cannot set table to maintenance while it has active sessions")` when clicked by administrators to lock. |
| **Resolution** | Refined `PATCH /tables/:id/status` in `backend/src/routes.ts` to only count active sessions if the table is currently `occupied` with `currentTokenId !== null` and has tokens in `[ACTIVE, EXTENDED]` status. Updated `handleToggleLockTable` in `TableManagement.tsx` to utilize `api.lockTable` for standard lock attribution and Redis lock tracking. |
| **Activities Completed** | Verified smooth locking and releasing on all available and unoccupied tables, validated lock attribution display in the side panel, and confirmed TypeScript compilation (`tsc --noEmit` code 0). |
| **Files / Modules Updated** | `backend/src/routes.ts`, `web-frontend/src/components/admin/TableManagement.tsx` |

---

## Issue 8: Extend Session UX Harmonization and Multi-Format Rate Resolution

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Cross-module session extension rate configuration resolution and floor plan action alignment. |
| **Problems Identified** | In `ExtendSessionModal.tsx`, rate configuration lookups strictly compared `token.placeType` as a primitive string, which failed when tokens contained structured place type objects, missing place type IDs, or custom table number prefixes. Additionally, occupied table cards in the Administration floor plan lacked direct card-level access to the extension modal. |
| **Resolution** | Enhanced `ExtendSessionModal.tsx` rate configuration matching to support place type ID lookups, case-insensitive string matching, nested object `id/name` parsing, and `S-` (Standing Bar) / `L-` (Lounge) table number prefix heuristics with fallback to the primary facility rate. Added a dual action layout on occupied table cards in `TableManagement.tsx` (`[ Release ] [ Extend ]`) alongside the side panel action drawer. |
| **Activities Completed** | Verified consistent rate calculation across all session types, modal opening from both card and drawer triggers, and clean TypeScript compilation (`tsc --noEmit` code 0). |
| **Files / Modules Updated** | `web-frontend/src/components/modals/ExtendSessionModal.tsx`, `web-frontend/src/components/admin/TableManagement.tsx` |

---

## Issue 9: Bartender Cumulative Redemption Progress & Cross-View Entitlement Breakdown Synchronization

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Bartender check-in cards and scan mode UI synchronization for cumulative drink redemptions and carried-forward balances. |
| **Problems Identified** | The Bartender → Check-ins cards and Scan Mode displayed simple aggregate counts (`0 / 2 Drinks Used`) without distinguishing between drinks granted by the current check-in seating package and eligible unused redemptions carried forward from prior customer visits. |
| **Resolution** | Updated `web-frontend/src/pages/BartenderPage.tsx` across both the Check-Ins list cards and Scan Mode modal. Structured the presentation into authoritative metrics: `Total Redeemed / Total Entitlement USED`, `Remaining Drinks Available`, with distinct indicators for `Current Check-In` and `Carried Forward (+N)` balances. Preserved the authoritative backend redemption calculation pipeline without duplicating or altering business rules. |
| **Activities Completed** | Verified consistent redemption tracking, multi-drink dispensing, carried-forward pill rendering, and clean TypeScript compilation (`tsc --noEmit` code 0). |
| **Files / Modules Updated** | `web-frontend/src/pages/BartenderPage.tsx` |

---

## Issue 10: Instant Drink Redemption Synchronization, Redis Aggregate Cache Invalidation, and Over-Redemption Prevention

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Bartender redemption transaction consistency, Redis cache lifecycle synchronization, and rapid-click over-redemption prevention. |
| **Problems Identified** | In `RedemptionService.ts`, successful drink redemptions updated database records and individual token keys (`token:${tokenNumber}`), but omitted invalidating the aggregate `tokens:active` list cache in Redis (300s TTL). Consequently, background frontend refreshes fetched stale `redemptionsUsed: 0` states, keeping the Redeem button active and allowing redundant in-flight clicks that could attempt over-redemption until hitting late backend locks. |
| **Resolution** | Updated `RedemptionService.ts` (`processRedemption` and `undoRedemption`) to invalidate `tokens:active` and `tokens:all` immediately upon transaction commit. Enhanced `POST /redemptions` to return authoritative token snapshots and updated counts. Implemented per-token in-flight tracking (`redeemingTokenIds`) in `BartenderPage.tsx` to instantly lock and disable buttons upon click, updating local state directly from authoritative response payloads before background reconciliation. |
| **Activities Completed** | Verified instant count incrementation, immediate button disablement on quota exhaustion (`redemptionsUsed >= totalAllowed`), safe idempotent rapid-click handling, and full TypeScript build verification (`tsc --noEmit` code 0). |
| **Files / Modules Updated** | `backend/src/services/RedemptionService.ts`, `backend/src/routes.ts`, `web-frontend/src/pages/BartenderPage.tsx` |
