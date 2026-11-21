from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import timedelta
from .. import models, schemas, database, auth
from datetime import datetime, timezone, timedelta as td
import base64
import json
import secrets
from typing import List, Optional
from urllib.parse import urlsplit
from ..deps import get_current_user, get_token_payload
import logging
import os

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/login")
# SVG is intentionally excluded: it is an active content type and would allow stored XSS.
SUPPORTED_AVATAR_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
AVATAR_MAGIC_PREFIXES = {
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/gif": (b"GIF87a", b"GIF89a"),
}
MAX_AVATAR_UPLOAD_BYTES = 2 * 1024 * 1024
MAX_AVATAR_URL_LENGTH = 2048

def _avatar_data_url_matches_type(mime_type: str, decoded: bytes) -> bool:
    if mime_type == "image/webp":
        return len(decoded) >= 12 and decoded[:4] == b"RIFF" and decoded[8:12] == b"WEBP"
    prefixes = AVATAR_MAGIC_PREFIXES.get(mime_type)
    return bool(prefixes) and any(decoded.startswith(prefix) for prefix in prefixes)

def _sanitize_avatar_url(value: Optional[str]) -> Optional[str]:
    raw = (value or "").strip()
    if not raw:
        return None
    if raw.startswith("data:"):
        header, _, encoded = raw.partition(",")
        if not header or not encoded:
            raise HTTPException(status_code=400, detail="Invalid avatar image")
        mime_type = header[5:].split(";", 1)[0].strip().lower()
        if mime_type not in SUPPORTED_AVATAR_MIME_TYPES:
            raise HTTPException(status_code=400, detail="Unsupported avatar image type")
        if ";base64" not in header.lower():
            raise HTTPException(status_code=400, detail="Invalid avatar image")
        try:
            decoded = base64.b64decode(encoded, validate=True)
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid avatar image") from exc
        if len(decoded) > MAX_AVATAR_UPLOAD_BYTES:
            raise HTTPException(status_code=400, detail="Avatar image is too large")
        if not _avatar_data_url_matches_type(mime_type, decoded):
            raise HTTPException(status_code=400, detail="Avatar image does not match its declared type")
        return raw
    if len(raw) > MAX_AVATAR_URL_LENGTH:
        raise HTTPException(status_code=400, detail="Avatar URL is too long")
    if any(ch.isspace() or ord(ch) < 0x20 for ch in raw):
        raise HTTPException(status_code=400, detail="Invalid avatar URL")
    if "://" in raw:
        parsed = urlsplit(raw)
        # Only https is accepted: plain http is downgradeable and unsafe to embed.
        if parsed.scheme.lower() != "https" or not parsed.netloc or "@" in parsed.netloc:
            raise HTTPException(status_code=400, detail="Avatar URL must use https")
        return raw
    raise HTTPException(status_code=400, detail="Invalid avatar URL")

def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()

def _normalize_lang(lang: Optional[str]) -> str:
    v = (lang or "").strip().lower()
    return v if v in ("en", "ru", "az", "tr") else "en"

def _normalize_currency(value: Optional[str]) -> Optional[str]:
    v = (value or "").strip().upper()
    return v if v in ("USD", "EUR", "AZN", "RUB", "TRY") else None

def _normalize_time_zone(value: Optional[str]) -> Optional[str]:
    v = (value or "").strip()
    return v[:120] if v else None

def _extract_client_ip(request: Request) -> Optional[str]:
    forwarded = (request.headers.get("x-forwarded-for") or "").strip()
    if forwarded:
        candidate = forwarded.split(",")[0].strip()
        return candidate[:120] if candidate else None
    client_host = getattr(request.client, "host", None)
    return str(client_host)[:120] if client_host else None

def _describe_client_device(user_agent: Optional[str]) -> str:
    ua = (user_agent or "").strip().lower()
    if not ua:
        return "Unknown device"

    if "iphone" in ua:
        device = "iPhone"
    elif "ipad" in ua:
        device = "iPad"
    elif "android" in ua:
        device = "Android device"
    elif "mac os x" in ua or "macintosh" in ua:
        device = "Mac"
    elif "windows" in ua:
        device = "Windows PC"
    elif "linux" in ua:
        device = "Linux device"
    else:
        device = "Desktop browser"

    if "edg" in ua:
        browser = "Edge"
    elif "chrome" in ua and "edg" not in ua:
        browser = "Chrome"
    elif "firefox" in ua:
        browser = "Firefox"
    elif "safari" in ua and "chrome" not in ua:
        browser = "Safari"
    else:
        browser = "Browser"

    return f"{browser} on {device}"

def _serialize_user_session(session: models.UserSession, current_session_id: Optional[str]) -> dict:
    return {
        "session_id": session.session_id,
        "auth_provider": session.auth_provider,
        "device_label": session.device_label,
        "user_agent": session.user_agent,
        "ip_address": session.ip_address,
        "created_at": session.created_at,
        "last_seen_at": session.last_seen_at,
        "expires_at": session.expires_at,
        "revoked_at": session.revoked_at,
        "is_current": bool(current_session_id and session.session_id == current_session_id),
    }

def _issue_access_token_for_user(
    *,
    db: Session,
    user: models.User,
    request: Request,
    existing_session_id: Optional[str] = None,
    remember_me: bool = False,
    expire_minutes: Optional[int] = None,
    session_provider: Optional[str] = None,
) -> schemas.AuthResponse:
    now = datetime.now(timezone.utc)
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    ttl_minutes = int(expire_minutes) if expire_minutes and int(expire_minutes) > 0 else auth.get_access_token_expire_minutes(role_value, remember_me=remember_me)
    expires_delta = timedelta(minutes=ttl_minutes)
    expires_at = now + expires_delta

    session: models.UserSession | None = None
    if existing_session_id:
        session = (
            db.query(models.UserSession)
            .filter(
                models.UserSession.user_id == user.id,
                models.UserSession.session_id == existing_session_id,
                models.UserSession.revoked_at.is_(None),
            )
            .first()
        )

    if not session:
        session = models.UserSession(
            session_id=secrets.token_urlsafe(18),
            user_id=user.id,
            created_at=now,
        )
        db.add(session)

    user_agent = (request.headers.get("user-agent") or "").strip() or None
    session.auth_provider = session_provider or (user.auth_provider or "email")
    session.device_label = _describe_client_device(user_agent)
    session.user_agent = user_agent[:500] if user_agent else None
    session.ip_address = _extract_client_ip(request)
    session.last_seen_at = now
    session.expires_at = expires_at
    session.revoked_at = None
    db.commit()
    db.refresh(session)

    token_payload: dict[str, object] = {"sub": user.email, "role": role_value, "sid": session.session_id, "remember_me": remember_me}
    if role_value == "agency":
        latest_app = (
            db.query(models.AgencyApplication)
            .filter(models.AgencyApplication.user_id == user.id)
            .order_by(models.AgencyApplication.submitted_at.desc())
            .first()
        )
        token_payload["agency_id"] = user.agency_id
        if latest_app and hasattr(latest_app.status, "value"):
            token_payload["agency_status"] = latest_app.status.value
        else:
            token_payload["agency_status"] = "approved" if user.agency_id else None

    access_token = auth.create_access_token(data=token_payload, expires_delta=expires_delta)
    return {"access_token": access_token, "token_type": "bearer"}

def _frontend_base_url() -> str:
    return (os.getenv("FRONTEND_BASE_URL") or os.getenv("NEXT_PUBLIC_SITE_URL") or "http://127.0.0.1:3000").strip().rstrip("/")

def _build_frontend_url(path: str, params: dict[str, str]) -> str:
    base = _frontend_base_url()
    from urllib.parse import urlencode

    query = urlencode(params)
    return f"{base}{path}{f'?{query}' if query else ''}"

