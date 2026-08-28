# Daily Technical & Architectural Issues Log — August 14, 2026

---

## Issue 1: Table Reservation to Check-In Integration and Concurrency Session Management

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Table Reservation, Reservation List management, and stateful Check-In Integration |
| **Problems Identified** | Initially, reserving tables was mock-only or directly patched table status to `reserved` without storing any customer details (Name, Phone, Email, Headcount) in a persistent database. There was also no flow to assign/prefill a reserved table into the check-in wizard, leaving the guest details to be re-entered. Furthermore, when entering check-in with a preselected table or reservation, the receptionist was locked into starting a new session or resuming an incomplete draft without proper decision branching, risking table lock leaks or customer detail overrides. |
| **Resolution** | Created a backend `Reservation` model in Prisma and associated routes (`GET /reservations`, `POST /reservations`, `POST /reservations/:id/cancel`, and `POST /reservations/:id/assign`). Configured transactional hooks inside the Token creation and activation flows to automatically transition reservations to `ASSIGNED`. Created a custom Reserve Form Modal in the frontend. Added a dedicated "Reservations" tab listing active reservations with Cancel and Assign actions. Integrated a new check-in mount handler: if an incomplete check-in draft exists, it presents a "Resume Previous Check-In vs Start New Check-In" prompt. If they choose Resume, it restores the draft and unlocks any new target table to prevent leaks; if they choose Start New, it unlocks the draft table and loads the new target details and table pre-selections. Added a clear Stage 1 back button to return to Tables or Reservations view without breaking in-progress draft states. |
| **Activities Completed** | Updated database client, registered routes, added API wrappers, and structured global context states. Built the Reserve modal and the active reservations grid with Cancel Danger Confirmations. Implemented continue/abandon branching rules, back button navigation callbacks, and confirmed compilation with a clean web-frontend build. |
| **Files / Modules Updated** | `backend/prisma/schema.prisma`, `backend/src/routes.ts`, `backend/src/services/TokenService.ts`, `web-frontend/src/services/api.ts`, `web-frontend/src/context/DataContext.tsx`, `web-frontend/src/pages/TablesPage.tsx`, `web-frontend/src/pages/CheckInPage.tsx`, `web-frontend/src/App.tsx` |

---

## Issue 2: Tables Page Compilation Failures and Unused Destructured Variables

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Web Frontend Typecheck and Production Build Compilation |
| **Problems Identified** | The production build failed (`tsc -b` compilation error) due to a missing icon import (`AlertTriangle` was used in the newly added Cancel Confirmation dialog but not imported from `lucide-react`) and an unused destructured variable (`setPreselectedTable`) in `TablesPage.tsx`. |
| **Resolution** | Updated the `lucide-react` import statement in `TablesPage.tsx` to include `AlertTriangle`. Removed `setPreselectedTable` from the destructured authentication context hook as the assignment now relies on state-driven `localStorage` transition targets. |
| **Activities Completed** | Resolved the syntax and compiler warnings, ran the frontend production build script (`npm run build`), and verified that the client compiles successfully into optimized chunks with zero warnings. |
| **Files / Modules Updated** | `web-frontend/src/pages/TablesPage.tsx` |
