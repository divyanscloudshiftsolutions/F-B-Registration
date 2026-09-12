# Customer Access Code Portal Experience, Expiry Alert Navigation, Reservation Workflows, and Check-In Lifecycle Management

---

## Issue 1: Premium vs Standard Tiered Email Dispatch and 6-Digit Dynamic Access Code Delivery

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Tiered customer notification delivery service and dynamic 6-digit access code authentication for self-ordering portal access. |
| **Problems Identified** | Standard standing bar counter bookings were receiving self-ordering table portal links intended exclusively for Premium Lounge table guests. Additionally, customer check-in emails lacked a simple, customer-friendly authentication method, forcing customers to manually copy long alphanumeric token IDs (`BAR-XXXXXXXX-XXXXX`) to access digital menus. |
| **Resolution** | Implemented tier-specific email templates in `EmailNotificationService.ts` where Standard Bar bookings receive counter-ordering passes without customer portal links, while Premium Lounge bookings receive dynamic 6-digit access codes (`Math.floor(100000 + Math.random() * 900000)`) cached in Redis (`customer-code:${accessCode}`). Added high-contrast code display cards with `📋 Copy Code` and `📋 Copy ID` one-click clipboard buttons and clear, non-technical instructions. |
| **Activities Completed** | Updated email dispatch logic for both initial check-ins (`ENTRY_PASS`) and session extensions (`EXTENSION`). Verified Redis TTL caching, verified fallback token suffix lookups in backend routes (`/api/customer/access/:tokenNumber` and `/api/customer/recover`), and validated template rendering across mobile and desktop email clients. |
| **Files / Modules Updated** | `backend/src/services/EmailNotificationService.ts`, `src/services/EmailNotificationService.ts`, `backend/src/routes.ts` |

---

## Issue 2: Customer Landing Portal Redesign, Token ID Rephrasing, and Settled Session Bill View

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Customer Guest Access Landing Portal (`/customer/landing`) optimization, local session privacy cleanup, and post-settlement receipt view. |
| **Problems Identified** | The customer landing page contained prefilled hardcoded test tokens (`BAR-20260902-00008`) and test phone numbers (`9833161990`). Furthermore, active session resume banners exposed previous user table details on shared browser terminals. The manual token entry option was confusingly labeled as "Scan Table Pass QR" despite prompting for text input, and concluded/settled sessions did not properly restrict customer re-ordering. |
| **Resolution** | Completely stripped all hardcoded dummy data from `CustomerLandingPage.tsx` and removed active session resume cards across Mobile, Tablet, and Desktop layouts. Rephrased the scan action to "Enter Table Token ID" with dedicated `Ticket` icon and modal inputs. Integrated the 6-digit access code recovery flow, and configured `CustomerAccessPage.tsx` to display itemized finalized bills and disable menu ordering when a session is in `CLOSED` or `COMPLETED` state. |
| **Activities Completed** | Rebuilt responsive layouts across Mobile (320px–767px), Tablet (768px–1023px), and Desktop (1024px+) viewports adhering strictly to Brand Purple (`#8D6CE5`) styling. Verified modal keyboard accessibility (Escape to dismiss, auto-focus), validated empty input initialization, and confirmed zero TypeScript errors. |
| **Files / Modules Updated** | `web-frontend/src/pages/CustomerLandingPage.tsx`, `web-frontend/src/pages/CustomerAccessPage.tsx`, `web-frontend/src/context/CustomerContext.tsx`, `web-frontend/src/services/api.ts` |

---

