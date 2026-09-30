# F&B Registration + TableFlow Ordering — Technical Documentation
**System Name:** Pegs N Bottles (F&B Registration + TableFlow Ordering Operations Suite)  
**Document Type:** Architecture, Data Model, API, Realtime & Developer Reference  
**Scope:** Backend (Node.js/Express/Prisma/PostgreSQL/Redis), Web Frontend (React 19/Vite/Tailwind CSS), Realtime Engine (Socket.io), and Domain Subsystems  
**Version:** 2.0.0 (Production Architecture)

---

## 1. System Overview

### 1.1 Purpose & Architectural Scope
The **Pegs N Bottles Management Platform** is a unified, omnichannel, event-driven hospitality operations system designed for high-throughput restaurants, nightlife venues, gastro-pubs, and dining lounges. The architecture unifies front-of-house customer registration, physical seating floor management, contactless guest self-ordering, automated station-specific Kitchen Order Ticket (KOT) routing, waitstaff coordination, drink entitlement tracking, live itemized billing, and back-office governance.

```mermaid
flowchart TB
    subgraph Clients ["Client Layer"]
        GuestWeb["Guest Mobile Web (/t/:token, /customer/*)"]
        StaffWeb["Staff Web Application (/checkin, /tables, /waiter, /admin)"]
        KDSKitchen["Kitchen KDS Touchscreen (/kds/kitchen)"]
        KDSBar["Bar KDS Touchscreen (/bartender/kds)"]
        MobileClient["React Native / Expo Staff Client"]
    end

    subgraph Gateway ["Network & Security Layer"]
        CORS["CORS & Rate Limiter"]
        AuthGuard["JWT Authentication & RBAC Middleware"]
    end

    subgraph AppTier ["Application & Domain Service Tier (Express.js)"]
        AuthSvc["Auth & Staff Service"]
        TableSvc["Table & Seating Service"]
        CheckInSvc["Check-In & Token Service"]
        OrderSvc["Order & KOT Service"]
        KDSSvc["KDS Station Routing Service"]
        BillingSvc["Billing & Taxation Service"]
        InventorySvc["Inventory & Stock Service"]
        ServiceReqSvc["Service Request Service"]
        RealtimeEngine["Socket.io Realtime Broadcast Engine"]
    end

    subgraph CacheTier ["Caching & Concurrency Tier (Redis 7)"]
        RedisLocks["Distributed Mutex Locks (table:lock:*, lock:redemption:*)"]
        RedisCache["Table Status & Duplicate Validation Cache"]
    end

    subgraph DataTier ["Authoritative Persistence Tier (PostgreSQL 14+)"]
        PrismaORM["Prisma ORM (Data Access Layer)"]
        PostgresDB[(PostgreSQL Database)]
    end

    GuestWeb -->|HTTPS REST / WSS| Gateway
    StaffWeb -->|HTTPS REST / WSS| Gateway
    KDSKitchen -->|HTTPS REST / WSS| Gateway
    KDSBar -->|HTTPS REST / WSS| Gateway
    MobileClient -->|HTTPS REST / WSS| Gateway

    Gateway --> AuthGuard
    AuthGuard --> AppTier

    AppTier <--> RedisLocks
    AppTier <--> RedisCache
    AppTier --> PrismaORM
    PrismaORM <--> PostgresDB
    AppTier --> RealtimeEngine
    RealtimeEngine -->|WebSocket Events| Clients
```

### 1.2 Core Subsystems
1. **Reception & Seating Subsystem:** 5-step registration wizard, debounced duplicate conflict engine, zone rate cards, and Redis-backed table-locking mutex.
2. **Table Management & Floor Plan:** Real-time table states (`available`, `in_checkin`, `reserved`, `occupied`, `maintenance`), lock attribution metadata (`Locked by: {Name} · {ShortRole}`), and owner-authorized release mechanics.
3. **Customer Self-Ordering Subsystem:** Scannable table QR onboarding (`/t/:token`), product customizers (variants, modifiers, cooking notes), real-time cart, and KOT dispatch.
4. **Kitchen & Bar Display Systems (KDS):** Station routing (`station: 'KITCHEN'` vs `'BAR'`), 5-stage order item lifecycle (`PLACED` $\rightarrow$ `ACCEPTED` $\rightarrow$ `PREPARING` $\rightarrow$ `READY` $\rightarrow$ `SERVED`), bump bar controls, and 5-second served undo manager.
5. **Waiter Service Station:** Centralized floor coordination dashboard (`/waiter/*`) managing guest service requests (Water, Cutlery, Cleanup, Assistance), ready pickup queues, assisted ordering, session extensions, and cashier bill settlements.
6. **Billing & Settlement Engine:** Dynamic calculation of subtotals, 5% GST (`GstTaxTag`), 5% Service Charge, cash/UPI rounding, automated cart ordering locks (`isBillRequested = true`), and table vacation.
7. **Inventory & Stock Tracking:** Real-time stock depletion, instant Stock-Out / Stock-In toggling, and cancellation restorations.
8. **Realtime Event Engine:** Low-latency WebSocket room broadcasts (`role:*`, `kds:*`, `table:*`, `token:*`) via Socket.io.

---

## 2. Technology Stack

| Layer / Domain | Technology | Version | Purpose & Architectural Responsibility |
| :--- | :--- | :--- | :--- |
| **Backend Runtime** | Node.js | v20+ | Asynchronous event loop for concurrent HTTP and WebSocket connections |
| **Backend Framework** | Express.js | v4.18 | RESTful routing, middleware chaining, and HTTP request pipeline |
| **Language** | TypeScript | v5.8+ | Compile-time static type safety across data contracts and API layers |
| **Database** | PostgreSQL | v14+ | Relational ACID-compliant persistent storage with foreign key constraints |
| **ORM & Query Engine**| Prisma ORM | v5.10 | Type-safe query building, migrations, and transactional isolation |
| **In-Memory & Locks** | Redis & ioredis | v7.0+ | Distributed table mutex locks (`SETNX`), session cache, and fast lookups |
| **Realtime Engine** | Socket.io | v4.7+ | Bi-directional WebSocket communication, room multiplexing, and events |
| **Web Frontend** | React | v19.2 | Declarative component rendering, React 19 hooks, and state reconciliation |
| **Frontend Bundler** | Vite | v8.0 | Fast HMR development server and optimized tree-shaken ESM production build |
| **CSS Framework** | Tailwind CSS | v4.0 | Utility CSS design system with responsive breakpoints and Dark theme variables |
| **Iconography** | Lucide React | v0.400+ | Monochrome, unified visual iconography across staff and customer portals |
| **QR Decoding** | jsQR | v1.4 | High-speed client-side video stream barcode scanning without server transfer |
| **Authentication** | JWT & bcrypt | v9.0 / v5.1 | Cryptographic JSON Web Token signing and salted password hashing |

---

## 3. Repository & Workspace Structure

