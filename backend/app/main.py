from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.chat import router as chat_router
from app.routers.opportunities import router as opportunities_router
from app.routers.alerts import router as alerts_router
from app.routers.admin import router as admin_router
from app.services.scheduler import scheduler_lifespan

app = FastAPI(
    title="SOIP API",
    description="Student Opportunity Intelligence Platform — RAG-powered opportunity discovery",
    version="0.1.0",
    lifespan=scheduler_lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(chat_router)
app.include_router(opportunities_router)
app.include_router(alerts_router)
app.include_router(admin_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"message": "SOIP API", "version": "0.1.0", "docs": "/docs"}
