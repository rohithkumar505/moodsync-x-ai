from collections import Counter
from datetime import datetime, timedelta
from typing import Optional, Tuple

from models import MOODS, MoodHistory
from engines.emotion_engine import mood_insight


def _percentages_from_counts(counts: Counter, total: int) -> dict:
    return {mood: round((counts.get(mood, 0) / total) * 100, 1) if total else 0 for mood in MOODS}


def _rank_moods(percentages: dict) -> Tuple[Optional[str], Optional[str]]:
    present = [(mood, percentages[mood]) for mood in MOODS if percentages[mood] > 0]
    if not present:
        return None, None

    dominant = max(present, key=lambda item: (item[1], -MOODS.index(item[0])))[0]
    others = [item for item in present if item[0] != dominant]
    if not others:
        return dominant, None

    secondary = max(others, key=lambda item: (item[1], -MOODS.index(item[0])))[0]
    return dominant, secondary


def _stability_label(dominant_pct: float) -> str:
    if dominant_pct >= 50:
        return "focused"
    if dominant_pct >= 30:
        return "steady"
    return "varied"


def compute_emotion_dna(user_id: str) -> dict:
    entries = (
        MoodHistory.query.filter_by(user_id=user_id)
        .order_by(MoodHistory.date.asc())
        .all()
    )
    total = len(entries)

    empty = {
        "percentages": {m: 0 for m in MOODS},
        "recentPercentages": {m: 0 for m in MOODS},
        "moodCounts": {m: 0 for m in MOODS},
        "totalCheckIns": 0,
        "recentCheckIns": 0,
        "dominantMood": None,
        "secondaryMood": None,
        "dominantPercentage": 0,
        "insight": "Start logging moods to build your Emotion DNA profile.",
        "stability": None,
        "lastUpdated": None,
    }

    if total == 0:
        return empty

    counts = Counter(e.mood.value for e in entries)
    percentages = _percentages_from_counts(counts, total)
    dominant, secondary = _rank_moods(percentages)
    dominant_pct = percentages[dominant] if dominant else 0
    stability = _stability_label(dominant_pct)

    recent_since = datetime.utcnow() - timedelta(days=14)
    recent_entries = [e for e in entries if e.date and e.date >= recent_since]
    recent_total = len(recent_entries)
    recent_counts = Counter(e.mood.value for e in recent_entries)
    recent_percentages = _percentages_from_counts(recent_counts, recent_total)

    latest = max(entries, key=lambda e: e.date or datetime.min)

    return {
        "percentages": percentages,
        "recentPercentages": recent_percentages,
        "moodCounts": {mood: counts.get(mood, 0) for mood in MOODS},
        "totalCheckIns": total,
        "recentCheckIns": recent_total,
        "dominantMood": dominant,
        "secondaryMood": secondary,
        "dominantPercentage": dominant_pct,
        "insight": mood_insight(dominant, secondary, dominant_pct, stability),
        "stability": stability,
        "lastUpdated": latest.date.isoformat() if latest.date else None,
    }
