# Pegs N Bottles (F&B Registration & TableFlow Ordering) — High-Level & Low-Level Design (HLD & LLD) Specification

---

# PART 1: HIGH-LEVEL DESIGN (HLD)

---

## 1. Executive Summary & System Vision

**Pegs N Bottles** is an enterprise-grade, omnichannel food, beverage, and venue operations management platform. The system orchestrates high-throughput hospitality workflows across customer mobile devices, receptionist check-in terminals, floor staff handhelds, kitchen/bar display systems (KDS), and executive management dashboards without requiring dedicated tablet hardware at physical tables.

### 1.1 Dual Operational Models: Standing Bar vs. Premium / Lounge
1. **Standing Bar Model:** High-velocity counter service where customer entry fees generate a **redemption pass** for complimentary items (scanned and redeemed atomically by bartenders at `/bartender/scan`). No table-side dining, self-ordering cart, or post-session bills.
2. **Premium / Lounge Model:** Table-side dining experience where customer entry fees unlock a **self-ordering mobile web portal** (`/customer/access/:tokenNumber`). The customer orders food and drinks, KOTs route to Kitchen/Bar KDS, servers deliver table-side, and final billing accounts for complimentary allowances, excess items, 5% Service Charge, 5% GST, and entry credit.

### 1.2 Core Architectural Principles:
1. **Separation of Concerns:** Clear boundary separation between Presentation, API Gateway, Business Services, Concurrency/Caching, and Relational Persistence layers.
2. **Real-Time Synchronicity:** Sub-second event broadcasting via WebSockets/Socket.io ensuring zero state lag across stations.
3. **Strict Concurrency & ACID Integrity:** Distributed Redis mutex locking preventing double redemptions and PostgreSQL transactions ensuring consistent financial billing.
4. **Payment-Gated Customer Experience:** Eliminates unverified table occupancy by gating smartphone ordering passes behind receptionist check-in and cover payment verification.

---

## 2. System Architecture & Topology

```mermaid
graph TD
    subgraph Client Tier
        CP[Customer Smartphone Web / Mobile App]
        WT[Waiter Handheld Terminal]
        KK[Kitchen Display System - KDS]
        BK[Bar Display System - KDS]
        BS[Bartender Service Station]
        RD[Reception Check-In Terminal]
        AD[Admin & Executive Dashboard]
        AK[Staff Attendance Kiosk]
    end

    subgraph API Gateway & Security Layer
        CORS[CORS Policy & Express Rate Limiter]
        AuthMW[JWT Auth Middleware & RBAC Guard]
    end

    subgraph Real-Time Communication Broker
        SocketIO[Socket.io Real-Time Broker]
    end

    subgraph Business Service Layer
        TokenSvc[Token & Session Service]
        TableSvc[Table & Floor Layout Service]
        BillingSvc[Billing & Tax Calculation Service]
        RedeemSvc[Drink Redemption Service]
        EmailSvc[Email Notification Service]
        SyncSvc[Data Reconciliation & Sync Service]
    end

    subgraph Caching & Distributed Concurrency Layer
        Redis[(Redis 7.0 / ioredis)]
        LockMgr[Distributed Lock Manager - SETNX]
        SessionCache[Active Session & Table State Cache]
    end

    subgraph Persistence Layer
        Prisma[Prisma ORM Data Access]
        PostgreSQL[(PostgreSQL Relational DB)]
    end

    CP & WT & KK & BK & BS & RD & AD & AK -->|HTTPS / REST| CORS
    CP & WT & KK & BK & BS & RD & AD <-->|WebSockets| SocketIO

    CORS --> AuthMW
    AuthMW --> TokenSvc
    AuthMW --> TableSvc
    AuthMW --> BillingSvc
    AuthMW --> RedeemSvc
    AuthMW --> EmailSvc
    AuthMW --> SyncSvc

    TokenSvc --> LockMgr
    RedeemSvc --> LockMgr
    TableSvc --> SessionCache

    LockMgr --> Redis
    SessionCache --> Redis

    TokenSvc --> Prisma
    TableSvc --> Prisma
    BillingSvc --> Prisma
    RedeemSvc --> Prisma
    SyncSvc --> Prisma

    Prisma --> PostgreSQL
```

---

## 3. End-to-End Data Flow Diagrams

### 3.1 Standing Bar Counter Redemption Flow
```mermaid
sequenceDiagram
    autonumber
    actor Customer
    actor Receptionist
    actor Bartender
    participant API as Express API
    participant Redis as Redis (SETNX Lock)
    participant DB as PostgreSQL (Prisma)

    Customer->>Receptionist: 4 guests arrive at Standing Bar
    Receptionist->>API: POST /api/tokens/checkin (Rate ₹1,000/person -> ₹4,000)
    Receptionist->>Customer: Collects ₹4,000 payment
    Receptionist->>API: PUT /api/tables/:id/assign (Assigns SB-24, Token ACTIVE)
    API-->>Customer: Generates QR Pass (Voucher for complimentary drinks/snacks)
    Customer->>Bartender: Walks to bar counter & presents QR pass
    Bartender->>API: POST /api/redemptions/redeem { tokenNumber, quantity: 1 }
    API->>Redis: SETNX lock:redemption:<token> EX 5
    alt Lock Acquired
        API->>DB: Check redemptionsUsed < totalAllowed (4 max)
        API->>DB: Atomically increment redemptionsUsed & record Redemption
        API->>Redis: DEL lock:redemption:<token>
        API-->>Bartender: 200 OK (Redeemed 1 of 4)
        Bartender->>Customer: Pours drink / hands snack
    else Lock Failed
        API-->>Bartender: 409 Conflict (Concurrent scan in progress)
    end
```

