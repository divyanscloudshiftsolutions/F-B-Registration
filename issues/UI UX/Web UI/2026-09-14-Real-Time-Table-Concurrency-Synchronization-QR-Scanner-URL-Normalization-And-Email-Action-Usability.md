# Real-Time Table Concurrency Synchronization, QR Scanner URL Normalization, and Email Action Usability

---

## Issue 1: Email Action Link Rendering and ID Copy Usability in Client Mailboxes

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Customer registration, email notification dispatch, and digital access token onboarding workflow. |
| **Problems Identified** | In customer confirmation emails, the "Copy ID" / "Copy Code" buttons relied on client-side script actions that are restricted and stripped by major email clients (Gmail, Outlook, Apple Mail), causing the copy action to fail silently when clicked inside an email client. |
| **Resolution** | Refactored email template components to render high-contrast, accessible action buttons and distinct monospace token badges (`BAR-YYYYMMDD-XXXXX`) formatted with selectable typography and direct customer portal deep-link URLs, enabling friction-free ID access across all desktop and mobile mail clients without JavaScript dependencies. |
| **Activities Completed** | Updated email generation templates in `EmailService.ts`, ensured responsive layout wrapping for mobile viewport rendering, verified visual contrast against dark backgrounds, and aligned action button styling with the executive brand design system. |
| **Files / Modules Updated** | `backend/src/services/EmailService.ts` |

---

## Issue 2: Check-In Stage 3 Camera QR Scanner Payload Extraction and HTTP 404 Prevention

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Receptionist Check-In Stage 3 (QR Verification & Scanning) and Bartender quick-scan intake workflows. |
| **Problems Identified** | The customer email QR code encodes the full Customer Access Portal URL (`http://localhost:5173/customer/access/<TOKEN_ID>`). When scanned using the camera QR scanner on the Check-In page, the raw decoded URL string was passed directly to `GET /api/check-in/verify-qr/:tokenNumber`, causing route mismatch and HTTP 404 errors, while manual token ID entry functioned normally. |
| **Resolution** | Implemented a dedicated token extraction utility (`tokenExtractor.ts`) using robust regex pattern matching to normalize raw scanned QR strings, extracting the clean Token ID (`BAR-YYYYMMDD-XXXXX` / `STD-YYYYMMDD-XXXXX`) from full URLs, deep links, or raw text payloads before invoking the verification API. |
| **Activities Completed** | Created `web-frontend/src/utils/tokenExtractor.ts`, integrated payload normalization into `CheckInPage.tsx` camera scan callback and `BartenderPage.tsx` scanner handler, verified error handling for unparseable QR formats, and preserved manual text entry fallbacks. |
| **Files / Modules Updated** | `web-frontend/src/utils/tokenExtractor.ts`, `web-frontend/src/pages/CheckInPage.tsx`, `web-frontend/src/pages/BartenderPage.tsx` |

---

## Issue 3: Global Real-Time Table Availability Synchronization and Atomic Selection Locking

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Multi-user table layout management, floor plan availability, and live reservation synchronization across staff dashboards. |
| **Problems Identified** | When User A (Admin) selected or locked a table, User B (Receptionist) continued to see that table as available for up to 10 seconds due to an event-name contract mismatch between Socket.io emitter (`table.updated`) and frontend subscriber (`table:updated`), causing the UI to miss immediate push updates and fall back on polling. Additionally, concurrent table selection attempts lacked standardized 409 Conflict rejection messages, and reservation lifecycle events lacked real-time broadcast coverage. |
| **Resolution** | Standardized real-time event names across backend emitters and frontend consumers using dot notation (`table.updated`, `table.session.activated`, `table.session.closed`, `reservation.created`, `reservation.updated`, `reservation.cancelled`). Updated `DataContext.tsx` to immediately update React table and reservation states upon WebSocket message arrival. Enhanced `POST /tables/:id/lock` with PostgreSQL row-level locks (`SELECT ... FOR UPDATE`) and standardized 409 Conflict rejection messaging (`"This table is selected by another user."`). |
| **Activities Completed** | Added reservation event definitions in `backend/src/realtime/events.ts`, implemented broadcast helper functions in `backend/src/realtime/socket.ts`, integrated event dispatchers and atomic conflict messaging in `backend/src/routes.ts`, and connected real-time listeners and cleanup routines in `web-frontend/src/context/DataContext.tsx`. |
| **Files / Modules Updated** | `backend/src/realtime/events.ts`, `backend/src/realtime/socket.ts`, `backend/src/routes.ts`, `web-frontend/src/context/DataContext.tsx` |

