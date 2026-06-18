import random

from models import MoodHistory, User
from music.music_library import get_mood_playlist, get_mood_song, get_songs_by_mood
from services.emotion_dna_service import compute_emotion_dna
from engines.emotion_engine import predict_next_mood


def _user_language(user_id: str, language: str = None) -> str:
    if language:
        return language
    user = User.query.get(user_id)
    return (user.preferred_language if user else None) or "English"


def get_recommendations(
    user_id: str,
    strategy: str = "current",
    limit: int = 10,
    language: str = None,
    mood: str = None,
) -> list[dict]:
    lang = _user_language(user_id, language)
    entries = (
        MoodHistory.query.filter_by(user_id=user_id)
        .order_by(MoodHistory.date.desc())
        .limit(20)
        .all()
    )

    if mood:
        return get_songs_by_mood(mood, language=lang, limit=limit)

    if strategy == "dna":
        dna = compute_emotion_dna(user_id)
        pcts = dna.get("percentages", {})
        moods = sorted(pcts.keys(), key=lambda m: pcts[m], reverse=True)
        songs = []
        for m in moods[:3]:
            songs.extend(get_songs_by_mood(m, language=lang, limit=4))
        random.shuffle(songs)
        return songs[:limit]

    if strategy == "predicted":
        dna = compute_emotion_dna(user_id)
        pred = predict_next_mood(list(reversed(entries)), dna)
        target = pred.get("predictedMood") or (entries[0].mood.value if entries else "NEUTRAL")
        return get_songs_by_mood(target, language=lang, limit=limit)

    target_mood = entries[0].mood.value if entries else "NEUTRAL"
    return get_songs_by_mood(target_mood, language=lang, limit=limit)


def get_playable_song_for_mood(user_id: str, mood: str, language: str = None):
    lang = _user_language(user_id, language)
    return get_mood_song(mood, lang)


def get_mood_playlist_for_user(
    user_id: str,
    mood: str,
    language: str = None,
    limit: int = 20,
    prefill: bool = True,
):
    lang = _user_language(user_id, language)
    return get_mood_playlist(mood, lang, limit=limit, fast=True, prefill=prefill)
