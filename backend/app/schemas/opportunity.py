from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class OpportunityOut(BaseModel):
    id: UUID
    title: str
    description: str
    category: str
    domain_tags: list[str] = []
    raw_domain_tags: list[str] | None = None
    eligibility: str | None = None
    benefits: str | None = None
    deadline: date | None = None
    deadline_at: datetime | None = None
    url: str
    source_url: str
    scrape_page_id: UUID | None = None
    content_chunk_id: UUID | None = None
    confidence: float | None = None
    is_active: bool = True
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class OpportunityBrief(BaseModel):
    """Compact card representation for listings."""
    id: UUID
    title: str
    category: str
    domain_tags: list[str] = []
    deadline: date | None = None
    url: str
    is_active: bool = True

    model_config = {"from_attributes": True}


class OpportunityListResponse(BaseModel):
    items: list[OpportunityOut]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool
