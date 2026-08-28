# Daily Technical & Architectural Issues Log — August 20, 2026

---

## Issue 1: Quick Facial Attendance Kiosk Layout and Color Compliance

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Optimize the layout responsiveness and align button colors of the Quick Facial Attendance Kiosk page to support seamless mobile viewing and ensure brand integrity. |
| **Problems Identified** | The Kiosk card stretched completely flush to the screen edges on mobile devices due to missing side padding. The success and error absolute state overlays had fixed heights, causing details and action buttons to overflow and get clipped on short viewports. Camera controls and manual input override columns wrapped awkwardly and shifted layout on medium/tablet viewports. Primary/secondary buttons used non-compliant green and red accent colors as their dominant visual identity in violation of design rules. |
| **Resolution** | Added `px-4 sm:px-0` horizontal padding to the outer layout container. Added `overflow-y-auto` scroll behavior to the absolute success and error status overlays. Elevated the responsive split layout breakpoint from `md:` to `lg:` to stack the override input above controls on mobile and tablet widths. Aligned button styles with the design guidelines: styled "Enable Camera" with green text/border parameters and clean icon rendering, while converting "Disable" and "Try Again" to neutral secondary treatments (`premium-btn-secondary`). |
| **Activities Completed** | Refactored padding, overflow wrappers, flex stacking layout, and color classes. Verified that all controls stack correctly, overlay contents remain scrollable without clipping, and colors match brand guidelines. Ran TypeScript checks (`npx tsc --noEmit`) and compiled the production build (`npx vite build`) with zero errors. |
| **Files / Modules Updated** | [`QuickAttendanceWebPage.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/pages/QuickAttendanceWebPage.tsx) |

---

## Issue 2: Tables Floor Plan Mobile Indentation and Stacking Optimizations

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Optimize the Tables / Floor Plan screen to resolve alignment indentation anomalies, compact vertical height on mobile viewports, and prevent text wrapping inside table action buttons. |
| **Problems Identified** | Redundant `px-4` paddings inside the sticky toolbar created a double indentation, misaligning the control elements relative to the seating grid below. The status filters and refresh actions wrapped into multiple rows, taking up half the vertical screen on mobile. Action buttons inside the table and reservation cards wrapped their text (like "Check-In" or "Assign") awkwardly due to side-by-side spacing limitations on narrow viewports. Stacked buttons inside the Inspect Drawer footer occupied excessive vertical space, shrinking the scrollable seat map on short viewports. |
| **Resolution** | Removed duplicate `px-4` class lists from the Zone Switcher tabs, total counter, and status filters containers. Replaced the status filter wrapping behavior with a swipeable, horizontally scrollable row container. Updated the action buttons of both table and reservation cards to stack vertically on mobile (`flex-col`) and arrange side-by-side on desktop (`sm:flex-row`). Grouped the `Close Session` and `Extend` drawer footer buttons in a single row (`flex-row gap-2`) to minimize vertical footprint. |
| **Activities Completed** | Refactored toolbar container padding, converted filter wrapper to horizontal scroll container, configured responsive flex direction for card action button groups, and laid out occupied table drawer options side-by-side. Verified that the toolbar aligns with the cards, the filter row scrolls smoothly on mobile, buttons do not wrap text, and drawer scrolling is comfortable. Verified syntax checking (`npx tsc --noEmit`) and compiled production build (`npx vite build`) with zero errors. |
| **Files / Modules Updated** | [`TablesPage.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/pages/TablesPage.tsx) |

---

## Issue 3: Button Icon Hover Color Visibility Bug

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Resolve a layout bug where icons inside primary buttons (like the "Add New Table" control) became invisible on hover by merging into the button's background. |
| **Problems Identified** | The CSS rules grouped hover states for all button types, forcing all icon badges (`.nav-icon-badge`) to the brand primary/gold color (`rgba(var(--glow-rgb), 1) !important`). Because primary buttons gain a solid brand background on hover, the icon color matched the background color exactly, causing the icon to merge and completely disappear. |
| **Resolution** | Split the hover icon styles in `index.css`. Maintained the colored primary icon hover behavior for secondary buttons and tabs, while forcing primary buttons (`.primary-btn`, `.premium-btn-primary`) to inherit `currentColor !important` (white text color) and a soft translucent white backdrop on hover. |
| **Activities Completed** | Refactored grouped hover icon CSS classes, separating primary button behaviors. Verified that the icon remains bright, clearly visible, and correctly colored (white) when hovering or clicking the "Add New Table" button and other primary controls. Compiled build and ran TypeScript syntax checks with zero errors. |
| **Files / Modules Updated** | [`index.css`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/styles/index.css) |

