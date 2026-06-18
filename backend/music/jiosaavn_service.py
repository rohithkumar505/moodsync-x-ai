import html
import random
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

import jiosaavn
import requests
from jiosaavn import get_direct_url

_client = None
_playback_cache: dict[str, tuple[float, dict]] = {}
PLAYBACK_CACHE_TTL = 900
_search_cache: dict[str, tuple[float, object]] = {}
SEARCH_CACHE_TTL = 600
RAW_SEARCH_TIMEOUT = 10
SEARCH_POOL = ThreadPoolExecutor(max_workers=6)


def _search_cache_get(key: str):
    entry = _search_cache.get(key)
    if not entry:
        return None, False
    fresh = entry[0] > time.time()
    return entry[1], fresh


def _search_cache_set(key: str, value, ttl: int = SEARCH_CACHE_TTL):
    _search_cache[key] = (time.time() + ttl, value)


def _search_cache_get_stale(key: str):
    entry = _search_cache.get(key)
    return entry[1] if entry else None


def _instant_browse_songs(language=None, limit=12):
    """Zero-network browse seed — always available while live search warms up."""
    lang = language or "Hindi"
    items = []
    seen = set()
    for sup in KNOWN_SONG_SUPPLEMENTS:
        item = _supplement_search_item(sup)
        item["language"] = sup.get("language", lang)
        if item["id"] not in seen:
            items.append(item)
            seen.add(item["id"])
        if len(items) >= limit:
            return items[:limit]
    return items[:limit]


def warm_music_cache():
    """Warm common browse/search caches in the background."""
    for lang in (None, "Hindi", "Kannada"):
        try:
            get_new_releases(language=lang, limit=36)
        except Exception:
            pass
    for artist, lang in (
        ("Arijit Singh", "Hindi"),
        ("Jubin Nautiyal", "Hindi"),
        ("Sid Sriram", "Kannada"),
    ):
        try:
            get_artist_songs(artist, language=lang, limit=24)
        except Exception:
            pass

MOOD_SEARCH_QUERIES = {
    "HAPPY": ["{lang} party songs", "{lang} dance hits", "{lang} upbeat romantic", "{lang} feel good songs"],
    "RELAXED": ["{lang} chill songs", "{lang} peaceful music", "{lang} calm acoustic", "{lang} soothing melody"],
    "NEUTRAL": ["top {lang} songs", "{lang} popular hits", "trending {lang} music"],
}

# Detected face mood → music style we play (therapeutic)
THERAPEUTIC_PLAYBACK_MAP = {
    "HAPPY": "HAPPY",       # happy face → happy songs
    "SAD": "HAPPY",         # sad face → uplifting happy songs to cheer up
    "ANGRY": "RELAXED",     # angry face → calm peaceful songs
    "RELAXED": "RELAXED",   # calm face → calm songs
    "NEUTRAL": "NEUTRAL",
}

THERAPEUTIC_MESSAGES = {
    ("HAPPY", "HAPPY"): "You're happy — playing upbeat feel-good songs to match your energy.",
    ("SAD", "HAPPY"): "You seem down — we're playing happy, uplifting songs to lift your mood.",
    ("ANGRY", "RELAXED"): "You seem tense — we're playing calm, peaceful songs to help you relax.",
    ("RELAXED", "RELAXED"): "You're calm — playing soft, mellow songs to keep you at ease.",
    ("NEUTRAL", "NEUTRAL"): "Steady mood — playing popular hits that fit your vibe.",
}


def playback_mood_for_detected(detected_mood: str) -> str:
    return THERAPEUTIC_PLAYBACK_MAP.get((detected_mood or "").upper(), "NEUTRAL")


def therapeutic_message(detected_mood: str) -> str:
    detected = (detected_mood or "NEUTRAL").upper()
    playback = playback_mood_for_detected(detected)
    return THERAPEUTIC_MESSAGES.get(
        (detected, playback),
        f"Playing {playback.lower()} music for your {detected.lower()} mood.",
    )

# Hindi Bollywood — primary mood-sync artists
HINDI_MOOD_ARTISTS = [
    "Arijit Singh",
    "Jubin Nautiyal",
    "Atif Aslam",
    "Armaan Malik",
    "Shreya Ghoshal",
    "Darshan Raval",
    "Sonu Nigam",
    "Neha Kakkar",
]

# Kannada film music artists
KANNADA_MOOD_ARTISTS = [
    "Sanjith Hegde",
    "Sid Sriram",
    "Vijay Prakash",
    "Armaan Malik",
    "Chinmayi",
    "Anirudh",
    "Shreya Ghoshal",
    "Sonu Nigam",
]

TOP_SINGERS = list(dict.fromkeys(HINDI_MOOD_ARTISTS + KANNADA_MOOD_ARTISTS + ["KK", "K.K."]))

MOOD_SINGER_SEARCH_KANNADA = {
    "HAPPY": [
        "sanju hegde belageddu kannada",
        "sid sriram kannada romantic happy",
        "vijay prakash kannada upbeat",
        "armaan malik kannada love",
        "kannada party dance songs",
        "anirudh kannada happy songs",
        "chinmayi kannada melody happy",
    ],
    "RELAXED": [
        "sid sriram kannada soft calm",
        "kannada peaceful melody songs",
        "sanju hegde slow kannada",
        "vijay prakash soulful kannada",
        "kannada acoustic chill songs",
        "chinmayi kannada lullaby soft",
    ],
    "NEUTRAL": [
        "kannada top hits 2024",
        "sanju hegde best kannada songs",
        "sid sriram kannada popular",
        "vijay prakash kannada hits",
    ],
}

MOOD_SINGER_SEARCH_HINDI = {
    "HAPPY": [
        "arijit singh romantic upbeat hindi",
        "jubin nautiyal happy love hindi",
        "atif aslam cheerful romantic hindi",
        "armaan malik happy hindi songs",
        "mohit chauhan fun hindi songs",
        "darshan raval romantic hindi",
        "shreya ghoshal happy hindi",
        "sonu nigam feel good hindi",
        "neha kakkar dance hindi",
        "badshah party hindi songs",
    ],
    "RELAXED": [
        "jubin nautiyal soft acoustic hindi",
        "atif aslam calm peaceful hindi",
        "arijit singh soothing slow hindi",
        "armaan malik soft romantic hindi",
        "rahat fateh ali khan soulful calm",
        "palak muchhal peaceful hindi",
        "javed ali pal calm hindi",
    ],
    "NEUTRAL": [
        "arijit singh top hindi hits",
        "jubin nautiyal best hindi songs",
        "atif aslam popular hindi",
        "armaan malik latest hindi",
        "shreya ghoshal hindi hits",
    ],
}

MOOD_SINGER_SEARCH = MOOD_SINGER_SEARCH_HINDI

