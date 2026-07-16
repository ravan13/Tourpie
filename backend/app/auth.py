from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
import os
from dotenv import load_dotenv
import logging
import secrets
import smtplib
from email.message import EmailMessage
import base64
import urllib.parse
import urllib.request
import json
from pathlib import Path

# Workaround for passlib + bcrypt 4.0.0+ compatibility issue
# https://github.com/pyca/bcrypt/issues/684
import bcrypt
if not hasattr(bcrypt, "__about__"):
    bcrypt.__about__ = type("About", (object,), {"__version__": bcrypt.__version__})

_base_dir = Path(__file__).resolve().parent.parent
load_dotenv(_base_dir / ".env", override=False)
load_dotenv(_base_dir.parent / ".env", override=False)

_env_name = (os.getenv("TOURPIE_ENV") or os.getenv("ENVIRONMENT") or os.getenv("ENV") or "development").strip().lower()
_is_prod = _env_name in ("prod", "production")

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY or SECRET_KEY.strip() in ("", "your-secret-key-for-development"):
    if _is_prod:
        raise RuntimeError("SECRET_KEY must be set in production.")
    SECRET_KEY = "your-secret-key-for-development"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
ACCESS_TOKEN_EXPIRE_ADMIN_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_ADMIN_MINUTES", "15"))
ACCESS_TOKEN_EXPIRE_AGENCY_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_AGENCY_MINUTES", "30"))
ACCESS_TOKEN_EXPIRE_USER_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_USER_MINUTES", "60"))
ACCESS_TOKEN_EXPIRE_REMEMBER_DAYS = int(os.getenv("ACCESS_TOKEN_EXPIRE_REMEMBER_DAYS", "30"))
ACCESS_TOKEN_EXPIRE_ADMIN_REMEMBER_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_ADMIN_REMEMBER_MINUTES", "1440"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")
SMTP_FROM = os.getenv("SMTP_FROM") or SMTP_USER
SMTP_TLS = os.getenv("SMTP_TLS", "true").strip().lower() in ("1", "true", "yes", "on")
SMTP_SSL = os.getenv("SMTP_SSL", "0").strip().lower() in ("1", "true", "yes", "on")
EMAIL_PROVIDER = (os.getenv("EMAIL_PROVIDER") or "").strip().lower()
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM = os.getenv("RESEND_FROM")
EMAIL_DEBUG_TO_CONSOLE = os.getenv("EMAIL_DEBUG_TO_CONSOLE", "0").strip() == "1"
SMS_DEBUG_TO_CONSOLE = os.getenv("SMS_DEBUG_TO_CONSOLE", "0").strip() == "1"
AUTH_DEBUG_DELIVERY = os.getenv("AUTH_DEBUG_DELIVERY", "0").strip() == "1"
AUTH_DEBUG_OTP = os.getenv("AUTH_DEBUG_OTP", "0").strip() == "1"
if _is_prod and (EMAIL_DEBUG_TO_CONSOLE or SMS_DEBUG_TO_CONSOLE or AUTH_DEBUG_DELIVERY or AUTH_DEBUG_OTP):
    raise RuntimeError("Auth debug delivery flags must be disabled in production.")
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_FROM = os.getenv("TWILIO_FROM")
BRAND_NAME = os.getenv("BRAND_NAME", "TourPie").strip() or "TourPie"

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def generate_otp_code(length: int = 6) -> str:
    if length < 4 or length > 10:
        length = 6
    n = secrets.randbelow(10 ** length)
    return str(n).zfill(length)

def _log_delivery(message: str) -> None:
    try:
        print(message)
    except Exception:
        pass
    try:
        logging.getLogger(__name__).warning("%s", message)
    except Exception:
        return

