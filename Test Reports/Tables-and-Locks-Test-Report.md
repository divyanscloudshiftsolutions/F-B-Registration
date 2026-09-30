# Tables and Locks — Test Report

## 1. Module Overview
The Tables and Locks module governs the physical seating state machine, Redis-backed distributed table locking (`table:lock:${id}`), optimistic database row locking (`SELECT ... FOR UPDATE`), lock ownership enforcement, and real-time floor synchronization.

## 2. Scope
- Table Statuses: `available`, `occupied`, `reserved`, `in_checkin`, `billing`, `cleaning`, and `maintenance`.
- Table Locking: Redis key `table:lock:${id}` with 3600-second TTL storing `{ lockedBy, lockedByUserId, lockedByName, lockedByRole, originalStatus, lockedAt }`.
- Lock Ownership Authorization: Non-owners blocked from unlocking tables (`403 FORBIDDEN_NOT_OWNER`), with Admin / Manager override bypass.
- Row-Level Concurrency: `SELECT ... FOR UPDATE` transactions preventing concurrent lock acquisition and table assignment.
- Real-time Floor Sync: Broadcasting `table.updated` (`SOCKET_EVENTS.TABLE_UPDATED`) to `tables:all`, `staff:all`, and table rooms.

## 3. Roles Covered
- **Admin (`admin`) / Manager (`manager`)**: Full table administration, override unlock privileges on any locked table, table status updates, and maintenance toggles.
- **Receptionist (`receptionist`)**: Primary role for acquiring table locks, initiating check-ins, releasing locks, and assigning tables.
- **Waiter (`waiter` / `server`)**: Monitors table occupancy, receives real-time status updates, and views assigned sections.

## 4. Test Environment / Entry Points
- **Web Frontend**: `/tables`, `/dashboard`, `TablesPage.tsx`, `TableDiagram.tsx`, `TableDrawer.tsx`, `api.ts`.
- **Backend API**:
  - `GET /api/tables`
  - `POST /api/tables/:id/lock`
  - `POST /api/tables/:id/unlock`
  - `POST /api/tables/assign`
  - `PUT /api/tables/:tableId/release`
  - `PATCH /api/tables/:id/status`
- **Realtime Socket.io Events**: `table.updated` (`SOCKET_EVENTS.TABLE_UPDATED`).

---

## 5. Test Scenarios

| Test ID | Scenario | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| TC-TBL-001 | Acquire Table Lock for Check-In | Table status is `available` or `reserved` | Call `POST /api/tables/:id/lock` as Receptionist | Table status updates to `in_checkin` in DB; Redis key `table:lock:${id}` set with 3600s TTL; `table.updated` broadcast | Code Verified |
| TC-TBL-002 | Reacquire Lock by Existing Owner | Table is `in_checkin` and locked by User A | User A calls `POST /api/tables/:id/lock` | Lock re-acquired successfully (200 OK); Redis lock metadata refreshed | Code Verified |
| TC-TBL-003 | Lock Acquisition Conflict | Table is `in_checkin` and locked by User A | User B (different user) calls `POST /api/tables/:id/lock` | Throws 409 Conflict (`TABLE_STATUS_INVALID`: "This table is selected by another user.") | Code Verified |
| TC-TBL-004 | Unlock Table by Lock Owner | Table is `in_checkin` and locked by User A | User A calls `POST /api/tables/:id/unlock` | Table status reverts to `available` (or original status); Redis key `table:lock:${id}` deleted; `table.updated` broadcast | Code Verified |
| TC-TBL-005 | Non-Owner Unlock Rejection | Table is locked by User A | User B (Receptionist) calls `POST /api/tables/:id/unlock` | Returns 403 Forbidden (`FORBIDDEN_NOT_OWNER`: "You cannot release this table because it is locked by another staff member.") | Code Verified |
| TC-TBL-006 | Admin / Manager Unlock Override | Table is locked by User A (Receptionist) | User C (Admin or Manager) calls `POST /api/tables/:id/unlock` | Unlock succeeds (200 OK); Redis lock removed; table released to available | Code Verified |
| TC-TBL-007 | Reserved Table Ownership Check | Table has PENDING reservation owned by User A | User B (Receptionist) calls `POST /api/tables/:id/lock` | Returns 403 Forbidden (`RESERVATION_NOT_OWNED`: "You cannot check in this table. It was reserved by {resOwner}.") | Code Verified |
| TC-TBL-008 | Table Assignment & Occupancy | Table is `available` or `in_checkin` | Call `POST /api/tables/assign` with `tableId`, `tokenId`, `userId` | Table status updates to `occupied`; `currentTokenId` linked; `TableOccupancyLog` created; Redis cache invalidated | Code Verified |
| TC-TBL-009 | Table Release on Checkout | Table is `occupied` with matching `currentTokenId` | Call `PUT /api/tables/:tableId/release` with `tokenId` | Table status reverts to `available` (or `reserved` if pending reservation exists); `TableOccupancyLog.vacatedAt` recorded | Code Verified |
| TC-TBL-010 | Admin Status Patch (Maintenance) | Table exists in DB | Call `PATCH /api/tables/:id/status` with `{ status: 'maintenance' }` as Admin | Table status updated to `maintenance`; `table.updated` broadcast | Code Verified |

