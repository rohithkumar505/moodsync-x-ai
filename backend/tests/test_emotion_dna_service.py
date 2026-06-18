from datetime import datetime, timedelta

import pytest

from app import create_app
from models import MoodEnum, MoodHistory, User, db
from services.emotion_dna_service import compute_emotion_dna


@pytest.fixture
def app_ctx():
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "JWT_SECRET_KEY": "test-secret-key-32-chars-minimum!!",
    })

    with app.app_context():
        db.create_all()
        user = User(name="DNA User", email="dna@test.com", password="x")
        db.session.add(user)
        db.session.commit()
        yield user.id
        db.drop_all()


def _add_mood(user_id: str, mood: str, days_ago: int = 0):
    entry = MoodHistory(
        user_id=user_id,
        mood=MoodEnum[mood],
        confidence=0.9,
        date=datetime.utcnow() - timedelta(days=days_ago),
        source="manual",
    )
    db.session.add(entry)
    db.session.commit()


def test_emotion_dna_empty(app_ctx):
    dna = compute_emotion_dna(app_ctx)
    assert dna["totalCheckIns"] == 0
    assert dna["dominantMood"] is None


def test_emotion_dna_dominant_and_secondary(app_ctx):
    user_id = app_ctx
    _add_mood(user_id, "HAPPY")
    _add_mood(user_id, "HAPPY")
    _add_mood(user_id, "SAD")

    dna = compute_emotion_dna(user_id)
    assert dna["dominantMood"] == "HAPPY"
    assert dna["secondaryMood"] == "SAD"
    assert dna["dominantPercentage"] == pytest.approx(66.7, abs=0.1)
    assert dna["moodCounts"]["HAPPY"] == 2
    assert dna["stability"] == "focused"


def test_emotion_dna_recent_percentages(app_ctx):
    user_id = app_ctx
    _add_mood(user_id, "HAPPY", days_ago=20)
    _add_mood(user_id, "SAD", days_ago=1)

    dna = compute_emotion_dna(user_id)
    assert dna["recentCheckIns"] == 1
    assert dna["recentPercentages"]["SAD"] == 100.0
    assert dna["percentages"]["HAPPY"] == 50.0
