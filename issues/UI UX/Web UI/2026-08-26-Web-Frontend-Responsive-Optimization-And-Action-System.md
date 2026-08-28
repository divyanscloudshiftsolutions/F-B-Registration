# Daily Technical & Architectural Issues Log — August 26, 2026

---

## Issue 1: Bartender Check-ins In-Place Micro-Update & Live Reconciliation UX Fix

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Bartender drink service station redemption and revert workflow optimization to achieve smooth, flicker-free live updates without disrupting scroll position or list order. |
| **Problems Identified** | When bartenders redeemed or reverted drinks on a check-in card, the entire customer session list re-rendered from scratch, causing cards to jump, visual flicker, and scroll position loss. |
| **Resolution** | Implemented `silentMergeTokens` in-place reconciliation that updates token object properties without altering the array reference or re-sorting unaffected items. Wrapped numerical counters in an `<AnimatedNumber />` component with scale-110 micro-transitions and added `transition-[width] duration-300 ease-out` on the drink progress bar. |
| **Activities Completed** | Replaced full-list re-renders with background reconciliation (`fetchActiveTokens(true)`), tested rapid multi-drink redemptions and single-drink reverts, and verified smooth progress bar animation across all viewport sizes. |
| **Files / Modules Updated** | `web-frontend/src/pages/BartenderPage.tsx` |

---

## Issue 2: Occupied Table Side Panel Customer Metadata & Email ID Integration

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Seating floor plan and table inspection side panel enhancement to display complete customer contact details for active dining sessions. |
| **Problems Identified** | Clicking an occupied table opened the inspection side drawer, but customer email address was missing from the summary drawer, forcing staff to navigate to Customer Sessions to verify guest identity. |
| **Resolution** | Integrated Customer Email ID (`inspectingToken.customer?.email || '—'`) into the customer metadata section alongside Name, Phone Number, Headcount, Session Token ID, and Duration. |
| **Activities Completed** | Added structured metadata cards in both Floor Plan (`TablesPage.tsx`) and Admin Table Floor Management (`TableManagement.tsx`), verified text truncation for long email addresses with tooltip hover support. |
| **Files / Modules Updated** | `web-frontend/src/pages/TablesPage.tsx`, `web-frontend/src/components/admin/TableManagement.tsx` |

---

## Issue 3: Responsive Mobile-First Toast Alert & Session Warning Positioning

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Global notification and toast alert positioning optimization for seamless visibility across mobile phones, tablets, and desktop workstations. |
| **Problems Identified** | Global toast notifications and session expiry popups rendered in the bottom-right corner across all viewports. On mobile screens (< 640px), bottom-positioned toasts obstructed critical bottom navigation, drawer action buttons, and keyboard controls. |
| **Resolution** | Configured responsive positioning in `App.tsx`: positioned toasts at `fixed top-4 inset-x-4 z-[120]` on mobile (< 640px) and `sm:bottom-4 sm:right-4` on desktop/laptop. Positioned session expiry warning banners at `top-3 sm:top-4 inset-x-3 sm:inset-x-auto`. |
| **Activities Completed** | Verified toast notifications on small screens (320px–430px) and confirmed they no longer block drawer actions or bottom navigation while remaining cleanly anchored on desktop. |
| **Files / Modules Updated** | `web-frontend/src/App.tsx` |

---

## Issue 4: Application-Wide Manual Data Refresh Controls Responsive Alignment

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Alignment, sizing, and placement standardization of manual data refresh/sync icons across all 8 web frontend views. |
| **Problems Identified** | Refresh controls had inconsistent styling and awkward wrapping on mobile viewports—some appeared with full text labels while others were misaligned against filter toolbars. |
| **Resolution** | Standardized all manual refresh controls to icon-only circular/rounded buttons (`w-9 h-9 sm:w-8 sm:h-8`) with rotating loading spin animation (`isRefreshing ? 'animate-spin' : ''`), touch-friendly tap targets, and pinned toolbar positioning. |
| **Activities Completed** | Aligned refresh buttons across Global Header, Executive Dashboard, Customer Sessions Manager, Rate Management, Staff Directory, Table Management, Tables Floor Plan, and Bartender Drink Station. |
| **Files / Modules Updated** | `web-frontend/src/components/layout/Header.tsx`, `web-frontend/src/pages/DashboardPage.tsx`, `web-frontend/src/components/admin/CustomerSessionsManager.tsx`, `web-frontend/src/components/admin/RateManagement.tsx`, `web-frontend/src/components/admin/StaffManagement.tsx`, `web-frontend/src/components/admin/TableManagement.tsx`, `web-frontend/src/pages/TablesPage.tsx`, `web-frontend/src/pages/BartenderPage.tsx` |

---

