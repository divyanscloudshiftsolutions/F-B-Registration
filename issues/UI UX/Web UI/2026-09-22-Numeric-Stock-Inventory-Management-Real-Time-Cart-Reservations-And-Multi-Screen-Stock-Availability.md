# Numeric Stock Inventory Management, Real-Time Cart Reservations, and Multi-Screen Stock Availability

## Issue 1: Admin Menu Catalog & Item Drawer Numeric Stock Inventory Management & Stock State Modals

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Admin Menu Management module enhancement to support granular numeric stock inventory levels, low-stock warning indicators, non-destructive manual stock-out states, and interactive replenishment modals. |
| **Problems Identified** | Admin menu management previously supported only a binary Available / Stock-Out toggle without tracking actual physical quantity. When marking items out of stock, underlying inventory counts were either lost or untracked. Admins lacked visual feedback on low-stock items in the catalog table and could not adjust or replenish stock counts directly within catalog workflows. |
| **Resolution** | 1. Added integer-validated non-negative `Stock Quantity` input field in `MenuItemDrawer` defaulting to 50 for new items and preserving existing counts on edit.<br>2. Enhanced `MenuCatalogManager` table with a dedicated `Stock` column displaying color-coded status badges: red for out of stock (`0` or unavailable), amber for low stock (`<= 10`), and neutral purple for healthy inventory (`> 10`).<br>3. Implemented confirmation dialog for manual Stock-Out that informs the administrator that underlying stock quantity is retained while hiding the item from active customer menus.<br>4. Implemented interactive Stock-In modal providing two operational actions: *Restore Current Stock* (restoring availability while preserving underlying quantity) and *Replenish & Make Available* (allowing immediate numerical inventory updates). |
| **Activities Completed** | - Built and validated integer input constraints with `min="0"` and `step="1"` preventing negative or decimal entries.<br>- Integrated responsive catalog table column adjustments across desktop, tablet, and mobile drawer views.<br>- Verified modal dialog interactions, backdrop dismissals, and real-time state synchronization with backend API. |
| **Files / Modules Updated** | - `web-frontend/src/components/admin/MenuItemDrawer.tsx`<br>- `web-frontend/src/components/admin/MenuCatalogManager.tsx`<br>- `web-frontend/src/services/api.ts`<br>- `backend/src/services/MenuService.ts`<br>- `backend/src/routes.ts` |

---

## Issue 2: Chef Kitchen & Bartender Station KDS Real-Time Stock Control & Preserved Inventory Replenishment

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Kitchen Display System (KDS) and Bartender Station inventory control enhancements allowing station staff to monitor numeric stock levels, trigger authoritative stock-outs without destroying inventory counts, and perform quick item replenishments. |
| **Problems Identified** | Kitchen and Bar staff previously lacked visibility into exact remaining portion counts on their station KDS screens. When marking a dish or beverage unavailable during peak service, staff had no option to preserve remaining prep counts or quickly adjust stock after replenishing ingredients from the prep pantry without navigating to the Admin panel. |
| **Resolution** | 1. Enhanced `KitchenStockTab` and `BarStockTab` with station-filtered product inventories displaying real-time numeric stock count badges and `Low Stock` alert badges (`<= 10`).<br>2. Implemented non-destructive manual Stock-Out action in KDS: toggling availability preserves the current numeric count in the database while broadcasting global stock-out events across all customer and staff interfaces.<br>3. Added a dedicated quick-replenish action modal on KDS item cards allowing station operators to replenish stock counts by typing or using stepper buttons and immediately reactivating availability. |
| **Activities Completed** | - Designed compact, touch-friendly KDS inventory item cards optimized for kitchen tablet touchscreens.<br>- Verified real-time WebSocket event emission (`stock:out`, `stock:in`, `stock:update`) updating station screens without requiring page reloads.<br>- Tested bidirectional synchronization between Admin changes and KDS station views. |
| **Files / Modules Updated** | - `web-frontend/src/components/kitchen/KitchenStockTab.tsx`<br>- `web-frontend/src/components/bartender/BarStockTab.tsx`<br>- `backend/src/services/InventoryService.ts`<br>- `backend/src/server.ts` |

---

## Issue 3: Customer Portal Real-Time Stock Badges, Quantity Stepper Clamping, and Dynamic Cart Eviction Sync

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Customer Portal menu browsing, item customization, and cart synchronization overhaul ensuring customers cannot order depleted items, display real-time inventory limits, and automatically adjust active carts upon stock changes. |
| **Problems Identified** | Customers could attempt to order quantities exceeding physical stock or order items that ran out of stock while sitting in their cart. Product customizers allowed quantity increments up to 10 regardless of actual remaining inventory. There were no visual cues informing customers when an item was running low. |
| **Resolution** | 1. Added dynamic `Only X left` urgency badge on `MenuItemCard` and `ProductCustomizer` for items with stock `<= 10`.<br>2. Clamped `ProductCustomizer` quantity stepper dynamically to `Math.min(10, availableStock)` and disabled increment controls when reaching inventory limits.<br>3. Enhanced `CustomerContext` with live socket listeners (`item:stock_updated`, `item:stock_out`, `item:stock_in`): automatically evicted out-of-stock items or clamped cart item quantities down to remaining stock.<br>4. Added polite 3-second non-blocking alert banner notifying customers whenever an item in their cart was automatically adjusted or removed due to inventory changes. |
| **Activities Completed** | - Verified responsive presentation of `Only X left` badge on mobile cards, grid layouts, and modal customizers.<br>- Tested live stock depletion multi-client scenarios: placing orders in one browser session instantly evicted items and updated badges in another session without page refresh.<br>- Validated checkout order submission backend validation returning clear error states if inventory is depleted concurrently. |
| **Files / Modules Updated** | - `web-frontend/src/components/customer/MenuItemCard.tsx`<br>- `web-frontend/src/components/customer/ProductCustomizer.tsx`<br>- `web-frontend/src/context/CustomerContext.tsx`<br>- `backend/src/services/OrderService.ts`<br>- `backend/src/services/InventoryService.ts` |
