# Present Sir — Python Backend

REST API for the **Present Sir** attendance application, built with **FastAPI** and **PostgreSQL**.

## Prerequisites

- Python 3.11+ (use `py -3` on Windows if `python` is not on PATH)
- PostgreSQL 14+ (or Docker Desktop for the included `docker-compose.yml`)

## Quick start

### 1. Start PostgreSQL

With Docker:

```bash
cd backend
docker compose up -d
```

Or use your own PostgreSQL instance and create a database named `present_sir`.

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` if your database credentials differ.

### 3. Install dependencies

```bash
py -3 -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 4. Run database migrations

```bash
alembic upgrade head
```

### 5. Seed default users (optional)

```bash
python scripts/seed.py
```

Default accounts:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@presentsir.com` | `Admin@123` |
| Employee | `employee@presentsir.com` | `Employee@123` |

### 6. Run the API

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API: http://localhost:8000
- Swagger docs: http://localhost:8000/docs
- Health check: http://localhost:8000/api/health

## API overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Employee registration |
| POST | `/api/auth/login` | Employee login (returns JWT) |
| POST | `/api/auth/admin/register` | Admin registration |
| POST | `/api/auth/admin/login` | Admin login (returns JWT) |
| GET | `/api/auth/me` | Current user profile |
| GET | `/api/users` | List users (admin) |
| GET | `/api/users/by-email/{email}` | Get user by email |
| GET | `/api/attendance` | List attendance records |
| GET | `/api/attendance/email/{email}` | Attendance by email |
| POST | `/api/attendance` | Create attendance record |
| PATCH | `/api/attendance/{id}` | Update record (approve/reject) |
| GET | `/api/weekoffs` | List week-off requests |
| POST | `/api/weekoffs` | Create week-off request |
| POST | `/api/upload` | Upload profile/attendance photo |

Send the JWT in the `Authorization: Bearer <token>` header for protected routes.

## Project structure

```
backend/
├── app/
│   ├── main.py          # FastAPI app entry point
│   ├── config.py        # Settings from .env
│   ├── database.py      # SQLAlchemy engine & session
│   ├── models.py        # PostgreSQL tables
│   ├── schemas.py       # Request/response models
│   ├── services.py      # Auth & helpers
│   ├── deps.py          # Route dependencies
│   └── routers/         # API route modules
├── uploads/             # Local file storage
├── docker-compose.yml   # PostgreSQL container
├── requirements.txt
└── .env.example
```

## Frontend integration

The frontend currently uses Firebase. To switch to this backend:

1. Set `VITE_API_URL=http://localhost:8000` in the frontend `.env`
2. Replace Firebase service calls with `fetch` to the endpoints above
3. Store the JWT from login in `localStorage` and attach it to requests

Response field names use **camelCase** (`userId`, `userName`, `imageUrl`, etc.) to match the existing React types.
