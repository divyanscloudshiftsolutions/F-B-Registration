from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers import attendance, auth, dashboard, face, hr, leaves, overtime, payroll, rosters, settings as settings_router, upload, users, weekoffs
from app.security import assert_production_secret_safe

assert_production_secret_safe(settings.environment, settings.secret_key)

app = FastAPI(
    title="Present Sir API",
    description="Face recognition attendance & payroll management system",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(attendance.router, prefix="/api")
app.include_router(weekoffs.router, prefix="/api")
app.include_router(upload.router, prefix="/api")
app.include_router(face.router, prefix="/api")
app.include_router(leaves.router, prefix="/api")
app.include_router(payroll.router, prefix="/api")
app.include_router(overtime.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")
app.include_router(rosters.router, prefix="/api")
app.include_router(hr.router, prefix="/api")

# Legacy local files (pre-MinIO records still stored under uploads/)
upload_path = Path(settings.upload_dir)
upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(upload_path)), name="static")


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "storage": settings.storage_backend,
        "bucket": settings.object_storage_bucket,
    }
