from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import users, packages, bookings, agencies, recommendations, favorites, messages, notifications, community, blog, moderation
from sqlalchemy import text

# Create database tables
Base.metadata.create_all(bind=engine)

def _ensure_columns():
    ddl = [
        "ALTER TABLE packages ADD COLUMN IF NOT EXISTS region VARCHAR",
        "ALTER TABLE packages ADD COLUMN IF NOT EXISTS package_type VARCHAR",
        "ALTER TABLE packages ADD COLUMN IF NOT EXISTS hotel_rating INTEGER",
        "ALTER TABLE packages ADD COLUMN IF NOT EXISTS transportation_type VARCHAR",
    ]
    try:
        with engine.begin() as conn:
            for stmt in ddl:
                conn.execute(text(stmt))
    except Exception:
        return

_ensure_columns()

app = FastAPI(title="TourPie - Travel Marketplace API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
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

@app.get("/")
async def root():
    return {"message": "Welcome to TourPie API"}