# Playback playlists — many different songs, spread across singers (max 1–2 per artist enforced later)
PLAYBACK_HAPPY_HINDI = [
    ("Kesariya", "Arijit Singh"),
    ("Lut Gaye", "Jubin Nautiyal"),
    ("Pehla Nasha", "Atif Aslam"),
    ("O Saathi", "Armaan Malik"),
    ("Matargashti", "Mohit Chauhan"),
    ("Badtameez Dil", "Benny Dayal"),
    ("Love You Zindagi", "Amit Trivedi"),
    ("Senorita", "Vishal Dadlani"),
    ("Kar Gayi Chull", "Badshah"),
    ("London Thumakda", "Labh Janjua"),
    ("Galliyan Returns", "Ankit Tiwari"),
    ("O Mere Dil Ke Chain", "Jubin Nautiyal"),
    ("Tera Ban Jaunga", "Atif Aslam"),
    ("Ilahi", "Arijit Singh"),
    ("Gerua", "Arijit Singh"),
    ("Tera Fitoor", "Arijit Singh"),
    ("Hawayein", "Arijit Singh"),
    ("Raabta", "Arijit Singh"),
    ("Main Hoon Sath Tere", "Armaan Malik"),
    ("Dil Meri Na Sune", "Armaan Malik"),
    ("Ishare Tere", "Darshan Raval"),
    ("Tum Hi Aana", "Jubin Nautiyal"),
    ("Zinda", "Amit Trivedi"),
    ("Samjhawan", "Arijit Singh"),
    ("Bol Do Na Zara", "Armaan Malik"),
]

PLAYBACK_RELAXED_HINDI = [
    ("Humnava Mere", "Jubin Nautiyal"),
    ("Tum Se Hi", "Atif Aslam"),
    ("Raataan Lambiyan", "Arijit Singh"),
    ("Tera Yaar Hoon Main", "Arijit Singh"),
    ("Kaun Tujhe", "Palak Muchhal"),
    ("Pal", "Javed Ali"),
    ("Bol Do Na Zara", "Armaan Malik"),
    ("Chahun Main Ya Naa", "Arijit Singh"),
    ("Tujhe Kitna Chahne Lage", "Arijit Singh"),
    ("Afreen", "Rahat Fateh Ali Khan"),
    ("Sanu Ek Pal", "Rahat Fateh Ali Khan"),
    ("Phir Bhi Tumko Chaahunga", "Arijit Singh"),
    ("Tum Hi Aana", "Jubin Nautiyal"),
    ("Raabta", "Arijit Singh"),
    ("O Mere Dil Ke Chain", "Jubin Nautiyal"),
    ("Main Dhoondne Ko", "Armaan Malik"),
    ("Khairiyat", "Arijit Singh"),
    ("Tum Se Hi", "Atif Aslam"),
    ("Besabriyaan", "Armaan Malik"),
    ("Lag Ja Gale", "Hemant Kumar"),
]

PLAYBACK_NEUTRAL_HINDI = [
    ("Tum Hi Aana", "Jubin Nautiyal"),
    ("Raabta", "Arijit Singh"),
    ("Tera Ban Jaunga", "Atif Aslam"),
    ("Pehla Nasha", "Atif Aslam"),
    ("Main Rahoon Ya Na Rahoon", "Armaan Malik"),
    ("Gerua", "Arijit Singh"),
    ("Hawayein", "Arijit Singh"),
    ("Kesariya", "Arijit Singh"),
    ("Lut Gaye", "Jubin Nautiyal"),
    ("O Saathi", "Armaan Malik"),
    ("Samjhawan", "Arijit Singh"),
    ("Ishare Tere", "Darshan Raval"),
]

PLAYBACK_HAPPY_KANNADA = [
    ("Belageddu", "Sanjith Hegde"),
    ("Karabuu", "Sanjith Hegde"),
    ("Sundari", "Sid Sriram"),
    ("Naanu Neenu", "Sanjith Hegde"),
    ("Tagaru Banthu Tagaru", "Sanjith Hegde"),
    ("KGF Title Track", "Sanjith Hegde"),
    ("Kanasu", "Sid Sriram"),
    ("Ondu Malebillu", "Vijay Prakash"),
    ("Neene", "Sanjith Hegde"),
    ("Mayavi", "Sanjith Hegde"),
    ("Kannada party songs", "Vijay Prakash"),
    ("Anirudh kannada", "Anirudh"),
]

PLAYBACK_RELAXED_KANNADA = [
    ("Neene", "Sanjith Hegde"),
    ("Ninna Nenapu", "Sanjith Hegde"),
    ("Kanasu", "Sid Sriram"),
    ("Ondu Malebillu", "Vijay Prakash"),
    ("Innu Enna", "Sonu Nigam"),
    ("Endu Mareya", "Sanjith Hegde"),
    ("Sid Sriram kannada soft", "Sid Sriram"),
    ("Mayavi", "Sanjith Hegde"),
]

PLAYBACK_NEUTRAL_KANNADA = [
    ("Belageddu", "Sanjith Hegde"),
    ("Sundari", "Sid Sriram"),
    ("Neene", "Sanjith Hegde"),
    ("Kanasu", "Sid Sriram"),
    ("Karabuu", "Sanjith Hegde"),
    ("Ondu Malebillu", "Vijay Prakash"),
]

# Legacy aliases
MOOD_CURATED_HINDI = {
    "HAPPY": PLAYBACK_HAPPY_HINDI,
    "RELAXED": PLAYBACK_RELAXED_HINDI,
    "NEUTRAL": PLAYBACK_NEUTRAL_HINDI,
    "SAD": PLAYBACK_HAPPY_HINDI,
    "ANGRY": PLAYBACK_RELAXED_HINDI,
}

MOOD_CURATED_KANNADA = {
    "HAPPY": PLAYBACK_HAPPY_KANNADA,
    "RELAXED": PLAYBACK_RELAXED_KANNADA,
    "NEUTRAL": PLAYBACK_NEUTRAL_KANNADA,
    "SAD": PLAYBACK_HAPPY_KANNADA,
    "ANGRY": PLAYBACK_RELAXED_KANNADA,
}

MOOD_CURATED_HITS = MOOD_CURATED_HINDI

LANGUAGE_TERMS = {
    "English": "english",
    "Hindi": "hindi bollywood",
    "Tamil": "tamil",
    "Telugu": "telugu",
    "Punjabi": "punjabi",
    "Kannada": "kannada",
}

MOVIE_HINTS = ("movie", "film", "ost", "soundtrack", "songs from")
HERO_HINTS = ("hero", "actor", "actress", "star")
BAD_VERSION = re.compile(
    r"\b(lofi|lo-fi|remix|re-mix|mix|mashup|unplugged|karaoke|instrumental|"
    r"rendition|reprise|cover|flip|slowed|sped\s*up|8d\s*audio|ringtone)\b",
    re.I,
)
COMPILATION = re.compile(
    r"\b(best\s+of|hits|collection|ultimate|moody|valentine|world\s+music|"
    r"loveholic|romantic\s+hits|evergreen\s+classics)\b",
    re.I,
)

SUMIT_API = "https://saavn.sumit.co/api"

