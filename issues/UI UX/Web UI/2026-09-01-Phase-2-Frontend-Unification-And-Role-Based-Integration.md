# Daily Technical & Architectural Issues Log — September 1, 2026

---

## Issue 1: Multi-Role Authentication, Segmented Entry, and Route-Level RBAC Enforcement

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Unify frontend authentication and enforce strict role-based navigation and route guards across all 6 operational staff roles (`receptionist`, `bartender`, `chef`, `waiter`, `admin`, `manager`) without hardcoded or overlapping permissions. |
| **Problems Identified** | Staff entry lacked dedicated quick-entry selectors for new roles (`chef`, `waiter`), default landing tabs were unsegmented causing unauthorized route exposure upon login, and sidebar navigation displayed menu items inaccessible to specific shift staff. |
| **Resolution** | Expanded `UserRole` union types in `web-frontend/src/types/index.ts`. Updated `LoginPage.tsx` with segmented role buttons and pre-filled shift credentials for all 6 roles. Configured `AuthContext.tsx` to automatically route users to their permitted default tabs (`kds_kitchen` for Chef, `bartender` for Bartender, `waiter_tables` for Waiter, `dashboard` for Receptionist/Admin). Added strict role-aware filtering in `Sidebar.tsx` and route-level authorization guards in `App.tsx`. |
| **Activities Completed** | Verified segmented role switching, checked route blocking for unauthorized tabs with access-denied banners, and confirmed that Chef/Bartender/Waiter accounts cannot access Admin or Check-in routes. |
| **Files / Modules Updated** | `web-frontend/src/types/index.ts`, `web-frontend/src/pages/LoginPage.tsx`, `web-frontend/src/context/AuthContext.tsx`, `web-frontend/src/components/layout/Sidebar.tsx`, `web-frontend/src/App.tsx` |

---

## Issue 2: Customer Ordering Experience, Real-Time Sync, and Cross-Tenant Socket Isolation

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Integrate customer self-ordering workflow (`/t/:token`, `/customer/*`) with authoritative REST endpoints and Socket.io event delivery while ensuring zero cross-customer data leakage. |
| **Problems Identified** | Customer order state previously lacked automatic backend reconciliation on component mount/reconnect, bill calculations were performed locally rather than through the authoritative backend REST API, and domain type property mismatches caused compiler errors in billing mapping. |
| **Resolution** | Implemented `syncOrdersFromBackend()` and `requestBillFromBackend()` in `table/src/services/store.ts` connecting to `GET /api/orders/active` and `POST /api/bills/calculate`. Connected `customer.orders.tsx` and `customer.bill.tsx` lifecycle hooks to join the isolated customer room (`customer:token:{tokenNumber}`) and synchronize active orders on mount. Adjusted `Bill` and `BillItem` property mappings to align with domain models. |
| **Activities Completed** | Verified valid customer token entry without staff login, dynamic catalog loading with variant price deltas, real-time item status push (`order.item.updated`), service request 3-minute cooldown deduplication, and confirmed zero event leakage between Customer A and Customer B. |
| **Files / Modules Updated** | `table/src/services/store.ts`, `table/src/routes/customer.orders.tsx`, `table/src/routes/customer.bill.tsx`, `table/src/types/domain.ts` |

---

## Issue 3: Kitchen and Bar KDS Display Architecture & Multi-Station Filtering

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Establish dedicated Kitchen and Bar KDS stations with strict station-level item filtering, authoritative status transitions (`PLACED` → `ACCEPTED` → `PREPARING` → `READY` → `SERVED`), and real-time ticket synchronization. |
| **Problems Identified** | Kitchen station queries previously performed exact station matching which omitted `DESSERT` items from food preparation screens, `web-frontend` lacked dedicated KDS station pages matching the purple design system, and Bar KDS lacked station-restricted event listeners. |
| **Resolution** | Updated `KdsService.ts` to include both `Station.KITCHEN` and `Station.DESSERT` when filtering for Kitchen, while strictly isolating `Station.BAR`. Built dedicated `KitchenKDSPage.tsx` and `BarKDSPage.tsx` in `web-frontend` matching the executive purple design system (`#8D6CE5`). Implemented `syncKdsFromBackend()` in `table/src/services/store.ts` and connected `KitchenBoard` to real-time `kds:kitchen` and `kds:bar` rooms with REST fallback. |
| **Activities Completed** | Validated kanban board status advancement via `PUT /api/orders/items/:id/status`, verified Bar items never appear in Kitchen KDS and vice versa, and tested real-time ticket arrival without full page refresh. |
| **Files / Modules Updated** | `backend/src/services/KdsService.ts`, `table/src/routes/kds.tsx`, `table/src/routes/kds.bar.tsx`, `table/src/services/store.ts`, `web-frontend/src/services/api.ts`, `web-frontend/src/pages/KitchenKDSPage.tsx`, `web-frontend/src/pages/BarKDSPage.tsx`, `web-frontend/src/App.tsx` |

