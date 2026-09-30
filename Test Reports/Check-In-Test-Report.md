# Check-In & Guest Assignment — Test Report

## 1. Module Overview
The Check-In module handles customer arrival, phone number normalization, returning guest recognition, rate card calculation (`PlaceTypeConfig.ratePerPerson * personsCount`), pre-payment verification, active check-in draft switching (L8 vs L5 dual-lock resolution), and digital dining token creation (`Token`).

## 2. Scope
- Guest validation (10-digit phone normalization, customer name, guest count).
- Rate Card assignment and calculation via `PlaceTypeConfig` (`ratePerPerson`, `baseTimeMinutes`, `redemptionsPerPerson`).
- Dual-Lock Draft Switching Workflow (L8 existing draft vs L5 newly selected table).
- Pre-payment gating (`amountPaid`, `paymentVerified: true` for `ACTIVE` vs `paymentVerified: false` for `PENDING_PAYMENT`).
- Token creation in PostgreSQL (`tokens` table) and automatic table status transition to `occupied`.

## 3. Roles Covered
- **Receptionist (`receptionist`) / Admin (`admin`) / Manager (`manager`)**: Authorized operators for check-in creation, table switching, and fee overrides.
- **Customer**: Guest receiving the issued dining session token.

## 4. Test Environment / Entry Points
- **Web Frontend**: `/checkin`, `/checkin/:tableId`, `CheckInPage.tsx`, `TableDrawer.tsx`, `api.ts`.
- **Backend API**:
  - `POST /api/check-in/activate` (or `POST /api/tokens/create`)
  - `POST /api/check-in/pending`
  - `GET /api/check-in/pending-list`
  - `POST /api/check-in/cancel`
  - `POST /api/tables/:id/lock`
  - `POST /api/tables/:id/unlock`
  - `POST /api/tables/assign`
- **Realtime Socket.io Events**: `table.updated`, `table.session.activated`, `session.updated`.

---

## 5. Test Scenarios

| Test ID | Scenario | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| TC-CHK-001 | Standard Valid Guest Check-In | Table T-02 is available; locked for check-in | Submit Name "John Doe", Phone "9876543210", 2 guests, `paymentVerified: true` to `POST /api/tokens/create` | Returns 200 OK; `Customer` and `Token` created; Table T-02 status updated to `occupied`; `table.session.activated` broadcast | Code Verified |
| TC-CHK-002 | Phone Number Normalization | Check-in form active | Enter 10-digit phone number with formatting (e.g. `+91 98765-43210`) | Backend normalizes phone number to 10 digits (`9876543210`); invalid lengths rejected | Code Verified |
| TC-CHK-003 | Returning Guest Recognition | Customer with phone "9876543210" exists in DB | Enter phone number | System auto-populates existing name, increments `totalVisits`, updates `lastVisit` timestamp | Code Verified |
| TC-SW-001 | Active Draft Switch — Case 1: Resume Check-In | L8 is in active check-in (`in_checkin`); User assigns L5 from Tables | Prompt displayed. User selects "Resume Check-In" for L8 | L8 remains locked and active; L5 is unlocked via `POST /api/tables/L5/unlock` and reverts to `available` | Code Verified |
| TC-SW-002 | Active Draft Switch — Case 2: Stop Check-In | L8 is in active check-in; User assigns L5 | Prompt displayed. User selects "Stop Check-In" $\rightarrow$ Confirms "Yes" | Existing L8 check-in stopped, L8 unlocked via `POST /api/tables/L8/unlock` to `available`; L5 locked and becomes active check-in table | Code Verified |
| TC-GATE-001 | Verified Payment Token State | Place Type rate is ₹500/person for 2 guests | Submit check-in with `amountPaid: 1000`, `paymentVerified: true` | Token created with `amountPaid: 1000.00`, `paymentVerified: true`, `status: ACTIVE`; customer can place orders immediately | Code Verified |
| TC-GATE-002 | Pending Payment Token State | Check-in initiated without immediate payment | Submit check-in to `POST /api/check-in/pending` (`paymentVerified: false`) | Token created with `status: PENDING_PAYMENT`; customer ordering is gated until payment verified | Code Verified |
| TC-DELV-001 | Dynamic QR Code Token Rendering | Token created successfully | Generate QR code representation of `tokenNumber` | Dynamic session QR code rendered on screen for customer scanning | Code Verified |

---

## 6. Positive Test Cases
- Complete guest registration flow creating both `Customer` record and active `Token` linked to `Table`.
- Automatic calculation of session duration (`baseTimeMinutes`) and drink allowances (`redemptionsPerPerson * personsCount`).
- Immediate real-time broadcast of `table.session.activated` updating all staff dashboards.

## 7. Negative / Validation Test Cases
- Check-in without selecting a table or place type rejected with 400 Bad Request.
- Creating a token on a table occupied by another active session fails transaction constraints.
- Invalid or negative person count values rejected before database insert.

## 8. Authorization / Permission Test Cases
- Check-in creation endpoints (`/check-in/activate`, `/tokens/create`, `/check-in/pending`) restricted to `receptionist`, `admin`, and `manager`.
- Waiters attempting to access `/checkin` redirected to `/waiter`.

## 9. Concurrency / State Tests
- Two staff members attempting to check in guests at the same table simultaneously: Atomic lock check ensures only the lock owner completes check-in.
- Clean dual-lock resolution ensuring zero orphaned locks when switching between tables.

## 10. Realtime / Socket Tests
- Completed check-in emits `table.session.activated` to `table:${tableId}`, `customer:token:${tokenNumber}`, `tables:all`, and `staff:all`.

## 11. Edge Cases
- Check-in completed for returning customer whose previous session is closed: Creates new `Token` record without conflicting with historical occupancy logs.
- Network disconnection during check-in: Table lock preserves draft state until lock timeout.

## 12. Regression Scenarios
- Verify that table capacity indicators visually warn if guest count exceeds physical table capacity while still permitting manager override.

## 13. Existing Historical Test Coverage
- Verified in historical test documentation: `TABLE_RESERVATION_ASSIGNMENT_WORKFLOW.md` (Check-in draft switching, pre-payment gate, token generation).

## 14. Current Codebase Differences / Outdated Cases
- **Token Status Enum**: Token statuses in Prisma are strictly `PENDING_PAYMENT`, `ACTIVE`, `CLOSED`, `CANCELLED`, `EXPIRED`, `EXTENDED`.
- **Authoritative Dual-Lock Resolution**: The L8 vs L5 draft switching workflow specifically calls the backend `/unlock` and `/lock` endpoints to ensure clean state transitions.

## 15. Coverage Gaps
- Automated SMS gateway integration delivery testing for phone-based QR receipt delivery.

## 16. Final Module Test Summary
The Check-In module guarantees verified guest data capture, authoritative draft switching mechanics, rate card compliance, and reliable digital token generation.
