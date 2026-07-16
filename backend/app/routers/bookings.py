from fastapi import APIRouter, Depends, HTTPException, status as http_status
from sqlalchemy.orm import Session
from typing import List
import datetime
import json
import secrets
from sqlalchemy.orm import joinedload
from .. import models, schemas, database
from ..deps import get_current_user
from .packages import _normalize_currency, _resolve_unit_price, _apply_lifecycle_updates, _normalize_status, _today_utc

router = APIRouter()

def _format_package(pkg: models.Package | None):
    if not pkg:
        return None
    if pkg.images and isinstance(pkg.images, str):
        try:
            pkg.images = json.loads(pkg.images)
        except json.JSONDecodeError:
            pkg.images = []
    if pkg.highlights and isinstance(pkg.highlights, str):
        try:
            pkg.highlights = json.loads(pkg.highlights)
        except json.JSONDecodeError:
            pkg.highlights = []
    if getattr(pkg, "prices", None) and isinstance(pkg.prices, str):
        try:
            parsed = json.loads(pkg.prices)
            pkg.prices = parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            pkg.prices = None
    return pkg

@router.get("", response_model=List[schemas.Booking])
@router.get("/", response_model=List[schemas.Booking])
def get_bookings(
    skip: int = 0,
    limit: int = 100,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value != "admin":
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Admin access required")
    bookings = (
        db.query(models.Booking)
        .options(joinedload(models.Booking.package).joinedload(models.Package.agency))
        .order_by(models.Booking.booking_date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    for booking in bookings:
        _format_package(booking.package)
    return bookings

@router.get("/count", response_model=dict)
def count_bookings(user: models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value != "admin":
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Admin access required")
    total = db.query(models.Booking).count()
    return {"total": total}

@router.get("/me", response_model=List[schemas.Booking])
def get_my_bookings(
    skip: int = 0,
    limit: int = 100,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    bookings = (
        db.query(models.Booking)
        .options(joinedload(models.Booking.package).joinedload(models.Package.agency))
        .filter(models.Booking.user_id == user.id)
        .order_by(models.Booking.booking_date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    for booking in bookings:
        _format_package(booking.package)
    return bookings

@router.post("", response_model=schemas.Booking)
@router.post("/", response_model=schemas.Booking)
def create_booking(
    booking: schemas.BookingCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    
    _apply_lifecycle_updates(db)
    package = db.query(models.Package).filter(models.Package.id == booking.package_id).first()
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    if _normalize_status(getattr(package, "status", None)) != "active":
        raise HTTPException(status_code=400, detail="Package is not bookable")
    today = _today_utc()
    travel_day = booking.travel_date.date() if booking.travel_date else None
    if travel_day:
        start_date = getattr(package, "start_date", None)
        end_date = getattr(package, "end_date", None)
        if start_date and isinstance(start_date, datetime.date) and travel_day < start_date:
            raise HTTPException(status_code=400, detail="Selected date is before package start date")
        if end_date and isinstance(end_date, datetime.date) and travel_day > end_date:
            raise HTTPException(status_code=400, detail="Selected date is after package end date")
        if end_date and isinstance(end_date, datetime.date) and end_date < today:
            raise HTTPException(status_code=400, detail="Package is expired")

    resolved_currency = _normalize_currency(getattr(booking, "currency", None)) or _normalize_currency(getattr(package, "base_currency", None)) or "USD"
    unit_price = _resolve_unit_price(package, resolved_currency)
    total_price = unit_price * booking.number_of_people
    
    db_booking = models.Booking(
        **booking.model_dump(), 
        user_id=user.id,
        total_price=total_price,
        currency=resolved_currency,
    )
    db.add(db_booking)
    db.commit()
    db.refresh(db_booking)
    _format_package(db_booking.package)
    return db_booking

@router.post("/initiate-payment", response_model=schemas.BookingPaymentInitiateResponse)
def initiate_payment(
    payload: schemas.BookingPaymentInitiateRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):

    _apply_lifecycle_updates(db)
    package = db.query(models.Package).filter(models.Package.id == payload.package_id).first()
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    if _normalize_status(getattr(package, "status", None)) != "active":
        raise HTTPException(status_code=400, detail="Package is not bookable")
    today = _today_utc()
    travel_day = payload.travel_date.date() if payload.travel_date else None
    if travel_day:
        start_date = getattr(package, "start_date", None)
        end_date = getattr(package, "end_date", None)
        if start_date and isinstance(start_date, datetime.date) and travel_day < start_date:
            raise HTTPException(status_code=400, detail="Selected date is before package start date")
        if end_date and isinstance(end_date, datetime.date) and travel_day > end_date:
            raise HTTPException(status_code=400, detail="Selected date is after package end date")
        if end_date and isinstance(end_date, datetime.date) and end_date < today:
            raise HTTPException(status_code=400, detail="Package is expired")

    resolved_currency = _normalize_currency(getattr(payload, "currency", None)) or _normalize_currency(getattr(package, "base_currency", None)) or "USD"
    unit_price = _resolve_unit_price(package, resolved_currency)
    total_price = unit_price * payload.number_of_people
    payment_reference = f"demo_{secrets.token_urlsafe(8)}"

    db_booking = models.Booking(
        **payload.model_dump(),
        user_id=user.id,
        total_price=total_price,
        currency=resolved_currency,
        payment_status="initiated",
        payment_reference=payment_reference,
        status=models.BookingStatus.PENDING.value,
    )
    db.add(db_booking)
    db.add(
        models.Notification(
            user_id=user.id,
            type=models.NotificationType.BOOKING,
            title="Booking request sent",
            body=f"Your request for {package.title} was sent to the agency.",
            link_url="/dashboard/bookings",
            is_read=False,
        )
    )
    db.commit()
    db.refresh(db_booking)
    _format_package(db_booking.package)

    return schemas.BookingPaymentInitiateResponse(
        booking=db_booking,
        payment_url=f"/payment/demo?booking_id={db_booking.id}&ref={payment_reference}",
    )

@router.get("/agency/{agency_id}", response_model=List[schemas.Booking])
def get_agency_booking_requests(
    agency_id: int,
    status: str | None = None,
    skip: int = 0,
    limit: int = 100,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value != "agency" or not user.agency_id:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Agency access required")
    resolved_agency_id = user.agency_id or agency_id
    query = (
        db.query(models.Booking)
        .join(models.Package, models.Booking.package_id == models.Package.id)
        .options(joinedload(models.Booking.package).joinedload(models.Package.agency))
        .filter(models.Package.agency_id == resolved_agency_id)
        .order_by(models.Booking.booking_date.desc())
    )
    if status:
        query = query.filter(models.Booking.status == status)
    bookings = query.offset(skip).limit(limit).all()
    for booking in bookings:
        _format_package(booking.package)
    return bookings

@router.post("/{booking_id}/accept", response_model=schemas.Booking)
def accept_booking(
    booking_id: int,
    agency_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    booking = (
        db.query(models.Booking)
        .options(joinedload(models.Booking.package).joinedload(models.Package.agency))
        .filter(models.Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value != "agency" or not user.agency_id:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Agency access required")
    resolved_agency_id = user.agency_id or agency_id
    if not booking.package or booking.package.agency_id != resolved_agency_id:
        raise HTTPException(status_code=403, detail="Not allowed to modify this booking")

    if booking.status != models.BookingStatus.PENDING.value:
        return booking

    booking.status = models.BookingStatus.ACCEPTED.value
    booking.accepted_at = datetime.datetime.now(datetime.timezone.utc)
    booking.confirmed_at = None
    booking.rejected_at = None
    db.add(
        models.Notification(
            user_id=booking.user_id,
            type=models.NotificationType.BOOKING,
            title="Booking accepted",
            body=f"Your booking for {booking.package.title if booking.package else 'a package'} was accepted by the agency.",
            link_url="/dashboard/bookings",
            is_read=False,
        )
    )
    db.commit()
    db.refresh(booking)
    _format_package(booking.package)
    return booking

@router.post("/{booking_id}/reject", response_model=schemas.Booking)
def reject_booking(
    booking_id: int,
    agency_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    booking = (
        db.query(models.Booking)
        .options(joinedload(models.Booking.package).joinedload(models.Package.agency))
        .filter(models.Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value != "agency" or not user.agency_id:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Agency access required")
    resolved_agency_id = user.agency_id or agency_id
    if not booking.package or booking.package.agency_id != resolved_agency_id:
        raise HTTPException(status_code=403, detail="Not allowed to modify this booking")

    if booking.status != models.BookingStatus.PENDING.value:
        return booking

    booking.status = models.BookingStatus.REJECTED.value
    booking.rejected_at = datetime.datetime.now(datetime.timezone.utc)
    booking.accepted_at = None
    booking.confirmed_at = None
    db.add(
        models.Notification(
            user_id=booking.user_id,
            type=models.NotificationType.BOOKING,
            title="Booking rejected",
            body=f"Your booking for {booking.package.title if booking.package else 'a package'} was rejected.",
            link_url="/dashboard/bookings",
            is_read=False,
        )
    )
    db.commit()
    db.refresh(booking)
    _format_package(booking.package)
    return booking

@router.post("/{booking_id}/admin/status", response_model=schemas.Booking)
def admin_set_status(
    booking_id: int,
    body: schemas.BookingAdminSetStatusRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value != "admin":
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Admin access required")

    booking = (
        db.query(models.Booking)
        .options(joinedload(models.Booking.package).joinedload(models.Package.agency))
        .filter(models.Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    raw = (body.status or "").strip()
    normalized = raw.lower()
    allowed = {s.value for s in models.BookingStatus}
    if normalized not in allowed:
        raise HTTPException(status_code=400, detail="Invalid status")

    booking.status = normalized
    now = datetime.datetime.now(datetime.timezone.utc)
    if normalized == models.BookingStatus.ACCEPTED.value:
        booking.accepted_at = now
        booking.rejected_at = None
        booking.confirmed_at = None
    elif normalized == models.BookingStatus.CONFIRMED.value:
        booking.confirmed_at = now
        booking.rejected_at = None
    elif normalized == models.BookingStatus.REJECTED.value:
        booking.rejected_at = now
        booking.accepted_at = None
        booking.confirmed_at = None

    note = (body.note or "").strip()
    if booking.user_id:
        title = "Booking status updated"
        msg = f"Status: {normalized.replace('_', ' ').title()}"
        if note:
            msg = f"{msg}\n\n{note}"
        db.add(
            models.Notification(
                user_id=booking.user_id,
                type=models.NotificationType.BOOKING,
                title=title,
                body=msg[:600],
                link_url="/dashboard/bookings",
                is_read=False,
            )
        )

    db.commit()
    db.refresh(booking)
    _format_package(booking.package)
    return booking

@router.post("/{booking_id}/request-more-info", response_model=schemas.Booking)
def request_more_info(
    booking_id: int,
    agency_id: int,
    body: schemas.BookingRequestMoreInfoRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    booking = (
        db.query(models.Booking)
        .options(joinedload(models.Booking.package).joinedload(models.Package.agency))
        .filter(models.Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value != "agency" or not user.agency_id:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Agency access required")
    resolved_agency_id = user.agency_id or agency_id
    if not booking.package or booking.package.agency_id != resolved_agency_id:
        raise HTTPException(status_code=403, detail="Not allowed to modify this booking")

    msg = (body.message or "").strip()
    if not msg:
        raise HTTPException(status_code=400, detail="Message is required")

    booking.more_info_message = msg
    db.add(
        models.Notification(
            user_id=booking.user_id,
            type=models.NotificationType.BOOKING,
            title="More information requested",
            body=msg[:400],
            link_url="/dashboard/bookings",
            is_read=False,
        )
    )
    db.commit()
    db.refresh(booking)
    _format_package(booking.package)
    return booking

@router.post("/{booking_id}/change-price", response_model=schemas.Booking)
def change_price(
    booking_id: int,
    agency_id: int,
    body: schemas.BookingChangePriceRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    booking = (
        db.query(models.Booking)
        .options(joinedload(models.Booking.package).joinedload(models.Package.agency))
        .filter(models.Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value != "agency" or not user.agency_id:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Agency access required")
    resolved_agency_id = user.agency_id or agency_id
    if not booking.package or booking.package.agency_id != resolved_agency_id:
        raise HTTPException(status_code=403, detail="Not allowed to modify this booking")

    if body.offered_total_price <= 0:
        raise HTTPException(status_code=400, detail="Invalid price")

    booking.offered_total_price = float(body.offered_total_price)
    booking.offer_message = (body.message or "").strip() or None
    booking.offer_sent_at = datetime.datetime.now(datetime.timezone.utc)
    booking.status = models.BookingStatus.PAYMENT_PENDING.value
    booking.payment_status = "awaiting_user_payment"

    note = f"New offer price: ${booking.offered_total_price:,.0f}"
    if booking.offer_message:
        note = f"{note}\n\n{booking.offer_message}"

    db.add(
        models.Notification(
            user_id=booking.user_id,
            type=models.NotificationType.BOOKING,
            title="New offer from the agency",
            body=note[:500],
            link_url="/dashboard/bookings",
            is_read=False,
        )
    )
    db.commit()
    db.refresh(booking)
    _format_package(booking.package)
    return booking

@router.post("/{booking_id}/send-offer", response_model=schemas.Booking)
def send_offer(
    booking_id: int,
    agency_id: int,
    body: schemas.BookingSendOfferRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    booking = (
        db.query(models.Booking)
        .options(joinedload(models.Booking.package).joinedload(models.Package.agency))
        .filter(models.Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value != "agency" or not user.agency_id:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Agency access required")
    resolved_agency_id = user.agency_id or agency_id
    if not booking.package or booking.package.agency_id != resolved_agency_id:
        raise HTTPException(status_code=403, detail="Not allowed to modify this booking")

    if body.offered_total_price is not None:
        if body.offered_total_price <= 0:
            raise HTTPException(status_code=400, detail="Invalid price")
        booking.offered_total_price = float(body.offered_total_price)

    booking.offer_message = (body.message or "").strip() or booking.offer_message
    booking.offer_sent_at = datetime.datetime.now(datetime.timezone.utc)
    booking.status = models.BookingStatus.PAYMENT_PENDING.value
    booking.payment_status = "awaiting_user_payment"

    resolved_price = booking.offered_total_price or booking.total_price
    note = f"Offer ready: ${float(resolved_price):,.0f}"
    if booking.offer_message:
        note = f"{note}\n\n{booking.offer_message}"

    db.add(
        models.Notification(
            user_id=booking.user_id,
            type=models.NotificationType.BOOKING,
            title="Offer received",
            body=note[:500],
            link_url="/dashboard/bookings",
            is_read=False,
        )
    )
    db.commit()
    db.refresh(booking)
    _format_package(booking.package)
    return booking

@router.delete("/{booking_id}")
def delete_booking(
    booking_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value != "admin":
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Admin access required")
    db_booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not db_booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    db.delete(db_booking)
    db.commit()
    return {"message": "Booking deleted successfully"}

@router.post("/{booking_id}/cancel", response_model=schemas.Booking)
def cancel_booking(
    booking_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    booking = (
        db.query(models.Booking)
        .options(joinedload(models.Booking.package).joinedload(models.Package.agency))
        .filter(models.Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.user_id != user.id:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Not allowed")
    if booking.status in (models.BookingStatus.CANCELLED.value, models.BookingStatus.COMPLETED.value, models.BookingStatus.REFUNDED.value):
        return booking
    booking.status = models.BookingStatus.CANCELLED.value
    db.add(
        models.Notification(
            user_id=user.id,
            type=models.NotificationType.BOOKING,
            title="Booking cancelled",
            body=f"Your booking for {booking.package.title if booking.package else 'a package'} was cancelled.",
            link_url="/dashboard/bookings",
            is_read=False,
        )
    )
    db.commit()
    db.refresh(booking)
    _format_package(booking.package)
    return booking

@router.post("/{booking_id}/confirm-payment", response_model=schemas.Booking)
def confirm_payment(
    booking_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    booking = (
        db.query(models.Booking)
        .options(joinedload(models.Booking.package).joinedload(models.Package.agency))
        .filter(models.Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.user_id != user.id:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Not allowed")

    status_val = (booking.status or "").lower()
    if status_val not in (
        models.BookingStatus.ACCEPTED.value,
        models.BookingStatus.PAYMENT_PENDING.value,
    ):
        return booking

    booking.payment_status = "paid"
    booking.status = models.BookingStatus.CONFIRMED.value
    booking.confirmed_at = datetime.datetime.now(datetime.timezone.utc)

    db.add(
        models.Notification(
            user_id=user.id,
            type=models.NotificationType.BOOKING,
            title="Payment confirmed",
            body=f"Payment received for {booking.package.title if booking.package else 'your booking'}.",
            link_url="/dashboard/bookings",
            is_read=False,
        )
    )
    db.commit()
    db.refresh(booking)
    _format_package(booking.package)
    return booking

@router.post("/{booking_id}/request-refund", response_model=schemas.Booking)
def request_refund(
    booking_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    booking = (
        db.query(models.Booking)
        .options(joinedload(models.Booking.package).joinedload(models.Package.agency))
        .filter(models.Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.user_id != user.id:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Not allowed")

    booking.status = models.BookingStatus.REFUND_REQUESTED.value
    db.commit()
    db.refresh(booking)
    _format_package(booking.package)
    return booking

@router.post("/{booking_id}/dispute", response_model=schemas.Booking)
def dispute_booking(
    booking_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    booking = (
        db.query(models.Booking)
        .options(joinedload(models.Booking.package).joinedload(models.Package.agency))
        .filter(models.Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.user_id != user.id:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Not allowed")

    booking.status = models.BookingStatus.DISPUTED.value
    db.commit()
    db.refresh(booking)
    _format_package(booking.package)
    return booking

@router.post("/{booking_id}/start", response_model=schemas.Booking)
def start_booking(
    booking_id: int,
    agency_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    booking = (
        db.query(models.Booking)
        .options(joinedload(models.Booking.package).joinedload(models.Package.agency))
        .filter(models.Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value != "agency" or not user.agency_id:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Agency access required")
    resolved_agency_id = user.agency_id or agency_id
    if not booking.package or booking.package.agency_id != resolved_agency_id:
        raise HTTPException(status_code=403, detail="Not allowed to modify this booking")

    if booking.status != models.BookingStatus.CONFIRMED.value:
        return booking
    booking.status = models.BookingStatus.IN_PROGRESS.value
    db.commit()
    db.refresh(booking)
    _format_package(booking.package)
    return booking

@router.post("/{booking_id}/complete", response_model=schemas.Booking)
def complete_booking(
    booking_id: int,
    agency_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    booking = (
        db.query(models.Booking)
        .options(joinedload(models.Booking.package).joinedload(models.Package.agency))
        .filter(models.Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    if role_value != "agency" or not user.agency_id:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Agency access required")
    resolved_agency_id = user.agency_id or agency_id
    if not booking.package or booking.package.agency_id != resolved_agency_id:
        raise HTTPException(status_code=403, detail="Not allowed to modify this booking")

    if booking.status != models.BookingStatus.IN_PROGRESS.value:
        return booking
    booking.status = models.BookingStatus.COMPLETED.value
    db.add(
        models.Notification(
            user_id=booking.user_id,
            type=models.NotificationType.BOOKING,
            title="Trip completed",
            body=f"Your trip for {booking.package.title if booking.package else 'a booking'} is marked as completed.",
            link_url="/dashboard/reviews",
            is_read=False,
        )
    )
    db.commit()
    db.refresh(booking)
    _format_package(booking.package)
    return booking
