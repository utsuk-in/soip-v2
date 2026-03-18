import enum


class OpportunityCategory(str, enum.Enum):
    HACKATHON = "hackathon"
    GRANT = "grant"
    FELLOWSHIP = "fellowship"
    INTERNSHIP = "internship"
    COMPETITION = "competition"
    SCHOLARSHIP = "scholarship"
    PROGRAM = "program"
    OTHER = "other"


class OpportunityStatus(str, enum.Enum):
    OPEN = "open"
    COMING_SOON = "coming_soon"
    EXPIRED = "expired"


class OpportunityMode(str, enum.Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    HYBRID = "hybrid"


class FeeType(str, enum.Enum):
    FREE = "free"
    PAID = "paid"
