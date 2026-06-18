import pytest
from datetime import datetime, timedelta

from app import create_app
from models import Achievement, MoodEnum, MoodHistory, Playlist, User, db
from services.dashboard_service import build_full_report


@pytest.fixture
def app_ctx():
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "JWT_SECRET_KEY": "test-secret-key-32-chars-minimum!!",
    })

    with app.app_context():
        db.create_all()
        user = User(name="Reporter", email="report@test.com", password="x")
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


def _auth(client, email="report-user@test.com"):
    client.post("/api/auth/register", json={
        "name": "Report User",
        "email": email,
        "password": "Password1",
    })
    res = client.post("/api/auth/login", json={"email": email, "password": "Password1"})
    token = res.get_json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_build_full_report_shape(app_ctx):
    user_id = app_ctx
    now = datetime.utcnow()

    db.session.add(MoodHistory(user_id=user_id, mood=MoodEnum.HAPPY, confidence=0.9, date=now))
    db.session.add(MoodHistory(user_id=user_id, mood=MoodEnum.RELAXED, confidence=0.8, date=now - timedelta(days=1)))
    db.session.add(Playlist(user_id=user_id, playlist_name="Chill"))
    db.session.add(Achievement(user_id=user_id, achievement_name="First Mood Check", description="Logged first mood"))
    db.session.commit()

    report = build_full_report(user_id, days=30)

    assert report["period"]["days"] == 30
    assert report["period"]["label"] == "Last 30 days"
    assert report["user"]["name"] == "Reporter"
    assert report["summary"]["totalMoodChecks"] == 2
    assert report["summary"]["mostCommonMood"] == "HAPPY"
    assert isinstance(report["narrative"], str) and len(report["narrative"]) > 0
    assert len(report["distribution"]) > 0
    assert len(report["frequency"]) > 0
    assert isinstance(report["trends"], list)
    assert "dominantMood" in report["emotionDna"]
    assert report["wellness"]["playlistCount"] == 1
    assert report["wellness"]["achievementsUnlocked"] == 1
    assert report["songPreferences"]["playlists"][0]["playlistName"] == "Chill"
    assert report["generatedAt"]


def test_build_full_report_clamps_days(app_ctx):
    user_id = app_ctx
    report = build_full_report(user_id, days=3)
    assert report["period"]["days"] == 7

    report = build_full_report(user_id, days=200)
    assert report["period"]["days"] == 90


def test_reports_api(client):
    headers = _auth(client)

    res = client.get("/api/reports?days=14", headers=headers)
    assert res.status_code == 200
    body = res.get_json()
    assert body["period"]["days"] == 14
    assert "summary" in body
    assert "narrative" in body
    assert "emotionDna" in body
    assert "wellness" in body


def test_reports_api_invalid_date(client):
    headers = _auth(client)
    res = client.get("/api/reports?from=not-a-date", headers=headers)
    assert res.status_code == 400