def _generate_email_link_token() -> str:
    return secrets.token_urlsafe(32)

def _find_user_by_hashed_token(
    db: Session,
    *,
    hash_attr: str,
    expires_attr: str,
    token: str,
) -> models.User | None:
    now = datetime.now(timezone.utc)
    hash_col = getattr(models.User, hash_attr, None)
    exp_col = getattr(models.User, expires_attr, None)
    query = db.query(models.User)
    if hash_col is not None:
        query = query.filter(hash_col.isnot(None))
    if exp_col is not None:
        query = query.filter(exp_col.isnot(None), exp_col >= now)
    rows = query.all()
    for row in rows:
        token_hash = getattr(row, hash_attr, None)
        if not token_hash:
            continue
        expires_at = _as_utc(getattr(row, expires_attr, None))
        if not expires_at or now > expires_at:
            continue
        try:
            if auth.verify_password(token, token_hash):
                return row
        except Exception:
            continue
    return None

OTP_EXPIRE_MINUTES = int(os.getenv("OTP_EXPIRE_MINUTES", "5"))
OTP_RESEND_COOLDOWN_SECONDS = int(os.getenv("OTP_RESEND_COOLDOWN_SECONDS", "60"))
EMAIL_VERIFICATION_LINK_EXPIRE_HOURS = int(os.getenv("EMAIL_VERIFICATION_LINK_EXPIRE_HOURS", "24"))
EMAIL_CHANGE_LINK_EXPIRE_HOURS = int(os.getenv("EMAIL_CHANGE_LINK_EXPIRE_HOURS", "24"))
# Admin impersonation tokens are deliberately short lived and configurable.
IMPERSONATION_TOKEN_EXPIRE_MINUTES = max(1, int(os.getenv("IMPERSONATION_TOKEN_EXPIRE_MINUTES", "15")))

