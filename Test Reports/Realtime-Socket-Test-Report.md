# Realtime Socket.io & Event Bus — Test Report

## 1. Module Overview
The Realtime Socket.io module provides bidirectional, low-latency communication across the distributed system. It orchestrates state synchronization, table lock broadcasts, targeted station ticket dispatching, ready pickup notifications, customer service alerts, and room-level RBAC authorization.

## 2. Scope
- WebSocket connection lifecycle (Handshake, JWT/Session token auth, Heartbeats, Ping/Pong 25s/30s in `socket.ts`).
- Targeted Room Architecture (`kds:kitchen`, `kds:bar`, `staff:ready`, `staff:requests`, `tables:all`, `staff:orders`, `billing:all`, `role:${role}`, `staff:all`, `customer:token:${tokenNumber}`, `table:${tableId}`).
- Centralized Socket.io Event Dictionary (`SOCKET_EVENTS` in `backend/src/realtime/events.ts`):
  - Orders: `order.created`, `order.updated`, `order.item.updated`, `kds.updated`.
  - Service Requests: `service_request.created`, `service_request.updated`.
  - Floor & Tables: `table.updated`, `table.session.activated`, `table.session.closed`.
  - Billing & Sessions: `bill.updated`, `session.updated`.
  - Reservations: `reservation.created`, `reservation.updated`, `reservation.cancelled`.
  - Menu & Inventory: `menu.updated`.
  - Room Management: `room:join`, `room:leave`.
- Strict Room RBAC Enforcement in `socket.ts`.

## 3. Roles Covered
- **All Connected Clients**: Admin, Receptionist, Waiter, Kitchen Chef, Bartender, Manager, and Customer Mobile Browsers.

## 4. Test Environment / Entry Points
- **Client**: `socket.io-client` in `web-frontend/src/services/socket.ts` and `DataContext.tsx`.
- **Server**: `backend/src/realtime/socket.ts`, `backend/src/realtime/events.ts`, `backend/src/realtime/types.ts`.
- **Transports**: `['websocket', 'polling']`.

---

## 5. Test Scenarios

| Test ID | Scenario | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| TC-SCK-001 | Authenticated Handshake (Staff) | Valid `StaffSession` or JWT | Connect with `auth: { token: '<token>' }` | Connection established; user classified as `STAFF`; auto-joined to `staff:all`, `role:${role}`, `tables:all`, etc. | Code Verified |
| TC-SCK-002 | Authenticated Handshake (Customer) | Valid `tokenNumber` | Connect with `auth: { tokenNumber: '<tokenNumber>' }` | Classified as `CUSTOMER`; auto-joined to `customer:token:${tokenNumber}` and `table:${tableId}` | Code Verified |
| TC-SCK-003 | Room Access RBAC Enforcement | Non-chef staff member (e.g. Receptionist) | Emit `room:join` with `'kds:kitchen'` | Server checks role; rejects join; emits `error: "You don't have access to this screen."` | Code Verified |
| TC-SCK-004 | Multi-Station Order Splitting | Customer places order with Food & Drinks | Server calls `broadcastOrderCreated` | Food items trigger emission to `kds:kitchen`; Drink items trigger emission to `kds:bar`; general order emitted to `staff:orders` | Code Verified |
| TC-SCK-005 | Table State Broadcast | Staff locks/unlocks Table T-01 | Server calls `broadcastTableUpdated` | Event `table.updated` emitted to `tables:all`, `staff:all`, and `table:${tableId}` with lock owner details | Code Verified |
| TC-SCK-006 | Ready Queue Notification | Chef marks dish `READY` | Server calls `broadcastOrderItemUpdated` | Event `order.item.updated` emitted to `staff:ready`, notifying floor waiters instantly | Code Verified |
| TC-SCK-007 | Service Request Broadcast | Customer requests "Water" | Server calls `broadcastServiceRequestCreated` | Event `service_request.created` emitted to `staff:requests` and customer session room | Code Verified |

---

## 6. Positive Test Cases
- Clean separation of concerns through isolated room scoping.
- Resilient fallback from `websocket` to HTTP `polling` when firewalls restrict WebSocket upgrades.

## 7. Negative / Validation Test Cases
- Unauthenticated clients attempting to join staff rooms (`billing:all`, `staff:requests`, `kds:kitchen`) blocked with error emission.
- Tampered JWT payloads rejected during handshake middleware.

## 8. Authorization / Permission Test Cases
- Server-side validation in `socket.on(SOCKET_EVENTS.JOIN_ROOM)` strictly checks `staffUser.role` against room permissions.
- Customer tokens can only join rooms matching their own `tokenNumber` or `tableId`.

## 9. Concurrency / State Tests
- Simultaneous broadcasts during peak shifts delivered in sequence across dedicated room subscriber sets.

## 10. Realtime / Socket Tests
- Ping interval configured at 25,000ms with ping timeout of 30,000ms in `socket.ts`.

## 11. Edge Cases
- Client temporary disconnect and reconnect: Socket re-authenticates and re-joins rooms seamlessly.

## 12. Regression Scenarios
- Verify that navigating between frontend routes cleans up stale socket listeners to prevent memory leaks.

## 13. Existing Historical Test Coverage
- Verified in historical reports: `2026-08-18-Table-Concurrency-Keyboard-Glow-Verification.md` and `2026-08-24-Dashboard-UIUX-Responsive-Refinement-Verification.md`.

## 14. Current Codebase Differences / Outdated Cases
- **Centralized Event Dictionary**: All socket event names are strictly defined in `SOCKET_EVENTS` constant (`events.ts`) and use dot notation (`order.created`, `table.updated`, `bill.updated`, `service_request.created`).
- **Granular Room Architecture**: Employs dedicated rooms (`kds:kitchen`, `kds:bar`, `staff:ready`, `staff:requests`, `billing:all`) rather than a single global broadcast channel.

## 15. Coverage Gaps
- Automated Redis socket.io adapter horizontal scaling tests across multiple cluster nodes.

## 16. Final Module Test Summary
The Realtime Socket.io module provides a resilient, secure, role-isolated event bus powering live communication across all staff stations and customer devices.
