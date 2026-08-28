# Daily Technical & Architectural Issues Log — August 21, 2026

---

## Issue 1: Unified Session Extension Modal Integration

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Centralize the session extension workflows across all dashboard and table management modules into a single, cohesive, theme-compliant dialog. |
| **Problems Identified** | Extending customer sessions was implemented using duplicate inline forms and modals on the Dashboard, Tables Page, and Customer Sessions Manager. This code duplication led to inconsistent behaviors, custom styling variations, and different payment validations. There were no steppers for custom duration, and touch targets on mobile were small. |
| **Resolution** | Refactored the unified `ExtendSessionModal.tsx` to handle predefined times (`20`, `25`, `30` minutes) and a brand new "Custom Duration" option. Added comfortable Hours and Minutes numeric steppers (`0-24` hours, `0-59` minutes) with rollover support (e.g. going up on 59 minutes increments hours, going down on 0 minutes decrements hours). Cleaned up the other three modules by removing their duplicate state variables, methods, and markup, pointing them strictly at this unified modal. Added double-submit protection by disabling button actions during API calls. |
| **Activities Completed** | Refactored `ExtendSessionModal.tsx`, `DashboardPage.tsx`, `TablesPage.tsx`, and `CustomerSessionsManager.tsx` to integrate the centralized modal. Verified responsive layout wrapping, input constraints, button states, and theme styling across mobile, tablet, and desktop views. Checked clean TypeScript compilations (`npx tsc --noEmit`) with zero errors. |
| **Files / Modules Updated** | [`ExtendSessionModal.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/components/modals/ExtendSessionModal.tsx), [`DashboardPage.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/pages/DashboardPage.tsx), [`TablesPage.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/pages/TablesPage.tsx), [`CustomerSessionsManager.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/components/admin/CustomerSessionsManager.tsx) |

---

## Issue 2: Live Session Countdown Timer at Bartender Service Station

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Add a real-time countdown timer to the active cards on the Bartender Service Station to show remaining session duration to operators. |
| **Problems Identified** | The active card layouts on the Bartender Service Station only showed the session duration since check-in, but lacked a countdown timer indicating when the customer's session would expire. Operators had to manually refresh the page or compute the time remaining, leading to checkout delays. |
| **Resolution** | Implemented a lightweight, self-cleaning `LiveSessionTimer` React component inside `BartenderPage.tsx`. The component uses `setInterval` to recalculate remaining time relative to the authoritative database `endTime` once per second. Displays time remaining as `HH:MM:SS` (if >= 1 hour remains) or `MM:SS` (< 1 hour remains). Integrates active token state updates so that extending a session reactively extends the countdown immediately. Handles `Expired` and `Closed` states properly, and performs automatic cleanup of intervals on component unmount to prevent memory leaks. |
| **Activities Completed** | Created the `LiveSessionTimer` component in `BartenderPage.tsx` and embedded it under "Session Duration" on active customer cards. Verified that countdowns are accurate, react to database updates immediately, and do not cause redundant API polling. Checked TypeScript checks with zero errors. |
| **Files / Modules Updated** | [`BartenderPage.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/pages/BartenderPage.tsx) |

---

## Issue 3: Backend Authoritative Custom Pricing & Sync Audit Logs

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Update the token extension route and database logic to support custom duration overrides and persist audit metadata. |
| **Problems Identified** | The backend session extension service (`TokenService.extendToken`) recalculates the extension fee from place-type configs, overriding any user-provided custom amount. This made it impossible to charge custom rates. In addition, there was no way to accept or store custom extension reasons or identify custom vs. predefined extensions in database sync audit logs. |
| **Resolution** | Updated `TokenService.extendToken` to accept optional `extensionType` and `reason` parameters. If `extensionType === 'CUSTOM'`, the place type rate-card calculation is bypassed, treating the provided `additionalAmount` as authoritative. Persisted these fields inside the JSON `payload` of `SyncLog` database entries under the `TOKEN_EXTENSION` operation type for audit purposes. |
| **Activities Completed** | Updated signature and logic in `TokenService.ts` and `routes.ts`, and updated frontend `api.ts`. Created a temporary integration test runner to verify predefined and custom extensions (e.g. 73 minutes for ₹250 with custom reason), confirming proper database persistence. Cleanly deleted the temporary test script on success. Verified syntax checks with zero errors. |
| **Files / Modules Updated** | [`TokenService.ts`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/backend/src/services/TokenService.ts), [`routes.ts`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/backend/src/routes.ts), [`api.ts`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/services/api.ts) |

---

## Issue 4: ExtendSessionModal Null Pointer Safeguard

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Resolve a frontend crash causing a blank screen when the ExtendSessionModal is initialized with a null token. |
| **Problems Identified** | When the modal is closed or opening, the parent components pass `null` as the `token` parameter. Although there was an early exit (`if (!isOpen) return null`), the top-level calculations for rates and amounts executed before the return statement, attempting to read `placeTypeId` and `personsCount` from a null object, resulting in a TypeError and a blank screen crash. |
| **Resolution** | Refactored `ExtendSessionModal.tsx` to support `token: Token | null` inside its interface. Added optional chaining (`token?.placeTypeId` and `token?.personsCount`) for all top-level evaluations. Modified the early exit condition to check if `token` is null or undefined (`if (!isOpen || !token) return null`), preventing any rendering or evaluation crashes. |
| **Activities Completed** | Updated the component interface, implemented optional chaining, and updated early return conditions. Verified that navigating to Dashboard, Tables, and Customer Sessions displays the UI correctly and opening/closing modals works without console errors or screen blanking. Verified syntax checks with zero errors. |
| **Files / Modules Updated** | [`ExtendSessionModal.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/components/modals/ExtendSessionModal.tsx) |

