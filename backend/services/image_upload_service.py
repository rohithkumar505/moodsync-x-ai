import os
import uuid

from flask import current_app
from werkzeug.utils import secure_filename

from engines.mood_detector import detect_mood_from_image


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in current_app.config["ALLOWED_EXTENSIONS"]


def save_mood_image(file, user_id: str) -> dict:
    if not file or not file.filename:
        raise ValueError("No file provided")

    if not allowed_file(file.filename):
        raise ValueError("Invalid file type. Allowed: jpg, jpeg, png, webp")

    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    max_bytes = current_app.config["UPLOAD_MAX_SIZE_MB"] * 1024 * 1024
    if size > max_bytes:
        raise ValueError(f"File too large. Max {current_app.config['UPLOAD_MAX_SIZE_MB']}MB")

    ext = secure_filename(file.filename).rsplit(".", 1)[1].lower()
    folder = os.path.join(current_app.config["UPLOAD_FOLDER"], user_id)
    os.makedirs(folder, exist_ok=True)

    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(folder, filename)
    file.save(filepath)

    relative_path = f"/uploads/moods/{user_id}/{filename}"
    detected_mood, confidence = detect_mood_from_image(
        filepath, current_app.config.get("OPENAI_API_KEY", "")
    )

    return {
        "imagePath": relative_path,
        "detectedMood": detected_mood,
        "confidence": confidence,
    }
