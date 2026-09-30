# System Documentation Synchronization, End-to-End User Manual Architecture, and Technical Specification Baseline

---

## Issue 1: Table-Lock Ownership Switching, Floor Attribution, and Specification Synchronization

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Seating floor management, Reception Check-In wizard, and concurrency table-lock state transitions across staff workspaces. |
| **Problems Identified** | Incomplete documentation regarding atomic table-lock resolution during interrupted check-in flows (draft table vs newly selected assignment target); undocumented staff card attribution format (`Locked by: {Staff Full Name} · {ShortRole}`) and owner-based release authorization enforcement (`403 FORBIDDEN_NOT_OWNER`). |
| **Resolution** | Synchronized `TABLE_RESERVATION_ASSIGNMENT_WORKFLOW.md` across Section 2 (Rule 6), Section 8.1 (Dual-Lock Decision Mechanics), Section 15.B (Unlock API Specification), Section 17 (Table Card UI Matrix & Short Role Mappings), Section 20 (Authoritative Transition Rules), and Section 21 (Test Case 17). Fully documented Redis lock metadata payload (`lockedBy`, `lockedByUserId`, `lockedByName`, `lockedByRole`), owner release actions, and Admin global unlock overrides. |
| **Activities Completed** | Conducted deep static code audit across `backend/src/routes.ts`, `TableService.ts`, `CheckInPage.tsx`, and `TablesPage.tsx`; verified atomic dual-lock resolution logic (`Resume Check-In` authoritatively unlocking target table via `POST /api/tables/:id/unlock?forceAvailable=true` vs `Stop Check-In` terminating draft via `POST /api/check-in/stop` and locking target table on Stage 1); updated specification document with zero application source code alterations. |
| **Files / Modules Updated** | `TABLE_RESERVATION_ASSIGNMENT_WORKFLOW.md` |

---

## Issue 2: Unified 7-Role End-to-End User Manual Architecture and Platform Alignment

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | End-to-end user documentation covering front-of-house intake, guest self-ordering, kitchen/bar KDS preparation, waiter service station, and back-office governance. |
| **Problems Identified** | Legacy user manuals were fragmented, outdated, limited to a 4-role subset, omitted TableFlow contactless ordering, omitted Product Customizer options, omitted cart ordering locks upon customer bill requests (`isBillRequested`), and omitted Waiter Station service call workflows. |
| **Resolution** | Generated a unified, role-based User Manual (`FB_REGISTRATION_TABLEFLOW_ORDERING_USER_MANUAL.md`) structured around the 7 verified system roles (Customer, Receptionist, Waiter/Server, Bartender, Kitchen Chef, Venue Manager, Administrator). Documented step-by-step workflows, dietary badges, Product Customizers, 5-stage KDS bump bar actions, 5-second served undo protection, Call Waiter service triage, session extension controls, and cashier bill settlements. Retired outdated legacy user manuals. |
| **Activities Completed** | Verified all user-facing UI labels, modals, drawers, and status indicators against `CustomerApp.tsx`, `WaiterStationPage.tsx`, `KitchenKDSPage.tsx`, `BarKDSPage.tsx`, and `AdminPage.tsx`; verified responsive layout behavior across mobile smartphones, tablets, KDS displays, and desktop workstations; published clean production-ready User Manual. |
| **Files / Modules Updated** | `FB_REGISTRATION_TABLEFLOW_ORDERING_USER_MANUAL.md`, `Documents/FB_REGISTRATION_TABLEFLOW_ORDERING_USER_MANUAL.md` |

---

## Issue 3: Comprehensive Technical Architecture Specification and Subsystem Baseline

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Developer-level technical documentation covering full-stack system architecture, data models, concurrency, Socket.io event catalog, and API specifications. |
| **Problems Identified** | Existing technical documentation was split into disjointed legacy files with outdated 4-role RBAC, missing TableFlow ordering data schemas, undocumented Redis lock payloads, and missing Socket.io room multiplexing specifications. |
| **Resolution** | Authored `TECHNICAL_DOCUMENTATION.md` containing 15 comprehensive architectural sections: multi-tiered architecture diagram, Prisma relational schema with compound unique constraints, Redis distributed mutex locking (`table:lock:*`), 5-stage KDS lifecycle, billing/taxation engine (5% GST, 5% SC, rounding), Socket.io room architecture, and complete REST API endpoint contracts. Retired superseded legacy technical documents. |
| **Activities Completed** | Deep static inspection of `backend/src/routes.ts`, `backend/src/realtime/`, `backend/src/services/`, and `web-frontend/src/context/`; verified data contracts and concurrency guarantees. |
| **Files / Modules Updated** | `TECHNICAL_DOCUMENTATION.md` |
