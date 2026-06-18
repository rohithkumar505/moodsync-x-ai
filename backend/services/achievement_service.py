from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Optional

from sqlalchemy.exc import IntegrityError

from models import Achievement, Journal, MoodHistory, Playlist, PlaylistSong, db

FACE_SOURCES = frozenset({"face_camera", "face_camera_live", "face_vision", "face_sync"})

CATEGORY_ORDER = [
    "Getting started",
    "Mood",
    "Streak",
    "Dedication",
    "Journal",
    "Music",
    "Mood Sync",
]


@dataclass
class AchievementContext:
    user_id: str
    streak: int
    entries: list
    journal_count: int
    playlist_count: int
    playlist_song_count: int
    face_sync_count: int
    unique_moods: int
    happy_count: int


def _build_context(user_id: str, streak: int = 0) -> AchievementContext:
    entries = MoodHistory.query.filter_by(user_id=user_id).order_by(MoodHistory.date.asc()).all()
    journal_count = Journal.query.filter_by(user_id=user_id).count()
    playlist_count = Playlist.query.filter_by(user_id=user_id).count()
    playlist_song_count = (
        db.session.query(PlaylistSong)
        .join(Playlist, PlaylistSong.playlist_id == Playlist.id)
        .filter(Playlist.user_id == user_id)
        .count()
    )
    face_sync_count = sum(1 for e in entries if (e.source or "") in FACE_SOURCES)
    unique_moods = len({e.mood.value for e in entries})
    happy_count = sum(1 for e in entries if e.mood.value == "HAPPY")

    return AchievementContext(
        user_id=user_id,
        streak=streak,
        entries=entries,
        journal_count=journal_count,
        playlist_count=playlist_count,
        playlist_song_count=playlist_song_count,
        face_sync_count=face_sync_count,
        unique_moods=unique_moods,
        happy_count=happy_count,
    )


ACHIEVEMENT_DEFS = [
    {
        "slug": "first_mood_check",
        "name": "First Mood Check",
        "description": "Log your first mood entry",
        "category": "Getting started",
        "icon": "🎯",
        "tier": "bronze",
        "check": lambda c: len(c.entries) >= 1,
        "progress": lambda c: min(len(c.entries), 1),
        "target": 1,
    },
    {
        "slug": "mood_explorer",
        "name": "Mood Explorer",
        "description": "Experience all 5 mood types",
        "category": "Mood",
        "icon": "🌈",
        "tier": "silver",
        "check": lambda c: c.unique_moods >= 5,
        "progress": lambda c: min(c.unique_moods, 5),
        "target": 5,
    },
    {
        "slug": "happy_vibes",
        "name": "Happy Vibes",
        "description": "Log 10 happy moods",
        "category": "Mood",
        "icon": "😊",
        "tier": "bronze",
        "check": lambda c: c.happy_count >= 10,
        "progress": lambda c: min(c.happy_count, 10),
        "target": 10,
    },
    {
        "slug": "streak_starter",
        "name": "Streak Starter",
        "description": "Maintain a 3-day mood streak",
        "category": "Streak",
        "icon": "🔥",
        "tier": "bronze",
        "check": lambda c: c.streak >= 3,
        "progress": lambda c: min(c.streak, 3),
        "target": 3,
        "progressLabel": lambda c: f"{min(c.streak, 3)}/3 days",
    },
    {
        "slug": "week_warrior",
        "name": "Week Warrior",
        "description": "Keep a 7-day mood streak going",
        "category": "Streak",
        "icon": "⚡",
        "tier": "silver",
        "check": lambda c: c.streak >= 7,
        "progress": lambda c: min(c.streak, 7),
        "target": 7,
        "progressLabel": lambda c: f"{min(c.streak, 7)}/7 days",
    },
    {
        "slug": "emotion_master",
        "name": "Emotion Master",
        "description": "Complete 30 mood check-ins",
        "category": "Dedication",
        "icon": "💎",
        "tier": "silver",
        "check": lambda c: len(c.entries) >= 30,
        "progress": lambda c: min(len(c.entries), 30),
        "target": 30,
    },
    {
        "slug": "moodsync_legend",
        "name": "MoodSync Legend",
        "description": "100 check-ins and a 7-day streak",
        "category": "Dedication",
        "icon": "👑",
        "tier": "gold",
        "check": lambda c: len(c.entries) >= 100 and c.streak >= 7,
        "progress": lambda c: min(len(c.entries), 100),
        "target": 100,
        "secondaryProgress": lambda c: min(c.streak, 7),
        "secondaryTarget": 7,
        "secondaryLabel": "Streak",
    },
    {
        "slug": "journal_starter",
        "name": "Journal Starter",
        "description": "Write your first journal entry",
        "category": "Journal",
        "icon": "📓",
        "tier": "bronze",
        "check": lambda c: c.journal_count >= 1,
        "progress": lambda c: min(c.journal_count, 1),
        "target": 1,
    },
    {
        "slug": "mindful_writer",
        "name": "Mindful Writer",
        "description": "Save 10 journal entries",
        "category": "Journal",
        "icon": "✍️",
        "tier": "silver",
        "check": lambda c: c.journal_count >= 10,
        "progress": lambda c: min(c.journal_count, 10),
        "target": 10,
    },
    {
        "slug": "playlist_maker",
        "name": "Playlist Maker",
        "description": "Create your first playlist",
        "category": "Music",
        "icon": "🎵",
        "tier": "bronze",
        "check": lambda c: c.playlist_count >= 1,
        "progress": lambda c: min(c.playlist_count, 1),
        "target": 1,
    },
    {
        "slug": "music_curator",
        "name": "Music Curator",
        "description": "Save 10 songs to playlists",
        "category": "Music",
        "icon": "💿",
        "tier": "silver",
        "check": lambda c: c.playlist_song_count >= 10,
        "progress": lambda c: min(c.playlist_song_count, 10),
        "target": 10,
    },
    {
        "slug": "face_sync_fan",
        "name": "Face Sync Fan",
        "description": "Use Mood Sync camera 5 times",
        "category": "Mood Sync",
        "icon": "📸",
        "tier": "bronze",
        "check": lambda c: c.face_sync_count >= 5,
        "progress": lambda c: min(c.face_sync_count, 5),
        "target": 5,
    },
]