### 3.2 Premium / Lounge Payment-Gated Ordering & Billing Flow
```mermaid
sequenceDiagram
    autonumber
    actor Customer as 5 Lounge Guests
    actor Receptionist
    participant Phone as Customer Mobile Web
    participant API as Express API
    participant DB as PostgreSQL
    participant WS as Socket.io Server
    actor Chef as Kitchen Chef (KDS)
    actor Bar as Bar KDS
    actor Waiter as Waiter Station

    Receptionist->>API: Registers 5 guests for Lounge LNG-08 (₹2,500/person -> ₹12,500)
    API-->>Customer: Sends Email Pass with QR + 'Place Your Order' Button
    Customer->>Phone: Taps 'Place Your Order' before payment verified
    Phone->>API: GET /api/customer/access/:tokenNumber
    API-->>Phone: 403 Forbidden ('Payment is not received. Please contact receptionist')
    Receptionist->>API: Verifies ₹12,500 payment collected
    Customer->>Phone: Taps 'Place Your Order' again
    Phone->>API: GET /api/customer/access/:tokenNumber
    API-->>Phone: 200 OK (Mounts Customer Ordering App)
    Customer->>Phone: Orders 6 snacks + 3 beers
    Phone->>API: POST /api/orders
    API->>WS: Broadcast order.created (Food -> Kitchen KDS, Drinks -> Bar KDS)
    Chef->>API: Mark Food READY -> Waiter delivers to Table LNG-08
    Bar->>API: Mark Drinks READY -> Waiter delivers to Table LNG-08
    Customer->>Phone: Requests Bill
    Waiter->>API: GET /api/bills/live/:tokenNumber (5 snacks free, 1 snack + 3 beers chargeable + 5% SC + 5% GST)
    Waiter->>Customer: Collects balance payment
    Waiter->>API: POST /api/bills/settle
    API->>DB: Prisma $transaction [Bill: PAID, Token: CLOSED, Table: available]
    API->>WS: Broadcast table.session.closed
    WS-->>Phone: Concludes active ordering session
    Customer->>Phone: Re-opening link renders Read-Only Completed Bill Receipt
```

---

# PART 2: LOW-LEVEL DESIGN (LLD)

---

## 4. Database Schema & Entity Relationships

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Station {
  KITCHEN
  BAR
  CASHIER
}

enum FoodType {
  VEG
  NON_VEG
  EGG
}

enum TokenStatus {
  IN_CHECKIN
  ACTIVE
  EXTENDED
  COMPLETED
  CLOSED
  CANCELLED
  EXPIRED
}

enum OrderStatus {
  PLACED
  ACCEPTED
  PREPARING
  READY
  SERVED
  CANCELLED
}

model Role {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  users       User[]
  createdAt   DateTime @default(now())
}

