# Staff Attendance & Facial Recognition — Test Report

## 1. Module Overview
The Staff Attendance module provides contactless biometric attendance verification via browser camera stream capture, live frame extraction, and a dedicated backend proxy endpoint (`POST /api/attendance/quick`) integrating with the FaceMark facial recognition microservice.

## 2. Scope
- Browser camera stream lifecycle management in `QuickAttendanceWebPage.tsx` (`startCamera`, `stopCameraInternal`, visibility change pause/resume).
- Frame capture via HTML5 Canvas (`attendance_capture.jpg`) and multipart form submission.
- Optional employee code input for targeted facial verification.
- Backend proxy endpoint (`POST /api/attendance/quick`) forwarding image binary to FaceMark service with `X-Kiosk-Token`.
- Real-time user feedback with toast alerts and attendance confirmation cards.

## 3. Roles Covered
- **Staff Members (All Roles)**: Conduct quick biometric check-in upon shift arrival.
- **Admin (`admin`)**: Accesses attendance records and configures device access.

## 4. Test Environment / Entry Points
- **Web Frontend**: `/quick-attendance`, `QuickAttendanceWebPage.tsx`.
- **Backend API**:
  - `POST /api/attendance/quick` (accepts multipart `file` upload or `photoBase64`)
- **External Integration**: FaceMark Facial Attendance microservice (`FACEMARK_API_BASE` or `https://api.facemark.app.cloudshiftsolutions.in/api/attendance/quick`).

---

## 5. Test Scenarios

| Test ID | Scenario | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| TC-ATT-001 | Camera Activation & Stream Display | Camera permissions granted in browser | Open `/quick-attendance` $\rightarrow$ click "Enable Camera" | Camera stream starts (ideal $1280 \times 720$), video feed renders, "Camera enabled successfully" toast shown | Code Verified |
| TC-ATT-002 | Camera Access Denied Handling | Browser camera permission blocked | Open `/quick-attendance` $\rightarrow$ click "Enable Camera" | Error banner displayed: "Camera access required for facial attendance. Please check browser permissions." | Code Verified |
| TC-ATT-003 | Page Visibility Lifecycle Management | Camera active in browser | Switch to another browser tab or minimize window | `handleVisibilityChange` triggers `stopCameraInternal()`; stream stops cleanly to conserve hardware resources | Code Verified |
| TC-ATT-004 | Facial Attendance Verification (Success) | Staff enrolled in FaceMark | Align face, enter employee code (optional), click "Record Attendance" | Frame captured, sent via `POST /api/attendance/quick`; returns success message with staff name and check-in timestamp | Code Verified |
| TC-ATT-005 | Missing Image Validation | Request sent without image file | Send `POST /api/attendance/quick` without multipart `file` | Backend returns 400 Bad Request: "Image file is required for attendance verification." | Code Verified |
| TC-ATT-006 | Attendance Registration Locked | Period locked on server | Submit facial capture | Backend returns friendly error: "Attendance registration is currently locked for this period." | Code Verified |

---

## 6. Positive Test Cases
- Clean camera start and stop controls with explicit user visual indicators.
- Automatic hardware stream teardown preventing lingering webcam indicators when navigating away.
- Clear confirmation dialog showing employee name, action (check-in/check-out), and timestamp upon successful recognition.

## 7. Negative / Validation Test Cases
- Missing image payload caught by multer middleware before microservice proxy call.
- Network disconnection during verification displays "Unable to connect to attendance verification service."

## 8. Authorization / Permission Test Cases
- Dedicated public kiosk access allowed on `/quick-attendance` for mounted wall tablets.
- Management of enrolled biometric profiles restricted to Admin.

## 9. Concurrency / State Tests
- Successive punch-in submissions by different staff members processed independently without stream restarts.

## 10. Realtime / Socket Tests
- Verified attendance events emit presence updates to manager dashboard if socket is connected.

## 11. Edge Cases
- Low ambient lighting or occluded face: FaceMark service returns recognition failure; UI prompts user: "Unable to recognize your face. Please look at the camera clearly and try again."

## 12. Regression Scenarios
- Verify that camera stream releases cleanly when unmounting component to prevent memory leaks in long-running kiosk mode.

## 13. Existing Historical Test Coverage
- Verified in historical staff attendance and biometric kiosk testing records.

## 14. Current Codebase Differences / Outdated Cases
- **FaceMark Proxy Architecture**: Implemented as a clean Express multipart proxy (`POST /api/attendance/quick`) utilizing `multer` and `fetch` rather than local native C++ OpenCV bindings.

## 15. Coverage Gaps
- Automated end-to-end integration tests requiring live camera hardware and active FaceMark cloud endpoints.

## 16. Final Module Test Summary
The Staff Attendance module provides contactless biometric verification, clean camera stream management, and resilient error handling for staff check-ins.
