from app.config import settings
from app.storage.s3 import S3StorageBackend


def get_storage() -> S3StorageBackend:
    if not settings.uses_object_storage:
        raise RuntimeError(
            "Local storage is disabled. Set STORAGE_BACKEND=minio and configure MINIO_* env vars."
        )
    return S3StorageBackend()


def save_file(key: str, data: bytes, content_type: str = "image/jpeg") -> str:
    return get_storage().save(key, data, content_type)


def delete_file(key: str) -> None:
    get_storage().delete(key)


def get_access_url(url: str | None) -> str | None:
    if not url:
        return url
    if not settings.uses_object_storage:
        return url
    return get_storage().get_access_url(url)
