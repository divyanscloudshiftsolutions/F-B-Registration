# F&B Registration — Complete End-to-End Technical Documentation

---

## 1. Project Overview

### 1.1 Project Purpose & Business Problem
The **F&B Registration (Bar Management System)** is an enterprise-grade, omnichannel food and beverage guest management, table reservation, and drink entitlement platform. In high-volume dining, nightlife, and hospitality venues, managing guest intake, seating allocation, drink entitlements, session duration, and real-time checkout presents critical operational challenges:
- **Paper & Physical Bottlenecks:** Physical tickets and manual punch cards lead to revenue leakage, theft, duplicate redemptions, and slow service station throughput.
- **Table Discrepancies:** Friction between host stands (receptionists) and floor service (bartenders/waiters) results in double-booking, ghost reservations, and lost turnover capacity.
- **Session Duration Control:** Enforcing fixed seating durations (e.g., 90-minute table limits or tiered entry covers) is difficult without automated, synchronized countdown timers and entitlement rules.
- **Unreliable Network Conditions:** Hospitality environments frequently encounter intermittent connectivity, necessitating offline-first data caching and seamless online reconciliation.

### 1.2 Main Objectives
- **Digital Guest Intake & QR Pass Generation:** Rapid guest registration, table assignment, and instant QR code delivery via email.
- **Real-Time Table & Seating Floor Plan Management:** Dynamic visual status tracking (`available`, `occupied`, `reserved`, `maintenance`) across seating categories (e.g., Indoor, Outdoor, VIP, Bar Counter).
- **High-Throughput Drink Redemption Station:** Bartender interface featuring sub-second redemption processing, multi-drink stepper controls, single-drink reverts, and active session countdown timers.
- **Entitlement Calculation & Carry-Forward Engine:** Authoritative calculation of drink balances based on headcount, zone cover rates, and dynamic session extensions.
- **Omnichannel Access:** Complete feature parity across desktop workstations, responsive tablets, mobile browsers, and native iOS/Android handheld devices.
- **Concurrency & Double-Redemption Protection:** Distributed locking and transactional isolation ensuring zero race conditions during simultaneous drink redemptions.

### 1.3 Target User Roles
1. **Receptionist:** Guest registration, table reservation/assignment, payment verification, and session initiation.
2. **Bartender:** QR scanning, customer identification, drink balance verification, drink redemption, revert operations, session extension, and checkout.
3. **Manager:** Operational oversight, table capacity control, floor monitoring, live session auditing, and reporting.
4. **Admin:** Full system configuration, staff account management, role assignment, rate card pricing, revenue analytics, and system settings.

---

## 2. Technology Stack

| Technology | Layer / Scope | Responsibility in System | Why Used |
| :--- | :--- | :--- | :--- |
| **Node.js (v20+)** | Backend Runtime | Server execution environment | High-performance asynchronous I/O and event loop suitable for concurrent socket/HTTP requests. |
| **TypeScript (v5+)** | Backend & Frontends | Static type safety and compile-time verification | Eliminates runtime type errors across complex domain entities (Tokens, Tables, Redemptions). |
| **Express.js (v4.18)** | Backend Web Framework | REST API routing, middleware chaining, and HTTP request handling | Minimalist, robust, and industry-standard HTTP pipeline. |
| **PostgreSQL (v14+)** | Relational Database | Authoritative persistent storage | ACID compliance, robust transactional isolation (`FOR UPDATE` locking), and foreign key integrity. |
| **Prisma ORM (v5.10)** | Data Access Layer | Schema definition, migrations, and type-safe query building | Eliminates manual SQL injection risks and provides synchronized TypeScript typings across database models. |
| **Redis (v7+) & ioredis** | Caching & Concurrency Layer | Distributed locks (`SETNX`), table availability cache, rate limiting, and session caching | Sub-millisecond distributed locking preventing race conditions and double redemptions. |
| **React (v19)** | Web Frontend UI | Declarative component rendering and state management | Component-driven architecture with fast virtual DOM reconciliation. |
| **Vite (v8)** | Web Frontend Bundler | Fast development server and production asset compilation | Instant HMR and lightweight tree-shaken ESM builds. |
| **Tailwind CSS (v4)** | Web Styling | Utility-first CSS styling and responsive breakpoint management | Luxury Dark theme styling and pixel-perfect mobile/tablet responsive layouts. |
| **React Native (v0.85)** | Mobile Handheld Client | Cross-platform native mobile application | Delivers native 60fps UI performance on Android and iOS devices for mobile staff. |
| **Expo (v56)** | Native Tooling & SDK | Camera barcode scanner integration, safe area management, and platform runtime | Accelerated native feature access (Camera, SecureStore, NetInfo). |
| **Lucide Icons** | Visual Iconography | Monochrome, professional iconography | Standardized visual system across Web and Native frontends. |
| **jsQR / Expo Camera** | Barcode / QR Scanning | Client-side camera feed video stream decoding | Zero-latency instant QR token extraction without backend image transmission. |
| **JSON Web Tokens (JWT)** | Authentication | Stateless session authentication | Secure, cryptographically signed token exchange between clients and backend. |
| **bcrypt** | Cryptography | Secure password hashing | Strong salted cryptographic password hashing for staff accounts. |

---

## 3. Complete Project Architecture

```mermaid
graph TD
    subgraph Client Layer
        RN[React Native Mobile App / Expo]
        Web[Web Frontend / React 19 + Vite]
    end

    subgraph Gateway & Security
        CORS[CORS & Rate Limiter]
        AuthMW[JWT Authentication & Role Middleware]
    end

    subgraph API & Routing Layer
        Routes[Express REST API Routes]
        Audit[Audit Logger Middleware]
    end

    subgraph Business Service Layer
        TokenSvc[TokenService]
        TableSvc[TableService]
        RedeemSvc[RedemptionService]
        SyncSvc[SyncService]
        EmailSvc[EmailNotificationService]
    end

    subgraph Caching & Distributed Locking
        Redis[(Redis 7.0 / ioredis)]
        Lock[SETNX lock:redemption:token]
        Cache[table:available & token:cache]
    end

    subgraph Persistence Layer
        Prisma[Prisma ORM]
        Postgres[(PostgreSQL Database)]
    end

    RN -->|HTTPS / REST| CORS
    Web -->|HTTPS / REST| CORS
    CORS --> AuthMW
    AuthMW --> Routes
    Routes --> Audit
    Routes --> TokenSvc
    Routes --> TableSvc
    Routes --> RedeemSvc
    Routes --> SyncSvc

    TokenSvc --> Redis
    TableSvc --> Redis
    RedeemSvc --> Lock
    TableSvc --> Cache

    TokenSvc --> Prisma
    TableSvc --> Prisma
    RedeemSvc --> Prisma
    SyncSvc --> Prisma

    Prisma --> Postgres
```

