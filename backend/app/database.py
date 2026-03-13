from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from contextlib import contextmanager
from typing import Generator

from app.config import settings

engine = create_engine(
    settings.database_url,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=300,  # recycle connections every 5 min (Render closes idle after ~10 min)
    connect_args={
        "connect_timeout": 10,         # 10s to establish new connections
        "keepalives": 1,               # enable TCP keepalive
        "keepalives_idle": 30,         # send first probe after 30s idle
        "keepalives_interval": 10,     # 10s between probes
        "keepalives_count": 3,         # 3 failed probes = dead (detected in ~60s)
        "options": "-c statement_timeout=60000",  # 60s server-side query timeout
    },
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that provides a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context() -> Generator[Session, None, None]:
    """Context manager for use outside of FastAPI request cycle (scripts, CLI)."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
