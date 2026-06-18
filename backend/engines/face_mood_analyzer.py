"""Facial emotion analysis from camera capture."""

from engines.mood_detector import detect_mood_from_image


def analyze_face_mood(image_path: str, api_key: str) -> dict:
    """
    Analyze facial expression from a captured webcam/selfie image.
    Returns mood, confidence, and analysis source.
    """
    detected_mood, confidence = detect_mood_from_image(image_path, api_key)

    if detected_mood:
        return {
            "mood": detected_mood,
            "confidence": confidence,
            "source": "vision_ai",
            "message": f"Face analyzed — you seem {detected_mood.lower()}",
        }

    return {
        "mood": None,
        "confidence": 0.0,
        "source": "none",
        "message": "Could not detect mood from face. Set OPENAI_API_KEY or use browser face scan.",
    }
