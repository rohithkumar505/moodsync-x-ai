import json
import re

from models import MoodEnum

MOOD_KEYWORDS = {
    MoodEnum.HAPPY: ["happy", "joy", "excited", "great", "wonderful", "amazing", "love", "glad", "cheerful"],
    MoodEnum.SAD: ["sad", "depressed", "lonely", "cry", "unhappy", "miserable", "grief", "down", "hurt"],
    MoodEnum.ANGRY: ["angry", "furious", "mad", "rage", "annoyed", "frustrated", "hate", "irritated"],
    MoodEnum.RELAXED: ["relaxed", "calm", "peaceful", "chill", "serene", "tranquil", "easy", "rested"],
    MoodEnum.NEUTRAL: ["okay", "fine", "normal", "neutral", "alright", "meh", "average"],
}


def detect_mood_from_text(text: str, fallback: str = "NEUTRAL"):
    if not text or not text.strip():
        return fallback, 1.0

    lowered = text.lower()
    scores = {mood: 0 for mood in MoodEnum}
    for mood, keywords in MOOD_KEYWORDS.items():
        for kw in keywords:
            if kw in lowered:
                scores[mood] += 1

    best = max(scores, key=scores.get)
    total = sum(scores.values())
    if total == 0:
        return fallback, 0.6

    confidence = min(0.95, 0.5 + (scores[best] / max(total, 1)) * 0.45)
    return best.value, round(confidence, 2)


def detect_mood_with_openai(text: str, api_key: str, fallback: str = "NEUTRAL"):
    if not api_key:
        return detect_mood_from_text(text, fallback)

    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Classify mood as one of: HAPPY, SAD, ANGRY, RELAXED, NEUTRAL. "
                        'Return JSON only: {"mood": "...", "confidence": 0.0-1.0}'
                    ),
                },
                {"role": "user", "content": text},
            ],
            max_tokens=50,
        )
        content = response.choices[0].message.content or ""
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if match:
            data = json.loads(match.group())
            mood = data.get("mood", fallback).upper()
            if mood in [m.value for m in MoodEnum]:
                return mood, float(data.get("confidence", 0.8))
    except Exception:
        pass

    return detect_mood_from_text(text, fallback)


def detect_mood_from_image(image_path: str, api_key: str):
    if not api_key:
        return None, 0.0

    try:
        import base64

        from openai import OpenAI

        with open(image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()

        ext = image_path.rsplit(".", 1)[-1].lower()
        mime = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"

        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                            "Classify the person's facial emotion/mood from this face photo as one of: "
                                "HAPPY, SAD, ANGRY, RELAXED, NEUTRAL. "
                                "Look at facial expression: smile=HAPPY, tears/downcast=SAD, "
                                "frown/tension=ANGRY, calm/peaceful=RELAXED, flat=NEUTRAL. "
                                'Return JSON: {"mood": "...", "confidence": 0.0-1.0}'
                            ),
                        },
                        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
                    ],
                }
            ],
            max_tokens=50,
        )
        content = response.choices[0].message.content or ""
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if match:
            data = json.loads(match.group())
            mood = data.get("mood", "").upper()
            if mood in [m.value for m in MoodEnum]:
                return mood, float(data.get("confidence", 0.75))
    except Exception:
        pass

    return None, 0.0