# Tracks missing from JioSaavn search/album APIs but playable via direct link.
KNOWN_SONG_SUPPLEMENTS = [
    {
        "songName": "Jeene Laga Hoon",
        "artist": "Atif Aslam, Shreya Ghoshal",
        "movie": "Ramaiya Vastavaiya",
        "album": "Ramaiya Vastavaiya",
        "language": "Hindi",
        "saavnId": "CB04YRNfTlA",
        "saavnUrl": "https://www.jiosaavn.com/song/jeene-laga-hoon/CB04YRNfTlA",
        "aliases": [
            "jeene laga hoon",
            "jeena laga hun",
            "jeene laga hun",
            "jeene laga hoon pehle se zyada",
            "jeene laga hoon pehle se jyada",
            "jeena laga hun pehle se jada",
            "jeene laga hoon ramaiya vastavaiya",
            "ramaiya vastavaiya jeene laga hoon",
            "ramaiya vastavaiya",
        ],
    },
]


def _get_client():
    global _client
    if _client is None:
        _client = jiosaavn.JioSaavnClient()
    return _client


def _clean(text):
    if not text:
        return ""
    text = html.unescape(text)
    text = re.sub(r"<[^>]+>", "", text)
    return text.strip()


def _with_language(term, language):
    lang_term = LANGUAGE_TERMS.get(language or "", "")
    if lang_term and lang_term.lower() not in term.lower():
        return f"{term} {lang_term}"
    return term


def _movie_from_album(album):
    if not album:
        return ""
    album = _clean(album)
    lower = album.lower()
    if "from \"" in lower or "from '" in lower or "from “" in lower:
        m = re.search(r'from ["\'“](.+?)["\'”]', album, re.I)
        if m:
            return m.group(1)
    if "original motion picture" in lower or "soundtrack" in lower:
        return album.split("(")[0].strip()
    return album


def _normalize_name(text):
    return re.sub(r"[^a-z0-9]+", "", (text or "").lower())


def _normalize_title(title):
    t = _clean(title).lower()
    t = re.sub(r"\s*\(from.*", "", t, flags=re.I)
    t = re.sub(r"\s*-\s*.*", "", t)
    return re.sub(r"[^a-z0-9]", "", t)


def _is_top_singer(author: str) -> bool:
    if not author:
        return False
    lower = author.lower()
    return any(name.lower() in lower for name in TOP_SINGERS)


def _mood_artists_for_language(language: str) -> list:
    if language == "Kannada":
        return KANNADA_MOOD_ARTISTS
    return HINDI_MOOD_ARTISTS


def _is_mood_artist(author: str, language: str) -> bool:
    if not author:
        return False
    lower = author.lower()
    return any(name.lower() in lower for name in _mood_artists_for_language(language))


def _curated_for_language(playback_mood: str, language: str) -> list:
    if language == "Kannada":
        return MOOD_CURATED_KANNADA.get(playback_mood, MOOD_CURATED_KANNADA["NEUTRAL"])
    return MOOD_CURATED_HINDI.get(playback_mood, MOOD_CURATED_HINDI["NEUTRAL"])


def _primary_artist(name: str) -> str:
    if not name:
        return ""
    clean = re.split(r"[,/&]| feat\.? | ft\.? | x ", name, flags=re.I)[0]
    return clean.strip().lower()


def _diversify_playlist(tracks: list, limit: int, max_per_artist: int = 2) -> list:
    """Spread songs across singers — avoid same artist repeating back-to-back."""
    seen_ids = set()
    seen_titles = set()
    artist_counts: dict = {}
    picked = []

    for item in tracks:
        tid = item.get("id")
        title = _normalize_title(item.get("songName", ""))
        artist = _primary_artist(item.get("artist", ""))

        if tid and tid in seen_ids:
            continue
        if title and title in seen_titles:
            continue
        if artist and artist_counts.get(artist, 0) >= max_per_artist:
            continue

        if tid:
            seen_ids.add(tid)
        if title:
            seen_titles.add(title)
        if artist:
            artist_counts[artist] = artist_counts.get(artist, 0) + 1
        picked.append(item)
        if len(picked) >= limit:
            break

    # Interleave so same singer doesn't cluster
    if len(picked) <= 2:
        return picked

    by_artist: dict = {}
    for item in picked:
        key = _primary_artist(item.get("artist", "")) or item.get("id", "")
        by_artist.setdefault(key, []).append(item)

    interleaved = []
    queues = list(by_artist.values())
    random.shuffle(queues)
    while queues and len(interleaved) < limit:
        next_queues = []
        for q in queues:
            if q:
                interleaved.append(q.pop(0))
            if q:
                next_queues.append(q)
        queues = next_queues

    return interleaved[:limit]


def _singer_search_for_language(mood: str, language: str) -> list:
    if language == "Kannada":
        return MOOD_SINGER_SEARCH_KANNADA.get(mood, MOOD_SINGER_SEARCH_KANNADA["NEUTRAL"])
    return MOOD_SINGER_SEARCH_HINDI.get(mood, MOOD_SINGER_SEARCH_HINDI["NEUTRAL"])


def _format_search_query(template: str, lang_term: str) -> str:
    try:
        return template.format(lang=lang_term)
    except (KeyError, ValueError):
        return template


def _artist_from_query(query: str):
    lower = query.lower()
    for name in TOP_SINGERS:
        if name.lower() in lower:
            return name
    return None


def _saavn_id_from_url(url):
    if not url:
        return None
    match = re.search(r"/song/[^/]+/([^/?]+)", url)
    return match.group(1) if match else None


def _supplement_matches(sup, query="", movie=None):
    qn = _normalize_name(query)
    if qn:
        for alias in sup.get("aliases", []):
            an = _normalize_name(alias)
            if an and (an in qn or qn in an or _score_match(query, alias) >= 72):
                return True
        song_key = _normalize_name(sup.get("songName", ""))
        if song_key and (song_key in qn or qn in song_key):
            return True

    if movie and _normalize_name(movie) == _normalize_name(sup.get("movie", "")):
        if not qn or any(token in qn for token in ("jeene", "jeena", "laga", "hoon", "hun")):
            return True
    return False


def _match_supplements(query="", movie=None):
    return [s for s in KNOWN_SONG_SUPPLEMENTS if _supplement_matches(s, query, movie)]


def _supplement_by_id(saavn_id):
    for sup in KNOWN_SONG_SUPPLEMENTS:
        if sup.get("saavnId") == saavn_id:
            return sup
    return None


def _fetch_sumit_song(link_url):
    try:
        response = requests.get(
            f"{SUMIT_API}/songs",
            params={"link": link_url},
            timeout=15,
        )
        response.raise_for_status()
        payload = response.json()
        songs = payload.get("data") or []
        return songs[0] if songs else None
    except Exception:
        return None


def _best_sumit_stream(sumit_song):
    for quality in ("320kbps", "160kbps", "96kbps", "48kbps"):
        for item in sumit_song.get("downloadUrl") or []:
            if item.get("quality") == quality and item.get("url"):
                return item["url"]
    return None


