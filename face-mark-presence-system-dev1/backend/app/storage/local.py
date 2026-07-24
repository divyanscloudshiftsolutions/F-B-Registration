from pathlib import Path

from app.config import settings
from app.storage.base import StorageBackend


class LocalStorageBackend(StorageBackend):
    def __init__(self, root: str | None = None):
        self.root = Path(root or settings.upload_dir)
        self.root.mkdir(parents=True, exist_ok=True)

    def save(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        path = self.root / key.replace("\\", "/")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return f"/static/{key.replace(chr(92), '/')}"

    def delete(self, key: str) -> None:
        path = self.root / key.replace("\\", "/")
        if path.exists():
            path.unlink()