### Architectural Layer Responsibilities
1. **Client Layer (React Native & Web Frontend):** Renders role-specific portals (Receptionist Check-In, Bartender Service Station, Table Floor Plan, Admin Analytics). Decodes QR camera streams locally and communicates over REST endpoints.
2. **Gateway & Security Layer:** Applies origin whitelisting (CORS), rate limiting per IP/token, extracts Bearer JWT tokens, and validates role permissions (`admin`, `manager`, `receptionist`, `bartender`).
3. **API & Routing Layer (`backend/src/routes.ts`):** Validates request schemas, handles file uploads/multipart data, and delegates business logic to specialized domain services.
4. **Business Service Layer (`backend/src/services/`):** Contains core transactional logic:
   - `TokenService`: Token lifecycle, payment verification, session calculation, carry-forward logic.
   - `TableService`: Table status transitions, occupancy tracking, capacity checks, and table release.
   - `RedemptionService`: Atomic drink dispenses, single-drink reverts, and Redis locking.
   - `SyncService`: Offline device payload reconciliation and conflict resolution.
   - `EmailNotificationService`: Email QR pass formatting and SMTP dispatch.
5. **Caching & Concurrency Layer (`backend/src/services/RedisService.ts`):** Provides distributed mutex locks (`SETNX`) with TTLs to prevent double redemptions during network retries or multi-bartender scans. Maintains memory fallbacks when Redis is in local mock mode.
6. **Persistence Layer (Prisma ORM & PostgreSQL):** Manages relational integrity, foreign key constraints, indexes, and database-level row locks (`FOR UPDATE`).

---

## 4. Repository and Project Structure

The project is structured as a monorepo containing three core packages:

```
PROJECT ROOT/
├── backend/                  # Node.js + Express + Prisma + PostgreSQL + Redis API
│   ├── prisma/
│   │   ├── schema.prisma     # Relational database schema definition
│   │   └── seed.ts           # Initial administrative accounts & place types seed
│   ├── src/
│   │   ├── lib/
│   │   │   └── logger.ts     # Structured JSON audit & application logger
│   │   ├── services/
│   │   │   ├── AuditLogger.ts             # Security and administrative audit trail
│   │   │   ├── EmailNotificationService.ts # QR email generator & dispatcher
│   │   │   ├── RedemptionService.ts       # Atomic drink redemption & revert logic
│   │   │   ├── RedisService.ts            # Redis client, fallback cache & locking
│   │   │   ├── S3Service.ts               # AWS S3 cloud storage utility
│   │   │   ├── SyncService.ts             # Offline conflict resolution & sync logger
│   │   │   ├── TableService.ts            # Seating allocation & occupancy service
│   │   │   └── TokenService.ts            # Token lifecycle & entitlement engine
│   │   ├── utils/
│   │   │   └── normalization.ts          # Email & phone normalization utilities
│   │   ├── routes.ts         # Consolidated Express API route declarations
│   │   └── server.ts         # Express server startup, CORS, and port listening
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                 # React Native + Expo Mobile Application
│   ├── src/
│   │   ├── app/navigation/   # Main app shell & bottom tab / screen routers
│   │   ├── components/       # Native UI components (Cards, Buttons, Modals, Badges)
│   │   ├── context/          # BarContext (offline cache, token state) & ThemeContext
│   │   ├── features/
│   │   │   ├── admin/screens/      # AdminPortal.tsx
│   │   │   ├── auth/screens/       # LoginScreen.tsx, SplashScreen.tsx
│   │   │   ├── bartender/screens/  # BartenderPortal.tsx (Camera QR scanner & cards)
│   │   │   ├── checkin/screens/    # CheckInWizard.tsx, QuickAttendanceScreen.tsx
│   │   │   └── tables/screens/     # TablesPortal.tsx (Interactive seating grid)
│   │   ├── services/         # Mobile REST API client & AsyncStorage synchronization
│   │   └── theme/            # Color palettes, typography tokens, radius & spacing
│   ├── app.json              # Expo application manifest
│   ├── package.json
│   └── tsconfig.json
│
├── web-frontend/             # React 19 + Vite + Tailwind CSS Web Management App
│   ├── src/
│   │   ├── components/
│   │   │   ├── admin/        # Admin tab views (Dashboard, Sessions, Rates, Staff, Tables)
│   │   │   ├── layout/       # Header.tsx, Sidebar.tsx (Navigation & Theme controls)
│   │   │   ├── modals/       # ExtendSessionModal, CheckoutConfirmationModal, CancelModal
│   │   │   ├── SeatingRow.tsx    # Visual floor plan seating category row
│   │   │   └── TableDiagram.tsx  # Dynamic SVG table status diagram
│   │   ├── context/          # AuthContext.tsx, DataContext.tsx
│   │   ├── pages/
│   │   │   ├── AdminPage.tsx          # Full administrative management console
│   │   │   ├── BartenderPage.tsx      # Service Station (Compact cards & QR scanner)
│   │   │   ├── CheckInPage.tsx        # 5-Stage Receptionist check-in wizard
│   │   │   ├── DashboardPage.tsx      # Executive revenue, seating & token analytics
│   │   │   ├── LoginPage.tsx          # Workstation login gateway
│   │   │   ├── QuickAttendanceWebPage.tsx # Fast manual token/guest lookup
│   │   │   └── TablesPage.tsx         # Real-time table floor plan & inspector drawer
│   │   ├── services/         # api.ts (Axios/fetch client with auth token injection)
│   │   ├── styles/           # Tailwind CSS directives & theme rules
│   │   ├── types/            # TypeScript interfaces for Tokens, Tables, Customers
│   │   ├── App.tsx           # Route mapping, global toasts, session timers
│   │   └── main.tsx          # React 19 DOM bootstrap
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── docs/                     # Comprehensive technical documentation
├── git-remember              # Authoritative Git deployment & synchronization rules
└── package.json              # Root monorepo descriptor
```

---

## 5. Frontend Architecture — React Native

### 5.1 Mobile Application Lifecycle & Navigation
The React Native client (`frontend/`) is engineered for mobile staff using Expo and React Native Reanimated:
- **Entry Point (`App.tsx` / `MainAppShell.tsx`):** Boots the application, initializes the `ThemeContext` (Luxury Dark theme), checks local authentication state in `AsyncStorage`, and displays `SplashScreen.tsx` while verifying credentials.
- **Authentication Flow:** If no valid token exists, renders `LoginScreen.tsx`. Upon successful authentication, mounts role-specific tabs via `MainAppShell.tsx`.
- **Role-Based Tab Gating:**
  - `admin` / `manager`: Access to Dashboard, Tables, Check-In, Bartender Station, and Admin Portal.
  - `receptionist`: Access to Check-In Wizard, Quick Attendance, and Tables Floor Plan.
  - `bartender`: Access to Bartender Portal (Camera QR scanner, active session queue, instant drink dispenser).

### 5.2 State Management & Offline-First Engine (`BarContext.tsx`)
- **AsyncStorage Persistence:** Caches active tables (`bar_cached_tables`), active guest tokens (`bar_cached_tokens`), place type rate cards, and pending redemption actions locally.
- **NetInfo Listener:** Detects transitions between online and offline states. When offline, queues local redemptions with unique UUID `operationId`s in `bar_offline_sync_queue`.
- **Background Sync Engine:** When connectivity resumes, replays queued actions to `/sync/push` and pulls fresh state from `/sync/pull`.

### 5.3 Mobile User Journey
```mermaid
sequenceDiagram
    autonumber
    actor Staff as Bartender / Receptionist
    participant RN as React Native App
    participant Storage as AsyncStorage
    participant API as Backend API

    Staff->>RN: Launch Mobile App
    RN->>Storage: Read stored staff session & cache
    alt Valid Session Found
        RN->>API: Background /auth/me verification
        API-->>RN: 200 OK (User & Role)
        RN->>Staff: Render Role Portal
    else Session Expired / Missing
        RN->>Staff: Render Login Screen
        Staff->>RN: Enter Username & Password
        RN->>API: POST /auth/login
        API-->>RN: JWT Token & User Profile
        RN->>Storage: Store JWT & user metadata
        RN->>Staff: Mount MainAppShell
    end
```

