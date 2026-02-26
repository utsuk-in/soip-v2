import uuid
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.main import app


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def unique_id() -> str:
    return str(uuid.uuid4())
