from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


# --- Excel Upload ---

class StudentRow(BaseModel):
    row_number: int
    name: str
    email: EmailStr
    roll_number: str | None = None
    department: str | None = None
    year_of_study: str | None = None


class RowError(BaseModel):
    row_number: int
    field: str
    message: str


class UploadValidationResponse(BaseModel):
    valid_rows: list[StudentRow]
    errors: list[RowError]
    duplicates: list[str]  # emails already in DB
    total_rows: int


class UploadConfirmRequest(BaseModel):
    students: list[StudentRow]


class UploadSummary(BaseModel):
    total: int
    invited: int
    failed: int
    duplicate_skipped: int


# --- Dashboard ---

class DashboardMetrics(BaseModel):
    total_invited: int
    total_activated: int
    activation_rate: float
    total_views: int
    total_applications: int


class StudentListItem(BaseModel):
    id: UUID
    first_name: str | None = None
    email: str
    department: str | None = None
    year_of_study: str | None = None
    roll_number: str | None = None
    is_onboarded: bool
    is_active: bool
    last_login_at: datetime | None = None
    invited_at: datetime | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class StudentListResponse(BaseModel):
    items: list[StudentListItem]
    total: int
    page: int
    page_size: int


class StudentActivity(BaseModel):
    total_views: int
    total_logins: int
    recent_activity: list[dict]


# --- Engagement ---

class TopOpportunity(BaseModel):
    opportunity_id: UUID
    title: str
    view_count: int


class CategoryBreakdown(BaseModel):
    category: str
    count: int


class EngagementBucket(BaseModel):
    bucket: str
    count: int


class WeeklyTrend(BaseModel):
    week: str
    interactions: int


class MagicLinkStats(BaseModel):
    total_sent: int
    total_used: int
    open_rate: float


class EngagementReport(BaseModel):
    top_opportunities: list[TopOpportunity]
    category_breakdown: list[CategoryBreakdown]
    engagement_distribution: list[EngagementBucket]
    weekly_trends: list[WeeklyTrend]
    magic_link_stats: MagicLinkStats
