import uuid


from app.models.alert import UserAlert
from app.models.chat import ChatMessage, ChatSession
from app.models.interaction_log import InteractionLog
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
        application_link=f"https://example.com/opps/{suffix}",
        source_url="https://example.com/source",
        is_active=True,
    )
    db.add(opp)
    db.commit()
    db.refresh(opp)
    return opp


def _cleanup(db, suffix: str) -> None:
    # Collect test user IDs first for FK-safe deletion
    test_users = db.query(User.id).filter(User.email.like(f"%{suffix}%")).all()
    test_user_ids = [u[0] for u in test_users] if test_users else []

    db.query(UserAlert).filter(UserAlert.reason.like(f"%{suffix}%")).delete()
    db.query(ChatMessage).filter(ChatMessage.content.like(f"%{suffix}%")).delete()
    # Delete sessions by user_id (title may not contain the suffix)
    if test_user_ids:
        db.query(ChatMessage).filter(
            ChatMessage.session_id.in_(
                db.query(ChatSession.id).filter(ChatSession.user_id.in_(test_user_ids))
            )
        ).delete(synchronize_session=False)
        db.query(ChatSession).filter(ChatSession.user_id.in_(test_user_ids)).delete()
        db.query(InteractionLog).filter(
            InteractionLog.user_id.in_(test_user_ids)
        ).delete()
    db.query(Opportunity).filter(
        Opportunity.application_link.like(f"%{suffix}%")
    ).delete()
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
                "first_name": "Test",
                "academic_background": "Computer Science",
                "year_of_study": "3rd Year",
                "state": "Maharashtra",
                "skills": ["Python"],
                "interests": ["AI"],
                "aspirations": ["Software Engineer"],
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
            json={
                "email": f"test-soip-{suffix}@example.com",
                "password": "Password123!",
            },
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
        resp = client.get(
            "/api/users/universities", params={"q": f"test-soip-{suffix}"}
        )
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
        assert any(o["id"] == str(opp.id) for o in browse.json()["items"])

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


def test_explanations_endpoint(client, db_session, unique_id, monkeypatch):
    """Test the /explanations endpoint generates relevance explanations."""
    suffix = unique_id

    async def _fake_generate_relevance_explanations(user, query_text, opportunities):
        ids = [str(o.id) for o in opportunities]
        if not ids:
            return {}
        return {ids[0]: "Because your profile mentions AI, this fits your interests."}

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

        resp = client.get(
            "/api/opportunities/explanations",
            params={"opportunity_ids": str(opp.id)},
            headers=_auth_headers(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert str(opp.id) in data["explanations"]
        assert len(data["explanations"][str(opp.id)]) > 0
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

    async def _fake_handle_chat_message(
        db, user, message, session_id=None, opportunity_id=None
    ):
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
        "app.routers.chat.handle_chat_message", _fake_handle_chat_message
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


def test_feedback_submit_from_feed(client, db_session, unique_id):
    suffix = unique_id
    try:
        user = _create_user(db_session, suffix)
        opp = _create_opportunity(db_session, suffix)
        token = create_access_token(user.id)

        resp = client.post(
            "/api/feedback",
            headers=_auth_headers(token),
            json={
                "opportunity_id": str(opp.id),
                "value": "thumbs_up",
                "source": "feed",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["value"] == "thumbs_up"
        assert data["source"] == "feed"
        assert data["opportunity_id"] == str(opp.id)

        # Verify DB row
        row = (
            db_session.query(InteractionLog)
            .filter(
                InteractionLog.user_id == user.id,
                InteractionLog.opportunity_id == opp.id,
                InteractionLog.action == "thumbs_up",
            )
            .first()
        )
        assert row is not None
    finally:
        _cleanup(db_session, suffix)


def test_feedback_submit_from_chat(client, db_session, unique_id):
    suffix = unique_id
    try:
        user = _create_user(db_session, suffix)
        opp = _create_opportunity(db_session, suffix)
        token = create_access_token(user.id)

        resp = client.post(
            "/api/feedback",
            headers=_auth_headers(token),
            json={
                "opportunity_id": str(opp.id),
                "value": "thumbs_down",
                "source": "chat",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["value"] == "thumbs_down"
        assert data["source"] == "chat"
    finally:
        _cleanup(db_session, suffix)


def test_feedback_update_value(client, db_session, unique_id):
    suffix = unique_id
    try:
        user = _create_user(db_session, suffix)
        opp = _create_opportunity(db_session, suffix)
        token = create_access_token(user.id)

        # Submit thumbs_up first
        client.post(
            "/api/feedback",
            headers=_auth_headers(token),
            json={
                "opportunity_id": str(opp.id),
                "value": "thumbs_up",
                "source": "feed",
            },
        )

        # Update to thumbs_down
        resp = client.post(
            "/api/feedback",
            headers=_auth_headers(token),
            json={
                "opportunity_id": str(opp.id),
                "value": "thumbs_down",
                "source": "feed",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["value"] == "thumbs_down"

        # Verify only one row exists (upsert, not duplicate)
        count = (
            db_session.query(InteractionLog)
            .filter(
                InteractionLog.user_id == user.id,
                InteractionLog.opportunity_id == opp.id,
                InteractionLog.action.in_(("thumbs_up", "thumbs_down")),
            )
            .count()
        )
        assert count == 1
    finally:
        _cleanup(db_session, suffix)


def test_feedback_batch_get(client, db_session, unique_id):
    suffix = unique_id
    try:
        user = _create_user(db_session, suffix)
        opp1 = _create_opportunity(db_session, f"{suffix}-a")
        opp2 = _create_opportunity(db_session, f"{suffix}-b")
        opp3 = _create_opportunity(db_session, f"{suffix}-c")
        token = create_access_token(user.id)

        # Submit feedback for opp1 and opp2 only
        client.post(
            "/api/feedback",
            headers=_auth_headers(token),
            json={
                "opportunity_id": str(opp1.id),
                "value": "thumbs_up",
                "source": "feed",
            },
        )
        client.post(
            "/api/feedback",
            headers=_auth_headers(token),
            json={
                "opportunity_id": str(opp2.id),
                "value": "thumbs_down",
                "source": "chat",
            },
        )

        # Batch fetch all three
        ids = f"{opp1.id},{opp2.id},{opp3.id}"
        resp = client.get(
            f"/api/feedback/batch?opportunity_ids={ids}",
            headers=_auth_headers(token),
        )
        assert resp.status_code == 200
        feedbacks = resp.json()["feedbacks"]
        assert feedbacks[str(opp1.id)] == "thumbs_up"
        assert feedbacks[str(opp2.id)] == "thumbs_down"
        assert str(opp3.id) not in feedbacks
    finally:
        _cleanup(db_session, f"{suffix}-a")
        _cleanup(db_session, f"{suffix}-b")
        _cleanup(db_session, f"{suffix}-c")
        _cleanup(db_session, suffix)


def test_feedback_requires_auth(client):
    resp = client.post(
        "/api/feedback",
        json={
            "opportunity_id": str(uuid.uuid4()),
            "value": "thumbs_up",
            "source": "feed",
        },
    )
    assert resp.status_code in (401, 403)
