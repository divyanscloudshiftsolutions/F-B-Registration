# NFC & QR Code Management System

An end-to-end event bar and staff management system featuring dual check-in options: **NFC Smart Cards** and **Email QR Tickets**. Shared biometric integration configuration is prepared for future attendance integration.

---

## 📁 Repository Structure

```
├── backend/            # Express, Node.js, Prisma, PostgreSQL, Redis
├── frontend/           # React Native, Expo, NativeWind/Tailwind
├── openapi.yaml        # API Specifications & Endpoint Contracts
├── README.md           # Getting Started, Environment & Deployment Guide
└── _config.yml         # GitHub Pages Jekyll Bypass Configuration
```

---

## 🛠️ Tech Stack

### Backend
* **Core**: Node.js, Express, TypeScript
* **Database & ORM**: PostgreSQL with Prisma ORM
* **Shared Biometrics Base**: FaceMark integration configuration
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

### Frontend (`frontend/.env` or Expo Config)

| Variable | Description | Example Value |
| :--- | :--- | :--- |
| `EXPO_PUBLIC_BACKEND_URL` | Backend Express Base URL | `https://api.nfc-qr.app.cloudshiftsolutions.in` |

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

---

## 🔍 Verification & Diagnostics

| Module | Verification Command |
| :--- | :--- |
| **Backend TypeScript Build** | `cd backend && npx tsc --noEmit` |
| **Frontend TypeScript Build** | `cd frontend && npx tsc --noEmit` |
| **Prisma ORM Generation** | `cd backend && npx prisma generate` |