---

## 6. Web Frontend Architecture

### 6.1 Application Structure & Routing
The Web Frontend (`web-frontend/`) is a React 19 Single Page Application built on Vite:
- **Root Router (`App.tsx`):** Implements state-based tab routing (`activePage` state) supporting `dashboard`, `checkin`, `quick-attendance`, `tables`, `bartender`, `admin`, and `login`.
- **Global Layout Shell:**
  - **`Header.tsx`:** Displays workstation brand identity, current active role badge, live station clock, manual refresh control (`isRefreshing` spin animation), theme switcher, notification popover, and staff logout modal.
  - **`Sidebar.tsx`:** Collapsible navigation drawer featuring role-filtered route links, responsive mobile drawer backdrop, and auto-closing drawer behavior on route selection.

### 6.2 Responsive Design System & Breakpoints
The Web UI strictly adheres to the **Luxury Brand System** (Black/Dark Slate surfaces, Brand Purple primary highlights, Amber Gold accents, and Emerald Green status badges).

```mermaid
graph LR
    subgraph Viewports
        Mobile[Mobile: 320px - 639px]
        Tablet[Tablet: 640px - 1023px]
        Desktop[Desktop: 1024px+]
    end

    subgraph Components
        Card[Bartender Session Card]
        TablesGrid[Tables Floor Plan]
        HeaderNav[Header & Sidebar]
    end

    Mobile -->|1-Col Compact 160px Height + Progressive Disclosure| Card
    Tablet -->|2-Col Grid Layout| Card
    Desktop -->|4-Col Horizontal Layout| Card

    Mobile -->|Stacked Rows + Drawer Modal| TablesGrid
    Desktop -->|Interactive Canvas + Side Inspector Panel| TablesGrid

    Mobile -->|Hamburger Drawer + Top Toasts| HeaderNav
    Desktop -->|Pinned Sidebar + Bottom Toasts| HeaderNav
```

### 6.3 Progressive Disclosure & In-Place Reconciliation
- **Bartender Cards (`BartenderPage.tsx`):** On mobile, customer metadata (Phone, Email, Party Headcount, Gate Payment, Carried Forward breakdown) is collapsed into an accordion drawer (`[ ▾ INFO / ▴ HIDE ]`), reducing card height from 480px to 160px.
- **In-Place Live Reconciliation (`silentMergeTokens`):** When redemptions occur or periodic background polling executes, token properties update in-place without triggering full list re-renders or losing scroll position. Numerical values animate via `<AnimatedNumber />`.

---

## 7. Backend Architecture

### 7.1 Server Pipeline & Middleware Chain (`server.ts` & `routes.ts`)
1. **Request Ingestion:** Express parses JSON bodies (`express.json({ limit: '10mb' })`) and urlencoded payloads.
2. **CORS Handling:** Dynamically evaluates origins against configured URLs and local subnet patterns (`192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`, `localhost`).
3. **Structured Audit Logging (`AuditLogger.ts`):** Emits structured JSON log lines with timestamps, client IP, user ID, route, and execution duration.
4. **Authentication Middleware (`authenticate`):**
   - Extracts Bearer token from `Authorization` header.
   - Queries `prisma.staffSession` for active, unexpired database session.
   - Falls back to cryptographically verifying the JWT signature against `JWT_SECRET`.
   - Attaches `req.user = { id, username, role, fullName }` to the request object.
5. **Authorization Middleware (`requireRole(['admin', 'manager'])`):** Validates that `req.user.role` matches allowed roles before proceeding to handler execution.
6. **Error Boundary Middleware:** Catches unhandled promise rejections, logs stack traces, and returns standard `{ error: string, message: string }` JSON responses.

### 7.2 Core Backend Services Overview
- **`TokenService`:** Creates customer tokens, verifies gate payments, auto-calculates expiration times, updates table occupancy, and evaluates drink entitlements.
- **`TableService`:** Manages table lifecycle, prevents double assignments using `SELECT ... FOR UPDATE` locks, tracks session duration, and releases tables.
- **`RedemptionService`:** Executes drink redemptions within ACID transactions, enforces Redis mutex locks (`lock:redemption:{tokenNumber}`), and performs single-drink rollbacks.
- **`SyncService`:** Resolves offline sync operations using conflict resolution timestamps and writes audit records to `SyncLog`.
- **`RedisService`:** Handles Redis connection pooling, distributed locking, key expiration, and in-memory mock fallback when Redis is offline.

---

## 8. Authentication and Authorization

### 8.1 Authentication Lifecycle
1. **Login (`POST /auth/login`):** User submits `username` and `password`. Backend finds the `User` record with active status, verifies password using `bcrypt.compare`, creates a `StaffSession` record in PostgreSQL (valid for 24 hours), signs a JWT token containing `{ id, username, role }`, and returns `{ token, user }`.
2. **Session Verification (`GET /auth/me`):** Validates active session token and returns the current user profile with role permissions.
3. **Logout (`POST /auth/logout`):** Deletes the `StaffSession` from PostgreSQL and blacklists the token in Redis.

### 8.2 Role-Based Access Control (RBAC) Matrix

| Feature / API Endpoint | Admin | Manager | Receptionist | Bartender |
| :--- | :---: | :---: | :---: | :---: |
| **View Dashboard Metrics** | ✅ Full | ✅ Full | ⚠️ Limited | ❌ No |
| **Check-In Guest & Issue Token** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **Reserve & Assign Table** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **Release / Vacate Table** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes (via Checkout) |
| **Scan QR & Verify Token** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Redeem Drink** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **Revert Drink Redemption** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **Extend Session Duration** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Checkout Active Session** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Manage Place Type Rate Cards** | ✅ Yes | ❌ Read Only | ❌ Read Only | ❌ No |
| **Manage Staff Accounts & Roles** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Create / Delete Tables & Zones** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **View Revenue & Financial Analytics** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |

---

## 9. Database Architecture (Prisma Schema)

