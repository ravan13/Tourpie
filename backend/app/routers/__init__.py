from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import timedelta
from .. import models, schemas, database, auth
from datetime import datetime, timezone, timedelta as td
import json
import secrets
from typing import List, Optional
from ..deps import get_current_user
import logging
import os

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/login")

def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()

def _normalize_lang(lang: Optional[str]) -> str:
    v = (lang or "").strip().lower()
    return v if v in ("en", "ru", "az", "tr") else "en"

OTP_EXPIRE_MINUTES = int(os.getenv("OTP_EXPIRE_MINUTES", "5"))
OTP_RESEND_COOLDOWN_SECONDS = int(os.getenv("OTP_RESEND_COOLDOWN_SECONDS", "60"))

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

def _verification_email(lang: str, code: str, minutes: int) -> tuple[str, str]:
    if lang == "ru":
        return (
            "Подтверждение email — TourPie",
            f"Ваш код подтверждения: {code}\nСрок действия: {minutes} мин.\n\nЕсли вы не создавали аккаунт, просто проигнорируйте это письмо.",
        )
    if lang == "az":
        return (
            "Email təsdiqi — TourPie",
            f"Təsdiq kodunuz: {code}\nEtibarlılıq müddəti: {minutes} dəq.\n\nƏgər siz hesab yaratmamısınızsa, bu məktubu nəzərə almayın.",
        )
    if lang == "tr":
        return (
            "E‑posta doğrulama — TourPie",
            f"Doğrulama kodunuz: {code}\nGeçerlilik süresi: {minutes} dk.\n\nBu hesabı siz oluşturmadıysanız bu e-postayı yok sayın.",
        )
    return (
        "Verify your email — TourPie",
        f"Your verification code: {code}\nExpires in: {minutes} minutes.\n\nIf you didn’t create an account, you can ignore this email.",
    )

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

    phone = _normalize_phone(str(getattr(user, "phone_number", "") or ""))
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
    phone_code = auth.generate_otp_code(6)
    now = datetime.now(timezone.utc)
    expires_minutes = max(1, OTP_EXPIRE_MINUTES)
    verification_expires_at = now + td(minutes=expires_minutes)
    new_user = models.User(
        email=email,
        full_name=user.full_name,
        hashed_password=hashed_password,
        role=models.UserRole.USER,
        phone_number=phone,
        country=user.country,
        is_verified=False,
        is_email_verified=False,
        is_phone_verified=False,
        onboarding_completed=False,
        verification_code=None,
        verification_code_hash=auth.get_password_hash(email_code),
        verification_expires_at=verification_expires_at,
        verification_sent_at=now,
        verification_rate_window_start=now,
        verification_rate_count=1,
        phone_verification_code_hash=auth.get_password_hash(phone_code),
        phone_verification_expires_at=verification_expires_at,
        phone_verification_sent_at=now,
        phone_verification_rate_window_start=now,
        phone_verification_rate_count=1,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    subject, body_text = _verification_email(lang, email_code, expires_minutes)
    _send_email_or_raise(db, new_user.id, "register_verify_email", email, subject, body_text)
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
def verify_email(payload: schemas.UserVerifyEmail, db: Session = Depends(database.get_db)):
    email = _normalize_email(str(payload.email))
    db_user = db.query(models.User).filter(func.lower(models.User.email) == email).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    if getattr(db_user, "is_email_verified", False):
        return db_user

    if not db_user.verification_code_hash or not db_user.verification_expires_at:
        raise HTTPException(status_code=400, detail="Verification code not found")

    expires_at = _as_utc(db_user.verification_expires_at)
    if not expires_at or datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Verification code expired")

    if not auth.verify_password(payload.code.strip(), db_user.verification_code_hash):
        raise HTTPException(status_code=400, detail="Invalid verification code")

    db_user.is_email_verified = True
    db_user.verification_code = None
    db_user.verification_code_hash = None
    db_user.verification_expires_at = None
    if getattr(db_user, "is_phone_verified", False):
        db_user.is_verified = True
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/request-verification")
def request_verification(payload: schemas.UserRequestVerification, db: Session = Depends(database.get_db)):
    email = _normalize_email(str(payload.email))
    db_user = db.query(models.User).filter(func.lower(models.User.email) == email).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
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
    expires_minutes = max(1, OTP_EXPIRE_MINUTES)
    db_user.verification_code = None
    db_user.verification_code_hash = auth.get_password_hash(code)
    db_user.verification_expires_at = now + td(minutes=expires_minutes)
    db_user.verification_sent_at = now
    db_user.verification_rate_window_start = window_start
    db_user.verification_rate_count = window_count
    db.commit()
    lang = _normalize_lang(getattr(payload, "language", None))
    subject, body_text = _verification_email(lang, code, expires_minutes)
    _send_email_or_raise(db, db_user.id, "request_verify_email", email, subject, body_text)
    return {"message": "Verification code sent"}

@router.post("/verify-phone", response_model=schemas.User)
def verify_phone(payload: schemas.UserVerifyPhone, db: Session = Depends(database.get_db)):
    email = _normalize_email(str(payload.email))
    user = db.query(models.User).filter(func.lower(models.User.email) == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if getattr(user, "is_phone_verified", False):
        return user
    if not getattr(user, "phone_verification_code_hash", None) or not getattr(user, "phone_verification_expires_at", None):
        raise HTTPException(status_code=400, detail="Verification code not found")
    expires_at = _as_utc(getattr(user, "phone_verification_expires_at", None))
    if not expires_at or datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Verification code expired")
    if not auth.verify_password(payload.code.strip(), getattr(user, "phone_verification_code_hash", "")):
        raise HTTPException(status_code=400, detail="Invalid verification code")
    user.is_phone_verified = True
    user.phone_verification_code_hash = None
    user.phone_verification_expires_at = None
    if getattr(user, "is_email_verified", False):
        user.is_verified = True
    db.commit()
    db.refresh(user)
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
def me(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    payload = auth.decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    db_user = db.query(models.User).filter(models.User.email == payload["sub"]).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

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
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    username = _normalize_email(str(form_data.username))
    user = db.query(models.User).filter(func.lower(models.User.email) == username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    now = datetime.now(timezone.utc)
    if getattr(user, "is_banned", False):
        until = _as_utc(getattr(user, "banned_until", None))
        if not until or now < until:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account restricted")

    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value != "admin":
        if not getattr(user, "is_email_verified", False):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email not verified")
        if not getattr(user, "is_phone_verified", False):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Phone not verified")
        user.is_verified = True
        db.commit()

    if role_value == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin 2FA required. Use the admin login page.",
        )
    token_payload = {"sub": user.email, "role": role_value}
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

    access_token_expires = timedelta(minutes=auth.get_access_token_expire_minutes(role_value))
    access_token = auth.create_access_token(
        data=token_payload,
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/admin/login-start", response_model=schemas.AdminLoginStartResponse)
def admin_login_start(payload: schemas.AdminLoginStartRequest, db: Session = Depends(database.get_db)):
    email = _normalize_email(str(payload.email))
    user = db.query(models.User).filter(func.lower(models.User.email) == email).first()
    if not user or not auth.verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

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
def admin_verify_2fa(payload: schemas.AdminVerify2FARequest, db: Session = Depends(database.get_db)):
    email = _normalize_email(str(payload.email))
    user = db.query(models.User).filter(func.lower(models.User.email) == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    if not user.admin_2fa_code_hash or not user.admin_2fa_expires_at:
        raise HTTPException(status_code=400, detail="2FA not initiated")

    expires_at = _as_utc(user.admin_2fa_expires_at)
    if not expires_at or datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="2FA code expired")

    if not auth.verify_password(payload.code.strip(), user.admin_2fa_code_hash):
        raise HTTPException(status_code=400, detail="Invalid 2FA code")

    user.admin_2fa_code_hash = None
    user.admin_2fa_expires_at = None
    db.commit()

    access_token_expires = timedelta(minutes=auth.get_access_token_expire_minutes("admin"))
    access_token = auth.create_access_token(
        data={"sub": user.email, "role": "admin"},
        expires_delta=access_token_expires,
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/admin/impersonate", response_model=schemas.AuthResponse)
def admin_impersonate(
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

    q = db.query(models.User)
    if target_role == "agency":
        q = q.filter(models.User.role == models.UserRole.AGENCY).filter(models.User.agency_id.isnot(None))
    else:
        q = q.filter(models.User.role == models.UserRole.USER)

    target = q.order_by(models.User.created_at.desc(), models.User.id.desc()).first()
    if not target:
        raise HTTPException(status_code=404, detail="No account available for preview")

    role_value = target.role.value if hasattr(target.role, "value") else target.role
    token_payload: dict[str, object] = {"sub": target.email, "role": role_value}
    if role_value == "agency":
        latest_app = (
            db.query(models.AgencyApplication)
            .filter(models.AgencyApplication.user_id == target.id)
            .order_by(models.AgencyApplication.submitted_at.desc())
            .first()
        )
        token_payload["agency_id"] = target.agency_id
        if latest_app and hasattr(latest_app.status, "value"):
            token_payload["agency_status"] = latest_app.status.value
        else:
            token_payload["agency_status"] = "approved" if target.agency_id else None

    access_token_expires = timedelta(minutes=auth.get_access_token_expire_minutes(role_value))
    access_token = auth.create_access_token(data=token_payload, expires_delta=access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}

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
def reset_password(payload: schemas.ResetPasswordRequest, db: Session = Depends(database.get_db)):
    email = _normalize_email(str(payload.email))
    user = db.query(models.User).filter(func.lower(models.User.email) == email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid reset request")
    expires_at = _as_utc(getattr(user, "password_reset_expires_at", None))
    if not expires_at or datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Reset code expired")
    token_hash = getattr(user, "password_reset_token_hash", None)
    if not token_hash or not auth.verify_password(payload.code.strip(), token_hash):
        raise HTTPException(status_code=400, detail="Invalid reset code")
    try:
        auth.validate_strong_password(payload.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    user.hashed_password = auth.get_password_hash(payload.new_password)
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    user.password_reset_sent_at = None
    db.commit()
    return {"message": "ok"}

@router.post("/reset-password-phone", response_model=dict)
def reset_password_phone(payload: schemas.ResetPasswordByPhoneRequest, db: Session = Depends(database.get_db)):
    phone = _normalize_phone(str(payload.phone_number))
    user = db.query(models.User).filter(models.User.phone_number == phone).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid reset request")
    expires_at = _as_utc(getattr(user, "password_reset_expires_at", None))
    if not expires_at or datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Reset code expired")
    token_hash = getattr(user, "password_reset_token_hash", None)
    if not token_hash or not auth.verify_password(payload.code.strip(), token_hash):
        raise HTTPException(status_code=400, detail="Invalid reset code")
    try:
        auth.validate_strong_password(payload.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    user.hashed_password = auth.get_password_hash(payload.new_password)
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    user.password_reset_sent_at = None
    db.commit()
    return {"message": "ok"}

@router.post("/refresh", response_model=schemas.AuthResponse)
def refresh_access_token(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value != "admin":
        if not getattr(user, "is_email_verified", False):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email not verified")
        if not getattr(user, "is_phone_verified", False):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Phone not verified")

    token_payload: dict[str, object] = {"sub": user.email, "role": role_value}
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

    access_token_expires = timedelta(minutes=auth.get_access_token_expire_minutes(role_value))
    access_token = auth.create_access_token(data=token_payload, expires_delta=access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/social-login", response_model=schemas.AuthResponse)
def social_login(payload: schemas.SocialLoginRequest, db: Session = Depends(database.get_db)):
    provider = (payload.provider or "").strip().lower()
    if provider not in ("google", "apple"):
        raise HTTPException(status_code=400, detail="Unsupported provider")

    email = payload.email.strip().lower()
    user = db.query(models.User).filter(models.User.email == email).first()
    if user:
        role_value = user.role.value if hasattr(user.role, "value") else user.role
        if role_value == "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Use the admin login page")
    else:
        user = models.User(
            email=email,
            full_name=payload.full_name or email,
            hashed_password=auth.get_password_hash(secrets.token_urlsafe(18)),
            role=models.UserRole.USER,
            is_verified=True,
            is_email_verified=True,
            is_phone_verified=True,
            onboarding_completed=False,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    if not getattr(user, "is_email_verified", False) or not getattr(user, "is_phone_verified", False) or not getattr(user, "is_verified", False):
        user.is_email_verified = True
        user.is_phone_verified = True
        user.is_verified = True
        db.commit()

    access_token_expires = timedelta(minutes=auth.get_access_token_expire_minutes("user"))
    access_token = auth.create_access_token(
        data={"sub": user.email, "role": "user"},
        expires_delta=access_token_expires,
    )
    return {"access_token": access_token, "token_type": "bearer"}

