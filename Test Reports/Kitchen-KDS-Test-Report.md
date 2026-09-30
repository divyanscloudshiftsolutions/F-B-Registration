# Kitchen Display System (Kitchen KDS) — Test Report

## 1. Module Overview
The Kitchen KDS module manages back-of-house food preparation workflows, ticket generation for kitchen and dessert stations, item state progression (`PLACED` $\rightarrow$ `ACCEPTED` $\rightarrow$ `PREPARING` $\rightarrow$ `READY` $\rightarrow$ `SERVED`), the 5-second Served Undo window (`servedUndoManager.ts`), and live food stock-out toggling.

## 2. Scope
- Food and Dessert ticket intake (`station: KITCHEN` or `station: DESSERT`).
- Ticket card grouping by `orderNumber`, `tableNumber`, and `placedAt` timestamp.
- Item state progression: `PLACED` $\rightarrow$ `ACCEPTED` $\rightarrow$ `PREPARING` $\rightarrow$ `READY` $\rightarrow$ `SERVED`.
- 5-Second Served Undo Window: Client-side sliding timer allowing chefs to reverse accidental "Mark Served" taps before committing to DB.
- Kitchen Stock-Out / Stock-In toggle tab (`KitchenStockTab.tsx`).
- Real-time order arrivals, item updates, and sound alerts.

## 3. Roles Covered
- **Chef / Kitchen Staff (`chef` / `kitchen`)**: Primary operators managing food preparation screens.
- **Admin (`admin`) / Manager (`manager`)**: Superusers with access to Kitchen KDS.

## 4. Test Environment / Entry Points
- **Web Frontend**: `/kds/kitchen`, `KitchenKDSPage.tsx`, `KitchenStockTab.tsx`, `api.ts`.
- **Backend API**:
  - `GET /api/kds/orders/kitchen` (calls `KdsService.getStationOrders(Station.KITCHEN)`)
  - `PATCH /api/orders/items/:id/status` (updates `OrderItem.status`)
  - `GET /api/kds/ready` (retrieves `READY` items for delivery)
- **Realtime Socket.io Events**: `order.created` (received in `kds:kitchen`), `order.item.updated`, `kds.updated`.

---

## 5. Test Scenarios

| Test ID | Scenario | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| TC-KDS-001 | Food Order Ticket Ingestion | Order placed containing 2 Food items | Order placed by customer/waiter | New ticket appears on `/kds/kitchen` with table number, elapsed timer, and items in `PLACED` status | Code Verified |
| TC-KDS-002 | Progress Item to Preparing | Item is in `PLACED` / `ACCEPTED` status | Chef taps item / "Accept & Prepare" | Item status updates to `PREPARING`; background updates; `order.item.updated` broadcast | Code Verified |
| TC-KDS-003 | Mark Item Ready | Item is `PREPARING` | Chef taps "Mark Ready" | Item status updates to `READY`; item routed to Waiter Ready pickup queue; `staff:ready` notified | Code Verified |
| TC-UNDO-001 | 5-Second Served Undo (Within 5s) | Item marked `SERVED` | Chef taps "Undo" within 5 seconds | `servedUndoManager.cancelUndo()` clears timeout; item preserved in active list without DB commit | Code Verified |
| TC-UNDO-002 | Served Commit on 5-Second Expiry | Item marked `SERVED` | 5 seconds elapse without tapping "Undo" | Timeout fires; `api.updateOrderItemStatus(id, 'SERVED')` called; item permanently marked `SERVED` in DB | Code Verified |
| TC-KDS-004 | Beverage Item Isolation | Order placed containing 1 Burger & 1 Beer | Order submitted | Burger appears on Kitchen KDS; Beer does NOT appear on Kitchen KDS | Code Verified |
| TC-STOCK-001 | Kitchen Stock-Out Toggle | "Paneer Butter Masala" is active | Chef toggles item to Inactive in Kitchen Stock Tab | Item availability disabled across digital menu; `menu.updated` broadcast | Code Verified |

---

## 6. Positive Test Cases
- High-visibility ticket cards designed for commercial kitchen touchscreen monitors.
- Real-time ticket appearance without manual browser refresh.
- Accurate line-item special cooking instructions and modifier details displayed directly beneath item names.

## 7. Negative / Validation Test Cases
- Bar/Beverage items filtered out of Kitchen KDS queries at the database level (`stationFilter = { in: [Station.KITCHEN, Station.DESSERT] }`).
- Invalid status string rejected with 400 Bad Request.

## 8. Authorization / Permission Test Cases
- Socket room `kds:kitchen` join authorization restricted strictly to `admin`, `manager`, and `chef` roles.
- Unauthorized users attempting to join `kds:kitchen` receive socket error message.

## 9. Concurrency / State Tests
- Two kitchen stations operating simultaneously: Item state changes update both screens synchronously via `order.item.updated`.

## 10. Realtime / Socket Tests
- Placing a food order emits `order.created` to `kds:kitchen` room within $< 100\text{ms}$.
- Updating an item status emits `order.item.updated` to `customer:token:${tokenNumber}`, `table:${tableId}`, `staff:ready`, `staff:orders`, and `staff:all`.

## 11. Edge Cases
- Order placed on closed or settled session: KDS ticket marks `isSessionClosed: true` with visual warning badge.

## 12. Regression Scenarios
- Verify that filtering by Course (All, Starters, Mains, Desserts) does not drop pending orders from the view.

## 13. Existing Historical Test Coverage
- Historical food order ticket rendering, order sequencing, and kitchen chime notifications verified during back-of-house integration testing.

## 14. Current Codebase Differences / Outdated Cases
- **5-Second Sliding Undo Architecture**: Implemented via client-side `servedUndoManager.ts` that delays the API commit of `SERVED` status by 5000ms with a 200ms background ticker.
- **Station-Level Filtering**: Station filtering is performed strictly on `Station.KITCHEN` and `Station.DESSERT` in `KdsService.ts`.

## 15. Coverage Gaps
- Automated ESC/POS physical thermal KOT printer offline/retry simulation suite.

## 16. Final Module Test Summary
The Kitchen KDS module ensures real-time food order intake, accurate preparation tracking, station isolation, fail-safe 5-second served undo mechanics, and rapid stock toggling.
