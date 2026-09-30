# Inventory & Stock Management — Test Report

## 1. Module Overview
The Inventory and Stock Management module manages menu item stock availability, in-memory cart reservation tracking (`activeReservationsMap`), stock-out toggles, low-stock threshold monitoring, and real-time inventory synchronization across customer and staff interfaces.

## 2. Scope
- Model management via `StockItem` (`currentStock`, `lowStockThreshold`, `isActive`, `menuItemId`).
- Automated startup stock initialization (`ensureAllItemsHaveStock` with default stock 50, low stock threshold 5).
- In-memory cart reservation tracking (`activeReservationsMap`) preventing overselling during checkout.
- Multi-station stock availability synchronization (Kitchen Stock Tab, Bar Stock Tab, Menu Catalog).
- Real-time stock change broadcasting via `menu.updated` with `action: 'item_availability'`.

## 3. Roles Covered
- **Admin (`admin`)**: Full stock management, manual replenishment, and threshold configuration.
- **Chef (`chef`) / Bartender (`bartender`)**: Rapid availability toggling from respective KDS stock tabs.
- **Waiter (`waiter`)**: Read-only visibility of item availability.

## 4. Test Environment / Entry Points
- **Web Frontend**: `KitchenStockTab.tsx`, `BarStockTab.tsx`, `MenuCatalogManager.tsx`, `api.ts`.
- **Backend API**:
  - `POST /api/menu/items/:itemId/availability`
  - `POST /api/customer/cart/reserve`
  - `POST /api/customer/cart/release`
  - `POST /api/customer/cart/clear`
- **Realtime Socket.io Events**: `menu.updated` (`SOCKET_EVENTS.MENU_UPDATED`).

---

## 5. Test Scenarios

| Test ID | Scenario | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| TC-INV-001 | Automatic Stock Record Initialization | Menu item created without explicit `StockItem` | `InventoryService.ensureAllItemsHaveStock()` executes | `StockItem` created with `currentStock: 50`, `lowStockThreshold: 5`, `isActive: true` | Code Verified |
| TC-INV-002 | Realtime Stock-Out Broadcasting | Chef/Bartender toggles item inactive | Trigger `InventoryService.notifyStockUpdated()` | Socket emits `menu.updated` with `action: 'item_availability'`, `isAvailable: false`; digital menus disable item | Code Verified |
| TC-INV-003 | In-Memory Cart Reservation Tracking | Item stock is 5; Guest adds 2 to cart | Customer adds item to cart | `activeReservationsMap` records reservation; remaining available stock computed as $5 - 2 = 3$ | Code Verified |
| TC-INV-004 | Expired Cart Reservation Pruning | Cart reservation created with expiry timestamp | Expiration timestamp passes | Expired reservation automatically deleted from `activeReservationsMap` during next lookup | Code Verified |
| TC-INV-005 | Manual Stock Adjustment | Admin updates stock availability | Call `POST /api/menu/items/:itemId/availability` | `StockItem` updated in database; `notifyStockUpdated` broadcast | Code Verified |

---

## 6. Positive Test Cases
- Instant availability synchronization across customer phones and staff terminals.
- Automatic creation of default stock items ensuring zero unmanaged catalog items.
- Resilient cart reservation tracking preventing double-selling of low-inventory items.

## 7. Negative / Validation Test Cases
- Ordering an item whose available stock is zero rejected by order validation.
- Missing itemId in availability endpoint returns 400 Bad Request.

## 8. Authorization / Permission Test Cases
- Kitchen staff can toggle availability for food items; Bartenders can toggle availability for bar items.
- Non-admin staff cannot modify physical stock thresholds.

## 9. Concurrency / State Tests
- High-concurrency checkout: `activeReservationsMap` and database stock checks prevent concurrent orders from exceeding physical quantity.

## 10. Realtime / Socket Tests
- Real-time event `menu.updated` delivered with payload `{ action: 'item_availability', itemId, details: { isAvailable, availableStock, currentStock } }`.

## 11. Edge Cases
- Item marked unavailable while present in a customer's active cart: Cart review screen detects unavailable item and prevents checkout.

## 12. Regression Scenarios
- Verify that toggling stock status in KDS tabs updates the catalog manager in Admin.

## 13. Existing Historical Test Coverage
- Verified in historical inventory and menu synchronization testing records.

## 14. Current Codebase Differences / Outdated Cases
- **Hybrid Storage Architecture**: Stock counts are persisted in `StockItem` PostgreSQL records, while transient high-frequency cart reservations are managed via `activeReservationsMap` in memory.
- **Event Bus Format**: Stock availability updates are unified under `SOCKET_EVENTS.MENU_UPDATED` with `action: 'item_availability'`.

## 15. Coverage Gaps
- Automated multi-location central commissary warehouse stock sync tests.

## 16. Final Module Test Summary
The Inventory module provides fast stock availability toggling, resilient in-memory cart reservations, database persistence via `StockItem`, and real-time multi-device synchronization.