```
.
├── backend/                               # Express.js Backend Application
│   ├── prisma/
│   │   └── schema.prisma                  # Authoritative Database Schema & Enums
│   ├── src/
│   │   ├── middleware/                    # Auth, Audit & Validation Middleware
│   │   ├── realtime/                      # Socket.io Room & Event Broadcast Definitions
│   │   │   ├── index.ts                   # Socket initialization & broadcast emitters
│   │   │   └── types.ts                   # Realtime payload type definitions
│   │   ├── services/                      # Domain Business Logic Services
│   │   │   ├── BillingService.ts          # Tax, subtotal, discount, and settlement engine
│   │   │   ├── EmailNotificationService.ts# Email delivery & QR pass mailer
│   │   │   ├── InventoryService.ts        # Stock tracking & depletion engine
│   │   │   ├── KdsService.ts              # KDS station ticket routing & status transitions
│   │   │   ├── MenuService.ts             # Catalog hierarchy CRUD & GST tags
│   │   │   ├── OrderService.ts            # KOT order creation & lifecycle management
│   │   │   ├── RedisService.ts            # Distributed locks & Redis cache client
│   │   │   ├── RedemptionService.ts       # Bartender drink redemptions & reverts
│   │   │   ├── ServiceRequestService.ts   # Guest waiter calls & triage engine
│   │   │   ├── TableService.ts            # Table seating state machine & lock mechanics
│   │   │   └── TokenService.ts            # Guest token lifecycle & pre-payment gate
│   │   ├── utils/                         # String normalization & math helpers
│   │   ├── routes.ts                      # Centralized Express REST Route Definitions
│   │   └── server.ts                      # Server bootstrap & WebSocket listener setup
│   ├── .env                               # Backend environment configuration
│   └── package.json
│
├── web-frontend/                          # React 19 / Vite Web Frontend Application
│   ├── src/
│   │   ├── components/                    # Modular Reusable UI Components
│   │   │   ├── admin/                     # Table, Menu, Staff, Rate & Session Admin Panels
│   │   │   ├── bartender/                 # Bartender Check-Ins, Scanner & Stock Tabs
│   │   │   ├── customer/                  # Product Customizer, Badges, Call Waiter Sheets
│   │   │   ├── kitchen/                   # Kitchen Stock Tab & Ticket Cards
│   │   │   ├── layout/                    # Header, Sidebar & StaffLiveNotificationStack
│   │   │   └── modals/                    # Check-In, Extend, Release, & Checkout Modals
│   │   ├── context/                       # Shared React Context Providers
│   │   │   ├── AuthContext.tsx            # Staff authentication, JWT & role storage
│   │   │   ├── CustomerContext.tsx        # Customer session, cart & order state
│   │   │   └── DataContext.tsx            # Live tables, tokens, rates & global refresh
│   │   ├── hooks/                         # Custom React Hooks
│   │   │   ├── useEnterKey.ts             # Global Enter key modal submit handlers
│   │   │   ├── useModalKeyboard.ts        # Escape & Enter keyboard navigation
│   │   │   └── useRovingSelection.ts      # Keyboard focus traps for interactive cards
│   │   ├── pages/                         # Core Application View Pages
│   │   │   ├── AdminPage.tsx              # System administration & staff management
│   │   │   ├── BarKDSPage.tsx             # Standalone Bar KDS station
│   │   │   ├── BartenderPage.tsx          # Bartender KDS, check-ins & pass scanner
│   │   │   ├── CheckInPage.tsx            # 5-step guest intake & table-lock switching
│   │   │   ├── CustomerAccessPage.tsx     # Direct token resolution gateway
│   │   │   ├── CustomerApp.tsx            # Full customer mobile self-ordering portal
│   │   │   ├── CustomerLandingPage.tsx    # Customer portal entry gate
│   │   │   ├── DashboardPage.tsx          # Executive KPI analytics dashboard
│   │   │   ├── KitchenKDSPage.tsx         # Kitchen KDS food preparation station
│   │   │   ├── LoginPage.tsx              # Staff PIN authentication portal
│   │   │   ├── QuickAttendanceWebPage.tsx # Facial clock-in/out attendance kiosk
│   │   │   ├── TablesPage.tsx             # Seating floor plan & reservations
│   │   │   └── WaiterStationPage.tsx      # Waiter floor coordination & cashiering
│   │   ├── services/                      # Frontend API & Network Clients
│   │   │   ├── api.ts                     # Axios/Fetch HTTP REST API client
│   │   │   ├── servedUndoManager.ts       # Shared 5-second KDS served undo singleton
│   │   │   └── socket.ts                  # Socket.io client wrapper & event listeners
│   │   ├── styles/                        # Tailwind CSS design system rules
│   │   ├── types/                         # Shared TypeScript interfaces & types
│   │   ├── App.tsx                        # Root routing, role guards & app shell
│   │   └── main.tsx                       # React DOM root entrypoint
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
└── Documents/                             # Architecture & Historical Issue Logs
```

---

## 4. System Architecture & Request Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Client as Frontend Client (Web / Mobile)
    participant Auth as Auth Middleware (JWT/Session)
    participant Route as Express Router (routes.ts)
    participant Service as Domain Service Layer
    participant Redis as Redis Cache / Lock Tier
    participant Prisma as Prisma ORM / PostgreSQL
    participant Realtime as Socket.io Realtime Engine

    Client->>Auth: HTTP Request + Bearer JWT
    Auth->>Auth: Verify JWT / StaffSession TTL
    Auth->>Route: Next(AuthenticatedRequest)
    Route->>Service: Call Business Method
    opt Distributed Lock Acquisition
        Service->>Redis: SET table:lock:${id} NX EX 3600
        Redis-->>Service: Lock Acquired (OK)
    end
    Service->>Prisma: Interactive Transaction ($transaction)
    Prisma->>Prisma: SELECT ... FOR UPDATE / Mutation
    Prisma-->>Service: Updated Database Models
    opt Cache & Lock Invalidation
        Service->>Redis: Invalidate Cache Keys
    end
    Service->>Realtime: Broadcast Socket Event (e.g. table:updated)
    Realtime-->>Client: WebSocket Push to Subscribed Rooms
    Service-->>Route: Return Result DTO
    Route-->>Client: HTTP 200 OK + JSON Response
