# Real-Time Inventory Lifecycle, Cart Stock Reservation, Order State Tracking, and Cancellation Restoration

## Issue 1: Multi-Customer Cart Stock Reservation, Session-Aware Availability Calculation, and Dynamic Item Release

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Overhaul of realtime cart stock reservation and inventory accounting across concurrent dining sessions to allow temporary quantity reservation without falsely locking out other customers or the reserving customer. |
| **Problems Identified** | When Customer A added items to their cart, the system subtracted reservations globally from `availableStock`. When all units were reserved (e.g., 10 of 10), Customer A's own UI and customizers treated the item as "Out of Stock" and blocked them from modifying or ordering their held items. Furthermore, deleting or decrementing an item in the cart failed to release the reserved units until the entire cart was emptied or the session timed out. |
| **Resolution** | 1. Refactored `InventoryService.getAvailableStock` and `reserveCartStock` to separate `availableStock` (global sellable to other customers) from `availableForToken` (sellable to requesting customer token).<br>2. Implemented `releaseCartStock` and individual item reservation release tracking in `CustomerContext.tsx` via `reservedItemsRef`. When an item is reduced or deleted, the difference is immediately released to other customers via WebSocket.<br>3. Updated `MenuItemCard.tsx` and `ProductCustomizer.tsx` to compute `effectivePurchasableForCustomer = Math.min(physicalStock, availableStock + customerOwnReserved)` so reserving customers can freely interact with their reserved items while non-reserving customers see real-time "Reserved" badges.<br>4. Added `clearSessionCartReservations` on table session close and bill settlement in `BillingService.ts` and `routes.ts`. |
| **Activities Completed** | - Verified concurrent cart interactions across multiple simulated browser sessions.<br>- Validated instant stock release from 5 to 3 propagating to other customers as 7 available.<br>- Ensured manual 86 / physical 0 stock-outs continue to evict from cart while temporary reservations do not trigger false evictions. |
| **Files / Modules Updated** | - `backend/src/services/InventoryService.ts`<br>- `backend/src/services/BillingService.ts`<br>- `backend/src/routes.ts`<br>- `web-frontend/src/context/CustomerContext.tsx`<br>- `web-frontend/src/components/customer/MenuItemCard.tsx`<br>- `web-frontend/src/components/customer/ProductCustomizer.tsx`<br>- `web-frontend/src/pages/CustomerApp.tsx` |

---

## Issue 2: Full-Stock Order Placement Validation, Multi-Line Stock Aggregation, and Atomic Reservation Transfer

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Order submission transaction hardening to permit ordering full reserved inventory without false out-of-stock rejections and handle multi-line variant stock consolidation. |
| **Problems Identified** | When Customer A held all available physical units in cart (e.g., 10 of 10) and attempted to place an order, backend validation checked `currentStock >= totalQuantity` but intermediate checks or unaggregated multi-line cart items caused race errors, redundant database queries, and false "Stock Unavailable" rejections. |
| **Resolution** | 1. Grouped and aggregated order item deductions by `stockItemId` prior to opening Prisma transaction in `OrderService.placeOrder`.<br>2. Enforced atomic decrements (`currentStock: { gte: totalQuantity }`) in database transaction.<br>3. Seamlessly transitioned temporary cart reservations into permanent deducted stock on order commit, followed by atomic cleanup of session cart reservations in `clearSessionCartReservations`.<br>4. Corrected customer checkout and customizer modals to submit orders smoothly without premature stock-out blockers. |
| **Activities Completed** | - Tested 10/10 full stock reservation and order placement without false error responses.<br>- Validated multi-variant cart orders pulling from the same inventory stock item.<br>- Checked parent order subtotal calculation and state machine transitions. |
| **Files / Modules Updated** | - `backend/src/services/OrderService.ts`<br>- `backend/src/services/InventoryService.ts`<br>- `web-frontend/src/context/CustomerContext.tsx`<br>- `web-frontend/src/pages/CustomerApp.tsx` |

---

## Issue 3: Order Item Cancellation Stock Restoration, Atomic State Machine Lock, and Availability Recovery

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Hardening the reversal/cancellation lifecycle of placed orders prior to kitchen/bar preparation to restore physical inventory, recover menu catalog availability, and broadcast real-time stock updates. |
| **Problems Identified** | When an order consumed the remaining physical stock ($10 \to 0$), `menuItem.isAvailable` was set to `false`. When the customer cancelled the `PLACED` order item before KDS acceptance, `StockItem.currentStock` was incremented back to 10 in the database, but `menuItem.isAvailable` remained `false` in PostgreSQL, Redis menu cache was not cleared, and WebSockets broadcasted `isAvailable: false`. Other customers were prevented from viewing or ordering the newly restored items. Furthermore, cancellation lacked inside-transaction atomic test-and-set locks, risking double restoration on rapid clicks or KDS races. |
| **Resolution** | 1. Implemented atomic test-and-set status transition `tx.orderItem.updateMany({ where: { id, status: PLACED }, data: { status: CANCELLED } })` in `OrderService.cancelOrderItemByCustomer` and `cleanupClosedSessionOrderItem` ensuring exactly-once cancellation and eliminating race conditions.<br>2. Added automatic menu availability recovery: when `restoredStock > 0`, `tx.menuItem.update({ data: { isAvailable: true } })` is executed within the same atomic transaction.<br>3. Integrated `menuService.invalidateMenuCache()` on cancellation commit to invalidate stale Redis catalog entries.<br>4. Broadcasted authoritative real-time socket events with `isAvailable: stockInfo.currentStock > 0` and full inventory metrics (`currentStock`, `availableStock`, `reservedStock`), instantly making restored items available across all customer screens without page reload. |
| **Activities Completed** | - Verified cancellation flow from $0 \to 10$ physical stock restoration.<br>- Validated double-cancellation prevention via atomic status update counts.<br>- Verified synchronization between closed session cleanup, staff cancellations, and real-time customer menu availability. |
| **Files / Modules Updated** | - `backend/src/services/OrderService.ts`<br>- `backend/src/services/MenuService.ts`<br>- `backend/src/services/InventoryService.ts`<br>- `web-frontend/src/context/CustomerContext.tsx` |

