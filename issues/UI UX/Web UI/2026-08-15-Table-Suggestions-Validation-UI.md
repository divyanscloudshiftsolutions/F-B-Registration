# Daily Technical & Architectural Issues Log — August 15, 2026

---

## Issue 1: Seating Table Management Auto-Numbering and Uniqueness Validation

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Seating Table Management creation UI, zone configurations mapping, and duplicate name constraints |
| **Problems Identified** | Previously, creating a table required the user to guess the next number (leading to manual errors or duplicate table conflicts), lacked real-time feedback on input duplication (allowing accidental submittal of duplicate values that would crash database constraints), and rejected standard/premium placeholders due to UUID format restrictions in the API validation layer. High digit table numbers were also blocked by regex constraints. |
| **Resolution** | Relaxed regex checks in standard check-in routes (`routes.ts`) and manual activation service (`TokenService.ts`) to support table numbers ranging from 2 to 4 digits. Added case-insensitive name checks on backend `POST /tables` and `PUT /tables/:id` routes, excluding the table's own ID on edits. Built a client-side real-time uniqueness checker in `TableManagement.tsx` with error alert messages and disabled form submission buttons. Integrated a suggestion engine that calculates maximum suffix values for standard and premium zones and displays 4 logical suggestion pills. |
| **Activities Completed** | Modified forms, added dynamic defaults on category toggle, resolved place types by name constants, typechecked backend, built frontend client successfully, and verified dynamic seating diagram scalability. |
| **Files / Modules Updated** | `backend/src/routes.ts`, `backend/src/services/TokenService.ts`, `web-frontend/src/components/admin/TableManagement.tsx` |

---

## Issue 2: Frontend Layout Compilation Blocker Resolution

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Web Frontend Typecheck and Production Build Compilation |
| **Problems Identified** | The web-frontend build failed due to a JSX tags corruption in `TablesPage.tsx` where an inspect `<button>` element was incorrectly nested inside the `<option>` tag mapping, leaving tags unclosed and causing cascade parser failures (such as missing `X` icon reference errors in `CheckInPage.tsx`). |
| **Resolution** | Reverted the local corrupted changes on `TablesPage.tsx` to restore clean layout tagging. This eliminated JSX mismatches, resolved the cascade compiler errors, and restored successful Vite production builds. |
| **Activities Completed** | Restored original files, verified build output via `npm run build`, and checked backend type safety using `npx tsc --noEmit`. |
| **Files / Modules Updated** | `web-frontend/src/pages/TablesPage.tsx` |

---

## Issue 3: Table Switch Target Lock Hijacking Protection

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Table switching concurrency security and Redis lock checks during check-in table switches |
| **Problems Identified** | When switching tables during check-in, the backend `PUT /reservations/:id` endpoint verified target table status but failed to check if the target table's active Redis lock belonged to the requesting user. This created a security vulnerability allowing lock hijacking where one user could switch their reservation to a table locked by another receptionist. |
| **Resolution** | Updated the `PUT /reservations/:id` endpoint in `backend/src/routes.ts` to inspect target table lock metadata (`table:lock:${targetTableId}`). If the lock exists, the backend verifies `lockData.lockedBy` matches `req.user.id` (with bypass roles for admin/manager). Rejects unauthorized attempts with `403 Forbidden` and error code `TABLE_LOCK_NOT_OWNED`. |
| **Activities Completed** | Modified backend routes, validated atomic lock checks, typechecked backend, and ran reservation integration test suite successfully. |
| **Files / Modules Updated** | `backend/src/routes.ts` |

---

## Issue 4: Assign Button Reservation-First Lifecycle Integration

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Floor layout table check-in assigning flows and PostgreSQL reservation syncing |
| **Problems Identified** | The "Assign" button on available tables directly locked the table to `'in_checkin'` status and opened the Check-In page without creating a reservation in PostgreSQL, bypassing the required reservation-first lifecycle and leaving the Check-In wizard inputs empty. |
| **Resolution** | Integrated the Assign action with the reservation form. Clicking Assign on an available table now opens the reservation modal dialog, creates a `PENDING` reservation in PostgreSQL (owner set to current receptionist, table set to `'reserved'`), and redirects to Check-In prefilled with the reservation details. |
| **Activities Completed** | Modified Available table action button bindings, integrated `isAssignFlow` layout states, passed reservation details to Check-In, and verified pre-fill behavior. |
| **Files / Modules Updated** | `web-frontend/src/pages/TablesPage.tsx` |

---

## Issue 5: Frontend Reservation Actions Ownership Control UX

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Receptionist reservation ownership UX mapping and UI button disables |
| **Problems Identified** | Receptionists could see Cancel and Assign buttons as clickable active actions on reservations owned by other receptionists. Clicking them returned a backend `403 Forbidden` error toast, which is secure but poor UX. |
| **Resolution** | Destructured `user` context from `useAuth()` in `TablesPage.tsx` and compared `res.userId === user.id` (allowing overrides for admin/manager roles). Enabled visual disables on Cancel/Assign buttons in the Reservations tab list and Floor Plan view for reserved tables, including tooltip explanations. |
| **Activities Completed** | Modified button components, added `user` context bindings, tested UX disabled states, and validated production builds. |
| **Files / Modules Updated** | `web-frontend/src/pages/TablesPage.tsx` |

---