model User {
  id           String    @id @default(uuid())
  username     String    @unique
  passwordHash String
  fullName     String
  pin          String?
  roleId       String
  role         Role      @relation(fields: [roleId], references: [id])
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

model PlaceType {
  id                   String   @id @default(uuid())
  name                 String   @unique
  description          String?
  ratePerPerson        Float    @default(0.0)
  durationMinutes      Int      @default(120)
  redemptionsPerPerson Int      @default(2)
  tables               Table[]
  tokens               Token[]
  createdAt            DateTime @default(now())
}

model Table {
  id             String    @id @default(uuid())
  tableNumber    String    @unique
  capacity       Int       @default(4)
  placeTypeId    String
  placeType      PlaceType @relation(fields: [placeTypeId], references: [id])
  status         String    @default("available") // available, in_checkin, occupied, reserved, maintenance
  currentTokenId String?
  occupiedSince  DateTime?
  tokens         Token[]
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}

model Customer {
  id          String   @id @default(uuid())
  name        String
  phoneNumber String   @unique
  email       String?
  tokens      Token[]
  createdAt   DateTime @default(now())
}

model Token {
  id                      String       @id @default(uuid())
  tokenNumber             String       @unique
  customerId              String
  customer                Customer     @relation(fields: [customerId], references: [id])
  tableId                 String
  table                   Table        @relation(fields: [tableId], references: [id])
  placeTypeId             String
  placeType               PlaceType    @relation(fields: [placeTypeId], references: [id])
  personsCount            Int          @default(1)
  totalRedemptionsAllowed Int          @default(2)
  redemptionsUsed         Int          @default(0)
  entryAmountPaid         Float        @default(0.0)
  paymentVerified         Boolean      @default(false)
  status                  TokenStatus  @default(IN_CHECKIN)
  startTime               DateTime?
  endTime                 DateTime?
  orders                  Order[]
  bills                   Bill[]
  redemptions             Redemption[]
  createdAt               DateTime     @default(now())
  updatedAt               DateTime     @updatedAt
}

model MenuCategory {
  id        String     @id @default(uuid())
  name      String     @unique
  slug      String     @unique
  station   Station    @default(KITCHEN)
  sortOrder Int        @default(0)
  items     MenuItem[]
  createdAt DateTime   @default(now())
}

model MenuItem {
  id          String       @id @default(uuid())
  name        String
  description String?
  basePrice   Float
  categoryId  String
  category    MenuCategory @relation(fields: [categoryId], references: [id])
  station     Station      @default(KITCHEN)
  foodType    FoodType     @default(VEG)
  isAvailable Boolean      @default(true)
  imageUrl    String?
  orderItems  OrderItem[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}

model Order {
  id          String      @id @default(uuid())
  orderNumber String      @unique
  tokenId     String
  token       Token       @relation(fields: [tokenId], references: [id])
  status      OrderStatus @default(PLACED)
  totalAmount Float       @default(0.0)
  items       OrderItem[]
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}

model OrderItem {
  id          String      @id @default(uuid())
  orderId     String
  order       Order       @relation(fields: [orderId], references: [id])
  menuItemId  String
  menuItem    MenuItem    @relation(fields: [menuItemId], references: [id])
  quantity    Int         @default(1)
  unitPrice   Float
  lineTotal   Float
  station     Station     @default(KITCHEN)
  foodType    FoodType    @default(VEG)
  modifiers   Json?
  notes       String?
  status      OrderStatus @default(PLACED)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}

model Bill {
  id                  String   @id @default(uuid())
  billNumber          String   @unique
  tokenId             String
  token               Token    @relation(fields: [tokenId], references: [id])
  foodSubtotal        Float    @default(0.0)
  drinkSubtotal       Float    @default(0.0)
  merchandiseSubtotal Float    @default(0.0)
  subtotal            Float    @default(0.0)
  serviceCharge       Float    @default(0.0) // 5%
  gst                 Float    @default(0.0) // 5%
  discountAmount      Float    @default(0.0)
  rounding            Float    @default(0.0)
  grandTotal          Float    @default(0.0)
  paymentMethod       String?  // CASH, UPI, CARD
  status              String   @default("OPEN") // OPEN, BILL_REQUESTED, PAID
  paidAt              DateTime?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}

model Redemption {
  id          String   @id @default(uuid())
  tokenId     String
  token       Token    @relation(fields: [tokenId], references: [id])
  quantity    Int      @default(1)
  reverted    Boolean  @default(false)
  redeemedBy  String?
  createdAt   DateTime @default(now())
}
```

---

## 5. Concurrency & Concurrency Locking Implementation

```typescript
export async function redeemDrinkAtomic(
  tokenId: string,
  quantity: number = 1,
  staffId?: string
): Promise<{ success: boolean; remaining: number }> {
  const lockKey = `lock:redemption:${tokenId}`;
  const acquired = await redisService.set(lockKey, '1', 'EX', 5, 'NX');

  if (!acquired) {
    throw new Error('A redemption request is already processing for this token.');
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const token = await tx.token.findUnique({
        where: { id: tokenId },
      });

      if (!token) throw new Error('Token not found');
      if (token.status !== 'ACTIVE') throw new Error('Session is not active');
      if (!token.paymentVerified) throw new Error('Entry payment not verified');

      const remaining = token.totalRedemptionsAllowed - token.redemptionsUsed;
      if (remaining < quantity) {
        throw new Error(`Insufficient complimentary allowance. Remaining: ${remaining}`);
      }

      const updated = await tx.token.update({
        where: { id: tokenId },
        data: { redemptionsUsed: { increment: quantity } },
      });

      await tx.redemption.create({
        data: {
          tokenId,
          quantity,
          redeemedBy: staffId || null,
        },
      });

      return {
        success: true,
        remaining: updated.totalRedemptionsAllowed - updated.redemptionsUsed,
      };
    });
  } finally {
    await redisService.del(lockKey);
  }
}
```

---

## 6. Financial Billing Engine

$$\text{Subtotal} = \text{Chargeable Food} + \text{Liquor / Drinks} + \text{Merchandise}$$
$$\text{Service Charge (5\%)} = \text{round}\left(\frac{\text{Subtotal} \times 5}{100}\right)$$
$$\text{Taxable Amount} = \text{Subtotal} + \text{Service Charge}$$
$$\text{GST (5\%)} = \text{round}\left(\frac{\text{Taxable Amount} \times 5}{100}\right)$$
$$\text{Grand Total} = \text{Taxable Amount} + \text{GST} + \text{Rounding}$$
