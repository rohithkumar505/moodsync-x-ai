from collections import Counter
from datetime import datetime, timedelta
from typing import Optional

from models import MOODS, MoodHistory

MOOD_SCORES = {
    "HAPPY": 5,
    "RELAXED": 4,
    "NEUTRAL": 3,
    "SAD": 2,
    "ANGRY": 1,
}


def _fetch_entries(user_id: str, since: Optional[datetime] = None):
    query = MoodHistory.query.filter_by(user_id=user_id)
    if since is not None:
        query = query.filter(MoodHistory.date >= since)
    return query.order_by(MoodHistory.date.asc()).all()


def _day_start(dt: Optional[datetime] = None) -> datetime:
    base = dt or datetime.utcnow()
    return base.replace(hour=0, minute=0, second=0, microsecond=0)


def _mood_counts(entries) -> Counter:
    return Counter(e.mood.value for e in entries)


def _most_and_least(counts: Counter):
    present = [(mood, counts.get(mood, 0)) for mood in MOODS if counts.get(mood, 0) > 0]
    if not present:
        return None, None, 0, 0

    most_mood, most_count = max(present, key=lambda item: (item[1], -MOODS.index(item[0])))
    if len(present) <= 1:
        return most_mood, None, most_count, 0

    least_mood, least_count = min(present, key=lambda item: (item[1], MOODS.index(item[0])))
    if least_count >= most_count:
        least_mood = None
        least_count = 0
    return most_mood, least_mood, most_count, least_count


def _streak_days(entries) -> int:
    if not entries:
        return 0

    day_set = set()
    for entry in entries:
        if entry.date:
            day_set.add(entry.date.date())

    today = datetime.utcnow().date()
    start = today if today in day_set else today - timedelta(days=1)
    if start not in day_set:
        return 0

    streak = 0
    cursor = start
    while cursor in day_set:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def _distribution_from_counts(counts: Counter, total: int):
    result = []
    for mood in MOODS:
        count = counts.get(mood, 0)
        result.append({
            "mood": mood,
            "count": count,
            "percentage": round((count / total) * 100, 1) if total else 0,
        })
    return result


def _frequency_from_counts(counts: Counter):
    return [{"mood": mood, "count": counts.get(mood, 0)} for mood in MOODS]


def _trend_from_entries(entries, days: int):
    days = max(1, min(days, 90))
    start = _day_start() - timedelta(days=days - 1)

    by_day: dict[str, list[str]] = {}
    for entry in entries:
        if not entry.date or entry.date < start:
            continue
        key = entry.date.strftime("%Y-%m-%d")
        by_day.setdefault(key, []).append(entry.mood.value)

    result = []
    for offset in range(days):
        day_dt = start + timedelta(days=offset)
        day = day_dt.strftime("%Y-%m-%d")
        moods = by_day.get(day, [])

        if moods:
            dominant = Counter(moods).most_common(1)[0][0]
            avg_score = round(sum(MOOD_SCORES.get(m, 3) for m in moods) / len(moods), 2)
            result.append({
                "date": day,
                "label": day_dt.strftime("%a %d"),
                "mood": dominant,
                "value": avg_score,
                "checkIns": len(moods),
            })
        else:
            result.append({
                "date": day,
                "label": day_dt.strftime("%a %d"),
                "mood": None,
                "value": None,
                "checkIns": 0,
            })
    return result


def _summary_from_entries(entries, days: int):
    counts = _mood_counts(entries)
    total = len(entries)
    most_mood, least_mood, most_count, _ = _most_and_least(counts)

    current = max(entries, key=lambda e: e.date or datetime.min) if entries else None
    week_start = datetime.utcnow() - timedelta(days=7)
    week_count = sum(1 for e in entries if e.date and e.date >= week_start)
    trend_start = _day_start() - timedelta(days=days - 1)
    period_count = sum(1 for e in entries if e.date and e.date >= trend_start)

    avg_confidence = None
    if entries:
        avg_confidence = round(sum(e.confidence or 0 for e in entries) / len(entries), 2)

    return {
        "totalMoodChecks": total,
        "mostCommonMood": most_mood,
        "mostCommonCount": most_count,
        "mostCommonPercentage": round((most_count / total) * 100, 1) if total and most_mood else 0,
        "leastCommonMood": least_mood,
        "currentMood": current.to_dict() if current else None,
        "avgConfidence": avg_confidence,
        "checkInsThisWeek": week_count,
        "checkInsInPeriod": period_count,
        "streakDays": _streak_days(entries),
        "trendDays": days,
    }


def get_distribution(user_id: str):
    entries = _fetch_entries(user_id)
    return _distribution_from_counts(_mood_counts(entries), len(entries))


def get_frequency(user_id: str):
    entries = _fetch_entries(user_id)
    return _frequency_from_counts(_mood_counts(entries))


def get_trend_line(user_id: str, period: str = "daily", days: int = 7):
    days = max(1, min(days, 90))
    since = _day_start() - timedelta(days=days - 1)
    entries = _fetch_entries(user_id, since=since)

    if period == "daily":
        return _trend_from_entries(entries, days)

    return [
        {
            "date": e.date.isoformat() if e.date else "",
            "label": e.date.strftime("%a %H:%M") if e.date else "",
            "mood": e.mood.value,
            "value": MOOD_SCORES.get(e.mood.value, 3),
            "checkIns": 1,
        }
        for e in entries
    ]


def get_summary(user_id: str) -> dict:
    entries = _fetch_entries(user_id)
    return _summary_from_entries(entries, days=14)


def get_analytics(user_id: str, days: int = 14) -> dict:
    """Single consistent snapshot for the analytics page."""
    days = max(7, min(days, 90))
    entries = _fetch_entries(user_id)
    counts = _mood_counts(entries)
    total = len(entries)
    trend_start = _day_start() - timedelta(days=days - 1)
    trend_entries = [e for e in entries if e.date and e.date >= trend_start]

    return {
        "days": days,
        "summary": _summary_from_entries(entries, days=days),
        "distribution": _distribution_from_counts(counts, total),
        "frequency": _frequency_from_counts(counts),
        "trend": _trend_from_entries(trend_entries, days),
    }
