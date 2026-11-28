from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from pathlib import Path
from dotenv import load_dotenv
from urllib.parse import parse_qs, quote_plus, urlsplit

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

# --- PostgreSQL SSL configuration -------------------------------------------------
# libpq accepts a fixed set of sslmode tokens; anything else is rejected outright so a
# typo cannot silently weaken transport security. Development defaults to "prefer"
# (use TLS when the server offers it) and production to "require" (refuse plaintext).
ALLOWED_DATABASE_SSLMODES = (
    "disable",
    "allow",
    "prefer",
    "require",
    "verify-ca",
    "verify-full",
)
_DEVELOPMENT_SSLMODE = "prefer"
_PRODUCTION_SSLMODE = "require"

# Environment detection mirrors app.auth / app.main / app.seed for consistency.
_env_name = (
    os.getenv("TOURPIE_ENV") or os.getenv("ENVIRONMENT") or os.getenv("ENV") or "development"
).strip().lower()
_is_production = _env_name in ("prod", "production")


def default_database_sslmode(is_production: bool) -> str:
    """Return the SSL mode used when neither the environment nor the URL specifies one."""
    return _PRODUCTION_SSLMODE if is_production else _DEVELOPMENT_SSLMODE


def resolve_database_sslmode(raw_value, *, is_production: bool) -> str:
    """Resolve an explicit ``DATABASE_SSLMODE`` value to a valid libpq token.

    A blank/absent value falls back to the environment default. An unknown token raises
    immediately so a misconfiguration fails fast instead of silently downgrading TLS.
    Only the (non-secret) mode token is ever surfaced in the error message.
    """
    value = (raw_value or "").strip().lower()
    if not value:
        return default_database_sslmode(is_production)
    if value not in ALLOWED_DATABASE_SSLMODES:
        raise ValueError(
            "Invalid DATABASE_SSLMODE {!r}; expected one of: {}".format(
                value, ", ".join(ALLOWED_DATABASE_SSLMODES)
            )
        )
    return value


def build_connect_args(*, sslmode=None, sslrootcert=None) -> dict:
    """Build psycopg2 ``connect_args`` for SSL.

    ``sslmode`` is included only when set, so a mode already carried by the connection
    URL is left untouched; ``sslrootcert`` is forwarded only when a path is configured.
    """
    connect_args = {}
    if sslmode:
        connect_args["sslmode"] = sslmode
    certificate = (sslrootcert or "").strip()
    if certificate:
        connect_args["sslrootcert"] = certificate
    return connect_args


def _url_declares_sslmode(url: str) -> bool:
    """True when the connection URL already carries an ``sslmode`` query parameter."""
    return "sslmode" in parse_qs(urlsplit(url).query)


# Effective SSL configuration. Precedence: explicit DATABASE_SSLMODE > mode embedded in
# DATABASE_URL > environment default. SQLAlchemy lets connect_args win over URL query
# parameters, so an sslmode already present in the URL is intentionally not overridden.
if (os.getenv("DATABASE_SSLMODE") or "").strip():
    DATABASE_SSLMODE = resolve_database_sslmode(
        os.getenv("DATABASE_SSLMODE"), is_production=_is_production
    )
elif _url_declares_sslmode(SQLALCHEMY_DATABASE_URL):
    DATABASE_SSLMODE = None
else:
    DATABASE_SSLMODE = default_database_sslmode(_is_production)

DATABASE_SSLROOTCERT = (os.getenv("DATABASE_SSLROOTCERT") or "").strip()
DATABASE_CONNECT_ARGS = build_connect_args(
    sslmode=DATABASE_SSLMODE, sslrootcert=DATABASE_SSLROOTCERT
)

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,
    connect_args=DATABASE_CONNECT_ARGS,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
