import uuid

import pytest

from app.models.alert import UserAlert
from app.models.chat import ChatMessage, ChatSession
from app.models.opportunity import Opportunity
from app.utils.enums import OpportunityCategory
from app.models.university import University
from app.models.user import User
from app.services.auth import create_access_token, hash_password


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_university(db, suffix: str) -> University:
    uni = University(
        name=f"test-soip-{suffix}",
        city="Test City",
        state="TS",
        country="India",
        website="https://example.edu",
    )
    db.add(uni)
    db.commit()
    db.refresh(uni)
    return uni


def _create_user(db, suffix: str, university_id=None) -> User:
    user = User(
        email=f"test-soip-{suffix}@example.com",
        password_hash=hash_password("Password123!"),
        university_id=university_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _create_opportunity(db, suffix: str) -> Opportunity:
    opp = Opportunity(
        title=f"Test Opp {suffix}",
        description="Test description",
        category=OpportunityCategory.HACKATHON,
        domain_tags=["AI"],
        eligibility="Students",
        benefits="Experience",
        deadline=None,
        url=f"https://example.com/opps/{suffix}",
        source_url="https://example.com/source",
        is_active=True,
    )
    db.add(opp)
    db.commit()
    db.refresh(opp)
    return opp


def _cleanup(db, suffix: str) -> None:
    db.query(UserAlert).filter(UserAlert.reason.like(f"%{suffix}%")).delete()
    db.query(ChatMessage).filter(ChatMessage.content.like(f"%{suffix}%")).delete()
    db.query(ChatSession).filter(ChatSession.title.like(f"%{suffix}%")).delete()
    db.query(Opportunity).filter(Opportunity.url.like(f"%{suffix}%")).delete()
    db.query(User).filter(User.email.like(f"%{suffix}%")).delete()
    db.query(University).filter(University.name.like(f"%{suffix}%")).delete()
    db.commit()


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_auth_register_login_me(client, db_session, unique_id):
    suffix = unique_id
    try:
        uni = _create_university(db_session, suffix)
        register = client.post(
            "/api/auth/register",
            json={
                "email": f"test-soip-{suffix}@example.com",
                "password": "Password123!",
                "university_id": str(uni.id),
            },
        )
        assert register.status_code == 201
        token = register.json()["access_token"]

        me = client.get("/api/auth/me", headers=_auth_headers(token))
        assert me.status_code == 200
        assert me.json()["email"] == f"test-soip-{suffix}@example.com"

        login = client.post(
            "/api/auth/login",
            json={"email": f"test-soip-{suffix}@example.com", "password": "Password123!"},
        )
        assert login.status_code == 200
        assert "access_token" in login.json()
    finally:
        _cleanup(db_session, suffix)


def test_users_profile_update(client, db_session, unique_id):
    suffix = unique_id
    try:
        user = _create_user(db_session, suffix)
        token = create_access_token(user.id)

        update = client.put(
            "/api/users/profile",
            headers=_auth_headers(token),
            json={
                "first_name": "Test",
                "academic_background": "M.Tech Computer Science",
                "year_of_study": "2nd Year",
                "state": "Tamil Nadu",
                "skills": ["Python"],
                "interests": ["AI"],
                "aspirations": ["hackathon"],
            },
        )
        assert update.status_code == 200
        assert update.json()["is_onboarded"] is True

        profile = client.get("/api/users/profile", headers=_auth_headers(token))
        assert profile.status_code == 200
        assert profile.json()["first_name"] == "Test"
    finally:
        _cleanup(db_session, suffix)


def test_universities_list(client, db_session, unique_id):
    suffix = unique_id
    try:
        _create_university(db_session, suffix)
        resp = client.get("/api/users/universities", params={"q": f"test-soip-{suffix}"})
        assert resp.status_code == 200
        assert any(u["name"] == f"test-soip-{suffix}" for u in resp.json())
    finally:
        _cleanup(db_session, suffix)


def test_opportunities_browse_recommended_get(client, db_session, unique_id):
    suffix = unique_id
    try:
        user = _create_user(db_session, suffix)
        opp = _create_opportunity(db_session, suffix)
        token = create_access_token(user.id)

        browse = client.get(
            "/api/opportunities",
            params={"category": "hackathon", "domain": "AI"},
        )
        assert browse.status_code == 200
        assert any(o["id"] == str(opp.id) for o in browse.json())

        recommended = client.get(
            "/api/opportunities/recommended",
            headers=_auth_headers(token),
        )
        assert recommended.status_code == 200
        assert any(o["id"] == str(opp.id) for o in recommended.json())

        single = client.get(f"/api/opportunities/{opp.id}")
        assert single.status_code == 200
        assert single.json()["id"] == str(opp.id)
    finally:
        _cleanup(db_session, suffix)


def test_recommended_includes_relevance_explanation(client, db_session, unique_id, monkeypatch):
    suffix = unique_id

    async def _fake_generate_relevance_explanations(user, query_text, opportunities):
        ids = [str(o.id) for o in opportunities]
        if not ids:
            return {}
        return {
            ids[0]: "Because your profile mentions AI, this fits your interests. It also aligns with your hackathon goals."
        }

    monkeypatch.setattr(
        "app.routers.opportunities.generate_relevance_explanations",
        _fake_generate_relevance_explanations,
    )

    try:
        user = _create_user(db_session, suffix)
        user.skills = ["Python"]
        user.interests = ["AI"]
        user.aspirations = ["hackathon"]
        db_session.commit()

        opp = _create_opportunity(db_session, suffix)
        token = create_access_token(user.id)

        recommended = client.get(
            "/api/opportunities/recommended",
            headers=_auth_headers(token),
        )
        assert recommended.status_code == 200
        data = recommended.json()
        match = next((o for o in data if o["id"] == str(opp.id)), None)
        assert match is not None
        assert match["relevance_explanation"] is not None
    finally:
        _cleanup(db_session, suffix)


def test_alerts_list_mark_read(client, db_session, unique_id):
    suffix = unique_id
    try:
        user = _create_user(db_session, suffix)
        opp = _create_opportunity(db_session, suffix)
        alert = UserAlert(
            user_id=user.id,
            opportunity_id=opp.id,
            reason=f"test-soip-{suffix}-alert",
        )
        db_session.add(alert)
        db_session.commit()
        db_session.refresh(alert)

        token = create_access_token(user.id)

        listing = client.get("/api/alerts", headers=_auth_headers(token))
        assert listing.status_code == 200
        assert any(a["id"] == str(alert.id) for a in listing.json())

        mark = client.put(f"/api/alerts/{alert.id}/read", headers=_auth_headers(token))
        assert mark.status_code == 200
        assert mark.json()["is_read"] is True
    finally:
        _cleanup(db_session, suffix)


def test_chat_basic_flow(client, db_session, unique_id, monkeypatch):
    suffix = unique_id

    async def _fake_handle_chat_message(db, user, message, session_id=None):
        session = ChatSession(user_id=user.id, title=f"test-soip-{suffix}-session")
        db.add(session)
        db.commit()
        db.refresh(session)

        assistant_msg = ChatMessage(
            session_id=session.id,
            role="assistant",
            content=f"test-soip-{suffix}-reply",
            cited_opportunity_ids=[],
        )
        db.add(assistant_msg)
        db.commit()
        db.refresh(assistant_msg)

        return assistant_msg, [], session.id

    monkeypatch.setattr(
        "app.services.chat.handle_chat_message", _fake_handle_chat_message
    )

    try:
        user = _create_user(db_session, suffix)
        token = create_access_token(user.id)

        send = client.post(
            "/api/chat",
            headers=_auth_headers(token),
            json={"message": "Hello"},
        )
        assert send.status_code == 200
        assert send.json()["message"]["content"] == f"test-soip-{suffix}-reply"

        sessions = client.get("/api/chat/sessions", headers=_auth_headers(token))
        assert sessions.status_code == 200
        assert any(s["title"] == f"test-soip-{suffix}-session" for s in sessions.json())
    finally:
        _cleanup(db_session, suffix)
