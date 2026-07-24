from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_
from typing import List, Optional
import datetime
import json
import os
import re
from .. import models, schemas, database
from ..deps import get_current_user, get_optional_user

router = APIRouter()

SUPPORTED_CURRENCIES = {"AZN", "USD", "EUR", "RUB", "TRY"}
USD_RATES = {
    "USD": 1.0,
    "EUR": 0.92,
    "RUB": 92.0,
    "TRY": 32.0,
    "AZN": 1.7,
}

_LINK_RE = re.compile(r"https?://\S+", re.IGNORECASE)

PACKAGE_STATUSES = {"draft", "active", "expired", "archived"}

def _now_utc() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)

def _today_utc() -> datetime.date:
    return _now_utc().date()

def _normalize_status(value: str | None) -> str:
    v = (value or "active").strip().lower()
    return v if v in PACKAGE_STATUSES else "active"

def _is_publicly_visible(pkg) -> bool:
    status_value = _normalize_status(getattr(pkg, "status", None))
    if status_value != "active":
        return False
    today = _today_utc()
    start_date = getattr(pkg, "start_date", None)
    end_date = getattr(pkg, "end_date", None)
    if start_date and isinstance(start_date, datetime.date) and start_date > today:
        return False
    if end_date and isinstance(end_date, datetime.date) and end_date < today:
        return False
    return True

def _log_status_change(
    db: Session,
    package_id: int,
    old_status: str | None,
    new_status: str,
    reason: str | None,
    changed_by_user_id: int | None,
):
    db.add(
        models.PackageStatusLog(
            package_id=package_id,
            old_status=old_status,
            new_status=new_status,
            reason=reason,
            changed_by_user_id=changed_by_user_id,
        )
    )

def _apply_lifecycle_updates(db: Session):
    today = _today_utc()
    auto_archive_days_raw = os.getenv("AUTO_ARCHIVE_DAYS", "30")
    try:
        auto_archive_days = int(auto_archive_days_raw)
    except Exception:
        auto_archive_days = 30
    if auto_archive_days < 0:
        auto_archive_days = 0

    now = _now_utc()
    backfilled_status = db.query(models.Package).filter(models.Package.status.is_(None)).update(
        {models.Package.status: "active"}, synchronize_session=False
    )
    backfilled_created = db.query(models.Package).filter(models.Package.created_at.is_(None)).update(
        {models.Package.created_at: now}, synchronize_session=False
    )
    backfilled_updated = db.query(models.Package).filter(models.Package.updated_at.is_(None)).update(
        {models.Package.updated_at: now}, synchronize_session=False
    )

    expiring = (
        db.query(models.Package)
        .filter(models.Package.end_date.isnot(None))
        .filter(models.Package.end_date < today)
        .filter(models.Package.status != "archived")
        .all()
    )
    changed = any(int(x or 0) > 0 for x in [backfilled_status, backfilled_created, backfilled_updated])
    for p in expiring:
        old = _normalize_status(getattr(p, "status", None))
        if old != "expired" and old != "archived":
            p.status = "expired"
            p.updated_at = _now_utc()
            _log_status_change(db, p.id, old, "expired", "auto_expired", None)
            changed = True

    if auto_archive_days == 0:
        archive_cutoff = today
    else:
        archive_cutoff = today - datetime.timedelta(days=auto_archive_days)

    to_archive = (
        db.query(models.Package)
        .filter(models.Package.status == "expired")
        .filter(models.Package.end_date.isnot(None))
        .filter(models.Package.end_date <= archive_cutoff)
        .all()
    )
    for p in to_archive:
        old = _normalize_status(getattr(p, "status", None))
        if old != "archived":
            p.status = "archived"
            p.archived_at = _now_utc()
            p.updated_at = _now_utc()
            _log_status_change(db, p.id, old, "archived", "auto_archived", None)
            changed = True

    if changed:
        db.commit()

def _detect_violation(text: str) -> str | None:
    v = (text or "").lower()
    banned = [
        "nazi",
        "hitler",
        "kill yourself",
        "kys",
        "faggot",
        "retard",
        "whore",
        "slut",
        "сука",
        "убью",
        "нацист",
        "хуй",
        "пидор",
        "amk",
        "orospu",
        "siktir",
        "aq",
    ]
    for w in banned:
        if w in v:
            return "harmful_language"
    links = _LINK_RE.findall(text or "")
    if len(links) >= 3:
        return "suspicious_links"
    if links and ("verify" in v or "login" in v or "password" in v):
        return "phishing_like_text"
    return None

def _normalize_currency(value: str | None) -> str | None:
    if not value:
        return None
    code = str(value).upper().strip()
    return code if code in SUPPORTED_CURRENCIES else None

def _convert_amount(amount: float, from_currency: str, to_currency: str) -> float:
    if from_currency == to_currency:
        return float(amount)
    from_rate = USD_RATES.get(from_currency, 1.0)
    to_rate = USD_RATES.get(to_currency, 1.0)
    if from_rate == 0:
        return 0.0
    usd = float(amount) / from_rate
    return usd * to_rate

def _safe_number(value) -> float | None:
    try:
        n = float(value)
    except Exception:
        return None
    if not (n == n):  # NaN
        return None
    if n < 0:
        return None
    return n

def _normalize_prices(value) -> dict[str, float] | None:
    if value is None:
        return None
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except Exception:
            return None
    if not isinstance(value, dict):
        return None
    out: dict[str, float] = {}
    for k, v in value.items():
        code = _normalize_currency(k)
        if not code:
            continue
        n = _safe_number(v)
        if n is None:
            continue
        out[code] = float(n)
    return out


