# API Test Report - FaceMark Biometrics Integration

This report outlines the API test cases, payloads, header requirements, and validation status for the FaceMark biometrics integration restructured in the NFC QR Management System.

---

## 1. Face Enrollment API

* **API Name**: Face Enrollment (Multiple Samples)
* **Endpoint**: `/api/face/register-multiple/{user_id}`
* **HTTP Method**: `POST`
* **Headers**:
  * `Authorization`: `Bearer <JWT_ADMIN_ACCESS_TOKEN>`
* **Request Payload** (`multipart/form-data`):
  * `files`: `[file1, file2, file3]` (exactly 3 JPEG images)
* **Expected Response** (`200 OK`):
  ```json
  {
    "success": true,
    "userId": "uuid-string",
    "profileImageUrl": "https://storage.facemark.app/...",
    "totalImagesSubmitted": 3,
    "successfulEmbeddings": 3,
    "failedEmbeddings": 0,
    "message": "Successfully registered 3 face samples"
  }
  ```
* **Actual Response**: Matches expected schema.
* **Test Status**: **PASS**
* **Observations**: Requires a valid admin access token. The NFC backend automatically handles authentication using seeded admin credentials (`admin@presentsir.com`), retrieves the JWT, and proxies the multiple files to the FaceMark server.

---

## 2. Face Verification API (Quick Kiosk Attendance)

* **API Name**: Kiosk Face Attendance Verification
* **Endpoint**: `/api/attendance/quick`
* **HTTP Method**: `POST`
* **Headers**:
  * `X-Kiosk-Token`: `<KIOSK_API_TOKEN>`
* **Request Payload** (`multipart/form-data`):
  * `file`: `capture.jpg` (single JPEG image)
* **Expected Response** (`200 OK`):
  ```json
  {
    "action": "check-in",
    "userId": "uuid-string",
    "userName": "Alex Mercer",
    "userEmail": "alex@company.com",
    "confidence": 0.9856,
    "matchType": "ensemble"
  }
  ```
* **Actual Response**: Matches expected schema.
* **Test Status**: **PASS**
* **Observations**: Correctly parses raw binary files using standard `globalThis.File` objects. The NFC backend wraps the binary buffer and forwards it, resolving the WebKit boundary and Undici serialization errors.

---

## 3. Error Handling Test Cases

| Test Case | Mock Request Conditions | Expected Response from FaceMark | NFC Backend Translation | Test Status |
| :--- | :--- | :--- | :--- | :--- |
| **Invalid Image Format** | Uploading text/corrupted binary data | `400: {"detail":"Invalid image format"}` | `400: {"success":false,"error":{"message":"The captured photo could not be processed..."}}` | **PASS** |
| **Multiple Faces Detected** | Camera capture with >1 face in frame | `400: {"detail":"Multiple faces detected"}` | `400: {"success":false,"error":{"message":"Multiple faces detected. Please make sure only one person is..."}}` | **PASS** |
| **Invalid Kiosk Token** | Sending wrong value in `X-Kiosk-Token` | `401: {"detail":"Invalid or missing kiosk token"}` | `401: {"success":false,"error":{"message":"Face verification service access failed. Please contact..."}}` | **PASS** |
| **Employee ID Mismatch** | Optional code parameter mismatch | `403: {"detail":"Face does not match employee ID"}` | `401: {"success":false,"error":{"message":"The captured face does not match the selected employee..."}}` | **PASS** |
| **Face Not Recognized** | Unregistered face camera match attempt | `404: {"detail":"Face not recognized..."}` | `400: {"success":false,"error":{"message":"Face not recognized. Please complete face registration first."}}` | **PASS** |
| **Server Offline** | Simulating connection timeout | Network Timeout | `400: {"success":false,"error":{"message":"Unable to connect to the face verification service..."}}` | **PASS** |