### 9.1 Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ Token : "issuedBy"
    User ||--o{ Token : "closedBy"
    User ||--o{ Redemption : "dispensedBy"
    User ||--o{ TokenExtension : "approvedBy"
    User ||--o{ StaffSession : "has"
    User }|--|| Role : "belongsTo"
    User ||--o{ RateLog : "changedBy"
    User ||--o{ Reservation : "created"

    Customer ||--o{ Token : "owns"
    
    PlaceTypeConfig ||--o{ Table : "contains"
    PlaceTypeConfig ||--o{ Token : "categorizes"
    PlaceTypeConfig ||--o{ RateLog : "loggedFor"

    Table ||--o{ Token : "hosts"
    Table ||--o{ TableOccupancyLog : "tracks"
    Table ||--o{ Reservation : "reservedFor"

    Token ||--o{ Redemption : "has"
    Token ||--o{ TokenExtension : "extendedBy"
    Token ||--o{ TableOccupancyLog : "logs"

    Customer {
        string id PK
        string phoneNumber UK
        string name
        string email
        datetime createdAt
        datetime lastVisit
        int totalVisits
    }

    PlaceTypeConfig {
        string id PK
        string name UK
        decimal ratePerPerson
        int baseTimeMinutes
        int redemptionsPerPerson
        boolean isActive
    }

    Table {
        string id PK
        string tableNumber
        string placeTypeId FK
        int capacity
        string status
        string currentTokenId
        datetime occupiedSince
        boolean isActive
    }

    Token {
        string id PK
        string tokenNumber UK
        string customerId FK
        int personsCount
        string placeTypeId FK
        string tableId FK
        decimal amountPaid
        boolean paymentVerified
        datetime startTime
        datetime endTime
        int totalRedemptionsAllowed
        int redemptionsUsed
        string status
        string deliveryMode
    }

    Redemption {
        string id PK
        string tokenId FK
        int redemptionSequence
        datetime redeemedAt
        string bartenderId FK
        string notes
    }

    TokenExtension {
        string id PK
        string tokenId FK
        int extraMinutes
        decimal additionalAmount
        string approvedBy FK
        datetime extendedAt
        datetime newEndTime
    }

    TableOccupancyLog {
        string id PK
        string tableId FK
        string tokenId FK
        datetime occupiedAt
        datetime vacatedAt
        int durationMinutes
    }
```

### 9.2 Key Database Models & Descriptions
1. **`customers`:** Stores normalized guest identity (`phoneNumber` unique index, `email`, `name`, visit counters).
2. **`place_types`:** Zone configurations defining base rates (`rate_per_person`), standard session duration (`base_time_minutes`), and default drinks per guest (`redemptions_per_person`).
3. **`tables`:** Physical seating units tied to place types with compound uniqueness on `[tableNumber, placeTypeId]`.
4. **`tokens`:** Core operational record representing active, extended, closed, or expired customer sessions with complete financial and redemption totals.
5. **`redemptions`:** Immutable audit log for every drink dispensed, recording timestamp, sequence number, and dispensing bartender.
6. **`token_extensions`:** Financial and time extension audit trail recording extra minutes granted, additional fees paid, and approving staff member.
7. **`table_occupancy_logs`:** Historical seating duration tracker used for turnover analytics.
8. **`staff_sessions`:** Active authenticated user sessions with expiration timestamps.

---

## 10. Redis Architecture

### 10.1 Key Schema & TTL Definitions

| Redis Key Pattern | Data Type | TTL | Purpose / Description |
| :--- | :--- | :--- | :--- |
| `lock:redemption:{tokenNumber}` | String (Mutex) | 10 seconds | Distributed lock preventing concurrent double redemptions for a token. |
| `table:lock:{tableId}` | String (Mutex) | 15 seconds | Temporary lock acquired during guest check-in table selection. |
| `table:available:{placeTypeId}` | String (JSON) | 300 seconds | Cached list of available tables in a specific zone. |
| `table:available:all` | String (JSON) | 300 seconds | Cached list of all available tables across the venue. |
| `tokens:active:cache` | String (JSON) | 300 seconds | High-speed cache of active guest tokens for Bartender stations. |
| `token:details:{tokenNumber}` | String (JSON) | 300 seconds | Cached customer session details for QR verification endpoints. |
| `rate_limit:{ip}:{route}` | Integer | 60 seconds | Rate limiting counter enforcing request thresholds per client IP. |

### 10.2 Concurrency & Mutex Implementation
Distributed locking is implemented in `RedisService.ts` using atomic Redis primitives:
- **Lock Acquisition:** `redis.set(key, lockValue, 'EX', 10, 'NX')` ensures only one worker thread can enter the redemption critical section.
- **Lock Release:** Executes an atomic Lua script verifying ownership before deletion:
  ```lua
  if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
  else
      return 0
  end
  ```
- **Fallback Mode:** If `REDIS_URL` is omitted, `RedisService` activates an in-memory lock map with millisecond expiration timestamps, guaranteeing zero external dependencies during local development.

---

## 11. Complete Check-In Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Guest as Customer
    actor Rec as Receptionist
    participant App as CheckInPage (Wizard)
    participant API as Backend API
    participant DB as PostgreSQL
    participant Redis as Redis Cache
    participant Email as Email Service

    Guest->>Rec: Arrives at venue
    Rec->>App: Step 1: Enter Phone Number & Name
    App->>API: GET /customers/search?phone=...
    API-->>App: Existing customer details (or new)
    Rec->>App: Step 2: Select Zone / Place Type & Headcount
    App->>API: GET /tables/available?placeTypeId=...
    API->>Redis: Check table:available cache
    Redis-->>API: Return available tables
    API-->>App: Available tables list
    Rec->>App: Step 3: Select Table (e.g., Table M2)
    App->>API: POST /tables/:id/lock
    API->>Redis: SETNX table:lock:M2
    Rec->>App: Step 4: Verify Payment & Delivery Mode (EMAIL_QR)
    Rec->>App: Step 5: Confirm & Check-In
    App->>API: POST /check-in/generate
    API->>DB: BEGIN Transaction
    API->>DB: Upsert Customer
    API->>DB: Create Token (ACTIVE, end_time = now + baseTime)
    API->>DB: Update Table status = 'occupied', current_token_id = token.id
    API->>DB: Insert TableOccupancyLog
    API->>DB: COMMIT Transaction
    API->>Redis: Invalidate table:available & tokens:active:cache
    API->>Email: Dispatch QR Code Pass to guest email
    API-->>App: Token Generated (BAR-20260827-00001)
    App->>Rec: Display Success & Auto-redirect to Tables/Check-in
```

### Edge Cases & Failure Protection
- **Abandoned Check-In:** If a receptionist locks a table in Step 3 but leaves before payment, the Redis lock `table:lock:{tableId}` automatically expires in 15 seconds, returning the table to `available`.
- **Payment Cancellation:** The wizard allows instant draft cancellation (`handleDraftKeyDown`), releasing temporary table holds without creating dirty database records.
- **Duplicate Phone Intake:** If a guest with an already active dining token registers again, the system prompts with an existing session warning modal to prevent duplicate check-ins.

---

## 12. QR Workflow

### 12.1 QR Token Payload & Format
The QR code encodes a secure token identifier formatted as:
`BAR-YYYYMMDD-XXXXX` (e.g., `BAR-20260827-00001`).

```mermaid
graph TD
    A[Guest Presents QR Code] --> B[Bartender Scans via Web Camera / Handheld]
    B --> C[Client Decodes Barcode Stream locally via jsQR / Expo]
    C --> D[POST /qr/verify with qrPayload]
    D --> E{Token Exists in DB?}
    E -->|No| F[404: Invalid QR Code]
    E -->|Yes| G{Token Status == ACTIVE or EXTENDED?}
    G -->|No / CLOSED| H[400: Session already closed]
    G -->|No / EXPIRED| I[400: Session expired]
    G -->|Yes| J{Current Time <= End Time?}
    J -->|No| K[Auto-update Token status to EXPIRED -> 400 Expired]
    J -->|Yes| L[200 OK: Return Token, Balance & Customer Details]
    L --> M[Mount Active Session Card on Bartender Station]
```

### 12.2 Security & Duplicate Scan Protection
- **Decoupled Local Decoding:** The video stream is processed entirely on the client using `jsQR` (Web) or `expo-camera` (Mobile). Video frames are never sent over the network.
- **Replay Protection:** Scanning an expired or checked-out QR code instantly rejects with clear visual modals (`SESSION_CLOSED`, `SESSION_EXPIRED`) and triggers automatic cache invalidation.

---

## 13. Table Management Workflow

### 13.1 Table State Machine

```mermaid
stateDiagram-v2
    [*] --> Available : Table Created / Enabled
    Available --> InCheckin : Locked during Check-In Wizard (15s TTL)
    InCheckin --> Available : Wizard Cancelled / Lock Expired
    InCheckin --> Occupied : Check-In Confirmed & Token Generated
    Available --> Reserved : Advance Reservation Placed
    Reserved --> Occupied : Guest Arrives & Check-In Completed
    Reserved --> Available : Reservation Cancelled / Released
    Occupied --> Available : Checkout Completed & Table Released
    Available --> Maintenance : Flagged for Cleaning / Repair
    Maintenance --> Available : Maintenance Cleared
```

### 13.2 Floor Plan & Table Inspector Drawer
- **Visual Seating Grid (`TablesPage.tsx`):** Groups tables by zone (VIP, Dining, Bar) with real-time status indicators (Green: Available, Crimson: Occupied, Purple: Reserved, Amber: Maintenance).
- **Inspection Drawer:** Clicking any occupied table opens a detailed side panel displaying Guest Name, Phone, Email, Seating Headcount, Token Number, Remaining Time, Drinks Used, and Quick Action buttons (`Extend Session`, `Release Table`, `Clear Reservation`).

---

## 14. Bartender Workflow

### 14.1 Operational Flow
1. **Station Login:** Bartender authenticates into the Workstation / Mobile App and opens the **Service Station**.
2. **Active Check-Ins Queue:** Automatically polls and subscribes to active guest sessions, sorting by urgency (least time remaining first).
3. **QR Code Verification:** Bartender clicks `[ QR SCAN ]` or scans a physical guest screen. The station instantly highlights the customer session card.
4. **Drink Dispensing:**
   - Evaluates remaining drinks gauge (`Used / Total`).
   - Adjusts quantity stepper (`−`, `[ qty ]`, `+`).
   - Clicks Emerald Green `[ REDEEM ]`.
5. **Instant Revert:** If an incorrect quantity was entered, the bartender clicks Amber Gold `[ REVERT ]` to roll back the last transaction.
6. **Stationary Extension / Checkout:** Direct access to `[ EXTEND ]` and `[ CHECKOUT ]` actions without leaving the queue.

---

## 15. Drink Redemption System

### 15.1 Entitlement Calculation Rules
The total drink balance is calculated authoritatively by the backend:
$$\text{Current Check-In Entitlement} = \min\left(\text{totalRedemptionsAllowed}, \text{personsCount} \times \text{redemptionsPerPerson}\right)$$
$$\text{Carried-Forward Balance} = \max\left(0, \text{totalRedemptionsAllowed} - \text{Current Check-In Entitlement}\right)$$
$$\text{Remaining Drinks} = \text{totalRedemptionsAllowed} - \text{redemptionsUsed}$$

### 15.2 Atomic Redemption Transaction
When `POST /redemptions/process` is invoked:
1. Acquires Redis mutex `lock:redemption:{tokenNumber}` (10s TTL).
2. Executes PostgreSQL `SELECT ... FOR UPDATE` row lock on `tokens`.
3. Validates that `paymentVerified === true` and status is `ACTIVE` or `EXTENDED`.
4. Checks that `now <= endTime`.
5. Verifies `redemptionsUsed + quantity <= totalRedemptionsAllowed`.
6. Increments `redemptionsUsed` and inserts records into `redemptions`.
7. Releases Redis lock and broadcasts updated token balance.

---

## 16. Session Extension

```mermaid
sequenceDiagram
    autonumber
    actor Staff as Bartender / Receptionist
    participant Modal as ExtendSessionModal
    participant API as Backend API
    participant DB as PostgreSQL

    Staff->>Modal: Click [ EXTEND ] on Customer Card
    Modal->>Staff: Select Duration (+20m, +30m, +60m) & Extra Drinks
    Staff->>Modal: Confirm Extension
    Modal->>API: POST /tokens/:tokenNumber/extend
    API->>DB: BEGIN Transaction
    API->>DB: Fetch Token & PlaceType rate
    API->>DB: Compute newEndTime = current endTime + extraMinutes
    API->>DB: Compute additionalAmount & new totalRedemptionsAllowed
    API->>DB: Update Token (status = EXTENDED, endTime = newEndTime)
    API->>DB: Insert TokenExtension audit record
    API->>DB: COMMIT Transaction
    API-->>Modal: 200 OK (Updated Token)
    Modal->>Staff: Close Modal & Update Card Countdown Timer
```

---

## 17. Checkout Workflow

### 17.1 Unified Checkout Confirmation
When a guest completes their visit or leaves the venue:
1. Staff clicks `[ CHECKOUT ]` on the customer session card or table inspector.
2. `CheckoutConfirmationModal.tsx` opens, displaying a clear summary of used vs remaining drinks, duration stayed, and total charges.
3. Upon confirmation, client invokes `POST /tokens/:tokenNumber/close` with `closeReason: "CHECKOUT"`.
4. **Backend Transaction:**
   - Sets Token `status = CLOSED`, `closedAt = now()`, `closedBy = userId`.
   - Clears Table `status = 'available'`, `currentTokenId = null`, `occupiedSince = null`.
   - Records `vacatedAt` and computes `durationMinutes` in `TableOccupancyLog`.
   - Invalidates Redis caches (`table:available`, `tokens:active:cache`).

---

## 18. Admin Module

The Administration portal (`AdminPage.tsx` & `components/admin/`) contains 6 core modules:
1. **Live Dashboard (`LiveDashboard.tsx`):** Real-time KPI summaries including active guests, table occupancy rate, total drinks dispensed, and daily gross revenue.
2. **Customer Sessions Manager (`CustomerSessionsManager.tsx`):** Global audit table of all historical and active tokens with filtering by status (`ACTIVE`, `CLOSED`, `EXPIRED`, `CANCELLED`), date pickers, and export options.
3. **Table & Floor Plan Management (`TableManagement.tsx`):** CRUD management for physical tables, zone assignments, capacity thresholds, and maintenance toggles.
4. **Rate Card Management (`RateManagement.tsx`):** Live rate configuration for place types (`ratePerPerson`, `baseTimeMinutes`, `redemptionsPerPerson`) with complete change audit history in `RateLog`.
5. **Staff Directory (`StaffManagement.tsx`):** Administrative user creation, password resets, account deactivation, and role assignments (`admin`, `manager`, `receptionist`, `bartender`).
6. **Revenue & Seating Analytics (`RevenueAnalyticsChart.tsx`):** High-contrast visual charts illustrating hourly seating peaks, revenue trends, and drink consumption velocity.

---

## 19. Dashboard Architecture

```mermaid
graph TD
    subgraph Role Conditional Querying
        RoleCheck{User Role?}
        RoleCheck -->|Admin / Manager| FullStats[Fetch /analytics/dashboard & /tokens/active & /tables]
        RoleCheck -->|Receptionist| RecStats[Fetch /tables & /tokens/active]
        RoleCheck -->|Bartender| BarStats[Fetch /tokens/active only]
    end

    subgraph Error & 403 Protection
        FullStats --> RenderKPIs[Render Revenue, Seating Peaks, Staff Audit]
        RecStats --> RenderTables[Render Occupancy & Available Tables]
        BarStats --> RenderQueue[Render Active Drink Redemption Queue]
    end
```

### Role-Aware API Isolation
To prevent HTTP 403 Forbidden console errors and UI crashes, `DashboardPage.tsx` and `AdminPage.tsx` evaluate the authenticated user's role before issuing analytical API queries. Financial and staff audit endpoints are strictly skipped for `receptionist` and `bartender` roles.

---

## 20. Offline-First Architecture

### 20.1 Mobile Offline Synchronization Protocol
1. **Local Data Persistence:** The React Native app caches table layouts, rate cards, and active sessions in `AsyncStorage`.
2. **Offline Transaction Queuing:** When a network disconnect is detected via `@react-native-community/netinfo`, redemption requests are assigned a client-generated UUID `operationId` and saved to `bar_offline_sync_queue`.
3. **Sync Push (`POST /sync/push`):** Upon reconnection, the client transmits all queued payloads.
4. **Conflict Resolution (`SyncService.ts`):**
   - Evaluates client transaction timestamp against current server state.
   - If the token was already closed or expired on the server, logs the conflict in `SyncLog` with status `CONFLICT` and reason `TOKEN_EXPIRED`.
   - If valid, applies the redemption atomically.
5. **Sync Pull (`GET /sync/pull?lastSyncTimestamp=...`):** Returns only records modified since the client's last synchronization timestamp, minimizing mobile bandwidth.

---

## 21. State Synchronization and Reconciliation

### 21.1 In-Place Reconciliation Pipeline (`silentMergeTokens`)
To eliminate visual screen flicker and scroll jumping in fast-paced bar environments:
1. **Background Polling:** Stations poll `GET /tokens/active` every 5 seconds (or upon manual refresh).
2. **In-Place Array Mutation:** Instead of replacing the entire state array, `silentMergeTokens` matches incoming token IDs with existing tokens:
   - Updates numerical counters (`redemptionsUsed`, `totalRedemptionsAllowed`).
   - Updates timestamps and status flags.
   - Inserts newly activated tokens at the front.
   - Removes tokens whose status changed to `CLOSED` or `EXPIRED`.
3. **Smooth Micro-Transitions:** Numerical updates trigger CSS `scale-110` animations via `<AnimatedNumber />` and smooth progress bar width transitions (`transition-[width] duration-300`).

---

## 22. API Documentation

### 22.1 Authentication Endpoints
- **`POST /auth/login`**
  - **Auth:** Public | **Body:** `{ username, password }`
  - **Response:** `{ token: string, user: { id, username, fullName, role } }`
- **`GET /auth/me`**
  - **Auth:** Bearer JWT | **Response:** `{ user: UserProfile }`
- **`POST /auth/logout`**
  - **Auth:** Bearer JWT | **Response:** `{ success: true, message: "Logged out" }`

### 22.2 Customer & Token Endpoints
- **`GET /customers/search`**
  - **Auth:** Authenticated | **Query:** `?phone=9876543210`
  - **Response:** `{ customer: Customer | null }`
- **`POST /check-in/generate`**
  - **Auth:** `admin`, `manager`, `receptionist`
  - **Body:** `{ customerName, phoneNumber, email, personsCount, placeTypeId, tableId, amountPaid, deliveryMode }`
  - **Response:** `{ success: true, token: Token, qrPayload: string }`
- **`GET /tokens/active`**
  - **Auth:** Authenticated
  - **Response:** `Array<TokenWithDetails>` (Includes authoritative entitlement breakdown)
- **`POST /tokens/:tokenNumber/extend`**
  - **Auth:** Authenticated | **Body:** `{ extraMinutes, additionalAmount }`
  - **Response:** `{ success: true, token: Token }`
- **`POST /tokens/:tokenNumber/close`**
  - **Auth:** Authenticated | **Body:** `{ closeReason }`
  - **Response:** `{ success: true, message: "Session closed" }`

### 22.3 QR & Redemption Endpoints
- **`POST /qr/verify`**
  - **Auth:** Authenticated | **Body:** `{ qrPayload }`
  - **Response:** `{ success: true, valid: boolean, token: TokenWithCustomer }`
- **`POST /redemptions/process`**
  - **Auth:** `admin`, `manager`, `bartender`
  - **Body:** `{ payload: tokenNumber, quantity: number, redeemedAt?: string }`
  - **Response:** `{ success: true, redemption: Redemption, remainingRedemptions: number }`
- **`POST /redemptions/revert`**
  - **Auth:** `admin`, `manager`, `bartender`
  - **Body:** `{ tokenNumber: string }`
  - **Response:** `{ success: true, message: "Redemption reverted", remainingRedemptions: number }`

### 22.4 Table & Floor Plan Endpoints
- **`GET /tables`**
  - **Auth:** Authenticated | **Response:** `Array<TableWithPlaceType>`
- **`GET /tables/available`**
  - **Auth:** Authenticated | **Query:** `?placeTypeId=uuid`
  - **Response:** `Array<Table>`
- **`POST /tables/:id/release`**
  - **Auth:** Authenticated | **Response:** `{ success: true, message: "Table released" }`
- **`POST /tables`**
  - **Auth:** `admin`, `manager` | **Body:** `{ tableNumber, placeTypeId, capacity }`
  - **Response:** `{ table: Table }`

---

## 23. Security Architecture

1. **Cryptographic Protection:** Passwords hashed with `bcrypt` (10 salt rounds). JWT tokens signed using SHA-256 with strict expiration.
2. **Environment Variable Integrity:** Backend refuses to start if `JWT_SECRET` is missing.
3. **CORS Hardening:** Restricts origin access to authorized client domains and trusted local private subnets (`192.168.0.0/16`, `10.0.0.0/8`).
4. **Input Sanitization & Normalization:** Normalizes all phone numbers (removing non-digits) and lowercases email addresses before querying or persisting.
5. **Distributed Double-Redemption Shield:** Redis `SETNX` mutex prevents concurrent duplicate redemptions across rapid scans.

---

## 24. Error Handling

- **Backend Error Responses:** Standardized JSON error schema `{ error: string, message: string, code?: string }` with appropriate HTTP status codes (400, 401, 403, 404, 409, 500).
- **Client Toast Notification System:** Responsive toast notifications anchored at the top on mobile (`fixed top-4 inset-x-4`) and bottom-right on desktop (`sm:bottom-4 sm:right-4`).
- **Network Resilience:** Mobile clients seamlessly switch to local storage queue upon network timeout (2000ms fetch timeout threshold).

---

## 25. UI/UX Architecture

- **Visual Theme:** Executive Luxury Dark Mode featuring rich Obsidian surfaces (`#090D16`), Dark Slate cards (`#111827`), Brand Purple highlights (`#8B5CF6`), Amber Gold badges (`#F59E0B`), and Emerald Green positive indicators (`#10B981`).
- **Typography Hierarchy:** Clean geometric sans-serif fonts (`Inter` / `Poppins` / `Manrope`) with strict font-weight scaling (`text-xs` mono identifiers to `text-2xl` bold headers).
- **Touch Target Standard:** Every interactive button and stepper maintains a minimum **44px × 44px** touch target area conforming to mobile ergonomics.

---

## 26. Responsive Breakpoint Matrix

| Viewport Width | Device Category | Bartender Station Layout | Table Floor Plan Layout | Header / Sidebar |
| :--- | :--- | :--- | :--- | :--- |
| **320px – 360px** | Small Phones (iPhone SE, Galaxy A) | 1-Col Compact Card (~160px height), Accordion Details Drawer | Stacked Seating Cards, Full-screen Bottom Sheet Modals | Collapsible Hamburger Drawer, Auto-closing Navigation |
| **375px – 430px** | Standard / Pro Max Phones | 1-Col Compact Card (3–4 visible without scroll) | Stacked Seating Cards, Responsive Modal Drawers | Header Title Truncation, Top Fixed Toasts |
| **640px – 834px** | Tablets / iPad Portrait & Mini | **2-Column Responsive Grid** | Interactive Grid, Modal Inspector | Pinned Compact Sidebar, Top Notification Popover |
| **835px – 1024px** | Large Tablets / iPad Pro | **2-Column Responsive Grid** | Multi-zone Floor Grid, Modal Inspector | Compact Sidebar with Sub-items |
| **1025px – 1280px+**| Desktops & Large Workstations | **4-Column Horizontal Layout** (Full Metadata permanently visible) | Visual Canvas + Fixed Side Panel Inspector | Fully Expanded Sidebar + Fixed Top Header |

---

## 27. Complete End-to-End User Journeys

### 27.1 Journey 1: Customer Check-In & Gate Intake
1. Customer approaches host stand; Receptionist opens `CheckInPage.tsx`.
2. Receptionist enters guest phone number; system auto-populates past visit history.
3. Receptionist selects zone ("VIP Lounge") and party size (4 guests).
4. System displays available tables; Receptionist selects Table VIP-1 (acquiring temporary Redis lock).
5. Receptionist verifies cover payment (₹4,000) and confirms check-in.
6. Backend creates `Token`, marks Table `occupied`, logs occupancy, and dispatches QR Code Pass to guest email.

### 27.2 Journey 2: Bartender Drink Redemption
1. Guest visits bar counter and presents email QR code.
2. Bartender scans QR code using station webcam on `BartenderPage.tsx`.
3. Client decodes QR string locally and validates token via `POST /qr/verify`.
4. Station highlights guest session card showing 8 total drinks (2 per guest × 4 guests) with 0 used.
5. Bartender sets stepper to `[ 2 ]` and clicks `[ REDEEM ]`.
6. Backend acquires Redis lock, verifies session time, increments `redemptionsUsed` to 2 in PostgreSQL transaction, and returns remaining count (6).
7. Station card dynamically updates progress bar and decrements balance with smooth scale transition.

### 27.3 Journey 3: Session Extension
1. Guest requests an additional 30 minutes at table.
2. Staff clicks `[ EXTEND ]` on active session card.
3. Staff selects "+30 Minutes" and additional fee.
4. Backend updates `endTime`, recalculates total drink entitlements, and records extension audit record.
5. Station countdown timer immediately updates remaining time.

### 27.4 Journey 4: Guest Checkout & Table Release
1. Guest concludes dining experience.
2. Staff clicks `[ CHECKOUT ]` on station card.
3. Confirmation modal verifies complete bill settlement and unredeemed drink tally.
4. Staff confirms checkout.
5. Backend sets token status to `CLOSED`, clears table occupancy, computes total duration minutes in `table_occupancy_logs`, and marks table `available`.

---

## 28. Data Flow Diagrams

### 28.1 Drink Redemption Data Flow

```mermaid
sequenceDiagram
    autonumber
    actor Bartender
    participant Web as Web Frontend (BartenderPage)
    participant API as Backend API (/redemptions/process)
    participant Redis as Redis Service
    participant DB as PostgreSQL Transaction

    Bartender->>Web: Click [ REDEEM ] (Qty: 2)
    Web->>API: POST /redemptions/process { payload: "BAR-001", quantity: 2 }
    API->>Redis: acquireLock("lock:redemption:BAR-001", 10s)
    alt Lock Failed
        Redis-->>API: false
        API-->>Web: 409 Conflict ("Redemption in progress")
    else Lock Acquired
        Redis-->>API: true
        API->>DB: BEGIN Transaction
        API->>DB: SELECT * FROM tokens WHERE token_number = 'BAR-001' FOR UPDATE
        API->>DB: Verify payment_verified == true & status in (ACTIVE, EXTENDED)
        API->>DB: Verify redemptions_used + 2 <= total_redemptions_allowed
        API->>DB: UPDATE tokens SET redemptions_used = redemptions_used + 2
        API->>DB: INSERT INTO redemptions (tokenId, quantity, bartenderId, sequence)
        API->>DB: COMMIT Transaction
        API->>Redis: releaseLock("lock:redemption:BAR-001")
        API->>Redis: Invalidate tokens:active:cache
        API-->>Web: 200 OK { success: true, remainingRedemptions: 6 }
        Web->>Bartender: Animate Drink Gauge & Display Success Toast
    end
```

---

## 29. State Transition Models

### 29.1 Token State Machine

```mermaid
stateDiagram-v2
    [*] --> PENDING_PAYMENT : Draft Check-In Created
    PENDING_PAYMENT --> ACTIVE : Payment Confirmed & Activated
    PENDING_PAYMENT --> CANCELLED : Intake Cancelled by Host
    ACTIVE --> EXTENDED : Session Extension Approved
    EXTENDED --> EXTENDED : Additional Extension Approved
    ACTIVE --> EXPIRED : Current Time > End Time
    EXTENDED --> EXPIRED : Current Time > Extended End Time
    ACTIVE --> CLOSED : Checkout Completed
    EXTENDED --> CLOSED : Checkout Completed
    EXPIRED --> CLOSED : Post-Expiry Checkout
    CLOSED --> [*]
    CANCELLED --> [*]
```

---

## 30. Environment and Configuration

### 30.1 Backend Environment Configuration (`backend/.env`)
```bash
# Server Port & Binding
PORT=4000
NODE_ENV=development

# Database Connection String
DATABASE_URL="postgresql://postgres:postgres_password@localhost:5432/bar_management_db?schema=public"

# Redis Cache & Distributed Mutex (Leave blank for in-memory fallback)
REDIS_URL="redis://localhost:6379"

# JWT Secret for Cryptographic Token Signing
JWT_SECRET="your_strong_jwt_secret_key_here"

# CORS & Allowed Origins
ALLOWED_ORIGINS="http://localhost:5173,http://localhost:3000"

# Email SMTP Delivery Configuration
SEND_REAL_EMAILS=true
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="notifications@venue.com"
SMTP_PASS="your_app_password_here"
```

### 30.2 Web Frontend Configuration (`web-frontend/.env`)
```bash
VITE_API_URL="http://localhost:4000"
```

---

## 31. Installation and Developer Setup

### 31.1 Prerequisites
- **Node.js:** v20.x or higher
- **npm:** v10.x or higher
- **PostgreSQL:** v14.x or higher
- **Redis:** v7.x (Optional; local mock fallback active if omitted)

### 31.2 Step-by-Step Setup Guide

#### 1. Repository Setup & Dependencies
```bash
# Clone the repository
git clone https://github.com/divyanscloudshiftsolutions/F-B-Registration.git
cd F-B-Registration

# Install Backend dependencies
cd backend
npm install

# Install Web Frontend dependencies
cd ../web-frontend
npm install

# Install React Native dependencies
cd ../frontend
npm install
```

#### 2. Database Migration & Seeding
```bash
cd ../backend

# Generate Prisma client typings
npm run prisma:generate

# Apply migrations
npm run prisma:migrate

# Seed administrative accounts and initial place types
npm run prisma:seed
```

---

## 32. Running the Application

### Starting Development Servers

```bash
# Terminal 1: Start Backend API Server (Port 4000)
cd backend
npm run dev

# Terminal 2: Start Web Frontend Application (Port 5173)
cd web-frontend
npm run dev

# Terminal 3: Start React Native Mobile App (Expo Metro Bundler)
cd frontend
npm run start
```

---

## 33. Testing and Verification

```bash
# Backend TypeScript Type Check
cd backend
npx tsc --noEmit

# Web Frontend TypeScript & Build Verification
cd ../web-frontend
npm run build

# Frontend Linter Check
npm run lint

# Backend Unit & Integration Tests
cd ../backend
npm test
npm run test:integration
```

---

## 34. Deployment Architecture

```mermaid
graph TD
    subgraph Production Cloud Deployment
        LB[Load Balancer / Reverse Proxy NGINX]
        WebStatic[Vite Production SPA Static CDN]
        APINodes[Node.js Backend Cluster / PM2 / Docker]
        RedisCluster[(Redis Cluster / AWS ElastiCache)]
        ManagedPG[(Managed PostgreSQL / AWS RDS)]
    end

    ClientWeb[Web Clients] -->|HTTPS| WebStatic
    ClientWeb -->|API Requests| LB
    ClientMobile[Mobile App / Expo APK] -->|API Requests| LB

    LB --> APINodes
    APINodes --> RedisCluster
    APINodes --> ManagedPG
```

---

## 35. Git and Repository Architecture

The project operates under an authoritative monorepo architecture mapped to four dedicated GitHub repositories:

| Repository Name | Remote URL | Scope / Mapped Source | Branch |
| :--- | :--- | :--- | :--- |
| **Central Monorepo** | `https://github.com/divyanscloudshiftsolutions/F-B-Registration.git` | Entire Project Root (`.`) | `main` |
| **Web Frontend** | `https://github.com/cloudshiftsolutions-dev/F-B-Registration-Web-Frontend.git` | `web-frontend/` contents directly at root | `main` |
| **Backend** | `https://github.com/cloudshiftsolutions-dev/F-B-Registration-Backend.git` | `backend/` contents directly at root | `main` |
| **React Native** | `https://github.com/cloudshiftsolutions-dev/F-B-Registration-Frontend.git` | `frontend/` contents directly at root | `main` |

---

## 36. Known Architectural Decisions

1. **In-Place Array Reconciliation (`silentMergeTokens`):** Prevents screen redraws and scroll disruption in high-frequency bar environments.
2. **Client-Side Video Stream QR Decoding:** Eliminates server bandwidth consumption by decoding barcode frames directly in browser memory using `jsQR`.
3. **Database Row Locks (`FOR UPDATE`):** Combines Redis distributed locks with PostgreSQL row-level locks to guarantee absolute ACID compliance during high-concurrency redemptions.
4. **Authoritative Entitlement Breakdown:** Computes carry-forward vs current check-in entitlements dynamically on the server, ensuring historical billing accuracy across session extensions.
5. **Hybrid Operational Density UI:** Progressive disclosure design pattern reduces card height by 65% on mobile while preserving full desktop workstation functionality.

---

## 37. Summary of Completed Fixes & Improvements

- **Authentication:** Added local private subnet CORS validation and hardened JWT secret startup guards.
- **Check-In:** Resolved Temporal Dead Zone (TDZ) event listener crashes in 5-stage check-in wizard.
- **Tables:** Added real-time customer email display to occupied table inspector panels and standardized semantic action button color palettes.
- **Bartender Station:** Implemented Hybrid Operational Density Cards with progressive disclosure accordion drawers, 44px touch targets, and 2-column tablet grid layouts.
- **Notifications:** Positioned mobile toast notifications at the top of the viewport to prevent obstructing bottom navigation drawers.

---

## 38. Troubleshooting Guide

| Issue | Likely Cause | Solution / Fix |
| :--- | :--- | :--- |
| **Backend fails on startup (`JWT_SECRET missing`)** | Missing `.env` file in `backend/` | Create `backend/.env` and define `JWT_SECRET="your_secret"`. |
| **Database connection refused (`P1001`)** | PostgreSQL service stopped or invalid `DATABASE_URL` | Start PostgreSQL service and verify host, port, and credentials in `.env`. |
| **HTTP 403 on Dashboard metrics** | Non-admin user querying admin-only endpoint | Check role gating; system automatically hides restricted queries for bartenders. |
| **"Another redemption in progress" (409)** | Redis mutex lock held or concurrent double scan | Wait 10 seconds for automatic lock release or verify network stability. |
| **QR scanner displays black screen** | Browser camera permissions blocked | Grant camera permissions in browser settings (requires HTTPS or `localhost`). |
| **Mobile input causes unwanted viewport zoom** | Font size below 16px on iOS/Android browsers | Ensure all text inputs use `text-base` (16px minimum) on mobile viewports. |

---

## 39. Developer Maintenance Guide

| Feature / Domain | Primary Files / Modules to Inspect & Modify |
| :--- | :--- |
| **Authentication & RBAC** | `backend/src/routes.ts` (`authenticate`, `requireRole`), `web-frontend/src/context/AuthContext.tsx` |
| **Check-In Wizard & Guest Intake** | `web-frontend/src/pages/CheckInPage.tsx`, `backend/src/services/TokenService.ts` |
| **Table & Seating Floor Plan** | `web-frontend/src/pages/TablesPage.tsx`, `components/admin/TableManagement.tsx`, `backend/src/services/TableService.ts` |
| **Drink Redemption & Bartender Station** | `web-frontend/src/pages/BartenderPage.tsx`, `backend/src/services/RedemptionService.ts` |
| **Database Schema & Migrations** | `backend/prisma/schema.prisma` |
| **Distributed Caching & Locks** | `backend/src/services/RedisService.ts` |
| **Global Theme & Responsive Breakpoints** | `web-frontend/src/styles/index.css`, `web-frontend/src/App.css`, `frontend/src/theme/` |

---

## 40. Glossary

- **Token (`tokenNumber`):** Unique operational tracking identifier (e.g., `BAR-20260827-00001`) representing an active guest dining and drink session.
- **Check-In:** The formal process of registering a customer, assigning a table, verifying cover payment, and generating an active token.
- **Redemption:** The physical act of dispensing one or more authorized complimentary drinks to a guest.
- **Carried-Forward Balance:** Unused drink entitlements carried over from prior visits or multi-session extensions.
- **Gate Payment:** The entrance cover charge paid by the guest upon arrival, determining base drink allowances.
- **Service Station:** The bartender workstation view displaying real-time customer session cards and drink counters.
- **Table Occupancy:** The duration and status of a physical table while bound to an active guest token.
- **Reconciliation (`silentMergeTokens`):** In-place synchronization of active token states without disrupting user UI scroll or focus.
- **Session Extension:** Authoritative time and drink entitlement expansion granted to an existing guest token.
- **Checkout:** The final closure of a token session, vacating table occupancy and archiving visit logs.
