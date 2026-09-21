# Customer Portal Mobile Navigation, Ordering Lifecycle Rules, Responsive Cards, and KDS State Reversion

---

## Issue 1: Customer Portal Mobile Menu Category Horizontal Scrollable Product Row Optimization

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Customer Portal Menu Navigation and Food/Drink Category Display Module |
| **Problems Identified** | In mobile view, food and beverage menu items under accordion categories were rendered inside a vertical single-column stack (`grid-cols-1 md:grid-cols-2...`). This caused excessive vertical scrolling and page clutter across lengthy menus (Starters, Mains, Snacks, Desserts, Cocktails, Mocktails, Spirits), preventing users from quickly browsing distinct categories without navigating extensive vertical lists. |
| **Resolution** | Re-engineered the menu product container in `CustomerApp.tsx` for both categorized dishes/beverages and unassigned category items. Configured mobile viewport containers as contained horizontal scrolling rows (`flex overflow-x-auto snap-x snap-mandatory no-scrollbar overscroll-x-contain pb-2 pt-0.5 md:grid md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3`) and wrapped each `MenuItemCard` within a fixed-width snap container (`w-[124px] xs:w-[132px] sm:w-[140px] shrink-0 md:w-auto snap-start h-full`). Preserved standard multi-column grid layout across tablet (`md:`) and desktop (`lg:`, `xl:`, `2xl:`) screens. |
| **Activities Completed** | Updated Food Menu (`eat`) and Bar Menu (`drink`) category accordion templates, configured snap alignment points, prevented whole-page horizontal overflow, and maintained full component interactions (add/customizer triggers, quantity steppers, dietary indicators, image zoom triggers) across mobile viewports. |
| **Files / Modules Updated** | `web-frontend/src/pages/CustomerApp.tsx` |

---

## Issue 2: Customer Portal Mobile Sticky Header, Dining Session Status, and Navigation Tabs Verification

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Customer Portal Global Header, Session Lifecycle Indicator, and Navigation Architecture |
| **Problems Identified** | Risk of header elements, table attribution, active session countdown timers, or sub-navigation tabs (`For You`, `Food`, `Drink`, `Merchandise`) scrolling out of the viewport or overlapping drawer modals during vertical page traversal on small-screen mobile devices. |
| **Resolution** | Audited and verified the unified `sticky top-0 z-30` header structure in `CustomerApp.tsx`. Confirmed that the brand logo, table number, live `CustomerSessionTimer`, and quick actions remain permanently docked at `top: 0` alongside the mobile sub-navigation tabs row (`lg:hidden`). Validated that parent containers use `overflow-x-hidden` without restrictive `overflow-y` rules, allowing natural sticky pinning. Confirmed that category filter chips dock naturally without screen obstruction and all interactive drawers/modals (Product Customizer, Product Details, Call Waiter, Image Modal) render above the sticky navigation bars at `z-50` and `z-[100]`. |
| **Activities Completed** | Inspected viewport scrolling mechanics, verified sticky offsets across mobile viewports, validated modal backdrop blur and z-index layer hierarchy, and confirmed zero regression on tablet and desktop navigation layouts. |
| **Files / Modules Updated** | `web-frontend/src/pages/CustomerApp.tsx` |

---

## Issue 3: Customer Portal Ordering 15-Minute Cutoff, Bill Payment Lock, and Cart Interaction Gating

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Customer Portal Session Lifecycle, Cart Ordering Gating, and Real-Time Dining Timer Integration Module |
| **Problems Identified** | Customers could attempt to add products, customize items, increment quantities, or checkout new orders right up until session expiration or even after bill settlement, creating kitchen fulfillment bottlenecks during table turnaround. Additionally, submitting a bill request should not prematurely block ordering if more than 15 minutes remain in the session, whereas reaching 15 minutes or less remaining (or having a settled/paid bill) must strictly disable new item additions while keeping non-destructive actions (decreasing quantity, removing items, reviewing bill, calling waiter) fully accessible. |
| **Resolution** | Implemented a synchronized 1-second live countdown ticker linked to authoritative session timestamps (`sessionData.endTime` or `sessionData.startTime + 2h fallback`) in `CustomerApp.tsx`. Formulated active status flags `isOrderingCutoffReached` ($\le 15$ min / 900s) and `isBillPaidOrSettled` (`PAID`, `SETTLED`, `CLOSED`) to establish unified ordering control `isOrderingBlocked`. Added `isOrderingDisabled` prop across `MenuItemCard.tsx` and `ProductCustomizer.tsx` to disable `ADD`/`ADD +` triggers, disable quantity increment steppers (`+`), and lock customizer sheet submissions with `"Ordering Closed (15m Cutoff)"`. Gated the Product Details drawer add CTA, past order history "Re-order Items" CTA, and Cart checkout button. Added pre-flight validation in `CustomerContext.tsx` `placeOrder` to prevent API submissions when cutoff is active. Maintained full interactivity for cart item decrement (`-`), item removal, order tracking, bill review, and calling floor staff, and rendered persistent informational cutoff warning banners across portal header and cart views. |
| **Activities Completed** | Formulated countdown ticker mechanics, updated card button states, quantity steppers, product customizer sheet, product details modal, cart checkout button, order history reorder actions, context API checkout guards, and persistent cutoff notification banners across mobile and desktop customer views. |
| **Files / Modules Updated** | `web-frontend/src/pages/CustomerApp.tsx`, `web-frontend/src/components/customer/MenuItemCard.tsx`, `web-frontend/src/components/customer/ProductCustomizer.tsx`, `web-frontend/src/context/CustomerContext.tsx` |

