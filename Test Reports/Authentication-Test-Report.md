# Authentication & Access Control — Test Report

## 1. Module Overview
The Authentication module manages staff login, local database session tracking via `StaffSession` with fallback to external Auth API validation, active user status checks, role-based route/API protection via Express middleware (`authenticate`, `authorize`), and user logout.

## 2. Scope
- Staff Login via Username and Password (`POST /api/auth/login`).
- Session validation via `StaffSession` database records (`expiresAt` check).
- Role-based authorization via `authorize(['admin', 'receptionist', 'manager', 'waiter', 'chef', 'bartender'])`.
- Active user status verification (`User.isActive = true`), rejecting disabled accounts (`AUTH_DEACTIVATED`).
- Session termination and session record deletion (`POST /api/auth/logout`).
- User registration (`POST /api/auth/register`, Admin only).
- Authenticated user profile retrieval (`GET /api/auth/me`).

## 3. Roles Covered
- **Admin (`admin`)**: Access to all endpoints, configuration, user registration, and system settings.
- **Receptionist (`receptionist`)**: Access to floor tables, guest check-in, reservations, and billing.
- **Waiter (`waiter` / `server`)**: Access to Waiter Station, table ordering, ready queue, and session extensions.
- **Chef (`chef`)**: Access to Kitchen KDS station and food availability toggles.
- **Bartender (`bartender`)**: Access to Bar KDS station and bar drink availability toggles.
- **Manager (`manager`)**: Elevated operational privileges, table unlocking override, and floor oversight.

## 4. Test Environment / Entry Points
- **Web Frontend**: `/login`, `LoginPage.tsx`, `AuthContext.tsx`, `api.ts`.
- **Backend API**:
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
  - `POST /api/auth/register` (Admin only)
- **Middleware**: `authenticate` (validates `Bearer <token>` against `staff_sessions` table in PostgreSQL and JWT fallback), `authorize(allowedRoles)`.

---

## 5. Test Scenarios

| Test ID | Scenario | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| TC-AUTH-001 | Valid Staff Login | User exists in DB with hashed password and `isActive: true` | Submit matching username and password to `POST /api/auth/login` | Returns 200 OK, `token` (session UUID), and `user` object (`id`, `username`, `fullName`, `role`); session created in `staff_sessions` | Code Verified |
| TC-AUTH-002 | Empty Credentials Validation | Login form active | Submit empty username or password | Returns 400 Bad Request (`VAL_001`: "Username and password are required") | Code Verified |
| TC-AUTH-003 | Invalid Password Rejection | User exists in DB | Submit correct username with wrong password | Returns 401 Unauthorized (`AUTH_001`: "Invalid username or password") | Code Verified |
| TC-AUTH-004 | Deactivated Staff Account Block | User record has `isActive: false` | Attempt login with valid credentials | Returns 401 Unauthorized (`AUTH_DEACTIVATED`: "Access denied. Contact your administrator.") | Code Verified |
| TC-AUTH-005 | Missing Bearer Token on Protected API | Protected route called (e.g., `GET /api/tables`) | Send HTTP request without `Authorization` header | Middleware `authenticate` returns 401 Unauthorized (`AUTH_NO_TOKEN`: "Authentication required") | Code Verified |
| TC-AUTH-006 | Expired Session Token | `StaffSession.expiresAt` is in the past | Call protected endpoint with expired token | Middleware rejects session; client removes local storage items and redirects to login | Code Verified |
| TC-AUTH-007 | Role Authorization Enforcement | Authenticated as `waiter` | Send request to Admin route `POST /api/tables` | Middleware `authorize(['admin'])` returns 403 Forbidden (`AUTH_FORBIDDEN`: "Forbidden: Insufficient privileges") | Code Verified |
| TC-AUTH-008 | User Logout | Active session exists in DB | Call `POST /api/auth/logout` with Bearer token | `StaffSession` deleted from database; client clears `bar_web_token` and `bar_web_user` | Code Verified |
| TC-AUTH-009 | User Profile Fetch (`/auth/me`) | Valid session active | Call `GET /api/auth/me` with Bearer token | Returns 200 OK with authenticated user details (`id`, `username`, `name`, `role`) | Code Verified |

---

## 6. Positive Test Cases
- Successful authentication creates a `StaffSession` record with a 7-day expiration timestamp.
- User profile retrieval via `GET /api/auth/me` normalizes role names to uppercase strings for frontend compatibility.
- Clean session cleanup from `staff_sessions` upon explicit logout.

## 7. Negative / Validation Test Cases
- Missing username or password returns `VAL_001`.
- Incorrect password returns `AUTH_001`.
- Deactivated user returns `AUTH_DEACTIVATED`.
- Calling protected routes without `Bearer` prefix or token returns `AUTH_NO_TOKEN`.

## 8. Authorization / Permission Test Cases
- Routes protected by `authorize(['admin'])` reject requests from `receptionist`, `waiter`, `chef`, and `bartender` with 403 `AUTH_FORBIDDEN`.
- Front-desk operations protected by `authorize(['receptionist', 'admin', 'manager'])` permit access to authorized roles.

## 9. Concurrency / State Tests
- Multiple simultaneous logins by the same user account generate independent `StaffSession` UUIDs without invalidating previous sessions.

## 10. Realtime / Socket Tests
- Socket connection handshake in `backend/src/realtime/socket.ts` validates `auth.token` against `staff_sessions` in PostgreSQL, extracting user role and joining role rooms (`role:${role}`, `staff:all`).

## 11. Edge Cases
- User deactivated by Administrator while session is active: Next request to protected endpoint queries DB and returns `AUTH_DEACTIVATED`, immediately logging out client.

## 12. Regression Scenarios
- Page refresh in browser re-validates token against `localStorage` without unexpected auth state reset.

## 13. Existing Historical Test Coverage
- Verified in historical test report: `2026-08-19-Administration-Page-End-to-End-Alignment-Verification.md` (Role definitions and credential checks).

## 14. Current Codebase Differences / Outdated Cases
- **Database-Backed Sessions**: The application uses database records in `staff_sessions` (`StaffSession` model) alongside JWT verification.
- **Normalized Role Access**: Backend relies on Express middleware `authenticate` and `authorize(allowedRoles)` rather than monolithic permission tables.

## 15. Coverage Gaps
- Automated multi-factor authentication (MFA) OTP workflow testing (feature not implemented in current codebase).

## 16. Final Module Test Summary
The Authentication module provides verified database-backed session validation, role-based endpoint isolation, explicit error handling, and clean session lifecycle management.
