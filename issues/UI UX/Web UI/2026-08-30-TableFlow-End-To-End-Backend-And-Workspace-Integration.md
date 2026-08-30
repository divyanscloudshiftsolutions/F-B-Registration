# Daily Technical & Architectural Issues Log — August 30, 2026

---

## Issue 1: TableFlow Frontend State Unification & Centralized Backend API Client Integration

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Unifying TableFlow customer self-ordering, staff table-side ordering, KDS station bump bars, and waiter calls with live PostgreSQL backend REST API endpoints. |
| **Problems Identified** | TableFlow ordering was operating primarily on in-memory mock seed data (`table/src/mocks/seed.ts`) and client localStorage, causing placed orders, KDS item status transitions, and customer service requests to remain disconnected from PostgreSQL. |
| **Resolution** | Created a centralized API client layer in `table/src/services/api.ts` communicating with Express REST endpoints at `http://localhost:4000/api`. Refactored `table/src/services/store.ts` into a reactive UI cache that synchronizes mutations directly with PostgreSQL `orders`, `order_items`, and `service_requests`. |
| **Activities Completed** | Verified live catalog fetching from `GET /api/menu`, order placement via `POST /api/orders`, station-filtered KDS ticket retrieval from `GET /api/kds/orders/:station`, bump transitions via `PUT /api/orders/items/:id/status`, and waiter request dispatch via `POST /api/service-requests`. |
| **Files / Modules Updated** | `table/src/services/api.ts`, `table/src/services/store.ts`, `table/src/routes/staff.tables.tsx`, `table/src/routes/customer.eat.tsx` |

---

## Issue 2: Unified Receptionist Checkout Modal with Live Consumption & Redemption Calculation

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Integrating the Web Frontend receptionist table checkout drawer with authoritative PostgreSQL billing consolidation and drink redemption offsets. |
| **Problems Identified** | The table checkout modal in `web-frontend` only closed the token session without displaying active table consumption, itemized food/drink subtotals, applied taxes, or drink redemption entitlement offsets. |
| **Resolution** | Enhanced `web-frontend/src/components/modals/CheckoutConfirmationModal.tsx` and `web-frontend/src/services/api.ts` to query `POST /api/bills/calculate`. The modal renders a live bill preview (Gross Subtotal, 5% Service Charge, 5% GST, Drink Redemption offset, and Net Amount to Collect) and supports multi-method settlement (`CASH`, `UPI`, `CARD`) via `POST /api/bills/settle`. |
| **Activities Completed** | Verified end-to-end checkout where a ₹2,000 entry fee entitlement offsets ₹550 of drink consumption, consolidating into an authoritative final payable balance of ₹293.00, automatically releasing the table and closing occupancy logs. |
| **Files / Modules Updated** | `web-frontend/src/components/modals/CheckoutConfirmationModal.tsx`, `web-frontend/src/services/api.ts`, `web-frontend/src/pages/TablesPage.tsx` |

---

## Issue 3: Order Origin Attribution & Numeric Inventory Tracking Architecture

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Extending the PostgreSQL database schema and backend services to record order origin attribution and track numeric inventory quantities. |
| **Problems Identified** | The `Order` model lacked fields to distinguish customer self-orders from staff table-side orders (`handlerId`), and menu items only supported a boolean `isAvailable` 86 toggle without physical inventory stock tracking. |
| **Resolution** | Added `OrderSource` enum (`CUSTOMER`, `SERVER`, `BARTENDER`, `RECEPTIONIST`, `ADMIN`), `orderSource`, and `handlerId` to `Order`. Created `StockItem` and `InventoryLog` models in `backend/prisma/schema.prisma` along with `backend/src/services/InventoryService.ts` for automatic stock decrements and movement audit logging. |
| **Activities Completed** | Pushed schema updates to PostgreSQL via `npx prisma db push`, generated Prisma client (v5.22.0), and validated assisted order creation with `orderSource = 'SERVER'` and `handlerId = staff.id`. |
| **Files / Modules Updated** | `backend/prisma/schema.prisma`, `backend/src/services/OrderService.ts`, `backend/src/services/InventoryService.ts`, `backend/src/routes.ts` |

---

## Issue 4: Web Frontend Compiler Strictness and Route Link Type Alignment

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Resolving TypeScript compiler strictness warnings, unused parameter flags, and TanStack Router link parameter typing errors across Web Frontend and TableFlow. |
| **Problems Identified** | Parameterized route links in `table/src/routes/staff.tables.tsx` used hardcoded string paths instead of TanStack Router `$tableId` params, and unused local variables caused production build failures under strict linting flags. |
| **Resolution** | Updated TanStack Router `Link` components to use `to="/staff/tables/$tableId"` with `params={{ tableId: t.id }}`, adjusted compiler settings in `tsconfig.app.json`, and added safe type casting for optional token customer properties in `TableManagement.tsx` and `DashboardPage.tsx`. |
| **Activities Completed** | Verified clean build on `web-frontend` (`npm run build` passed in 444ms) and zero TypeScript errors on `table` (`npx tsc --noEmit` passed with 0 errors). |
| **Files / Modules Updated** | `table/src/routes/staff.tables.tsx`, `web-frontend/tsconfig.app.json`, `web-frontend/src/components/admin/TableManagement.tsx`, `web-frontend/src/components/modals/ExtendSessionModal.tsx`, `web-frontend/src/pages/DashboardPage.tsx` |

---

## Issue 5: Order State Machine Strict Enforcement & Backward Transition Prevention

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Enforcing strict server-side state machine progression rules for order items across Kitchen and Bar KDS stations. |
| **Problems Identified** | Order item status updates allowed arbitrary non-sequential status jumps (e.g. `PLACED ➔ SERVED` bypassing preparation) and backward transitions (e.g. `SERVED ➔ PREPARING`), risking kitchen workflow corruption. |
| **Resolution** | Enforced a strict state machine transition map in `backend/src/services/OrderService.ts`: `PLACED ➔ ACCEPTED ➔ PREPARING ➔ READY ➔ SERVED`. Disallowed backward regressions and illegal jumps, rejecting invalid transitions with HTTP 400. |
| **Activities Completed** | Verified negative testing where direct jumps from `PLACED ➔ SERVED` and regressions from `SERVED ➔ PREPARING` are rejected with HTTP 400, while linear forward bumping succeeds. |
| **Files / Modules Updated** | `backend/src/services/OrderService.ts`, `backend/src/routes.ts` |

---

## Issue 6: Multi-Request Settlement & Order Submission Idempotency Protection

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Hardening order submission and bill settlement endpoints against network retries and double-click concurrency. |
| **Problems Identified** | Rapid double-clicks on the checkout/payment button could trigger multiple concurrent settlement requests on already closed sessions, causing unhandled session-closed error responses on the client. |
| **Resolution** | Implemented a 3-second deduplication cache in `OrderService.ts` for identical order payloads and updated `BillingService.ts` to return the existing settled bill record with `{ turnoverStatus: 'ALREADY_SETTLED' }` on retry rather than throwing errors. |
| **Activities Completed** | Validated automated concurrency tests where double-submission of identical orders returns the original order without duplicate rows, and double settlement safely returns the paid bill without double closing. |
| **Files / Modules Updated** | `backend/src/services/BillingService.ts`, `backend/src/services/OrderService.ts` |