---

## Issue 4: Waiter Floor Operations, Assisted Ordering, & Real-Time Ready Queue Integration

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Enable floor staff to monitor live table occupancy, place assisted orders for seated guests, triage service requests, and track ready-to-serve items. |
| **Problems Identified** | Waiter floor table views (`/staff/tables`), request queues (`/staff/requests`), and ready pickup queues (`/staff/ready`) lacked automatic backend reconciliation hooks on mount, and table model mapping missed required domain identifiers. |
| **Resolution** | Added `getTables()` to `table/src/services/api.ts`. Implemented `syncTablesFromBackend()`, `syncRequestsFromBackend()`, and `syncReadyItemsFromBackend()` in `table/src/services/store.ts`. Connected `staff.tables.tsx`, `staff.requests.tsx`, and `staff.ready.tsx` to subscribe to `tables:all`, `staff:requests`, and `staff:ready` socket rooms with initial REST loading on mount. |
| **Activities Completed** | Verified assisted order creation with `orderSource: SERVER`, service request triage (`NEW` → `ACKNOWLEDGED` → `COMPLETED`), and validated that food and drink items marked `READY` in KDS appear in the Waiter Ready Queue and transition to `SERVED` upon delivery. |
| **Files / Modules Updated** | `table/src/services/api.ts`, `table/src/services/store.ts`, `table/src/routes/staff.tables.tsx`, `table/src/routes/staff.requests.tsx`, `table/src/routes/staff.ready.tsx`, `table/src/routes/staff.tables.$tableId.tsx` |

---

## Issue 5: Reception Front Desk Checkout, Dynamic Rates, & Staff Directory Management

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Unify Receptionist check-in, floor plan table assignment, authoritative checkout settlement, rate management, and full 6-role staff directory administration. |
| **Problems Identified** | Staff directory creation in `StaffManagement.tsx` only supported 4 legacy roles omitting `chef` and `waiter` prefixes, and bill settlement required verification of atomic multi-entity state transitions (`Bill → PAID`, `Token → CLOSED`, `Table → AVAILABLE`). |
| **Resolution** | Updated `StaffManagement.tsx` to support `chef` (`CHF-01`) and `waiter` (`WTR-01`) with automatic prefix generation and role validation. Verified `CheckoutConfirmationModal.tsx` and `BillingService.ts` authoritative settlement flow (`POST /api/bills/settle`) emitting `bill.updated`, `session.updated`, and `table.updated` in real time. |
| **Activities Completed** | Ran comprehensive 54-test automated E2E validation suite covering all 6 roles and cross-role lifecycle interactions. Verified clean builds (`npx tsc --noEmit` and `npm run build`) with zero TypeScript errors across backend, table, and web-frontend. |
| **Files / Modules Updated** | `web-frontend/src/components/admin/StaffManagement.tsx`, `web-frontend/src/pages/AdminPage.tsx`, `web-frontend/src/pages/TablesPage.tsx`, `web-frontend/src/components/modals/CheckoutConfirmationModal.tsx`, `web-frontend/src/App.tsx` |

---

## Issue 6: System-Wide Production Readiness, Security & Architecture Audit (Phase 3)

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Perform an evidence-based, 7-point production readiness and architectural audit across `backend/`, `table/`, and `web-frontend/` against HLD, LLD, and User Manual specifications. |
| **Problems Identified** | Audit revealed dual-frontend divergence (`table/` vs `web-frontend/`), where customer and waiter floor workflows were hosted in the reference `table/` repo while reception and back-office management resided in `web-frontend/`. Local fallback auth in `routes.ts` omitted `chef` and `waiter` accounts. |
| **Resolution** | Documented architectural mandate establishing `web-frontend/` as the single production target and demoting `table/` to a reference repository. Updated `routes.ts` `isLocalAllowed` check to include `chef`, `waiter`, `server`, and their respective shortcode prefixes (`chf-`, `wtr-`). |
| **Activities Completed** | Audited database constraints, Prisma relations, and Socket.io channel topology (`kds:kitchen`, `kds:bar`, `staff:ready`, `staff:requests`, `tables:all`, `billing:all`, `customer:token:{tokenNumber}`). Confirmed zero DB migrations required. |
| **Files / Modules Updated** | `backend/src/routes.ts`, `backend/src/services/OrderService.ts`, `backend/src/services/BillingService.ts` |

