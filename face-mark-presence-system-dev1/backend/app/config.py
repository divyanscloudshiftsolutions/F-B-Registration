from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg://dev_user:Sabari%402026@192.168.1.150:5432/presentsir"
    secret_key: str = "dev-secret-key-change-in-production"
    environment: str = "development"  # development | production
    access_token_expire_minutes: int = 1440
    cors_origins: str = "http://localhost:8080,http://127.0.0.1:8080,http://localhost:8081"
    upload_dir: str = "uploads"

    storage_backend: str = "minio"

    minio_endpoint: str = ""
    minio_public_url: str = ""
    minio_access_key: str = ""
    minio_secret_key: str = ""
    minio_bucket: str = "presentsir"
    minio_region: str = "us-east-1"
    minio_use_presigned_urls: bool = True
    minio_presigned_url_expiry_seconds: int = 604800  # 7 days

    # Legacy S3/R2 names (still supported as fallbacks)
    s3_endpoint_url: str = ""
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket: str = ""
    s3_region: str = "auto"
    s3_public_base_url: str = ""

    face_match_threshold: float = 0.85
    face_match_margin: float = 0.08
    min_face_samples: int = 3
    max_face_samples: int = 8
    embedding_version: str = "opencv_v1"

    pf_percentage: float = 12.0
    pf_max_limit: float = 15000.0
    pt_amount: float = 200.0
    standard_work_days_per_month: int = 26

    # Public self-registration is disabled by default; admins create employees.
    allow_public_employee_registration: bool = False
    # Shared secret for /api/attendance/quick (X-Kiosk-Token). Empty = kiosk disabled.
    kiosk_api_token: str = ""
    # Business calendar timezone for attendance/day-status "today" resolution.
    app_timezone: str = "Asia/Kolkata"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def object_storage_endpoint(self) -> str:
        return self.minio_endpoint or self.s3_endpoint_url

    @property
    def object_storage_public_url(self) -> str:
        return self.minio_public_url or self.s3_public_base_url

    @property
    def object_storage_access_key(self) -> str:
        return self.minio_access_key or self.s3_access_key

    @property
    def object_storage_secret_key(self) -> str:
        return self.minio_secret_key or self.s3_secret_key

    @property
    def object_storage_bucket(self) -> str:
        return self.minio_bucket or self.s3_bucket

    @property
    def object_storage_region(self) -> str:
        if self.minio_endpoint:
            return self.minio_region
        return self.s3_region

    @property
    def uses_object_storage(self) -> bool:
        return self.storage_backend.lower() in ("s3", "minio")


settings = Settings()
