import json
import random
import re
from typing import List, Optional, Tuple

from models import User
from engines.mood_detector import detect_mood_from_text
from music.music_library import get_mood_playlist, search_songs
from music.jiosaavn_service import TOP_SINGERS, therapeutic_message

MOOD_WORD_MAP = {
    "happy": "HAPPY",
    "joy": "HAPPY",
    "excited": "HAPPY",
    "glad": "HAPPY",
    "cheerful": "HAPPY",
    "sad": "SAD",
    "down": "SAD",
    "upset": "SAD",
    "lonely": "SAD",
    "depressed": "SAD",
    "heartbroken": "SAD",
    "angry": "ANGRY",
    "mad": "ANGRY",
    "furious": "ANGRY",
    "stressed": "ANGRY",
    "relaxed": "RELAXED",
    "calm": "RELAXED",
    "peaceful": "RELAXED",
    "chill": "RELAXED",
    "neutral": "NEUTRAL",
    "okay": "NEUTRAL",
    "fine": "NEUTRAL",
    "bored": "NEUTRAL",
}

FRIENDLY_MOOD_REPLIES = {
    "HAPPY": (
        "I love that energy! When you're happy, upbeat and feel-good songs hit different. "
        "Here are some tracks I think you'll enjoy — I've started playing the first one for you."
    ),
    "SAD": (
        "I'm really sorry you're feeling low. It's okay to not be okay. "
        "I picked some gentle, uplifting songs to comfort you — music can be a warm hug sometimes."
    ),
    "ANGRY": (
        "Sounds like a lot is building up. Take a slow breath with me. "
        "I chose calm, peaceful tracks to help you unwind — let the music ease the tension."
    ),
    "RELAXED": (
        "That calm vibe is beautiful. Soft, mellow music will match your peaceful mood perfectly. "
        "Here's what I recommend — press play and just breathe."
    ),
    "NEUTRAL": (
        "Steady mood — sometimes that's exactly what we need. "
        "I picked a mix of popular hits that should feel just right for you."
    ),
}

MOOD_SWING_REPLY = (
    "Mood swings can feel like a rollercoaster — I hear you. "
    "I built a mixed playlist with happy, calm, and feel-good tracks so you can ride the wave. "
    "Try these and tell me which vibe fits you right now."
)

PLAY_PREFIX = re.compile(
    r"^(?:please\s+)?(?:can you\s+)?(?:could you\s+)?(?:play|start|put on|queue)\s+",
    re.I,
)
MOVIE_PATTERN = re.compile(
    r"(?:songs?\s+from|from|movie|film)\s+(.+?)(?:\s+songs?|\s+movie|\s+film)?$",
    re.I,
)
SINGER_PATTERN = re.compile(
    r"(?:songs?\s+by|by|singer)\s+(.+)$",
    re.I,
)

GREETING_PATTERN = re.compile(
    r"^(hi|hello|hey|hiya|good\s+(morning|afternoon|evening)|namaste|sup)\b",
    re.I,
)
THANKS_PATTERN = re.compile(r"\b(thank you|thanks|thx|ty|appreciate)\b", re.I)
SUGGEST_PATTERN = re.compile(
    r"\b(suggest|recommend|recommendation|pick|choose|what should i (?:listen|play)|help me find|any songs? for)\b",
    re.I,
)
MOOD_SWING_PATTERN = re.compile(
    r"\b(mood swing|mood swings|mixed mood|up and down|emotional|confused mood|don't know how i feel)\b",
    re.I,
)
MOOD_EMOJI = {
    "HAPPY": "😊",
    "SAD": "😔",
    "ANGRY": "😡",
    "RELAXED": "😌",
    "NEUTRAL": "😐",
}
HELP_PATTERN = re.compile(
    r"\b(what can you do|how do you work|what do you do)\b|"
    r"\bhelp me\b(?!\s+(?:find|with|pick|choose|get|suggest))",
    re.I,
)
HOW_ARE_YOU_PATTERN = re.compile(r"\b(how are you|how r u|how's it going)\b", re.I)


