import pytest
from datetime import datetime, timedelta

from app import create_app
from models import Achievement, Journal, MoodEnum, MoodHistory, Playlist, User, db
from services.profile_service import get_profile_bundle


@pytest.fixture
def app_ctx():
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "JWT_SECRET_KEY": "test-secret-key-32-chars-minimum!!",
    })

    with app.app_context():
        db.create_all()
        user = User(name="Profiler", email="profile@test.com", password="x")
        db.session.add(user)
        db.session.commit()
        yield user.id
        db.drop_all()


@pytest.fixture
def client():
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "JWT_SECRET_KEY": "test-secret-key-32-chars-minimum!!",
    })

    with app.app_context():
        db.create_all()
        yield app.test_client()
        db.session.remove()
        db.drop_all()


def _auth(client, email="profile-user@test.com"):
    client.post("/api/auth/register", json={
        "name": "Profile User",
        "email": email,
        "password": "Password1",
    })
    res = client.post("/api/auth/login", json={"email": email, "password": "Password1"})
    token = res.get_json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_get_profile_bundle_shape(app_ctx):
    user_id = app_ctx
    now = datetime.utcnow()

    db.session.add(MoodHistory(user_id=user_id, mood=MoodEnum.HAPPY, confidence=1.0, date=now))
    db.session.add(MoodHistory(user_id=user_id, mood=MoodEnum.RELAXED, confidence=1.0, date=now - timedelta(days=1)))
    db.session.add(Journal(user_id=user_id, journal_text="Good day", detected_mood=MoodEnum.HAPPY, date=now.date()))
    db.session.add(Playlist(user_id=user_id, playlist_name="Mix"))
    db.session.add(Achievement(user_id=user_id, achievement_name="First Mood Check", description="x"))
    db.session.commit()

    bundle = get_profile_bundle(user_id)

    assert bundle["user"]["name"] == "Profiler"
    assert bundle["stats"]["totalMoodChecks"] == 2
    assert bundle["stats"]["journalCount"] == 1
    assert bundle["stats"]["playlistCount"] == 1
    assert bundle["stats"]["achievementsUnlocked"] == 1
    assert bundle["currentMood"]["mood"] == "HAPPY"


def test_profile_api_get_and_patch(client):
    headers = _auth(client)

    get_res = client.get("/api/profile", headers=headers)
    assert get_res.status_code == 200
    body = get_res.get_json()
    assert "user" in body
    assert "stats" in body
    assert body["user"]["name"] == "Profile User"

    patch_res = client.patch(
        "/api/profile",
        headers=headers,
        json={"name": "Updated Name", "preferredLanguage": "Tamil"},
    )
    assert patch_res.status_code == 200
    patched = patch_res.get_json()
    assert patched["user"]["name"] == "Updated Name"
    assert patched["user"]["preferredLanguage"] == "Tamil"


def test_profile_patch_rejects_empty_name(client):
    headers = _auth(client)
    res = client.patch("/api/profile", headers=headers, json={"name": "   "})
    assert res.status_code == 400


def test_profile_patch_rejects_weak_password(client):
    headers = _auth(client)
    res = client.patch("/api/profile", headers=headers, json={"password": "weak"})
    assert res.status_code == 400