def _supplement_search_item(sup, mood="NEUTRAL"):
    return {
        "id": f"saavn-{sup['saavnId']}",
        "songName": sup["songName"],
        "artist": sup["artist"],
        "album": sup.get("album", ""),
        "movie": sup.get("movie", ""),
        "mood": mood,
        "language": sup.get("language", "Hindi"),
        "imageUrl": "https://c.saavncdn.com/637/Ramaiya-Vastavaiya-Hindi-2013-20240408213717-500x500.jpg",
        "source": "saavn",
        "saavnId": sup["saavnId"],
        "playUrl": f"/api/music/play/{sup['saavnId']}",
    }


def _merge_supplement_items(items, supplements, limit=None):
    if not supplements:
        return items

    merged = []
    pinned_titles = set()
    seen_ids = set()

    for sup in supplements:
        item = _supplement_search_item(sup)
        sid = item.get("saavnId")
        title = _normalize_title(item.get("songName", ""))
        merged.append(item)
        if sid:
            seen_ids.add(sid)
        if title:
            pinned_titles.add(title)

    for item in items:
        sid = item.get("saavnId") or item.get("id")
        title = _normalize_title(item.get("songName", ""))
        if sid and sid in seen_ids:
            continue
        if title and title in pinned_titles:
            continue
        merged.append(item)
        if sid:
            seen_ids.add(sid)

    return merged[:limit] if limit else merged


def _resolve_supplement_playback(sup):
    sumit = _fetch_sumit_song(sup.get("saavnUrl"))
    if not sumit:
        return None
    stream = _best_sumit_stream(sumit)
    if not stream:
        return None

    saavn_id = _saavn_id_from_url(sumit.get("url")) or sup.get("saavnId")
    images = sumit.get("image") or []
    image_url = images[-1].get("url") if images else None
    artists = sumit.get("artists", {}).get("primary") or []
    artist = ", ".join(a["name"] for a in artists if a.get("name")) or sup.get("artist", "")

    meta = _supplement_search_item(sup)
    meta.update({
        "saavnId": saavn_id,
        "id": f"saavn-{saavn_id}",
        "playUrl": f"/api/music/play/{saavn_id}",
        "artist": artist or meta["artist"],
        "album": sup.get("album") or (sumit.get("album") or {}).get("name", meta["album"]),
        "durationMs": int((sumit.get("duration") or 0) * 1000),
        "imageUrl": image_url or meta.get("imageUrl"),
        "audioUrl": stream,
        "previewUrl": stream,
    })
    return meta


def _score_match(query, candidate):
    q = _normalize_name(query)
    c = _normalize_name(candidate)
    if not q or not c:
        return 0
    if q == c:
        return 100
    if q in c or c in q:
        return 80
    q_words = set(re.findall(r"[a-z0-9]+", query.lower()))
    c_words = set(re.findall(r"[a-z0-9]+", candidate.lower()))
    if q_words and q_words <= c_words:
        return 70
    return len(q_words & c_words) * 15


def _rank_track(track, query="", artist=None, movie=None):
    title = _clean(track.title)
    author = _clean(track.author)
    album = _clean(track.albumName)
    base_title = re.sub(r"\s*\(.*", "", title).strip()

    score = 0
    score += _score_match(query, base_title) * 2
    score += _score_match(query, title)

    if artist and _score_match(artist, author) >= 50:
        score += 50
    elif _is_top_singer(author):
        score += 40
    if movie:
        score += max(
            _score_match(movie, album),
            _score_match(movie, _movie_from_album(album)),
        )

    if BAD_VERSION.search(title):
        score -= 80
    if COMPILATION.search(album):
        score -= 35

    movie_name = _movie_from_album(album)
    if movie_name and not COMPILATION.search(album):
        score += 25
    if album and _score_match(base_title, album) < 30 and not COMPILATION.search(album):
        score += 15
    if "aashiqui" in album.lower() or album.lower() == movie.lower() if movie else False:
        score += 20

    if track.duration_ms and track.duration_ms >= 150000:
        score += 20
    elif track.duration_ms and track.duration_ms < 60000:
        score -= 30

    if author and not COMPILATION.search(album):
        score += 5

    return score


def _stream_url(track):
    if not track.encryptedMediaUrl:
        return None
    for quality in ("320kbps", "160kbps", "96kbps", "48kbps"):
        url = get_direct_url(track.encryptedMediaUrl, quality=quality)
        if url:
            return url
    return None


def _format_track_meta(track, mood="NEUTRAL", language="English", movie=""):
    album = _clean(track.albumName)
    movie_name = movie or _movie_from_album(album)
    return {
        "id": f"saavn-{track.identifier}",
        "songName": _clean(track.title),
        "artist": _clean(track.author),
        "album": album,
        "movie": movie_name,
        "mood": mood,
        "language": language,
        "imageUrl": track.artworkUrl or track.artistArtworkUrl,
        "source": "saavn",
        "durationMs": track.duration_ms,
        "saavnId": track.identifier,
        "albumUrl": track.albumUrl,
        "artistUrl": track.artistUrl,
        "playUrl": f"/api/music/play/{track.identifier}",
    }


def resolve_playback(saavn_id):
    if not saavn_id:
        return None

    cached = _playback_cache.get(saavn_id)
    if cached and cached[0] > time.time():
        return dict(cached[1])

    meta = None
    try:
        track = _get_client().get_track_by_id(saavn_id)
        stream = _stream_url(track)
        if stream:
            meta = _format_track_meta(track)
            meta["audioUrl"] = stream
            meta["previewUrl"] = stream
    except Exception:
        pass

    if not meta:
        sup = _supplement_by_id(saavn_id)
        if sup:
            meta = _resolve_supplement_playback(sup)

    if meta:
        _playback_cache[saavn_id] = (time.time() + PLAYBACK_CACHE_TTL, meta)
    return meta


def prefill_playlist_streams(playlist, count=3):
    """Resolve stream URLs for the first tracks so playback starts instantly."""
    if not playlist:
        return playlist

    out = [dict(item) for item in playlist]
    jobs = []
    for idx, item in enumerate(out[:count]):
        if item.get("audioUrl"):
            continue
        sid = item.get("saavnId")
        if sid:
            jobs.append((idx, sid))

    if not jobs:
        return out

    with ThreadPoolExecutor(max_workers=min(len(jobs), 4)) as pool:
        futures = {pool.submit(resolve_playback, sid): idx for idx, sid in jobs}
        for future in as_completed(futures):
            idx = futures[future]
            try:
                resolved = future.result()
            except Exception:
                continue
            if resolved and resolved.get("audioUrl"):
                out[idx]["audioUrl"] = resolved["audioUrl"]
                out[idx]["previewUrl"] = resolved["audioUrl"]
    return out


def _rank_and_format(tracks, query="", language="English", mood="NEUTRAL", movie="", artist=None, limit=50):
    scored = []
    for track in tracks:
        score = _rank_track(track, query=query, artist=artist, movie=movie)
        if score < 20 and query:
            continue
        scored.append((score, track))

    scored.sort(key=lambda x: x[0], reverse=True)

    out = []
    seen_ids = set()
    seen_titles = set()

    for _, track in scored:
        title = _clean(track.title)
        if BAD_VERSION.search(title):
            continue
        sid = track.identifier
        stitle = _normalize_title(track.title)
        if sid in seen_ids:
            continue
        if stitle and stitle in seen_titles:
            continue
        formatted = _format_track_meta(track, mood=mood, language=language, movie=movie)
        seen_ids.add(sid)
        if stitle:
            seen_titles.add(stitle)
        out.append(formatted)
        if len(out) >= limit:
            break
    return out


