from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AlertOut(BaseModel):
    id: UUID
    opportunity_id: UUID
    reason: str
    is_read: bool = False
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
