import pytest

from app import create_app
from models import User, db
from services.music_assistant_service import _parse_intent, handle_assistant_message


@pytest.fixture
def app_ctx():
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "JWT_SECRET_KEY": "test-secret-key-32-chars-minimum!!",
    })

    with app.app_context():
        db.create_all()
        user = User(name="DJ User", email="dj@test.com", password="x", preferred_language="Hindi")
        db.session.add(user)
        db.session.commit()
        yield user.id
        db.drop_all()


def test_parse_mood_suggest_intent():
    intent, mood, _, _ = _parse_intent("I am sad please suggest me some songs")
    assert intent in ("mood_suggest", "mood")
    assert mood == "SAD"


def test_parse_mood_swing_intent():
    intent, _, _, _ = _parse_intent("having a mood swing please suggest")
    assert intent == "mood_swing"


def test_parse_happy_suggest():
    intent, mood, _, _ = _parse_intent("I am happy please suggest me song")
    assert intent in ("mood_suggest", "mood")
    assert mood == "HAPPY"


def test_parse_singer_intent():
    intent, _, query, stype = _parse_intent("play Arijit Singh songs")
    assert intent in ("singer", "search")
    assert stype in ("singer", "auto")


def test_parse_movie_intent():
    intent, _, query, stype = _parse_intent("songs from RRR movie")
    assert intent == "movie"
    assert stype == "movie"
    assert query


def test_assistant_empty_message(app_ctx):
    user_id = app_ctx
    result = handle_assistant_message(user_id, "   ")
    assert result["intent"] == "chat"
    assert result["songs"] == []
    assert result["playNow"] is False
    assert result["moodEmoji"] is None


def test_assistant_help_intent(app_ctx):
    user_id = app_ctx
    result = handle_assistant_message(user_id, "what can you do?")
    assert result["intent"] == "help"
    assert result["songs"] == []
    assert "singer" in result["reply"].lower() or "mood" in result["reply"].lower()


def test_assistant_sad_mood_has_emoji(app_ctx):
    user_id = app_ctx
    result = handle_assistant_message(user_id, "I am sad please suggest me some songs")
    assert result["intent"] in ("mood_suggest", "mood")
    assert result["detectedMood"] == "SAD"
    assert result["moodEmoji"] == "😔"
    assert "playNow" in result
