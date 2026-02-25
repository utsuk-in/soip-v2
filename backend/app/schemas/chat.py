from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.opportunity import OpportunityOut


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    session_id: UUID | None = None


class ChatMessageOut(BaseModel):
    id: UUID
    role: str
    content: str
    cited_opportunity_ids: list[str] = []
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class ChatResponse(BaseModel):
    message: ChatMessageOut
    cited_opportunities: list[OpportunityOut] = []
    session_id: UUID


class ChatSessionOut(BaseModel):
    id: UUID
    title: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class ChatSessionDetail(BaseModel):
    session: ChatSessionOut
    messages: list[ChatMessageOut] = []
