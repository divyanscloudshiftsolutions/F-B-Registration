from abc import ABC, abstractmethod


class StorageBackend(ABC):
    @abstractmethod
    def save(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        """Save file and return public URL path."""

    @abstractmethod
    def delete(self, key: str) -> None:
        pass
