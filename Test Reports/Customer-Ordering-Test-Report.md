# Customer Ordering & Cart — Test Report

## 1. Module Overview
The Customer Ordering module handles digital menu discovery, dietary filtering, cart management, item customization payloads, order placement (`POST /api/orders`), 3-second idempotency protection, multi-station order routing (Kitchen vs. Bar), and the ordering lock mechanism enforced when a bill is requested.

## 2. Scope
- Mobile menu browsing via QR code / NFC session token URL (`/order?token=...`).
- Dietary tagging (Veg, Non-Veg, Vegan, Spicy, Gluten-Free) and category navigation.
- In-memory cart management and validation via `activeReservationsMap`.
- Order Placement (`POST /api/orders`) with session validation and idempotency check.
- Multi-station routing: Food & Dessert items routed to `KITCHEN` (`kds:kitchen`), Beverages routed to `BAR` (`kds:bar`).
- Ordering Lock on Bill Request: Rejection of orders when table is in `BILL_REQUESTED` or `SETTLING` status.
- Real-time order and item status tracking (`PLACED` $\rightarrow$ `ACCEPTED` $\rightarrow$ `PREPARING` $\rightarrow$ `READY` $\rightarrow$ `SERVED`).

## 3. Roles Covered
- **Customer / Guest**: Browses menu and submits orders from their own smartphone.
- **Waiter (`waiter`)**: Assists guests with table ordering via Waiter Station and reopens locked ordering.
- **Kitchen Chef (`chef`) & Bartender (`bartender`)**: Receives split orders on respective display terminals.

## 4. Test Environment / Entry Points
- **Web Frontend**: `/order`, `/cart`, `CustomerApp.tsx`, `MenuItemCard.tsx`, `ProductCustomizer.tsx`, `api.ts`.
- **Backend API**:
  - `GET /api/menu`
  - `POST /api/orders`
  - `GET /api/orders/active`
  - `POST /api/bills/request`
- **Realtime Socket.io Events**: `order.created`, `order.item.updated`, `bill.updated`, `menu.updated`.

---

## 5. Test Scenarios

| Test ID | Scenario | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| TC-ORD-001 | Browse Menu with Active Token | Table session is `ACTIVE` | Open `/order?token=<TOKEN>` | Menu loads with categories, items, prices, veg badges, and modifier groups | Code Verified |
| TC-ORD-002 | Access Menu with Inactive / Expired Token | Token is in `EXPIRED` or `CLOSED` status | Open `/order?token=<TOKEN>` | Order placement blocked: "Cannot place order. This table session is no longer active." | Code Verified |
| TC-ORD-003 | Order Placement & Station Routing | Cart contains 1 Food item & 1 Drink item | Click "Place Order" | Order created; Food item tagged `station: KITCHEN`, Drink tagged `station: BAR`; `order.created` broadcast to `kds:kitchen` and `kds:bar` | Code Verified |
| TC-ORD-004 | 3-Second Idempotency Double-Click Guard | Guest clicks "Place Order" twice in rapid succession | Rapid double click within 3 seconds | Backend detects duplicate order within 3000ms window, returns existing order without creating duplicate line items | Code Verified |
| TC-LOCK-001 | Order Rejection after Bill Request | Table status is `BILL_REQUESTED` | Customer attempts `POST /api/orders` | Request rejected with error: "Ordering is locked: A bill has already been requested for this table. Please ask staff to reopen ordering." | Code Verified |
| TC-LOCK-002 | Order Placement after Waiter Reopening | Table ordering is locked (`BILL_REQUESTED`) | Waiter clicks "Reopen Ordering" on Waiter Station; customer submits order | Table status reverts to `occupied`; order succeeds (200 OK); items dispatched to KDS | Code Verified |
| TC-ORD-005 | Special Cooking Instructions Delivery | Special note: "No onions, extra spicy" | Submit order | Special instructions stored in `OrderItem.specialInstructions`; rendered on KDS ticket | Code Verified |
| TC-ORD-006 | Payment Verification Gate | Token has `paymentVerified: false` | Attempt to place order | Order rejected: "Cannot place order: Session payment has not been verified yet. Please complete payment at the counter." | Code Verified |

---

## 6. Positive Test Cases
- Responsive mobile menu layout with sticky category bar and search filter.
- Real-time line item status updates (`order.item.updated`) reflected live on customer order tracking screen.
- Clean order separation: Kitchen sees only Food/Dessert items; Bar sees only Beverage items.

## 7. Negative / Validation Test Cases
- Placing an order with an empty `items` array returns 400 Bad Request ("Order must contain at least one item").
- Submitting an order with a token belonging to another table rejected with error ("This table pass is not assigned to this table.").

## 8. Authorization / Permission Test Cases
- Customer session token strictly isolated to its own `tableId` and `tokenId`.
- Customers cannot modify other tables' carts or view another session's orders.

## 9. Concurrency / State Tests
- Multiple guests scanning the same table QR code simultaneously add items and view the shared active order ticket.

## 10. Realtime / Socket Tests
- Placing an order emits `order.created` to `kds:kitchen`, `kds:bar`, `staff:orders`, `customer:token:${tokenNumber}`, and `table:${tableId}`.

## 11. Edge Cases
- Item stock reaches zero while in cart: Server validation checks live availability and prevents checkout of depleted items.

## 12. Regression Scenarios
- Verify cart contents persist across page refreshes using client-side local storage backup.

## 13. Existing Historical Test Coverage
- Verified in historical customer ordering test documentation and UI/UX responsive verification records.

## 14. Current Codebase Differences / Outdated Cases
- **Strict Station Routing**: Food and Beverage items are split into distinct `Station.KITCHEN` and `Station.BAR` records at the database level.
- **Idempotency Protection**: Backend `OrderService.ts` explicitly includes a 3-second database lookup to prevent duplicate submissions from rapid multi-taps.

## 15. Coverage Gaps
- Automated network throttle / packet drop simulation on flaky 3G mobile connections.

## 16. Final Module Test Summary
The Customer Ordering module provides a seamless mobile dining interface, robust station routing, 3-second idempotency safeguards, and authoritative ordering lock enforcement during billing.
