# Service Requests & Guest Assistance — Test Report

## 1. Module Overview
The Service Requests module enables seated customers to trigger on-demand assistance (e.g., "Water Refill", "Extra Cutlery", "Napkins", "Clean Up", "Bill Request", "Order Assistance") directly from their mobile menu, featuring atomic active request deduplication and real-time dispatching to floor staff.

## 2. Scope
- Mobile menu quick-action assistance sheet (`CallWaiterSheet.tsx`).
- Standardized request types (`ServiceRequestType`: `WATER`, `CUTLERY`, `NAPKINS`, `CLEAN_UP`, `BILL_REQUEST`, `BILL_ASSISTANCE`, `ORDER_ASSISTANCE`, `OTHER`).
- Lifecycle status progression (`ServiceRequestStatus`: `NEW` $\rightarrow$ `ACKNOWLEDGED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `COMPLETED` / `CANCELLED`).
- Authoritative Active Request Deduplication: Re-requesting the same assistance while a `NEW` request is open returns a friendly confirmation without spamming staff.
- Real-time event broadcasting to `staff:requests` and customer session rooms.

## 3. Roles Covered
- **Customer / Guest**: Triggers service requests from mobile browser.
- **Waiter / Server (`waiter`)**: Receives live service alerts in `staff:requests`, acknowledges, and fulfills requests.
- **Receptionist (`receptionist`)**: Fallback oversight for active service calls.

## 4. Test Environment / Entry Points
- **Web Frontend**: `CallWaiterSheet.tsx`, `WaiterStationPage.tsx`, `StaffLiveNotificationStack.tsx`, `api.ts`.
- **Backend API**:
  - `POST /api/service-requests` (calls `ServiceRequestService.createRequest`)
  - `GET /api/service-requests` (retrieves active requests)
  - `PATCH /api/service-requests/:id/status`
- **Realtime Socket.io Events**: `service_request.created`, `service_request.updated`.

---

## 5. Test Scenarios

| Test ID | Scenario | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| TC-SR-001 | Customer Creates Service Request | Customer on `/order` with active token | Open Call Waiter $\rightarrow$ select "WATER" $\rightarrow$ submit | Request created in DB (`status: NEW`); returns `message: "Waiter has been notified."`; `service_request.created` broadcast | Code Verified |
| TC-SR-002 | Active Request Deduplication | Open `WATER` request in `NEW` status exists | Customer taps "WATER" again | System detects active request, returns `alreadyActive: true`, message: "You have already requested assistance. Your waiter has been notified and will acknowledge your request." (No duplicate socket alert) | Code Verified |
| TC-SR-003 | Realtime Alert at Waiter Station | Request created for Table T-03 | Waiter viewing `/waiter` | Event `service_request.created` received in `staff:requests`; audio chime sounds; request card appears | Code Verified |
| TC-SR-004 | Staff Acknowledges Request | Request is in `NEW` status | Waiter taps "Acknowledge" | Status updates to `ACKNOWLEDGED`; `service_request.updated` broadcast; customer screen updates | Code Verified |
| TC-SR-005 | Complete Service Request | Request is in `ACKNOWLEDGED` status | Waiter delivers item, taps "Complete" | Status updates to `COMPLETED`; card dismissed from active alerts queue | Code Verified |
| TC-SR-006 | Customer Request with Inactive Session | Token is `EXPIRED` or `CLOSED` | Attempt to submit service request | Request rejected: "Cannot request service. This table session is no longer active." | Code Verified |

---

## 6. Positive Test Cases
- Fast end-to-end request delivery via `staff:requests` WebSocket channel.
- Accurate mapping of user-friendly category labels to `ServiceRequestType` enum values.
- Clear visual state feedback on customer's phone during each phase.

## 7. Negative / Validation Test Cases
- Submitting request without active table token rejected.
- Request with missing table assignment returns 400 Bad Request ("No active table assigned to this session.").

## 8. Authorization / Permission Test Cases
- Only staff roles (`waiter`, `receptionist`, `admin`, `manager`) can acknowledge and complete service requests.
- Customer tokens can only trigger requests for their own assigned table.

## 9. Concurrency / State Tests
- Multiple guests at the same table tapping "Water": Deduplication transaction ensures only one active database record is created.

## 10. Realtime / Socket Tests
- New requests emit `service_request.created` to `staff:requests` and `customer:token:${tokenNumber}`.
- Status changes emit `service_request.updated` to all subscribed listeners.

## 11. Edge Cases
- Customer requests "Bill Request": Service request is created AND table transitions to billing status if configured.

## 12. Regression Scenarios
- Verify that multiple simultaneous service requests from different tables stack cleanly in the waiter request list without UI clipping.

## 13. Existing Historical Test Coverage
- Verified in historical service request and waiter station test documentation.

## 14. Current Codebase Differences / Outdated Cases
- **Authoritative Database Deduplication**: Implemented in `ServiceRequestService.ts` via atomic transaction looking for existing `NEW` status requests before inserting.
- **Strict Enum Mapping**: Service request types are mapped strictly to `ServiceRequestType` enum values (`WATER`, `CUTLERY`, `NAPKINS`, `CLEAN_UP`, `BILL_REQUEST`, `BILL_ASSISTANCE`, `ORDER_ASSISTANCE`, `OTHER`).

## 15. Coverage Gaps
- Automated push notification delivery testing on locked mobile screens.

## 16. Final Module Test Summary
The Service Requests module ensures instant guest-to-staff communication, atomic spam prevention through deduplication, and complete lifecycle traceability.
