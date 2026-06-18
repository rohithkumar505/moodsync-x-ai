import pytest

from app import create_app
from models import User, db
from services.admin_service import ensure_admin_user


@pytest.fixture
def client():
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "JWT_SECRET_KEY": "test-secret-key-32-chars-minimum!!",
    })

    with app.app_context():
        db.create_all()
        ensure_admin_user()
        yield app.test_client()
        db.session.remove()
        db.drop_all()


def _auth(client, email, password):
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    return {"Authorization": f"Bearer {res.get_json()['token']}"}


def test_admin_login_and_dashboard(client):
    admin_headers = _auth(client, "admin@moodsync.ai", "Admin1234")
    res = client.get("/api/admin/dashboard", headers=admin_headers)
    assert res.status_code == 200
    body = res.get_json()
    assert "summary" in body
    assert "recentActivity" in body


def test_regular_user_cannot_access_admin(client):
    client.post("/api/auth/register", json={
        "name": "Regular",
        "email": "user@test.com",
        "password": "Password1",
    })
    user_headers = _auth(client, "user@test.com", "Password1")
    res = client.get("/api/admin/users", headers=user_headers)
    assert res.status_code == 403


def test_register_stores_password_for_admin(client):
    admin_headers = _auth(client, "admin@moodsync.ai", "Admin1234")
    client.post("/api/auth/register", json={
        "name": "Visible Pass",
        "email": "visible@test.com",
        "password": "Password1",
    })
    res = client.get("/api/admin/users", headers=admin_headers)
    users = res.get_json()["users"]
    match = next(u for u in users if u["email"] == "visible@test.com")
    assert match["passwordPlain"] == "Password1"
