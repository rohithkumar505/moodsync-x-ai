import pytest

from app import create_app
from db_bootstrap import schema_is_ready
from models import db


@pytest.fixture
def app():
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "JWT_SECRET_KEY": "test-secret-key-32-chars-minimum!!",
    })

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


def test_schema_is_ready_after_bootstrap(app):
    with app.app_context():
        assert schema_is_ready()


def test_health_reports_schema(app):
    client = app.test_client()
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.get_json()
    assert body["dbStatus"] == "ok"
    assert body["schemaReady"] is True
