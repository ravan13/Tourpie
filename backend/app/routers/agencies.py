from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timezone, date, timedelta
from pathlib import Path
from .. import models, schemas, database, auth
import logging
import os
import secrets

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/login")

OTP_EXPIRE_MINUTES = int(os.getenv("OTP_EXPIRE_MINUTES", "5"))
EMAIL_VERIFICATION_LINK_EXPIRE_HOURS = int(os.getenv("EMAIL_VERIFICATION_LINK_EXPIRE_HOURS", "24"))

def _frontend_base_url() -> str:
    return (os.getenv("FRONTEND_BASE_URL") or os.getenv("NEXT_PUBLIC_SITE_URL") or "http://127.0.0.1:3000").strip().rstrip("/")

def _build_frontend_url(path: str, params: dict[str, str]) -> str:
    from urllib.parse import urlencode

    query = urlencode(params)
    return f"{_frontend_base_url()}{path}{f'?{query}' if query else ''}"

def _generate_email_link_token() -> str:
    return secrets.token_urlsafe(32)

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

def _phone_verification_sms(lang: str, code: str, minutes: int) -> str:
    brand = getattr(auth, "BRAND_NAME", "TourPie")
    if lang == "ru":
        return f"{brand}: код подтверждения телефона {code}. Действует {minutes} мин."
    if lang == "az":
        return f"{brand}: telefon təsdiq kodu {code}. {minutes} dəq etibarlıdır."
    if lang == "tr":
        return f"{brand}: telefon doğrulama kodu {code}. {minutes} dk geçerli."
    return f"{brand}: your phone verification code is {code}. Expires in {minutes} minutes."

def _role_value(user: models.User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)) -> models.User:
    payload = auth.decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.query(models.User).filter(models.User.email == payload["sub"]).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

def require_admin(user: models.User) -> None:
    if _role_value(user) != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

def require_agency_or_admin(user: models.User, agency_id: int) -> None:
    role_value = _role_value(user)
    if role_value == "admin":
        return
    if role_value != "agency" or not user.agency_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Agency access required")
    if int(user.agency_id) != int(agency_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

@router.get("/", response_model=List[schemas.Agency])
def get_agencies(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    return db.query(models.Agency).offset(skip).limit(limit).all()

@router.get("/count", response_model=dict)
def count_agencies(user: models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    require_admin(user)
    total = db.query(models.Agency).count()
    return {"total": total}

@router.post("/", response_model=schemas.Agency)
def create_agency(agency: schemas.AgencyCreate, db: Session = Depends(database.get_db)):
    db_agency = models.Agency(**agency.model_dump())
    db.add(db_agency)
    db.commit()
    db.refresh(db_agency)
    return db_agency

@router.post("/apply", response_model=schemas.AgencyApplication)
def apply_as_agency(
    agency_name: str = Form(...),
    company_email: str = Form(...),
    phone_number: str = Form(...),
    country: str = Form(...),
    office_address: str = Form(...),
    tax_vat_info: str = Form(...),
    password: str = Form(...),
    website: Optional[str] = Form(None),
    language: Optional[str] = Form(None),
    business_license: Optional[UploadFile] = File(None),
    tourism_certificate: Optional[UploadFile] = File(None),
    id_verification: Optional[UploadFile] = File(None),
    db: Session = Depends(database.get_db),
):
    email = (company_email or "").strip().lower()
    existing_user = db.query(models.User).filter(models.User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    normalized_phone = _normalize_phone(phone_number)
    existing_phone = db.query(models.User).filter(models.User.phone_number == normalized_phone).first()
    if existing_phone:
        raise HTTPException(status_code=400, detail="Phone number already registered")

    existing_agency = db.query(models.Agency).filter(models.Agency.name == agency_name).first()
    if existing_agency:
        raise HTTPException(status_code=400, detail="Agency name already exists")

    try:
        auth.validate_strong_password(password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    hashed_password = auth.get_password_hash(password)
    now = datetime.now(timezone.utc)
    email_code = auth.generate_otp_code(6)
    email_link_token = _generate_email_link_token()
    phone_code = auth.generate_otp_code(6)
    expires_minutes = max(1, OTP_EXPIRE_MINUTES)
    verification_link_expires_at = now + timedelta(hours=max(1, EMAIL_VERIFICATION_LINK_EXPIRE_HOURS))
    new_user = models.User(
        email=email,
        full_name=agency_name,
        hashed_password=hashed_password,
        role=models.UserRole.AGENCY,
        phone_number=normalized_phone,
        country=country,
        is_verified=False,
        is_email_verified=False,
        is_phone_verified=False,
        onboarding_completed=True,
        verification_code=None,
        verification_code_hash=auth.get_password_hash(email_code),
        verification_expires_at=now + timedelta(minutes=expires_minutes),
        email_verification_token_hash=auth.get_password_hash(email_link_token),
        email_verification_token_expires_at=verification_link_expires_at,
        verification_sent_at=now,
        verification_rate_window_start=now,
        verification_rate_count=1,
        phone_verification_code_hash=auth.get_password_hash(phone_code),
        phone_verification_expires_at=now + timedelta(minutes=expires_minutes),
        phone_verification_sent_at=now,
        phone_verification_rate_window_start=now,
        phone_verification_rate_count=1,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    lang = (language or "").strip().lower()
    if lang not in ("en", "ru", "az", "tr"):
        lang = "en"
    verify_link = _build_frontend_url("/auth/email-action", {"mode": "verify-email", "token": email_link_token})
    if lang == "ru":
        subject = "Подтверждение email — TourPie"
        body_text = f"Ваш код подтверждения: {email_code}\nСрок действия кода: {expires_minutes} мин.\nПодтвердить instantly: {verify_link}"
    elif lang == "az":
        subject = "Email təsdiqi — TourPie"
        body_text = f"Təsdiq kodunuz: {email_code}\nKodun etibarlılıq müddəti: {expires_minutes} dəq.\nDərhal təsdiqlə: {verify_link}"
    elif lang == "tr":
        subject = "E‑posta doğrulama — TourPie"
        body_text = f"Doğrulama kodunuz: {email_code}\nKodun geçerlilik süresi: {expires_minutes} dk.\nHemen doğrula: {verify_link}"
    else:
        subject = "Verify your email — TourPie"
        body_text = f"Your verification code: {email_code}\nCode expires in: {expires_minutes} minutes.\nVerify instantly: {verify_link}"
    try:
        meta = auth.send_email_with_meta(email, subject, body_text)
        _record_delivery(db, new_user.id, "email", "register_verify_email", email, "sent", meta.get("provider"))
    except Exception as e:
        logging.getLogger(__name__).exception("Email send failed: %s", str(e))
        _record_delivery(db, new_user.id, "email", "register_verify_email", email, "failed", None, str(e))
        raise HTTPException(status_code=503, detail="Email service is unavailable")

    try:
        auth.send_sms(normalized_phone, _phone_verification_sms(lang, phone_code, expires_minutes))
    except Exception as e:
        logging.getLogger(__name__).exception("SMS send failed: %s", str(e))
        _record_delivery(db, new_user.id, "sms", "register_verify_phone", normalized_phone, "failed", None, str(e))
        raise HTTPException(status_code=503, detail="SMS service is unavailable")
    _record_delivery(db, new_user.id, "sms", "register_verify_phone", normalized_phone, "sent", "twilio" if getattr(auth, "TWILIO_ACCOUNT_SID", None) else "debug")

    agency = models.Agency(
        name=agency_name,
        description=None,
        website=website,
        contact_email=company_email,
        phone_number=phone_number,
        country=country,
        office_address=office_address,
        tax_vat_info=tax_vat_info,
        status="inactive",
    )
    db.add(agency)
    db.commit()
    db.refresh(agency)

    new_user.agency_id = agency.id
    db.commit()
    db.refresh(new_user)

    app_row = models.AgencyApplication(
        user_id=new_user.id,
        agency_id=agency.id,
        agency_name=agency_name,
        company_email=company_email,
        phone_number=phone_number,
        country=country,
        office_address=office_address,
        website=website,
        tax_vat_info=tax_vat_info,
        status=models.AgencyApplicationStatus.PENDING,
    )
    db.add(app_row)
    db.commit()
    db.refresh(app_row)

    base_dir = Path(__file__).resolve().parent.parent.parent / "uploads" / "agency_applications" / str(app_row.id)
    base_dir.mkdir(parents=True, exist_ok=True)

    def save_file(kind: str, up: Optional[UploadFile]) -> Optional[str]:
        if not up or not up.filename:
            return None
        safe_name = "".join(c for c in up.filename if c.isalnum() or c in (".", "_", "-"))
        if not safe_name:
            safe_name = f"{kind}.bin"
        dest = base_dir / f"{kind}_{safe_name}"
        with dest.open("wb") as f:
            f.write(up.file.read())
        rel = dest.relative_to(Path(__file__).resolve().parent.parent.parent).as_posix()
        return rel

    app_row.business_license_path = save_file("business_license", business_license)
    app_row.tourism_certificate_path = save_file("tourism_certificate", tourism_certificate)
    app_row.id_verification_path = save_file("id_verification", id_verification)
    db.commit()
    db.refresh(app_row)
    return app_row

@router.get("/applications", response_model=List[schemas.AgencyApplication])
def list_agency_applications(
    status_filter: Optional[models.AgencyApplicationStatus] = None,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    require_admin(user)
    query = db.query(models.AgencyApplication).order_by(models.AgencyApplication.submitted_at.desc())
    if status_filter:
        query = query.filter(models.AgencyApplication.status == status_filter)
    return query.all()

@router.post("/applications/{application_id}/approve", response_model=schemas.AgencyApplication)
def approve_agency_application(
    application_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    require_admin(user)
    app_row = db.query(models.AgencyApplication).filter(models.AgencyApplication.id == application_id).first()
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")
    if app_row.status == models.AgencyApplicationStatus.APPROVED:
        return app_row

    app_row.status = models.AgencyApplicationStatus.APPROVED
    app_row.rejection_reason = None
    app_row.reviewed_at = datetime.now(timezone.utc)
    app_row.reviewed_by_user_id = user.id

    if app_row.agency_id:
        agency = db.query(models.Agency).filter(models.Agency.id == app_row.agency_id).first()
        if agency:
            agency.status = "active"

    agency_user = db.query(models.User).filter(models.User.id == app_row.user_id).first()
    if agency_user and app_row.agency_id:
        agency_user.agency_id = app_row.agency_id
        agency_user.role = models.UserRole.AGENCY

    db.commit()
    db.refresh(app_row)
    return app_row

@router.post("/applications/{application_id}/reject", response_model=schemas.AgencyApplication)
def reject_agency_application(
    application_id: int,
    reason: Optional[str] = Form(None),
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    require_admin(user)
    app_row = db.query(models.AgencyApplication).filter(models.AgencyApplication.id == application_id).first()
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")

    app_row.status = models.AgencyApplicationStatus.REJECTED
    app_row.rejection_reason = reason
    app_row.reviewed_at = datetime.now(timezone.utc)
    app_row.reviewed_by_user_id = user.id
    if app_row.agency_id:
        agency = db.query(models.Agency).filter(models.Agency.id == app_row.agency_id).first()
        if agency:
            agency.status = "inactive"

    db.commit()
    db.refresh(app_row)
    return app_row

@router.get("/applications/{application_id}/documents/{kind}")
def download_agency_application_document(
    application_id: int,
    kind: str,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    app_row = db.query(models.AgencyApplication).filter(models.AgencyApplication.id == application_id).first()
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")

    is_admin = _role_value(user) == "admin"
    if not is_admin and app_row.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    path_map = {
        "business_license": app_row.business_license_path,
        "tourism_certificate": app_row.tourism_certificate_path,
        "id_verification": app_row.id_verification_path,
    }
    rel_path = path_map.get(kind)
    if not rel_path:
        raise HTTPException(status_code=404, detail="Document not found")

    abs_path = (Path(__file__).resolve().parent.parent.parent / rel_path).resolve()
    if not abs_path.exists():
        raise HTTPException(status_code=404, detail="Document not found")

    return FileResponse(str(abs_path))

@router.get("/{agency_id}", response_model=schemas.Agency)
def get_agency(agency_id: int, db: Session = Depends(database.get_db)):
    agency = db.query(models.Agency).filter(models.Agency.id == agency_id).first()
    if not agency:
        raise HTTPException(status_code=404, detail="Agency not found")
    return agency

@router.put("/{agency_id}", response_model=schemas.Agency)
def update_agency(
    agency_id: int,
    body: schemas.AgencyUpdate,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    require_agency_or_admin(user, agency_id)
    data = body.model_dump(exclude_unset=True)
    if user.role != models.UserRole.ADMIN and "subscription_status" in data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    agency = db.query(models.Agency).filter(models.Agency.id == agency_id).first()
    if not agency:
        raise HTTPException(status_code=404, detail="Agency not found")
    for k, v in data.items():
        setattr(agency, k, v)
    db.commit()
    db.refresh(agency)
    return agency

@router.delete("/{agency_id}", response_model=dict)
def delete_agency(
    agency_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    require_admin(user)
    agency = db.query(models.Agency).filter(models.Agency.id == agency_id).first()
    if not agency:
        raise HTTPException(status_code=404, detail="Agency not found")

    now = datetime.now(timezone.utc)
    users = db.query(models.User).filter(models.User.agency_id == agency_id).all()
    for u in users:
        u.agency_id = None
        u.role = models.UserRole.USER
        u.is_banned = True
        u.banned_until = None
        u.banned_reason = "agency_deleted"

    packages = db.query(models.Package).filter(models.Package.agency_id == agency_id).all()
    for p in packages:
        p.status = "archived"
        p.archived_at = now
        p.updated_at = now

    agency.status = "deleted"
    agency.name = f"deleted_agency_{agency_id}"
    agency.description = None
    agency.website = None
    agency.contact_email = None
    agency.phone_number = None
    agency.country = None
    agency.office_address = None
    agency.tax_vat_info = None
    db.commit()
    return {"message": "deleted"}

@router.get("/{agency_id}/stats")
def get_agency_stats(agency_id: int, db: Session = Depends(database.get_db)):
    agency = db.query(models.Agency).filter(models.Agency.id == agency_id).first()
    if not agency:
        raise HTTPException(status_code=404, detail="Agency not found")
    
    # Calculate stats
    package_ids = [p.id for p in agency.packages]
    bookings = db.query(models.Booking).filter(models.Booking.package_id.in_(package_ids)).all()
    
    total_revenue = sum(b.total_price for b in bookings if b.total_price)
    active_bookings = len([b for b in bookings if b.status != "cancelled"])
    
    return {
        "total_packages": len(agency.packages),
        "active_bookings": active_bookings,
        "total_revenue": total_revenue
    }

@router.get("/{agency_id}/availability", response_model=List[schemas.AgencyAvailability])
def list_availability(
    agency_id: int,
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    require_agency_or_admin(user, agency_id)
    start_date = date.fromisoformat(start) if start else date.today()
    end_date = date.fromisoformat(end) if end else date.fromisoformat((date.today()).isoformat())
    if end is None:
        end_date = date.fromordinal(start_date.toordinal() + 60)
    rows = (
        db.query(models.AgencyAvailability)
        .filter(models.AgencyAvailability.agency_id == agency_id)
        .filter(models.AgencyAvailability.date >= start_date)
        .filter(models.AgencyAvailability.date <= end_date)
        .order_by(models.AgencyAvailability.date.asc())
        .all()
    )
    return rows

@router.post("/{agency_id}/availability", response_model=schemas.AgencyAvailability)
def upsert_availability(
    agency_id: int,
    body: schemas.AgencyAvailabilityUpsertRequest,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    require_agency_or_admin(user, agency_id)
    try:
        d = date.fromisoformat(body.date)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date")
    row = (
        db.query(models.AgencyAvailability)
        .filter(models.AgencyAvailability.agency_id == agency_id)
        .filter(models.AgencyAvailability.date == d)
        .first()
    )
    if not row:
        row = models.AgencyAvailability(agency_id=agency_id, date=d)
        db.add(row)
    if body.is_blocked is not None:
        row.is_blocked = bool(body.is_blocked)
    row.capacity_override = body.capacity_override
    db.commit()
    db.refresh(row)
    return row

@router.delete("/{agency_id}/availability/{date_str}")
def delete_availability(
    agency_id: int,
    date_str: str,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    require_agency_or_admin(user, agency_id)
    try:
        d = date.fromisoformat(date_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date")
    row = (
        db.query(models.AgencyAvailability)
        .filter(models.AgencyAvailability.agency_id == agency_id)
        .filter(models.AgencyAvailability.date == d)
        .first()
    )
    if not row:
        return {"message": "Not found"}
    db.delete(row)
    db.commit()
    return {"message": "Deleted"}

@router.get("/{agency_id}/customers", response_model=List[schemas.AgencyCustomerSummary])
def list_customers(
    agency_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    require_agency_or_admin(user, agency_id)
    rows = (
        db.query(
            models.User.id.label("user_id"),
            models.User.full_name.label("full_name"),
            models.User.email.label("email"),
            func.count(models.Booking.id).label("bookings_count"),
            func.coalesce(func.sum(models.Booking.total_price), 0).label("total_spent"),
        )
        .join(models.Booking, models.Booking.user_id == models.User.id)
        .join(models.Package, models.Booking.package_id == models.Package.id)
        .filter(models.Package.agency_id == agency_id)
        .group_by(models.User.id)
        .order_by(func.count(models.Booking.id).desc())
        .all()
    )
    return [
        schemas.AgencyCustomerSummary(
            user_id=r.user_id,
            full_name=r.full_name,
            email=r.email,
            bookings_count=int(r.bookings_count or 0),
            total_spent=float(r.total_spent or 0),
        )
        for r in rows
    ]

@router.get("/{agency_id}/analytics", response_model=schemas.AgencyAnalytics)
def get_analytics(
    agency_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    require_agency_or_admin(user, agency_id)
    agency = db.query(models.Agency).filter(models.Agency.id == agency_id).first()
    if not agency:
        raise HTTPException(status_code=404, detail="Agency not found")
    package_ids = [p.id for p in agency.packages]
    bookings = db.query(models.Booking).filter(models.Booking.package_id.in_(package_ids)).all() if package_ids else []

    counts = {s.value: 0 for s in models.BookingStatus}
    revenue_total = 0.0
    for b in bookings:
        status_val = (b.status or "").lower()
        counts[status_val] = counts.get(status_val, 0) + 1
        if status_val in (models.BookingStatus.CONFIRMED.value, models.BookingStatus.COMPLETED.value, models.BookingStatus.IN_PROGRESS.value):
            revenue_total += float(b.offered_total_price if b.offered_total_price is not None else (b.total_price or 0))

    return schemas.AgencyAnalytics(
        total_packages=len(agency.packages),
        bookings_total=len(bookings),
        bookings_pending=counts.get(models.BookingStatus.PENDING.value, 0),
        bookings_payment_pending=counts.get(models.BookingStatus.PAYMENT_PENDING.value, 0),
        bookings_confirmed=counts.get(models.BookingStatus.CONFIRMED.value, 0),
        bookings_in_progress=counts.get(models.BookingStatus.IN_PROGRESS.value, 0),
        bookings_completed=counts.get(models.BookingStatus.COMPLETED.value, 0),
        revenue_total=revenue_total,
    )

@router.get("/{agency_id}/reviews", response_model=List[schemas.AgencyReviewItem])
def list_agency_reviews(
    agency_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    require_agency_or_admin(user, agency_id)
    reviews = (
        db.query(models.Review)
        .join(models.Package, models.Review.package_id == models.Package.id)
        .filter(models.Package.agency_id == agency_id)
        .order_by(models.Review.created_at.desc())
        .all()
    )
    output: List[schemas.AgencyReviewItem] = []
    for r in reviews:
        pkg = db.query(models.Package).filter(models.Package.id == r.package_id).first()
        u = db.query(models.User).filter(models.User.id == r.user_id).first()
        output.append(
            schemas.AgencyReviewItem(
                id=r.id,
                package_id=r.package_id,
                package_title=pkg.title if pkg else str(r.package_id),
                rating=r.rating,
                comment=r.comment,
                created_at=r.created_at,
                user=schemas.UserPublic(id=u.id, full_name=u.full_name) if u else None,
            )
        )
    return output

@router.get("/{agency_id}/team", response_model=List[schemas.AgencyTeamMember])
def list_team(
    agency_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    require_agency_or_admin(user, agency_id)
    return (
        db.query(models.AgencyTeamMember)
        .filter(models.AgencyTeamMember.agency_id == agency_id)
        .order_by(models.AgencyTeamMember.created_at.desc())
        .all()
    )

@router.post("/{agency_id}/team", response_model=schemas.AgencyTeamMember)
def add_team_member(
    agency_id: int,
    body: schemas.AgencyTeamMemberCreateRequest,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    require_agency_or_admin(user, agency_id)
    email = body.email.strip().lower()
    existing = (
        db.query(models.AgencyTeamMember)
        .filter(models.AgencyTeamMember.agency_id == agency_id)
        .filter(models.AgencyTeamMember.email == email)
        .first()
    )
    if existing:
        return existing
    member = models.AgencyTeamMember(
        agency_id=agency_id,
        email=email,
        full_name=body.full_name,
        role=(body.role or "staff"),
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member

@router.delete("/{agency_id}/team/{member_id}")
def remove_team_member(
    agency_id: int,
    member_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    require_agency_or_admin(user, agency_id)
    member = db.query(models.AgencyTeamMember).filter(models.AgencyTeamMember.id == member_id).first()
    if not member or member.agency_id != agency_id:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(member)
    db.commit()
    return {"message": "Removed"}
