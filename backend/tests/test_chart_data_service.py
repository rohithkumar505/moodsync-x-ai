from datetime import datetime, timedelta

import pytest

from app import create_app
from models import MoodEnum, MoodHistory, User, db
from services.chart_data_service import get_analytics, get_summary, get_trend_line


@pytest.fixture
def app_ctx():
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "JWT_SECRET_KEY": "test-secret-key-32-chars-minimum!!",
    })

    with app.app_context():
        db.create_all()
        user = User(name="Analytics User", email="analytics@test.com", password="x")
        db.session.add(user)
        db.session.commit()
        yield user.id
        db.drop_all()


def _add_mood(user_id: str, mood: str, days_ago: int = 0, confidence: float = 0.9):
    entry = MoodHistory(
        user_id=user_id,
        mood=MoodEnum[mood],
        confidence=confidence,
        date=datetime.utcnow() - timedelta(days=days_ago),
        source="manual",
    )
    db.session.add(entry)
    db.session.commit()
    return entry


def test_trend_fills_missing_days(app_ctx):
    user_id = app_ctx
    _add_mood(user_id, "HAPPY", days_ago=0)
    _add_mood(user_id, "SAD", days_ago=2)

    trend = get_trend_line(user_id, period="daily", days=7)
    assert len(trend) == 7
    assert trend[0]["mood"] is None
    assert trend[-1]["mood"] == "HAPPY"
    assert trend[-1]["checkIns"] == 1


def test_summary_least_common_only_when_multiple(app_ctx):
    user_id = app_ctx
    _add_mood(user_id, "HAPPY")

    summary = get_summary(user_id)
    assert summary["mostCommonMood"] == "HAPPY"
    assert summary["leastCommonMood"] is None


def test_summary_least_common_picks_lowest_count(app_ctx):
    user_id = app_ctx
    _add_mood(user_id, "HAPPY")
    _add_mood(user_id, "HAPPY")
    _add_mood(user_id, "SAD")

    summary = get_summary(user_id)
    assert summary["mostCommonMood"] == "HAPPY"
    assert summary["mostCommonCount"] == 2
    assert summary["leastCommonMood"] == "SAD"


def test_analytics_bundle_is_consistent(app_ctx):
    user_id = app_ctx
    _add_mood(user_id, "RELAXED")
    _add_mood(user_id, "HAPPY")

    bundle = get_analytics(user_id, days=14)
    total_from_distribution = sum(row["count"] for row in bundle["distribution"])
    total_from_frequency = sum(row["count"] for row in bundle["frequency"])

    assert bundle["summary"]["totalMoodChecks"] == 2
    assert total_from_distribution == 2
    assert total_from_frequency == 2
    assert len(bundle["trend"]) == 14