def send_email_with_meta(to_email: str, subject: str, body: str) -> dict:
    to_addr = (to_email or "").strip()
    if not to_addr:
        raise RuntimeError("Missing recipient")
    subj = (subject or "").strip()
    content = (body or "").strip()

    if EMAIL_DEBUG_TO_CONSOLE or AUTH_DEBUG_DELIVERY:
        if AUTH_DEBUG_OTP:
            _log_delivery(f"[email] to={to_addr} subject={subj} body={content}")
        else:
            _log_delivery(f"[email] to={to_addr} subject={subj}")
        if EMAIL_DEBUG_TO_CONSOLE:
            return {"provider": "debug", "status": "skipped"}

    provider = EMAIL_PROVIDER
    if not provider:
        provider = "resend" if RESEND_API_KEY else "smtp"

    if provider == "resend":
        if not RESEND_API_KEY or not (RESEND_FROM or SMTP_FROM):
            raise RuntimeError("Email service is not configured")
        from_value = (RESEND_FROM or SMTP_FROM or "").strip()
        url = "https://api.resend.com/emails"
        payload = json.dumps(
            {"from": from_value, "to": [to_addr], "subject": subj, "text": content},
            ensure_ascii=False,
        ).encode("utf-8")
        req = urllib.request.Request(url, data=payload, method="POST")
        req.add_header("Authorization", f"Bearer {RESEND_API_KEY}")
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=12) as res:
            raw = res.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(raw)
            except Exception:
                parsed = {"raw": raw}
            return {"provider": "resend", "status": "sent", "response": parsed}

    if not SMTP_HOST or not SMTP_FROM:
        raise RuntimeError("Email service is not configured")

    msg = EmailMessage()
    msg["From"] = SMTP_FROM
    msg["To"] = to_addr
    msg["Subject"] = subj
    msg.set_content(content)

    if SMTP_SSL:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=12) as server:
            server.ehlo()
            if SMTP_USER and SMTP_PASS:
                server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=12) as server:
            server.ehlo()
            if SMTP_TLS:
                server.starttls()
                server.ehlo()
            if SMTP_USER and SMTP_PASS:
                server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
    return {"provider": "smtp", "status": "sent"}

def validate_strong_password(password: str) -> None:
    pwd = (password or "").strip()
    if len(pwd) < 8:
        raise ValueError("Password must be at least 8 characters long")
    has_lower = any(c.islower() for c in pwd)
    has_upper = any(c.isupper() for c in pwd)
    has_digit = any(c.isdigit() for c in pwd)
    if not (has_lower and has_upper and has_digit):
        raise ValueError("Password must include upper, lower, and a number")

def send_email(to_email: str, subject: str, body: str) -> None:
    send_email_with_meta(to_email, subject, body)

def send_sms(to_phone: str, body: str) -> None:
    to_value = (to_phone or "").strip()
    if not to_value:
        raise RuntimeError("Missing recipient")
    text_value = (body or "").strip()
    if not text_value:
        raise RuntimeError("Missing message")
    if SMS_DEBUG_TO_CONSOLE:
        if AUTH_DEBUG_OTP:
            _log_delivery(f"[sms] to={to_value} body={text_value}")
        else:
            _log_delivery(f"[sms] to={to_value}")
        return
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN or not TWILIO_FROM:
        if EMAIL_DEBUG_TO_CONSOLE:
            if AUTH_DEBUG_OTP:
                _log_delivery(f"[sms] to={to_value} body={text_value}")
            else:
                _log_delivery(f"[sms] to={to_value}")
            return
        raise RuntimeError("SMS service is not configured")

    url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json"
    payload = urllib.parse.urlencode({"To": to_value, "From": TWILIO_FROM, "Body": text_value}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, method="POST")
    auth_value = base64.b64encode(f"{TWILIO_ACCOUNT_SID}:{TWILIO_AUTH_TOKEN}".encode("utf-8")).decode("ascii")
    req.add_header("Authorization", f"Basic {auth_value}")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")

    try:
        with urllib.request.urlopen(req, timeout=12) as res:
            status = getattr(res, "status", 200)
            if status < 200 or status >= 300:
                raise RuntimeError("SMS provider rejected request")
    except Exception as e:
        logging.getLogger(__name__).exception("SMS send failed: %s", str(e))
        raise RuntimeError("SMS service is not configured")

def get_access_token_expire_minutes(role: str | None, remember_me: bool = False) -> int:
    r = (role or "").strip().lower()
    if remember_me:
        if r == "admin":
            return max(15, int(ACCESS_TOKEN_EXPIRE_ADMIN_REMEMBER_MINUTES))
        return max(60, int(ACCESS_TOKEN_EXPIRE_REMEMBER_DAYS) * 24 * 60)
    if r == "admin":
        return max(5, int(ACCESS_TOKEN_EXPIRE_ADMIN_MINUTES))
    if r == "agency":
        return max(5, int(ACCESS_TOKEN_EXPIRE_AGENCY_MINUTES))
    if r == "user":
        return max(5, int(ACCESS_TOKEN_EXPIRE_USER_MINUTES))
    return max(5, int(ACCESS_TOKEN_EXPIRE_MINUTES))

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
