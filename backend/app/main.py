from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import users, packages, bookings, agencies, recommendations, favorites, messages, notifications, community, blog, moderation, trip_marketplace
from sqlalchemy import text
import os

_env_name = (os.getenv("TOURPIE_ENV") or os.getenv("ENVIRONMENT") or os.getenv("ENV") or "development").strip().lower()
_is_prod = _env_name in ("prod", "production")

_auto_schema_raw = os.getenv("TOURPIE_AUTO_SCHEMA")
if _auto_schema_raw is None:
    _auto_schema = not _is_prod
else:
    _auto_schema = _auto_schema_raw.strip() == "1"

if _auto_schema:
    Base.metadata.create_all(bind=engine)

def _ensure_columns():
    ddl = [
        "ALTER TABLE packages ADD COLUMN IF NOT EXISTS region VARCHAR",
        "ALTER TABLE packages ADD COLUMN IF NOT EXISTS package_type VARCHAR",
        "ALTER TABLE packages ADD COLUMN IF NOT EXISTS hotel_rating INTEGER",
        "ALTER TABLE packages ADD COLUMN IF NOT EXISTS transportation_type VARCHAR",
        "ALTER TABLE agencies ADD COLUMN IF NOT EXISTS subscription_status VARCHAR",
        "ALTER TABLE agencies ADD COLUMN IF NOT EXISTS custom_trip_requests_enabled BOOLEAN",
        "ALTER TABLE agencies ADD COLUMN IF NOT EXISTS countries_served TEXT",
        "ALTER TABLE agencies ADD COLUMN IF NOT EXISTS cities_served TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS time_zone VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token_hash VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token_expires_at TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_change_token_hash VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_change_token_expires_at TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_change_sent_at TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_change_rate_window_start TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_change_rate_count INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP",
    ]
    try:
        with engine.begin() as conn:
            for stmt in ddl:
                conn.execute(text(stmt))
    except Exception:
        return

if _auto_schema:
    _ensure_columns()

app = FastAPI(title="TourPie - Travel Marketplace API")

def _parse_cors_origins() -> list[str]:
    raw = (os.getenv("CORS_ORIGINS") or os.getenv("TOURPIE_CORS_ORIGINS") or "").strip()
    if not raw:
        return ["http://127.0.0.1:3000"]
    return [item.strip() for item in raw.split(",") if item.strip()]

# Configure CORS
cors_origins = _parse_cors_origins()
cors_allow_credentials = (os.getenv("CORS_ALLOW_CREDENTIALS") or "1").strip() == "1"
if "*" in cors_origins:
    cors_allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(packages.router, prefix="/packages", tags=["packages"])
app.include_router(bookings.router, prefix="/bookings", tags=["bookings"])
app.include_router(agencies.router, prefix="/agencies", tags=["agencies"])
app.include_router(recommendations.router, prefix="/recommendations", tags=["recommendations"])
app.include_router(favorites.router, prefix="/favorites", tags=["favorites"])
app.include_router(messages.router, prefix="/messages", tags=["messages"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
app.include_router(community.router, prefix="/community", tags=["community"])
app.include_router(blog.router, prefix="/blog", tags=["blog"])
app.include_router(moderation.router, prefix="/moderation", tags=["moderation"])
app.include_router(trip_marketplace.router, tags=["trip_marketplace"])

@app.get("/")
async def root():
    return {"message": "Welcome to TourPie API"}