## Issue 3: Dashboard Table Expiry Notification Click Action and Right-Side Inspection Drawer Integration

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Executive Dashboard live attention notifications and Floor Tables inspection workflow integration. |
| **Problems Identified** | When staff users clicked on urgent "Session Expiring Soon" (<= 10 mins remaining) or "Table awaiting checkout" (00:00:00 / EXPIRED) notification cards on the Dashboard, no navigation occurred, forcing staff to manually switch pages, search for the table, and find its controls. |
| **Resolution** | Connected notification card click handlers (`onAction`) in `DashboardPage.tsx` to resolve the table's stable identifier (`tableId`/`tableNumber`/`tokenId`), persist it to `bar_auto_inspect_table_id`, dispatch the `bar_auto_inspect` event, and navigate directly to `tables/occupied`. Enhanced `inspectTableById` in `TablesPage.tsx` to automatically switch seating zones (`STANDING_BAR` vs. `PREMIUM_LOUNGE`), activate the Occupied filter, and open the right-side inspection drawer panel (`inspectingTable`) displaying customer metrics, live countdown timer, `Extend Session`, and `Checkout` action buttons. |
| **Activities Completed** | Handled asynchronous/deferred table loading in `TablesPage.tsx` via reactive `useEffect` on `[realTables, activeTab]`. Made entire notification cards and action buttons interactive with hover feedback, and enabled global urgent session toast alerts in `App.tsx` to trigger the same table inspection flow upon click. |
| **Files / Modules Updated** | `web-frontend/src/pages/DashboardPage.tsx`, `web-frontend/src/pages/TablesPage.tsx`, `web-frontend/src/App.tsx` |

---

## Issue 4: Case-Insensitive Seating Status Validation in Table Reservation and Check-In Workflows

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Table reservation creation, session check-in validation, and database status consistency. |
| **Problems Identified** | Table reservation attempts failed with the error "Table L-08 is not available for reservation (current status: AVAILABLE)" because backend route validation performed strict case-sensitive comparisons (`table.status !== 'available'`) against PostgreSQL table records stored in uppercase. |
| **Resolution** | Updated table status validation in `backend/src/routes.ts`, `src/routes.ts`, and `TokenService.ts` to perform case-insensitive normalization `(table.status || '').toLowerCase() !== 'available'`. Normalized all table status entries in the database to lowercase `'available'` for architectural consistency. |
| **Activities Completed** | Verified reservation creation endpoints, table locking mechanisms, and table switch validations. Executed full TypeScript compilation verification (`npx tsc --noEmit`) on backend with 0 errors. |
| **Files / Modules Updated** | `backend/src/routes.ts`, `src/routes.ts`, `backend/src/services/TokenService.ts` |

---

## Issue 5: Check-In Process Isolation, Step-Preserving Resume, and Session Stop Synchronization

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Receptionist Check-In workflow draft state preservation, step progression isolation, and clean session stop cancellation. |
| **Problems Identified** | Incomplete check-in drafts were erroneously merged with independent Table Assignment actions. When a user entered only a phone number on Stage 1 (leaving Name and Email empty), left the page, and resumed, the process either merged with later table assignments or advanced away from Stage 1. Furthermore, stopping a session did not reliably clean up temporary table locks or ensure clean, uncorrupted prefill for subsequent check-ins. |
| **Resolution** | Refactored `CheckInPage.tsx` and `TablesPage.tsx` to maintain strict single-process state integrity: (1) `handleContinueCheckIn` restores only the exact saved process that triggered the prompt without cross-merging fields; (2) Incomplete customer details (phone only, name/email missing) strictly enforce Stage 1 (Customer Details) without advancing to Table Seating or Tables navigation; (3) Table assignments from `TablesPage` (`isAssignFlow`, `handleAssignReservation`, `handleRedirectToCheckIn`) set an explicit `bar_checkin_just_assigned` flag to load dedicated table assignment processes directly without stale resume interference; (4) `handleAbandonCheckIn` completely purges all process storage keys, cancels backend pending sessions via `api.cancelSession`, unlocks all associated tables via `api.unlockTable`, and resets component states to pristine blank defaults. |
| **Activities Completed** | Validated exact test scenarios: (a) Phone-only entered -> leave page -> return -> Resume -> accurately stays on Stage 1 Customer Details with phone prefilled and name/email required; (b) Intentional Table Assignment from Tables page -> loads correct complete details and assigned table without mixing; (c) Stop Check-In -> cleanly clears all draft state, unlocks tables, cancels pending sessions, and allows immediate phone/email reuse without stale data. Verified 0 TypeScript errors on frontend and backend. |
| **Files / Modules Updated** | `web-frontend/src/pages/CheckInPage.tsx`, `web-frontend/src/pages/TablesPage.tsx`, `web-frontend/src/components/admin/TableManagement.tsx`, `backend/src/services/TokenService.ts`, `src/services/TokenService.ts`, `backend/src/routes.ts`, `src/routes.ts` |