## Issue 5: Temporal Dead Zone Initialization Fix in Reception Check-In Wizard

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Runtime stability and keyboard listener lifecycle correction in Reception Check-In Wizard. |
| **Problems Identified** | Initializing keyboard event listener `useEffect` hooks before declaring dependent state variables (`selectedTableObj`, `handleKeepTable`) caused runtime `ReferenceError: Cannot access 'selectedTableObj' before initialization` crashes during stage transitions. |
| **Resolution** | Reordered component lifecycle definitions, placing keyboard event listeners (`handleCapacityKeyDown`, `handlePaymentConfirmKeyDown`, `handleStageKeyDown`, `handleDraftKeyDown`) strictly after all variable and handler definitions. |
| **Activities Completed** | Tested end-to-end Check-In wizard progression across all 5 stages, verified keyboard Enter/Escape shortcuts, and confirmed zero console TDZ exceptions. |
| **Files / Modules Updated** | `web-frontend/src/pages/CheckInPage.tsx` |

---

## Issue 6: Standardized Semantic Color Palette for Seating Action Controls

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Action button styling and semantic color hierarchy standardization across table floor plan cards, inspection drawers, and confirmation modals. |
| **Problems Identified** | Table action buttons had ambiguous or conflicting visual styles (e.g. blue for release/cancel, generic outlines for extend/lock), creating confusion between destructive and constructive actions. |
| **Resolution** | Implemented brand-consistent semantic color hierarchy conforming to `.agents/AGENTS.md`: `Release Table` & `Delete Table` (Crimson Red), `Extend Session` (Brand Purple), `Edit Table` (Indigo), `Clear Reservation` (Rose Coral), `Lock Table` (Amber Gold), and `Unlock Table` (Emerald Green). |
| **Activities Completed** | Applied updated button classes across table card action rows, inspection side panels, and modal action footers in both `TableManagement.tsx` and `TablesPage.tsx`. Verified light/dark mode contrast ratios. |
| **Files / Modules Updated** | `web-frontend/src/components/admin/TableManagement.tsx`, `web-frontend/src/pages/TablesPage.tsx` |

---

## Issue 7: Workstation Login & Global Navigation Shell Responsive Optimization

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Mobile (320px–639px), tablet (640px–1023px), and desktop (1024px+) responsive optimization of the Workstation Login gateway, navigation sidebar, and application header shell. |
| **Problems Identified** | On small mobile viewports (320px–360px), login padding cramped the card layout, input font sizes caused mobile browser viewport zoom, header titles collided with action icons, and sidebar sub-item navigation required manual backdrop dismissal. |
| **Resolution** | Refined `LoginPage.tsx` with `p-3 sm:p-6 lg:p-12` outer padding, 16px (`text-base md:text-sm`) input sizing to prevent mobile zoom, and `min-h-[44px]` touch targets. Sized header titles with `text-base sm:text-xl md:text-2xl truncate` and bounded notification dropdowns to `inset-x-3`. Implemented auto-closing mobile sidebar drawer upon navigation selection. |
| **Activities Completed** | Tested on 320px (iPhone SE), 360px, 390px, 430px, 768px (iPad portrait), 820px (iPad Air), 1024px, and 1280px+. Verified `npx tsc --noEmit` compiled with Code 0. |
| **Files / Modules Updated** | `web-frontend/src/pages/LoginPage.tsx`, `web-frontend/src/components/layout/Header.tsx`, `web-frontend/src/components/layout/Sidebar.tsx`, `web-frontend/src/App.tsx` |

---

## Issue 8: Bartender Check-in Session Card Mobile & Tablet Responsive Redesign

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Complete responsive redesign of active customer check-in session cards on the Bartender Service Station to provide high operational density and fast drink redemption on mobile and tablet devices. |
| **Problems Identified** | Below the `1280px` (`xl`) breakpoint, customer session cards stacked vertically into 4 bulky sections, reaching ~460px–480px in height. A single card consumed nearly 80% of the mobile screen, requiring excessive scrolling to locate and operate active guest sessions. |
| **Resolution** | Implemented a **Hybrid Operational Density Card with Progressive Disclosure**: restructured the default mobile view into a compact 3-row layout (~160px default height, a 65% reduction) keeping Table Badge, Customer Name, Live Countdown Timer, Drink Balance Gauge, Quantity Stepper (`−`, `[ qty ]`, `+`), `REDEEM`, `REVERT`, `EXTEND`, `SCAN`, and `CHECKOUT` immediately visible with 44px touch targets. Enclosed secondary reference metadata (Phone, Email, Party Headcount, Check-in timestamp, Gate payment amount, and Carried-Forward breakdown) in an accordion drawer toggled via `[ ▾ INFO / ▴ HIDE ]`. On tablets (640px–1279px), formatted cards into a balanced 2-column grid (`grid-cols-1 md:grid-cols-2 xl:grid-cols-1`). |
| **Activities Completed** | Integrated stable `expandedCardIds` state, verified responsive rendering across 320px, 360px, 390px, 430px, 640px, 768px, 820px, 1024px, and 1280px+ (desktop horizontal baseline intact), and confirmed `npx tsc --noEmit` passed with 0 errors across frontend and backend. |
| **Files / Modules Updated** | `web-frontend/src/pages/BartenderPage.tsx` |

