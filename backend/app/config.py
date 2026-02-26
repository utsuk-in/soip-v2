from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    model_config = {
        "env_file": ("../.env", ".env"),
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        "extra": "ignore",
    }

    app_name: str = "SOIP API"
    debug: bool = False

    database_url: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/soip_v2"
    )

    openai_api_key: str = Field(default="")
    openai_model: str = Field(default="gpt-4o-mini")
    openai_embedding_model: str = Field(default="text-embedding-3-small")

    jwt_secret: str = Field(default="change-me-in-production")
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 1 week

    allowed_origins: list[str] = ["http://localhost:3000", "http://localhost:8000"]

    # Crawl depth:
    # - html paginated sources: max pages
    # - crawl4ai full_page (infinite scroll): max scroll steps
    crawl_max_pages: int = Field(default=3, description="Global crawl depth. Use 1 for minimal crawl, 3 for first 3 pages/scroll steps.")

    # Extraction: limit segments to process (1 = validate on first "page" only; 3 = first 3; 0 = all).
    extraction_max_segments: int = Field(default=3, description="Limit extraction to first N segments. Use 1 to validate accuracy, then 3 or 0 for full.")

    # Cross-encoder reranker (local)
    rerank_enabled: bool = Field(default=False)
    rerank_model: str = Field(default="cross-encoder/ms-marco-MiniLM-L-6-v2")
    rerank_top_k: int = Field(default=30, ge=1)
    rerank_batch_size: int = Field(default=16, ge=1)

    # Scrape concurrency (parallel sources)
    scrape_concurrency: int = Field(default=1, ge=1)


settings = Settings()
