import pytest
from app import create_app
from models import db, User
import bcrypt


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
        db.drop_all()


def register_and_login(client, email="test@example.com"):
    client.post("/api/auth/register", json={
        "name": "Test User",
        "email": email,
        "password": "Password1",
    })
    res = client.post("/api/auth/login", json={"email": email, "password": "Password1"})
    token = res.get_json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.get_json()["status"] == "ok"


def test_register_and_login(client):
    res = client.post("/api/auth/register", json={
        "name": "Alice",
        "email": "alice@test.com",
        "password": "Password1",
    })
    assert res.status_code == 201
    assert "token" in res.get_json()

    res = client.post("/api/auth/login", json={"email": "alice@test.com", "password": "Password1"})
    assert res.status_code == 200


def test_mood_checkin(client):
    headers = register_and_login(client)
    res = client.post("/api/moods", json={"mood": "HAPPY", "confidence": 1.0}, headers=headers)
    assert res.status_code == 201
    assert res.get_json()["mood"]["mood"] == "HAPPY"


def test_charts(client):
    headers = register_and_login(client, "charts@test.com")
    client.post("/api/moods", json={"mood": "HAPPY"}, headers=headers)
    res = client.get("/api/charts/frequency", headers=headers)
    assert res.status_code == 200
    data = res.get_json()
    assert any(d["mood"] == "HAPPY" and d["count"] == 1 for d in data)
