# Daily Technical & Architectural Issues Log — August 28, 2026

---

## Issue 1: Full-Stack TableFlow Ordering Environment Initialization, Dependency Resolution, and Dev Server Provisioning

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Full-Stack TableFlow Ordering Application (`table/`) — Runtime Initialization, Dependency Resolution, and Multi-Portal Dev Server Deployment |
| **Problems Identified** | The newly structured `table/` ordering application lacked a local `node_modules` environment and binary links, preventing execution of the TanStack Start and Nitro server engines. The project required seamless initialization on port 8080 without port collisions with the existing React Native or Web Frontend development processes. |
| **Resolution** | Executed automated package resolution via `npm install`, linking 436 packages including React 19, `@tanstack/react-start`, `@tanstack/react-router`, Radix UI headless primitives, Recharts, and Tailwind CSS v4. Initialized the Vite v8.2.2 dev server in background daemon mode on `http://localhost:8080/` with full LAN access (`http://10.49.221.1:8080/`). |
| **Activities Completed** | 1. Audited `table/package.json` dependencies and resolved package tree with 0 security vulnerabilities in 2 minutes.<br>2. Verified TanStack Start SSR entry point (`table/src/server.ts`) and Vite configuration (`table/vite.config.ts`).<br>3. Started dev server daemon on port 8080 and validated clean routing across `/demo`, `/t/:token`, `/customer/*`, `/staff/*`, `/kds/*`, and `/admin/*`.<br>4. Verified responsive touch viewport rendering on desktop, tablet, and mobile simulated devices. |
| **Files / Modules Updated** | `table/package.json`, `table/vite.config.ts`, `table/src/server.ts`, `table/src/routes/demo.tsx` |

---

## Issue 2: Comprehensive End-to-End Operational Manual & Full-Stack HLD/LLD Architectural Specification for TableFlow (`table/`)

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Technical Architecture & Multi-Role Operations Documentation — Complete HLD/LLD and 27-Section User Manual for TableFlow Ordering |
| **Problems Identified** | Operational staff (Guests, Floor Waitstaff, Kitchen Chefs, Bartenders, Venue Admins) and software engineers lacked an authoritative, end-to-end user manual and low-level technical design document detailing the 34 file-based routes, reactive store mechanics, KDS station splitting, and automated billing mathematics implemented in `table/`. |
| **Resolution** | Authored an exhaustive 27-section operational user manual (`TableFlow-Ordering-End-to-End-User-Manual.md`) and a comprehensive High-Level and Low-Level Design document (`TableFlow-Ordering-HLD-LLD-Documentation.md`). Formulated complete Mermaid sequence diagrams, state machines, and mathematical formulations for 5% GST, 5% Service Charge, and cash rounding. |
| **Activities Completed** | 1. Traced and documented all 34 routes in `table/src/routes/` and core UI components (`ProductCustomizer`, `CallWaiterSheet`, `MenuItemCard`, `VegBadge`).<br>2. Documented station-specific routing logic: food tickets to `/kds/kitchen` and beverage tickets to `/kds/bar`.<br>3. Validated exact billing formulas and modifier delta price calculations in `src/services/billing.ts`.<br>4. Created visual Mermaid diagrams for Overall System Architecture, Customer Ordering Lifecycle, and Table State Transitions. |
| **Files / Modules Updated** | `TableFlow-Ordering-End-to-End-User-Manual.md`, `TableFlow-Ordering-HLD-LLD-Documentation.md`, `table/src/services/billing.ts`, `table/src/services/store.ts`, `table/src/types/domain.ts` |

---

