# Daily Technical & Architectural Issues Log — August 19, 2026

---

## Issue 1: Bartender Table Page Workflows & Role-Based UI Action Isolation

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Role-based permission controls, view-only monitoring configurations, and user interface action isolation for the Bartender role on the Table Page |
| **Problems Identified** | When logged in with the Bartender role, the Table Page was exposing buttons and handlers for table assignment, reservation, check-in, and reservation cancellation. This violated role-based security boundaries. Bartenders should only monitor seating layouts and read details, while all assignment, check-in, and reservation creation/cancellation operations must be completely restricted. |
| **Resolution** | Refactored `TablesPage.tsx` to detect the Bartender role via `user?.role?.toLowerCase() === 'bartender'`. In the Seating Floor grid table cards, replaced the multi-action receptionist buttons with a single read-only "Inspect Details" button for Bartenders. In the Inspect Details side drawer, hid the Footer action buttons (Close Session, Extend, Assign, Reserve, Cancel) for Bartenders unless the table is `occupied`. In the Reservations tab list, hid the Assign and Cancel buttons on reservation cards when `isBartender` is true. Added early return guards (`if (isBartender) return;`) at the top of all workflow event handlers (`handleAssignReservation`, `handleCheckInReservedTable`, `handleRedirectToCheckIn`, `handleAssignClick`, `handleReserveClick`, `handleAssignSubmit`, `handleReserveSubmit`, `handleCancelClick`) to strictly prevent programmatic bypassing. |
| **Activities Completed** | Updated component rendering rules, applied early return event guards, compiled the frontend build, and verified that view-only layouts and actions block for Bartenders compiled cleanly. |
| **Files / Modules Updated** | `web-frontend/src/pages/TablesPage.tsx` |

---

## Issue 2: Backend Role Authorization & Permissive Session Management for Bartenders

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Endpoint authentication, session close/extend role authorization, and occupied-table action integration |
| **Problems Identified** | The Bartender role needs to perform occupied-table session management operations (Extend Session and Close Session) directly from both the Table Inspect Side Drawer and the Bartender Active Check-ins list. However, because the backend API PUT routes `/api/tokens/:tokenNumber/extend` and `/api/tokens/:tokenNumber/close` were strictly restricted to `['receptionist', 'admin']`, Bartenders were getting "Access Denied" errors when invoking these operations. |
| **Resolution** | Modified `backend/src/routes.ts` to include `'bartender'` in the authorize role list for both `PUT /tokens/:tokenNumber/extend` and `PUT /tokens/:tokenNumber/close` endpoints. In the frontend, removed the `isBartender` guard from `handleCloseSessionSubmit` in `TablesPage.tsx` and modified the Table Inspect side drawer footer so that "Close Session" and "Extend" buttons are displayed on occupied tables for all roles, including Bartenders. |
| **Activities Completed** | Updated backend route authorization headers, removed frontend handler guard, verified project compilation, and confirmed successful builds. |
| **Files / Modules Updated** | `backend/src/routes.ts`, `web-frontend/src/pages/TablesPage.tsx` |

---

## Issue 3: Top-Level Biometric Attendance Kiosk Access for Bartenders

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Role-based navigation hierarchy, biometric kiosk access, and Sidebar layout optimization |
| **Problems Identified** | Bartenders needed access to the FaceMark Quick Facial Attendance Kiosk to record check-in/check-out biometric data. However, the Attendance tab was restricted to Admin, Manager, and Receptionist roles, meaning Bartenders could not view or navigate to the biometric attendance scanner from their workspace. |
| **Resolution** | Updated the top-level Attendance nav button in `Sidebar.tsx` to include `UserRole.BARTENDER` in its allowed roles: `[UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST, UserRole.BARTENDER]`. Reverted nested sub-tab layout implementations inside `BartenderPage.tsx` to keep the codebase clean and avoid redundant layouts. |
| **Activities Completed** | Modified `Sidebar.tsx` allowed roles, removed nested routes from `BartenderPage.tsx`, ran production builds, and verified that the Attendance tab renders correctly at the top level for Bartenders. |
| **Files / Modules Updated** | `web-frontend/src/components/layout/Sidebar.tsx`, `web-frontend/src/pages/BartenderPage.tsx` |

---

## Issue 4: Connecting the Revenue Analytics Chart and CSV Export to Live Database Records

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Live database integration, hourly data aggregation, and CSV export synchronization for the Revenue Analytics dashboard |
| **Problems Identified** | The Revenue Analytics chart was using a hardcoded `hourlyData` mock array (with fake values like ₹94,800 peak hour sales) and `api.getActiveTokens()` (which omitted closed sessions), failing to display the actual revenue generated by the system. |
| **Resolution** | Integrated `useData` context in `RevenueAnalyticsChart.tsx` to read the dynamic `allSessions` array. Memoized filtering to select verified and non-cancelled sessions of the current calendar day (Today). Aggregated cover charges (`amountPaid`) at session `startTime` and extension fees (`additionalAmount`) at extension `extendedAt` time. Calculated the peak hour name and amount dynamically to highlight it in the chart and header. Updated CSV export to export the live today's records list. |
| **Activities Completed** | Replaced mock data, wrote dynamic aggregations, verified TypeScript compilation, ran Vite production builds, tested with zero, single, and multiple live session and extension records, and verified correct export download. |
| **Files / Modules Updated** | `web-frontend/src/components/admin/RevenueAnalyticsChart.tsx` |

---

## Issue 5: Customer Sessions Tab Authorization & Manager Role Permission Alignment

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Role-based access control, session-management authorization, and cross-tab/database state synchronization |
| **Problems Identified** | The `CustomerSessionsManager` component allows Administrators and Managers to perform Extend Session and Close Session actions. However, the backend endpoints (`POST /extend`, `PUT /tokens/:tokenNumber/extend`, `POST /checkout`, `PUT /tokens/:tokenNumber/close`, and `POST /sessions/:tokenNumber/close`) restricted these operations to `receptionist`, `admin`, and `bartender` roles, resulting in `Access Denied` (HTTP 403) errors for Managers. |
| **Resolution** | Updated `backend/src/routes.ts` to include `'manager'` in the `authorize` middleware arrays for all session extend and close routes. This aligns backend security with frontend capabilities. Verified that this change does not escalate Manager permissions on other modules (e.g. table assignment or staff operations) or weaken Bartender restrictions. |
| **Activities Completed** | Modified backend route definitions, ran backend and frontend TS checks, compiled production frontend build, and verified that Manager session extension and closure succeed, updating tables status and invalidating Redis caches. |
| **Files / Modules Updated** | `backend/src/routes.ts` | |
