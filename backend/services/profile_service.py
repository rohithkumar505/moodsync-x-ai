from typing import Optional

from datetime import datetime

from models import Achievement, Journal, MoodHistory, Playlist, User
from engines.emotion_engine import compute_streak


def get_profile_bundle(user_id: str) -> Optional[dict]:
    user = User.query.get(user_id)
    if not user:
        return None

    entries = (
        MoodHistory.query.filter_by(user_id=user_id)
        .order_by(MoodHistory.date.desc())
        .all()
    )
    current = entries[0] if entries else None
    member_days = 0
    if user.created_at:
        member_days = max(0, (datetime.utcnow() - user.created_at).days)

    return {
        "user": user.to_dict(),
        "stats": {
            "totalMoodChecks": len(entries),
            "streakDays": compute_streak(entries),
            "journalCount": Journal.query.filter_by(user_id=user_id).count(),
            "playlistCount": Playlist.query.filter_by(user_id=user_id).count(),
            "achievementsUnlocked": Achievement.query.filter_by(user_id=user_id).count(),
            "memberDays": member_days,
        },
        "currentMood": current.to_dict() if current else None,
    }