---

## Issue 4: Kitchen Display System (KDS) Served State Undo Reversion to Ready Queue

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Kitchen & Bar KDS Ticket Workflow, State Machine Transitions, and Station Order Fulfillment Module |
| **Problems Identified** | When kitchen or bar staff accidentally mark an order item as `SERVED` and invoke the undo action within the grace window, the item must reliably revert directly to the `READY` station queue. Any invalid fallback to `PREPARING` or `PENDING` or rejection by backend order lifecycle validation would cause order tracking inconsistencies between KDS screens, waiter terminals, and customer views. |
| **Resolution** | Audited and verified the order lifecycle state machine in backend `OrderService.ts` to validate the `[OrderStatus.SERVED]: [OrderStatus.READY]` transition path. Ensured that reverting a served item to `READY` properly restores the `readyAt` timestamp and resets `servedAt` to `null`. Verified frontend `servedUndoManager.ts` in KDS to ensure that undoing a served ticket immediately dispatches `updateOrderItemStatus(item.id, 'READY')` and restores ticket visibility in the active Ready queue for waiter pickup and fulfillment. |
| **Activities Completed** | Inspected KDS served undo mechanics, verified backend state machine allowable transition rules, audited timestamp lifecycle management, and confirmed seamless bi-directional status transitions between Ready and Served across Kitchen and Bar KDS modules. |
| **Files / Modules Updated** | `backend/src/services/OrderService.ts`, `web-frontend/src/pages/kds/servedUndoManager.ts` |

---

## Issue 5: Customer Portal Responsive Menu Card Proportions, Square Ratio, and Mobile Landscape Sizing Optimization

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Customer Portal Menu Item Card Component, Square Proportions, and Responsive Viewport Optimization Module |
| **Problems Identified** | Menu item cards were rendering disproportionately large in mobile Top (portrait) and Landscape orientations, consuming excessive vertical viewport space and reducing the number of simultaneously visible menu options. Furthermore, card internal padding, dietary indicator positioning, and typography needed fine-tuning so that cards remained compact, balanced, and readable across all mobile screen dimensions without altering the established Laptop and Desktop layouts. |
| **Resolution** | Optimized card container widths across all horizontal scrolling rows (Home specials, Popular, Drinks, Desserts, Food categories, Bar categories) from `w-[145px] xs:w-[155px] sm:w-[165px]` to `w-[124px] xs:w-[132px] sm:w-[140px] md:w-auto`. Configured Search and Merchandise grid layouts with `sm:landscape:grid-cols-4` to prevent oversized stretching across wider landscape viewports. Maintained strict `1:1` square aspect ratio for product images in `MenuItemCard.tsx`, refined internal card padding (`p-1.5 xs:p-2 sm:p-2.5`), anchored dietary indicators at stable relative coordinates, and optimized typography (`text-[11px] xs:text-xs sm:text-sm`) and button heights (`h-5 xs:h-6`). Preserved all Laptop, Desktop, and Tablet grid structures (`md:w-auto`, `md:grid`, `lg:grid-cols-3`, `xl:grid-cols-2`, `2xl:grid-cols-3`) with zero modification. |
| **Activities Completed** | Refined responsive card wrapper widths, validated square image aspect ratio scaling, enhanced touch stepper responsiveness, adjusted landscape grid distribution, and preserved master desktop layout parity. |
| **Files / Modules Updated** | `web-frontend/src/components/customer/MenuItemCard.tsx`, `web-frontend/src/pages/CustomerApp.tsx` |
