# Administration & Configuration — Test Report

## 1. Module Overview
The Administration module provides venue-level control over physical tables, place type configurations (`PlaceTypeConfig`), menu catalog hierarchy (categories, subcategories, menu items, modifier groups), GST tax tags (`GstTaxTag`), venue billing parameters (`VenueConfig`), staff user accounts, and business dashboard reports.

## 2. Scope
- Physical Table CRUD (`GET /api/tables`, `POST /api/tables`, `PUT /api/tables/:id`, `DELETE /api/tables/:id`).
- Place Type & Rate Configuration (`GET /api/place-types`, `POST /api/place-types`, `PUT /api/place-types/:id`).
- Menu & Category Management (`GET /api/menu/categories`, `POST /api/menu/categories`, `GET /api/menu/items`, `POST /api/menu/items`, `PUT /api/menu/items/:id`, `DELETE /api/menu/items/:id`).
- GST Tax Tag Management (`GET /api/gst-tags`, `POST /api/gst-tags`, `PUT /api/gst-tags/:id`, `GET /api/gst-tags/assignments`, `POST /api/gst-tags/bulk-reassign`).
- Venue Billing Settings (`GET /api/config/billing`, `PUT /api/config/billing` managing `VenueConfig`).
- Staff Account Governance (`GET /api/users`, `POST /api/auth/register`).
- Operational Reporting (`GET /api/reports/dashboard`).

## 3. Roles Covered
- **Admin (`admin`)**: Unrestricted access to all configuration tabs, rate cards, user accounts, and billing parameters.
- **Manager (`manager`)**: Floor oversight, table layout viewing, and operational dashboard review.
- **Non-Admin Roles (`receptionist`, `waiter`, `chef`, `bartender`)**: Explicitly blocked from administrative CRUD actions.

## 4. Test Environment / Entry Points
- **Web Frontend**: `/admin`, `AdminPage.tsx`, `AdminNavTabs.tsx`, `TableManagement.tsx`, `MenuCatalogManager.tsx`, `RateManagement.tsx`, `StaffManagement.tsx`, `GstManagementModal.tsx`, `VenueBillingModal.tsx`, `api.ts`.
- **Backend API**:
  - `POST /api/tables`, `PUT /api/tables/:id`, `DELETE /api/tables/:id`
  - `POST /api/place-types`, `PUT /api/place-types/:id`
  - `POST /api/menu/items`, `PUT /api/menu/items/:id`
  - `GET /api/users`, `POST /api/auth/register`
  - `GET /api/config/billing`, `PUT /api/config/billing`
  - `GET /api/gst-tags`, `POST /api/gst-tags`
  - `GET /api/reports/dashboard`

---

## 5. Test Scenarios

| Test ID | Scenario | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| TC-ADM-001 | Create Physical Table | Admin logged in | Submit `tableNumber: "T-15"`, `placeTypeId`, `capacity: 6` to `POST /api/tables` | Table created in database; returned in table listings; `tables:all` cache cleared | Code Verified |
| TC-ADM-002 | Duplicate Table Check | Table "T-01" exists for same Place Type | Attempt to create table with same number and place type | Database compound unique index `[tableNumber, placeTypeId]` rejects with 400 Bad Request | Code Verified |
| TC-ADM-003 | Delete Occupied Table Block | Table T-03 is currently `occupied` | Attempt to delete Table T-03 via `DELETE /api/tables/:id` | Deletion blocked: "Cannot delete table with active guest session" | Code Verified |
| TC-ADM-004 | Configure Place Type Rates | Admin logged in | Update "VIP Lounge" with `ratePerPerson: 750`, `baseTimeMinutes: 120` | Record updated in `place_types`; `RateLog` entry created for audit | Code Verified |
| TC-ADM-005 | Create Staff User Account | Admin logged in | Submit `username: "alex_waiter"`, `password`, `fullName`, `role: "waiter"` to `POST /api/auth/register` | User created with hashed password, assigned `roleId`; returns 201 Created | Code Verified |
| TC-ADM-006 | Create GST Tax Tag | Admin logged in | Submit `name: "GST 5%"`, `rate: 0.05` to `POST /api/gst-tags` | Tax tag created in `gst_tax_tags` table; available for menu item assignment | Code Verified |
| TC-ADM-007 | Update Venue Billing Settings | Admin logged in | Submit `scEnabled: true`, `scRate: 0.05`, `roundingEnabled: true` to `PUT /api/config/billing` | `venue_configs` updated; immediately applied to subsequent bill calculations | Code Verified |

---

## 6. Positive Test Cases
- Smooth multi-tab navigation across Table Management, Menu Catalog, Rates, Staff, and Billing.
- Audit logging of rate changes recorded in `rate_logs` table (`oldRate`, `newRate`, `changedBy`).
- Dynamic category ordering and item availability management.

## 7. Negative / Validation Test Cases
- Creating a table with negative capacity rejected.
- Adding a user with missing required fields returns 400 `VAL_002` ("All fields are required").
- Creating duplicate category names caught by database constraints.

## 8. Authorization / Permission Test Cases
- Express middleware `authorize(['admin'])` blocks non-admin users from creating, updating, or deleting tables, users, and venue settings.
- Frontend `AdminPage.tsx` checks user role and redirects non-admins to `/dashboard`.

## 9. Concurrency / State Tests
- Two admins updating different place types simultaneously: Atomic SQL updates prevent configuration conflicts.

## 10. Realtime / Socket Tests
- Menu catalog changes broadcast `menu.updated` (`SOCKET_EVENTS.MENU_UPDATED`) to all connected customer and staff clients.

## 11. Edge Cases
- Archiving a menu item that is currently in a customer's active cart: System marks line item unavailable at checkout.

## 12. Regression Scenarios
- Verify that table grid sorting (by Place Type or Table Number) remains consistent after admin updates.

## 13. Existing Historical Test Coverage
- Verified in historical report: `2026-08-19-Administration-Page-End-to-End-Alignment-Verification.md` (Admin tabs, Place types, Table management).

## 14. Current Codebase Differences / Outdated Cases
- **Venue Configuration Model**: Venue tax and service charge settings are managed in a dedicated `VenueConfig` singleton model (`venue_configs` table) rather than hardcoded environment variables.
- **Relational GST Tags**: Tax rates are stored in `GstTaxTag` records linked to `MenuItem` entities.

## 15. Coverage Gaps
- Automated bulk CSV menu import/export schema validator.

## 16. Final Module Test Summary
The Administration module provides comprehensive configuration management, strict administrative authorization, complete audit logging, and instant real-time catalog synchronization.
