from pydantic_settings import BaseSettings
from pydantic import Field, field_validator


class Settings(BaseSettings):
    model_config = {
        "env_file": ("../.env", ".env"),
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        "extra": "ignore",
    }

    app_name: str = "Steppd API"
    debug: bool = False

    database_url: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/soip_v2"
    )

    openai_api_key: str = Field(default="")
    openai_model: str = Field(default="gpt-4o-mini")
    openai_embedding_model: str = Field(default="text-embedding-3-small")

    jwt_secret: str = Field(default="change-me-in-production")
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 1  # 1 day

    allowed_origins: list[str] = Field(
        default=[
            "http://localhost:3000",
            "http://localhost:8000",
            "http://localhost:5173",
        ]
    )

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def _split_allowed_origins(cls, v):
        if isinstance(v, str):
            parts = [p.strip() for p in v.split(",")]
            return [p for p in parts if p]
        return v

    admin_invite_code: str = Field(default="soip-admin-2026")

    frontend_base_url: str = Field(default="http://localhost:3000")

    # Crawl depth:
    # - html paginated sources: max pages
    # - crawl4ai full_page (infinite scroll): max scroll steps
    crawl_max_pages: int = Field(
        default=3,
        description="Global crawl depth. Use 1 for minimal crawl, 3 for first 3 pages/scroll steps.",
    )

    # Extraction: limit segments to process (1 = validate on first "page" only; 3 = first 3; 0 = all).
    extraction_max_segments: int = Field(
        default=3,
        description="Limit extraction to first N segments. Use 1 to validate accuracy, then 3 or 0 for full.",
    )

    # SMTP email (optional — falls back to console logging when not configured)
    smtp_host: str = Field(default="smtp.gmail.com")
    smtp_port: int = Field(default=587)
    smtp_username: str = Field(default="steppd.soip@gmail.com")
    smtp_password: str = Field(default="zxbcfggqqbzryjdo")
    smtp_from_email: str = Field(default="noreply@soip.app")
    smtp_use_tls: bool = Field(default=True)

    # Password reset
    password_reset_expire_minutes: int = 30
    password_reset_max_per_hour: int = 3

    # Cross-encoder reranker (local)
    rerank_enabled: bool = Field(default=False)
    rerank_model: str = Field(default="cross-encoder/ms-marco-MiniLM-L-6-v2")
    rerank_top_k: int = Field(default=30, ge=1)
    rerank_batch_size: int = Field(default=16, ge=1)

    # Scrape concurrency (parallel sources)
    scrape_concurrency: int = Field(default=1, ge=1)

    # Detail fetch concurrency (parallel opportunities within a source)
    detail_concurrency: int = Field(default=1, ge=1)

    # Timeouts (seconds)
    crawl4ai_startup_timeout_seconds: float = Field(
        default=30.0, ge=1, description="Timeout for Crawl4AI browser startup."
    )
    crawl4ai_timeout_seconds: float = Field(default=60.0, ge=1)
    scrape_timeout_seconds: float = Field(
        default=300.0,
        ge=1,
        description="Timeout for the full scrape_source call per source.",
    )
    openai_timeout_seconds: float = Field(default=180.0, ge=1)
    extraction_timeout_seconds: float = Field(
        default=180.0, ge=1, description="Timeout for extraction step per source."
    )
    detail_timeout_seconds: float = Field(
        default=120.0,
        ge=1,
        description="Timeout for per-item detail enrichment (fetch + extract).",
    )
    item_processing_timeout_seconds: float = Field(
        default=240.0,
        ge=1,
        description="Timeout for per-item processing (detail + upsert).",
    )


settings = Settings()
