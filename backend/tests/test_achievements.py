import pytest

from app import create_app
from models import Achievement, Journal, MoodEnum, MoodHistory, Playlist, User, db
from services.achievement_service import evaluate_achievements, get_achievements_bundle


@pytest.fixture
def app_ctx():
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "JWT_SECRET_KEY": "test-secret-key-32-chars-minimum!!",
    })

    with app.app_context():
        db.create_all()
        user = User(name="Achiever", email="ach@test.com", password="x")
        db.session.add(user)
        db.session.commit()
        yield user.id
        db.drop_all()


def test_first_mood_unlocks(app_ctx):
    user_id = app_ctx
    entry = MoodHistory(user_id=user_id, mood=MoodEnum.HAPPY, confidence=1.0)
    db.session.add(entry)
    db.session.commit()

    unlocked = evaluate_achievements(user_id, streak=1)
    assert "First Mood Check" in unlocked

    bundle = get_achievements_bundle(user_id, streak=1)
    assert bundle["summary"]["unlocked"] >= 1
    assert bundle["summary"]["total"] == 12
    first = next(i for i in bundle["items"] if i["slug"] == "first_mood_check")
    assert first["unlocked"] is True
    assert first["icon"] == "🎯"


def test_playlist_achievement(app_ctx):
    user_id = app_ctx
    playlist = Playlist(user_id=user_id, playlist_name="My Mix")
    db.session.add(playlist)
    db.session.commit()

    evaluate_achievements(user_id, streak=0)
    item = next(i for i in get_achievements_bundle(user_id)["items"] if i["slug"] == "playlist_maker")
    assert item["unlocked"] is True


def test_journal_achievement(app_ctx):
    user_id = app_ctx
    from datetime import date

    db.session.add(
        Journal(
            user_id=user_id,
            journal_text="Feeling good today",
            detected_mood=MoodEnum.HAPPY,
            date=date.today(),
        )
    )
    db.session.commit()

    unlocked = evaluate_achievements(user_id, streak=0)
    assert "Journal Starter" in unlocked
