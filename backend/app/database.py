from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from pathlib import Path
from dotenv import load_dotenv
from urllib.parse import quote_plus

_base_dir = Path(__file__).resolve().parent.parent
load_dotenv(_base_dir / ".env", override=False)
load_dotenv(_base_dir.parent / ".env", override=False)

_PLAIN_POSTGRES_SCHEMES = ("postgres://", "postgresql://")


def _normalize_postgres_scheme(url: str) -> str:
    """Force the psycopg2 dialect onto plain PostgreSQL URL schemes.

    Managed providers (Railway, Heroku, Render) commonly inject ``postgres://`` or
    ``postgresql://`` URLs without a driver. SQLAlchemy 2.0 rejects the legacy
    ``postgres://`` scheme outright, so both are rewritten to
    ``postgresql+psycopg2://``. Only the scheme is replaced: credentials, host,
    port, database and query string are preserved verbatim, and URLs that already
    name a driver (e.g. ``postgresql+psycopg2://``) are returned unchanged.
    """
    lowered = url.lower()
    for scheme in _PLAIN_POSTGRES_SCHEMES:
        if lowered.startswith(scheme):
            return "postgresql+psycopg2://" + url[len(scheme):]
    return url


def build_postgres_url() -> str:
    url = (os.getenv("DATABASE_URL") or "").strip()
    if url:
        return _normalize_postgres_scheme(url)
    host = (os.getenv("DATABASE_HOST") or "127.0.0.1").strip()
    port = int(os.getenv("DATABASE_PORT", "5432"))
    name = (os.getenv("DATABASE_NAME") or "tourpie").strip()
    user = (os.getenv("DATABASE_USER") or "postgres").strip()
    password = os.getenv("DATABASE_PASSWORD")
    if password is None:
        password = ""
    password = password.strip()

    auth_part = quote_plus(user)
    if password:
        auth_part = f"{auth_part}:{quote_plus(password)}"
    return f"postgresql+psycopg2://{auth_part}@{host}:{port}/{name}"

SQLALCHEMY_DATABASE_URL = build_postgres_url()

engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