---

## Issue 5: Tables Page ReferenceError in Unused Modal Markup

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Resolve a frontend ReferenceError crash in `TablesPage.tsx` caused by a residual unused email confirmation modal markup block. |
| **Problems Identified** | When refactoring `TablesPage.tsx` to point all session extensions to the centralized modal, duplicate state variables and hooks were deleted. However, a residual HTML markup block for the confirmation email modal (`showEmailConfirmModal`) remained at the bottom of the page file. When the page rendered, it attempted to read the deleted states `showEmailConfirmModal`, `emailYesButtonRef`, and `setSendExtensionEmail`, causing a ReferenceError crash and blanking the screen. |
| **Resolution** | Completely deleted the unused residual markup block for `showEmailConfirmModal` from the bottom of `TablesPage.tsx`. |
| **Activities Completed** | Removed the HTML block, verified that the page loads cleanly, and confirmed there are no console errors or uncaught reference bugs. Checked typescript compilation checks with zero errors. |
| **Files / Modules Updated** | [`TablesPage.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/pages/TablesPage.tsx) |

---

## Issue 6: Dashboard Session Revenue Data Source Bug

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Correct the Dashboard Session Revenue KPI card display to represent total daily sales rather than currently active in-house session sales. |
| **Problems Identified** | The Session Revenue KPI metric on the dashboard was calculated from the `tokens` array by summing the `amountPaid` for all active and pending in-house tokens. As a result, the revenue value excluded all closed/completed sessions and earlier check-ins from the current day. |
| **Resolution** | Updated the `totalRevenue` constant in `DashboardPage.tsx` to read the daily sales total directly from the authoritative backend dashboard report payload (`reportData.salesSummary.todaySales`) instead of local array reductions. |
| **Activities Completed** | Modified the calculation variable, verified that it updates dynamically on refresh, and validated compile checks with zero errors. |
| **Files / Modules Updated** | [`DashboardPage.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/pages/DashboardPage.tsx) |

---