---

## Issue 6: Table Reservation, Assignment & Check-In Concurrency Alignment with Architectural Specification

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Complete end-to-end alignment of the Table Reservation, Assignment, and Check-In lifecycle with `TABLE_RESERVATION_ASSIGNMENT_WORKFLOW.md`. |
| **Problems Identified** | (1) Multi-receptionist polling interval in `DataContext.tsx` was 15s instead of the mandatory 10s specified in the MD; (2) The Table `Assign` flow did not create a PostgreSQL reservation prior to check-in transition, causing missing reservation anchors and lacking rollback on table locking failures; (3) Stage 1 guest count and customer modifications were not synchronized to PostgreSQL `Reservation` records prior to seating; (4) Changing tables in Check-In prematurely unlocked original tables before alternative selections were secured, risking race condition seat loss; (5) Backend reservation creation and table locking lacked row-level locking (`FOR UPDATE`), ownership verification against reserved tables, and real-time WebSocket state broadcasting. |
| **Resolution** | (1) Updated `syncInterval` to 10000ms (10s) in `DataContext.tsx` while preserving request deduplication and chime notifications; (2) Modified `handleReserveSubmit` in `TablesPage.tsx` to create authoritative `PENDING` reservations first via `api.createReservation` and implemented compensating rollbacks (`api.cancelReservation`) if locking fails; (3) Updated `CheckInPage.tsx` (`handleStage1Next`) to synchronize customer and guest updates to database reservation records; (4) Implemented atomic 3-step table switching (`lockTable(new)` -> `updateReservation` -> `unlockTable(old)`) with catch rollback in `CheckInPage.tsx` while keeping old tables locked during search; (5) Implemented row-level transactional locking (`tx.$queryRaw FOR UPDATE`), 409 Conflict rejection for occupied/reserved tables, reservation ownership verification on table locks, and real-time WebSocket broadcast (`broadcastTableUpdated`) in `backend/src/routes.ts`. |
| **Activities Completed** | Verified end-to-end static code flow paths against all sections of `TABLE_RESERVATION_ASSIGNMENT_WORKFLOW.md`. Executed TypeScript compilation checks across both backend and frontend (`npx tsc --noEmit`) with 0 errors. Verified running dev servers without crashes or memory leaks. |
| **Files / Modules Updated** | `web-frontend/src/context/DataContext.tsx`, `web-frontend/src/pages/TablesPage.tsx`, `web-frontend/src/pages/CheckInPage.tsx`, `backend/src/routes.ts` |

---

## Issue 7: Resuming Phone-Only Check-In and Reservation Action Availability Isolation

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Isolation of draft phone-only check-ins from newly assigned reservations and restoration of reservation action availability on the Reservations page. |
| **Problems Identified** | When a receptionist entered only a phone number in Check-In (Process A), navigated away, assigned a table with complete customer details (Process B, creating a `PENDING` reservation and locking table to `in_checkin`), and subsequently selected **Resume** for Process A: (1) Process B's reservation on the Reservations page had both **Assign** and **Cancel** buttons disabled because the frontend checked `res.table?.status === 'in_checkin'` as a blocking condition; (2) Backend `POST /reservations/:id/cancel` rejected cancellations when the table was `in_checkin` even if owned by the user; (3) Backend `POST /tables/:id/lock` rejected lock re-acquisition with 409 Conflict when continuing check-in for an already locked table belonging to the user's reservation. |
| **Resolution** | (1) Updated `TablesPage.tsx` reservation card actions to derive enablement from ownership (`isOwner`) and table occupancy (`status !== 'occupied'`) rather than `in_checkin` status; (2) Updated backend `POST /reservations/:id/cancel` in `backend/src/routes.ts` and `src/routes.ts` to allow the owner/admin to cancel reservations on `in_checkin` tables, reset the table status to `available`, remove the Redis lock, and broadcast real-time WebSocket updates; (3) Updated `POST /tables/:id/lock` to permit the reservation owner/admin to re-acquire/extend locks on `in_checkin` tables; (4) Updated `TABLE_RESERVATION_ASSIGNMENT_WORKFLOW.md` in Section 14 and Section 18 (Scenario D) documenting process isolation and state preservation. |
| **Activities Completed** | Verified static code path isolation between Process A (draft) and Process B (reservation). Verified TypeScript compilation checks (`npx tsc --noEmit`) across backend and frontend with 0 errors. Verified running dev servers without interruption. |
| **Files / Modules Updated** | `web-frontend/src/pages/TablesPage.tsx`, `backend/src/routes.ts`, `src/routes.ts`, `TABLE_RESERVATION_ASSIGNMENT_WORKFLOW.md` |

