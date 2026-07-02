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

def build_postgres_url() -> str:
    url = (os.getenv("DATABASE_URL") or "").strip()
    if url:
        return url
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
