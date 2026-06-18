import enum
import uuid
from datetime import datetime, date

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class MoodEnum(str, enum.Enum):
    HAPPY = "HAPPY"
    SAD = "SAD"
    ANGRY = "ANGRY"
    RELAXED = "RELAXED"
    NEUTRAL = "NEUTRAL"


MOODS = [m.value for m in MoodEnum]


def mood_column(**kwargs):
    return db.Column(
        db.Enum(
            MoodEnum,
            values_callable=lambda enum: [item.value for item in enum],
            native_enum=False,
            length=20,
        ),
        **kwargs,
    )


SUPPORTED_LANGUAGES = ["English", "Hindi", "Tamil", "Telugu", "Punjabi", "Kannada"]


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password = db.Column(db.String(255), nullable=False)
    password_plain = db.Column(db.String(255), nullable=True)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    preferred_language = db.Column(db.String(50), default="English")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login_at = db.Column(db.DateTime, nullable=True)

    mood_history = db.relationship("MoodHistory", backref="user", lazy=True)
    journals = db.relationship("Journal", backref="user", lazy=True)
    playlists = db.relationship("Playlist", backref="user", lazy=True)
    achievements = db.relationship("Achievement", backref="user", lazy=True)
    activities = db.relationship("UserActivity", backref="user", lazy=True)

    def to_dict(self, admin_view=False):
        data = {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "preferredLanguage": self.preferred_language or "English",
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "isAdmin": bool(self.is_admin),
            "lastLoginAt": self.last_login_at.isoformat() if self.last_login_at else None,
        }
        if admin_view:
            data["passwordPlain"] = self.password_plain or "—"
        return data


class MoodHistory(db.Model):
    __tablename__ = "mood_history"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    mood = mood_column(nullable=False)
    confidence = db.Column(db.Float, default=1.0)
    date = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    image_path = db.Column(db.String(500), nullable=True)
    source = db.Column(db.String(20), default="manual")
    journal_text = db.Column(db.Text, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "mood": self.mood.value,
            "confidence": self.confidence,
            "date": self.date.isoformat() if self.date else None,
            "imagePath": self.image_path,
            "source": self.source,
            "journalText": self.journal_text,
        }


class Song(db.Model):
    __tablename__ = "songs"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    song_name = db.Column(db.String(255), nullable=False)
    artist = db.Column(db.String(255), nullable=False)
    mood = mood_column(nullable=False, index=True)
    language = db.Column(db.String(50), nullable=False, default="English", index=True)
    audio_file = db.Column(db.String(255), nullable=True)
    album = db.Column(db.String(255), nullable=True)
    movie = db.Column(db.String(255), nullable=True)
    preview_url = db.Column(db.String(500), nullable=True)
    image_url = db.Column(db.String(500), nullable=True)
    external_id = db.Column(db.String(50), nullable=True, index=True)
    source = db.Column(db.String(20), default="local")
    youtube_id = db.Column(db.String(20), nullable=True)

    def to_dict(self):
        saavn_id = self.external_id
        play_url = f"/api/music/play/{saavn_id}" if saavn_id else None
        return {
            "id": self.id,
            "songName": self.song_name,
            "artist": self.artist,
            "mood": self.mood.value,
            "language": self.language,
            "album": self.album,
            "movie": self.movie,
            "audioUrl": self.preview_url,
            "previewUrl": self.preview_url,
            "imageUrl": self.image_url,
            "source": self.source or "local",
            "saavnId": saavn_id,
            "playUrl": play_url,
            "externalId": saavn_id,
        }


class Playlist(db.Model):
    __tablename__ = "playlists"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    playlist_name = db.Column(db.String(255), nullable=False)
    creation_date = db.Column(db.DateTime, default=datetime.utcnow)

    songs = db.relationship("PlaylistSong", backref="playlist", lazy=True, cascade="all, delete-orphan")

    def to_dict(self, include_songs=False):
        data = {
            "id": self.id,
            "userId": self.user_id,
            "playlistName": self.playlist_name,
            "creationDate": self.creation_date.isoformat() if self.creation_date else None,
            "songCount": len(self.songs),
        }
        if include_songs:
            data["songs"] = [
                ps.song.to_dict()
                for ps in sorted(self.songs, key=lambda x: x.position)
                if ps.song is not None
            ]
        return data


class PlaylistSong(db.Model):
    __tablename__ = "playlist_songs"

    playlist_id = db.Column(db.String(36), db.ForeignKey("playlists.id"), primary_key=True)
    song_id = db.Column(db.String(36), db.ForeignKey("songs.id"), primary_key=True)
    position = db.Column(db.Integer, default=0)
    song = db.relationship("Song")

    def to_dict(self):
        return {"playlistId": self.playlist_id, "songId": self.song_id, "position": self.position}


class Journal(db.Model):
    __tablename__ = "journals"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    journal_text = db.Column(db.Text, nullable=False)
    detected_mood = mood_column(nullable=False)
    date = db.Column(db.Date, nullable=False, index=True)
    confidence = db.Column(db.Float, default=1.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint("user_id", "date", name="uq_user_journal_date"),)

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "journalText": self.journal_text,
            "detectedMood": self.detected_mood.value,
            "date": self.date.isoformat(),
            "confidence": self.confidence,
        }


class Achievement(db.Model):
    __tablename__ = "achievements"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    achievement_name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.String(500), nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "achievementName": self.achievement_name,
            "description": self.description,
            "date": self.date.isoformat() if self.date else None,
        }


class UserActivity(db.Model):
    __tablename__ = "user_activities"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    action = db.Column(db.String(80), nullable=False, index=True)
    detail = db.Column(db.String(500), nullable=True)
    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(300), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        user = self.user
        return {
            "id": self.id,
            "userId": self.user_id,
            "userName": user.name if user else None,
            "userEmail": user.email if user else None,
            "action": self.action,
            "detail": self.detail,
            "ipAddress": self.ip_address,
            "userAgent": self.user_agent,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
