from collections import Counter
from datetime import datetime, timedelta

from models import Achievement, Journal, MoodHistory, Playlist, PlaylistSong, User
from services.emotion_dna_service import compute_emotion_dna
from engines.emotion_engine import compute_streak, predict_next_mood
from music.music_library import get_mood_playlist
from services.chart_data_service import (
    _distribution_from_counts,
    _frequency_from_counts,
    _mood_counts,
    _most_and_least,
    _summary_from_entries,
    _trend_from_entries,
)


def get_dashboard_recommendations(user_id: str) -> list:
    """Song picks loaded separately so the dashboard opens instantly."""
    user = User.query.get(user_id)
    if not user:
        return []
    current = (
        MoodHistory.query.filter_by(user_id=user_id)
        .order_by(MoodHistory.date.desc())
        .first()
    )
    lang = user.preferred_language or "Hindi"
    mood = current.mood.value if current else "NEUTRAL"
    try:
        return get_mood_playlist(mood, lang, limit=4, fast=True, prefill=False)
    except Exception:
        return []


def get_dashboard(user_id: str) -> dict:
    user = User.query.get(user_id)
    entries = (
        MoodHistory.query.filter_by(user_id=user_id)
        .order_by(MoodHistory.date.desc())
        .limit(100)
        .all()
    )
    current = entries[0] if entries else None
    dna = compute_emotion_dna(user_id)
    prediction = predict_next_mood(list(reversed(entries)), dna)

    mood_counts = Counter(e.mood.value for e in entries)
    total = len(entries)

    return {
        "user": user.to_dict() if user else None,
        "currentMood": current.to_dict() if current else None,
        "stats": {
            "totalMoodChecks": total,
            "mostFrequentMood": mood_counts.most_common(1)[0][0] if mood_counts else None,
            "streak": compute_streak(entries),
            "journalCount": Journal.query.filter_by(user_id=user_id).count(),
            "playlistCount": Playlist.query.filter_by(user_id=user_id).count(),
        },
        "emotionDna": dna,
        "prediction": prediction,
        "recommendations": [],
    }


def _report_narrative(summary: dict, dna: dict, achievements_count: int) -> str:
    total = summary.get("totalMoodChecks") or 0
    if total == 0:
        return (
            "You have not logged any moods in this period yet. "
            "Use Mood Sync or a manual check-in to start building your wellness report."
        )

    dominant = dna.get("dominantMood")
    streak = summary.get("streakDays") or 0
    most = summary.get("mostCommonMood")
    parts = [f"You logged {total} mood check-in{'s' if total != 1 else ''} in this report period."]

    if most:
        parts.append(f"Your most frequent mood was {most.title().lower()}.")
    if dominant and dna.get("insight"):
        parts.append(dna["insight"])
    if streak >= 3:
        parts.append(f"You are on a {streak}-day streak — keep it going.")
    if achievements_count:
        parts.append(f"You have unlocked {achievements_count} achievement{'s' if achievements_count != 1 else ''}.")

    return " ".join(parts)


def build_full_report(user_id: str, date_from=None, date_to=None, days: int = 30) -> dict:
    user = User.query.get(user_id)
    days = max(7, min(days, 90))

    all_entries = (
        MoodHistory.query.filter_by(user_id=user_id)
        .order_by(MoodHistory.date.desc())
        .all()
    )

    entries = all_entries
    if date_from:
        entries = [e for e in entries if e.date and e.date >= date_from]
    if date_to:
        end = date_to
        if isinstance(end, datetime) and end.hour == 0 and end.minute == 0:
            end = end.replace(hour=23, minute=59, second=59, microsecond=999999)
        entries = [e for e in entries if e.date and e.date <= end]

    counts = _mood_counts(entries)
    total = len(entries)
    most_mood, least_mood, most_count, least_count = _most_and_least(counts)

    trend_entries = entries
    if not date_from and not date_to:
        trend_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days - 1)
        trend_entries = [e for e in entries if e.date and e.date >= trend_start]

    playlists = Playlist.query.filter_by(user_id=user_id).all()
    achievements = Achievement.query.filter_by(user_id=user_id).all()
    playlist_song_count = (
        PlaylistSong.query.join(Playlist, PlaylistSong.playlist_id == Playlist.id)
        .filter(Playlist.user_id == user_id)
        .count()
    )
    journal_count = Journal.query.filter_by(user_id=user_id).count()

    dna = compute_emotion_dna(user_id)
    summary = _summary_from_entries(entries, days=days)
    chron = sorted([e for e in entries if e.date], key=lambda e: e.date)
    prediction = predict_next_mood(chron[-50:], dna)

    period_label = "All time"
    if date_from and date_to:
        period_label = f"{date_from.date().isoformat()} → {date_to.date().isoformat()}"
    elif date_from:
        period_label = f"Since {date_from.date().isoformat()}"
    elif date_to:
        period_label = f"Until {date_to.date().isoformat()}"
    elif days < 90:
        period_label = f"Last {days} days"

    return {
        "period": {
            "label": period_label,
            "days": days,
            "from": date_from.isoformat() if date_from else None,
            "to": date_to.isoformat() if date_to else None,
        },
        "user": user.to_dict() if user else None,
        "summary": summary,
        "narrative": _report_narrative(summary, dna, len(achievements)),
        "moodHistory": [e.to_dict() for e in entries[:30]],
        "moodStatistics": {
            "total": total,
            "mostCommon": most_mood,
            "mostCommonCount": most_count,
            "leastCommon": least_mood,
            "leastCommonCount": least_count,
        },
        "distribution": _distribution_from_counts(counts, total),
        "frequency": _frequency_from_counts(counts),
        "trends": _trend_from_entries(trend_entries, days),
        "emotionDna": dna,
        "prediction": prediction,
        "wellness": {
            "journalCount": journal_count,
            "playlistCount": len(playlists),
            "playlistSongCount": playlist_song_count,
            "achievementsUnlocked": len(achievements),
            "streakDays": summary.get("streakDays") or 0,
        },
        "songPreferences": {
            "playlistCount": len(playlists),
            "playlists": [p.to_dict() for p in playlists[:10]],
        },
        "achievements": [a.to_dict() for a in achievements[:20]],
        "generatedAt": datetime.utcnow().isoformat(),
    }
