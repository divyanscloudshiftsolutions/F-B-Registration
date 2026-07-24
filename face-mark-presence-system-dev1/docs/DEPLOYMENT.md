# Present Sir — Home Server Deployment

Deploy on CloudShift home server `192.168.1.150`.

## Prerequisites

- Ubuntu server with PostgreSQL, Node.js, Python 3.11+
- `cloudflared` for public tunnel URL
- Repo cloned to `/data/apps/face-mark-presence-system`

## 1. Environment

### Backend (`backend/.env`)

```env
DATABASE_URL=postgresql+psycopg://dev_user:YOUR_PASSWORD@192.168.1.150:5432/presentsir
SECRET_KEY=<long-random-secret>
CORS_ORIGINS=http://192.168.1.150:8080,http://localhost:8080,https://facemark.app.cloudshiftsolutions.in
STORAGE_BACKEND=minio
MINIO_ENDPOINT=https://s3.app.cloudshiftsolutions.in
MINIO_PUBLIC_URL=https://s3.app.cloudshiftsolutions.in
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key
MINIO_BUCKET=presentsir
```

### Frontend (`.env.local`)

```env
# Same-origin: requests go to /api on the tunnel domain; Vite proxies to backend.
VITE_API_URL=
VITE_PROXY_TARGET=http://127.0.0.1:8001

# Must match backend KIOSK_API_TOKEN exactly (Quick Attendance / kiosk).
VITE_KIOSK_TOKEN=<same-long-random-kiosk-token>
```

Do **not** set `VITE_API_URL=http://192.168.1.150:8001` when using the public HTTPS tunnel — browsers block mixed content (HTTPS page → HTTP private IP) and CORS will fail.

### Kiosk token (required for Quick Attendance)

On the server, **both** must be set to the **same** value:

| File | Variable |
|---|---|
| `backend/.env` | `KIOSK_API_TOKEN` |
| `.env.local` (repo root) | `VITE_KIOSK_TOKEN` |

Then **restart** frontend (and backend if you changed `backend/.env`):

```bash
# Example — set matching tokens (generate your own secret; do not reuse this example in production)
TOKEN="$(openssl rand -hex 32)"

# Backend
grep -q '^KIOSK_API_TOKEN=' /data/apps/face-mark-presence-system/backend/.env \
  && sed -i "s|^KIOSK_API_TOKEN=.*|KIOSK_API_TOKEN=${TOKEN}|" /data/apps/face-mark-presence-system/backend/.env \
  || echo "KIOSK_API_TOKEN=${TOKEN}" >> /data/apps/face-mark-presence-system/backend/.env

# Frontend
touch /data/apps/face-mark-presence-system/.env.local
grep -q '^VITE_KIOSK_TOKEN=' /data/apps/face-mark-presence-system/.env.local \
  && sed -i "s|^VITE_KIOSK_TOKEN=.*|VITE_KIOSK_TOKEN=${TOKEN}|" /data/apps/face-mark-presence-system/.env.local \
  || echo "VITE_KIOSK_TOKEN=${TOKEN}" >> /data/apps/face-mark-presence-system/.env.local

# Restart Present Sir services
/data/scripts/start_presence_system.sh
```

Vite embeds `VITE_*` at process start — a frontend restart is required after changing `.env.local`.

## 2. Install

```bash
cd /data/apps/face-mark-presence-system/backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head

cd /data/apps/face-mark-presence-system
npm install
```

## 3. Test locally

```bash
# Terminal 1
cd backend && source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8001

# Terminal 2
npm run dev -- --host 0.0.0.0 --port 8080
```

- API docs: http://192.168.1.150:8001/docs
- UI: http://192.168.1.150:8080

## 4. Production start

Install scripts from ServerHub repo once:

```bash
cd /data/apps/home-server-dashboard
bash deploy/scripts/install-server.sh
```

Start Present Sir only:

```bash
/data/scripts/start_presence_system.sh
```

Or start everything (Present Sir + ServerHub):

```bash
/data/scripts/start_all_services.sh
```

## 5. Logs & monitoring

| Log | Path |
|-----|------|
| Backend | `/data/logs/face-backend.log` |
| Frontend | `/data/logs/face-frontend.log` |
| Tunnel | `/data/logs/face-tunnel.log` |

View in ServerHub dashboard → Applications / Logs pages.

## Port reference

| Service | Port |
|---------|------|
| Backend | 8001 |
| Frontend | 8080 |
