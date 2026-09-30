# Waiter Operations & POS Station — Test Report

## 1. Module Overview
The Waiter Operations module provides a dedicated touch-friendly station for floor servers (`/waiter`), featuring assigned table monitoring, guest session time extension (+15 minutes), ordering unlock via `POST /api/bills/reopen-ordering`, service request fulfillment, ready item pickup alerts (`staff:ready`), and waiter-assisted POS ordering.

## 2. Scope
- Assigned table overview displaying active guests, elapsed session time, and running total.
- Ready-to-serve food & drink queue listening to `staff:ready` events (`GET /api/staff/ready`).
- Customer service request alert queue listening to `staff:requests` events.
- Active customer session extension (`POST /api/tokens/:tokenId/extend`, `broadcastSessionExtended`).
- Reopening ordering for tables locked by customer bill request (`POST /api/bills/reopen-ordering`).
- Assisted order entry for guests placing orders directly with staff (`POST /api/orders`).
- Table release upon checkout (`PUT /api/tables/:tableId/release`).

## 3. Roles Covered
- **Waiter / Server (`waiter` / `server`)**: Primary role managing floor sections and service.
- **Receptionist (`receptionist`) / Admin (`admin`)**: Can view waiter queues and assign tables.

## 4. Test Environment / Entry Points
- **Web Frontend**: `/waiter`, `WaiterStationPage.tsx`, `ExtendSessionModal.tsx`, `api.ts`.
- **Backend API**:
  - `GET /api/staff/ready` (retrieves ready items for pickup)
  - `POST /api/tokens/:tokenId/extend`
  - `POST /api/bills/reopen-ordering`
  - `POST /api/orders` (waiter-assisted ordering)
  - `PUT /api/tables/:tableId/release`
- **Realtime Socket.io Events**: `order.item.updated` (in `staff:ready`), `service_request.created` (in `staff:requests`), `session.updated`, `table.updated`.

---

## 5. Test Scenarios

| Test ID | Scenario | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| TC-WTR-001 | View Waiter Station & Tables | Waiter logged in | Navigate to `/waiter` | View renders active tables, ready items pickup board, and pending service requests | Code Verified |
| TC-EXT-001 | Active Session Time Extension (+15m) | Table session active | Submit `extraMinutes: 15` to `POST /api/tokens/:tokenId/extend` | `TokenExtension` created; `broadcastSessionExtended` emits `session.updated` with new `endTime` | Code Verified |
| TC-LOCK-003 | Reopen Ordering for Table | Table status is `BILL_REQUESTED` | Call `POST /api/bills/reopen-ordering` with `tableId` | Table status resets to `occupied`; customer can place additional orders; `table.updated` broadcast | Code Verified |
| TC-WTR-002 | Ready Item Pickup Alert | KDS marks item `READY` | Kitchen/Bar marks item ready | `order.item.updated` arrives in `staff:ready`; item appears on pickup board with audio chime | Code Verified |
| TC-WTR-003 | Mark Ready Item Delivered / Served | Item is in ready queue | Waiter delivers item, taps "Served" | `servedUndoManager.startUndo()` initiates 5s window; item status commits to `SERVED` upon expiry | Code Verified |
| TC-WTR-004 | Assisted Order Placement | Waiter takes order at table | Select table, add items, call `POST /api/orders` | Order created with waiter handler ID; items dispatched to Kitchen/Bar KDS | Code Verified |

---

## 6. Positive Test Cases
- High-contrast responsive design optimized for handheld mobile devices and floor tablets.
- Instant synchronization of table bill totals as KDS progresses items.
- Smooth execution of session time extension without interrupting active customer browsing.

## 7. Negative / Validation Test Cases
- Attempting to extend a closed or settled table session rejected with 400 Bad Request.
- Calling reopen ordering on an available table rejected.

## 8. Authorization / Permission Test Cases
- Waiter role permitted to view ready queue, extend active sessions, and reopen table ordering.
- Waiter role blocked from editing rate cards, deleting tables, or modifying system tax parameters.

## 9. Concurrency / State Tests
- Two waiters viewing the ready queue: When one waiter delivers an item, both screens update synchronously via `order.item.updated`.

## 10. Realtime / Socket Tests
- Socket joins `staff:ready`, `staff:requests`, and `tables:all` on connection.
- `order.item.updated` events update the ready queue in real time.

## 11. Edge Cases
- Session extended multiple times: Cumulative `TokenExtension` entries recorded in DB; session end time calculated accurately.

## 12. Regression Scenarios
- Verify responsive layout transitions smoothly between single-column phone view and 3-column tablet view.

## 13. Existing Historical Test Coverage
- Waiter station table assignments, floor view responsiveness, and staff notification alerts verified during waiter operations testing.

## 14. Current Codebase Differences / Outdated Cases
- **Unified Reopen Ordering Flow**: Waiter Station provides direct access to reopen customer ordering via `POST /api/bills/reopen-ordering`.
- **Ready Queue Socket Integration**: The ready queue listens specifically to `staff:ready` room events rather than continuous REST polling.

## 15. Coverage Gaps
- Automated push notification delivery testing for staff wearable companion devices.

## 16. Final Module Test Summary
The Waiter Operations module delivers real-time floor oversight, instant ready item pickup coordination, session time extension grants, and flexible ordering unlock tools.
