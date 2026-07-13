from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import func
import datetime
import os

from . import auth, database, models

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/login")
oauth2_optional = OAuth2PasswordBearer(tokenUrl="users/login", auto_error=False)

def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(database.get_db),
) -> models.User:
    payload = auth.decode_access_token(token)
    if os.getenv("AUTH_DEBUG_USERS", "").strip() == "1":
        try:
            auth_header = request.headers.get("authorization")
            print("AUTH_HEADER:", auth_header)
        except Exception:
            print("AUTH_HEADER:", None)
        print("JWT_PAYLOAD:", payload)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    sub = str(payload["sub"]).strip().lower()
    user = db.query(models.User).filter(func.lower(models.User.email) == sub).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    session_id = str(payload.get("sid") or "").strip()
    if session_id:
        session = (
            db.query(models.UserSession)
            .filter(
                models.UserSession.user_id == user.id,
                models.UserSession.session_id == session_id,
                models.UserSession.revoked_at.is_(None),
            )
            .first()
        )
        if not session:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        expires_at = getattr(session, "expires_at", None)
        if expires_at:
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=datetime.timezone.utc)
            else:
                expires_at = expires_at.astimezone(datetime.timezone.utc)
            if datetime.datetime.now(datetime.timezone.utc) > expires_at:
                session.revoked_at = datetime.datetime.now(datetime.timezone.utc)
                db.commit()
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if getattr(user, "is_banned", False):
        banned_until = getattr(user, "banned_until", None)
        if not banned_until:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account restricted")
        if banned_until.tzinfo is None:
            banned_until = banned_until.replace(tzinfo=datetime.timezone.utc)
        if datetime.datetime.now(datetime.timezone.utc) < banned_until:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account restricted")
    return user

def get_optional_user(token: str | None = Depends(oauth2_optional), db: Session = Depends(database.get_db)) -> models.User | None:
    if not token:
        return None
    payload = auth.decode_access_token(token)
    if not payload or not payload.get("sub"):
        return None
    sub = str(payload["sub"]).strip().lower()
    user = db.query(models.User).filter(func.lower(models.User.email) == sub).first()
    return user

def get_token_payload(token: str = Depends(oauth2_scheme)) -> dict:
    payload = auth.decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return payload

def require_roles(*roles: str):
    def _dep(payload: dict = Depends(get_token_payload)) -> dict:
        role = payload.get("role")
        if role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return payload
    return _dep