def _raw_search(term, language=None, limit=50):
    cache_key = f"raw:{language}:{limit}:{term.strip().lower()}"
    cached, fresh = _search_cache_get(cache_key)
    if fresh and cached is not None:
        return list(cached)

    def _run():
        client = _get_client()
        primary_term = _with_language(term, language) if language else term
        results = client.search(primary_term)
        items = list(results)[:limit]

        if len(items) < 8:
            fallback = client.search(term)
            seen = {t.identifier for t in items}
            for track in fallback:
                if track.identifier not in seen:
                    items.append(track)
                    seen.add(track.identifier)
                if len(items) >= limit:
                    break
        return items

    try:
        future = SEARCH_POOL.submit(_run)
        items = future.result(timeout=RAW_SEARCH_TIMEOUT)
    except Exception:
        stale = _search_cache_get_stale(cache_key)
        return list(stale) if stale is not None else []

    _search_cache_set(cache_key, items)
    return items


def _collect_search_tracks(query, language=None, artist=None, movie=None, limit=60):
    q = query.strip()
    variants = [
        q,
        f"{q} song",
        f"{q} full song",
        f"{q} official",
    ]
    if artist:
        variants.extend([f"{q} {artist}", f"{artist} {q}"])
    if movie:
        variants.extend([f"{q} {movie}", f"{movie} {q} songs", f"{q} movie song"])
    if "song" not in q.lower():
        variants.append(f"{q} songs")
    if language:
        lang = LANGUAGE_TERMS.get(language, language.lower())
        variants.append(f"{q} {lang}")

    merged = []
    seen = set()
    for term in variants:
        for track in _raw_search(term, language=language, limit=limit):
            if track.identifier not in seen:
                seen.add(track.identifier)
                merged.append(track)
            if len(merged) >= limit:
                return merged
    return merged


def _best_album_url(query, tracks):
    if not tracks:
        return None, None

    best_url = None
    best_name = None
    best_score = 0
    seen = set()

    for track in tracks:
        url = track.albumUrl
        name = _clean(track.albumName)
        if not url or url in seen:
            continue
        seen.add(url)
        score = _score_match(query, name)
        movie = _movie_from_album(name)
        if movie:
            score = max(score, _score_match(query, movie))
        if COMPILATION.search(name):
            score -= 20
        if score > best_score:
            best_score = score
            best_url = url
            best_name = movie or name

    if best_score < 40:
        return None, None
    return best_url, best_name


def get_album_songs(album_url, language=None, movie="", limit=50):
    if not album_url:
        return []
    try:
        album = _get_client().get_album_by_url(album_url)
        movie_name = movie or _clean(album.name)
        return _rank_and_format(
            album.tracks,
            query=movie_name,
            language=language,
            movie=movie_name,
            limit=limit,
        )
    except Exception:
        return []


def get_movie_songs(movie_name, language=None, limit=50):
    query = movie_name.strip()
    cache_key = f"movie:{language}:{limit}:{query.lower()}"
    cached, fresh = _search_cache_get(cache_key)
    if fresh and cached is not None:
        songs, name = cached
        return list(songs), name

    album_name = query
    songs = []

    for term in [f"{query} movie songs", query]:
        tracks = _raw_search(term, language=language, limit=20)
        album_url, found_name = _best_album_url(query, tracks)
        if album_url:
            songs = get_album_songs(album_url, language=language, movie=found_name or query, limit=limit)
            if songs:
                album_name = found_name or query
                break

    if not songs:
        tracks = _collect_search_tracks(query, language=language, movie=query, limit=min(limit, 30))
        songs = _rank_and_format(tracks, query=query, language=language or "English", movie=query, limit=limit)

    supplements = _match_supplements(movie=album_name)
    songs = _merge_supplement_items(songs, supplements, limit=limit)
    result = (songs, album_name)
    if songs:
        _search_cache_set(cache_key, result)
    return result


def get_artist_songs(artist_name, language=None, limit=50, hero=False):
    name = artist_name.strip()
    cache_key = f"artist:{hero}:{language}:{limit}:{name.lower()}"
    cached, fresh = _search_cache_get(cache_key)
    if fresh and cached is not None:
        songs, artist = cached
        return list(songs), artist

    if hero:
        songs, artist = _get_hero_songs(name, language=language, limit=limit)
    else:
        songs, artist = _get_artist_songs_fast(name, language=language, limit=limit)

    if songs:
        _search_cache_set(cache_key, (songs, artist))
    return songs, artist


