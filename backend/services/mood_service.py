from collections import Counter
from datetime import datetime, timedelta

from sqlalchemy import func

from models import Journal, MoodEnum, MoodHistory, db


def get_user_moods(user_id: str, limit: int = 500) -> list[MoodHistory]:
    return (
        MoodHistory.query.filter_by(user_id=user_id)
        .order_by(MoodHistory.date.desc())
        .limit(limit)
        .all()
    )


def create_mood(
    user_id: str,
    mood: str,
    confidence: float = 1.0,
    journal_text=None,
    image_path=None,
    source: str = "manual",
):
    entry = MoodHistory(
        user_id=user_id,
        mood=MoodEnum(mood),
        confidence=confidence,
        journal_text=journal_text,
        image_path=image_path,
        source=source,
        date=datetime.utcnow(),
    )
    db.session.add(entry)
    db.session.commit()
    return entry


def list_moods(user_id: str, page: int = 1, per_page: int = 20) -> dict:
    q = MoodHistory.query.filter_by(user_id=user_id).order_by(MoodHistory.date.desc())
    pagination = q.paginate(page=page, per_page=per_page, error_out=False)
    return {
        "items": [m.to_dict() for m in pagination.items],
        "total": pagination.total,
        "page": page,
        "pages": pagination.pages,
    }


def upsert_journal(user_id: str, journal_text: str, detected_mood: str, confidence: float, journal_date) -> Journal:
    entry = Journal.query.filter_by(user_id=user_id, date=journal_date).first()
    if entry:
        entry.journal_text = journal_text
        entry.detected_mood = MoodEnum(detected_mood)
        entry.confidence = confidence
    else:
        entry = Journal(
            user_id=user_id,
            journal_text=journal_text,
            detected_mood=MoodEnum(detected_mood),
            date=journal_date,
            confidence=confidence,
        )
        db.session.add(entry)

    db.session.commit()

    create_mood(
        user_id=user_id,
        mood=detected_mood,
        confidence=confidence,
        journal_text=journal_text,
        source="journal",
    )
    return entry


def list_journals(user_id: str, page: int = 1, per_page: int = 20) -> dict:
    q = Journal.query.filter_by(user_id=user_id).order_by(Journal.date.desc())
    pagination = q.paginate(page=page, per_page=per_page, error_out=False)
    return {
        "items": [j.to_dict() for j in pagination.items],
        "total": pagination.total,
        "page": page,
        "pages": pagination.pages,
    }
