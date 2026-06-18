import os
from urllib.parse import quote_plus


def normalize_database_url(url: str) -> str:
    cleaned = url.strip()
    if cleaned.startswith("postgres://"):
        cleaned = cleaned.replace("postgres://", "postgresql://", 1)
    if cleaned.startswith("postgresql://") and "+psycopg" not in cleaned:
        cleaned = cleaned.replace("postgresql://", "postgresql+psycopg://", 1)
    return cleaned


def build_database_url() -> str:
    explicit = os.getenv("DATABASE_URL")
    if explicit:
        return normalize_database_url(explicit)

    host = os.getenv("POSTGRES_HOST") or os.getenv("PGHOST") or "localhost"
    port = os.getenv("POSTGRES_PORT") or os.getenv("PGPORT") or "5432"
    user = os.getenv("POSTGRES_USER") or os.getenv("PGUSER") or "moodsync"
    password = os.getenv("POSTGRES_PASSWORD") or os.getenv("PGPASSWORD") or "moodsync"
    database = os.getenv("POSTGRES_DB") or os.getenv("PGDATABASE") or "moodsync"

    safe_password = quote_plus(password)
    return f"postgresql+psycopg://{user}:{safe_password}@{host}:{port}/{database}"


def is_postgresql(url: str) -> bool:
    return url.startswith("postgresql")


def engine_options(url: str) -> dict:
    if not is_postgresql(url):
        return {}

    return {
        "pool_pre_ping": True,
        "pool_recycle": int(os.getenv("DB_POOL_RECYCLE", "300")),
        "pool_size": int(os.getenv("DB_POOL_SIZE", "5")),
        "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "10")),
        "pool_timeout": int(os.getenv("DB_POOL_TIMEOUT", "30")),
        "connect_args": {
            "connect_timeout": int(os.getenv("DB_CONNECT_TIMEOUT", "5")),
            "application_name": os.getenv("DB_APPLICATION_NAME", "moodsync-backend"),
        },
    }


def database_label(url: str) -> str:
    if is_postgresql(url):
        return "postgresql"
    if url.startswith("sqlite"):
        return "sqlite"
    return "unknown"