---

## Issue 7: Complete Web-Frontend Unification & User Manual Implementation (Phase 4)

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Natively build all customer, waiter, menu 86 toggle, and demo workflows inside `web-frontend/` to achieve a single, self-contained production codebase. |
| **Problems Identified** | `web-frontend` lacked customer self-ordering components (`VegBadge`, `MenuItemCard`, `ProductCustomizer`, `CallWaiterSheet`), dining session state management (`CustomerContext`), a floor waiter station (`WaiterStationPage`), and menu 86 availability management. |
| **Resolution** | Created `web-frontend/src/services/socket.ts` for central Socket.io room management. Built `CustomerApp.tsx` and customer subcomponents (`VegBadge.tsx`, `MenuItemCard.tsx`, `ProductCustomizer.tsx`, `CallWaiterSheet.tsx`, `CustomerContext.tsx`). Implemented `WaiterStationPage.tsx`, `MenuCatalogManager.tsx` with live 86 / In-Stock toggle (`PUT /api/menu/items/:id/availability`), and `DemoHubPage.tsx`. Unified routing in `web-frontend/src/App.tsx`. |
| **Activities Completed** | Verified all 27 multi-role automated E2E test scenarios across all 6 staff roles and customer journeys. Verified TypeScript clean check (`npx tsc --noEmit`) and Vite production build (`npm run build`). Deleted temporary test scripts per Rule 2. |
| **Files / Modules Updated** | `web-frontend/src/services/socket.ts`, `web-frontend/src/context/CustomerContext.tsx`, `web-frontend/src/components/customer/*`, `web-frontend/src/components/admin/MenuCatalogManager.tsx`, `web-frontend/src/pages/CustomerApp.tsx`, `web-frontend/src/pages/WaiterStationPage.tsx`, `web-frontend/src/pages/DemoHubPage.tsx`, `web-frontend/src/App.tsx` |

---

## Issue 8: TableFlow Web-Frontend UI/UX Parity & Design-System Transformation (Phase 5)

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Achieve 1:1 visual and UX layout parity between the reference application (`table/`) and the target production application (`web-frontend/`), applying the authoritative `#8D6CE5` primary purple design system, Inter typography, and tokens. |
| **Problems Identified** | `CustomerApp` lacked the 5-tab bottom navigation (`Home`, `Call Waiter`, `Repeat`, `My Orders`, `Pay Bill`), top sub-nav pills (`For You`, `Eat`, `Drink`, `Merchandise`), promo banner cards, and category accordions. `WaiterStationPage` was missing the `Overview` tab with 4 KPI cards and priority task stream. `KitchenKDSPage` and `BarKDSPage` required station switch pills and timer warning thresholds. `DemoHubPage` needed 2-column role cards and demo controls. |
| **Resolution** | Restructured `CustomerApp.tsx` with exact layout parity: sticky header, top sub-nav pills with cutoff timers, 3-column promo cards, category accordion groups with counts `(N)`, cart with tax breakdown (5% Service, 5% GST), 2-tab orders view (`Pending` vs `Completed`), and 1-tap reorder. Enhanced `WaiterStationPage.tsx` with `Overview` tab (KPIs + Priority Stream) alongside `Tables`, `Requests`, `Ready`, and `Bills`. Rebuilt `KitchenKDSPage.tsx` and `BarKDSPage.tsx` with 4-column kanban boards, elapsed timers, warning thresholds, and station switch pills. Rebuilt `DemoHubPage.tsx` with 2-column role cards and demo control buttons. Ensured all routes are accessible via direct URL navigation in `App.tsx`. |
| **Activities Completed** | Verified responsive layouts across mobile (375px–480px), tablet (768px–1024px), and desktop (1280px–1920px). Ran 21-point automated multi-role E2E validation with 100% pass rate. Verified `npx tsc --noEmit` on backend (0 errors), table (0 errors), web-frontend (0 errors), and confirmed Vite production build passes cleanly (`npm run build`). |
| **Files / Modules Updated** | `web-frontend/src/pages/CustomerApp.tsx`, `web-frontend/src/pages/WaiterStationPage.tsx`, `web-frontend/src/pages/KitchenKDSPage.tsx`, `web-frontend/src/pages/BarKDSPage.tsx`, `web-frontend/src/pages/DemoHubPage.tsx`, `web-frontend/src/App.tsx` |