---

## Issue 8: Table Assign Navigation to Check-In Customer Details Stage 1 & Field Editability

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Correction of the Table Assign confirmation navigation to open Check-In Customer Details / Stage 1 with fully editable fields. |
| **Problems Identified** | Confirming an Assign action on the Tables page previously jumped directly to Stage 2 (Table Seating) if customer details were complete, bypassing Stage 1 (Customer Details) and preventing immediate editing of customer name, phone number, email, or guest headcount before proceeding. |
| **Resolution** | (1) Updated `CheckInPage.tsx` mount logic to always route confirmed Assign actions to `setStage(1)` (Customer Details / Stage 1); (2) Ensured all fields (customer name, phone, email, persons count) remain completely editable in Stage 1 and seamlessly synchronize modifications to the authoritative `Reservation` in PostgreSQL via `api.updateReservation(reservationId, ...)` upon clicking Next; (3) Maintained complete state and process isolation between previous draft check-ins and newly assigned reservations; (4) Updated `TABLE_RESERVATION_ASSIGNMENT_WORKFLOW.md` (Section 2, Section 14, and Section 18) to document the explicit Stage 1 transition and editability rules. |
| **Activities Completed** | Verified static code path transitions from `TablesPage` Assign modal to `CheckInPage` Stage 1. Executed TypeScript compilation checks across `backend` and `web-frontend` (`npx tsc --noEmit`) with 0 errors. Verified running dev servers. |
| **Files / Modules Updated** | `web-frontend/src/pages/CheckInPage.tsx`, `TABLE_RESERVATION_ASSIGNMENT_WORKFLOW.md` |

---

## Issue 9: Strict Table Concurrency, First-Claim Atomic Priority & Four-Way Cross-Validation Resolution

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Strict table concurrency enforcement, first-claim atomic locking, bidirectional Check-In ↔ Reservation cross-validation, and independent reservation lifecycle management. |
| **Problems Identified** | (1) Concurrent table `Assign` clicks permitted secondary callers with Admin/Manager roles to override active `in_checkin` locks held by initial claimants; (2) `POST /reservations/:id/assign` lacked reservation ownership authorization, exposing reservation assignment to unauthorized users; (3) `POST /check-in/pre-payment-validate` and `TokenService.ts` (`createToken`) omitted checking reserved table ownership and occupied status, risking cross-user table assignment conflicts; (4) WebSocket table status broadcasts on unlock/stop-checkin omitted `reservedByName` and `reservedByUserId` metadata when reverting to `reserved` status; (5) Table release in `TableService.ts` hardcoded `available` without checking for scheduled pending reservations. |
| **Resolution** | (1) Enforced strict single-user lock re-acquisition in `POST /tables/:id/lock` (`lockedBy === userId || lockedByUserId === userId`), rejecting all other concurrent claims with `409 Conflict (TABLE_STATUS_INVALID)` via PostgreSQL row-level locking (`FOR UPDATE`); (2) Added explicit reservation ownership authorization to `POST /reservations/:id/assign` returning `403 Forbidden` for non-owners; (3) Added reserved table ownership verification and occupied rejection to `POST /check-in/pre-payment-validate` and `TokenService.createToken`, and invalidated Redis table locks upon token creation; (4) Enhanced `broadcastTableUpdated` in unlock and stop-checkin handlers to include active reservation metadata (`reservedBy`, `reservedByName`, `reservedByUserId`); (5) Updated `TableService.ts` `releaseTable` to safely revert tables to `reserved` status if a pending reservation exists. |
| **Activities Completed** | Verified all 4 quadrants of the concurrency matrix (Check-In ↔ Check-In, Check-In ↔ Reservation, Reservation ↔ Check-In, Reservation ↔ Reservation). Verified simultaneous atomic table locking and explicit cancellation via automated test suites. Executed full TypeScript typechecks (`npx tsc --noEmit`) across `backend` and `web-frontend` with 0 errors. Updated specification in `TABLE_RESERVATION_ASSIGNMENT_WORKFLOW.md` (Test Case 15). |
| **Files / Modules Updated** | `backend/src/routes.ts`, `backend/src/services/TokenService.ts`, `backend/src/services/TableService.ts`, `TABLE_RESERVATION_ASSIGNMENT_WORKFLOW.md` |