def _user_context(user_id: str) -> Tuple[str, str]:
    user = User.query.get(user_id)
    lang = (user.preferred_language if user else None) or "Hindi"
    name = (user.name.split()[0] if user and user.name else "friend")
    return lang, name


def _normalize_songs(items: list) -> list:
    out = []
    for track in items or []:
        if not track:
            continue
        out.append({
            "id": track.get("id") or f"saavn-{track.get('saavnId', '')}",
            "songName": track.get("songName") or track.get("title") or "Unknown",
            "artist": track.get("artist") or "Unknown",
            "mood": track.get("mood") or "NEUTRAL",
            "language": track.get("language") or "Hindi",
            "album": track.get("album"),
            "movie": track.get("movie"),
            "audioUrl": track.get("audioUrl"),
            "previewUrl": track.get("previewUrl"),
            "playUrl": track.get("playUrl"),
            "saavnId": track.get("saavnId"),
            "imageUrl": track.get("imageUrl"),
            "source": track.get("source") or "saavn",
        })
    return out


def _song_list_text(songs: list, limit: int = 3) -> str:
    if not songs:
        return ""
    lines = [f"• {s['songName']} — {s['artist']}" for s in songs[:limit]]
    extra = len(songs) - limit
    if extra > 0:
        lines.append(f"• …and {extra} more in your queue")
    return "\n".join(lines)


def _extract_mood_phrase(message: str) -> Optional[str]:
    lower = message.lower()
    patterns = [
        r"i(?:'m| am)\s+(?:feeling\s+)?(\w+)",
        r"i feel\s+(?:so\s+)?(\w+)",
        r"feeling\s+(?:so\s+)?(\w+)",
        r"i(?:'m| am)\s+so\s+(\w+)",
    ]
    for pat in patterns:
        m = re.search(pat, lower)
        if m:
            word = m.group(1)
            if word in MOOD_WORD_MAP:
                return MOOD_WORD_MAP[word]
    return None


def _find_singer_in_text(message: str) -> Optional[str]:
    lower = message.lower()
    for singer in sorted(TOP_SINGERS, key=len, reverse=True):
        if singer.lower() in lower:
            return singer
    m = SINGER_PATTERN.search(message)
    if m:
        return m.group(1).strip()
    return None


def _get_mood_swing_playlist(lang: str, limit: int = 5) -> list:
    mixed = []
    for mood in ("HAPPY", "RELAXED", "SAD", "NEUTRAL"):
        batch = get_mood_playlist(mood, lang, limit=2, fast=True, prefill=False)
        if batch:
            mixed.append(batch[0])
    return mixed[:limit]


def _parse_intent(message: str) -> Tuple[str, Optional[str], Optional[str], str]:
    text = message.strip()
    lower = text.lower()
    mood, _ = detect_mood_from_text(text)
    phrase_mood = _extract_mood_phrase(text)
    if phrase_mood:
        mood = phrase_mood

    if HOW_ARE_YOU_PATTERN.search(lower):
        return "how_are_you", mood, None, "auto"

    if HELP_PATTERN.search(lower):
        return "help", mood, None, "auto"

    if GREETING_PATTERN.search(lower) and len(text.split()) <= 6:
        return "greeting", mood, None, "auto"

    if THANKS_PATTERN.search(lower) and len(text.split()) <= 8:
        return "thanks", mood, None, "auto"

    if MOOD_SWING_PATTERN.search(lower):
        return "mood_swing", "NEUTRAL", None, "auto"

    wants_suggest = bool(SUGGEST_PATTERN.search(lower))
    has_mood = phrase_mood or mood != "NEUTRAL"

    if has_mood and (wants_suggest or re.search(r"\b(song|music|track|playlist)\b", lower)):
        return "mood_suggest", mood, None, "auto"

    if phrase_mood or (
        mood != "NEUTRAL"
        and not re.search(r"\b(play|singer|movie|album)\b", lower)
        and len(text.split()) <= 12
    ):
        return "mood", mood, None, "auto"

    singer = _find_singer_in_text(text)
    if singer or re.search(r"\b(singer|songs by)\b", lower):
        name = singer or (SINGER_PATTERN.search(text).group(1).strip() if SINGER_PATTERN.search(text) else "")
        return "singer", mood, name, "singer"

    if re.search(r"\b(movie|film|soundtrack|ost)\b", lower) or re.search(r"songs?\s+from\b", lower):
        m = MOVIE_PATTERN.search(text)
        movie = m.group(1).strip() if m else re.sub(r"\b(play|songs?|movie|film)\b", "", text, flags=re.I).strip()
        return "movie", mood, movie, "movie"

    if PLAY_PREFIX.search(text) or lower.startswith("play "):
        query = PLAY_PREFIX.sub("", text).strip()
        query = re.sub(r"\s+(for me|now|please)$", "", query, flags=re.I).strip()
        if query:
            return "search", mood, query, "auto"

    if wants_suggest:
        return "mood_suggest" if has_mood else "suggest", mood, None, "auto"

    if mood != "NEUTRAL" and re.search(r"\b(music|song|something)\b", lower):
        return "mood", mood, None, "auto"

    if len(text) > 2 and not re.search(r"^(what|who|where|when|why|how)\b", lower):
        return "search", mood, text, "auto"

    return "chat", mood, None, "auto"


def _friendly_greeting(name: str) -> str:
    return (
        f"Hey {name}! I'm MoodBuddy, your music wellness friend.\n\n"
        "Talk to me about anything — how you're feeling, mood swings, or what music you need. "
        "Try:\n"
        "• \"I'm sad, please suggest me some songs\"\n"
        "• \"I'm happy today!\"\n"
        "• \"Mood swing — help me\"\n"
        "• \"Play Arijit Singh\" or \"songs from RRR\""
    )


def _friendly_thanks(name: str) -> str:
    return random.choice([
        f"Anytime, {name}! Hope the music helps. I'm here whenever you need me.",
        f"You're welcome, {name}! Tell me if you want a different vibe.",
        "Happy to help! Your mood matters — come back anytime you need a song friend.",
    ])


def _friendly_how_are_you(name: str) -> str:
    return (
        f"I'm doing great, {name} — thanks for asking! I'm here and ready to help. "
        "How are you feeling today? Happy, sad, stressed, or somewhere in between?"
    )


def _friendly_help(name: str) -> str:
    return (
        f"Here's what I can do for you, {name}:\n"
        "• Chat about your feelings and mood swings\n"
        "• Suggest & play songs for happy, sad, calm, or angry moods\n"
        "• Find music by singer (Arijit Singh, Sid Sriram…)\n"
        "• Play movie soundtracks (RRR, KGF…)\n"
        "• Search any song by name\n\n"
        "Just talk naturally — I'll take care of the music!"
    )


def _build_response(
    reply: str,
    songs: list,
    intent: str,
    mood: Optional[str],
    play_now: bool = True,
) -> dict:
    suggestions = [f"{s['songName']} — {s['artist']}" for s in songs[:5]]
    return {
        "reply": reply.strip(),
        "songs": songs,
        "suggestions": suggestions,
        "intent": intent,
        "detectedMood": mood if mood and mood != "NEUTRAL" else None,
        "moodEmoji": MOOD_EMOJI.get(mood or "", None),
        "playNow": play_now and bool(songs),
    }


def _reply_for_search(result: dict, query: str, name: str) -> str:
    stype = result.get("searchType") or "song"
    title = result.get("title") or query
    count = len(result.get("items") or [])
    if count == 0:
        return (
            f"Hmm {name}, I couldn't find a match for \"{query}\". "
            "Try a singer name, movie title, or tell me how you're feeling!"
        )
    if stype == "movie":
        return f"Ooh great pick, {name}! Here are songs from {title} — starting playback now."
    if stype in ("singer", "hero"):
        return f"Love {title}! I queued their best tracks for you, {name}."
    return f"Found some gems for \"{query}\", {name}! Playing now."


