from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from models import MoodHistory


def predict_next_mood(entries: List[MoodHistory], dna=None) -> dict:
    if len(entries) < 3:
        return {
            "recentPattern": [e.mood.value for e in entries],
            "predictedMood": None,
            "confidence": 0.0,
            "insight": "Log more moods to unlock predictions (need at least 3).",
        }

    recent = entries[-10:]
    pattern = [e.mood.value for e in recent]
    transitions: Dict[str, Counter] = defaultdict(Counter)

    for i in range(len(recent) - 1):
        transitions[recent[i].mood.value][recent[i + 1].mood.value] += 1

    last_mood = recent[-1].mood.value
    next_counts = transitions.get(last_mood, Counter())

    if next_counts:
        predicted, count = next_counts.most_common(1)[0]
        total = sum(next_counts.values())
        confidence = round(count / total, 2)
    elif dna and dna.get("dominantMood"):
        predicted = dna["dominantMood"]
        confidence = round(dna.get("percentages", {}).get(predicted, 25) / 100, 2)
    else:
        predicted = last_mood
        confidence = 0.5

    insight = f"Based on your pattern, you're likely feeling {predicted.lower()} next."
    if predicted in ("HAPPY", "RELAXED"):
        insight = f"You're on a positive streak — likely {predicted.title()} next."

    return {
        "recentPattern": pattern,
        "predictedMood": predicted,
        "confidence": confidence,
        "insight": insight,
    }


def compute_streak(entries: List[MoodHistory]) -> int:
    if not entries:
        return 0

    dates_with_entries = set()
    for e in entries:
        if e.date:
            dates_with_entries.add(e.date.date())

    streak = 0
    day = datetime.utcnow().date()
    while day in dates_with_entries:
        streak += 1
        day -= timedelta(days=1)

    return streak


def mood_insight(
    dominant: str,
    secondary: Optional[str],
    dominant_pct: float = 0,
    stability: Optional[str] = None,
) -> str:
    labels = {
        "HAPPY": "upbeat and joyful",
        "SAD": "reflective and thoughtful",
        "ANGRY": "intense and driven",
        "RELAXED": "calm and peaceful",
        "NEUTRAL": "balanced and steady",
    }
    d = labels.get(dominant, "unique")
    stability_note = {
        "focused": f"Your moods cluster strongly around {dominant.title().lower()} ({dominant_pct:.0f}% of check-ins).",
        "steady": f"You lean toward {dominant.title().lower()} most often, with room for other moods.",
        "varied": "Your moods shift across the spectrum — a rich, varied emotional range.",
    }.get(stability or "", "")

    if secondary and secondary != dominant:
        s = labels.get(secondary, "").split(" and ")[0]
        base = f"You're often {d}, with {s} undertones."
    else:
        base = f"Your emotional profile is predominantly {d}."

    if stability_note:
        return f"{base} {stability_note}"
    return base
