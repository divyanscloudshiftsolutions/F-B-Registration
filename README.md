# NFC & QR Code Management System

An end-to-end event bar and staff management system featuring dual check-in options: **NFC Smart Cards**, **Email QR Tickets**, and biometric **Face Recognition (Quick Attendance)** via external FaceMark integration.

---

## 📁 Repository Structure

```
├── backend/            # Express, Node.js, Prisma, PostgreSQL, Redis, FaceMark Service
├── frontend/           # React Native, Expo, NativeWind/Tailwind, Quick Attendance Screen
├── openapi.yaml        # API Specifications & Endpoint Contracts
├── README.md           # Getting Started, Environment & Deployment Guide
└── _config.yml         # GitHub Pages Jekyll Bypass Configuration
```

---

## 🛠️ Tech Stack

### Backend
* **Core**: Node.js, Express, TypeScript
* **Database & ORM**: PostgreSQL with Prisma ORM
* **Biometrics Integration**: FaceMark Quick Attendance API (`POST /api/attendance/quick`)
* **Caching & Queueing**: Redis
* **Object Storage**: MinIO / S3

### Frontend
* **Core**: React Native (Expo SDK 52), TypeScript
* **Styling**: NativeWind (Tailwind CSS)
* **Camera**: Expo Camera (`CameraView`)
* **Deployment**: Expo Application Services (EAS Update)

---

## 🔑 Environment Variables Configuration

### Backend (`backend/.env`)

| Variable | Description | Example / Production Value |
| :--- | :--- | :--- |
| `PORT` | HTTP Server Port | `4000` |
| `NODE_ENV` | Environment Mode | `production` |
| `DATABASE_URL` | PostgreSQL Connection String | `postgresql://user:pass@host:5432/dbname` |
| `JWT_SECRET` | JWT Sign Secret | `super-secret-key` |
| `FACEMARK_API_BASE` | FaceMark Service API URL | `https://api.facemark.app.cloudshiftsolutions.in` |
| `FACEMARK_BEARER_TOKEN` | Shared Kiosk API Token | `<kiosk_token>` |
| `FACEMARK_ADMIN_EMAIL` | FaceMark Admin Email | `admin@presentsir.com` |
| `FACEMARK_ADMIN_PASSWORD` | FaceMark Admin Password | `Admin@123` |

### Frontend (`frontend/.env` or Expo Config)

| Variable | Description | Example Value |
| :--- | :--- | :--- |
| `EXPO_PUBLIC_BACKEND_URL` | Backend Express Base URL | `https://your-backend.up.railway.app` |

---

## 🚀 Quick Start & Local Commands

### 1. Backend Setup & Run

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Generate Prisma client & run database migrations
npx prisma generate
npx prisma migrate dev

# Run development server with ts-node
npm run dev

# Check TypeScript compilation
npx tsc --noEmit

# Build production bundle
npm run build

# Start production server
npm run start
```

### 2. Frontend Setup & Run

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Expo development server
npx expo start

# Check TypeScript compilation
npx tsc --noEmit
```

### 3. EAS Update & Deployment Commands

```bash
# Install EAS CLI globally (or run via npx)
npx eas-cli login

# Publish OTA update to production channel
npx eas-cli update --channel production --message "Strict Quick Attendance biometrics release" --environment production

# Publish OTA update to preview channel
npx eas-cli update --channel preview --message "Strict Quick Attendance biometrics release" --environment production
```

---

## 🧪 Quick Attendance API Testing Commands

### Testing `POST /api/attendance/quick` via `curl`

To test direct FaceMark Quick Attendance verification:

```bash
curl -X POST "https://api.facemark.app.cloudshiftsolutions.in/api/attendance/quick" \
  -H "X-Kiosk-Token: YOUR_FACEMARK_KIOSK_TOKEN" \
  -F "file=@/path/to/face_photo.jpg"
```

#### Expected JSON Response (Success):
```json
{
  "action": "check-in",
  "userId": "usr_9482910a",
  "userName": "John Doe",
  "userEmail": "john@example.com",
  "confidence": 0.94
}
```

### Testing NFC Backend Proxy Endpoint

```bash
curl -X POST "https://your-backend.up.railway.app/attendance/quick" \
  -H "Content-Type: application/json" \
  -d '{"photoBase64": "YOUR_BASE64_IMAGE_STRING"}'
```

#### Expected JSON Response:
```json
{
  "success": true,
  "userName": "John Doe",
  "action": "check-in",
  "confidence": 0.94
}
```

---

## 🔍 Troubleshooting Guide

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| `Unable to recognize your face...` | Face not found in database or low match score (HTTP 404). | Ensure employee face photo has been registered in FaceMark and lighting is bright. |
| `Multiple faces detected...` | More than 1 face in photo frame. | Ensure only a single employee stands in front of the camera. |
| `Image quality is too low...` | Photo is blurry, low resolution, or poorly lit (HTTP 422). | Keep device steady and move to better lighting. |
| `Unable to process attendance right now...` | Connection timeout, DNS failure, or FaceMark HTTP 50x. | Verify internet connection and FaceMark server status. |
| `Face verification service access failed...` | Invalid or missing `X-Kiosk-Token` header. | Verify `FACEMARK_BEARER_TOKEN` in `backend/.env`. |
