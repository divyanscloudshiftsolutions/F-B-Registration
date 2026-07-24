"""Upload legacy local files to MinIO and update /static/ URLs in the database."""

from pathlib import Path

from app.config import settings
from app.database import SessionLocal
from app.models import Attendance, FaceEmbedding, PayrollRecord, User
from app.services.media_url import resolve_media_url
from app.services.storage_service import get_storage, save_file


def _local_path(static_url: str) -> Path | None:
    if not static_url.startswith("/static/"):
        return None
    key = static_url.removeprefix("/static/").lstrip("/")
    path = Path(settings.upload_dir) / key
    return path if path.is_file() else None


def _migrate_url(db, url: str | None) -> str | None:
    if not url or not url.startswith("/static/"):
        return url
    local_file = _local_path(url)
    if not local_file:
        return resolve_media_url(url)
    key = url.removeprefix("/static/").lstrip("/")
    content = local_file.read_bytes()
    content_type = "application/pdf" if key.endswith(".pdf") else "image/jpeg"
    return save_file(key, content, content_type)


def main() -> None:
    storage = get_storage()
    print(f"Migrating uploads from {settings.upload_dir} to {settings.object_storage_bucket}")

    db = SessionLocal()
    updated = 0
    try:
        for user in db.query(User).filter(User.user_image.like("/static/%")).all():
            new_url = _migrate_url(db, user.user_image)
            if new_url and new_url != user.user_image:
                user.user_image = new_url
                updated += 1

        for row in db.query(FaceEmbedding).filter(FaceEmbedding.reference_image_url.like("/static/%")).all():
            new_url = _migrate_url(db, row.reference_image_url)
            if new_url and new_url != row.reference_image_url:
                row.reference_image_url = new_url
                updated += 1

        for row in db.query(Attendance).filter(Attendance.image_url.like("/static/%")).all():
            new_url = _migrate_url(db, row.image_url)
            if new_url and new_url != row.image_url:
                row.image_url = new_url
                updated += 1

        for row in db.query(PayrollRecord).filter(PayrollRecord.payslip_url.like("/static/%")).all():
            new_url = _migrate_url(db, row.payslip_url)
            if new_url and new_url != row.payslip_url:
                row.payslip_url = new_url
                updated += 1

        db.commit()
        print(f"Updated {updated} database URLs.")
        print("Storage backend:", type(storage).__name__)
    finally:
        db.close()


if __name__ == "__main__":
    main()