---

## Issue 4: Staff Directory Backdrop Interaction and Height Adjustments

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Resolve drawer backdrop click-to-dismiss behavior, align header action element heights, and optimize form footers for narrow mobile layouts. |
| **Problems Identified** | The modal backdrop wrapper used `pointer-events-none`, which blocked pointer events on the backdrop and made it impossible to close the Register Staff drawer by clicking outside it. The top search bar input height (`py-2`) did not match the adjacent toolbar buttons (`py-2 sm:py-2.5`), creating alignment mismatches. The drawer cancel/confirm buttons stacked vertically on mobile (`flex-col-reverse`), creating a tall footer that squished form visibility when keyboard was active. |
| **Resolution** | Removed `pointer-events-none` from the backdrop container, replaced with `cursor-pointer`, and added an `onClick` close handler. Added `onClick={e => e.stopPropagation()}` to the inner drawer card to prevent propagation. Standardized search input padding to `py-2.5` to match action buttons height. Converted the modal buttons footer from vertical stacking to a horizontal `flex-row gap-3` layout. |
| **Activities Completed** | Refactored backdrop container pointer event rules, added click handlers, standard search input heights, and horizontal button footer styles. Verified that clicking outside closes the modal drawer, the search bar aligns with buttons, and footer buttons display side-by-side on mobile. Verified syntax checks with zero errors. |
| **Files / Modules Updated** | [`StaffManagement.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/components/admin/StaffManagement.tsx) |

---

## Issue 5: Revenue Analytics Title Collision and Static Y-Axis Scaling Bug

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Resolve responsive title overlaps, correct the inaccurate static Y-axis label representations, and optimize chart minimum widths on mobile portrait screens. |
| **Problems Identified** | The chart header collapsed layouts to side-by-side at a low breakpoint (`sm:`), causing the long title text and peak summary labels to collide and wrap. The Y-axis labels (`₹100k`, `₹75k`, etc.) were hardcoded to static text, meaning they did not correspond to the actual daily revenue amounts (the height of the bars was computed dynamically relative to `maxVal`). The grid had a fixed `min-w-[500px]`, forcing horizontal scroll bars on all standard mobile screens. |
| **Resolution** | Raised the chart header layout split breakpoint from `sm:` to `md:`. Replaced the static Y-axis labels with a computed `useMemo` array that calculates axis labels dynamically from the actual maximum revenue `maxVal` using a smart `formatYLabel` formatting helper. Adjusted the chart grid layout to dynamically scale column gaps and width thresholds (`gap-2 min-w-[420px]` on mobile) to support compact screens without page-level overflows. |
| **Activities Completed** | Refactored chart header breakpoint class, added dynamic Y-axis label array formatting maps, and integrated responsive flex column and width grid sizing classes. Verified that text elements stack neatly, Y-axis labels scale to show correct currency increments, and columns fit mobile portrait screen bounds. Verified syntax checking with zero errors. |
| **Files / Modules Updated** | [`RevenueAnalyticsChart.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/components/admin/RevenueAnalyticsChart.tsx) |

---