def _openai_chat_reply(
    api_key: str,
    message: str,
    history: List[dict],
    name: str,
    lang: str,
    mood: Optional[str],
    songs: list,
) -> Optional[str]:
    if not api_key:
        return None
    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        song_hint = ""
        if songs:
            song_hint = " Songs to mention: " + ", ".join(f"{s['songName']} by {s['artist']}" for s in songs[:3])

        system = (
            f"You are MoodBuddy, a warm friendly music wellness assistant in MoodSync X AI. "
            f"The user's name is {name}. Preferred song language: {lang}. "
            "Be empathetic, conversational, and concise (2-4 short sentences). "
            "If they share feelings, validate them kindly. "
            "If music was found, mention you're playing it enthusiastically. "
            "Never be robotic. Use light warmth, no markdown."
            + (f" Detected mood: {mood}." if mood else "")
            + song_hint
        )

        msgs = [{"role": "system", "content": system}]
        for h in history[-8:]:
            role = h.get("role", "user")
            if role in ("user", "assistant"):
                content = (h.get("content") or h.get("text") or "").strip()
                if content:
                    msgs.append({"role": role, "content": content})
        msgs.append({"role": "user", "content": message})

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=msgs,
            max_tokens=180,
            temperature=0.85,
        )
        return (response.choices[0].message.content or "").strip()
    except Exception:
        return None


def handle_assistant_message(
    user_id: str,
    message: str,
    history: Optional[List[dict]] = None,
    api_key: str = "",
) -> dict:
    text = (message or "").strip()
    history = history or []

    if not text:
        _, name = _user_context(user_id)
        return _build_response(
            f"Hey {name}, I'm listening. How are you feeling today?",
            [],
            "chat",
            None,
            play_now=False,
        )

    lang, name = _user_context(user_id)
    intent, mood, query, search_type = _parse_intent(text)
    songs: list = []
    reply = ""

    if intent == "greeting":
        reply = _friendly_greeting(name)

    elif intent == "how_are_you":
        reply = _friendly_how_are_you(name)

    elif intent == "help":
        reply = _friendly_help(name)

    elif intent == "thanks":
        reply = _friendly_thanks(name)

    elif intent in ("mood", "mood_suggest"):
        songs = _normalize_songs(get_mood_playlist(mood, lang, limit=6, fast=True, prefill=True))
        reply = FRIENDLY_MOOD_REPLIES.get(mood) or therapeutic_message(mood)

    elif intent == "mood_swing":
        songs = _normalize_songs(_get_mood_swing_playlist(lang, limit=6))
        reply = MOOD_SWING_REPLY
        mood = "NEUTRAL"

    elif intent == "suggest" and mood == "NEUTRAL":
        songs = _normalize_songs(get_mood_playlist("NEUTRAL", lang, limit=6, fast=True, prefill=True))
        reply = (
            f"Sure {name}! When you're not sure what you need, popular feel-good tracks are a safe bet. "
            "I've queued some suggestions — tap any song to play."
        )

    elif intent in ("search", "singer", "movie"):
        result = search_songs(query or text, lang, mood if mood != "NEUTRAL" else None, page=1, per_page=8, search_type=search_type)
        songs = _normalize_songs((result.get("items") or [])[:6])
        reply = _reply_for_search(result, query or text, name)

    else:
        ai_reply = _openai_chat_reply(api_key, text, history, name, lang, mood, songs)
        if ai_reply:
            reply = ai_reply
        else:
            reply = (
                f"I'm here for you, {name}. Tell me how you're feeling — "
                "happy, sad, angry, relaxed — or ask me to suggest songs, singers, or movie tracks."
            )
            if mood != "NEUTRAL":
                songs = _normalize_songs(get_mood_playlist(mood, lang, limit=5, fast=True, prefill=True))
                reply = FRIENDLY_MOOD_REPLIES.get(mood, reply)
                intent = "mood"

    if songs and intent not in ("greeting", "help", "how_are_you", "thanks", "chat"):
        ai_polish = _openai_chat_reply(api_key, text, history, name, lang, mood, songs)
        if ai_polish and len(ai_polish) > 20:
            reply = ai_polish

    return _build_response(reply, songs, intent, mood)
