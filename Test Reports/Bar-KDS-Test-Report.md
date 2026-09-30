# Bar Display System (Bar KDS) — Test Report

## 1. Module Overview
The Bar KDS module manages front-of-house dispense bar workflows, beverage order queues (`station: BAR`), drink state progression (`PLACED` $\rightarrow$ `ACCEPTED` $\rightarrow$ `PREPARING` $\rightarrow$ `READY` $\rightarrow$ `SERVED`), the 5-second Served Undo window (`servedUndoManager.ts`), and live bar stock-out toggles.

## 2. Scope
- Real-time intake of beverage-only line items (`station: BAR`).
- Drink order grouping by order number and table identifier.
- Drink state progression from intake to delivery.
- 5-Second Served Undo window mechanism.
- Bar Stock-Out / Stock-In toggle tab (`BarStockTab.tsx`).
- Real-time pickup notifications dispatched to floor waiters upon drink completion (`READY`).

## 3. Roles Covered
- **Bartender / Bar Back (`bartender`)**: Primary operators managing drink preparation and dispense.
- **Admin (`admin`) / Manager (`manager`)**: Superusers with access to Bar KDS.

## 4. Test Environment / Entry Points
- **Web Frontend**: `/kds/bar`, `/bartender`, `BarKDSPage.tsx`, `BartenderPage.tsx`, `BarStockTab.tsx`, `api.ts`.
- **Backend API**:
  - `GET /api/kds/orders/bar` (calls `KdsService.getStationOrders(Station.BAR)`)
  - `PATCH /api/orders/items/:id/status`
- **Realtime Socket.io Events**: `order.created` (received in `kds:bar`), `order.item.updated`, `kds.updated`.

---

## 5. Test Scenarios

| Test ID | Scenario | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| TC-BAR-001 | Beverage Order Ingestion | Order placed containing 2 Cocktails | Order placed by customer/waiter | Drink ticket appears on `/kds/bar` with Table number, drink recipes, and modifier notes | Code Verified |
| TC-BAR-002 | Progress Drink to Preparing | Drink is in `PLACED` / `ACCEPTED` status | Bartender taps drink name | Status updates to `PREPARING`; `order.item.updated` broadcast | Code Verified |
| TC-BAR-003 | Mark Drink Ready for Pickup | Drink mixing finished | Bartender taps "Mark Ready" | Status updates to `READY`; item routed to Waiter Ready queue (`staff:ready`) | Code Verified |
| TC-BAR-004 | 5-Second Served Undo on Bar KDS | Drink marked `SERVED` | Bartender taps "Undo" within 5s | `servedUndoManager.cancelUndo()` cancels timeout; item stays active without DB commit | Code Verified |
| TC-BAR-005 | Bar Stock-Out Toggle | "Single Malt Whisky" runs out | Bartender toggles Whisky to Inactive in Bar Stock Tab | Item availability disabled on digital menu and POS; `menu.updated` emitted | Code Verified |
| TC-BAR-006 | Food Item Isolation | Order contains Pizza and Beer | Order placed | Beer appears on Bar KDS; Pizza does NOT appear on Bar KDS | Code Verified |

---

## 6. Positive Test Cases
- High-contrast touch-friendly interface tailored for low-light bar environments.
- Instant delivery of drink orders to bar terminal within $< 100\text{ms}$.
- Clear visibility of drink customization notes (e.g., "Less ice", "No sugar").

## 7. Negative / Validation Test Cases
- Kitchen food items strictly excluded from Bar KDS queries at the database query level (`station = 'BAR'`).
- Modifying item status with an unauthenticated session returns 401 Unauthorized.

## 8. Authorization / Permission Test Cases
- Socket room `kds:bar` restricted strictly to `admin`, `manager`, and `bartender` roles.
- Bartenders restricted from accessing billing, rate cards, and user management.

## 9. Concurrency / State Tests
- Multiple bar stations operating in parallel update drink states synchronously without race conditions.

## 10. Realtime / Socket Tests
- Placing a beverage order emits `order.created` to `kds:bar` room.
- Marking drink `READY` emits `order.item.updated` to `staff:ready` and `customer:token:${tokenNumber}`.

## 11. Edge Cases
- Rapid drink dispense during peak rush: Bartender can rapidly tap items into preparation and ready states without UI lockups.

## 12. Regression Scenarios
- Verify that toggling between active orders and stock management preserves live ticket timers.

## 13. Existing Historical Test Coverage
- Historical beverage ticket intake and order status progression verified during KDS dispatch integration testing.

## 14. Current Codebase Differences / Outdated Cases
- **Dedicated Bar Dispatch Room**: Backend `broadcastOrderCreated` checks `payload.items.some(i => i.station === 'BAR')` and emits specifically to `kds:bar`.
- **Sliding 5-Second Undo**: Managed through `servedUndoManager.ts` matching the kitchen implementation.

## 15. Coverage Gaps
- Automated integration testing with electronic liquor pour spouts / draft beer flow meters.

## 16. Final Module Test Summary
The Bar KDS module provides dedicated beverage order routing, recipe visibility, stock-out controls, and reliable state progression with the 5-second undo safeguard.
