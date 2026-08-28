# Daily Issues & Fixes Log — 2026-08-22

This report logs the technical resolution of the role-based corporate dashboard redesign, securing analytics from unauthorized roles, implementing a dynamic SVG seating peaks line chart, and mapping correct operational permissions.

---

## Issue 1: Dashboard Role-Based Corporate Redesign & Layout Hierarchy

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Transform the system dashboard into a premium corporate interface that dynamically adapts to Admin, Manager, Receptionist, and Bartender roles. |
| **Problems Identified** | The previous dashboard layout was identical for all roles, exposing sensitive revenue figures, collections trends, and administration-level checkout controls to Receptionists and Bartenders. Additionally, launching these routes triggered unauthorized `403 Forbidden` API requests in the browser console. |
| **Resolution** | Refactored `DashboardPage.tsx` with dynamic layout components and role guards. Receptionists and Bartenders now see a clean 3-card operational layout (Active Sessions, Guests In-House, and Seating Occupancy or Drink Redemptions), while Admins and Managers receive the full 5-card dashboard including Revenue metrics. Swapped custom actions dynamically. |
| **Activities Completed** | Declared helper role normalizers (`isManagement`, `isReceptionist`, `isBartender`). Replaced the toggle banner header with the brand shell header. Rendered custom Priority Action cards with gold border highlighting on primary actions. Dynamic overview metric cards now adapt column count (`lg:grid-cols-5` vs `lg:grid-cols-3`). |
| **Files / Modules Updated** | [`DashboardPage.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/pages/DashboardPage.tsx) |

---

## Issue 2: Unauthorized API Requests & Console Cleanup (403 Forbidden)

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Prevent console warnings and unauthorized background queries when non-admin staff log into the dashboard. |
| **Problems Identified** | Receptionist and Bartender roles do not possess credentials for `/reports/dashboard` and `/admin/sessions`. Fetching these on component mount threw persistent `403 Forbidden` network errors. |
| **Resolution** | Wrapped backend report fetching (`fetchReport()`) and audit syncs (`refreshAllSessions()`) in strict conditional checks checking if `isManagement` is true. |
| **Activities Completed** | Confirmed that no unauthorized endpoints are hit, console remains clean on coordinator login, and local fallback calculations handle missing report states gracefully. |
| **Files / Modules Updated** | [`DashboardPage.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/pages/DashboardPage.tsx) |

---

## Issue 3: Custom SVG Seating Peaks Line Chart

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Implement a compact seating peaks line chart representing hourly guest occupancy. |
| **Problems Identified** | The dashboard had no visual occupancy trend indicator, and introducing heavy third-party chart engines would bloat the application bundle. |
| **Resolution** | Developed a native React/SVG line and area chart utilizing standard mathematical coordinate scalers. |
| **Activities Completed** | Mapped points dynamically using `reportData.hourlyBreakdown.hourlyData`, scaling coordinates to fit inside an SVG viewport, rendering a custom gold gradient area under the stroke, and pulsing peak dot indicators. |
| **Files / Modules Updated** | [`DashboardPage.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/pages/DashboardPage.tsx) |

---

## Issue 4: Dynamic Alert Filtering and Bartender Session Actions

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Align alert listings and session-management capabilities with permitted bartender tasks. |
| **Problems Identified** | Bartenders must be allowed to extend and checkout active table sessions, but they must not see registration-gate prompts like "Table now available" or "Pending customer attendance". |
| **Resolution** | Filtered the `notifications` array dynamically, completely omitting table available alerts and pending attendance alerts for Bartenders, while keeping expiring session alerts. |
| **Activities Completed** | Programmed unified alerts mapper, verified that bartenders see checkout/extend buttons matching their allowed operational tasks, and verified that build checks compile successfully. |
| **Files / Modules Updated** | [`DashboardPage.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/pages/DashboardPage.tsx) |

---

## Issue 5: Dashboard Mobile & Tablet Responsive UX Optimizations

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Correct spacing, wrapping, layout alignment, SVG chart aspect ratios, and interactive touch controls across all viewport sizes (320px–1440px). |
| **Problems Identified** | The table layout caused severe horizontal scrolling and text wrapping on mobile viewports; alert buttons squeezed text into narrow, unreadable columns; the SVG seating peaks line chart warped aspect ratios on container resizing; X-axis labels collided; and hover tooltips were unusable on touchscreens. |
| **Resolution** | Refactored `DashboardPage.tsx` to swap the desktop table for high-density, touch-friendly **Session Cards** on viewports `< 640px`. Implemented a responsive alert card structure that stacks content vertically and places actions full-width on mobile. Omitted `preserveAspectRatio="none"` on the peaks SVG to allow proportional scaling, and mapped interactive header text labels that update dynamically on tap (e.g. `Revenue: X at Hour`) to resolve hover-dependency issues. Reduced horizontal X-axis labels on mobile using pure CSS classes. |
| **Activities Completed** | Coded the mobile session cards, verified natural text wrapping for long names, implemented touch toggles, verified that compilation is clean, and successfully pushed changes to GitHub. |
| **Files / Modules Updated** | [`DashboardPage.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/pages/DashboardPage.tsx) |

---

## Issue 6: Global Checkout Rename & Unified Checkout Modal

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Standardize user-facing actions and confirmation dialogs when ending active guest sessions. |
| **Problems Identified** | Inconsistent terminology ("Close Session", "Cancel Session", "Checkout") confused operators, and duplicate confirm modal definitions were scattered across multiple page files. |
| **Resolution** | Renamed all customer-facing terminology from "Close Session" to "Checkout" globally. Extracted all confirm templates into a reusable `CheckoutConfirmationModal.tsx` and integrated it across pages. |
| **Activities Completed** | Coded `CheckoutConfirmationModal.tsx`, replaced inline modals, verified proper checkout flow operations, and cleaned up console warnings. |
| **Files / Modules Updated** | [`CheckoutConfirmationModal.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/components/modals/CheckoutConfirmationModal.tsx), [`DashboardPage.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/pages/DashboardPage.tsx), [`CustomerSessionsManager.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/components/admin/CustomerSessionsManager.tsx), [`TablesPage.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/pages/TablesPage.tsx), [`BartenderPage.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/pages/BartenderPage.tsx) |

---

## Issue 7: E2E Proportional Session Extension & Redemption Calculation

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Resolve `₹0` calculations and integrate dynamic additional drink redemption entitlement previews into the Session Extension workflow. |
| **Problems Identified** | A data contract mismatch in token list responses left `placeTypeId` undefined on the client, breaking rate card lookups. Additionally, the modal had no dynamic display of additional drink entitlement or rate calculations for custom inputs. |
| **Resolution** | Updated the active token APIs to include `placeTypeId` in their mapped response. Added a robust ID + Name fallback resolver on the client. Added a `getExtensionDrinks` helper that mirrors backend `Math.floor` rounding rules, displaying `+X Drinks` alongside calculated prices dynamically. |
| **Activities Completed** | Updated backend routing models, updated API client mappings, implemented unified calculation preview UI, verified compiler stability, and verified E2E flow. |
| **Files / Modules Updated** | [`routes.ts`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/backend/src/routes.ts), [`api.ts`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/services/api.ts), [`ExtendSessionModal.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/components/modals/ExtendSessionModal.tsx) |