## Issue 7: Dashboard KPI Analytics Summary Loading Consistency

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Standardize the loading state UI across all cards in the dashboard KPI Analytics Summary section. |
| **Problems Identified** | The **QR Pass Active** card immediately rendered a hardcoded value of `0` during initial load/fetching, while other adjacent cards (Avg Checkout, Drink Conversion, Peak Seating) correctly rendered loading indicators (`...`). This resulted in inconsistent layout states and misleading initial numbers. |
| **Resolution** | Modified `qrPassActiveDisplay` in `DashboardPage.tsx` to conditionally display `...` if either the dashboard report (`isReportLoading`) or the primary data context (`isLoading`) is in progress. Once loading is complete, the true count of active passes (`activeTokensCount`) is displayed. |
| **Activities Completed** | Updated loading checks, verified visual consistency on page refresh, and ran frontend typescript check with zero compilation errors. |
| **Files / Modules Updated** | [`DashboardPage.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/pages/DashboardPage.tsx) |

---

## Issue 8: Hourly Chart Tooltip DOM Leak & Visibility Bug

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Correct the Hourly Revenue Analytics chart tooltip rendering to prevent hidden values from leaking in text streams and the DOM tree. |
| **Problems Identified** | The hourly bar tooltips showing the numerical revenue values (e.g. `₹0`, `₹46,250`) were toggled using only CSS opacity (`opacity-0 group-hover:opacity-100`). As a result, the tooltips remained in the document flow, causing the hidden values to leak into text-extractors, screen readers, and copy-paste selection targets in an unformatted linear sequence. |
| **Resolution** | Replaced the opacity toggling behavior in `DashboardPage.tsx` with display toggling (`hidden group-hover:block`), ensuring that tooltips are completely removed from the DOM rendering tree when the user is not actively hovering over the specific column bar. |
| **Activities Completed** | Replaced the class selectors, verified hover interaction and formatting remain correct, and verified that build compilation is clean with zero errors. |
| **Files / Modules Updated** | [`DashboardPage.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/pages/DashboardPage.tsx) |

---

## Issue 9: Dashboard Live System Alerts Overlap and Squishing Bug

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Optimize the Live System Alerts panel card elements for responsive mobile layouts and overlap prevention. |
| **Problems Identified** | The **Dismiss** button used absolute positioning (`absolute right-3 bottom-3`), which frequently caused text overlaps on narrow mobile viewports. To prevent button collision, the adjacent content block used a wide static right padding (`pr-14`), reducing text area and squishing text wrap on 320px–360px viewports. |
| **Resolution** | Refactored each alert card to use a responsive flex container (`flex flex-col sm:flex-row justify-between items-start sm:items-center`). Removed the absolute positioning on the button and the `pr-14` padding on the text wrapper. On mobile, the Dismiss button stacks naturally below the alert content as a full-width block, while it remains side-by-side on larger desktop screens. |
| **Activities Completed** | Refactored the container elements and button styles, verified correct positioning across all viewport widths, and checked that TypeScript compilation is clean with zero errors. |
| **Files / Modules Updated** | [`DashboardPage.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/pages/DashboardPage.tsx) |

---

## Issue 10: Dashboard Broken Tailwind Shadow Syntax Bug

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Correct syntax errors inside dynamic glow styling indicator elements on the dashboard. |
| **Problems Identified** | The glowing timeline indicator dot in the Recent Live Activities card and the Live Overview indicator dot in the dashboard header contained malformed shadow utility parameters (`0_0_8px_rgba(...)`). Because they lacked the leading `shadow-[` wrapper, they were unrecognized by the Tailwind compiler, preventing the glowing shadows from displaying. |
| **Resolution** | Updated the class definitions of both indicator elements in `DashboardPage.tsx` to prepended the correct `shadow-[` syntax prefix (e.g. `shadow-[0_0_8px_rgba(212,175,55,0.6)]`). |
| **Activities Completed** | Replaced the broken styling selectors, verified green and gold glow shadows compile and render correctly, and verified that build checks are clean with zero errors. |
| **Files / Modules Updated** | [`DashboardPage.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/pages/DashboardPage.tsx) |

---

## Issue 11: Dashboard Live Customer Sessions Missing Countdown Timer

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Integrate a real-time countdown remaining timer in the Live Customer Sessions table on the System Dashboard. |
| **Problems Identified** | The **Live Customer Sessions** table on the dashboard listed active tokens and status indicators but did not display the time remaining for each active guest. Operators had to manually inspect tables or open checkout/extend modals to see remaining session time, leading to checkout bottlenecks. |
| **Resolution** | Declared the reusable `LiveSessionTimer` helper component inside `DashboardPage.tsx`. Added a new **Time Left** column in the sessions table headers and rendered the dynamic `LiveSessionTimer` element inside a matching cell. |
| **Activities Completed** | Declared the timer component, added headers and table cells, verified that the timer countdown is accurate, updates dynamically when sessions are extended, and clean TypeScript compilation checks with zero errors. |
| **Files / Modules Updated** | [`DashboardPage.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/pages/DashboardPage.tsx) |