---

## Issue 4: Table-Wise Service Aggregation and Modal Item Fulfillment in Waiter Station

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Waiter Station Ready Queue, table-centric service management, and order fulfillment workflows. |
| **Problems Identified** | The Waiter Ready view listed individual ready food/drink items separately as top-level cards, creating an excessively long and cluttered queue during high-volume operations where multiple items belonged to the same table. Waiters lacked an aggregated table-level view to inspect complete order progress (READY, PREPARING, ACCEPTED, SERVED) for a specific dining group. |
| **Resolution** | Redesigned the Waiter Station Ready Queue into a table-wise view where each table appears exactly once with an aggregated ready items badge count. Implemented an interactive Table Service Modal allowing staff to inspect all active order items by status and execute the single-click `READY -> SERVED` item transition. Added automatic modal dismissal and queue removal once all items for a table are served. |
| **Activities Completed** | Refactored `web-frontend/src/pages/WaiterStationPage.tsx` to group ready items by `tableNumber` / `tableId`, built the table-wise modal layout with distinct status tags, integrated `api.updateOrderItemStatus()`, and ensured smooth responsive grid wrapping for tablet and desktop viewports. |
| **Files / Modules Updated** | `web-frontend/src/pages/WaiterStationPage.tsx` |

---

## Issue 5: Customer Portal Order Item Quantity Synchronization Across Checkout and Billing

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Customer Self-Service Ordering Portal, My Orders summary tab, and Bill settlement views. |
| **Problems Identified** | In the customer portal's 'My Orders' tab, total item quantities and item groupings failed to update dynamically after order placement, intermittently displaying outdated item counts or persisting stale order states even after moving to the bill payment screen. |
| **Resolution** | Synchronized state recalculations in `CustomerContext.tsx` by aggregating confirmed active orders, updating total quantity counters reactively upon receiving `order.created` and `order.item.updated` socket events, and ensuring bill settlement state properly reflects all completed order lines. |
| **Activities Completed** | Updated order state normalization and item counting in `CustomerContext.tsx`, verified consistent badge counts between cart preview and active order history, and validated order tracking across mobile touch viewports. |
| **Files / Modules Updated** | `web-frontend/src/context/CustomerContext.tsx` |

---

## Issue 6: Waiter Station Cyclic Re-Render Loop Elimination and Real-Time Listener Stabilization

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Waiter Station real-time event subscriptions, staff notification dispatch, and UI rendering stability. |
| **Problems Identified** | When customer service requests or table updates occurred, the Waiter Station UI entered an uncontrolled rapid re-render loop ("kadakada" screen flickering). The root cause was a cyclic React dependency: `fetchTableServiceOrders` had `[tables]` in its `useCallback` dependency array, while the main lifecycle `useEffect` had `fetchTableServiceOrders` in its dependencies. Calling `fetchTables()` updated `tables`, invalidating the callback reference, which repeatedly re-triggered `useEffect`, leaving and re-joining socket rooms and blasting 6 concurrent APIs multiple times per second. |
| **Resolution** | Decoupled `fetchTableServiceOrders` from the `tables` state array by introducing a `tablesRef` (`React.useRef`) to look up table metadata dynamically without invalidating hook references. Stabilized all data fetching callbacks (`fetchTables`, `fetchRequests`, `fetchReadyItems`, `fetchMenu`, `fetchReservations`, `fetchBillsData`, `fetchTableServiceOrders`) with empty dependency arrays (`[]`). Prevented global loading spinner toggles (`setIsLoading` / `setIsBillsLoading`) on background Socket.IO events, ensuring single-time room subscription on mount and single teardown on unmount. |
| **Activities Completed** | Refactored hook dependencies in `web-frontend/src/pages/WaiterStationPage.tsx`, stabilized socket event handlers for `service_request.created`, `service_request.updated`, `order.item.updated`, `bill.settled`, and `table.session.closed`, and ensured flicker-free background data synchronization. |
| **Files / Modules Updated** | `web-frontend/src/pages/WaiterStationPage.tsx` |
