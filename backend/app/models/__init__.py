from app.models.base import Base
from app.models.university import University
from app.models.user import User
from app.models.source import Source
from app.models.opportunity import Opportunity
from app.utils.enums import OpportunityCategory, OpportunityStatus
from app.models.chat import ChatSession, ChatMessage
from app.models.alert import UserAlert
from app.models.scrape import ScrapePage, ContentChunk
from app.models.magic_link import MagicLinkToken
from app.models.interaction_log import InteractionLog

__all__ = [
    "Base",
    "University",
    "User",
    "Source",
    "Opportunity",
    "OpportunityCategory",
    "OpportunityStatus",
    "ChatSession",
    "ChatMessage",
    "UserAlert",
    "ScrapePage",
    "ContentChunk",
    "MagicLinkToken",
    "InteractionLog",
]