def _coerce_string_list(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return []
        try:
            value = json.loads(raw)
        except Exception:
            # Backward compatibility for legacy plain-text values.
            return [raw]
    if isinstance(value, list):
        return [str(item).strip() for item in value if isinstance(item, str) and str(item).strip()]
    return []


def _serialize_text_list(value) -> str:
    return json.dumps(_coerce_string_list(value))

def _resolve_unit_price(pkg, currency: str | None) -> float:
    requested = _normalize_currency(currency) or _normalize_currency(getattr(pkg, "base_currency", None)) or "USD"
    base_currency = _normalize_currency(getattr(pkg, "base_currency", None)) or "USD"
    base_price = _safe_number(getattr(pkg, "price", 0)) or 0.0
    pricing_mode = getattr(pkg, "pricing_mode", None) or "auto"
    prices = _normalize_prices(getattr(pkg, "prices", None)) or {}
    if pricing_mode == "manual":
        direct = _safe_number(prices.get(requested))
        if direct is not None:
            return float(direct)
        base_manual = _safe_number(prices.get(base_currency))
        if base_manual is not None:
            return float(_convert_amount(base_manual, base_currency, requested))
    return float(_convert_amount(base_price, base_currency, requested))

#def format_package(pkg):
  #  if pkg.images and isinstance(pkg.images, str):
  #      try:
  #          pkg.images = json.loads(pkg.images)
  #      except json.JSONDecodeError:
  #          pkg.images = []
  #  if pkg.highlights and isinstance(pkg.highlights, str):
  #      try:
  #          pkg.highlights = json.loads(pkg.highlights)
  #      except json.JSONDecodeError:
  #          pkg.highlights = [] 
  #  if getattr(pkg, "prices", None) and isinstance(pkg.prices, str):
  #      try:
  #          parsed = json.loads(pkg.prices)
  #         pkg.prices = parsed if isinstance(parsed, dict) else None
  #      except json.JSONDecodeError:
  #          pkg.prices = None
  #  return pkg 
    
def format_package(pkg):
    pkg.images = _coerce_string_list(getattr(pkg, "images", None))
    pkg.highlights = _coerce_string_list(getattr(pkg, "highlights", None))

    if getattr(pkg, "prices", None) and isinstance(pkg.prices, str):
        try:
            parsed = json.loads(pkg.prices)
            pkg.prices = parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            pkg.prices = None

    return pkg


@router.get("/", response_model=List[schemas.Package])
def get_packages(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    _apply_lifecycle_updates(db)
    today = _today_utc()
    packages = (
        db.query(models.Package)
        .filter(models.Package.status == "active")
        .filter(or_(models.Package.start_date.is_(None), models.Package.start_date <= today))
        .filter(or_(models.Package.end_date.is_(None), models.Package.end_date >= today))
        .order_by(models.Package.created_at.desc(), models.Package.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [format_package(pkg) for pkg in packages]

@router.get("/count", response_model=dict)
def count_packages(current_user: models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    role_value = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    if role_value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    total = db.query(models.Package).count()
    return {"total": total}

@router.get("/search", response_model=List[schemas.Package])
def search_packages(
    budget: Optional[float] = None,
    min_budget: Optional[float] = None,
    max_budget: Optional[float] = None,
    people: Optional[int] = 1,
    adults: Optional[int] = None,
    children: Optional[int] = None,
    teenagers: Optional[int] = None,
    infants: Optional[int] = None,
    duration: Optional[int] = None,
    duration_min: Optional[int] = None,
    duration_max: Optional[int] = None,
    destination: Optional[str] = None,
    country: Optional[str] = None,
    city: Optional[str] = None,
    region: Optional[str] = None,
    category: Optional[str] = None,
    package_type: Optional[str] = None,
    hotel_rating_min: Optional[int] = None,
    hotel_rating_max: Optional[int] = None,
    transportation_type: Optional[str] = None,
    currency: Optional[str] = None,
    depart_date: Optional[str] = None,
    return_date: Optional[str] = None,
    flexible_days: Optional[int] = None,
    sort_by: Optional[str] = "best_value", # cheapest, best_value, popular
    db: Session = Depends(database.get_db)
):
    _apply_lifecycle_updates(db)
    query = db.query(models.Package)
    today = _today_utc()
    query = (
        query.filter(models.Package.status == "active")
        .filter(or_(models.Package.start_date.is_(None), models.Package.start_date <= today))
        .filter(or_(models.Package.end_date.is_(None), models.Package.end_date >= today))
    )
    
    if duration_min is not None:
        query = query.filter(models.Package.duration_days >= int(duration_min))
    if duration_max is not None:
        query = query.filter(models.Package.duration_days <= int(duration_max))
    if duration:
        query = query.filter(models.Package.duration_days <= int(duration))

    if destination:
        query = query.filter(models.Package.destination.ilike(f"%{destination}%"))

    if country:
        query = query.filter(models.Package.country.ilike(f"%{country}%"))
    if city:
        query = query.filter(models.Package.city.ilike(f"%{city}%"))
    if region:
        query = query.filter(models.Package.region.ilike(f"%{region}%"))

    if category:
        query = query.filter(models.Package.category.ilike(f"%{category}%"))

    if package_type:
        query = query.filter(models.Package.package_type.ilike(f"%{package_type}%"))
    if transportation_type:
        query = query.filter(models.Package.transportation_type.ilike(f"%{transportation_type}%"))
    if hotel_rating_min is not None:
        query = query.filter(models.Package.hotel_rating.is_not(None)).filter(models.Package.hotel_rating >= int(hotel_rating_min))
    if hotel_rating_max is not None:
        query = query.filter(models.Package.hotel_rating.is_not(None)).filter(models.Package.hotel_rating <= int(hotel_rating_max))
        
    packages = query.all()
    resolved_currency = _normalize_currency(currency)

    effective_max = max_budget if max_budget is not None else budget
    effective_min = min_budget
    if effective_max is not None or effective_min is not None:
        parts = [adults, children, teenagers, infants]
        if any(p is not None for p in parts):
            safe_people = 0
            for p in parts:
                if p is None:
                    continue
                try:
                    v = int(p)
                except Exception:
                    v = 0
                if v > 0:
                    safe_people += v
            if safe_people < 1:
                safe_people = 1
        else:
            safe_people = int(people or 1)
            if safe_people < 1:
                safe_people = 1
        safe_max = _safe_number(effective_max) if effective_max is not None else None
        safe_min = _safe_number(effective_min) if effective_min is not None else None
        if safe_max is not None or safe_min is not None:
            filtered = []
            for p in packages:
                unit = _resolve_unit_price(p, resolved_currency)
                total = unit * safe_people
                if safe_min is not None and total < float(safe_min):
                    continue
                if safe_max is not None and total > float(safe_max):
                    continue
                filtered.append(p)
            packages = filtered

    def _parse_date(value: Optional[str]) -> Optional[datetime.date]:
        if not value:
            return None
        try:
            return datetime.date.fromisoformat(value)
        except Exception:
            return None

    depart = _parse_date(depart_date)
    ret = _parse_date(return_date)
    flex = int(flexible_days or 0)
    if flex < 0:
        flex = 0
    if flex > 14:
        flex = 14

    if depart or ret:
        filtered = []
        for p in packages:
            start = p.start_date
            end = p.end_date
            if depart:
                d = depart
                if flex:
                    d1 = d - datetime.timedelta(days=flex)
                    d2 = d + datetime.timedelta(days=flex)
                    if start and d2 < start:
                        continue
                    if end and d1 > end:
                        continue
                else:
                    if start and d < start:
                        continue
                    if end and d > end:
                        continue
            if ret:
                r = ret
                if start and r < start:
                    continue
                if end and r > end:
                    continue
            filtered.append(p)
        packages = filtered
    
    # Sorting logic
    if sort_by == "cheapest":
        packages.sort(key=lambda x: _resolve_unit_price(x, resolved_currency))
    elif sort_by == "best_value":
        # Best value = price / duration (cheaper per day)
        packages.sort(
            key=lambda x: _resolve_unit_price(x, resolved_currency) / x.duration_days
            if x.duration_days and x.duration_days > 0
            else _resolve_unit_price(x, resolved_currency)
        )
    elif sort_by == "popular":
        # Popularity could be based on number of reviews or bookings
        # For now, let's just sort by number of reviews
        packages.sort(key=lambda x: len(x.reviews), reverse=True)
        
    return [format_package(pkg) for pkg in packages]

@router.get("/{package_id}/reviews", response_model=List[schemas.ReviewWithUser])
def get_package_reviews(package_id: int, db: Session = Depends(database.get_db)):
    package = db.query(models.Package).filter(models.Package.id == package_id).first()
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    reviews = (
        db.query(models.Review)
        .options(joinedload(models.Review.user))
        .filter(models.Review.package_id == package_id)
        .filter(models.Review.is_hidden.is_(False))
        .order_by(models.Review.created_at.desc())
        .all()
    )
    return reviews

@router.post("/{package_id}/reviews", response_model=schemas.ReviewWithUser)
def create_review(
    package_id: int,
    body: schemas.ReviewCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    if body.rating < 1 or body.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    package = db.query(models.Package).filter(models.Package.id == package_id).first()
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")

    existing = (
        db.query(models.Review)
        .filter(models.Review.package_id == package_id)
        .filter(models.Review.user_id == user.id)
        .first()
    )
    if existing:
        existing.rating = body.rating
        existing.comment = body.comment
        existing.is_hidden = False
        violation = _detect_violation(existing.comment or "")
        if violation:
            existing.is_hidden = True
            db.add(
                models.ModerationLog(
                    entity_type="review",
                    entity_id=existing.id,
                    user_id=user.id,
                    reason=violation,
                    action="hidden",
                )
            )
        db.commit()
        db.refresh(existing)
        return existing

    has_booking = (
        db.query(models.Booking)
        .filter(models.Booking.user_id == user.id)
        .filter(models.Booking.package_id == package_id)
        .filter(models.Booking.status.in_([models.BookingStatus.COMPLETED.value, models.BookingStatus.CONFIRMED.value, models.BookingStatus.IN_PROGRESS.value]))
        .first()
        is not None
    )
    if not has_booking:
        raise HTTPException(status_code=403, detail="Booking required to review")

    review = models.Review(
        user_id=user.id,
        package_id=package_id,
        rating=body.rating,
        comment=body.comment,
    )
    violation = _detect_violation(review.comment or "")
    if violation:
        review.is_hidden = True
    db.add(review)
    db.commit()
    db.refresh(review)
    if violation:
        db.add(
            models.ModerationLog(
                entity_type="review",
                entity_id=review.id,
                user_id=user.id,
                reason=violation,
                action="hidden",
            )
        )
        db.commit()
    return review

@router.delete("/{package_id}/reviews/me")
def delete_my_review(
    package_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    review = (
        db.query(models.Review)
        .filter(models.Review.package_id == package_id)
        .filter(models.Review.user_id == user.id)
        .first()
    )
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    db.delete(review)
    db.commit()
    return {"message": "Review deleted"}

@router.get("/reviews/me", response_model=List[schemas.ReviewWithUser])
def list_my_reviews(
    skip: int = 0,
    limit: int = 200,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    reviews = (
        db.query(models.Review)
        .options(joinedload(models.Review.user))
        .filter(models.Review.user_id == user.id)
        .order_by(models.Review.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return reviews

@router.get("/reviews", response_model=List[schemas.ReviewWithUser])
def admin_list_reviews(
    skip: int = 0,
    limit: int = 200,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    reviews = (
        db.query(models.Review)
        .options(joinedload(models.Review.user))
        .order_by(models.Review.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return reviews

@router.delete("/reviews/{review_id}")
def admin_delete_review(
    review_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    review = db.query(models.Review).filter(models.Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    db.delete(review)
    db.commit()
    return {"message": "Review deleted"}

@router.get("/agency/me", response_model=List[schemas.Package])
def list_my_agency_packages(
    skip: int = 0,
    limit: int = 100,
    country: Optional[str] = None,
    city: Optional[str] = None,
    minPrice: Optional[float] = None,
    maxPrice: Optional[float] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    q: Optional[str] = None,
    sortBy: Optional[str] = Query("date", alias="sortBy"),
    sortOrder: Optional[str] = Query("desc", alias="sortOrder"),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    _apply_lifecycle_updates(db)
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value not in ("agency", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Agency access required")
    if role_value == "agency" and not user.agency_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Agency setup required")

    query = db.query(models.Package)
    if role_value == "agency":
        query = query.filter(models.Package.agency_id == user.agency_id)
    if country:
        query = query.filter(models.Package.country.ilike(f"%{country.strip()}%"))
    if city:
        query = query.filter(models.Package.city.ilike(f"%{city.strip()}%"))
    if q:
        s = f"%{q.strip()}%"
        query = query.filter(or_(models.Package.title.ilike(s), models.Package.destination.ilike(s)))
    min_price = _safe_number(minPrice)
    if min_price is not None:
        query = query.filter(models.Package.price >= float(min_price))
    max_price = _safe_number(maxPrice)
    if max_price is not None:
        query = query.filter(models.Package.price <= float(max_price))

    normalized_status = _normalize_status(status_filter) if status_filter else None
    if normalized_status:
        query = query.filter(models.Package.status == normalized_status)

    sort_by = (sortBy or "date").strip().lower()
    sort_order = (sortOrder or "desc").strip().lower()
    desc = sort_order != "asc"
    if sort_by in ("alpha", "title"):
        order_col = models.Package.title
    elif sort_by == "price":
        order_col = models.Package.price
    else:
        order_col = models.Package.created_at
    if desc:
        query = query.order_by(order_col.desc(), models.Package.id.desc())
    else:
        query = query.order_by(order_col.asc(), models.Package.id.asc())

    packages = query.offset(skip).limit(limit).all()
    return [format_package(p) for p in packages]

@router.patch("/{package_id}/status", response_model=schemas.Package)
def update_package_status(
    package_id: int,
    body: schemas.PackageStatusUpdateRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    _apply_lifecycle_updates(db)
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value not in ("agency", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Agency access required")
    pkg = db.query(models.Package).filter(models.Package.id == package_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    if role_value == "agency":
        if not user.agency_id or pkg.agency_id != user.agency_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    new_status = _normalize_status(body.status)
    if new_status not in PACKAGE_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    old_status = _normalize_status(getattr(pkg, "status", None))

    if new_status == "active":
        today = _today_utc()
        end_date = getattr(pkg, "end_date", None)
        if end_date and isinstance(end_date, datetime.date) and end_date < today:
            raise HTTPException(status_code=400, detail="Cannot set active for an expired package. Update end_date first.")

    pkg.status = new_status
    pkg.updated_at = _now_utc()
    if new_status == "archived":
        pkg.archived_at = _now_utc()
    if old_status == "archived" and new_status in ("draft", "active"):
        pkg.archived_at = None

    _log_status_change(db, pkg.id, old_status, new_status, body.reason, user.id)
    db.commit()
    db.refresh(pkg)
    return format_package(pkg)

@router.post("/{package_id}/duplicate", response_model=schemas.Package)
def duplicate_package(
    package_id: int,
    body: schemas.PackageDuplicateRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    _apply_lifecycle_updates(db)
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value not in ("agency", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Agency access required")
    src = db.query(models.Package).filter(models.Package.id == package_id).first()
    if not src:
        raise HTTPException(status_code=404, detail="Package not found")
    if role_value == "agency":
        if not user.agency_id or src.agency_id != user.agency_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    copied = models.Package(
        title=src.title,
        description=src.description,
        price=src.price,
        status=_normalize_status(body.status or "draft"),
        pricing_mode=getattr(src, "pricing_mode", None),
        base_currency=getattr(src, "base_currency", None),
        prices=getattr(src, "prices", None),
        destination=src.destination,
        country=getattr(src, "country", None),
        city=getattr(src, "city", None),
        duration_days=src.duration_days,
        capacity=src.capacity,
        start_date=body.start_date or getattr(src, "start_date", None),
        end_date=body.end_date or getattr(src, "end_date", None),
        image_url=src.image_url,
        images=_serialize_text_list(getattr(src, "images", None)),
        highlights=_serialize_text_list(getattr(src, "highlights", None)),
        category=src.category,
        agency_id=src.agency_id,
        created_at=_now_utc(),
        updated_at=_now_utc(),
    )
    if copied.status == "archived":
        copied.archived_at = _now_utc()
    else:
        copied.archived_at = None
    db.add(copied)
    db.commit()
    db.refresh(copied)
    _log_status_change(db, copied.id, None, copied.status, "duplicated", user.id)
    db.commit()
    return format_package(copied)

@router.post("/", response_model=schemas.Package)
def create_package(
    package: schemas.PackageCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value not in ("agency", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Agency access required")
    if role_value == "agency" and not user.agency_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Agency setup required")

    _apply_lifecycle_updates(db)
    pkg_data = package.model_dump()
    if role_value == "agency":
        pkg_data["agency_id"] = user.agency_id
    elif not pkg_data.get("agency_id"):
        raise HTTPException(status_code=400, detail="agency_id is required")
    pkg_data["images"] = _serialize_text_list(pkg_data.get("images"))
    pkg_data["highlights"] = _serialize_text_list(pkg_data.get("highlights"))

    desired_status = _normalize_status(pkg_data.get("status"))
    pkg_data["status"] = desired_status
    today = _today_utc()
    end_date = pkg_data.get("end_date")
    if end_date and isinstance(end_date, datetime.date) and end_date < today:
        pkg_data["status"] = "expired"
    if pkg_data.get("status") == "archived":
        pkg_data["archived_at"] = _now_utc()
    pkg_data["created_at"] = _now_utc()
    pkg_data["updated_at"] = _now_utc()

    pricing_mode = (pkg_data.get("pricing_mode") or "auto").strip().lower()
    if pricing_mode not in ("auto", "manual"):
        raise HTTPException(status_code=400, detail="Invalid pricing_mode")
    base_currency = _normalize_currency(pkg_data.get("base_currency")) or "USD"
    pkg_data["pricing_mode"] = pricing_mode
    pkg_data["base_currency"] = base_currency

    prices = _normalize_prices(pkg_data.get("prices"))
    if pricing_mode == "manual":
        if prices is None:
            prices = {}
        base_price = _safe_number(pkg_data.get("price"))
        if base_price is not None and base_currency not in prices:
            prices[base_currency] = float(base_price)
        if not prices:
            raise HTTPException(status_code=400, detail="Manual pricing requires at least one currency price")
        if base_currency in prices:
            pkg_data["price"] = float(prices[base_currency])
        pkg_data["prices"] = json.dumps(prices)
    else:
        pkg_data["prices"] = None
        
    db_package = models.Package(**pkg_data)
    db.add(db_package)
    db.commit()
    db.refresh(db_package)
    
    _log_status_change(db, db_package.id, None, _normalize_status(getattr(db_package, "status", None)), "created", user.id)
    db.commit()
    return format_package(db_package)

@router.put("/{package_id}", response_model=schemas.Package)
def update_package(
    package_id: int,
    package: schemas.PackageCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value not in ("agency", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Agency access required")
    db_package = db.query(models.Package).filter(models.Package.id == package_id).first()
    if not db_package:
        raise HTTPException(status_code=404, detail="Package not found")
    if role_value == "agency":
        if not user.agency_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Agency setup required")
        if db_package.agency_id != user.agency_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    
    _apply_lifecycle_updates(db)
    pkg_data = package.model_dump()
    if role_value == "agency":
        pkg_data["agency_id"] = db_package.agency_id
    pkg_data["images"] = _serialize_text_list(pkg_data.get("images"))
    pkg_data["highlights"] = _serialize_text_list(pkg_data.get("highlights"))

    old_status = _normalize_status(getattr(db_package, "status", None))
    new_status = _normalize_status(pkg_data.get("status"))
    pkg_data["status"] = new_status
    today = _today_utc()
    end_date = pkg_data.get("end_date")
    if end_date and isinstance(end_date, datetime.date) and end_date < today:
        pkg_data["status"] = "expired"
    if pkg_data.get("status") == "archived":
        pkg_data["archived_at"] = _now_utc()
    if old_status == "archived" and pkg_data.get("status") in ("draft", "active"):
        pkg_data["archived_at"] = None
    pkg_data["updated_at"] = _now_utc()

    pricing_mode = (pkg_data.get("pricing_mode") or getattr(db_package, "pricing_mode", None) or "auto").strip().lower()
    if pricing_mode not in ("auto", "manual"):
        raise HTTPException(status_code=400, detail="Invalid pricing_mode")
    base_currency = _normalize_currency(pkg_data.get("base_currency")) or _normalize_currency(getattr(db_package, "base_currency", None)) or "USD"
    pkg_data["pricing_mode"] = pricing_mode
    pkg_data["base_currency"] = base_currency

    prices = _normalize_prices(pkg_data.get("prices"))
    if pricing_mode == "manual":
        if prices is None:
            prices = _normalize_prices(getattr(db_package, "prices", None)) or {}
        base_price = _safe_number(pkg_data.get("price"))
        if base_price is not None and base_currency not in prices:
            prices[base_currency] = float(base_price)
        if not prices:
            raise HTTPException(status_code=400, detail="Manual pricing requires at least one currency price")
        if base_currency in prices:
            pkg_data["price"] = float(prices[base_currency])
        pkg_data["prices"] = json.dumps(prices)
    else:
        pkg_data["prices"] = None
        
    for key, value in pkg_data.items():
        setattr(db_package, key, value)
        
    db.commit()
    db.refresh(db_package)
    final_status = _normalize_status(getattr(db_package, "status", None))
    if final_status != old_status:
        _log_status_change(db, db_package.id, old_status, final_status, "updated", user.id)
        db.commit()
    return format_package(db_package)

@router.delete("/{package_id}")
def delete_package(
    package_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value not in ("agency", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Agency access required")
    db_package = db.query(models.Package).filter(models.Package.id == package_id).first()
    if not db_package:
        raise HTTPException(status_code=404, detail="Package not found")
    if role_value == "agency":
        if not user.agency_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Agency setup required")
        if db_package.agency_id != user.agency_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    
    db.delete(db_package)
    db.commit()
    return {"message": "Package deleted successfully"}

@router.get("/{package_id}", response_model=schemas.Package)
def get_package(
    package_id: int,
    user: models.User | None = Depends(get_optional_user),
    db: Session = Depends(database.get_db),
):
    _apply_lifecycle_updates(db)
    package = db.query(models.Package).filter(models.Package.id == package_id).first()
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    role_value = None
    if user:
        role_value = user.role.value if hasattr(user.role, "value") else user.role
    if not role_value or role_value == "user":
        if not _is_publicly_visible(package):
            raise HTTPException(status_code=404, detail="Package not found")
    if role_value == "agency" and user and user.agency_id and package.agency_id != user.agency_id:
        if not _is_publicly_visible(package):
            raise HTTPException(status_code=404, detail="Package not found")
    return format_package(package)
