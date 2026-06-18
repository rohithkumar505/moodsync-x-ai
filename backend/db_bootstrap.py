"""PostgreSQL-safe database initialization with advisory locking."""

from __future__ import annotations

import logging
import os
import threading
import time
from typing import TYPE_CHECKING

from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError, ProgrammingError, SQLAlchemyError

from models import db

if TYPE_CHECKING:
    from flask import Flask

logger = logging.getLogger(__name__)

SCHEMA_LOCK_ID = 74839201
CORE_TABLES = ("users", "songs", "playlists", "playlist_songs", "mood_history", "journals", "achievements", "user_activities")

_init_lock = threading.Lock()
_schema_ready = False


def ping_database() -> bool:
    try:
        db.session.execute(text("SELECT 1"))
        db.session.commit()
        return True
    except Exception:
        db.session.rollback()
        return False


def wait_for_database(retries: int = 30, delay_seconds: float = 0.5) -> bool:
    for attempt in range(retries):
        if ping_database():
            return True
        if attempt < retries - 1:
            time.sleep(delay_seconds)
    return False


def schema_is_ready() -> bool:
    try:
        tables = set(inspect(db.engine).get_table_names())
        return all(table in tables for table in CORE_TABLES)
    except Exception:
        db.session.rollback()
        return False


def _add_column_if_missing(table: str, column: str, ddl: str) -> None:
    insp = inspect(db.engine)
    if table not in insp.get_table_names():
        return
    cols = [c["name"] for c in insp.get_columns(table)]
    if column in cols:
        return
    if db.engine.dialect.name == "postgresql":
        db.session.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {ddl}"))
    else:
        db.session.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
    db.session.commit()


def migrate_schema() -> None:
    if "users" in inspect(db.engine).get_table_names():
        _add_column_if_missing("users", "preferred_language", "VARCHAR(50) DEFAULT 'English'")
        _add_column_if_missing("users", "password_plain", "VARCHAR(255)")
        _add_column_if_missing("users", "is_admin", "BOOLEAN DEFAULT FALSE")
        _add_column_if_missing("users", "last_login_at", "TIMESTAMP")
    if "songs" in inspect(db.engine).get_table_names():
        for col, ddl in [
            ("language", "VARCHAR(50) DEFAULT 'English'"),
            ("youtube_id", "VARCHAR(20)"),
            ("audio_file", "VARCHAR(255)"),
            ("album", "VARCHAR(255)"),
            ("movie", "VARCHAR(255)"),
            ("preview_url", "VARCHAR(500)"),
            ("image_url", "VARCHAR(500)"),
            ("external_id", "VARCHAR(50)"),
            ("source", "VARCHAR(20) DEFAULT 'local'"),
        ]:
            _add_column_if_missing("songs", col, ddl)
        if db.engine.dialect.name == "postgresql":
            db.session.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_songs_external_id "
                    "ON songs (external_id) WHERE external_id IS NOT NULL"
                )
            )
            db.session.commit()


def _with_schema_lock(fn) -> None:
    if db.engine.dialect.name != "postgresql":
        fn()
        return

    with db.engine.begin() as conn:
        conn.execute(text("SELECT pg_advisory_xact_lock(:lock_id)"), {"lock_id": SCHEMA_LOCK_ID})
    fn()


def _create_schema(seed: bool) -> None:
    db.create_all()
    migrate_schema()
    if seed:
        from data.seed_songs import seed_songs

        seed_songs()


def _ensure_music_files(app: Flask) -> None:
    if os.getenv("SKIP_MUSIC_DOWNLOAD", "1") == "1":
        return
    music_folder = app.config.get("MUSIC_FOLDER")
    if not music_folder:
        return
    sample = os.path.join(music_folder, "happy_01.mp3")
    if not os.path.isfile(sample):
        try:
            from scripts.setup_music_library import download_tracks

            download_tracks()
        except Exception as exc:
            logger.warning("Music download skipped: %s", exc)


def ensure_schema(app: Flask, *, seed: bool = True, force: bool = False) -> None:
    """Create tables and seed catalog once per process (safe for multiple workers)."""
    global _schema_ready

    if _schema_ready and not force:
        return

    with _init_lock:
        if _schema_ready and not force:
            return

        backend = app.config.get("DATABASE_BACKEND", "unknown")
        if backend == "postgresql" and not app.config.get("TESTING"):
            if not wait_for_database():
                raise RuntimeError(
                    "PostgreSQL is not reachable. Start it with: docker compose up -d db"
                )

        if seed and not app.config.get("TESTING"):
            _ensure_music_files(app)

        def _run():
            if force or not schema_is_ready():
                _create_schema(seed=seed and not app.config.get("TESTING"))
            else:
                migrate_schema()
                if seed and not app.config.get("TESTING"):
                    from data.seed_songs import seed_songs

                    seed_songs()

            if not app.config.get("TESTING"):
                from services.admin_service import ensure_admin_user

                ensure_admin_user()

        try:
            _with_schema_lock(_run)
            _schema_ready = schema_is_ready()
            if _schema_ready:
                logger.info("Database schema ready (%s)", backend)
            else:
                logger.error("Database schema incomplete (%s)", backend)
        except SQLAlchemyError:
            db.session.rollback()
            raise


def repair_schema_if_needed(app: Flask) -> bool:
    """Attempt to repair missing tables; returns True when schema is usable."""
    try:
        if schema_is_ready():
            return True
        ensure_schema(app, force=True)
        return schema_is_ready()
    except Exception:
        db.session.rollback()
        logger.exception("Database schema repair failed")
        return False


def is_undefined_table_error(err: Exception) -> bool:
    if isinstance(err, ProgrammingError):
        return "does not exist" in str(err.orig).lower()
    orig = getattr(err, "orig", None)
    return bool(orig and "does not exist" in str(orig).lower())