---

## Issue 10: Global Header & Dialog Refresh Synchronization, Reactive Form Validation & Authoritative Conflict Invalidation

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Global Header and Assign/Reserve dialog refresh synchronization, real-time reactive duplicate conflict invalidation, and zero-reload resource reusability upon reservation cancellation. |
| **Problems Identified** | When a customer reservation was created by a Receptionist and subsequently cancelled/released from the Reservations page: (1) An Admin viewing the Direct Check-In page could continue seeing a stale conflict warning ("This phone number / email is already reserved by Receptionist") with the "Proceed" button disabled because the form's local validation cache (`validatedPhone`, `validatedEmail`) remained held; (2) Clicking the top global Header Refresh button updated `DataContext` collections in the background but did not invalidate form-level validation caches; (3) The Assign & Reserve dialog modal on the Tables page lacked an in-dialog live refresh action to synchronize real-time table status and conflict states on demand; (4) `POST /reservations/:id/cancel` did not defensively purge Redis customer uniqueness keys (`checkin:active:phone:${p}`, `checkin:active:email:${e}`). |
| **Resolution** | (1) Added `refreshTrigger` state and event listeners for the `app:global-refresh` custom event in `CheckInPage.tsx` and `TablesPage.tsx` to automatically invalidate local validation caches (`setValidatedPhone('')`, `setResValidatedPhone('')`) and execute an immediate background duplicate re-validation API check without full-page reloads (`window.location.reload()`); (2) Added a dedicated live `<RefreshCw />` button to the Assign & Reserve modal (`reservingTable`) and Assign Token modal (`assigningTable`) headers in `TablesPage.tsx` with smooth spin animation and on-demand synchronization; (3) Added reactive observers on `[reservations, activeTokens]` to dynamically clear conflict warnings whenever background updates detect that a conflicting reservation has been cancelled or released; (4) Updated `POST /api/reservations/:id/cancel` in `backend/src/routes.ts` to defensively delete active phone and email Redis keys upon reservation cancellation; (5) Updated `TABLE_RESERVATION_ASSIGNMENT_WORKFLOW.md` with Test Case 16 documenting authoritative resource reusability upon reservation cancellation. |
| **Activities Completed** | Verified 6-point Header Refresh verification suite, in-dialog refresh action responsiveness, and 10-point lifecycle audit suite (active conflict detection, cancellation recovery, immediate phone/email reusability, multi-user two-browser synchronization, preserved in-progress form inputs, and zero browser reloads). Executed `npx tsc --noEmit` across `backend` and `web-frontend` with 0 errors. |
| **Files / Modules Updated** | `web-frontend/src/pages/CheckInPage.tsx`, `web-frontend/src/pages/TablesPage.tsx`, `backend/src/routes.ts`, `TABLE_RESERVATION_ASSIGNMENT_WORKFLOW.md` |