def _serialize(defn: dict, ctx: AchievementContext, unlocked_map: dict) -> dict:
    ach = unlocked_map.get(defn["name"])
    progress = defn["progress"](ctx)
    target = defn["target"]
    progress_label_fn: Optional[Callable] = defn.get("progressLabel")
    data = {
        "slug": defn["slug"],
        "name": defn["name"],
        "description": defn["description"],
        "category": defn["category"],
        "icon": defn["icon"],
        "tier": defn["tier"],
        "unlocked": ach is not None,
        "unlockedAt": ach.date.isoformat() if ach and ach.date else None,
        "progress": progress,
        "target": target,
        "percent": round((progress / target) * 100) if target else 0,
        "progressLabel": progress_label_fn(ctx) if progress_label_fn else f"{progress}/{target}",
    }
    if "secondaryProgress" in defn:
        sec = defn["secondaryProgress"](ctx)
        sec_target = defn["secondaryTarget"]
        data["secondaryProgress"] = sec
        data["secondaryTarget"] = sec_target
        data["secondaryLabel"] = defn.get("secondaryLabel", "Bonus")
        data["secondaryPercent"] = round((sec / sec_target) * 100) if sec_target else 0
    return data


def evaluate_achievements(user_id: str, streak: int = 0) -> list[str]:
    try:
        ctx = _build_context(user_id, streak)
        unlocked_names = {
            a.achievement_name for a in Achievement.query.filter_by(user_id=user_id).all()
        }
        newly_unlocked = []

        for defn in ACHIEVEMENT_DEFS:
            if defn["name"] in unlocked_names:
                continue
            if defn["check"](ctx):
                db.session.add(
                    Achievement(
                        user_id=user_id,
                        achievement_name=defn["name"],
                        description=defn["description"],
                    )
                )
                newly_unlocked.append(defn["name"])

        if newly_unlocked:
            db.session.commit()
        return newly_unlocked
    except IntegrityError:
        db.session.rollback()
        return []
    except Exception:
        db.session.rollback()
        return []


def get_achievements(user_id: str, streak: int = 0) -> list[dict]:
    ctx = _build_context(user_id, streak)
    unlocked = {a.achievement_name: a for a in Achievement.query.filter_by(user_id=user_id).all()}
    return [_serialize(defn, ctx, unlocked) for defn in ACHIEVEMENT_DEFS]


def get_achievements_bundle(user_id: str, streak: int = 0) -> dict:
    ctx = _build_context(user_id, streak)
    unlocked = {a.achievement_name: a for a in Achievement.query.filter_by(user_id=user_id).all()}
    items = [_serialize(defn, ctx, unlocked) for defn in ACHIEVEMENT_DEFS]
    unlocked_count = sum(1 for a in items if a["unlocked"])
    total = len(items)

    locked = [a for a in items if not a["unlocked"]]
    next_up = max(locked, key=lambda a: a["percent"]) if locked else None

    categories: dict[str, list] = {}
    for item in items:
        categories.setdefault(item["category"], []).append(item)

    ordered_categories = []
    for cat in CATEGORY_ORDER:
        if cat in categories:
            ordered_categories.append({
                "id": cat.lower().replace(" ", "_"),
                "label": cat,
                "items": categories[cat],
            })
    for cat, cat_items in categories.items():
        if cat not in CATEGORY_ORDER:
            ordered_categories.append({
                "id": cat.lower().replace(" ", "_"),
                "label": cat,
                "items": cat_items,
            })

    return {
        "summary": {
            "unlocked": unlocked_count,
            "total": total,
            "percent": round((unlocked_count / total) * 100) if total else 0,
            "streak": streak,
            "totalCheckIns": len(ctx.entries),
            "nextUp": next_up,
        },
        "categories": ordered_categories,
        "items": items,
    }