---

## Issue 4: Customer Portal Product Customizer & Details Popup Real-Time Stock-In Synchronization

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Customer Portal product customization sheet and details modal synchronization overhaul ensuring active popups dynamically reflect real-time Stock-In / replenish updates without page reload or state resets. |
| **Problems Identified** | When an item was replenished / Stock-In from Admin or KDS station screens, customer cards updated, but open Product Customizer sheets and Product Details popups retained static snapshots captured at click time. If a customer had the product modal open when Stock-In occurred, the popup continued displaying "Out of Stock" and disabled quantity controls. Additionally, newly available items that were previously filtered out of initial customer menu payloads were not ingested into menu state without browser refresh, and customizer form re-renders risked resetting active user modifier selections. |
| **Resolution** | 1. Refactored `CustomerApp.tsx` to derive `liveCustomizingItem` and `liveSelectedDetailItem` dynamically from authoritative `allItems` / `menu` state, replacing static snapshot references with reactive bindings.<br>2. Updated `CustomerContext.tsx` `onSocketEvent('menu.updated')` handler: if a newly available item was not present in the current menu state (due to initial query filtering), it automatically triggers `refreshMenu()` to ingest the fresh catalog.<br>3. Enhanced `ProductCustomizer.tsx` with `initializedKeyRef` to isolate form field initialization strictly to item switches, preventing real-time inventory updates from wiping active customizations, instructions, or quantity.<br>4. Updated `MenuService.ts` to include `reservedStock` and `stockQuantity` in operational `item_availability` broadcasts. |
| **Activities Completed** | - Verified real-time Stock-In updates transitioning open Product Customizer sheets from "Out of Stock" to enabled "Add to Cart".<br>- Validated dynamic updates in Product Details modal reflecting live "In Stock" status badges and active add actions without page reload.<br>- Checked preservation of user-typed special instructions and selected modifiers during concurrent stock updates. |
| **Files / Modules Updated** | - `backend/src/services/MenuService.ts`<br>- `web-frontend/src/context/CustomerContext.tsx`<br>- `web-frontend/src/pages/CustomerApp.tsx`<br>- `web-frontend/src/components/customer/ProductCustomizer.tsx` |

---

## Issue 5: Customer Portal My Orders Pending Section Filtering for Cancelled and Stock-Out Items

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Customer Portal Order Tracking refinement to ensure terminal status items (`CANCELLED` and `STOCK_OUT`) and empty parent orders do not appear in the "Pending" orders view. |
| **Problems Identified** | In `CustomerApp.tsx`, the `pendingOrders` list filtered orders only by top-level order status (`o.status !== 'SERVED' && o.status !== 'CANCELLED'`). Consequently, individual order items that were `CANCELLED` (by the customer prior to preparation) or `STOCK_OUT` (marked unavailable / 86'd by the KDS) still appeared inside the Pending order cards with red warning badges. Furthermore, if all items in an order were cancelled or marked stock-out, the empty order container continued to linger in the Pending orders tab instead of clearing. |
| **Resolution** | 1. Implemented `isPendingItem` helper to strictly qualify genuinely active order items (`status !== 'CANCELLED' && status !== 'STOCK_OUT' && status !== 'SERVED'`).<br>2. Updated `pendingOrders` using `useMemo` to filter out non-pending items from `order.items` and exclude orders having zero active pending items.<br>3. Updated `completedOrders` using `useMemo` to classify orders whose items have reached terminal states (`SERVED`, `CANCELLED`, `STOCK_OUT`) into the Completed orders tab.<br>4. Preserved item totals, order count badges, and item-level cancellation/stock-out details in the Completed tab and Itemized Table Bill view. |
| **Activities Completed** | - Verified that `CANCELLED` and `STOCK_OUT` items are removed from the Pending orders tab in real-time.<br>- Verified that orders where all items are cancelled or stock-out do not display in the Pending tab.<br>- Verified that Pending item count badges and order totals recalculate accurately based on active items. |
| **Files / Modules Updated** | - `web-frontend/src/pages/CustomerApp.tsx` |
