from models import MoodEnum, Song, SUPPORTED_LANGUAGES
from music.jiosaavn_service import (
    enrich_track_metadata,
    get_new_releases,
    get_search_suggestions,
    mood_playlist_saavn,
    playback_mood_for_detected,
    prefill_playlist_streams,
    smart_search,
    therapeutic_message,
    _instant_browse_songs,
)


def get_songs_by_mood(mood: str, language: str = None, limit: int = 10) -> list[dict]:
    return mood_playlist_saavn(mood, language or "Hindi", limit=limit)


def get_mood_playlist(mood: str, language: str, limit: int = 20, fast: bool = False, prefill: bool = True) -> list[dict]:
    detected = (mood or "NEUTRAL").upper()
    playback = playback_mood_for_detected(detected)
    playlist = mood_playlist_saavn(detected, language, limit=limit, fast=fast)
    note = therapeutic_message(detected)
    for track in playlist:
        track.setdefault("detectedMood", detected)
        track.setdefault("playbackMood", playback)
        track.setdefault("therapeuticNote", note)
    if fast and prefill:
        playlist = prefill_playlist_streams(playlist, count=3)
    return playlist


def get_mood_song(mood: str, language: str):
    playlist = get_mood_playlist(mood, language, limit=1)
    return playlist[0] if playlist else None


def search_songs(
    query: str = "",
    language: str = None,
    mood: str = None,
    page: int = 1,
    per_page: int = 60,
    search_type: str = "auto",
) -> dict:
    page = max(1, page)
    per_page = min(max(per_page, 10), 100)
    fetch_limit = min(per_page * page, 300)

    if not query or not query.strip():
        items = get_new_releases(language=language, limit=per_page)
        if not items:
            items = _instant_browse_songs(language, per_page)
        return {
            "items": items,
            "total": len(items),
            "page": 1,
            "pages": 1,
            "hasMore": False,
            "searchType": "new",
            "title": "New & trending songs",
            "subtitle": "Latest releases · updated live from JioSaavn",
            "source": "saavn",
        }

    result = smart_search(
        query.strip(),
        search_type=search_type or "auto",
        language=language,
        limit=fetch_limit,
    )

    all_items = result.get("items") or []
    start = (page - 1) * per_page
    page_items = all_items[start : start + per_page]

    if mood and mood != "All":
        page_items = [{**t, "mood": mood} for t in page_items]

    result["items"] = page_items
    result["page"] = page
    result["hasMore"] = len(all_items) > start + per_page
    result["total"] = len(all_items)
    result["pages"] = max(1, (len(all_items) + per_page - 1) // per_page)
    return result


def get_suggestions(query: str, language: str = None) -> list[dict]:
    return get_search_suggestions(query, language=language)


def get_languages() -> list[str]:
    return list(SUPPORTED_LANGUAGES)