```

---

## 5. Authentication & Authorization Subsystem (RBAC)

### 5.1 Authentication Flow
1. **Credentials:** Staff submit `username` (e.g. `ADM-01`, `REC-01`, `WAI-01`) and `password` (PIN).
2. **Verification:** Backend verifies bcrypt hash against the `User` record in PostgreSQL.
3. **Session Creation:** Generates a 24-hour JWT signed with `JWT_SECRET` and creates a `StaffSession` record in PostgreSQL (`expiresAt: now() + 24h`).
4. **Client Storage:** The frontend stores the JWT in `localStorage` (`bar_access_token`) and hydrates the `AuthContext`.

### 5.2 Role Definitions
The codebase enforces 7 operational roles:
- `admin` (Administrator): Unrestricted administrative access across all modules, rate cards, catalog CRUD, staff accounts, and global lock overrides.
- `manager` (Venue Manager): Executive dashboard, supervisory table unlock overrides, session extensions, and operational oversight.
- `receptionist` (Receptionist): 5-step Check-In wizard, table assignment, reservations, and owner-based table lock management.
- `waiter` / `server` (Waiter / Server): Waiter Station (`/waiter/*`), service request resolution, ready order pickup, assisted ordering, session extension, and bill settlement.
- `bartender` (Bartender): Bar KDS queue, beverage stock management, digital pass scanner, and drink entitlement stepper.
- `chef` (Kitchen Chef): Kitchen KDS queue, preparation timers, bump bar actions, and stock-out toggles.
- `customer` (Customer / Guest): Contactless self-ordering portal accessed via table token (`/t/:token`).

### 5.3 Authorization Middleware (`backend/src/routes.ts`)
```typescript
export const authorizeRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role.toLowerCase())) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to access this resource.' }
      });
    }
    next();
  };
};
```

---

## 6. Database Architecture & Data Model (Prisma / PostgreSQL)

```mermaid
erDiagram
    Customer ||--o{ Token : "holds"
    Customer ||--o{ Order : "places"
    PlaceTypeConfig ||--o{ Table : "contains"
    PlaceTypeConfig ||--o{ Token : "billed_under"
    Table ||--o{ Token : "seated_at"
    Table ||--o{ Reservation : "booked_for"
    Table ||--o{ Order : "receives"
    Table ||--o{ ServiceRequest : "summons"
    Table ||--o{ Bill : "billed"

    Token ||--o{ Redemption : "redeems"
    Token ||--o{ TokenExtension : "extends"
    Token ||--o{ Order : "orders"
    Token ||--o{ ServiceRequest : "requests"
    Token ||--o{ Bill : "settles"

    MenuSection ||--o{ MenuCategory : "categorizes"
    MenuCategory ||--o{ MenuSubcategory : "subdivides"
    MenuCategory ||--o{ MenuItem : "groups"
    MenuSubcategory ||--o{ MenuItem : "contains"
    GstTaxTag ||--o{ MenuItem : "taxes"
    MenuItem ||--o{ ItemVariant : "offers"
    MenuItem ||--o{ ModifierGroup : "modifies"
    MenuItem ||--o{ OrderItem : "ordered_in"
    MenuItem ||--o| StockItem : "inventoried_as"

    ModifierGroup ||--o{ ModifierOption : "options"
    Order ||--o{ OrderItem : "contains"
    Bill ||--o{ Order : "consolidates"

    User ||--o{ Token : "issues"
    User ||--o{ Redemption : "serves"
    User ||--o{ StaffSession : "logs"
    User ||--o{ Order : "handles"
    User ||--o{ ServiceRequest : "resolves"
    User ||--o{ Bill : "settles"
    StockItem ||--o{ InventoryLog : "logs"
```

### 6.1 Key Prisma Models
- **`Customer`**: Unique guest phone number, full name, email, and visit frequency.
- **`PlaceTypeConfig`**: Seating zone rate cards (`ratePerPerson`, `baseTimeMinutes`, `redemptionsPerPerson`).
- **`Table`**: Physical tables (`tableNumber`, `capacity`, `status`, `currentTokenId`, `placeTypeId`). Unique compound key on `[tableNumber, placeTypeId]`.
- **`Token`**: Core dining pass (`tokenNumber`, `personsCount`, `amountPaid`, `startTime`, `endTime`, `totalRedemptionsAllowed`, `redemptionsUsed`, `status`).
- **`Redemption`**: Drink redemptions (`tokenId`, `redemptionSequence`, `bartenderId`, `redeemedAt`). Unique compound key on `[tokenId, redemptionSequence]`.
- **`Order`**: KOT order batch (`orderNumber`, `tokenId`, `tableId`, `orderSource`, `status`, `subtotal`, `placedAt`).
- **`OrderItem`**: Itemized KOT lines (`menuItemId`, `itemName`, `variantName`, `selectedModifiers`, `specialInstructions`, `quantity`, `unitPrice`, `station`, `status`, `gstRate`, `gstAmount`).
- **`ServiceRequest`**: Waiter assistance calls (`tableId`, `type`, `note`, `status`, `assignedStaffId`).
- **`Bill`**: Table tab (`billNumber`, `foodSubtotal`, `drinkSubtotal`, `taxTotal`, `serviceChargeTotal`, `rounding`, `grandTotal`, `status`, `paymentMethod`).
- **`StockItem` & `InventoryLog`**: Physical inventory stock tracking with quantity audit deltas.
- **`GstTaxTag`**: Configurable GST tax brackets (e.g. `5% GST` $\rightarrow$ rate `0.05`).

---

## 7. Table, Seating & Reservation Subsystem

### 7.1 Table Lifecycle States
```mermaid
stateDiagram-v2
    [*] --> available
    available --> in_checkin : POST /tables/:id/lock (Redis lock acquired)
    available --> reserved : POST /reservations (Explicit booking)
    reserved --> in_checkin : Check-In started by Reservation Owner
    reserved --> available : Reservation Cancelled / Expired
    in_checkin --> occupied : Pre-Payment Gate Passed & Activated
    in_checkin --> available : Check-In Discarded / Unlocked
    in_checkin --> reserved : Check-In Abandoned on Reserved Table
    occupied --> available : Bill Settled & Table Vacated
    available --> maintenance : Admin Maintenance Hold
    maintenance --> available : Admin Unlock
```

### 7.2 Redis Table Locking Mutex
When a receptionist initiates a check-in on Table `id`:
1. **Key Pattern:** `table:lock:${tableId}`
2. **Value Payload (JSON):**
   ```json
   {
     "lockedBy": "USER_UUID",
     "lockedByUserId": "USER_UUID",
     "lockedByName": "Sanjay K",
     "lockedByRole": "Receptionist",
     "originalStatus": "available",
     "lockedAt": 1727541200000
   }
   ```
3. **TTL:** 3600 seconds (1 hour safety auto-expiry).
4. **Owner-Based Authorization Check (`POST /api/tables/:id/unlock`):**
   ```typescript
   if (lock && lock.lockedBy !== req.user.id && req.user.role !== 'Admin' && req.user.role !== 'Manager') {
     return res.status(403).json({
       success: false,
       error: 'FORBIDDEN_NOT_OWNER',
       message: 'You cannot unlock a table locked by another staff member.'
     });
   }
   ```

---

## 8. Check-In & Atomic Lock Switching Subsystem

### 8.1 Active Check-In Table-Lock Switching Mechanics
When a receptionist has an active draft check-in (e.g. Table `L-08`) and subsequently navigates to assign Table `L-05`:

```mermaid
sequenceDiagram
    autonumber
    actor Staff as Receptionist (User A)
    participant Route as Express Backend (/api/check-in)
    participant Redis as Redis Key Mutex
    participant DB as PostgreSQL Database
    participant WSS as Socket.io Broadcast

    Note over Staff,WSS: Scenario: Draft exists on L-08, Staff assigns L-05
    Staff->>Route: Decision Prompt Triggered

    alt Case 1: Staff selects "Resume Check-In"
        Staff->>Route: POST /api/tables/L-05/unlock?forceAvailable=true
        Route->>Redis: DEL table:lock:L-05
        Route->>DB: UPDATE Table L-05 SET status = 'available'
        Route->>WSS: Broadcast table:unlocked (L-05, available)
        Note over Staff: L-08 lock retained & active in Wizard; L-05 released for all
    else Case 2: Staff selects "Stop Check-In" -> Confirms YES
        Staff->>Route: POST /api/check-in/stop (for L-08)
        Route->>Redis: DEL table:lock:L-08
        Route->>DB: UPDATE Table L-08 SET status = 'available'
        Route->>WSS: Broadcast table:unlocked (L-08, available)
        Note over Staff: L-05 remains locked & becomes active Check-In on Stage 1
    end
```

### 8.2 Pre-Payment Verification Gate (`POST /api/check-in/pre-payment-validate`)
Before taking customer funds, the backend executes an atomic transaction:
1. Re-verifies phone and email uniqueness across active sessions.
2. Re-verifies that the table has not been occupied by another process.
3. Re-verifies token integrity.
4. Returns `{ success: true, valid: true }` to authorize payment capture.

---

## 9. Customer Ordering & KDS Architecture

```mermaid
flowchart TD
    subgraph CustOrder ["1. Customer Cart Submission"]
        C1[Customer Cart] -->|POST /api/orders| C2[OrderService.createOrder]
    end

    subgraph Splitting ["2. Smart Station Splitting"]
        C2 -->|station == 'KITCHEN'| K1[Kitchen KDS Items]
        C2 -->|station == 'BAR'| B1[Bar KDS Items]
    end

    subgraph KDSExecution ["3. KDS Processing Lifecycle"]
        K1 --> K2[PLACED]
        B1 --> B2[PLACED]
        K2 --> K3[ACCEPTED]
        B2 --> B3[ACCEPTED]
        K3 --> K4[PREPARING]
        B3 --> B4[PREPARING]
        K4 --> K5[READY]
        B4 --> B5[READY]
    end

    subgraph Delivery ["4. Waiter Station Pickup & Serve"]
        K5 & B5 --> W1[Waiter Ready Queue: /waiter/ready]
        W1 -->|Waiter Clicks 'Mark Served'| W2[SERVED]
        W2 -->|5s Floating Banner| W3{Undo Clicked?}
        W3 -- Yes --> W1
        W3 -- No --> W4[Final SERVED State]
    end
```

### 9.1 Station KDS Status State Machine
- **`PLACED`:** Freshly created order item.
- **`ACCEPTED`:** Station acknowledged ticket receipt.
- **`PREPARING`:** Active cooking / drink preparation started.
- **`READY`:** Item completed; triggers chime and moves to `/waiter/ready`.
- **`SERVED`:** Delivered to guest table.
- **`STOCK_OUT`:** Item marked unavailable by station chef/bartender.
- **`CANCELLED`:** Order item cancelled before preparation.

---

## 10. Billing, Taxation & Settlement Subsystem

### 10.1 Mathematical Tax & Bill Calculation Engine
```typescript
// Formal mathematical billing breakdown
const foodSubtotal = sum(orderItems.filter(i => i.station === 'KITCHEN').map(i => i.lineTotal));
const drinkSubtotal = sum(orderItems.filter(i => i.station === 'BAR').map(i => i.lineTotal));
const merchandiseSubtotal = sum(orderItems.filter(i => i.sectionSlug === 'merchandise').map(i => i.lineTotal));
const rawSubtotal = foodSubtotal + drinkSubtotal + merchandiseSubtotal;

const discountTotal = calculateDiscounts(rawSubtotal);
const discountedSubtotal = rawSubtotal - discountTotal;

const gstRate = 0.05; // 5% GST
const scRate = 0.05;  // 5% Service Charge

const taxTotal = discountedSubtotal * gstRate;
const serviceChargeTotal = discountedSubtotal * scRate;
const unroundedTotal = discountedSubtotal + taxTotal + serviceChargeTotal;

// Mathematical Rounding (nearest rupee)
const grandTotal = Math.round(unroundedTotal);
const rounding = grandTotal - unroundedTotal;
```

### 10.2 Ordering Lock Lifecycle
```mermaid
stateDiagram-v2
    [*] --> OrderingOpen : Table Occupied
    OrderingOpen --> OrderingLocked : Customer Clicks 'Request Bill' (isBillRequested = true)
    OrderingLocked --> OrderingOpen : Waiter Clicks 'Reopen Ordering' (POST /api/bills/reopen)
    OrderingLocked --> TableVacated : Waiter Settles Bill (POST /api/bills/:id/settle)
    TableVacated --> [*]
```

---

## 11. Realtime / Socket.io Event Catalog

### 11.1 Room Architecture
- `role:admin`, `role:manager`, `role:receptionist`, `role:bartender`, `role:waiter`, `role:chef`: Targeted by user role.
- `kds:kitchen`: All Kitchen KDS screens.
- `kds:bar`: All Bar KDS screens.
- `waiter:floor`: All Waiter Stations for ready order pickups and service calls.
- `table:${tableId}`: All devices associated with a specific physical table.
- `token:${tokenId}`: Active customer session for live status updates.

### 11.2 Socket Event Catalog

| Event Name | Emitter Source | Target Rooms | Payload Summary |
| :--- | :--- | :--- | :--- |
| `order:created` | `OrderService` | `kds:kitchen`, `kds:bar`, `waiter:floor` | `OrderCreatedPayload` (orderId, orderNumber, items, tableNumber) |
| `order:item_updated`| `KdsService` | `kds:kitchen`, `kds:bar`, `waiter:floor`, `table:${tableId}` | `OrderItemUpdatedPayload` (orderItemId, status, readyAt, servedAt) |
| `service_request:created` | `ServiceRequestService` | `waiter:floor`, `role:admin`, `role:manager` | `ServiceRequestCreatedPayload` (id, tableNumber, type, note) |
| `service_request:updated` | `ServiceRequestService` | `waiter:floor`, `table:${tableId}` | `ServiceRequestUpdatedPayload` (id, status, assignedStaffName) |
| `table:updated` | `TableService` | Global Broadcast | Updated Table DTO (`status`, `lockedByName`, `isBillRequested`) |
| `table:unlocked` | `TableService` | Global Broadcast | `{ tableId, status: 'available' }` |
| `session:extended` | `TokenService` | `table:${tableId}`, `token:${tokenId}`, `role:admin` | `{ tokenId, extraMinutes, newEndTime }` |
| `inventory:stock_updated` | `InventoryService` | Global Broadcast | `{ menuItemId, isAvailable, currentStock }` |
| `bill:requested` | `BillingService` | `waiter:floor`, `role:admin`, `role:manager` | `{ tableId, tableNumber, billId, grandTotal }` |
| `bill:settled` | `BillingService` | Global Broadcast | `{ billId, tableId, paymentMethod, status: 'PAID' }` |

---

## 12. Frontend Architecture & State Synchronization

### 12.1 Context Providers
- **`AuthContext` (`web-frontend/src/context/AuthContext.tsx`):** Manages user session, JWT in `localStorage`, role verification, global toast queue, and audio chime dispatch.
- **`DataContext` (`web-frontend/src/context/DataContext.tsx`):** Holds live arrays of `tables`, `tokens`, `reservations`, and `rates`. Listens to WebSocket events and executes background delta updates without page reloads.
- **`CustomerContext` (`web-frontend/src/context/CustomerContext.tsx`):** Manages customer table token, menu catalog, visual customizer state, cart items, order history, and active bill tab.

### 12.2 Keyboard Navigation & Accessibility Hooks
- **`useModalKeyboard`:** Intercepts `Escape` to close open modals and `Enter` to confirm primary actions.
- **`useEnterKey`:** Global helper attaching form submissions to the `Enter` key across inputs.
- **`useRovingSelection`:** Manages arrow key keyboard focus across floor table cards and KDS tickets.

---

## 13. Comprehensive API Reference Specification

### 13.1 Authentication & Staff Routes
- `POST /api/auth/login`: Authenticates staff credentials, returns JWT and user profile.
- `GET /api/auth/me`: Validates active JWT and returns current authenticated user.
- `POST /api/auth/logout`: Invalidates `StaffSession` and expires client token.
- `GET /api/staff`: Lists all staff accounts (Admin/Manager only).
- `POST /api/staff`: Creates a new staff member account.

### 13.2 Table & Reservation Routes
- `GET /api/tables`: Retrieves all physical tables with active token and lock metadata.
- `POST /api/tables/:id/lock`: Acquires Redis lock and sets status to `in_checkin`.
- `POST /api/tables/:id/unlock`: Releases table lock. Validates caller ownership or Admin role.
- `POST /api/reservations`: Creates an explicit `PENDING` reservation.
- `POST /api/reservations/:id/cancel`: Cancels reservation and releases table.

### 13.3 Check-In & Token Routes
- `POST /api/check-in/validate-duplicate`: Checks active database sessions for phone/email conflicts.
- `POST /api/check-in/stop`: Terminates in-progress draft check-in and releases table lock.
- `POST /api/check-in/pending`: Creates `Customer` and `Token` in `PENDING_PAYMENT` status; sends email pass.
- `POST /api/check-in/verify-qr`: Validates QR code from email pass.
- `POST /api/check-in/pre-payment-validate`: Pre-payment verification gate.
- `POST /api/check-in/activate`: Verifies payment, marks token `ACTIVE`, and sets table `occupied`.

### 13.4 Order & KDS Routes
- `POST /api/orders`: Submits customer/server KOT order with station routing.
- `GET /api/kds/orders`: Retrieves active KDS tickets filtered by `station` (`KITCHEN` or `BAR`).
- `PATCH /api/kds/items/:id/status`: Bumps order item status (`ACCEPTED` $\rightarrow$ `PREPARING` $\rightarrow$ `READY` $\rightarrow$ `SERVED`).
- `POST /api/kds/items/:id/undo-served`: Reverts `SERVED` status back to `READY` within 5 seconds.
- `POST /api/kds/items/:id/stock-out`: Marks menu item out of stock from KDS bump screen.

### 13.5 Service Request & Billing Routes
- `POST /api/service-requests`: Submits guest waiter call (Water, Cutlery, Cleanup, Assistance).
- `GET /api/service-requests/active`: Retrieves pending service calls for Waiter Station.
- `PATCH /api/service-requests/:id/acknowledge`: Waiter acknowledges request.
- `PATCH /api/service-requests/:id/complete`: Waiter resolves and dismisses request.
- `POST /api/bills/request`: Guest requests bill; locks table ordering.
- `POST /api/bills/reopen`: Waiter unlocks table ordering.
- `POST /api/bills/:id/settle`: Settle bill with Cash, UPI, or Card; vacates table.

---

## 14. Configuration, Environment & Deployment

### 14.1 Backend Environment Configuration (`backend/.env`)
```env
# Database & Network
DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/nfc_bar_db?sslmode=disable"
PORT=4000
NODE_ENV="production"

# Cryptographic Keys
JWT_SECRET="YOUR_CRYPTOGRAPHIC_JWT_SECRET_KEY"
GLOBAL_SIGNING_KEY="YOUR_GLOBAL_SIGNING_KEY"

# Multi-Tenant Identifiers
TENANT_ID="YOUR_TENANT_UUID"
TENANT_CODE="YOUR_TENANT_CODE"
TOKEN_TYPE="NFC"

# External Integrations & APIs
NOTIFICATION_API_KEY="YOUR_NOTIFICATION_SECRET"
AUTH_API_URL="https://authapi.cloudshiftsolutions.in"
FACEMARK_API_BASE="https://api.facemark.app.cloudshiftsolutions.in"
FACEMARK_BEARER_TOKEN="YOUR_FACEMARK_BEARER_TOKEN"

# Email Delivery
SEND_REAL_EMAILS=true
```

### 14.2 Process & Port Allocations
- **Backend API & WebSocket Server:** Port `4000` (`http://localhost:4000`)
- **Web Frontend Application:** Port `5173` or `8080` (`http://localhost:5173`)
- **PostgreSQL Database Engine:** Port `5432` (`postgresql://localhost:5432`)
- **Redis Cache & Lock Server:** Port `6379` (`redis://localhost:6379`)

---

## 15. Concurrency, Race Conditions & Data Integrity

1. **PostgreSQL Row-Level Locking:** Critical operations (token activation, payment verification, and table assignment) execute within Prisma `$transaction` blocks using `SELECT ... FOR UPDATE` isolation.
2. **Redis Distributed Mutex (`SETNX`):** Table locking during check-in uses atomic Redis key reservations (`table:lock:${tableId}`) with automatic TTL expiry to eliminate ghost locks.
3. **Atomic Beverage Redemptions:** Drink redemptions are protected by unique compound database constraints on `[tokenId, redemptionSequence]`, preventing double-redemption race conditions during high-frequency bar scanning.
4. **Authoritative Lock Attribution:** Table lock records store complete staff metadata (`lockedByUserId`, `lockedByName`, `lockedByRole`) to strictly enforce owner-only release authorization.

---

**End of Technical Documentation**  
*Pegs N Bottles (F&B Registration + TableFlow Ordering) — Document Version 2.0.0*