## Issue 6: Preselected Table Check-In Token Bypassing

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Preselected check-in token generation and QR dispatch |
| **Problems Identified** | When checking in from a reservation or floor plan layout, the table is pre-filled (`preselectedTable === true`). The check-in wizard skipped Stage 2 (Table Selection) and routed straight to Stage 3 (QR Verification), but bypassed the pending check-in token creation and QR email dispatch entirely, leading to "Token not found" (404) errors. |
| **Resolution** | Modified `handleStage1Next` in `CheckInPage.tsx` to call `api.createPendingCheckIn(...)` to persist the pending token and send the QR email before advancing the stage to Stage 3 (QR Verification) when a table is preselected. |
| **Activities Completed** | Updated wizard stage transition logic, handled API pending check-in call on preselected state, and verified email dispatch and token persistence. |
| **Files / Modules Updated** | `web-frontend/src/pages/CheckInPage.tsx` |

---

## Issue 7: Incomplete Check-In Abandonment Database Session Leak

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Check-in draft reset and pending token cleanup validation |
| **Problems Identified** | If the receptionist reset the wizard or selected "Close & Start New", the client-side state cleared local variables but did not cancel the active pending session on the backend. This left the token record in `PENDING_PAYMENT` state, permanently locking the customer's phone/email address from any future check-ins due to active session conflict rules. |
| **Resolution** | Updated `handleAbandonCheckIn` and `handleResetWizard` in `CheckInPage.tsx` to invoke `api.cancelSession(tokenNumber, 'USER_CANCELLED')` when an active pending token exists in local storage/state. This transitions the token to `CANCELLED` status and releases database resources immediately. |
| **Activities Completed** | Bound cancellation handlers on wizard reset/abandon actions, and verified immediate availability of customer email/phone for subsequent check-in sessions. |
| **Files / Modules Updated** | `web-frontend/src/pages/CheckInPage.tsx` |

---

## Issue 8: Clock / Timezone Offset Mismatch in Pending Session Auto-Expiration

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Reconciler state chronological pending auto-expiration |
| **Problems Identified** | The default PostgreSQL value `@default(now())` for `issuedAt` inserted timestamps in local server timezone (IST, which is 5.5 hours ahead of UTC). However, the background reconciler query translated the expiration threshold into UTC and ran `issuedAt <= threshold` database date math, leading to newly created tokens instantly expiring and showing `Token has status 'EXPIRED'`. |
| **Resolution** | Modified `createPendingToken` and `createToken` in `TokenService.ts` to explicitly write `issuedAt: start` (the JS creation Date). Replaced the database-level date math comparison in `reconcileSystemState` with a Javascript-level epoch check (`now.getTime() > token.issuedAt.getTime() + 20 minutes`) which is completely timezone-independent. |
| **Activities Completed** | Persisted Node.js clock Date into database, updated reconciler filter query, ran duplicate check-in integration tests, and validated timezone-independence. |
| **Files / Modules Updated** | `backend/src/services/TokenService.ts` |

---

## Issue 9: Check-In Resumption Table Availability Lockout

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Table check-in session state resumption validation |
| **Problems Identified** | If a receptionist navigated back from the payment confirmation stage and attempted to verify the same QR token again, the backend `POST /check-in/pending` update check failed with a `Table is not available` error. This was because the table status had already been updated to `'in_checkin'` (locked for check-in) for the current flow, and the backend only permitted `'available'` status. |
| **Resolution** | Updated the `POST /check-in/pending` validation in `backend/src/routes.ts` to explicitly allow `'in_checkin'` table status when updating or resuming an existing pending token, matching the validation logic used in session activation. |
| **Activities Completed** | Relaxed table status constraint checks in routes, verified multi-scan check-in resumption, and validated compile output. |
| **Files / Modules Updated** | `backend/src/routes.ts` |

---

## Issue 10: Occupied Table Drawer Lifecycle Actions and Session Audit History UI

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Seating management occupied table actions drawer (Close Session, Transfer, Extend) and Admin Customer Session Audit History details. |
| **Problems Identified** | Previously, the occupied table drawer lacked complete operations for table releasing, transferring, and extending. Releasing a table did not enforce checkout reason categories or explanation logs. Table transferring lacked concurrency protection (allowing simultaneous assignments to the same table), did not regenerate table-specific token/QR credentials (leaving old QR codes active for session authorization), and failed to free the source table. Extending sessions lacked cash/UPI payment simulators or complimentary modes. Finally, there was no administrative interface to inspect historical transfers, extensions, or detailed manual checkout reasons. |
| **Resolution** | **1. Close Session**: Renamed "Release Table" to "Close Session", requiring predefined categories ("Customer Vacated Early", "Session Opened by Mistake", "Other / Administrative Closure") and descriptions. Saved this directly in the database `Token` columns and enqueued close logs.<br>**2. Transfer Table**: Imposed Postgres row locks (`SELECT ... FOR UPDATE`) in `TableService.ts` during transfers to prevent double-transfer conflicts. Generates a new `tokenNumber` upon transfer to automatically invalidate the previous QR code while preserving the session UUID `id`. Cleared Redis caches to make tables immediately reusable.<br>**3. Extend Session**: Predefined options (+30 mins, +1 hr, +2 hrs) calculate extension fees backend-side. Visual payment options (Cash, Complimentary, or UPI QR scanner simulator matching the Check-in page layout) are displayed.<br>**4. Admin History**: Merged transfer, extension, and close histories from `SyncLog` audit trails in an optimized single O(N) database pass in `routes.ts`. Added a details popup in `CustomerSessionsManager.tsx` showing complete seating logs, extensions, and manual closures. |
| **Activities Completed** | Refactored backend service transaction blocks, implemented database row-locking, generated and validated token invalidations, typechecked both codebases, built frontend production assets successfully, ran integration test suites, and verified 100% assertions. |
| **Files / Modules Updated** | `backend/src/services/TableService.ts`, `backend/src/routes.ts`, `web-frontend/src/services/api.ts`, `web-frontend/src/context/DataContext.tsx`, `web-frontend/src/components/admin/CustomerSessionsManager.tsx`, `web-frontend/src/pages/TablesPage.tsx` |

---