## Issue 3: Rigorous Database Schema Audit & PostgreSQL Production Data Model Specification

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | F&B Registration Backend PostgreSQL Database & Prisma ORM Schema Verification — Data Model Audit and Entity Relationship Mapping |
| **Problems Identified** | The development and operations teams required a precise, code-verified audit of the exact database schema currently implemented in PostgreSQL via Prisma ORM, distinguishing between physical database tables (15 models in `backend/prisma/schema.prisma`) and client-side reactive store models in `table/`. |
| **Resolution** | Conducted an in-depth, field-by-field audit of all 15 Prisma models, 4 PostgreSQL enums (`TokenStatus`, `CloseReason`, `ActivationMethod`, `CancelReason`), 18 foreign-key relationships, partial unique indexes (`uq_customer_active_token`, `uq_table_active_token`), check constraints, and PostgreSQL triggers (`trigger_update_table_on_token_creation`). |
| **Activities Completed** | 1. Inspected migrations `20260617124358_init` and `20260804231500_decommission_nfc_cards` (confirming decommissioning of physical NFC cards).<br>2. Traced data access and mutation flows in `TokenService.ts`, `TableService.ts`, `RedemptionService.ts`, and `AuthService.ts`.<br>3. Audited Redis distributed mutex locks (`lock:redemption:*`, `table:lock:*`) and caching layers (`tokens:active:cache`, `table:available:*`).<br>4. Generated a complete Mermaid Entity Relationship (ER) diagram mapping all 15 models with primary keys, unique constraints, and cascade delete behaviors. |
| **Files / Modules Updated** | `backend/prisma/schema.prisma`, `backend/prisma/seed.ts`, `backend/prisma/migrations/`, `backend/src/services/TokenService.ts`, `backend/src/services/RedemptionService.ts`, `backend/src/services/TableService.ts`, `backend/src/services/RedisService.ts` |

---

## Issue 4: Production Database Schema Evolution & Complete TableFlow Persistent Ordering Integration

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Database Architecture & Backend Schema Evolution — Full-Stack PostgreSQL Persistence for Menu, Orders, KDS, Service Requests, and Billing |
| **Problems Identified** | The F&B Registration backend PostgreSQL database was previously limited to guest check-in sessions and table allocations, while the TableFlow dining workflows (menu catalog, item modifiers, KOT ordering, KDS station queues, call waiter triage, and bill calculations) operated entirely in transient frontend state. A formal, backward-compatible database schema upgrade was required without breaking any existing session, table, user, role, or reservation workflows. |
| **Resolution** | Upgraded `backend/prisma/schema.prisma` from 15 to 27 models by introducing 12 persistent models (`MenuSection`, `MenuCategory`, `MenuSubcategory`, `MenuItem`, `ItemVariant`, `ModifierGroup`, `ModifierOption`, `Order`, `OrderItem`, `ServiceRequest`, `Bill`, `Promotion`) and 7 new enums (`FoodType`, `Station`, `OrderStatus`, `ServiceRequestType`, `ServiceRequestStatus`, `PaymentMethod`, `BillStatus`). Implemented immutable historical price and modifier snapshot fields (`DECIMAL(10,2)` and JSON) to guarantee financial integrity against future catalog changes. Synchronized PostgreSQL database via Prisma migration and updated `prisma/seed.ts` with idempotent catalog seeding. |
| **Activities Completed** | 1. Updated `backend/prisma/schema.prisma` with zero breaking changes to existing 15 models, check constraints, partial unique indexes, and PostgreSQL triggers.<br>2. Generated and applied database synchronization via Prisma Client v5.22.0 and created migration `20260828_tableflow_ordering_complete_schema`.<br>3. Extended `backend/prisma/seed.ts` with idempotent upsert seeding for sections (*Eat, Drink, Merchandise*), categories, subcategories, menu items with variants/modifiers, and promotional campaign banners.<br>4. Executed `npx tsc --noEmit` on backend with 0 type errors and restarted backend server listening on port 4000 (PID: 20432). |
| **Files / Modules Updated** | `backend/prisma/schema.prisma`, `backend/prisma/seed.ts`, `backend/prisma/migrations/20260828_tableflow_ordering_complete_schema/migration.sql` |
