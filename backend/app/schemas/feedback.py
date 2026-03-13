from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class FeedbackCreate(BaseModel):
    opportunity_id: UUID
    value: Literal["thumbs_up", "thumbs_down"]
    source: Literal["feed", "chat"]


class FeedbackOut(BaseModel):
    id: UUID
    opportunity_id: UUID
    value: str
    source: str
    created_at: datetime

    class Config:
        from_attributes = True


class FeedbackBatchOut(BaseModel):
    feedbacks: dict[str, str]  # opportunity_id -> value