## Issue 6: Rate Cards Backdrop Interaction and Stacking Adjustments

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Resolve Edit Rate Card modal backdrop click-to-dismiss behavior and optimize modal action footers for narrow mobile layouts. |
| **Problems Identified** | The Edit Rate Card modal backdrop used `pointer-events-none`, preventing users from dismissing the modal drawer by clicking outside it. The Cancel/Save actions in the footer stacked vertically on mobile (`flex-col-reverse`), creating a tall footer that squished form visibility when keyboard was active. |
| **Resolution** | Removed `pointer-events-none` from the backdrop container, replaced with `cursor-pointer`, and integrated an `onClick` close handler. Added `onClick={e => e.stopPropagation()}` to the inner drawer card container to prevent click propagation. Converted the modal buttons footer from vertical stacking to a horizontal `flex-row gap-3` layout. |
| **Activities Completed** | Refactored backdrop container pointer event rules, added click handlers, and set horizontal button footer styles. Verified that clicking outside closes the modal drawer, and footer buttons display side-by-side on mobile. Verified syntax checks and compiled production build with zero errors. |
| **Files / Modules Updated** | [`RateManagement.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/components/admin/RateManagement.tsx) |

---

## Issue 7: Customer Sessions Backdrop Interaction and Mobile Footer Optimizations

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Resolve modal backdrop click-to-dismiss behavior for all three overlay panels and optimize input action row heights and stacking for narrow mobile screens. |
| **Problems Identified** | The Extend, Close, and View History modals blocked pointer clicks on backdrops, preventing close actions when users clicked outside. The search bar input height (`py-2`) was shorter than other action tools. Extend and Close modal footers stacked Cancel and Submit buttons vertically on mobile, hiding inputs when keyboards were active. |
| **Resolution** | Integrated click-to-dismiss handlers and `cursor-pointer` to backdrops of all three modals (Extend, Close, View History) and intercepted click events via propagation stoppers inside cards. Standardized search padding to `py-2.5`. Converted action footers from vertical stacking to horizontal `flex-row gap-3` layouts on mobile. |
| **Activities Completed** | Refactored backdrop element events, click-propagation stoppers, input padding heights, and responsive flex styling properties. Verified that clicking outside closes all modals, search bar aligns, and footers display side-by-side. Verified syntax checking and builds with zero errors. |
| **Files / Modules Updated** | [`CustomerSessionsManager.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/components/admin/CustomerSessionsManager.tsx) |

---

## Issue 8: Customer Details Data Integrity Mismatch

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Resolve the customer data-mapping mismatch on the Customer Sessions manager page and display all customer profile attributes correctly in the UI. |
| **Problems Identified** | The backend `/admin/sessions` endpoint returned customer details as flat root-level keys (`customerName`, `phoneNumber`, `email`). However, the frontend expected a nested `customer: { name, phoneNumber, email }` object, resulting in empty/undefined displays (`Walk-in Guest`, `N/A`) and missing fields in the Session Audit History details modal. Furthermore, the details overview modal lacked grid cells to render `Email Address` and `Issued By` properties. |
| **Resolution** | Updated the `getAllSessions()` API response mapper in `api.ts` to map the flat properties (`customerName`, `phoneNumber`, `email`) into the nested `customer` object expected by the UI components (aligning with `getActiveTokens()`), as well as mapping `personsCount`, `redemptionsUsed`, and `totalRedemptionsAllowed` fields correctly. Modified `CustomerSessionsManager.tsx` to add `Email Address` and `Issued By` (creator metadata) cells to the Session Overview card grid. |
| **Activities Completed** | Refactored API client data mappers and added grid elements in the customer session history details modal view. Verified that customer name, contact details, email address, and metadata populate correctly without losing audit records. Verified syntax checks and builds compile with zero errors. |
| **Files / Modules Updated** | [`api.ts`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/services/api.ts), [`CustomerSessionsManager.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/components/admin/CustomerSessionsManager.tsx) |

---

## Issue 9: Dashboard End-to-End Data Integration

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Connect the system overview dashboard KPI cards, hourly analytics charts, and recent activities streams to the live production database endpoints. |
| **Problems Identified** | The dashboard page KPIs (`Avg Checkout`, `Drink Conversion`, `Peak Seating`) were hardcoded to `--` placeholder values. The `revenueTrends` chart used an empty hardcoded array with static Y-axis limits (`₹60k` maximum scale boundary), making it impossible to see actual daily sales trends. There was no live audit stream endpoint in the database for operator activities. Additionally, the backend `/reports/dashboard` and `/reports/hourly-breakdown` responses lacked calculated hourly revenue records. |
| **Resolution** | Integrated the typed `getDashboardReport()` method to fetch `/reports/dashboard` data. Added dynamic calculations for Average Checkout, Drink Conversion, and Peak Seating using actual backend response attributes. Modified backend `routes.ts` to calculate and return hourly revenue (`revenue`) for checked-in tokens. Configured dynamic Y-axis boundaries and exact tooltips inside the chart module. Reconstructed a real-time recent activities feed by merging and sorting chronological check-in, checkout, and extension events from `allSessions` logs. |
| **Activities Completed** | Appended hourly revenue fields to backend reports API endpoints. Refactored dashboard page to fetch reports data on mount/refresh, map dynamic KPIs, scale chart bounds, and render real-time database-driven activities. Verified build compilation and TypeScript checks with zero errors. |
| **Files / Modules Updated** | [`routes.ts`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/backend/src/routes.ts), [`api.ts`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/services/api.ts), [`types/index.ts`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/types/index.ts), [`DashboardPage.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/pages/DashboardPage.tsx) |