def _parse_remember_me(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    text = str(value or "").strip().lower()
    return text in ("1", "true", "yes", "on")

def _normalize_phone(phone: str) -> str:
    raw = (phone or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Phone number is required")
    cleaned = "".join(ch for ch in raw if ch.isdigit() or ch == "+")
    if not cleaned.startswith("+"):
        raise HTTPException(status_code=400, detail="Invalid phone number")
    digits = cleaned[1:]
    if not digits.isdigit() or len(digits) < 8 or len(digits) > 15:
        raise HTTPException(status_code=400, detail="Invalid phone number")
    return f"+{digits}"

def _as_utc(dt_value: datetime | None) -> datetime | None:
    if not dt_value:
        return None
    if dt_value.tzinfo is None:
        return dt_value.replace(tzinfo=timezone.utc)
    return dt_value.astimezone(timezone.utc)

def _consume_rate_limit(
    *,
    now: datetime,
    window_start: datetime | None,
    count: int | None,
    window_seconds: int,
    max_count: int,
    error_detail: str,
    email: str | None = None,
) -> tuple[datetime, int]:
    start = _as_utc(window_start)
    c = int(count or 0)
    if start and start > now:
        start = now
        c = 0
    if not start or (now - start).total_seconds() >= window_seconds:
        start = now
        c = 0
    if c >= max_count:
        raise HTTPException(status_code=429, detail=error_detail)
    return start, c + 1


# --- Brute-force protection for authentication endpoints --------------------
# Failed attempts are tracked per account identity and per client IP, reusing the
# window semantics of _consume_rate_limit (see above). Counters are temporary and
# are cleared for the account as soon as authentication succeeds.
AUTH_ATTEMPT_WINDOW_SECONDS = int(os.getenv("AUTH_ATTEMPT_WINDOW_SECONDS", str(15 * 60)))
AUTH_MAX_FAILED_PER_ACCOUNT = int(os.getenv("AUTH_MAX_FAILED_PER_ACCOUNT", "5"))
AUTH_MAX_FAILED_PER_IP = int(os.getenv("AUTH_MAX_FAILED_PER_IP", "20"))
AUTH_LOCKOUT_SECONDS = int(os.getenv("AUTH_LOCKOUT_SECONDS", "60"))
AUTH_LOCKOUT_MAX_SECONDS = int(os.getenv("AUTH_LOCKOUT_MAX_SECONDS", str(15 * 60)))
AUTH_ATTEMPT_DETAIL = "Too many attempts. Please try again later."
_AUTH_ATTEMPT_MAX_TRACKED_KEYS = 2000

_attempt_windows: dict[str, tuple[datetime, int]] = {}
_attempt_lockouts: dict[str, datetime] = {}
_attempt_strikes: dict[str, int] = {}


def _attempt_account_key(scope: str, identity: str | None) -> str:
    return f"{scope}:account:{(identity or '-').strip().lower()}"


def _attempt_ip_key(scope: str, request: Request | None) -> str | None:
    client_ip = _extract_client_ip(request) if request is not None else None
    return f"{scope}:ip:{client_ip}" if client_ip else None


def _prune_attempt_state(now: datetime) -> None:
    if len(_attempt_windows) <= _AUTH_ATTEMPT_MAX_TRACKED_KEYS:
        return
    for key, (start, _count) in list(_attempt_windows.items()):
        if (now - start).total_seconds() >= AUTH_ATTEMPT_WINDOW_SECONDS * 2:
            _attempt_windows.pop(key, None)
            _attempt_lockouts.pop(key, None)
            _attempt_strikes.pop(key, None)


def _enforce_auth_attempt_limit(
    *,
    scope: str,
    identity: str | None,
    request: Request | None = None,
    error_detail: str = AUTH_ATTEMPT_DETAIL,
) -> None:
    """Reject a temporarily locked-out account or client IP with HTTP 429."""
    now = datetime.now(timezone.utc)
    retry_after = 0
    for key in (_attempt_account_key(scope, identity), _attempt_ip_key(scope, request)):
        if not key:
            continue
        locked_until = _attempt_lockouts.get(key)
        if locked_until and locked_until > now:
            retry_after = max(retry_after, int((locked_until - now).total_seconds()) + 1)
    if retry_after > 0:
        raise HTTPException(status_code=429, detail=error_detail, headers={"Retry-After": str(retry_after)})


def _record_auth_failure(
    *,
    scope: str,
    identity: str | None,
    request: Request | None = None,
    max_per_account: int = AUTH_MAX_FAILED_PER_ACCOUNT,
    max_per_ip: int = AUTH_MAX_FAILED_PER_IP,
    error_detail: str = AUTH_ATTEMPT_DETAIL,
) -> None:
    """Count one failed attempt; raise HTTP 429 with a temporary lockout once exceeded."""
    now = datetime.now(timezone.utc)
    _prune_attempt_state(now)
    tracked: list[tuple[str, int]] = [(_attempt_account_key(scope, identity), max_per_account)]
    ip_key = _attempt_ip_key(scope, request)
    if ip_key:
        tracked.append((ip_key, max_per_ip))
    for key, limit in tracked:
        window_start, count = _attempt_windows.get(key, (None, 0))
        try:
            new_start, new_count = _consume_rate_limit(
                now=now,
                window_start=window_start,
                count=count,
                window_seconds=AUTH_ATTEMPT_WINDOW_SECONDS,
                max_count=max(1, limit),
                error_detail=error_detail,
            )
        except HTTPException:
            strikes = _attempt_strikes.get(key, 0) + 1
            _attempt_strikes[key] = strikes
            lock_seconds = min(AUTH_LOCKOUT_SECONDS * (2 ** (strikes - 1)), AUTH_LOCKOUT_MAX_SECONDS)
            _attempt_lockouts[key] = now + td(seconds=lock_seconds)
            _attempt_windows[key] = (now, max(1, limit))
            raise HTTPException(status_code=429, detail=error_detail, headers={"Retry-After": str(lock_seconds)})
        _attempt_windows[key] = (new_start, new_count)


def _clear_auth_failures(scope: str, identity: str | None) -> None:
    """Forget the account's failed attempts after a successful authentication."""
    key = _attempt_account_key(scope, identity)
    _attempt_windows.pop(key, None)
    _attempt_lockouts.pop(key, None)
    _attempt_strikes.pop(key, None)

def _verification_email(lang: str, code: str, minutes: int, link: str | None = None) -> tuple[str, str]:
    link_line = f"\nVerify instantly: {link}\n" if link else "\n"
    if lang == "ru":
        return (
            "Подтверждение email — TourPie",
            f"Ваш код подтверждения: {code}\nСрок действия: {minutes} мин.{link_line}\nЕсли вы не создавали аккаунт, просто проигнорируйте это письмо.",
        )
    if lang == "az":
        return (
            "Email təsdiqi — TourPie",
            f"Təsdiq kodunuz: {code}\nEtibarlılıq müddəti: {minutes} dəq.{link_line}\nƏgər siz hesab yaratmamısınızsa, bu məktubu nəzərə almayın.",
        )
    if lang == "tr":
        return (
            "E‑posta doğrulama — TourPie",
            f"Doğrulama kodunuz: {code}\nGeçerlilik süresi: {minutes} dk.{link_line}\nBu hesabı siz oluşturmadıysanız bu e-postayı yok sayın.",
        )
    return (
        "Verify your email — TourPie",
        f"Your verification code: {code}\nExpires in: {minutes} minutes.{link_line}\nIf you didn’t create an account, you can ignore this email.",
    )

def _email_change_email(lang: str, new_email: str, link: str, hours: int) -> tuple[str, str]:
    if lang == "ru":
        return (
            "Подтвердите новый email — TourPie",
            f"Мы получили запрос на смену email для вашего аккаунта TourPie.\nНовый email: {new_email}\nПодтвердить: {link}\nСсылка действует {hours} ч.",
        )
    if lang == "az":
        return (
            "Yeni emaili təsdiqləyin — TourPie",
            f"TourPie hesabınız üçün email dəyişmə sorğusu aldıq.\nYeni email: {new_email}\nTəsdiq edin: {link}\nKeçid {hours} saat etibarlıdır.",
        )
    if lang == "tr":
        return (
            "Yeni e-postayı doğrulayın — TourPie",
            f"TourPie hesabınız için bir e-posta değişikliği isteği aldık.\nYeni e-posta: {new_email}\nDoğrula: {link}\nBağlantı {hours} saat geçerlidir.",
        )
    return (
        "Confirm your new email — TourPie",
        f"We received a request to update your TourPie account email.\nNew email: {new_email}\nConfirm here: {link}\nThis link expires in {hours} hours.",
    )

def _email_change_notice_old_email(lang: str, new_email: str) -> tuple[str, str]:
    if lang == "ru":
        return ("Email обновляется — TourPie", f"Для вашего аккаунта запросили смену email на {new_email}. Если это были не вы, смените пароль.")
    if lang == "az":
        return ("Email yenilənir — TourPie", f"Hesabınız üçün {new_email} ünvanına email dəyişmə sorğusu edildi. Bu siz deyilsinizsə, şifrənizi dəyişin.")
    if lang == "tr":
        return ("E-posta güncelleniyor — TourPie", f"Hesabınız için {new_email} adresine e-posta değişikliği istendi. Bu siz değilseniz şifrenizi değiştirin.")
    return ("Your email is being updated — TourPie", f"A request was made to change your account email to {new_email}. If this was not you, change your password.")

def _password_reset_email(lang: str, code: str, minutes: int) -> tuple[str, str]:
    if lang == "ru":
        return (
            "Сброс пароля — TourPie",
            f"Ваш код для сброса пароля: {code}\nСрок действия: {minutes} мин.\n\nЕсли вы не запрашивали сброс, проигнорируйте это письмо.",
        )
    if lang == "az":
        return (
            "Şifrə sıfırlama — TourPie",
            f"Şifrə sıfırlama kodunuz: {code}\nEtibarlılıq müddəti: {minutes} dəq.\n\nƏgər siz bunu istəməmisinizsə, bu məktubu nəzərə almayın.",
        )
    if lang == "tr":
        return (
            "Şifre sıfırlama — TourPie",
            f"Şifre sıfırlama kodunuz: {code}\nGeçerlilik süresi: {minutes} dk.\n\nBu isteği siz yapmadıysanız bu e-postayı yok sayın.",
        )
    return (
        "Reset your password — TourPie",
        f"Your password reset code: {code}\nExpires in: {minutes} minutes.\n\nIf you didn’t request this, you can ignore this email.",
    )

def _admin_2fa_email(lang: str, code: str, minutes: int) -> tuple[str, str]:
    if lang == "ru":
        return (
            "Код безопасности (админ) — TourPie",
            f"Ваш код безопасности: {code}\nСрок действия: {minutes} мин.\n\nЕсли это не вы, смените пароль администратора и свяжитесь с поддержкой.",
        )
    if lang == "az":
        return (
            "Təhlükəsizlik kodu (Admin) — TourPie",
            f"Təhlükəsizlik kodunuz: {code}\nEtibarlılıq müddəti: {minutes} dəq.\n\nƏgər bu siz deyilsinizsə, admin şifrənizi dəyişin və dəstəyə yazın.",
        )
    if lang == "tr":
        return (
            "Güvenlik kodu (Admin) — TourPie",
            f"Güvenlik kodunuz: {code}\nGeçerlilik süresi: {minutes} dk.\n\nBu siz değilseniz, admin şifrenizi değiştirin ve destek ile iletişime geçin.",
        )
    return (
        "Security code (Admin) — TourPie",
        f"Your security code: {code}\nExpires in: {minutes} minutes.\n\nIf this wasn’t you, change your admin password and contact support.",
    )

def _phone_verification_sms(lang: str, code: str, minutes: int) -> str:
    brand = getattr(auth, "BRAND_NAME", "TourPie")
    if lang == "ru":
        return f"{brand}: код подтверждения телефона {code}. Действует {minutes} мин."
    if lang == "az":
        return f"{brand}: telefon təsdiq kodu {code}. {minutes} dəq etibarlıdır."
    if lang == "tr":
        return f"{brand}: telefon doğrulama kodu {code}. {minutes} dk geçerli."
    return f"{brand}: your phone verification code is {code}. Expires in {minutes} minutes."

def _password_reset_sms(lang: str, code: str, minutes: int) -> str:
    brand = getattr(auth, "BRAND_NAME", "TourPie")
    if lang == "ru":
        return f"{brand}: код для сброса пароля {code}. Действует {minutes} мин."
    if lang == "az":
        return f"{brand}: şifrə sıfırlama kodu {code}. {minutes} dəq etibarlıdır."
    if lang == "tr":
        return f"{brand}: şifre sıfırlama kodu {code}. {minutes} dk geçerli."
    return f"{brand}: your password reset code is {code}. Expires in {minutes} minutes."

def _record_delivery(
    db: Session,
    user_id: int | None,
    channel: str,
    purpose: str,
    recipient: str,
    status_value: str,
    provider: str | None = None,
    error: str | None = None,
) -> None:
    try:
        row = models.AuthDeliveryLog(
            user_id=user_id,
            channel=channel,
            purpose=purpose,
            recipient=recipient,
            provider=provider,
            status=status_value,
            error=error,
        )
        db.add(row)
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            return

def _send_email_or_raise(db: Session, user_id: int | None, purpose: str, to_email: str, subject: str, body: str) -> None:
    try:
        meta = auth.send_email_with_meta(to_email, subject, body)
        _record_delivery(db, user_id, "email", purpose, to_email, "sent", meta.get("provider"))
    except Exception as e:
        logging.getLogger(__name__).exception("Email send failed: %s", str(e))
        _record_delivery(db, user_id, "email", purpose, to_email, "failed", None, str(e))
        raise HTTPException(status_code=503, detail="Email service is unavailable")

def _send_sms_or_raise(db: Session, user_id: int | None, purpose: str, to_phone: str, body: str) -> None:
    try:
        auth.send_sms(to_phone, body)
        _record_delivery(db, user_id, "sms", purpose, to_phone, "sent", "twilio" if getattr(auth, "TWILIO_ACCOUNT_SID", None) else "debug")
    except Exception as e:
        logging.getLogger(__name__).exception("SMS send failed: %s", str(e))
        _record_delivery(db, user_id, "sms", purpose, to_phone, "failed", None, str(e))
        raise HTTPException(status_code=503, detail="SMS service is unavailable")

@router.post("/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    email = _normalize_email(str(user.email))
    db_user = db.query(models.User).filter(models.User.email == email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    phone_input = str(getattr(user, "phone_number", "") or "").strip()
    phone = _normalize_phone(phone_input) if phone_input else None
    if phone:
        existing_phone = db.query(models.User).filter(models.User.phone_number == phone).first()
        if existing_phone:
            raise HTTPException(status_code=400, detail="Phone number already registered")
    
    try:
        auth.validate_strong_password(user.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    hashed_password = auth.get_password_hash(user.password)
    lang = _normalize_lang(getattr(user, "language", None))
    email_code = auth.generate_otp_code(6)
    email_link_token = _generate_email_link_token()
    phone_code = auth.generate_otp_code(6)
    now = datetime.now(timezone.utc)
    expires_minutes = max(1, OTP_EXPIRE_MINUTES)
    verification_expires_at = now + td(minutes=expires_minutes)
    verification_link_expires_at = now + td(hours=max(1, EMAIL_VERIFICATION_LINK_EXPIRE_HOURS))
    new_user = models.User(
        email=email,
        full_name=user.full_name,
        hashed_password=hashed_password,
        role=models.UserRole.USER,
        phone_number=phone,
        country=user.country,
        is_verified=False,
        is_email_verified=False,
        is_phone_verified=not bool(phone),
        onboarding_completed=False,
        verification_code=email_code if getattr(auth, "AUTH_DEBUG_OTP", False) else None,
        verification_code_hash=auth.get_password_hash(email_code),
        verification_expires_at=verification_expires_at,
        email_verification_token_hash=auth.get_password_hash(email_link_token),
        email_verification_token_expires_at=verification_link_expires_at,
        verification_sent_at=now,
        verification_rate_window_start=now,
        verification_rate_count=1,
        phone_verification_code_hash=auth.get_password_hash(phone_code) if phone else None,
        phone_verification_expires_at=verification_expires_at if phone else None,
        phone_verification_sent_at=now if phone else None,
        phone_verification_rate_window_start=now if phone else None,
        phone_verification_rate_count=1 if phone else 0,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    verify_link = _build_frontend_url("/auth/email-action", {"mode": "verify-email", "token": email_link_token})
    subject, body_text = _verification_email(lang, email_code, expires_minutes, verify_link)
    _send_email_or_raise(db, new_user.id, "register_verify_email", email, subject, body_text)
    if phone:
        _send_sms_or_raise(db, new_user.id, "register_verify_phone", phone, _phone_verification_sms(lang, phone_code, expires_minutes))
    return new_user

@router.get("", response_model=List[schemas.User])
@router.get("/", response_model=List[schemas.User])
def list_users(
    request: Request,
    skip: int = 0,
    limit: int = 200,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    role_value = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    if role_value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    users = db.query(models.User).order_by(models.User.created_at.desc()).offset(skip).limit(limit).all()
    return users

@router.get("/count", response_model=dict)
def count_users(current_user: models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    role_value = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    if role_value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    total = db.query(models.User).count()
    return {"total": total}

@router.get("/admin/overview", response_model=schemas.AdminUserOverview)
def admin_user_overview(current_user: models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    role_value = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    if role_value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    now = datetime.now(timezone.utc)
    week_ago = now - td(days=7)
    total_users = db.query(models.User).count()
    verified_users = db.query(models.User).filter(models.User.is_verified.is_(True)).count()
    new_registrations_7d = db.query(models.User).filter(models.User.created_at >= week_ago).count()
    recent_users = db.query(models.User).order_by(models.User.created_at.desc()).limit(6).all()
    return {
        "total_users": int(total_users),
        "verified_users": int(verified_users),
        "new_registrations_7d": int(new_registrations_7d),
        "recent_users": recent_users,
    }

@router.patch("/{user_id}", response_model=schemas.User)
def admin_update_user(
    user_id: int,
    body: schemas.UserAdminUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    role_value = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    if role_value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    data = body.model_dump(exclude_unset=True)
    if "role" in data and data["role"] is not None:
        user.role = data["role"]
    if "is_verified" in data and data["is_verified"] is not None:
        user.is_verified = bool(data["is_verified"])
        if bool(data["is_verified"]):
            user.is_email_verified = True
            user.is_phone_verified = True
    if "is_email_verified" in data and data["is_email_verified"] is not None:
        user.is_email_verified = bool(data["is_email_verified"])
    if "is_phone_verified" in data and data["is_phone_verified"] is not None:
        user.is_phone_verified = bool(data["is_phone_verified"])
    if "onboarding_completed" in data and data["onboarding_completed"] is not None:
        user.onboarding_completed = bool(data["onboarding_completed"])
    if "agency_id" in data:
        user.agency_id = data["agency_id"]
    if "full_name" in data:
        user.full_name = data["full_name"]

    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value != "admin":
        user.is_verified = bool(getattr(user, "is_email_verified", False) and getattr(user, "is_phone_verified", False))

    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}", response_model=dict)
def admin_delete_user(
    user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    role_value = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    if role_value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    target_role = user.role.value if hasattr(user.role, "value") else user.role
    if target_role == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete admin")

    base_email = f"deleted+{user_id}@example.invalid"
    new_email = base_email
    suffix = 0
    while db.query(models.User).filter(func.lower(models.User.email) == new_email.lower()).first():
        suffix += 1
        new_email = f"deleted+{user_id}-{suffix}@example.invalid"

    user.email = new_email
    user.full_name = None
    user.phone_number = None
    user.country = None
    user.preferred_destinations = None
    user.budget_range = None
    user.travel_style = None
    user.interests = None
    user.onboarding_completed = False
    user.is_verified = False
    user.is_email_verified = False
    user.is_phone_verified = False
    user.hashed_password = auth.get_password_hash(secrets.token_urlsafe(18))
    user.is_banned = True
    user.banned_until = None
    user.banned_reason = "deleted"
    db.commit()
    return {"message": "deleted"}

@router.post("/admin/create", response_model=schemas.User)
def admin_create_admin(
    body: schemas.AdminCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    role_value = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    if role_value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    email = body.email.strip().lower()
    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = auth.get_password_hash(body.password)
    user = models.User(
        email=email,
        full_name=body.full_name,
        hashed_password=hashed_password,
        role=models.UserRole.ADMIN,
        phone_number=None,
        country=None,
        is_verified=True,
        is_email_verified=True,
        is_phone_verified=True,
        onboarding_completed=True,
        verification_code=None,
        verification_expires_at=None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post("/verify-email", response_model=schemas.User)
def verify_email(request: Request, payload: schemas.UserVerifyEmail, db: Session = Depends(database.get_db)):
    email = _normalize_email(str(payload.email))
    _enforce_auth_attempt_limit(scope="verify-email", identity=email, request=request)
    db_user = db.query(models.User).filter(func.lower(models.User.email) == email).first()
    if not db_user:
        # Same response for unknown accounts to avoid account enumeration.
        _record_auth_failure(scope="verify-email", identity=email, request=request)
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")

    if getattr(db_user, "is_email_verified", False):
        return db_user

    if not db_user.verification_code_hash or not db_user.verification_expires_at:
        _record_auth_failure(scope="verify-email", identity=email, request=request)
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")

    expires_at = _as_utc(db_user.verification_expires_at)
    if not expires_at or datetime.now(timezone.utc) > expires_at:
        _record_auth_failure(scope="verify-email", identity=email, request=request)
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")

    if not auth.verify_password(payload.code.strip(), db_user.verification_code_hash):
        _record_auth_failure(scope="verify-email", identity=email, request=request)
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")

    db_user.is_email_verified = True
    db_user.verification_code = None
    db_user.verification_code_hash = None
    db_user.verification_expires_at = None
    db_user.email_verification_token_hash = None
    db_user.email_verification_token_expires_at = None
    role_value = db_user.role.value if hasattr(db_user.role, "value") else db_user.role
    if role_value == "user" or getattr(db_user, "is_phone_verified", False):
        db_user.is_verified = True
    db.commit()
    db.refresh(db_user)
    _clear_auth_failures("verify-email", email)
    return db_user

@router.post("/request-verification")
def request_verification(payload: schemas.UserRequestVerification, db: Session = Depends(database.get_db)):
    email = _normalize_email(str(payload.email))
    db_user = db.query(models.User).filter(func.lower(models.User.email) == email).first()
    if not db_user:
        return {"message": "Verification code sent"}
    if getattr(db_user, "is_email_verified", False):
        return {"message": "Already verified"}
    now = datetime.now(timezone.utc)
    sent_at = _as_utc(getattr(db_user, "verification_sent_at", None))
    cooldown_seconds = max(1, OTP_RESEND_COOLDOWN_SECONDS)
    delta_seconds = (now - sent_at).total_seconds() if sent_at else None
    if sent_at and delta_seconds is not None and 0 <= delta_seconds < cooldown_seconds:
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a moment.")

    window_start, window_count = _consume_rate_limit(
        now=now,
        window_start=getattr(db_user, "verification_rate_window_start", None),
        count=getattr(db_user, "verification_rate_count", 0),
        window_seconds=60 * 60,
        max_count=5,
        error_detail="Too many verification requests. Please try again later.",
        email=email,
    )
    code = auth.generate_otp_code(6)
    link_token = _generate_email_link_token()
    expires_minutes = max(1, OTP_EXPIRE_MINUTES)
    verification_link_expires_at = now + td(hours=max(1, EMAIL_VERIFICATION_LINK_EXPIRE_HOURS))
    db_user.verification_code = code if getattr(auth, "AUTH_DEBUG_OTP", False) else None
    db_user.verification_code_hash = auth.get_password_hash(code)
    db_user.verification_expires_at = now + td(minutes=expires_minutes)
    db_user.email_verification_token_hash = auth.get_password_hash(link_token)
    db_user.email_verification_token_expires_at = verification_link_expires_at
    db_user.verification_sent_at = now
    db_user.verification_rate_window_start = window_start
    db_user.verification_rate_count = window_count
    db.commit()
    lang = _normalize_lang(getattr(payload, "language", None))
    verify_link = _build_frontend_url("/auth/email-action", {"mode": "verify-email", "token": link_token})
    subject, body_text = _verification_email(lang, code, expires_minutes, verify_link)
    _send_email_or_raise(db, db_user.id, "request_verify_email", email, subject, body_text)
    return {"message": "Verification code sent"}

@router.post("/verify-phone", response_model=schemas.User)
def verify_phone(request: Request, payload: schemas.UserVerifyPhone, db: Session = Depends(database.get_db)):
    email = _normalize_email(str(payload.email))
    _enforce_auth_attempt_limit(scope="verify-phone", identity=email, request=request)
    user = db.query(models.User).filter(func.lower(models.User.email) == email).first()
    if not user:
        # Same response for unknown accounts to avoid account enumeration.
        _record_auth_failure(scope="verify-phone", identity=email, request=request)
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")
    if getattr(user, "is_phone_verified", False):
        return user
    if not getattr(user, "phone_verification_code_hash", None) or not getattr(user, "phone_verification_expires_at", None):
        _record_auth_failure(scope="verify-phone", identity=email, request=request)
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")
    expires_at = _as_utc(getattr(user, "phone_verification_expires_at", None))
    if not expires_at or datetime.now(timezone.utc) > expires_at:
        _record_auth_failure(scope="verify-phone", identity=email, request=request)
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")
    if not auth.verify_password(payload.code.strip(), getattr(user, "phone_verification_code_hash", "")):
        _record_auth_failure(scope="verify-phone", identity=email, request=request)
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")
    user.is_phone_verified = True
    user.phone_verification_code_hash = None
    user.phone_verification_expires_at = None
    if getattr(user, "is_email_verified", False):
        user.is_verified = True
    db.commit()
    db.refresh(user)
    _clear_auth_failures("verify-phone", email)
    return user

@router.post("/request-phone-verification")
def request_phone_verification(payload: schemas.UserRequestPhoneVerification, db: Session = Depends(database.get_db)):
    email = _normalize_email(str(payload.email))
    user = db.query(models.User).filter(func.lower(models.User.email) == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if getattr(user, "is_phone_verified", False):
        return {"message": "Already verified"}
    phone = getattr(user, "phone_number", None)
    if not phone:
        raise HTTPException(status_code=400, detail="Phone number is required")
    now = datetime.now(timezone.utc)
    sent_at = _as_utc(getattr(user, "phone_verification_sent_at", None))
    cooldown_seconds = max(1, OTP_RESEND_COOLDOWN_SECONDS)
    delta_seconds = (now - sent_at).total_seconds() if sent_at else None
    if sent_at and delta_seconds is not None and 0 <= delta_seconds < cooldown_seconds:
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a moment.")
    window_start, window_count = _consume_rate_limit(
        now=now,
        window_start=getattr(user, "phone_verification_rate_window_start", None),
        count=getattr(user, "phone_verification_rate_count", 0),
        window_seconds=60 * 60,
        max_count=5,
        error_detail="Too many verification requests. Please try again later.",
        email=email,
    )
    code = auth.generate_otp_code(6)
    expires_minutes = max(1, OTP_EXPIRE_MINUTES)
    user.phone_verification_code_hash = auth.get_password_hash(code)
    user.phone_verification_expires_at = now + td(minutes=expires_minutes)
    user.phone_verification_sent_at = now
    user.phone_verification_rate_window_start = window_start
    user.phone_verification_rate_count = window_count
    db.commit()
    lang = _normalize_lang(getattr(payload, "language", None))
    _send_sms_or_raise(db, user.id, "request_verify_phone", str(phone), _phone_verification_sms(lang, code, expires_minutes))
    return {"message": "Verification code sent"}

@router.get("/me", response_model=schemas.User)
def me(
    current_user: models.User = Depends(get_current_user),
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(database.get_db),
):
    session_id = str(payload.get("sid") or "").strip()
    if session_id:
        session = (
            db.query(models.UserSession)
            .filter(
                models.UserSession.user_id == current_user.id,
                models.UserSession.session_id == session_id,
                models.UserSession.revoked_at.is_(None),
            )
            .first()
        )
        if session:
            session.last_seen_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(current_user)
    return current_user

@router.patch("/me/profile", response_model=schemas.User)
def update_my_profile(
    body: schemas.UserProfileUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    data = body.model_dump(exclude_unset=True)
    if "full_name" in data:
        value = (data.get("full_name") or "").strip()
        user.full_name = value[:120] if value else None
    if "phone_number" in data:
        phone_raw = (data.get("phone_number") or "").strip()
        if phone_raw:
            normalized_phone = _normalize_phone(phone_raw)
            existing_phone = (
                db.query(models.User)
                .filter(models.User.phone_number == normalized_phone, models.User.id != user.id)
                .first()
            )
            if existing_phone:
                raise HTTPException(status_code=400, detail="Phone number already registered")
            user.phone_number = normalized_phone
        else:
            user.phone_number = None
    if "country" in data:
        country = (data.get("country") or "").strip()
        user.country = country[:120] if country else None
    if "preferred_language" in data:
        user.preferred_language = _normalize_lang(data.get("preferred_language"))
    if "preferred_currency" in data:
        user.preferred_currency = _normalize_currency(data.get("preferred_currency"))
    if "time_zone" in data:
        user.time_zone = _normalize_time_zone(data.get("time_zone"))
    if "avatar_url" in data:
        user.avatar_url = _sanitize_avatar_url(data.get("avatar_url"))

    db.commit()
    db.refresh(user)
    return user

@router.get("/me/sessions", response_model=List[schemas.UserSession])
def list_my_sessions(
    current_user: models.User = Depends(get_current_user),
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(database.get_db),
):
    current_session_id = str(payload.get("sid") or "").strip() or None
    now = datetime.now(timezone.utc)
    sessions = (
        db.query(models.UserSession)
        .filter(models.UserSession.user_id == current_user.id, models.UserSession.revoked_at.is_(None))
        .order_by(models.UserSession.last_seen_at.desc(), models.UserSession.created_at.desc())
        .all()
    )
    for session in sessions:
        expires_at = _as_utc(session.expires_at)
        if expires_at and expires_at < now:
            session.revoked_at = now
    db.commit()
    sessions = (
        db.query(models.UserSession)
        .filter(models.UserSession.user_id == current_user.id, models.UserSession.revoked_at.is_(None))
        .order_by(models.UserSession.last_seen_at.desc(), models.UserSession.created_at.desc())
        .all()
    )
    return [_serialize_user_session(session, current_session_id) for session in sessions]

@router.delete("/me/sessions/{session_id}", response_model=dict)
def revoke_my_session(
    session_id: str,
    current_user: models.User = Depends(get_current_user),
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(database.get_db),
):
    session = (
        db.query(models.UserSession)
        .filter(
            models.UserSession.user_id == current_user.id,
            models.UserSession.session_id == session_id,
            models.UserSession.revoked_at.is_(None),
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.revoked_at = datetime.now(timezone.utc)
    db.commit()
    current_session_id = str(payload.get("sid") or "").strip()
    return {"message": "Session revoked", "revoked_current": bool(current_session_id and current_session_id == session_id)}

@router.post("/me/sessions/revoke-others", response_model=dict)
def revoke_other_sessions(
    current_user: models.User = Depends(get_current_user),
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(database.get_db),
):
    current_session_id = str(payload.get("sid") or "").strip()
    if not current_session_id:
        return {"message": "No active session to preserve", "revoked": 0}

    now = datetime.now(timezone.utc)
    sessions = (
        db.query(models.UserSession)
        .filter(
            models.UserSession.user_id == current_user.id,
            models.UserSession.revoked_at.is_(None),
            models.UserSession.session_id != current_session_id,
        )
        .all()
    )
    revoked = 0
    for session in sessions:
        session.revoked_at = now
        revoked += 1
    db.commit()
    return {"message": "Other sessions revoked", "revoked": revoked}

@router.get("/verify-email-link", response_model=schemas.User)
def verify_email_link(token: str = Query(..., min_length=12), db: Session = Depends(database.get_db)):
    user = _find_user_by_hashed_token(
        db,
        hash_attr="email_verification_token_hash",
        expires_attr="email_verification_token_expires_at",
        token=token,
    )
    if not user:
        raise HTTPException(status_code=400, detail="Verification link is invalid or expired")

    user.is_email_verified = True
    user.verification_code = None
    user.verification_code_hash = None
    user.verification_expires_at = None
    user.email_verification_token_hash = None
    user.email_verification_token_expires_at = None
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value == "user" or getattr(user, "is_phone_verified", False):
        user.is_verified = True
    db.commit()
    db.refresh(user)
    return user

@router.post("/me/request-email-change", response_model=dict)
def request_email_change(
    body: schemas.UserEmailChangeRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    current_email = _normalize_email(getattr(current_user, "email", None) or user.email)
    requested_email = _normalize_email(str(body.new_email))
    if requested_email == current_email:
        raise HTTPException(status_code=400, detail="New email must be different")

    existing = (
        db.query(models.User)
        .filter(func.lower(models.User.email) == requested_email, models.User.id != user.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    now = datetime.now(timezone.utc)
    sent_at = _as_utc(getattr(user, "email_change_sent_at", None))
    delta_seconds = (now - sent_at).total_seconds() if sent_at else None
    if sent_at and delta_seconds is not None and 0 <= delta_seconds < OTP_RESEND_COOLDOWN_SECONDS:
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a moment.")

    window_start, window_count = _consume_rate_limit(
        now=now,
        window_start=getattr(user, "email_change_rate_window_start", None),
        count=getattr(user, "email_change_rate_count", 0),
        window_seconds=60 * 60,
        max_count=5,
        error_detail="Too many email change requests. Please try again later.",
        email=requested_email,
    )

    link_token = _generate_email_link_token()
    expires_hours = max(1, EMAIL_CHANGE_LINK_EXPIRE_HOURS)
    user.pending_email = requested_email
    user.email_change_token_hash = auth.get_password_hash(link_token)
    user.email_change_token_expires_at = now + td(hours=expires_hours)
    user.email_change_sent_at = now
    user.email_change_rate_window_start = window_start
    user.email_change_rate_count = window_count
    db.commit()

    lang = _normalize_lang(getattr(body, "language", None) or getattr(user, "preferred_language", None))
    confirm_link = _build_frontend_url("/auth/email-action", {"mode": "confirm-email-change", "token": link_token})
    subject, email_body = _email_change_email(lang, requested_email, confirm_link, expires_hours)
    _send_email_or_raise(db, user.id, "email_change_confirm", requested_email, subject, email_body)
    try:
        old_subject, old_body = _email_change_notice_old_email(lang, requested_email)
        _send_email_or_raise(db, user.id, "email_change_notice_old", user.email, old_subject, old_body)
    except HTTPException:
        pass
    return {"message": "Verification email sent"}

@router.get("/confirm-email-change", response_model=schemas.AuthResponse)
def confirm_email_change(request: Request, token: str = Query(..., min_length=12), db: Session = Depends(database.get_db)):
    user = _find_user_by_hashed_token(
        db,
        hash_attr="email_change_token_hash",
        expires_attr="email_change_token_expires_at",
        token=token,
    )
    if not user or not getattr(user, "pending_email", None):
        raise HTTPException(status_code=400, detail="Email change link is invalid or expired")

    pending_email = _normalize_email(str(user.pending_email))
    existing = (
        db.query(models.User)
        .filter(func.lower(models.User.email) == pending_email, models.User.id != user.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user.email = pending_email
    user.pending_email = None
    user.is_email_verified = True
    user.email_change_token_hash = None
    user.email_change_token_expires_at = None
    user.email_change_sent_at = None
    user.email_verification_token_hash = None
    user.email_verification_token_expires_at = None
    if getattr(user, "is_phone_verified", False):
        user.is_verified = True
    db.commit()
    db.refresh(user)
    return _issue_access_token_for_user(db=db, user=user, request=request, remember_me=True)

@router.post("/onboarding", response_model=schemas.User)
def onboarding(
    body: schemas.UserOnboarding,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(database.get_db),
):
    payload = auth.decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    db_user = db.query(models.User).filter(models.User.email == payload["sub"]).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    db_user.preferred_destinations = json.dumps(body.preferred_destinations or [])
    db_user.budget_range = body.budget_range
    db_user.travel_style = body.travel_style
    db_user.interests = json.dumps(body.interests or [])
    db_user.onboarding_completed = True
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/login")
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    raw_form = await request.form()
    remember_me = _parse_remember_me(raw_form.get("remember_me"))
    username = _normalize_email(str(form_data.username))
    _enforce_auth_attempt_limit(scope="login", identity=username, request=request)
    user = db.query(models.User).filter(func.lower(models.User.email) == username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        _record_auth_failure(scope="login", identity=username, request=request)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    _clear_auth_failures("login", username)

    now = datetime.now(timezone.utc)
    if getattr(user, "is_banned", False):
        until = _as_utc(getattr(user, "banned_until", None))
        if not until or now < until:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account restricted")

    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value != "admin":
        if not getattr(user, "is_email_verified", False):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email not verified")
        if role_value == "agency" and not getattr(user, "is_phone_verified", False):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Phone not verified")
        user.is_verified = True
    user.auth_provider = user.auth_provider or "email"
    user.last_login_at = now
    db.commit()

    if role_value == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin 2FA required. Use the admin login page.",
        )
    return _issue_access_token_for_user(db=db, user=user, request=request, remember_me=remember_me)

@router.post("/admin/login-start", response_model=schemas.AdminLoginStartResponse)
def admin_login_start(request: Request, payload: schemas.AdminLoginStartRequest, db: Session = Depends(database.get_db)):
    email = _normalize_email(str(payload.email))
    _enforce_auth_attempt_limit(scope="admin-login", identity=email, request=request)
    user = db.query(models.User).filter(func.lower(models.User.email) == email).first()

    if not user or not auth.verify_password(payload.password, user.hashed_password):
        _record_auth_failure(scope="admin-login", identity=email, request=request)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value != "admin":
        _record_auth_failure(scope="admin-login", identity=email, request=request)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    _clear_auth_failures("admin-login", email)

    now = datetime.now(timezone.utc)
    sent_at = _as_utc(getattr(user, "admin_2fa_sent_at", None))
    delta_seconds = (now - sent_at).total_seconds() if sent_at else None
    if sent_at and delta_seconds is not None and 0 <= delta_seconds < 30:
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a moment.")

    window_start, window_count = _consume_rate_limit(
        now=now,
        window_start=getattr(user, "admin_2fa_rate_window_start", None),
        count=getattr(user, "admin_2fa_rate_count", 0),
        window_seconds=60 * 60,
        max_count=10,
        error_detail="Too many security code requests. Please try again later.",
        email=email,
    )

    code = auth.generate_otp_code(6)
    expires_minutes = 10
    user.admin_2fa_code_hash = auth.get_password_hash(code)
    user.admin_2fa_expires_at = now + td(minutes=expires_minutes)
    user.admin_2fa_sent_at = now
    user.admin_2fa_rate_window_start = window_start
    user.admin_2fa_rate_count = window_count
    db.commit()
    lang = _normalize_lang(getattr(payload, "language", None))
    subject, body_text = _admin_2fa_email(lang, code, expires_minutes)
    _send_email_or_raise(db, user.id, "admin_2fa", email, subject, body_text)
    return schemas.AdminLoginStartResponse(two_factor_required=True)

@router.post("/admin/verify-2fa", response_model=schemas.AuthResponse)
def admin_verify_2fa(request: Request, payload: schemas.AdminVerify2FARequest, db: Session = Depends(database.get_db)):
    email = _normalize_email(str(payload.email))
    _enforce_auth_attempt_limit(scope="admin2fa", identity=email, request=request)
    user = db.query(models.User).filter(func.lower(models.User.email) == email).first()
    if not user:
        _record_auth_failure(scope="admin2fa", identity=email, request=request)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value != "admin":
        _record_auth_failure(scope="admin2fa", identity=email, request=request)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    if not user.admin_2fa_code_hash or not user.admin_2fa_expires_at:
        _record_auth_failure(scope="admin2fa", identity=email, request=request)
        raise HTTPException(status_code=400, detail="2FA not initiated")

    expires_at = _as_utc(user.admin_2fa_expires_at)
    if not expires_at or datetime.now(timezone.utc) > expires_at:
        _record_auth_failure(scope="admin2fa", identity=email, request=request)
        raise HTTPException(status_code=400, detail="2FA code expired")

    if not auth.verify_password(payload.code.strip(), user.admin_2fa_code_hash):
        _record_auth_failure(scope="admin2fa", identity=email, request=request)
        raise HTTPException(status_code=400, detail="Invalid 2FA code")

    user.admin_2fa_code_hash = None
    user.admin_2fa_expires_at = None
    user.auth_provider = user.auth_provider or "email"
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    _clear_auth_failures("admin2fa", email)
    return _issue_access_token_for_user(db=db, user=user, request=request, remember_me=payload.remember_me)

def _resolve_impersonation_target(
    db: Session,
    *,
    body: schemas.AdminImpersonateRequest,
    target_role: str,
) -> models.User:
    """Resolve the account an admin asked to preview.

    When a specific account is named, exactly that account is used: an unknown account or
    one whose role differs fails instead of silently falling back to a different user.
    Without an explicit account the most recent eligible account of the requested role is
    selected (preview mode used by the admin preview page).
    """
    requested_id = getattr(body, "user_id", None)
    requested_email = _normalize_email(str(getattr(body, "email", None) or ""))

    if requested_id is not None or requested_email:
        query = db.query(models.User)
        if requested_id is not None:
            query = query.filter(models.User.id == requested_id)
        if requested_email:
            query = query.filter(func.lower(models.User.email) == requested_email)
        target = query.first()
        if not target:
            raise HTTPException(status_code=404, detail="Account not found")
        resolved_role = target.role.value if hasattr(target.role, "value") else target.role
        if resolved_role != target_role:
            raise HTTPException(status_code=400, detail="Account does not match the requested role")
        return target

    query = db.query(models.User)
    if target_role == "agency":
        query = query.filter(models.User.role == models.UserRole.AGENCY).filter(models.User.agency_id.isnot(None))
    else:
        query = query.filter(models.User.role == models.UserRole.USER)

    target = query.order_by(models.User.created_at.desc(), models.User.id.desc()).first()
    if not target:
        raise HTTPException(status_code=404, detail="No account available for preview")
    return target

@router.post("/admin/impersonate", response_model=schemas.AuthResponse)
def admin_impersonate(
    request: Request,
    body: schemas.AdminImpersonateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    role_value = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    if role_value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    target_role = (getattr(body, "role", "") or "").strip().lower()
    if target_role not in ("user", "agency"):
        raise HTTPException(status_code=400, detail="Invalid role")

    target = _resolve_impersonation_target(db, body=body, target_role=target_role)

    # Issue the preview token through the standard issuer so every impersonation gets a
    # real, revocable UserSession (with `sid`) that shows up in session management, but
    # with a short impersonation-specific TTL.
    response = _issue_access_token_for_user(
        db=db,
        user=target,
        request=request,
        expire_minutes=IMPERSONATION_TOKEN_EXPIRE_MINUTES,
        session_provider="impersonation",
    )

    issued_payload = auth.decode_access_token(response.get("access_token") or "") or {}
    session_id = str(issued_payload.get("sid") or "").strip() or None
    db.add(
        models.ModerationLog(
            entity_type="user",
            entity_id=target.id,
            user_id=target.id,
            reporter_user_id=current_user.id,
            reason="admin_impersonate",
            action="impersonated",
            note=f"{current_user.email} impersonated {target.email} (session {session_id or 'unknown'})",
            reviewed_at=datetime.now(timezone.utc),
            reviewed_by_user_id=current_user.id,
        )
    )
    db.commit()
    return response

@router.post("/change-password", response_model=dict)
def change_password(
    body: schemas.PasswordChangeRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not auth.verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    try:
        auth.validate_strong_password(body.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    user.hashed_password = auth.get_password_hash(body.new_password)
    db.commit()
    return {"message": "ok"}

@router.post("/forgot-password", response_model=dict)
def forgot_password(payload: schemas.ForgotPasswordRequest, db: Session = Depends(database.get_db)):
    email = _normalize_email(str(payload.email))
    user = db.query(models.User).filter(func.lower(models.User.email) == email).first()
    if not user:
        return {"message": "If an account exists, a reset code has been sent"}

    now = datetime.now(timezone.utc)
    sent_at = _as_utc(getattr(user, "password_reset_sent_at", None))
    delta_seconds = (now - sent_at).total_seconds() if sent_at else None
    if sent_at and delta_seconds is not None and 0 <= delta_seconds < 60:
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a moment.")

    window_start, window_count = _consume_rate_limit(
        now=now,
        window_start=getattr(user, "password_reset_rate_window_start", None),
        count=getattr(user, "password_reset_rate_count", 0),
        window_seconds=60 * 60,
        max_count=5,
        error_detail="Too many reset requests. Please try again later.",
        email=email,
    )

    code = auth.generate_otp_code(6)
    expires_minutes = 15
    user.password_reset_token_hash = auth.get_password_hash(code)
    user.password_reset_expires_at = now + td(minutes=expires_minutes)
    user.password_reset_sent_at = now
    user.password_reset_rate_window_start = window_start
    user.password_reset_rate_count = window_count
    db.commit()

    lang = _normalize_lang(getattr(payload, "language", None))
    subject, body_text = _password_reset_email(lang, code, expires_minutes)
    _send_email_or_raise(db, user.id, "password_reset_email", email, subject, body_text)
    return {"message": "If an account exists, a reset code has been sent"}

@router.post("/forgot-password-phone", response_model=dict)
def forgot_password_phone(payload: schemas.ForgotPasswordByPhoneRequest, db: Session = Depends(database.get_db)):
    phone = _normalize_phone(str(payload.phone_number))
    user = db.query(models.User).filter(models.User.phone_number == phone).first()
    if not user:
        return {"message": "If an account exists, a reset code has been sent"}

    now = datetime.now(timezone.utc)
    sent_at = _as_utc(getattr(user, "password_reset_sent_at", None))
    delta_seconds = (now - sent_at).total_seconds() if sent_at else None
    if sent_at and delta_seconds is not None and 0 <= delta_seconds < 60:
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a moment.")

    window_start, window_count = _consume_rate_limit(
        now=now,
        window_start=getattr(user, "password_reset_rate_window_start", None),
        count=getattr(user, "password_reset_rate_count", 0),
        window_seconds=60 * 60,
        max_count=5,
        error_detail="Too many reset requests. Please try again later.",
        email=f"phone:{phone}",
    )

    code = auth.generate_otp_code(6)
    expires_minutes = 15
    user.password_reset_token_hash = auth.get_password_hash(code)
    user.password_reset_expires_at = now + td(minutes=expires_minutes)
    user.password_reset_sent_at = now
    user.password_reset_rate_window_start = window_start
    user.password_reset_rate_count = window_count
    db.commit()

    lang = _normalize_lang(getattr(payload, "language", None))
    _send_sms_or_raise(db, user.id, "password_reset_sms", phone, _password_reset_sms(lang, code, expires_minutes))
    return {"message": "If an account exists, a reset code has been sent"}

@router.post("/reset-password", response_model=dict)
def reset_password(request: Request, payload: schemas.ResetPasswordRequest, db: Session = Depends(database.get_db)):
    email = _normalize_email(str(payload.email))
    _enforce_auth_attempt_limit(scope="reset", identity=email, request=request)
    user = db.query(models.User).filter(func.lower(models.User.email) == email).first()
    if not user:
        # Same response for unknown accounts to avoid account enumeration.
        _record_auth_failure(scope="reset", identity=email, request=request)
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")
    expires_at = _as_utc(getattr(user, "password_reset_expires_at", None))
    if not expires_at or datetime.now(timezone.utc) > expires_at:
        _record_auth_failure(scope="reset", identity=email, request=request)
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")
    token_hash = getattr(user, "password_reset_token_hash", None)
    if not token_hash or not auth.verify_password(payload.code.strip(), token_hash):
        _record_auth_failure(scope="reset", identity=email, request=request)
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")
    try:
        auth.validate_strong_password(payload.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    user.hashed_password = auth.get_password_hash(payload.new_password)
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    user.password_reset_sent_at = None
    db.commit()
    _clear_auth_failures("reset", email)
    return {"message": "ok"}

@router.post("/reset-password-phone", response_model=dict)
def reset_password_phone(request: Request, payload: schemas.ResetPasswordByPhoneRequest, db: Session = Depends(database.get_db)):
    phone = _normalize_phone(str(payload.phone_number))
    _enforce_auth_attempt_limit(scope="reset-phone", identity=phone, request=request)
    user = db.query(models.User).filter(models.User.phone_number == phone).first()
    if not user:
        _record_auth_failure(scope="reset-phone", identity=phone, request=request)
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")
    expires_at = _as_utc(getattr(user, "password_reset_expires_at", None))
    if not expires_at or datetime.now(timezone.utc) > expires_at:
        _record_auth_failure(scope="reset-phone", identity=phone, request=request)
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")
    token_hash = getattr(user, "password_reset_token_hash", None)
    if not token_hash or not auth.verify_password(payload.code.strip(), token_hash):
        _record_auth_failure(scope="reset-phone", identity=phone, request=request)
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")
    try:
        auth.validate_strong_password(payload.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    user.hashed_password = auth.get_password_hash(payload.new_password)
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    user.password_reset_sent_at = None
    db.commit()
    _clear_auth_failures("reset-phone", phone)
    return {"message": "ok"}

@router.post("/refresh", response_model=schemas.AuthResponse)
def refresh_access_token(
    request: Request,
    current_user: models.User = Depends(get_current_user),
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(database.get_db),
):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value != "admin":
        if not getattr(user, "is_email_verified", False):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email not verified")
        if role_value == "agency" and not getattr(user, "is_phone_verified", False):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Phone not verified")
    return _issue_access_token_for_user(
        db=db,
        user=user,
        request=request,
        existing_session_id=str(payload.get("sid") or "").strip() or None,
        remember_me=_parse_remember_me(payload.get("remember_me")),
    )

@router.post("/social-login", response_model=schemas.AuthResponse)
def social_login(request: Request, payload: schemas.SocialLoginRequest, db: Session = Depends(database.get_db)):
    # SECURITY: social login is disabled until real Google/Apple ID token verification
    # (signature, issuer, audience, nonce, expiry) is implemented. A client-supplied email
    # must never be trusted: this endpoint does not look up, create or verify any user, does
    # not issue a session, and does not touch verification state.
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Social login is currently unavailable. Please sign in with email and password.",
    )