def _get_artist_songs_fast(artist_name, language=None, limit=50):
    name = artist_name.strip()
    all_tracks = []
    seen = set()

    for track in _raw_search(f"{name} songs", language=language, limit=min(limit + 12, 36)):
        author = _clean(track.author)
        if _score_match(name, author) >= 50 and track.identifier not in seen:
            seen.add(track.identifier)
            all_tracks.append(track)

    songs = _rank_and_format(all_tracks, query=name, language=language or "English", artist=name, limit=limit)
    if len(songs) >= min(8, max(4, limit // 3)):
        return songs, name

    best_url = None
    best_score = 0
    for track in all_tracks[:12]:
        if not track.artistUrl:
            continue
        score = _score_match(name, _clean(track.author))
        if score > best_score:
            best_score = score
            best_url = track.artistUrl

    if best_url and best_score >= 50:
        try:
            artist = _get_client().get_artist_by_url(best_url)
            for track in artist.tracks[: limit + 20]:
                if _score_match(name, _clean(track.author)) >= 50 and track.identifier not in seen:
                    seen.add(track.identifier)
                    all_tracks.append(track)
        except Exception:
            pass

    songs = _rank_and_format(all_tracks, query=name, language=language or "English", artist=name, limit=limit)
    if songs:
        return songs, name

    tracks = _raw_search(f"{name} {LANGUAGE_TERMS.get(language or '', '')}".strip(), language=language, limit=limit)
    return _rank_and_format(tracks, query=name, language=language or "English", artist=name, limit=limit), name


def _get_hero_songs(hero_name, language=None, limit=50):
    name = hero_name.strip()
    all_tracks = []
    seen = set()
    for term in [f"{name} movie songs", f"{name} songs", name]:
        for track in _raw_search(_with_language(term, language), language=language, limit=30):
            if track.identifier not in seen:
                seen.add(track.identifier)
                all_tracks.append(track)

    songs = _rank_and_format(all_tracks, query=name, language=language or "English", limit=limit)
    return songs, name


def search_saavn(query, language=None, limit=50):
    q = query.strip()
    tracks = _collect_search_tracks(q, language=language, limit=limit * 3)
    extra_terms = [f"{q} audio", f"{q} original", f"{q} video song"]
    seen = {t.identifier for t in tracks}
    for term in extra_terms:
        for track in _raw_search(term, language=language, limit=20):
            if track.identifier not in seen:
                seen.add(track.identifier)
                tracks.append(track)
    return _rank_and_format(tracks, query=q, language=language or "English", limit=limit)


def _comprehensive_search(query, language=None, limit=80):
    """Merge movie OST, singer catalog, and song matches for maximum coverage."""
    q = query.strip()
    merged = []
    seen_ids = set()

    def absorb(items):
        for item in items:
            if item["id"] in seen_ids:
                continue
            seen_ids.add(item["id"])
            merged.append(item)

    movie_items, _ = get_movie_songs(q, language=language, limit=limit)
    absorb(movie_items)

    singer_items, _ = get_artist_songs(q, language=language, limit=limit)
    absorb(singer_items)

    hero_items, _ = _get_hero_songs(q, language=language, limit=limit)
    absorb(hero_items)

    absorb(search_saavn(q, language=language, limit=limit))

    return merged[:limit]


def _fallback_browse_songs(language=None, limit=30):
    """Curated fallback when live JioSaavn browse/search returns too few tracks."""
    lang = language or "Hindi"
    curated = list(_curated_for_language("NEUTRAL", lang))[: min(limit, 14)]
    items = []
    seen = set()

    def _resolve_pair(pair):
        song_name, artist = pair
        tracks = _raw_search(f"{song_name} {artist}", language=lang, limit=10)
        ranked = _rank_and_format(
            tracks,
            query=song_name,
            language=lang,
            artist=artist,
            limit=2,
        )
        for item in ranked:
            title_norm = _normalize_title(item.get("songName", ""))
            want_norm = _normalize_title(song_name)
            if want_norm in title_norm or title_norm in want_norm:
                return item
        return ranked[0] if ranked else None

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(_resolve_pair, pair) for pair in curated]
        for future in as_completed(futures):
            try:
                item = future.result(timeout=RAW_SEARCH_TIMEOUT)
            except Exception:
                continue
            if not item:
                continue
            sid = item.get("id")
            if sid and sid not in seen:
                seen.add(sid)
                items.append(item)
            if len(items) >= limit:
                break

    if not items:
        for sup in KNOWN_SONG_SUPPLEMENTS:
            item = _supplement_search_item(sup)
            if item["id"] not in seen:
                items.append(item)
                seen.add(item["id"])
            if len(items) >= limit:
                break

    return items[:limit]


def get_new_releases(language=None, limit=30):
    cache_key = f"new:{language}:{limit}"
    cached, fresh = _search_cache_get(cache_key)
    if fresh and cached is not None:
        return list(cached)

    year = datetime.now().year
    lang = LANGUAGE_TERMS.get(language or "Hindi", "hindi")
    queries = [
        f"trending {lang} hits",
        f"top {lang} songs",
        f"latest {lang} songs {year}",
    ]

    merged = []
    seen = set()
    min_ready = max(10, min(limit, 20))

    futures = [SEARCH_POOL.submit(_raw_search, q, language, 15) for q in queries]
    for future in as_completed(futures):
        try:
            for track in future.result(timeout=RAW_SEARCH_TIMEOUT):
                if track.identifier in seen:
                    continue
                seen.add(track.identifier)
                merged.append(track)
        except Exception:
            continue
        if len(merged) >= min_ready:
            break

    items = _rank_and_format(merged, language=language or "Hindi", limit=limit)

    if len(items) < max(6, limit // 3):
        fallback = _fallback_browse_songs(language, limit)
        seen_ids = {i["id"] for i in items}
        for item in fallback:
            if item["id"] not in seen_ids:
                items.append(item)
                seen_ids.add(item["id"])
            if len(items) >= limit:
                break

    if not items:
        stale = _search_cache_get_stale(cache_key)
        if stale:
            return list(stale)
        return _instant_browse_songs(language, limit)

    _search_cache_set(cache_key, items)
    return items[:limit]


def get_search_suggestions(query, language=None, limit=20):
    if not query or len(query.strip()) < 2:
        return []

    q = query.strip()
    cache_key = f"suggest:{language or 'all'}:{q.lower()}"
    cached, fresh = _search_cache_get(cache_key)
    if fresh and cached:
        return list(cached)[:limit]

    tracks = _raw_search(q, language=language, limit=25)
    if len(tracks) < 8:
        tracks.extend(_raw_search(f"{q} songs", language=language, limit=15))
    suggestions = []
    seen = set()

    def add(item, prepend=False):
        key = (item["type"], item["query"].lower())
        if key in seen or len(suggestions) >= limit:
            return
        seen.add(key)
        if prepend:
            suggestions.insert(0, item)
        else:
            suggestions.append(item)

    for sup in _match_supplements(q):
        add({
            "type": "song",
            "label": sup["songName"],
            "subtitle": f"{sup['artist']} · {sup.get('movie', '')}",
            "query": sup["songName"],
            "imageUrl": "https://c.saavncdn.com/637/Ramaiya-Vastavaiya-Hindi-2013-20240408213717-500x500.jpg",
        }, prepend=True)
        if sup.get("movie"):
            add({
                "type": "movie",
                "label": sup["movie"],
                "subtitle": "All songs from this movie",
                "query": sup["movie"],
                "imageUrl": "https://c.saavncdn.com/637/Ramaiya-Vastavaiya-Hindi-2013-20240408213717-500x500.jpg",
            }, prepend=True)

    for track in tracks:
        title = _clean(track.title)
        artist = _clean(track.author)
        album = _clean(track.albumName)
        movie = _movie_from_album(album)
        clean_title = re.sub(r"\s*\(from.*", "", title, flags=re.I).strip()

        add({
            "type": "song",
            "label": clean_title,
            "subtitle": artist or "Song",
            "query": clean_title,
            "imageUrl": track.artworkUrl,
        })

        if movie and len(movie) > 2:
            add({
                "type": "movie",
                "label": movie,
                "subtitle": "All songs from this movie",
                "query": movie,
                "imageUrl": track.artworkUrl,
            })
        elif album and not COMPILATION.search(album) and len(album) > 2:
            add({
                "type": "movie",
                "label": album,
                "subtitle": "All album / movie songs",
                "query": album,
                "imageUrl": track.artworkUrl,
            })

        if artist:
            add({
                "type": "singer",
                "label": artist,
                "subtitle": "All songs by this singer",
                "query": artist,
                "imageUrl": track.artistArtworkUrl or track.artworkUrl,
            })
            if _looks_like_star(artist) or any(h in artist.lower() for h in STAR_NAME_HINTS):
                add({
                    "type": "hero",
                    "label": artist,
                    "subtitle": "Hero / actor songs",
                    "query": artist,
                    "imageUrl": track.artistArtworkUrl or track.artworkUrl,
                })

    _search_cache_set(cache_key, suggestions, ttl=300)
    return suggestions


STAR_NAME_HINTS = ("khan", "kapoor", "bachchan", "devgn", "roshan", "kaif", "ranaut", "dhawan")


def _looks_like_person(query):
    words = query.strip().split()
    if len(words) != 2:
        return False
    lower = query.lower()
    if any(h in lower for h in MOVIE_HINTS + HERO_HINTS):
        return False
    if lower.endswith(" songs") or lower.endswith(" song"):
        return False
    return True


def _looks_like_star(query):
    lower = query.lower()
    if any(h in lower for h in HERO_HINTS):
        return True
    return any(h in lower for h in STAR_NAME_HINTS) and len(query.split()) >= 2


def _looks_like_movie(query):
    words = query.strip().split()
    lower = query.lower()
    if any(h in lower for h in MOVIE_HINTS):
        return True
    return len(words) == 1 and len(lower) >= 3


def _detect_search_type(query, search_type):
    if search_type and search_type != "auto":
        return search_type
    q = query.lower().strip()
    if any(h in q for h in HERO_HINTS):
        return "hero"
    if any(h in q for h in MOVIE_HINTS):
        return "movie"
    if q.endswith(" songs") or q.endswith(" song"):
        name = re.sub(r"\s+songs?$", "", q, flags=re.I).strip()
        if name and len(name.split()) <= 4:
            return "singer"
    return "auto"


def _cache_smart_result(cache_key, result, query="", language=None, limit=50):
    items = list(result.get("items") or [])
    if not items and query:
        fallback = search_saavn(query, language=language, limit=limit)
        fallback = _merge_supplement_items(fallback, _match_supplements(query), limit=limit)
        if fallback:
            result = {
                **result,
                "items": fallback,
                "total": len(fallback),
                "subtitle": result.get("subtitle") or f"{len(fallback)} songs",
            }
    if result.get("items"):
        _search_cache_set(cache_key, result)
        return result
    stale = _search_cache_get_stale(cache_key)
    if stale:
        return dict(stale)
    return result


def smart_search(query, search_type="auto", language=None, limit=50):
    q = (query or "").strip()
    stype = search_type or "auto"
    cache_key = f"smart:{stype}:{language}:{limit}:{q.lower()}"
    cached, fresh = _search_cache_get(cache_key)
    if fresh and cached is not None:
        return dict(cached)

    if not q:
        result = {
            "items": get_new_releases(language=language, limit=limit),
            "total": 0,
            "searchType": "new",
            "title": "New & trending songs",
            "subtitle": "Latest releases updated live",
            "source": "saavn",
        }
        result["total"] = len(result["items"])
        _search_cache_set(cache_key, result)
        return result

    stype = _detect_search_type(q, stype)
    catalog_limit = min(max(limit, 36), 60)

    if stype == "auto":
        for sup in KNOWN_SONG_SUPPLEMENTS:
            movie_name = sup.get("movie")
            if movie_name and _normalize_name(movie_name) == _normalize_name(q):
                items, name = get_movie_songs(movie_name, language=language, limit=catalog_limit)
                return _cache_smart_result(cache_key, {
                    "items": items,
                    "total": len(items),
                    "searchType": "movie",
                    "title": f"All songs from {name}",
                    "subtitle": f"{len(items)} full tracks",
                    "source": "saavn",
                }, q, language, limit)

    if stype == "new":
        items = get_new_releases(language=language, limit=limit)
        return _cache_smart_result(cache_key, {
            "items": items,
            "total": len(items),
            "searchType": "new",
            "title": "New & trending songs",
            "subtitle": q,
            "source": "saavn",
        }, q, language, limit)

    if stype == "movie":
        clean = re.sub(r"\b(movie|film|ost|soundtrack|songs?|from)\b", "", q, flags=re.I).strip()
        items, name = get_movie_songs(clean or q, language=language, limit=catalog_limit)
        return _cache_smart_result(cache_key, {
            "items": items,
            "total": len(items),
            "searchType": "movie",
            "title": f"All songs from {name}",
            "subtitle": f"{len(items)} full tracks",
            "source": "saavn",
        }, q, language, limit)

    if stype in ("singer", "hero"):
        clean = re.sub(r"\b(songs?|singer|hero|actor|actress|star)\b", "", q, flags=re.I).strip()
        items, name = get_artist_songs(clean or q, language=language, limit=catalog_limit, hero=(stype == "hero"))
        label = "Hero" if stype == "hero" else "Singer"
        return _cache_smart_result(cache_key, {
            "items": items,
            "total": len(items),
            "searchType": stype,
            "title": f"All songs by {name}",
            "subtitle": f"{label} · {len(items)} full tracks",
            "source": "saavn",
        }, clean or q, language, limit)

    if stype == "song":
        items = search_saavn(q, language=language, limit=limit)
        items = _merge_supplement_items(items, _match_supplements(q), limit=limit)
        return _cache_smart_result(cache_key, {
            "items": items,
            "total": len(items),
            "searchType": "song",
            "title": f"Results for \"{q}\"",
            "subtitle": f"{len(items)} full songs",
            "source": "saavn",
        }, q, language, limit)

    if stype == "auto" and _looks_like_star(q):
        items, name = _get_hero_songs(q, language=language, limit=catalog_limit)
        if len(items) >= 3:
            return _cache_smart_result(cache_key, {
                "items": items,
                "total": len(items),
                "searchType": "hero",
                "title": f"All songs by {name}",
                "subtitle": "Auto-matched hero / actor",
                "source": "saavn",
            }, q, language, limit)

    if stype == "auto" and _looks_like_person(q):
        items, name = get_artist_songs(q, language=language, limit=catalog_limit)
        if len(items) >= 3:
            return _cache_smart_result(cache_key, {
                "items": items,
                "total": len(items),
                "searchType": "singer",
                "title": f"All songs by {name}",
                "subtitle": "Auto-matched singer",
                "source": "saavn",
            }, q, language, limit)

    tracks = _collect_search_tracks(q, language=language, limit=30)
    album_url, album_name = _best_album_url(q, tracks)
    if album_url and len(q.split()) == 1 and _score_match(q, album_name or "") >= 70:
        album_songs = get_album_songs(album_url, language=language, movie=album_name or q, limit=limit)
        if len(album_songs) >= 2:
            song_matches = _rank_and_format(tracks, query=q, language=language or "English", limit=limit)
            merged = []
            seen = set()
            for t in album_songs + song_matches:
                if t["id"] not in seen:
                    seen.add(t["id"])
                    merged.append(t)
            return _cache_smart_result(cache_key, {
                "items": merged[:limit],
                "total": len(merged[:limit]),
                "searchType": "movie",
                "title": f"All songs from {album_name or q}",
                "subtitle": "Auto-matched movie / album",
                "source": "saavn",
            }, q, language, limit)

    items = search_saavn(q, language=language, limit=limit)
    if stype == "auto" and len(items) < 8:
        items = _comprehensive_search(q, language=language, limit=catalog_limit)
    items = _merge_supplement_items(items, _match_supplements(q), limit=limit)
    return _cache_smart_result(cache_key, {
        "items": items,
        "total": len(items),
        "searchType": "song" if stype != "auto" else "auto",
        "title": f"Results for \"{q}\"",
        "subtitle": f"{len(items)} songs · movies · singers",
        "source": "saavn",
    }, q, language, limit)


def _mood_playlist_fast(detected_mood, language, limit=12):
    """Parallel mood playlist — optimized for Mood Sync latency."""
    detected_mood = (detected_mood or "NEUTRAL").upper()
    playback_mood = playback_mood_for_detected(detected_mood)
    lang_term = LANGUAGE_TERMS.get(language, language.lower())
    singer_queries = _singer_search_for_language(playback_mood, language)[:8]

    merged = []
    seen = set()

    def _tag(item):
        item = dict(item)
        item["mood"] = detected_mood
        item["playbackMood"] = playback_mood
        return item

    def _fetch_singer(template):
        q = _format_search_query(template, lang_term)
        artist_hint = _artist_from_query(q)
        tracks = _raw_search(q, language=language, limit=15)
        ranked = _rank_and_format(
            tracks,
            query=q,
            language=language,
            mood=playback_mood,
            artist=artist_hint,
            limit=1,
        )
        for item in ranked:
            if _is_mood_artist(item.get("artist", ""), language):
                return item
        return ranked[0] if ranked else None

    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = [pool.submit(_fetch_singer, template) for template in singer_queries]
        for future in as_completed(futures):
            if len(merged) >= limit:
                break
            try:
                item = future.result()
            except Exception:
                continue
            if not item or item["id"] in seen:
                continue
            seen.add(item["id"])
            merged.append(_tag(item))

    if len(merged) < max(4, limit // 2):
        curated = list(_curated_for_language(playback_mood, language))
        random.shuffle(curated)

        def _fetch_curated(pair):
            song_name, artist = pair
            tracks = _raw_search(f"{song_name} {artist}", language=language, limit=12)
            ranked = _rank_and_format(
                tracks,
                query=song_name,
                language=language,
                mood=playback_mood,
                artist=artist,
                limit=1,
            )
            return ranked[0] if ranked else None

        with ThreadPoolExecutor(max_workers=4) as pool:
            futures = [pool.submit(_fetch_curated, pair) for pair in curated[:6]]
            for future in as_completed(futures):
                if len(merged) >= limit:
                    break
                try:
                    item = future.result()
                except Exception:
                    continue
                if not item or item["id"] in seen:
                    continue
                seen.add(item["id"])
                merged.append(_tag(item))

    return _diversify_playlist(merged, limit, max_per_artist=1)


def mood_playlist_saavn(detected_mood, language, limit=20, fast=False):
    """
    Build a varied playlist for the user's DETECTED mood.
    Sad → happy songs | Angry → calm songs | Happy → happy songs.
    """
    limit = max(1, min(int(limit or 20), 30))
    if fast:
        return _mood_playlist_fast(detected_mood, language, limit=limit)

    detected_mood = (detected_mood or "NEUTRAL").upper()
    playback_mood = playback_mood_for_detected(detected_mood)
    lang_term = LANGUAGE_TERMS.get(language, language.lower())
    singer_queries = _singer_search_for_language(playback_mood, language)
    fallback_queries = MOOD_SEARCH_QUERIES.get(playback_mood, MOOD_SEARCH_QUERIES["NEUTRAL"])

    merged = []
    seen = set()

    def _tag(item):
        item = dict(item)
        item["mood"] = detected_mood
        item["playbackMood"] = playback_mood
        return item

    def _append_items(items):
        for item in items:
            if item["id"] in seen:
                continue
            seen.add(item["id"])
            merged.append(_tag(item))
            if len(merged) >= limit * 2:
                return True
        return False

    curated = list(_curated_for_language(playback_mood, language))
    random.shuffle(curated)

    for song_name, artist in curated:
        if len(merged) >= limit * 2:
            break
        tracks = _collect_search_tracks(song_name, language=language, artist=artist, limit=12)
        ranked = _rank_and_format(
            tracks,
            query=song_name,
            language=language,
            mood=playback_mood,
            artist=artist,
            limit=3,
        )
        for item in ranked:
            artist_name = item.get("artist", "")
            title_norm = _normalize_title(item.get("songName", ""))
            want_norm = _normalize_title(song_name)
            if want_norm not in title_norm and title_norm not in want_norm:
                continue
            if artist.lower() not in artist_name.lower() and not _is_mood_artist(artist_name, language):
                continue
            if _append_items([item]):
                break

    def _add_from_query(template: str, take: int, require_mood_artist: bool = False):
        if len(merged) >= limit * 2:
            return
        q = _format_search_query(template, lang_term)
        artist_hint = _artist_from_query(q)
        tracks = _raw_search(q, language=language, limit=25)
        ranked = _rank_and_format(
            tracks,
            query=q,
            language=language,
            mood=playback_mood,
            artist=artist_hint,
            limit=take + 6,
        )
        added = 0
        for item in ranked:
            if require_mood_artist and not _is_mood_artist(item.get("artist", ""), language):
                continue
            if item["id"] in seen:
                continue
            seen.add(item["id"])
            merged.append(_tag(item))
            added += 1
            if added >= take or len(merged) >= limit * 2:
                break

    # One fresh song per singer search — maximum variety
    for template in singer_queries:
        if len(merged) >= limit * 2:
            break
        _add_from_query(template, 1, require_mood_artist=True)

    if len(merged) < limit:
        for template in singer_queries:
            if len(merged) >= limit * 2:
                break
            _add_from_query(template, 1, require_mood_artist=False)

    if len(merged) < limit:
        for template in fallback_queries:
            if len(merged) >= limit * 2:
                break
            _add_from_query(template, 2, require_mood_artist=False)

    return _diversify_playlist(merged, limit, max_per_artist=1)


def resolve_track(song_name, artist=None, movie=None, language=None):
    for sup in _match_supplements(song_name or "", movie):
        if song_name and _normalize_title(song_name) not in _normalize_title(sup["songName"]):
            if _score_match(song_name, sup["songName"]) < 70:
                continue
        playback = _resolve_supplement_playback(sup)
        if playback:
            return playback

    if movie:
        songs, _ = get_movie_songs(movie, language=language, limit=20)
        for s in songs:
            if song_name and _normalize_title(song_name) in _normalize_title(s["songName"]):
                return resolve_playback(s["saavnId"]) or s

    tracks = _collect_search_tracks(song_name or "", language=language, artist=artist, movie=movie, limit=20)
    ranked = _rank_and_format(
        tracks,
        query=song_name or "",
        language=language or "English",
        artist=artist,
        movie=movie,
        limit=5,
    )
    if not ranked:
        return None
    top = ranked[0]
    return resolve_playback(top["saavnId"]) or top


def enrich_track_metadata(track):
    if track.get("saavnId"):
        track = dict(track)
        track["playUrl"] = f"/api/music/play/{track['saavnId']}"
        return track

    resolved = resolve_track(
        track.get("songName"),
        artist=track.get("artist"),
        movie=track.get("movie") or track.get("album"),
        language=track.get("language"),
    )
    if not resolved:
        return track

    merged = dict(track)
    merged.update({
        "saavnId": resolved.get("saavnId"),
        "playUrl": resolved.get("playUrl"),
        "imageUrl": resolved.get("imageUrl") or track.get("imageUrl"),
        "album": track.get("album") or resolved.get("album"),
        "movie": track.get("movie") or resolved.get("movie"),
        "source": "saavn",
    })
    return merged
