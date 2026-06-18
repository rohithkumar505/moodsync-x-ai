import pytest

from app import create_app
from models import db


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


def _auth(client, email="playlist-user@test.com"):
    client.post("/api/auth/register", json={
        "name": "Playlist User",
        "email": email,
        "password": "Password1",
    })
    res = client.post("/api/auth/login", json={"email": email, "password": "Password1"})
    token = res.get_json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_playlist_crud_and_saavn_add(client):
    headers = _auth(client)

    create = client.post("/api/playlists", json={"playlistName": "My Mix"}, headers=headers)
    assert create.status_code == 201
    playlist_id = create.get_json()["id"]

    add = client.post(
        f"/api/playlists/{playlist_id}/songs",
        headers=headers,
        json={
            "id": "saavn-TESTID123",
            "songName": "Test Song",
            "artist": "Test Artist",
            "mood": "HAPPY",
            "language": "Hindi",
            "saavnId": "TESTID123",
            "source": "saavn",
        },
    )
    assert add.status_code == 200
    body = add.get_json()
    assert len(body["songs"]) == 1
    assert body["songs"][0]["saavnId"] == "TESTID123"

    dup = client.post(
        f"/api/playlists/{playlist_id}/songs",
        headers=headers,
        json={"songName": "Test Song", "artist": "Test Artist", "saavnId": "TESTID123"},
    )
    assert dup.status_code == 409

    detail = client.get(f"/api/playlists/{playlist_id}", headers=headers)
    assert detail.status_code == 200
    song_id = detail.get_json()["songs"][0]["id"]

    removed = client.delete(f"/api/playlists/{playlist_id}/songs/{song_id}", headers=headers)
    assert removed.status_code == 200
    assert removed.get_json()["songs"] == []
