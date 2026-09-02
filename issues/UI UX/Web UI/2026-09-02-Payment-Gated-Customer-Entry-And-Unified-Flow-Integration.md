# Daily Technical & Architectural Issues Log — September 2, 2026

---

## Issue 1: Payment-Gated Customer Access & Secure Access Link Verification System

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Transitioning customer access from a physical-table-display hardware dependency to a mobile-first, email-delivered access pass architecture with server-side payment verification. |
| **Problems Identified** | Previously, the customer ordering interface lacked strict server-side payment gating prior to catalog and cart access; accessing tokens without verified cover charge could bypass entry fees. Physical tablet display on every table was an impractical hardware overhead for dynamic bar environments. |
| **Resolution** | Implemented `CustomerAccessPage` and authoritative backend validation `GET /api/customer/access/:tokenNumber` and `POST /api/customer/recover`. Enforced `paymentVerified === true` verification gate with distinct UI states (`VERIFYING`, `PAYMENT_PENDING`, `SESSION_CLOSED`, `AUTHORIZED`). Updated `EmailNotificationService` to generate customer QR and direct "Open Your Table Experience" action button. |
| **Activities Completed** | Built responsive verification and access gate views; implemented phone-based session lookup with payment check; verified zero-bypass security; validated TypeScript compilation and Vite build. |
| **Files / Modules Updated** | `backend/src/routes.ts`, `backend/src/services/EmailNotificationService.ts`, `web-frontend/src/pages/CustomerAccessPage.tsx`, `web-frontend/src/services/api.ts`, `web-frontend/src/App.tsx`, `Documents/Customer-Entry-Landing-Experience.md` |

---

## Issue 2: Mobile Customer Welcome Portal & Public Landing Experience

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Providing an intuitive, mobile-optimized public guest portal for Pegs N Bottles customers to scan pass QR codes, enter tokens, or recover sessions via phone. |
| **Problems Identified** | Opening root `/` or `/customer` on customer mobile devices without an existing active session lacked a dedicated welcome/landing experience and led to unauthenticated login screens or blank states. |
| **Resolution** | Created `CustomerLandingPage.tsx` styled with Brand Purple (`#8D6CE5`) accents, featuring direct Scan QR modal, Passcode / Token entry modal, and 10-digit Phone Lookup modal. Routed public visitors on `/`, `/customer`, and `/customer/landing` to this landing portal. |
| **Activities Completed** | Responsive layout optimization across mobile viewports (360px–430px) and desktop; modal interaction animations; input validation; TypeScript and Vite build verification. |
| **Files / Modules Updated** | `web-frontend/src/pages/CustomerLandingPage.tsx`, `web-frontend/src/App.tsx`, `web-frontend/src/services/api.ts` |

---

## Issue 3: Real-Time Session Turnover Auto-Exit & Customer App Manual Logout

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Synchronizing the customer's personal smartphone session lifecycle with live restaurant billing and staff checkout events. |
| **Problems Identified** | When a dining party concluded and cashier settled the final bill, customer smartphones retained active local ordering and cart states unless manually refreshed. Additionally, customers lacked a clean manual logout action to exit their phone view without terminating the dining session. |
| **Resolution** | Enhanced `CustomerContext.tsx` with Socket.io real-time listeners for `table.session.closed`, `bill.updated` (`status === 'PAID'`), and `session.updated` (`status === 'CLOSED'`). On bill settlement, customer state (`localStorage`) is cleared, a session closure banner is presented, and the phone automatically redirects to `/customer/landing` after 1.5s. Added a dedicated Header Logout button that safely exits the device interface while preserving active kitchen/bar preparation orders and table occupancy. |
| **Activities Completed** | Real-time event handling integration; session closure overlay implementation; manual logout confirmation dialog; TypeScript validation. |
| **Files / Modules Updated** | `web-frontend/src/context/CustomerContext.tsx`, `web-frontend/src/pages/CustomerApp.tsx`, `backend/src/services/BillingService.ts`, `backend/src/realtime/socket.ts`, `backend/src/realtime/events.ts` |

---

## Issue 4: Payment-Gated Customer Access Email Dispatch & Session Expiry Guard

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Correcting customer access email dispatch timing to strictly enforce payment verification prior to email generation and hardening session access status validation. |
| **Problems Identified** | The customer access email containing the "Open Your Table Experience" CTA and QR code was previously being enqueued during pending check-in and table assignment before entry fee payment was verified. Additionally, `GET /api/customer/access/:tokenNumber` lacked an explicit status check for `EXPIRED` sessions. |
| **Resolution** | Removed premature email dispatch from `checkInPendingHandler` and `PUT /tables/:tableId/assign`. Gated manual and automatic customer access email triggers to require `paymentVerified === true` and `status === TokenStatus.ACTIVE`. Updated `GET /api/customer/access/:tokenNumber` to reject `EXPIRED` status with HTTP 403. |
| **Activities Completed** | Backend routes correction; payment gate validation across all email dispatch paths; TypeScript compilation and Vite production build verification. |
| **Files / Modules Updated** | `backend/src/routes.ts` |