---

## 6. Positive Test Cases
- Lock metadata in Redis accurately records `lockedByName`, `lockedByRole`, and `lockedByUserId` for table card UI badge rendering.
- `SELECT ... FOR UPDATE` database transactions eliminate race conditions during concurrent table locking.
- Releasing an occupied table with an existing pending reservation automatically transitions the table to `reserved`.

## 7. Negative / Validation Test Cases
- Invalid UUID in `:id` parameter returns 400 Bad Request (`VAL_UUID`).
- Attempting to unlock a table whose status is not `in_checkin` returns 400 Bad Request.
- Non-admin/non-manager attempting to unlock another staff member's table returns 403 `FORBIDDEN_NOT_OWNER`.

## 8. Authorization / Permission Test Cases
- Table locking, unlocking, and assigning are restricted to `receptionist`, `admin`, and `manager` via `authorize(['receptionist', 'admin', 'manager'])`.
- Table deletion and direct status patch are restricted to `admin` and `manager`.

## 9. Concurrency / State Tests
- Two staff members attempting to lock the same table simultaneously: Atomic `FOR UPDATE` query ensures one succeeds while the other receives 409 `TABLE_STATUS_INVALID`.

## 10. Realtime / Socket Tests
- Lock and unlock operations broadcast `table.updated` with `{ tableId, tableNumber, status, lockedByName, lockedByRole, lockedByUserId }` to `tables:all` and `staff:all`.

## 11. Edge Cases
- Table locked in Redis but user disconnects: Redis key TTL (3600s) ensures eventual lock expiry.
- Table release validates `currentTokenId` against the provided token ID, preventing invalid session releases.

## 12. Regression Scenarios
- Verify table card selection and keyboard roving selection on `/tables` page.

## 13. Existing Historical Test Coverage
- Verified in historical report: `2026-08-18-Table-Concurrency-Keyboard-Glow-Verification.md` (Table concurrency locking and keyboard mechanics).

## 14. Current Codebase Differences / Outdated Cases
- **Attributed Lock Payload**: The Redis lock key stores an explicit JSON object with `lockedByName` and `lockedByRole` rather than an anonymous boolean.
- **Reservation Ownership Validation**: Locking a reserved table verifies matching `userId` or administrative role before permitting lock acquisition.

## 15. Coverage Gaps
- Automated Redis cluster failover recovery testing under multi-master Redis architectures.

## 16. Final Module Test Summary
The Tables and Locks module enforces strict distributed Redis locking, row-level database concurrency guarantees, owner-only release authorization, and live real-time floor updates.
