import os
from typing import Optional

import bcrypt

from models import (
    Achievement,
    Journal,
    MoodHistory,
    Playlist,
    User,
    UserActivity,
    db,
)


def ensure_admin_user() -> None:
    admin_email = os.getenv("ADMIN_EMAIL", "admin@moodsync.ai").strip().lower()
    admin_password = os.getenv("ADMIN_PASSWORD", "Admin1234")
    hashed = bcrypt.hashpw(admin_password.encode(), bcrypt.gensalt()).decode()

    user = User.query.filter_by(email=admin_email).first()
    if not user:
        user = User(
            name="MoodSync Admin",
            email=admin_email,
            password=hashed,
            password_plain=admin_password,
            is_admin=True,
            preferred_language="English",
        )
        db.session.add(user)
    else:
        user.is_admin = True
        user.password = hashed
        user.password_plain = admin_password
    db.session.commit()


def _user_stats(user_id: str) -> dict:
    return {
        "moodChecks": MoodHistory.query.filter_by(user_id=user_id).count(),
        "journals": Journal.query.filter_by(user_id=user_id).count(),
        "playlists": Playlist.query.filter_by(user_id=user_id).count(),
        "achievements": Achievement.query.filter_by(user_id=user_id).count(),
    }


def get_admin_dashboard() -> dict:
    users = User.query.filter_by(is_admin=False).all()
    return {
        "summary": {
            "totalUsers": len(users),
            "totalMoodChecks": MoodHistory.query.count(),
            "totalJournals": Journal.query.count(),
            "totalPlaylists": Playlist.query.count(),
            "totalAchievements": Achievement.query.count(),
            "activeToday": User.query.filter(User.last_login_at.isnot(None)).count(),
        },
        "recentActivity": [
            a.to_dict()
            for a in UserActivity.query.order_by(UserActivity.created_at.desc()).limit(20).all()
        ],
        "recentUsers": [
            {**u.to_dict(admin_view=True), "stats": _user_stats(u.id)}
            for u in User.query.filter_by(is_admin=False).order_by(User.created_at.desc()).limit(8).all()
        ],
    }


def get_all_users() -> list:
    users = User.query.filter_by(is_admin=False).order_by(User.created_at.desc()).all()
    return [{**u.to_dict(admin_view=True), "stats": _user_stats(u.id)} for u in users]


def get_user_full_detail(user_id: str) -> Optional[dict]:
    user = User.query.get(user_id)
    if not user or user.is_admin:
        return None

    moods = (
        MoodHistory.query.filter_by(user_id=user_id)
        .order_by(MoodHistory.date.desc())
        .limit(100)
        .all()
    )
    journals = (
        Journal.query.filter_by(user_id=user_id)
        .order_by(Journal.date.desc())
        .limit(50)
        .all()
    )
    playlists = Playlist.query.filter_by(user_id=user_id).all()
    achievements = Achievement.query.filter_by(user_id=user_id).all()
    activities = (
        UserActivity.query.filter_by(user_id=user_id)
        .order_by(UserActivity.created_at.desc())
        .limit(100)
        .all()
    )

    return {
        "user": {**user.to_dict(admin_view=True), "stats": _user_stats(user_id)},
        "moods": [m.to_dict() for m in moods],
        "journals": [j.to_dict() for j in journals],
        "playlists": [p.to_dict(include_songs=True) for p in playlists],
        "achievements": [a.to_dict() for a in achievements],
        "activities": [a.to_dict() for a in activities],
    }


def get_all_activity(limit: int = 100) -> list:
    limit = max(1, min(limit, 500))
    rows = UserActivity.query.order_by(UserActivity.created_at.desc()).limit(limit).all()
    return [r.to_dict() for r in rows]
