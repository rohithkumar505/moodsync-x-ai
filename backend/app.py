from functools import wraps

import os
import re
import threading
from datetime import datetime

import bcrypt
from flask import Flask, jsonify, request, send_from_directory
from sqlalchemy.exc import OperationalError, ProgrammingError, SQLAlchemyError
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    get_jwt_identity,
    jwt_required,
)
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from config import Config
from database import database_label, engine_options
from db_bootstrap import (
    ensure_schema,
    is_undefined_table_error,
    ping_database,
    repair_schema_if_needed,
    schema_is_ready,
)
from engines.face_mood_analyzer import analyze_face_mood
from engines.emotion_engine import compute_streak, predict_next_mood
from engines.mood_detector import detect_mood_from_text, detect_mood_with_openai
from models import (
    Achievement,
    Journal,
    MoodEnum,
    MoodHistory,
    Playlist,
    PlaylistSong,
    Song,
    SUPPORTED_LANGUAGES,
    User,
    UserActivity,
    db,
)
from music.music_library import get_languages, get_suggestions, search_songs
from music.jiosaavn_service import (
    playback_mood_for_detected,
    resolve_playback,
    resolve_track,
    therapeutic_message,
)
from music.song_recommender import get_mood_playlist_for_user, get_playable_song_for_mood, get_recommendations
from services.audio_service import resolve_audio_path
from services.achievement_service import evaluate_achievements, get_achievements_bundle
from services.chart_data_service import get_analytics, get_distribution, get_frequency, get_summary, get_trend_line
from services.dashboard_service import build_full_report, get_dashboard, get_dashboard_recommendations
from services.emotion_dna_service import compute_emotion_dna
from services.image_upload_service import save_mood_image
from services.mood_service import create_mood, get_user_moods, list_journals, list_moods, upsert_journal
from services.playlist_service import resolve_song_for_playlist
from services.activity_service import log_activity
from services.admin_service import (
    get_admin_dashboard,
    get_all_activity,
    get_all_users,
    get_user_full_detail,
)
from services.music_assistant_service import handle_assistant_message
from services.profile_service import get_profile_bundle


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_object(Config)
    if test_config:
        app.config.update(test_config)
        uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
        app.config["SQLALCHEMY_ENGINE_OPTIONS"] = engine_options(uri)
        app.config["DATABASE_BACKEND"] = database_label(uri)

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    os.makedirs(app.config["MUSIC_FOLDER"], exist_ok=True)

    db.init_app(app)
    JWTManager(app)
    def _cors_origins():
        extra = os.getenv("CORS_ORIGINS", "")
        origins = [o.strip() for o in extra.split(",") if o.strip()]
        origins.extend(
            [
                "http://localhost:5173",
                "https://localhost:5173",
                "http://127.0.0.1:5173",
                "https://127.0.0.1:5173",
                r"http://192\.168\.\d{1,3}\.\d{1,3}:5173",
                r"https://192\.168\.\d{1,3}\.\d{1,3}:5173",
                r"http://10\.\d{1,3}\.\d{1,3}\.\d{1,3}:5173",
                r"https://.*\.vercel\.app",
            ]
        )
        return origins

    CORS(app, origins=_cors_origins(), supports_credentials=True)

    limiter = Limiter(get_remote_address, app=app, default_limits=["2000 per hour"])

    @app.teardown_appcontext
    def shutdown_session(exception=None):
        if exception is not None:
            db.session.rollback()
        db.session.remove()

    with app.app_context():
        if not app.config.get("TESTING"):
            try:
                ensure_schema(app)
            except Exception as exc:
                app.logger.error("Database bootstrap failed on startup: %s", exc)
            try:
                from music.jiosaavn_service import warm_music_cache
                threading.Thread(target=warm_music_cache, daemon=True, name="music-warm").start()
            except Exception as exc:
                app.logger.warning("Music cache warm-up skipped: %s", exc)

    @app.before_request
    def ensure_schema_before_api():
        if not request.path.startswith("/api/"):
            return
        if request.path == "/api/health":
            return
        if schema_is_ready():
            return
        repair_schema_if_needed(app)

    @app.errorhandler(OperationalError)
    def handle_db_error(err):
        if request.path.startswith("/api/"):
            app.logger.exception("Database error on %s", request.path)
            return jsonify({
                "error": (
                    "Database connection failed. Ensure PostgreSQL is running "
                    "(docker compose up -d db) and DATABASE_URL is set in backend/.env"
                ),
            }), 503
        raise err

    @app.errorhandler(ProgrammingError)
    def handle_schema_error(err):
        db.session.rollback()
        if request.path.startswith("/api/") and is_undefined_table_error(err):
            app.logger.warning("Missing database tables detected; attempting repair")
            if repair_schema_if_needed(app):
                return jsonify({"error": "Database was updated. Please try again."}), 503
            return jsonify({
                "error": (
                    "Database tables are missing. Run: docker compose up -d db "
                    "then restart the backend."
                ),
            }), 503
        if request.path.startswith("/api/"):
            app.logger.exception("Database error on %s", request.path)
            return jsonify({"error": "Something went wrong with the database. Please try again."}), 500
        raise err

    @app.errorhandler(SQLAlchemyError)
    def handle_sqlalchemy_error(err):
        if request.path.startswith("/api/"):
            app.logger.exception("Database error on %s", request.path)
            return jsonify({"error": "Something went wrong with the database. Please try again."}), 500
        raise err

    @app.errorhandler(500)
    def handle_server_error(err):
        if request.path.startswith("/api/"):
            return jsonify({"error": "Internal server error. Please try again."}), 500
        raise err

    def validate_password(password: str):
        if len(password) < 8:
            return "Password must be at least 8 characters"
        if not re.search(r"[A-Z]", password):
            return "Password must contain an uppercase letter"
        if not re.search(r"[0-9]", password):
            return "Password must contain a number"
        return None

    def admin_required(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            user = User.query.get(get_jwt_identity())
            if not user or not user.is_admin:
                return jsonify({"error": "Admin access required"}), 403
            return fn(*args, **kwargs)

        return wrapper

    @app.get("/api/health")
    @limiter.exempt
    def health():
        connected = ping_database()
        ready = schema_is_ready() if connected else False
        backend = app.config.get("DATABASE_BACKEND", "unknown")
        if not connected:
            db_status = "disconnected"
        elif not ready:
            db_status = "schema_missing"
        else:
            db_status = "ok"
        return jsonify({
            "status": "ok" if db_status == "ok" else "degraded",
            "service": "MoodSync X AI",
            "database": backend,
            "dbStatus": db_status,
            "schemaReady": ready,
        })

    @app.post("/api/auth/register")
    @limiter.limit("10 per minute")
    def register():
        data = request.get_json() or {}
        name = (data.get("name") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        if not name or not email or not password:
            return jsonify({"error": "Name, email, and password are required"}), 400

        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            return jsonify({"error": "Enter a valid email address"}), 400

        pwd_err = validate_password(password)
        if pwd_err:
            return jsonify({"error": pwd_err}), 400

        if User.query.filter_by(email=email).first():
            return jsonify({"error": "Email already registered"}), 409

        hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        lang = (data.get("preferredLanguage") or "English").strip()
        if lang not in SUPPORTED_LANGUAGES:
            lang = "English"
        try:
            user = User(name=name, email=email, password=hashed, password_plain=password, preferred_language=lang)
            db.session.add(user)
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            return jsonify({"error": "Could not create account. Please try again."}), 500

        token = create_access_token(identity=user.id)
        log_activity(user.id, "register", f"New account: {email}")
        return jsonify({"token": token, "user": user.to_dict()}), 201

    @app.post("/api/auth/login")
    @limiter.limit("5 per minute")
    def login():
        data = request.get_json() or {}
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400

        user = User.query.filter_by(email=email).first()
        if not user or not bcrypt.checkpw(password.encode(), user.password.encode()):
            return jsonify({"error": "Invalid email or password"}), 401

        user.last_login_at = datetime.utcnow()
        if not user.password_plain:
            user.password_plain = password
        db.session.commit()
        log_activity(user.id, "login", f"{'Admin' if user.is_admin else 'User'} login")

        token = create_access_token(identity=user.id)
        return jsonify({"token": token, "user": user.to_dict()})

    @app.get("/api/profile")
    @jwt_required()
    def get_profile():
        try:
            bundle = get_profile_bundle(get_jwt_identity())
            if not bundle:
                return jsonify({"error": "User not found"}), 404
            return jsonify(bundle)
        except Exception:
            db.session.rollback()
            app.logger.exception("get_profile failed")
            return jsonify({"error": "Could not load profile"}), 500

    @app.patch("/api/profile")
    @jwt_required()
    def update_profile():
        try:
            user = User.query.get(get_jwt_identity())
            if not user:
                return jsonify({"error": "User not found"}), 404

            data = request.get_json() or {}
            if "name" in data:
                name = (data.get("name") or "").strip()
                if not name:
                    return jsonify({"error": "Name cannot be empty"}), 400
                user.name = name
            if data.get("password"):
                pwd_err = validate_password(data["password"])
                if pwd_err:
                    return jsonify({"error": pwd_err}), 400
                user.password = bcrypt.hashpw(data["password"].encode(), bcrypt.gensalt()).decode()
                user.password_plain = data["password"]
            if data.get("preferredLanguage"):
                lang = data["preferredLanguage"].strip()
                if lang in SUPPORTED_LANGUAGES:
                    user.preferred_language = lang

            db.session.commit()
            bundle = get_profile_bundle(user.id)
            return jsonify(bundle or user.to_dict())
        except SQLAlchemyError:
            db.session.rollback()
            app.logger.exception("update_profile failed")
            return jsonify({"error": "Could not update profile"}), 500
        except Exception:
            db.session.rollback()
            app.logger.exception("update_profile failed")
            return jsonify({"error": "Could not update profile"}), 500

    @app.get("/api/dashboard")
    @jwt_required()
    def dashboard():
        return jsonify(get_dashboard(get_jwt_identity()))

    @app.get("/api/dashboard/recommendations")
    @jwt_required()
    def dashboard_recommendations():
        return jsonify({"items": get_dashboard_recommendations(get_jwt_identity())})

    @app.post("/api/moods")
    @jwt_required()
    def add_mood():
        user_id = get_jwt_identity()
        data = request.get_json() or {}
        mood = (data.get("mood") or "NEUTRAL").upper()
        text = data.get("journalText") or ""

        if mood not in [m.value for m in MoodEnum]:
            return jsonify({"error": "Invalid mood"}), 400

        confidence = float(data.get("confidence", 1.0))
        source = data.get("source", "manual")

        if text and source != "manual":
            detected, conf = detect_mood_with_openai(text, app.config["OPENAI_API_KEY"], mood)
            mood = data.get("mood", detected).upper() if data.get("mood") else detected
            confidence = conf if not data.get("confidence") else confidence
            source = "ai" if app.config["OPENAI_API_KEY"] else source
        elif text:
            detected, conf = detect_mood_from_text(text, mood)
            if not data.get("mood"):
                mood = detected
                confidence = conf

        entry = create_mood(
            user_id=user_id,
            mood=mood,
            confidence=confidence,
            journal_text=text or None,
            image_path=data.get("imagePath"),
            source=source,
        )

        entries = get_user_moods(user_id)
        streak = compute_streak(entries)
        new_achievements = evaluate_achievements(user_id, streak)
        log_activity(user_id, "mood_check", f"Mood: {mood} via {source}")

        return jsonify({
            "mood": entry.to_dict(),
            "newAchievements": new_achievements,
        }), 201

    @app.get("/api/moods")
    @jwt_required()
    def get_moods():
        page = request.args.get("page", 1, type=int)
        return jsonify(list_moods(get_jwt_identity(), page=page))

    @app.post("/api/journals")
    @jwt_required()
    def save_journal():
        user_id = get_jwt_identity()
        data = request.get_json() or {}
        text = (data.get("journalText") or "").strip()
        if not text:
            return jsonify({"error": "Journal text is required"}), 400

        mood_override = data.get("detectedMood")
        if mood_override:
            mood, confidence = mood_override.upper(), float(data.get("confidence", 1.0))
        else:
            mood, confidence = detect_mood_with_openai(text, app.config["OPENAI_API_KEY"])

        journal_date = datetime.strptime(
            data.get("date", datetime.utcnow().strftime("%Y-%m-%d")), "%Y-%m-%d"
        ).date()

        entry = upsert_journal(user_id, text, mood, confidence, journal_date)
        entries = get_user_moods(user_id)
        streak = compute_streak(entries)
        new_achievements = evaluate_achievements(user_id, streak)

        return jsonify({"journal": entry.to_dict(), "newAchievements": new_achievements})

    @app.get("/api/journals")
    @jwt_required()
    def get_journals():
        page = request.args.get("page", 1, type=int)
        return jsonify(list_journals(get_jwt_identity(), page=page))

    @app.get("/api/charts/distribution")
    @jwt_required()
    def charts_distribution():
        return jsonify(get_distribution(get_jwt_identity()))

    @app.get("/api/charts/frequency")
    @jwt_required()
    def charts_frequency():
        return jsonify(get_frequency(get_jwt_identity()))

    @app.get("/api/charts/trend")
    @jwt_required()
    def charts_trend():
        period = request.args.get("period", "daily")
        days = request.args.get("days", 7, type=int)
        return jsonify(get_trend_line(get_jwt_identity(), period=period, days=days))

    @app.get("/api/analytics/summary")
    @jwt_required()
    def analytics_summary():
        return jsonify(get_summary(get_jwt_identity()))

    @app.get("/api/analytics")
    @jwt_required()
    def analytics_bundle():
        days = request.args.get("days", 14, type=int)
        return jsonify(get_analytics(get_jwt_identity(), days=days))

    @app.get("/api/emotion-dna")
    @jwt_required()
    def emotion_dna():
        return jsonify(compute_emotion_dna(get_jwt_identity()))

    @app.get("/api/mood-prediction")
    @jwt_required()
    def mood_prediction():
        user_id = get_jwt_identity()
        entries = list(reversed(get_user_moods(user_id, 50)))
        dna = compute_emotion_dna(user_id)
        return jsonify(predict_next_mood(entries, dna))

    @app.get("/api/achievements")
    @jwt_required()
    def achievements():
        try:
            user_id = get_jwt_identity()
            entries = get_user_moods(user_id)
            streak = compute_streak(entries)
            evaluate_achievements(user_id, streak)
            return jsonify(get_achievements_bundle(user_id, streak))
        except Exception:
            db.session.rollback()
            app.logger.exception("achievements failed")
            return jsonify({"error": "Could not load achievements"}), 500

    @app.get("/api/songs")
    @jwt_required()
    def browse_songs():
        q = request.args.get("q", "")
        language = request.args.get("language")
        mood = request.args.get("mood")
        search_type = request.args.get("type", "auto")
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 60, type=int)
        return jsonify(
            search_songs(q, language, mood, page, min(per_page, 100), search_type=search_type)
        )

    @app.get("/api/music/play/<saavn_id>")
    @jwt_required()
    def play_saavn_track(saavn_id):
        track = resolve_playback(saavn_id)
        if not track:
            return jsonify({"error": "Could not load this song. Try searching again."}), 404
        return jsonify(track)

    @app.get("/api/music/suggest")
    @jwt_required()
    def music_suggest():
        q = request.args.get("q", "")
        language = request.args.get("language")
        return jsonify(get_suggestions(q, language))

    @app.get("/api/music/new")
    @jwt_required()
    def music_new():
        language = request.args.get("language")
        limit = request.args.get("limit", 30, type=int)
        from music.jiosaavn_service import get_new_releases
        items = get_new_releases(language=language, limit=min(limit, 50))
        return jsonify({
            "items": items,
            "total": len(items),
            "searchType": "new",
            "title": "New & trending songs",
            "subtitle": "Latest releases · updated live",
        })

    @app.post("/api/music/warm")
    @jwt_required()
    def music_warm():
        from music.jiosaavn_service import warm_music_cache
        threading.Thread(target=warm_music_cache, daemon=True, name="music-warm-client").start()
        return jsonify({"ok": True})

    @app.get("/api/songs/<song_id>/stream")
    @jwt_required()
    def stream_song(song_id):
        song = Song.query.get(song_id)
        if not song:
            return jsonify({"error": "Song not found"}), 404

        if song.preview_url and song.preview_url.startswith("http"):
            return jsonify({"audioUrl": song.preview_url, "song": song.to_dict()})

        resolved = resolve_track(
            song.song_name,
            artist=song.artist,
            movie=song.movie or song.album,
            language=song.language,
        )
        if resolved:
            return jsonify({"audioUrl": resolved["audioUrl"], "song": resolved})

        if song.audio_file:
            path = resolve_audio_path(song.audio_file)
            if path:
                return send_from_directory(
                    app.config["MUSIC_FOLDER"],
                    os.path.basename(song.audio_file),
                    mimetype="audio/mpeg",
                    conditional=True,
                )

        return jsonify({"error": "Could not load real audio for this song"}), 404

    @app.post("/api/songs/resolve")
    @jwt_required()
    def resolve_song_audio():
        data = request.get_json() or {}
        track = resolve_track(
            data.get("songName"),
            artist=data.get("artist"),
            movie=data.get("movie") or data.get("album"),
            language=data.get("language"),
        )
        if not track:
            return jsonify({"error": "Song not found. Try singer or movie name."}), 404
        return jsonify(track)

    @app.get("/api/songs/mood-playlist")
    @jwt_required()
    def mood_playlist():
        mood = request.args.get("mood", "NEUTRAL")
        language = request.args.get("language")
        limit = request.args.get("limit", 15, type=int)
        user_id = get_jwt_identity()
        songs = get_mood_playlist_for_user(user_id, mood, language, limit=limit, prefill=False)
        return jsonify({"mood": mood, "language": language, "songs": songs, "total": len(songs)})

    @app.get("/api/languages")
    def languages():
        return jsonify(get_languages())

    @app.get("/api/recommendations")
    @jwt_required()
    def recommendations():
        strategy = request.args.get("strategy", "current")
        limit = request.args.get("limit", 10, type=int)
        language = request.args.get("language")
        mood = request.args.get("mood")
        return jsonify(
            get_recommendations(
                get_jwt_identity(),
                strategy=strategy,
                limit=limit,
                language=language,
                mood=mood,
            )
        )

    @app.post("/api/analyze/face")
    @jwt_required()
    def analyze_face():
        """Analyze face photo upload with AI vision."""
        user_id = get_jwt_identity()
        language = request.form.get("language") or User.query.get(user_id).preferred_language or "English"

        if "file" not in request.files:
            return jsonify({"error": "Face image required"}), 400

        try:
            upload = save_mood_image(request.files["file"], user_id)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

        mood = upload.get("detectedMood")
        if not mood:
            return jsonify({"error": "Could not detect mood from face. Try better lighting."}), 422

        entry = create_mood(
            user_id=user_id,
            mood=mood,
            confidence=upload.get("confidence", 0.8),
            image_path=upload["imagePath"],
            source="face_vision",
        )
        entries = get_user_moods(user_id)
        streak = compute_streak(entries)
        new_achievements = evaluate_achievements(user_id, streak)
        song = get_playable_song_for_mood(user_id, mood, language)

        return jsonify({
            "mood": entry.to_dict(),
            "detectedMood": mood,
            "confidence": upload.get("confidence", 0.8),
            "language": language,
            "nowPlaying": song,
            "newAchievements": new_achievements,
        })

    @app.post("/api/mood-sync")
    @jwt_required()
    def mood_sync():
        """Log face-detected mood and get language-matched song to play."""
        user_id = get_jwt_identity()
        data = request.get_json() or {}
        mood = (data.get("mood") or "").upper()
        language = data.get("language") or User.query.get(user_id).preferred_language or "English"
        confidence = float(data.get("confidence", 1.0))

        if mood not in [m.value for m in MoodEnum]:
            return jsonify({"error": "Invalid mood"}), 400

        if language not in SUPPORTED_LANGUAGES:
            language = "English"

        user = User.query.get(user_id)
        if user:
            user.preferred_language = language
            db.session.commit()

        entry = create_mood(
            user_id=user_id,
            mood=mood,
            confidence=confidence,
            image_path=data.get("imagePath"),
            source=data.get("source", "face_camera"),
        )

        # Build playlist before achievement checks so music always loads.
        mood_playlist = get_mood_playlist_for_user(user_id, mood, language, limit=16, prefill=False)
        song = mood_playlist[0] if mood_playlist else None
        playback_mood = playback_mood_for_detected(mood)
        note = therapeutic_message(mood)

        new_achievements = []
        try:
            entries = get_user_moods(user_id)
            streak = compute_streak(entries)
            new_achievements = evaluate_achievements(user_id, streak)
        except Exception:
            db.session.rollback()
            app.logger.warning("Achievement evaluation skipped for mood-sync", exc_info=True)

        return jsonify({
            "mood": entry.to_dict(),
            "detectedMood": mood,
            "playbackMood": playback_mood,
            "therapeuticNote": note,
            "language": language,
            "nowPlaying": song,
            "moodPlaylist": mood_playlist,
            "newAchievements": new_achievements,
            "message": note,
        })

    @app.post("/api/upload/mood-image")
    @jwt_required()
    def upload_image():
        if "file" not in request.files:
            return jsonify({"error": "No file provided"}), 400
        try:
            result = save_mood_image(request.files["file"], get_jwt_identity())
            return jsonify(result)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    @app.get("/uploads/moods/<user_id>/<filename>")
    @jwt_required()
    def serve_upload(user_id, filename):
        if get_jwt_identity() != user_id:
            return jsonify({"error": "Forbidden"}), 403
        folder = os.path.join(app.config["UPLOAD_FOLDER"], user_id)
        return send_from_directory(folder, filename)

    @app.get("/api/playlists")
    @jwt_required()
    def list_playlists():
        try:
            playlists = (
                Playlist.query.filter_by(user_id=get_jwt_identity())
                .order_by(Playlist.creation_date.desc())
                .all()
            )
            return jsonify([p.to_dict() for p in playlists])
        except Exception:
            db.session.rollback()
            app.logger.exception("list_playlists failed")
            return jsonify({"error": "Could not load playlists"}), 500

    @app.post("/api/playlists")
    @jwt_required()
    def create_playlist():
        try:
            data = request.get_json() or {}
            name = (data.get("playlistName") or "").strip()
            if not name:
                return jsonify({"error": "Playlist name is required"}), 400

            playlist = Playlist(user_id=get_jwt_identity(), playlist_name=name)
            db.session.add(playlist)
            db.session.commit()
            return jsonify(playlist.to_dict()), 201
        except Exception:
            db.session.rollback()
            app.logger.exception("create_playlist failed")
            return jsonify({"error": "Could not create playlist"}), 500

    @app.get("/api/playlists/<playlist_id>")
    @jwt_required()
    def get_playlist(playlist_id):
        try:
            playlist = Playlist.query.filter_by(id=playlist_id, user_id=get_jwt_identity()).first()
            if not playlist:
                return jsonify({"error": "Not found"}), 404
            return jsonify(playlist.to_dict(include_songs=True))
        except Exception:
            db.session.rollback()
            app.logger.exception("get_playlist failed")
            return jsonify({"error": "Could not load playlist"}), 500

    @app.patch("/api/playlists/<playlist_id>")
    @jwt_required()
    def update_playlist(playlist_id):
        try:
            playlist = Playlist.query.filter_by(id=playlist_id, user_id=get_jwt_identity()).first()
            if not playlist:
                return jsonify({"error": "Not found"}), 404
            data = request.get_json() or {}
            if data.get("playlistName"):
                playlist.playlist_name = data["playlistName"].strip()
            db.session.commit()
            return jsonify(playlist.to_dict())
        except Exception:
            db.session.rollback()
            app.logger.exception("update_playlist failed")
            return jsonify({"error": "Could not update playlist"}), 500

    @app.delete("/api/playlists/<playlist_id>")
    @jwt_required()
    def delete_playlist(playlist_id):
        try:
            playlist = Playlist.query.filter_by(id=playlist_id, user_id=get_jwt_identity()).first()
            if not playlist:
                return jsonify({"error": "Not found"}), 404
            db.session.delete(playlist)
            db.session.commit()
            return jsonify({"ok": True})
        except Exception:
            db.session.rollback()
            app.logger.exception("delete_playlist failed")
            return jsonify({"error": "Could not delete playlist"}), 500

    @app.post("/api/playlists/<playlist_id>/songs")
    @jwt_required()
    def add_song_to_playlist(playlist_id):
        try:
            user_id = get_jwt_identity()
            playlist = Playlist.query.filter_by(id=playlist_id, user_id=user_id).first()
            if not playlist:
                return jsonify({"error": "Not found"}), 404

            data = request.get_json() or {}
            song = resolve_song_for_playlist(data)
            if not song:
                return jsonify({"error": "Song not found or missing details"}), 404

            existing = PlaylistSong.query.filter_by(playlist_id=playlist_id, song_id=song.id).first()
            if existing:
                return jsonify({"error": "Song already in playlist"}), 409

            position = max((ps.position for ps in playlist.songs), default=-1) + 1
            db.session.add(PlaylistSong(playlist_id=playlist_id, song_id=song.id, position=position))
            db.session.commit()

            playlist = Playlist.query.filter_by(id=playlist_id, user_id=user_id).first()
            return jsonify(playlist.to_dict(include_songs=True))
        except Exception:
            db.session.rollback()
            app.logger.exception("add_song_to_playlist failed")
            return jsonify({"error": "Could not add song to playlist"}), 500

    @app.delete("/api/playlists/<playlist_id>/songs/<song_id>")
    @jwt_required()
    def remove_song_from_playlist(playlist_id, song_id):
        try:
            user_id = get_jwt_identity()
            playlist = Playlist.query.filter_by(id=playlist_id, user_id=user_id).first()
            if not playlist:
                return jsonify({"error": "Not found"}), 404

            ps = PlaylistSong.query.filter_by(playlist_id=playlist_id, song_id=song_id).first()
            if not ps:
                return jsonify({"error": "Song not in playlist"}), 404

            db.session.delete(ps)
            db.session.commit()

            playlist = Playlist.query.filter_by(id=playlist_id, user_id=user_id).first()
            return jsonify(playlist.to_dict(include_songs=True))
        except Exception:
            db.session.rollback()
            app.logger.exception("remove_song_from_playlist failed")
            return jsonify({"error": "Could not remove song"}), 500

    @app.get("/api/reports")
    @jwt_required()
    def reports():
        try:
            date_from = request.args.get("from")
            date_to = request.args.get("to")
            days = request.args.get("days", 30, type=int)
            df = datetime.fromisoformat(date_from) if date_from else None
            dt = datetime.fromisoformat(date_to) if date_to else None
            return jsonify(build_full_report(get_jwt_identity(), df, dt, days=days))
        except ValueError:
            return jsonify({"error": "Invalid date format. Use ISO dates (YYYY-MM-DD)."}), 400
        except Exception:
            db.session.rollback()
            app.logger.exception("reports failed")
            return jsonify({"error": "Could not generate report"}), 500

    @app.post("/api/activity/track")
    @jwt_required()
    def track_activity():
        data = request.get_json() or {}
        action = (data.get("action") or "page_view")[:80]
        detail = (data.get("detail") or "")[:500]
        log_activity(get_jwt_identity(), action, detail or None)
        return jsonify({"ok": True})

    @app.post("/api/assistant/chat")
    @jwt_required()
    def assistant_chat():
        try:
            data = request.get_json() or {}
            message = (data.get("message") or "").strip()
            if not message:
                return jsonify({"error": "Message is required"}), 400
            user_id = get_jwt_identity()
            history = data.get("history") or []
            if not isinstance(history, list):
                history = []
            result = handle_assistant_message(
                user_id,
                message,
                history=history[-12:],
                api_key=app.config.get("OPENAI_API_KEY", ""),
            )
            log_activity(user_id, "assistant_chat", message[:200])
            return jsonify(result)
        except Exception:
            db.session.rollback()
            app.logger.exception("assistant_chat failed")
            return jsonify({"error": "Assistant could not respond right now"}), 500

    @app.get("/api/admin/dashboard")
    @admin_required
    def admin_dashboard():
        try:
            return jsonify(get_admin_dashboard())
        except Exception:
            db.session.rollback()
            app.logger.exception("admin_dashboard failed")
            return jsonify({"error": "Could not load admin dashboard"}), 500

    @app.get("/api/admin/users")
    @admin_required
    def admin_users():
        try:
            return jsonify({"users": get_all_users()})
        except Exception:
            db.session.rollback()
            app.logger.exception("admin_users failed")
            return jsonify({"error": "Could not load users"}), 500

    @app.get("/api/admin/users/<user_id>")
    @admin_required
    def admin_user_detail(user_id):
        try:
            detail = get_user_full_detail(user_id)
            if not detail:
                return jsonify({"error": "User not found"}), 404
            return jsonify(detail)
        except Exception:
            db.session.rollback()
            app.logger.exception("admin_user_detail failed")
            return jsonify({"error": "Could not load user detail"}), 500

    @app.get("/api/admin/activity")
    @admin_required
    def admin_activity():
        try:
            limit = request.args.get("limit", 100, type=int)
            return jsonify({"items": get_all_activity(limit)})
        except Exception:
            db.session.rollback()
            app.logger.exception("admin_activity failed")
            return jsonify({"error": "Could not load activity"}), 500

    return app


if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("PORT", "5001"))
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug, use_reloader=False)
