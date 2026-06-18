import os
from datetime import timedelta

from dotenv import load_dotenv

from database import build_database_url, database_label, engine_options

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)

# Load env from project root first, then backend overrides.
load_dotenv(os.path.join(ROOT_DIR, ".env"))
load_dotenv(os.path.join(BASE_DIR, ".env"))

INSTANCE_DIR = os.path.join(BASE_DIR, "instance")
os.makedirs(INSTANCE_DIR, exist_ok=True)

_DATABASE_URL = build_database_url()


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "jwt-secret-change-me")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    SQLALCHEMY_DATABASE_URI = _DATABASE_URL
    SQLALCHEMY_ENGINE_OPTIONS = engine_options(_DATABASE_URL)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    DATABASE_BACKEND = database_label(_DATABASE_URL)
    UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads", "moods")
    MUSIC_FOLDER = os.path.join(BASE_DIR, "music_files")
    UPLOAD_MAX_SIZE_MB = int(os.getenv("UPLOAD_MAX_SIZE_MB", "5"))
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
    ALLOWED_MIMES = {"image/jpeg", "image/png", "image/webp"}
