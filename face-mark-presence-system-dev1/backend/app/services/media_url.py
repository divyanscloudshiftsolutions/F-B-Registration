from app.config import settings
from app.services.storage_service import get_access_url


def resolve_media_url(url: str | None) -> str | None:
    """Return a browser-accessible URL (presigned for private MinIO buckets)."""
    if not url:
        return url

    if settings.uses_object_storage:
        return get_access_url(url)

    if url.startswith("http://") or url.startswith("https://"):
        return url

    return url


def resolve_documents_urls(documents: dict | None) -> dict | None:
    if not documents:
        return documents
    resolved: dict = {}
    for doc_type, meta in documents.items():
        if isinstance(meta, dict) and meta.get("url"):
            resolved[doc_type] = {**meta, "url": resolve_media_url(meta["url"])}
        else:
            resolved[doc_type] = meta
    return resolved
