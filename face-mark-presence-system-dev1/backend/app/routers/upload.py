import time
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.deps import get_current_admin, get_current_user
from app.models import User
from app.schemas import UploadResponse
from app.services.storage_service import save_file

router = APIRouter(prefix="/upload", tags=["upload"])

ALLOWED_FOLDERS = {"user-photos", "attendance-photos", "uploads", "employee-documents"}


def _content_type(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".pdf": "application/pdf",
    }.get(ext, "application/octet-stream")


async def _store_upload(file: UploadFile, folder: str) -> str:
    if folder not in ALLOWED_FOLDERS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid upload folder")

    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Filename is required")

    safe_name = Path(file.filename).name
    stored_name = f"{int(time.time() * 1000)}_{safe_name}"
    key = f"{folder}/{stored_name}"
    content = await file.read()
    return save_file(key, content, _content_type(safe_name))


@router.post("", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    folder: str = Form(default="uploads"),
    _: User = Depends(get_current_user),
):
    url = await _store_upload(file, folder)
    return UploadResponse(url=url)


@router.post("/admin", response_model=UploadResponse)
async def admin_upload_file(
    file: UploadFile = File(...),
    folder: str = Form(default="employee-documents"),
    _: User = Depends(get_current_admin),
):
    url = await _store_upload(file, folder)
    return UploadResponse(url=url)
