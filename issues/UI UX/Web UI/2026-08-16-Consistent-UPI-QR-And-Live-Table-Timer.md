# Daily Technical & Architectural Issues Log — August 16, 2026

---

## Issue 11: Consistent UPI Payment QR Flow Integration

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Unified payment confirmation screens and simulated UPI QR code inline display |
| **Problems Identified** | Previously, the Extend Session modal utilized a complex, multi-step wizard workflow that separated the payment method selection from duration selection, leading to unnecessary clicks and potential receptionist confusion. Concurrently, the Check-In page lacked a visual inline UPI QR code representation when UPI was selected, making payment simulation behaviors inconsistent across receptionist workflows. |
| **Resolution** | Refactored the Extend Session modal into a streamlined, single-step modal, completely removing the obsolete `showExtensionUpiQr` multi-step state. Integrated the simulated UPI QR code component inline directly below the Payment Method dropdown selection when `UPI` is selected, using the computed extension amount in the QR pay URL. Added the identical inline UPI QR code component to Stage 4 of the Check-In page, dynamically showing or hiding it when the receptionist selects the `UPI` or `Cash` payment modes respectively. |
| **Activities Completed** | Refactored forms, unified UI layout components, verified proper hide/show toggles, tested clean form submissions, and validated compiler builds. |
| **Files / Modules Updated** | `web-frontend/src/pages/TablesPage.tsx`, `web-frontend/src/pages/CheckInPage.tsx` |

---

## Issue 12: Real-Time Occupied Table Timer and 10-Minute Expiry Alerts Engine

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Seating floor plan countdown timers, global session expiry alert popups, dashboard alerts synchronization, and background clock offsets |
| **Problems Identified** | Receptionists and managers lacked real-time visibility into the remaining session times of occupied tables, relying on manual clock calculations. Furthermore, the system lacked visual or auditory notifications to alert staff when a table was approaching its session limit, which restricted turnover efficiency. |
| **Resolution** | Built a centralized timer and alert engine in `DataContext.tsx` executing a 1-second countdown interval. Fetched/refreshed tokens and tables every 10 seconds to synchronize state across multiple clients. Isolated the timer UI into a dedicated `<TableTimer />` component to avoid parent component re-renders. Triggered a floating application-level popup notifications stack at the top center of the viewport and merged warnings into the Dashboard's Live Alerts section, allowing a single consistent dismiss action. Integrated a native double-beep audio chime using the Web Audio API to play exactly once per alert event. |
| **Activities Completed** | Created central timers, mapped missing date-time keys in active tokens API, isolated card timers, designed popup notifications, unified alert list panels, typechecked both projects, and ran clean production builds. |
| **Files / Modules Updated** | `web-frontend/src/context/DataContext.tsx`, `web-frontend/src/pages/TablesPage.tsx`, `web-frontend/src/pages/DashboardPage.tsx`, `web-frontend/src/App.tsx`, `web-frontend/src/services/api.ts` |

---

## Issue 13: Occupied Table Card Live Timer Visual Prominence Enhancement

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Table card countdown timer visual alignment and styling enhancement |
| **Problems Identified** | The live countdown timer was rendered as basic secondary text, failing to capture visual attention for receptionists monitoring table allocations. |
| **Resolution** | Wrapped the "Time Remaining" block on occupied tables in a highlighted, theme-compatible container box with background shading (`bg-bg-secondary-surface dark:bg-black/25`), customized borders (`border border-border-main/60`), and bolder, larger typography (`text-[13px] font-black`), ensuring readability while preserving the desktop layout hierarchy. |
| **Activities Completed** | Modified occupied layout elements, updated css borders and padding, verified theme toggling, and ran production builds successfully. |
| **Files / Modules Updated** | `web-frontend/src/pages/TablesPage.tsx` |

---

## Issue 14: Dynamic Session Durations and Minutes-Based Admin Rate Customization

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Seating category default session durations, Extend options, and admin rate settings |
| **Problems Identified** | Session durations were hardcoded to 120 and 180 minutes, which were too long for testing or quick rotations, and the admin Rate Management panel only allowed duration edits in fractional hours, which blocked setting the new minute-based configurations. |
| **Resolution** | Updated the database seeding configuration and upserted standard bar to 20 minutes and premium lounge to 30 minutes. Modified check-in fallback structures, receipts, and comparative options to show allocations in Minutes rather than Hours. Converted the admin Rate Management input field and state from Hours to Minutes, allowing inputs from 5 to 1440 minutes. |
| **Activities Completed** | Updated database seeding configuration, updated check-in fallbacks, modified extend modals, verified timezone-agnostic calculations, and ran production builds successfully. |
| **Files / Modules Updated** | `backend/prisma/seed.ts`, `web-frontend/src/pages/CheckInPage.tsx`, `web-frontend/src/services/api.ts`, `web-frontend/src/pages/TablesPage.tsx`, `web-frontend/src/pages/DashboardPage.tsx`, `web-frontend/src/components/admin/CustomerSessionsManager.tsx`, `web-frontend/src/components/admin/RateManagement.tsx` |
