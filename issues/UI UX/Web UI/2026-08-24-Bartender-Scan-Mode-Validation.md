# Daily Issues & Fixes Log — 2026-08-24

This report logs the technical resolution of the Bartender Check-In Scan Mode audit and correction, introducing state-aware token verification, locking drink redemptions on expired or completed passes, and verifying camera stream cleanup rules.

---

## Issue 1: Bartender Scan Mode Status Awareness and Quota Locks

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Correct the Bartender station QR scanner summary screen to validate token status and block unauthorized actions. |
| **Problems Identified** | The verified pass summary card in the Scan tab defaulted the status badge to `ACTIVE PASS` regardless of the session state (e.g. `EXPIRED` or `COMPLETED` tokens). This exposed active "Dispense" buttons, allowing bartenders to attempt redemptions on expired passes which would then fail at the API level. |
| **Resolution** | Refactored `BartenderPage.tsx` to read the token's true `status` field and normalize it. Added a "Redemption Blocked" alert banner for inactive statuses, and bound it to disable Plus/Minus quantity buttons, Dispense buttons, and Revert buttons. |
| **Activities Completed** | Coded dynamic status badges (`ACTIVE PASS`, `EXPIRED PASS`, `COMPLETED PASS`, `CANCELLED PASS`), implemented button disabling hooks, verified error banners, and ran compilation verification. |
| **Files / Modules Updated** | [`BartenderPage.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/pages/BartenderPage.tsx) |

---

## Issue 2: Webcam Lifecycle & Resource Cleanup

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Ensure camera stream resources are fully released when closing or navigating away from the scanner view. |
| **Problems Identified** | Failing to completely stop all tracks from active media streams when switching tabs or closing modals can cause memory leaks and leave the browser's camera active indicator light on. |
| **Resolution** | Audited the `stopCamera` helper inside `BartenderPage.tsx`. Verified it iterates over all tracks in both `activeStreamRef` and `videoRef.current.srcObject` and calls `track.stop()`, and stops the canvas render frame animation loop. |
| **Activities Completed** | Verified camera cleanups on unmounting, switching tabs, and clicking cancel/stop. |
| **Files / Modules Updated** | [`BartenderPage.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/pages/BartenderPage.tsx) |

---

## Issue 3: Session Expiry Navigation Reset on Refresh

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Retain the current active tab/page across browser refreshes. |
| **Problems Identified** | On page reload, the authentication state is temporarily `user: null` while loading credentials from `localStorage`. This caused `App.tsx` to immediately overwrite the active tab and reset it to `'dashboard'` before automatic login finished. |
| **Resolution** | Destructured `isLoading` from `useAuth` and added a loading guard. Modified the tab reset effect to only clear activeTab when loading is complete and the user is fully logged out. |
| **Activities Completed** | Updated `App.tsx` state checks, verified compilation, and verified refresh navigation. |
| **Files / Modules Updated** | [`App.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/App.tsx) |

---

## Issue 4: Session Extension / Table Occupancy / Redemption Desync

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Ensure table occupancy and active logs are preserved or restored on session extensions. |
| **Problems Identified** | If a session expired chronologically and was then extended, the token `endTime` was updated and status set to `EXTENDED`, but the table remained `available`, `currentTokenId` remained `null`, and active logs remained closed. Additionally, cache keys were not invalidated. |
| **Resolution** | Refactored `TokenService.extendToken` to force token status to `EXTENDED`. Added dynamic table occupancy updates to restore `'occupied'` status, bind `currentTokenId`, resume `tableOccupancyLog`, and clear all related Redis caches. |
| **Activities Completed** | Updated `TokenService.ts`, compiled successfully, and verified table restoration flows. |
| **Files / Modules Updated** | [`TokenService.ts`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/backend/src/services/TokenService.ts) |

---

## Issue 5: Tablet Session Table Width & Action Clipping

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Correct the Live Customer Sessions table to ensure columns and buttons remain fully accessible on tablet viewports. |
| **Problems Identified** | The table forced a large minimum width without adequate containment, causing the critical checkout/extension actions to overflow and clip on constrained tablet screen layouts. |
| **Resolution** | Wrapped the session table in a scrollable panel wrapper (`overflow-x-auto custom-scrollbar`) to preserve layout container bounds. |
| **Activities Completed** | Coded the wrapper divs, verified containment behavior, and confirmed touch navigation accessibility on tablet sizes. |
| **Files / Modules Updated** | [`DashboardPage.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/pages/DashboardPage.tsx) |

---

## Issue 6: Seating Peaks SVG X-Axis Label Truncation

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Clean up SVG X-axis label formatting to avoid overlapping and text truncation. |
| **Problems Identified** | Displaying all 24 hourly labels on a small chart width forced browser font rendering limits, truncating labels into meaningless single-character digits (e.g. `1 1 2 3 ...`). |
| **Resolution** | Refactored the labels map to render text only on 4-hour tick marks (`12 AM`, `4 AM`, `8 AM`, `12 PM`, `4 PM`, `8 PM`), leaving other indexes as empty spans to preserve alignment under nodes. |
| **Activities Completed** | Modified chart map ticks, tested mobile grid display widths, and verified clean typography alignment. |
| **Files / Modules Updated** | [`DashboardPage.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/pages/DashboardPage.tsx) |

---

## Issue 7: Invisible CSV Export Button Label Contrast

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Ensure button text on primary dashboard elements remains legible. |
| **Problems Identified** | The Export CSV button text default color collided with the gold background, rendering it invisible under dark mode. |
| **Resolution** | Forced explicit high-contrast text color overrides (`text-black dark:text-black`) on primary buttons to ensure visibility. |
| **Activities Completed** | Updated button CSS color classes and verified legibility across dark/light themes. |
| **Files / Modules Updated** | [`RevenueAnalyticsChart.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/components/admin/RevenueAnalyticsChart.tsx) |

---

## Issue 8: Dashboard Chart Data Desync on Session Updates

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Synchronize bottom analytics charts with live operational transactions in real time. |
| **Problems Identified** | Report data was only fetched on initial dashboard mount. Operational updates (check-ins, checkouts, or extensions) did not trigger refreshes, causing charts to remain static or blank until browser refresh. |
| **Resolution** | Added `tokens` to the `useEffect` dependency array in `DashboardPage.tsx` to automatically trigger report refetches on session updates. |
| **Activities Completed** | Updated dependency arrays, verified automatic update propagation, and confirmed type safety. |
| **Files / Modules Updated** | [`DashboardPage.tsx`](file:///d:/Cloud%20Shift%20Solutions%20Intern/NFC/NFC%20QR%20code/web-frontend/src/pages/DashboardPage.tsx) |
