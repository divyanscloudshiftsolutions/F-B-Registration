"""MinIO / S3-compatible object storage."""

from app.config import settings
from app.storage.base import StorageBackend


class S3StorageBackend(StorageBackend):
    def __init__(self):
        bucket = settings.object_storage_bucket
        endpoint = settings.object_storage_endpoint
        access_key = settings.object_storage_access_key
        secret_key = settings.object_storage_secret_key

        if not bucket:
            raise RuntimeError("Object storage bucket not configured (MINIO_BUCKET)")
        if not endpoint:
            raise RuntimeError("Object storage endpoint not configured (MINIO_ENDPOINT)")
        if not access_key or not secret_key:
            raise RuntimeError("Object storage credentials not configured")

        try:
            import boto3
            from botocore.config import Config
        except ImportError as exc:
            raise RuntimeError("boto3 required for object storage. Run: pip install boto3") from exc

        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=settings.object_storage_region,
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        )
        self.bucket = bucket
        self.public_base_url = settings.object_storage_public_url.rstrip("/")

    def _public_url(self, key: str) -> str:
        normalized_key = key.replace("\\", "/").lstrip("/")
        if self.public_base_url:
            return f"{self.public_base_url}/{self.bucket}/{normalized_key}"
        return f"{settings.object_storage_endpoint.rstrip('/')}/{self.bucket}/{normalized_key}"

    def save(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        normalized_key = key.replace("\\", "/").lstrip("/")
        self.client.put_object(
            Bucket=self.bucket,
            Key=normalized_key,
            Body=data,
            ContentType=content_type,
        )
        return self._public_url(normalized_key)

    def delete(self, key: str) -> None:
        normalized_key = key.replace("\\", "/").lstrip("/")
        self.client.delete_object(Bucket=self.bucket, Key=normalized_key)

    def extract_object_key(self, url: str) -> str | None:
        normalized = url.replace("\\", "/")
        if normalized.startswith("/static/"):
            return normalized.removeprefix("/static/").lstrip("/")

        candidates = [
            f"{self.public_base_url}/{self.bucket}/" if self.public_base_url else None,
            f"{settings.object_storage_endpoint.rstrip('/')}/{self.bucket}/",
        ]
        for prefix in candidates:
            if prefix and normalized.startswith(prefix):
                return normalized[len(prefix) :]
        return None

    def presigned_url(self, key: str) -> str:
        normalized_key = key.replace("\\", "/").lstrip("/")
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": normalized_key},
            ExpiresIn=settings.minio_presigned_url_expiry_seconds,
        )

    def get_access_url(self, url: str) -> str:
        if not url:
            return url

        key = self.extract_object_key(url)
        if not key:
            return url

        if settings.minio_use_presigned_urls:
            return self.presigned_url(key)
        return self._public_url(key)
