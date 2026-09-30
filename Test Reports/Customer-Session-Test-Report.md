# Customer Session & Token Lifecycle — Test Report

## 1. Module Overview
The Customer Session and Token Lifecycle module manages the digital guest session from token issuance during check-in, real-time status transitions, time extensions (`TokenExtension`), 15-minute expiration countdowns, and session closure on bill settlement.

## 2. Scope
- Token creation and lifecycle states (`TokenStatus`: `PENDING_PAYMENT`, `ACTIVE`, `CLOSED`, `CANCELLED`, `EXPIRED`, `EXTENDED`).
- Session duration enforcement based on `PlaceTypeConfig.baseTimeMinutes`.
- Session extension logging (`TokenExtension` with `extraMinutes`, `additionalAmount`, `approvedBy`).
- 15-minute expiration countdown warnings and grace period handling.
- Real-time session broadcasting via `broadcastSessionExtended` and `broadcastTableSessionClosed`.

## 3. Roles Covered
- **Customer**: Browses menu and interacts with the dining session via `tokenNumber`.
- **Waiter (`waiter`) / Receptionist (`receptionist`)**: Extends session duration when requested.
- **Admin (`admin`)**: Manages session policies and reviews session history.

## 4. Test Environment / Entry Points
- **Web Frontend**: `CustomerApp.tsx`, `CustomerSessionsManager.tsx`, `ExtendSessionModal.tsx`, `api.ts`.
- **Backend API**:
  - `GET /api/check-in/verify-qr/:tokenNumber`
  - `POST /api/tokens/:id/extend`
- **Realtime Socket.io Events**: `session.updated` (`SOCKET_EVENTS.SESSION_UPDATED`), `table.session.activated`, `table.session.closed`.

---

## 5. Test Scenarios

| Test ID | Scenario | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| TC-SES-001 | Valid Token Resolution | Active `Token` exists in DB | Query `GET /api/check-in/verify-qr/:tokenNumber` | Returns 200 OK with `tokenNumber`, `tableId`, `status: ACTIVE`, `startTime`, `endTime` | Code Verified |
| TC-SES-002 | Session Time Extension (+15m) | Active session approaching expiry | Staff calls `POST /api/tokens/:id/extend` with `{ extraMinutes: 15 }` | `TokenExtension` created; `endTime` increased by 15 mins; `broadcastSessionExtended` emits `session.updated` | Code Verified |
| TC-SES-003 | Hard Expiration on Inactive Token | Token has `status: EXPIRED` | Customer attempts to place an order | Order rejected: "Cannot place order. This table session is no longer active." | Code Verified |
| TC-SES-004 | Session Closure on Bill Settlement | Bill settled in full | Cashier completes settlement | `Token.status` updated to `CLOSED`, `closedAt` recorded; `table.session.closed` and `session.updated` broadcast | Code Verified |
| TC-SES-005 | Token Reuse Rejection | Session closed previously | Customer scans printed QR code | Client displays session closed screen; ordering and service requests blocked | Code Verified |

---

## 6. Positive Test Cases
- Real-time synchronization of session end time across all customer devices connected to the table.
- Complete audit trail of session extensions stored in `token_extensions` table.
- Automatic table release upon session closure.

## 7. Negative / Validation Test Cases
- Attempting to extend a closed or cancelled token rejected with error.
- Querying an invalid or non-existent token returns 404 Not Found.

## 8. Authorization / Permission Test Cases
- Only authenticated staff members can approve and record session extensions.
- Customer session tokens cannot modify other tables' session durations.

## 9. Concurrency / State Tests
- Two staff members attempting to extend the same session: Atomic transaction appends both extension entries and updates the end time sequentially.

## 10. Realtime / Socket Tests
- Session extension emits `session.updated` to `customer:token:${tokenNumber}`, `table:${tableId}`, `tables:all`, and `staff:all`.

## 11. Edge Cases
- Customer device screen goes to sleep and awakens after session expiration: React app syncs with server state and displays expiration screen.

## 12. Regression Scenarios
- Verify that granting a session extension immediately updates the live timer in the header of the customer's mobile view.

## 13. Existing Historical Test Coverage
- Verified in historical customer session lifecycle testing records.

## 14. Current Codebase Differences / Outdated Cases
- **Strict Prisma Enum**: Token status follows the strict Prisma `TokenStatus` enum (`PENDING_PAYMENT`, `ACTIVE`, `CLOSED`, `CANCELLED`, `EXPIRED`, `EXTENDED`).
- **Normalized Event Name**: Session changes use `SOCKET_EVENTS.SESSION_UPDATED` (`session.updated`).

## 15. Coverage Gaps
- Automated stress testing of the background cron job for auto-closing expired tokens.

## 16. Final Module Test Summary
The Customer Session module guarantees accurate session lifecycle tracking, tamper-resistant token validation, clear guest timer feedback, and seamless time extensions.
