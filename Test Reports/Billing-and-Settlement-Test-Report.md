# Billing, Taxes & Settlement — Test Report

## 1. Module Overview
The Billing, Taxes and Settlement module handles financial tabulations, item-level GST tax computations (`GstTaxTag`), service charge application (default 5%), advance deposit credits (`amountPaid`), currency rounding, multi-tender payment processing, and final table release upon settlement.

## 2. Scope
- Authoritative bill calculation via `BillingService.calculateBill(tokenNumberOrId)`.
- Item-level GST resolution via relational `GstTaxTag` entities, taking into account the taxable basis including service charge: $\text{itemTaxableBasis} = \text{lineTotal} \times (1 + \text{serviceChargeRate})$.
- Venue configuration overrides (`VenueConfig`: `gstEnabled`, `scEnabled`, `scRate`, `roundingEnabled`).
- Advance deposit deduction from check-in pre-payments (`token.amountPaid`).
- Payment method recording (`PaymentMethod`: `CASH`, `CARD`, `UPI`, `SPLIT`).
- Session closing, table release, and real-time broadcasting via `broadcastBillSettled`.

## 3. Roles Covered
- **Cashier / Receptionist (`receptionist`) / Admin (`admin`)**: Generates bills, applies discounts, records payments, and settles sessions.
- **Customer**: Reviews itemized running bill and tax breakdown.

## 4. Test Environment / Entry Points
- **Web Frontend**: `/billing`, `CustomerSessionsManager.tsx`, `VenueBillingModal.tsx`, `GstManagementModal.tsx`, `api.ts`.
- **Backend API**:
  - `POST /api/bills/calculate` (calls `BillingService.calculateBill`)
  - `POST /api/bills/request`
  - `POST /api/bills/settle` (calls `BillingService.settleBill`)
  - `GET /api/bills/active`
  - `GET /api/config/billing`, `PUT /api/config/billing`
- **Realtime Socket.io Events**: `bill.updated` (`SOCKET_EVENTS.BILL_UPDATED`), `table.session.closed`, `session.updated`.

---

## 5. Test Scenarios

| Test ID | Scenario | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| TC-BILL-001 | Itemized GST Calculation | Table has ₹1000 food order with 5% GST tag; 5% SC active | Call `POST /api/bills/calculate` with `tokenNumber` | Subtotal: ₹1000.00<br>SC (5%): ₹50.00<br>Taxable Basis: ₹1050.00<br>GST (5%): ₹52.50<br>Net Total: ₹1102.50 | Code Verified |
| TC-BILL-002 | Pre-Payment Deposit Deduction | Guest paid ₹500 at Check-In; Total bill is ₹1100 | Compute final bill | Advance Paid: -₹500.00; Net Balance Due: ₹600.00 | Code Verified |
| TC-BILL-003 | Non-Charged Items Exclusion | Order has 1 cancelled item and 1 stock-out item | Calculate bill | Cancelled and stock-out items listed with `lineTotal: 0`, excluded from tax calculation | Code Verified |
| TC-SETTLE-001 | Full Payment Settlement (UPI) | Balance due is ₹600.00 | Call `POST /api/bills/settle` with `paymentMethod: 'UPI'` | Bill marked settled; `Token.status` updated to `CLOSED`; table released; `bill.updated` & `session.updated` broadcast | Code Verified |
| TC-SETTLE-002 | Split Payment (Cash + Card) | Balance due is ₹1000.00 | Settle with ₹400 Cash + ₹600 Card | Split transaction records saved; bill fully settled | Code Verified |
| TC-BILL-004 | Venue Config SC Disabling | Admin disables service charge in Venue Config | Re-calculate bill | Service charge is ₹0.00; GST computed directly on subtotal | Code Verified |

---

## 6. Positive Test Cases
- Decimal precision calculations using `@prisma/client/runtime/library` `Decimal` objects preventing floating-point rounding errors.
- Automatic deduction of advance payments recorded at check-in.
- Real-time event `bill.updated` dispatched to `billing:all`, `customer:token:${tokenNumber}`, and `table:${tableId}`.

## 7. Negative / Validation Test Cases
- Calling bill calculation for non-existent token throws Error ('Table session not found').
- Settling a bill with an amount less than the balance due fails validation.

## 8. Authorization / Permission Test Cases
- Settlement endpoints restricted to staff roles (`admin`, `manager`, `receptionist`).
- Customer tokens cannot invoke settlement or modify discount rates.

## 9. Concurrency / State Tests
- Customer ordering lock prevents new order insertion while cashier is executing settlement transaction.

## 10. Realtime / Socket Tests
- Settling a bill triggers `broadcastBillSettled`, emitting `bill.updated` and `session.updated` (`status: CLOSED`).

## 11. Edge Cases
- Exact zero-balance bill (pre-payment equals total bill): System processes settlement without requiring additional payment.

## 12. Regression Scenarios
- Verify that voided or stock-out order items are clearly rendered with zero charge in consolidated billing summaries.

## 13. Existing Historical Test Coverage
- Verified in historical billing and settlement test documentation.

## 14. Current Codebase Differences / Outdated Cases
- **Taxable Basis with Service Charge**: The backend calculates GST on the service-charge-inclusive taxable basis: $\text{lineTotal} \times (1 + \text{scRate}) \times \text{effectiveGstRate}$.
- **Relational VenueConfig**: Service charge and GST defaults are read dynamically from `venue_configs` table in PostgreSQL.

## 15. Coverage Gaps
- Automated hardware integration testing with external POS payment terminals (EDC swipe machines).

## 16. Final Module Test Summary
The Billing and Settlement module guarantees mathematical accuracy, strict item-level tax compliance, seamless advance credit offset, and atomic session settlement.
