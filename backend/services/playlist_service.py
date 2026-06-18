from typing import Optional

from sqlalchemy.exc import IntegrityError

from models import MoodEnum, Song, db


def _parse_mood(value: Optional[str]) -> MoodEnum:
    mood = (value or "NEUTRAL").upper()
    try:
        return MoodEnum[mood]
    except KeyError:
        return MoodEnum.NEUTRAL


def _extract_saavn_id(track: dict) -> Optional[str]:
    saavn_id = track.get("saavnId") or track.get("externalId")
    if saavn_id:
        return str(saavn_id)

    raw_id = track.get("id") or track.get("songId")
    if isinstance(raw_id, str) and raw_id.startswith("saavn-"):
        return raw_id.replace("saavn-", "", 1)
    return None


def _apply_track_fields(song: Song, track: dict, saavn_id: Optional[str]) -> Song:
    mood = _parse_mood(track.get("mood") or track.get("playbackMood"))
    language = (track.get("language") or song.language or "Hindi").strip() or "Hindi"

    song.song_name = (track.get("songName") or song.song_name or "Unknown")[:255]
    song.artist = (track.get("artist") or song.artist or "Unknown")[:255]
    song.mood = mood
    song.language = language[:50]
    song.album = (track.get("album") or song.album or "")[:255] or None
    song.movie = (track.get("movie") or song.movie or "")[:255] or None
    song.preview_url = track.get("previewUrl") or track.get("audioUrl") or song.preview_url
    song.image_url = track.get("imageUrl") or song.image_url
    if saavn_id:
        song.external_id = saavn_id
        song.source = "saavn"
    return song


def upsert_song_from_track(track: dict) -> Optional[Song]:
    """Persist a JioSaavn or catalog track so it can live in user playlists."""
    if not track:
        return None

    saavn_id = _extract_saavn_id(track)
    try:
        if saavn_id:
            existing = Song.query.filter_by(external_id=saavn_id).first()
            if existing:
                _apply_track_fields(existing, track, saavn_id)
                db.session.flush()
                return existing

        raw_id = track.get("songId") or track.get("id")
        if raw_id and not str(raw_id).startswith("saavn-"):
            existing = Song.query.get(str(raw_id))
            if existing:
                return existing

        if not track.get("songName") and not saavn_id:
            return None

        song = Song(
            song_name=(track.get("songName") or "Unknown").strip()[:255],
            artist=(track.get("artist") or "Unknown").strip()[:255],
            mood=_parse_mood(track.get("mood") or track.get("playbackMood")),
            language=((track.get("language") or "Hindi").strip() or "Hindi")[:50],
            album=(track.get("album") or "")[:255] or None,
            movie=(track.get("movie") or "")[:255] or None,
            preview_url=track.get("previewUrl") or track.get("audioUrl"),
            image_url=track.get("imageUrl"),
            external_id=saavn_id,
            source=track.get("source") or ("saavn" if saavn_id else "catalog"),
        )
        db.session.add(song)
        db.session.flush()
        return song
    except IntegrityError:
        db.session.rollback()
        if saavn_id:
            return Song.query.filter_by(external_id=saavn_id).first()
        return None
    except Exception:
        db.session.rollback()
        return None


def resolve_song_for_playlist(data: dict) -> Optional[Song]:
    if not data:
        return None

    raw_id = data.get("songId") or data.get("id")
    if raw_id and not str(raw_id).startswith("saavn-"):
        existing = Song.query.get(str(raw_id))
        if existing:
            return existing

    if _extract_saavn_id(data) or data.get("songName"):
        return upsert_song_from_track(data)
    return None
