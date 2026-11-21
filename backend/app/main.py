from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import users, packages, bookings, agencies, recommendations, favorites, messages, notifications, community, blog, moderation, trip_marketplace
from sqlalchemy import text
from sqlalchemy.orm import Session
from .database import SessionLocal
from .models import User, UserRole
from .auth import get_password_hash, validate_strong_password
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import logging
import os 
from dotenv import load_dotenv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Load local .env files without overriding variables already present in the OS
# environment, consistent with app/database.py and app/auth.py.
load_dotenv(BASE_DIR / ".env", override=False)
load_dotenv(BASE_DIR.parent / ".env", override=False)

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
        "ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS country VARCHAR",
        "ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS city VARCHAR",
        "ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS duration INTEGER",
        "ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS transportation VARCHAR",
        "ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS visa_required BOOLEAN DEFAULT FALSE",
        "ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS travel_style VARCHAR",
        "ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS special_requirements TEXT",
        "ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS notes TEXT",
        "ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS attachments TEXT",
        "ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP",
        "ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP",
        "ALTER TABLE trip_request_agency_matches ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP",
        "ALTER TABLE trip_request_agency_matches ADD COLUMN IF NOT EXISTS interested_at TIMESTAMP",
        "ALTER TABLE trip_offers ADD COLUMN IF NOT EXISTS hotel_stars INTEGER",
        "ALTER TABLE trip_offers ADD COLUMN IF NOT EXISTS flight_included BOOLEAN DEFAULT FALSE",
        "ALTER TABLE trip_offers ADD COLUMN IF NOT EXISTS airport_transfer BOOLEAN DEFAULT FALSE",
        "ALTER TABLE trip_offers ADD COLUMN IF NOT EXISTS breakfast_included BOOLEAN DEFAULT FALSE",
        "ALTER TABLE trip_offers ADD COLUMN IF NOT EXISTS lunch_included BOOLEAN DEFAULT FALSE",
        "ALTER TABLE trip_offers ADD COLUMN IF NOT EXISTS dinner_included BOOLEAN DEFAULT FALSE",
        "ALTER TABLE trip_offers ADD COLUMN IF NOT EXISTS visa_support VARCHAR",
        "ALTER TABLE trip_offers ADD COLUMN IF NOT EXISTS travel_program TEXT",
        "ALTER TABLE trip_offers ADD COLUMN IF NOT EXISTS included_services TEXT",
        "ALTER TABLE trip_offers ADD COLUMN IF NOT EXISTS excluded_services TEXT",
        "ALTER TABLE trip_offers ADD COLUMN IF NOT EXISTS offer_attachments TEXT",
        "ALTER TABLE trip_offers ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP",
        "ALTER TABLE trip_offers ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP",
        "ALTER TABLE trip_offers ADD COLUMN IF NOT EXISTS revision_requested_at TIMESTAMP",
        "ALTER TABLE trip_offers ADD COLUMN IF NOT EXISTS revision_notes TEXT",
        "ALTER TABLE trip_offers ADD COLUMN IF NOT EXISTS is_bookmarked BOOLEAN DEFAULT FALSE",
        "ALTER TABLE trip_offers ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2)",
        "ALTER TABLE trip_offers ADD COLUMN IF NOT EXISTS reviews_count INTEGER DEFAULT 0",
        "ALTER TABLE trip_offers ADD COLUMN IF NOT EXISTS response_time_minutes INTEGER",
        "ALTER TABLE trip_bookings ADD COLUMN IF NOT EXISTS booking_code VARCHAR",
        "ALTER TABLE trip_bookings ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP",
        "ALTER TABLE trip_bookings ADD COLUMN IF NOT EXISTS trip_started_at TIMESTAMP",
        "ALTER TABLE trip_bookings ADD COLUMN IF NOT EXISTS trip_completed_at TIMESTAMP",
        "ALTER TABLE trip_bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP",
        "ALTER TABLE trip_bookings ADD COLUMN IF NOT EXISTS offer_snapshot TEXT",
        "ALTER TABLE trip_bookings ADD COLUMN IF NOT EXISTS agreement_snapshot TEXT",
        "ALTER TABLE trip_bookings ADD COLUMN IF NOT EXISTS terms_snapshot TEXT",
        "ALTER TABLE trip_bookings ADD COLUMN IF NOT EXISTS notes TEXT",
    ]
    table_ddl = [
        (
            "trip_booking_timeline_events",
            """
            CREATE TABLE IF NOT EXISTS trip_booking_timeline_events (
                id SERIAL PRIMARY KEY,
                booking_id INTEGER NOT NULL REFERENCES trip_bookings(id) ON DELETE CASCADE,
                event_type VARCHAR NOT NULL,
                actor_role VARCHAR,
                actor_user_id INTEGER REFERENCES users(id),
                note TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
            """,
        ),
        (
            "trip_booking_documents",
            """
            CREATE TABLE IF NOT EXISTS trip_booking_documents (
                id SERIAL PRIMARY KEY,
                booking_id INTEGER NOT NULL REFERENCES trip_bookings(id) ON DELETE CASCADE,
                uploader_user_id INTEGER NOT NULL REFERENCES users(id),
                document_type VARCHAR DEFAULT 'other',
                filename VARCHAR,
                file_url TEXT NOT NULL,
                status VARCHAR DEFAULT 'uploaded',
                note TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                viewed_at TIMESTAMP,
                reviewed_at TIMESTAMP
            )
            """,
        ),
        (
            "trip_booking_payments",
            """
            CREATE TABLE IF NOT EXISTS trip_booking_payments (
                id SERIAL PRIMARY KEY,
                booking_id INTEGER NOT NULL REFERENCES trip_bookings(id) ON DELETE CASCADE,
                status VARCHAR DEFAULT 'waiting_payment',
                payment_method VARCHAR,
                reference_number VARCHAR,
                amount NUMERIC(10,2),
                currency VARCHAR,
                payment_date TIMESTAMP,
                note TEXT,
                agency_confirmed_at TIMESTAMP,
                agency_confirmed_by_user_id INTEGER REFERENCES users(id),
                customer_confirmed_at TIMESTAMP,
                customer_confirmed_by_user_id INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT NOW()
            )
            """,
        ),
        (
            "trip_booking_checklist_items",
            """
            CREATE TABLE IF NOT EXISTS trip_booking_checklist_items (
                id SERIAL PRIMARY KEY,
                booking_id INTEGER NOT NULL REFERENCES trip_bookings(id) ON DELETE CASCADE,
                label VARCHAR NOT NULL,
                is_completed BOOLEAN DEFAULT FALSE,
                is_recommended BOOLEAN DEFAULT FALSE,
                sort_order INTEGER DEFAULT 0,
                completed_by_user_id INTEGER REFERENCES users(id),
                completed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW()
            )
            """,
        ),
        (
            "trip_booking_messages",
            """
            CREATE TABLE IF NOT EXISTS trip_booking_messages (
                id SERIAL PRIMARY KEY,
                booking_id INTEGER NOT NULL REFERENCES trip_bookings(id) ON DELETE CASCADE,
                sender_role VARCHAR NOT NULL,
                sender_user_id INTEGER NOT NULL REFERENCES users(id),
                content TEXT NOT NULL,
                attachment_url TEXT,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            )
            """,
        ),
        (
            "trip_booking_reviews",
            """
            CREATE TABLE IF NOT EXISTS trip_booking_reviews (
                id SERIAL PRIMARY KEY,
                booking_id INTEGER NOT NULL UNIQUE REFERENCES trip_bookings(id) ON DELETE CASCADE,
                trip_request_id INTEGER NOT NULL REFERENCES trip_requests(id),
                user_id INTEGER NOT NULL REFERENCES users(id),
                agency_id INTEGER NOT NULL REFERENCES agencies(id),
                rating INTEGER NOT NULL,
                comment TEXT,
                photos TEXT,
                trip_story TEXT,
                agency_response TEXT,
                agency_response_at TIMESTAMP,
                is_hidden BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            )
            """,
        ),
    ]
    try:
        with engine.begin() as conn:
            for stmt in ddl:
                conn.execute(text(stmt))
            for table_name, stmt in table_ddl:
                conn.execute(text(stmt))
            try:
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_trip_booking_timeline_events_booking_id_idx ON trip_booking_timeline_events(booking_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_trip_booking_timeline_events_created_at_idx ON trip_booking_timeline_events(created_at)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_trip_booking_documents_booking_id_idx ON trip_booking_documents(booking_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_trip_booking_documents_status_idx ON trip_booking_documents(status)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_trip_booking_payments_booking_id_idx ON trip_booking_payments(booking_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_trip_booking_payments_status_idx ON trip_booking_payments(status)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_trip_booking_checklist_items_booking_id_idx ON trip_booking_checklist_items(booking_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_trip_booking_checklist_items_completed_idx ON trip_booking_checklist_items(booking_id, is_completed)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_trip_booking_messages_booking_id_idx ON trip_booking_messages(booking_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_trip_booking_messages_created_at_idx ON trip_booking_messages(created_at)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_trip_booking_reviews_booking_id_idx ON trip_booking_reviews(booking_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_trip_booking_reviews_user_id_idx ON trip_booking_reviews(user_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_trip_booking_reviews_agency_id_idx ON trip_booking_reviews(agency_id)"))
            except Exception:
                pass
    except Exception:
        return

if _auto_schema:
    _ensure_columns()

def create_default_admin():
    logger = logging.getLogger(__name__)

    email = os.getenv("DEFAULT_ADMIN_EMAIL")
    password = os.getenv("DEFAULT_ADMIN_PASSWORD")
    full_name = os.getenv("DEFAULT_ADMIN_NAME", "Administrator")

    db: Session = SessionLocal()

    try:
        # In production an existing admin means bootstrap credentials are not required,
        # so startup may proceed without DEFAULT_ADMIN_EMAIL / DEFAULT_ADMIN_PASSWORD.
        if _is_prod and db.query(User).filter(User.role == UserRole.ADMIN).first():
            logger.info("An admin account already exists; skipping default admin creation.")
            return

        if not email or not password:
            if _is_prod:
                raise RuntimeError(
                    "DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD must be configured in production "
                    "so the first admin account can be created safely."
                )
            logger.warning("Default admin credentials are not configured.")
            return

        try:
            validate_strong_password(password)
        except ValueError as exc:
            if _is_prod:
                raise RuntimeError(
                    "DEFAULT_ADMIN_PASSWORD must be a strong password in production "
                    "(at least 8 characters including upper case, lower case and a number)."
                ) from exc
            logger.warning("Default admin password is too weak (%s); skipping default admin creation.", exc)
            return

        admin = (
            db.query(User)
            .filter(text("LOWER(email) = LOWER(:email)"))
            .params(email=email)
            .first()
        )

        if admin:
            logger.info("Default admin already exists.")
            return

        admin = User(
            email=email,
            hashed_password=get_password_hash(password),
            full_name=full_name,
            role=UserRole.ADMIN,
            is_verified=True,
            is_email_verified=True,
        )

        db.add(admin)
        db.commit()
        db.refresh(admin)

        logger.info("Default admin created.")

    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_default_admin()
    yield

app = FastAPI(title="TourPie - Travel Marketplace API", lifespan=lifespan,)

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


@app.get("/health", tags=["monitoring"])
async def health_check():
    return {
        "status": "ok",
        "service": "tourpie-api",
        "version": "1.7-rc1",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/ready", tags=["monitoring"])
async def readiness_check(db: Session = Depends(SessionLocal)):
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    finally:
        db.close()
    return {
        "status": "ok" if db_ok else "degraded",
        "checks": {
            "database": "ok" if db_ok else "error",
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
