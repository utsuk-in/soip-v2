from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.chat import router as chat_router
from app.routers.opportunities import router as opportunities_router
from app.routers.alerts import router as alerts_router

__all__ = [
    "auth_router",
    "users_router",
    "chat_router",
    "opportunities_router",
    "alerts_router",
]
