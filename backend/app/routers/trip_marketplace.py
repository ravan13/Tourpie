from __future__ import annotations

import datetime
import json
import secrets
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from .. import database, models, schemas
from ..deps import get_current_user, require_roles


router = APIRouter()

TRAVEL_STYLES = {"luxury", "budget", "adventure", "family", "romantic", "solo", "group"}
PACKAGE_STATUSES = {"active", "published", "live", "available"}


def _utcnow() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def _parse_date(value: Optional[str]) -> Optional[datetime.date]:
    if not value:
        return None
    return datetime.date.fromisoformat(value)


def _parse_json_list(raw) -> List[str]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(x).strip() for x in raw if str(x).strip()]
    if not isinstance(raw, str):
        return []
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [str(x).strip() for x in parsed if str(x).strip()]
    except Exception:
        return []
    return []


def _serialize_json_list(value: List[str] | None) -> Optional[str]:
    if value is None:
        return None
    if not isinstance(value, list):
        return None
    items = [str(x).strip() for x in value if str(x).strip()]
    return json.dumps(items)


def _normalize(value: Optional[str]) -> str:
    return (value or "").strip().lower()


def _make_request_code() -> str:
    stamp = _utcnow().strftime("%Y%m%d")
    suffix = secrets.token_hex(3).upper()
    return f"TPR-{stamp}-{suffix}"


def _make_booking_code(db: Session) -> str:
    year = _utcnow().strftime("%Y")
    for _ in range(10):
        suffix_int = int(secrets.randbelow(999999)) + 1
        candidate = f"TP-{year}-{suffix_int:06d}"
        exists = db.query(func.count(models.TripBooking.id)).filter(models.TripBooking.booking_code == candidate).scalar()
        if not exists:
            return candidate
    fallback = secrets.token_hex(4).upper()
    return f"TP-{year}-{fallback}"


DEFAULT_BOOKING_CHECKLIST = [
    ("Passport", False),
    ("Visa", False),
    ("Flight", True),
    ("Hotel", True),
    ("Insurance", False),
    ("Airport Transfer", True),
    ("Currency Exchange", False),
    ("Luggage", False),
    ("Travel Documents", False),
]


def _append_timeline(db: Session, booking_id: int, event_type: str, *, actor_role: Optional[str] = None, actor_user_id: Optional[int] = None, note: Optional[str] = None) -> models.TripBookingTimelineEvent:
    ev = models.TripBookingTimelineEvent(
        booking_id=booking_id,
        event_type=event_type,
        actor_role=actor_role,
        actor_user_id=actor_user_id,
        note=note,
        created_at=_utcnow(),
    )
    db.add(ev)
    db.flush()
    return ev


def _offer_to_snapshot_dict(offer: models.TripOffer) -> dict:
    fields = [
        "id", "trip_request_id", "agency_id", "status",
        "price", "total_price", "currency",
        "hotel", "hotel_stars", "room_type", "meal_plan",
        "flight_included", "airport_transfer", "insurance_included", "visa_support",
        "breakfast_included", "lunch_included", "dinner_included",
        "flight", "transfer", "visa", "insurance",
        "activities", "travel_program", "included_services", "excluded_services",
        "offer_description", "additional_benefits", "notes",
        "expiration_date", "expires_at", "offer_expiration_hours",
        "price_difference_reason", "price_difference_notes",
        "offer_attachments", "attachments",
        "accepted_at", "submitted_at", "created_at",
    ]
    out = {}
    for f in fields:
        try:
            out[f] = getattr(offer, f, None)
        except Exception:
            out[f] = None
    return out


def _enrich_booking_summary(db: Session, booking: models.TripBooking) -> None:
    req = db.query(models.TripRequest).filter(models.TripRequest.id == booking.trip_request_id).first()
    if req:
        booking.request_code = getattr(req, "request_code", None)
        booking.destination = getattr(req, "destination", None)
        booking.start_date = getattr(req, "start_date", None)
        booking.end_date = getattr(req, "end_date", None)
        booking.duration = getattr(req, "duration", None)
    offer = db.query(models.TripOffer).filter(models.TripOffer.id == booking.trip_offer_id).first()
    if offer:
        booking.total_price = _effective_offer_price(offer)
        booking.currency = _normalize_currency(getattr(offer, "currency", None))
    agency = db.query(models.Agency).filter(models.Agency.id == booking.agency_id).first()
    if agency:
        booking.agency_name = getattr(agency, "name", None)
        booking.agency_rating = float(getattr(agency, "rating", 0) or 0) or None
        booking.agency_reviews_count = getattr(agency, "reviews_count", None)
    docs = db.query(func.count(models.TripBookingDocument.id)).filter(models.TripBookingDocument.booking_id == booking.id).scalar()
    booking.documents_count = int(docs or 0)
    pending = (
        db.query(func.count(models.TripBookingDocument.id))
        .filter(models.TripBookingDocument.booking_id == booking.id)
        .filter(models.TripBookingDocument.status != models.TripBookingDocumentStatus.APPROVED)
        .scalar()
    )
    booking.pending_documents_count = int(pending or 0)
    pcount = db.query(func.count(models.TripBookingPaymentRecord.id)).filter(models.TripBookingPaymentRecord.booking_id == booking.id).scalar()
    booking.payments_count = int(pcount or 0)
    ct = db.query(func.count(models.TripBookingChecklistItem.id)).filter(models.TripBookingChecklistItem.booking_id == booking.id).scalar()
    cc = db.query(func.count(models.TripBookingChecklistItem.id)).filter(models.TripBookingChecklistItem.booking_id == booking.id, models.TripBookingChecklistItem.is_completed.is_(True)).scalar()
    booking.checklist_total = int(ct or 0)
    booking.checklist_completed = int(cc or 0)
    rv = db.query(models.TripBookingReview).filter(models.TripBookingReview.booking_id == booking.id, models.TripBookingReview.is_hidden.is_(False)).first()
    booking.review_submitted = rv is not None
    offer_dict = _offer_to_snapshot_dict(offer) if offer else None
    booking.offer_accepted = offer_dict
    booking.agreement = {
        "booking_id": booking.id,
        "booking_code": booking.booking_code,
        "destination": booking.destination,
        "start_date": booking.start_date,
        "end_date": booking.end_date,
        "duration": booking.duration,
        "total_price": booking.total_price,
        "currency": booking.currency,
    }


def _require_user_owns_request(user: models.User, row: models.TripRequest) -> None:
    if row.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")


def _require_agency_access(user: models.User) -> int:
    if user.role != models.UserRole.AGENCY:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    agency_id = user.agency_id
    if not isinstance(agency_id, int):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Agency not linked")
    return agency_id


def _agency_is_matchable(agency: models.Agency) -> bool:
    if _normalize(getattr(agency, "status", None)) != "approved":
        return False
    if not bool(getattr(agency, "custom_trip_requests_enabled", False)):
        return False
    return True


def _agency_recipient_user_ids(db: Session, agency_id: int) -> List[int]:
    rows = (
        db.query(models.User.id)
        .filter(models.User.agency_id == agency_id)
        .filter(models.User.role == models.UserRole.AGENCY)
        .all()
    )
    return [r[0] for r in rows if isinstance(r[0], int)]


def _notify_user(
    db: Session,
    user_id: int,
    title: str,
    body: str | None = None,
    link_url: str | None = None,
    trip_request_id: int | None = None,
    trip_offer_id: int | None = None,
    notif_type: str = "system",
) -> None:
    try:
        db.add(
            models.TripOfferNotification(
                recipient_user_id=user_id,
                trip_request_id=trip_request_id,
                trip_offer_id=trip_offer_id,
                type=notif_type,
                title=title,
                body=body,
                link_url=link_url,
            )
        )
    except Exception:
        pass
    try:
        db.add(
            models.Notification(
                user_id=user_id,
                type=models.NotificationType.SYSTEM,
                title=title,
                body=body,
                link_url=link_url,
            )
        )
    except Exception:
        pass


def _notify_many(
    db: Session,
    user_ids: List[int],
    title: str,
    body: str | None = None,
    link_url: str | None = None,
    trip_request_id: int | None = None,
    trip_offer_id: int | None = None,
    notif_type: str = "system",
) -> None:
    seen = set()
    for uid in user_ids:
        if not isinstance(uid, int) or uid in seen:
            continue
        seen.add(uid)
        _notify_user(db, uid, title, body, link_url, trip_request_id, trip_offer_id, notif_type)


def _effective_budget(req: models.TripRequest) -> tuple[Optional[float], str]:
    amount = None
    for candidate in (getattr(req, "budget", None), getattr(req, "ideal_budget", None)):
        if isinstance(candidate, (int, float)) and candidate > 0:
            amount = float(candidate)
            break
    currency = _normalize_currency(getattr(req, "currency", None)) or _normalize_currency(getattr(req, "budget_currency", None)) or "USD"
    return amount, currency


def _effective_offer_price(offer: models.TripOffer) -> Optional[float]:
    for candidate in (getattr(offer, "price", None), getattr(offer, "total_price", None)):
        if isinstance(candidate, (int, float)):
            return float(candidate)
    return None


def _normalize_currency(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    code = str(value).upper().strip()
    if len(code) != 3:
        return None
    return code


def _budget_status(req: models.TripRequest, offer_price: float) -> tuple[str, float | None, float | None]:
    ideal = 0.0
    max_budget: Optional[float] = None
    if isinstance(req.ideal_budget, (int, float)):
        ideal = float(req.ideal_budget)
    if isinstance(req.budget, (int, float)) and ideal == 0:
        ideal = float(req.budget)
    if isinstance(req.max_budget, (int, float)):
        max_budget = float(req.max_budget)
    if offer_price <= ideal:
        return ("within_ideal", offer_price - ideal, None)
    if max_budget is not None and offer_price <= max_budget:
        return ("within_maximum", offer_price - ideal, offer_price - max_budget)
    if max_budget is not None and offer_price > max_budget:
        return ("above_maximum", offer_price - ideal, offer_price - max_budget)
    return ("above_ideal", offer_price - ideal, None)


def _validate_request_for_submit(body: schemas.TripRequestCreateRequest | schemas.TripRequestUpdateRequest) -> None:
    destination = _normalize(getattr(body, "destination", None) or getattr(body, "country", None) or getattr(body, "city", None))
    if not destination:
        raise HTTPException(status_code=400, detail="Destination is required")
    adults = int(getattr(body, "adults", 1) or 1)
    children = int(getattr(body, "children", 0) or 0)
    if adults < 1:
        raise HTTPException(status_code=400, detail="Adults must be at least 1")
    if children < 0:
        raise HTTPException(status_code=400, detail="Children must be 0 or more")

    budget_value: Optional[float] = None
    for attr in ("ideal_budget", "budget"):
        val = getattr(body, attr, None)
        if isinstance(val, (int, float)):
            budget_value = float(val)
            break
    if budget_value is None or budget_value <= 0:
        raise HTTPException(status_code=400, detail="Budget must be greater than 0")

    max_budget = getattr(body, "max_budget", None)
    if isinstance(max_budget, (int, float)) and budget_value is not None and max_budget < budget_value:
        raise HTTPException(status_code=400, detail="Maximum budget must be greater than or equal to budget")

    flexible_dates = bool(getattr(body, "flexible_dates", False))
    if not flexible_dates:
        start_date = _parse_date(getattr(body, "start_date", None))
        end_date = _parse_date(getattr(body, "end_date", None))
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="Travel dates are required unless flexible")
        if start_date > end_date:
            raise HTTPException(status_code=400, detail="Start date must be before end date")


def _apply_request_body(row: models.TripRequest, body: schemas.TripRequestCreateRequest | schemas.TripRequestUpdateRequest) -> None:
    fields = [
        "destination",
        "destination_type",
        "country",
        "city",
        "flexible_dates",
        "duration",
        "adults",
        "children",
        "ideal_budget",
        "max_budget",
        "budget",
        "currency",
        "budget_currency",
        "budget_flexibility",
        "hotel_stars",
        "meal_type",
        "meal_preference",
        "transportation",
        "flight_included",
        "transfer_included",
        "visa_assistance",
        "visa_required",
        "travel_insurance",
        "travel_style",
        "preferred_airline",
        "accommodation_preferences",
        "activities_interests",
        "special_notes",
        "special_requirements",
        "notes",
        "offer_expiration_hours",
    ]
    for field in fields:
        if not hasattr(body, field):
            continue
        value = getattr(body, field)
        if value is None:
            continue
        if field == "destination_type":
            try:
                setattr(row, field, models.TripDestinationType(str(value)))
            except Exception:
                pass
            continue
        if field == "budget_flexibility":
            try:
                setattr(row, field, models.TripBudgetFlexibility(str(value)))
            except Exception:
                pass
            continue
        if field == "start_date":
            setattr(row, field, _parse_date(str(value)))
            continue
        if field == "end_date":
            setattr(row, field, _parse_date(str(value)))
            continue
        if field == "duration":
            try:
                n = int(value)
            except Exception:
                continue
            if n <= 0:
                continue
            setattr(row, field, n)
            continue
        if field == "adults":
            setattr(row, field, max(1, int(value)))
            continue
        if field == "children":
            setattr(row, field, max(0, int(value)))
            continue
        if field == "budget_currency" or field == "currency":
            setattr(row, field, _normalize_currency(str(value)) or "USD")
            continue
        if field == "ideal_budget" or field == "max_budget" or field == "budget":
            try:
                n = float(value)
            except Exception:
                continue
            if n < 0:
                continue
            setattr(row, field, n)
            continue
        if field == "hotel_stars":
            try:
                n = int(value)
            except Exception:
                continue
            if 1 <= n <= 7:
                setattr(row, field, n)
            continue
        if field == "offer_expiration_hours":
            hours_value = int(value) if int(value) in (24, 48, 72) else 48
            setattr(row, field, hours_value)
            continue
        if field in ("flight_included", "transfer_included", "visa_assistance", "visa_required", "travel_insurance", "flexible_dates"):
            setattr(row, field, bool(value))
            continue
        if field == "travel_style":
            norm = _normalize(value)
            if norm in TRAVEL_STYLES:
                setattr(row, field, norm)
            else:
                setattr(row, field, value)
            continue
        if isinstance(value, str):
            trimmed = value.strip() or None
            setattr(row, field, trimmed)
            continue
        setattr(row, field, value)

    if hasattr(body, "attachments") and getattr(body, "attachments", None) is not None:
        row.attachments = _serialize_json_list(getattr(body, "attachments"))

    start_date = None
    end_date = None
    if hasattr(body, "start_date"):
        start_value = getattr(body, "start_date", None)
        if start_value is not None:
            start_date = _parse_date(start_value)
            if start_date:
                row.start_date = start_date
    if hasattr(body, "end_date"):
        end_value = getattr(body, "end_date", None)
        if end_value is not None:
            end_date = _parse_date(end_value)
            if end_date:
                row.end_date = end_date

    if getattr(row, "budget_currency", None) is None:
        row.budget_currency = "USD"

    if getattr(row, "travel_style", None) is None:
        country_style = _normalize(getattr(body, "travel_style", None))
        if country_style in TRAVEL_STYLES:
            row.travel_style = country_style

    if not row.destination:
        if row.country:
            row.destination = row.country
        elif row.city:
            row.destination = row.city

    if getattr(body, "flexible_dates", False):
        row.start_date = None
        row.end_date = None


def _match_request_to_agencies(db: Session, req: models.TripRequest) -> List[models.Agency]:
    now = _utcnow()
    agencies = db.query(models.Agency).all()
    country = _normalize(req.country or "")
    city = _normalize(req.city or "")
    destination = _normalize(req.destination or "")
    start_date = req.start_date
    end_date = req.end_date
    results: List[models.Agency] = []

    for agency in agencies:
        if not _agency_is_matchable(agency):
            continue

        countries = set(_parse_json_list(getattr(agency, "countries_served", None)))
        cities = set(_parse_json_list(getattr(agency, "cities_served", None)))
        norm_countries = {_normalize(x) for x in countries}
        norm_cities = {_normalize(x) for x in cities}

        destination_match = False
        if not norm_countries and not norm_cities:
            destination_match = True
        else:
            if country and country in norm_countries:
                destination_match = True
            elif city and city in norm_cities:
                destination_match = True
            elif destination and (destination in norm_countries or destination in norm_cities):
                destination_match = True

        if not destination_match:
            package_cover = (
                db.query(models.Package)
                .filter(models.Package.agency_id == agency.id)
                .filter(
                    or_(
                        func.lower(models.Package.status).in_(list(PACKAGE_STATUSES)),
                        models.Package.status.is_(None),
                    )
                )
                .filter(
                    or_(
                        func.lower(func.coalesce(models.Package.country, "")) == country if country else False,
                        func.lower(func.coalesce(models.Package.city, "")) == city if city else False,
                        func.lower(func.coalesce(models.Package.destination, "")) == destination if destination else False,
                    )
                )
                .first()
            )
            if not package_cover:
                continue

        if start_date and end_date:
            blocked = (
                db.query(models.AgencyAvailability)
                .filter(models.AgencyAvailability.agency_id == agency.id)
                .filter(models.AgencyAvailability.date >= start_date)
                .filter(models.AgencyAvailability.date <= end_date)
                .filter(models.AgencyAvailability.is_blocked == True)
                .first()
            )
            if blocked:
                continue

        results.append(agency)
    return results


def _sync_comparison(db: Session, req: models.TripRequest, offer: models.TripOffer) -> None:
    price = _effective_offer_price(offer)
    if price is None or price <= 0:
        return
    budget_status, delta_ideal, delta_max = _budget_status(req, price)
    comparison = (
        db.query(models.OfferComparison)
        .filter(models.OfferComparison.trip_offer_id == offer.id)
        .first()
    )
    if not comparison:
        db.add(
            models.OfferComparison(
                trip_request_id=req.id,
                trip_offer_id=offer.id,
                ideal_budget=float(req.ideal_budget or req.budget or 0),
                max_budget=float(req.max_budget) if isinstance(req.max_budget, (int, float)) else None,
                offer_price=price,
                budget_status=budget_status,
                delta_from_ideal=float(delta_ideal) if delta_ideal is not None else None,
                delta_from_max=float(delta_max) if delta_max is not None else None,
                created_at=_utcnow(),
            )
        )
        return
    comparison.ideal_budget = float(req.ideal_budget or req.budget or 0)
    comparison.max_budget = float(req.max_budget) if isinstance(req.max_budget, (int, float)) else None
    comparison.offer_price = price
    comparison.budget_status = budget_status
    comparison.delta_from_ideal = float(delta_ideal) if delta_ideal is not None else None
    comparison.delta_from_max = float(delta_max) if delta_max is not None else None


def _enrich_request(db: Session, req: models.TripRequest) -> None:
    offers_count = (
        db.query(func.count(models.TripOffer.id))
        .filter(models.TripOffer.trip_request_id == req.id)
        .filter(models.TripOffer.status == models.TripOfferStatus.SUBMITTED)
        .scalar()
        or 0
    )
    matches_count = (
        db.query(func.count(models.TripRequestAgencyMatch.id))
        .filter(models.TripRequestAgencyMatch.trip_request_id == req.id)
        .scalar()
        or 0
    )
    req.offers_count = int(offers_count)
    req.matches_count = int(matches_count)


def _enrich_many_requests(db: Session, rows: List[models.TripRequest]) -> None:
    if not rows:
        return
    ids = [r.id for r in rows]
    offer_counts = dict(
        db.query(models.TripOffer.trip_request_id, func.count(models.TripOffer.id))
        .filter(models.TripOffer.trip_request_id.in_(ids))
        .filter(models.TripOffer.status == models.TripOfferStatus.SUBMITTED)
        .group_by(models.TripOffer.trip_request_id)
        .all()
    )
    match_counts = dict(
        db.query(models.TripRequestAgencyMatch.trip_request_id, func.count(models.TripRequestAgencyMatch.id))
        .filter(models.TripRequestAgencyMatch.trip_request_id.in_(ids))
        .group_by(models.TripRequestAgencyMatch.trip_request_id)
        .all()
    )
    for r in rows:
        r.offers_count = int(offer_counts.get(r.id, 0) or 0)
        r.matches_count = int(match_counts.get(r.id, 0) or 0)


def _apply_request_lifecycle(db: Session, rows: List[models.TripRequest]) -> None:
    now = _utcnow()
    changed = False
    for row in rows:
        status_value = getattr(row.status, "value", row.status) if row.status else None
        if status_value in ("draft", "cancelled", "accepted", "completed", "archived"):
            continue
        if row.expires_at and now >= row.expires_at and status_value != "expired":
            row.status = models.TripRequestStatus.EXPIRED
            changed = True
    if changed:
        db.flush()


def _apply_offer_lifecycle(db: Session, offers: List[models.TripOffer]) -> None:
    now = _utcnow()
    changed = False
    for offer in offers:
        status_value = getattr(offer.status, "value", offer.status) if offer.status else None
        if status_value in ("accepted", "rejected", "declined", "cancelled"):
            continue
        if status_value == "draft":
            continue
        if offer.expires_at and now >= offer.expires_at and status_value != "expired":
            offer.status = models.TripOfferStatus.EXPIRED
            offer.updated_at = now
            changed = True
    if changed:
        db.flush()


@router.post("/trip-requests", response_model=schemas.TripRequest)
def create_trip_request(
    body: schemas.TripRequestCreateRequest,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("user")),
):
    now = _utcnow()
    save_as_draft = bool(getattr(body, "save_as_draft", False))
    if not save_as_draft:
        _validate_request_for_submit(body)

    try:
        dest_type = models.TripDestinationType(body.destination_type)
    except Exception:
        dest_type = models.TripDestinationType.ANY
    try:
        budget_flex = models.TripBudgetFlexibility(body.budget_flexibility)
    except Exception:
        budget_flex = models.TripBudgetFlexibility.FIXED

    request_code = _make_request_code()
    budget_currency = _normalize_currency(body.budget_currency) or "USD"
    offer_expiration_hours = int(body.offer_expiration_hours) if int(body.offer_expiration_hours) in (24, 48, 72) else 48

    status = models.TripRequestStatus.DRAFT if save_as_draft else models.TripRequestStatus.ACTIVE
    expires_at: Optional[datetime.datetime] = None
    submitted_at: Optional[datetime.datetime] = None
    if not save_as_draft:
        expires_at = now + datetime.timedelta(hours=offer_expiration_hours)
        submitted_at = now

    row = models.TripRequest(
        request_code=request_code,
        user_id=user.id,
        destination_type=dest_type,
        budget_flexibility=budget_flex,
        budget_currency=budget_currency,
        offer_expiration_hours=offer_expiration_hours,
        status=status,
        expires_at=expires_at,
        submitted_at=submitted_at,
        created_at=now,
        updated_at=now,
    )
    _apply_request_body(row, body)
    db.add(row)
    db.flush()

    if not save_as_draft:
        agencies = _match_request_to_agencies(db, row)
        if agencies:
            row.status = models.TripRequestStatus.RECEIVING_OFFERS
            db.add(row)
            for agency in agencies:
                existing_match = (
                    db.query(models.TripRequestAgencyMatch)
                    .filter(models.TripRequestAgencyMatch.trip_request_id == row.id)
                    .filter(models.TripRequestAgencyMatch.agency_id == agency.id)
                    .first()
                )
                if not existing_match:
                    match_row = models.TripRequestAgencyMatch(
                        trip_request_id=row.id,
                        agency_id=agency.id,
                        status=models.MatchAgencyStatus.PENDING.value,
                        created_at=now,
                    )
                    db.add(match_row)
            db.flush()
            for agency in agencies:
                recipient_ids = _agency_recipient_user_ids(db, agency.id)
                _notify_many(
                    db,
                    recipient_ids,
                    title="New Custom Trip Request",
                    body=f"Request {row.request_code} matches your coverage area.",
                    link_url=f"/agency/incoming-requests/{row.id}",
                    trip_request_id=row.id,
                    notif_type="new_matching_request",
                )
        else:
            row.status = models.TripRequestStatus.ACTIVE
        _notify_user(
            db,
            user.id,
            title="Trip Request Submitted",
            body=f"Your request {row.request_code} is being shared with eligible agencies.",
            link_url=f"/dashboard/requests?tab=active",
            trip_request_id=row.id,
            notif_type="request_submitted",
        )

    db.commit()
    db.refresh(row)
    _enrich_request(db, row)
    return row


@router.post("/trip-requests/{trip_request_id}/duplicate", response_model=schemas.TripRequest)
def duplicate_trip_request(
    trip_request_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("user")),
):
    src = db.query(models.TripRequest).filter(models.TripRequest.id == trip_request_id).first()
    if not src:
        raise HTTPException(status_code=404, detail="Trip request not found")
    _require_user_owns_request(user, src)
    now = _utcnow()
    dest_type = getattr(src, "destination_type", models.TripDestinationType.ANY)
    budget_flex = getattr(src, "budget_flexibility", models.TripBudgetFlexibility.FIXED)
    clone = models.TripRequest(
        request_code=_make_request_code(),
        user_id=user.id,
        destination=src.destination,
        destination_type=dest_type,
        country=src.country,
        city=src.city,
        start_date=src.start_date,
        end_date=src.end_date,
        flexible_dates=bool(src.flexible_dates),
        duration=src.duration,
        adults=src.adults,
        children=src.children,
        ideal_budget=src.ideal_budget,
        max_budget=src.max_budget,
        budget=src.budget,
        currency=src.currency,
        budget_currency=src.budget_currency or "USD",
        budget_flexibility=budget_flex,
        hotel_stars=src.hotel_stars,
        meal_type=src.meal_type,
        meal_preference=src.meal_preference,
        transportation=src.transportation,
        flight_included=bool(src.flight_included),
        transfer_included=bool(src.transfer_included),
        visa_assistance=bool(src.visa_assistance),
        visa_required=bool(src.visa_required),
        travel_insurance=bool(src.travel_insurance),
        travel_style=src.travel_style,
        preferred_airline=src.preferred_airline,
        accommodation_preferences=src.accommodation_preferences,
        activities_interests=src.activities_interests,
        special_notes=src.special_notes,
        special_requirements=src.special_requirements,
        notes=src.notes,
        attachments=src.attachments,
        offer_expiration_hours=int(src.offer_expiration_hours or 48),
        status=models.TripRequestStatus.DRAFT,
        created_at=now,
        updated_at=now,
    )
    db.add(clone)
    db.commit()
    db.refresh(clone)
    _enrich_request(db, clone)
    return clone


@router.get("/trip-requests/me", response_model=List[schemas.TripRequest])
def list_my_trip_requests(
    status: Optional[str] = Query(default=None),
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("user")),
):
    now = _utcnow()
    query = db.query(models.TripRequest).filter(models.TripRequest.user_id == user.id)
    include_archived = False
    if status:
        status_norm = _normalize(status)
        if status_norm == "active":
            query = query.filter(
                or_(
                    models.TripRequest.status == models.TripRequestStatus.ACTIVE,
                    models.TripRequest.status == models.TripRequestStatus.SUBMITTED,
                    models.TripRequest.status == models.TripRequestStatus.SEARCHING_AGENCIES,
                    models.TripRequest.status == models.TripRequestStatus.RECEIVING_OFFERS,
                    models.TripRequest.status == models.TripRequestStatus.COMPARING_OFFERS,
                )
            )
        elif status_norm == "drafts":
            query = query.filter(models.TripRequest.status == models.TripRequestStatus.DRAFT)
        elif status_norm == "waiting_offers":
            query = query.filter(models.TripRequest.status == models.TripRequestStatus.RECEIVING_OFFERS)
        elif status_norm == "completed":
            query = query.filter(
                or_(
                    models.TripRequest.status == models.TripRequestStatus.COMPLETED,
                    models.TripRequest.status == models.TripRequestStatus.ACCEPTED,
                )
            )
        elif status_norm == "cancelled":
            query = query.filter(models.TripRequest.status == models.TripRequestStatus.CANCELLED)
        elif status_norm == "archived":
            query = query.filter(models.TripRequest.status == models.TripRequestStatus.ARCHIVED)
            include_archived = True
        elif status_norm == "expired":
            query = query.filter(models.TripRequest.status == models.TripRequestStatus.EXPIRED)
    if not include_archived:
        query = query.filter(or_(models.TripRequest.status != models.TripRequestStatus.ARCHIVED, models.TripRequest.status.is_(None)))
    rows = query.order_by(models.TripRequest.created_at.desc()).limit(500).all()
    _apply_request_lifecycle(db, rows)
    rows_with_offers = []
    expired_rows = []
    for row in rows:
        status_value = getattr(row.status, "value", row.status) if row.status else None
        if status_value == "expired":
            expired_rows.append(row)
    rows_with_offers.extend(rows)
    db.flush()
    _enrich_many_requests(db, rows)
    db.commit()
    for row in rows:
        db.refresh(row)
    return rows


@router.get("/trip-requests/{trip_request_id}", response_model=schemas.TripRequest)
def get_trip_request(
    trip_request_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    row = db.query(models.TripRequest).filter(models.TripRequest.id == trip_request_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Trip request not found")
    if user.role == models.UserRole.USER:
        _require_user_owns_request(user, row)
    elif user.role == models.UserRole.AGENCY:
        agency_id = _require_agency_access(user)
        allowed = (
            db.query(models.TripRequestAgencyMatch)
            .filter(models.TripRequestAgencyMatch.trip_request_id == row.id)
            .filter(models.TripRequestAgencyMatch.agency_id == agency_id)
            .first()
        )
        if not allowed:
            raise HTTPException(status_code=403, detail="Not allowed")
    elif user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not allowed")
    _enrich_request(db, row)
    return row


@router.patch("/trip-requests/{trip_request_id}", response_model=schemas.TripRequest)
def update_trip_request(
    trip_request_id: int,
    body: schemas.TripRequestUpdateRequest,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("user")),
):
    row = db.query(models.TripRequest).filter(models.TripRequest.id == trip_request_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Trip request not found")
    _require_user_owns_request(user, row)
    now = _utcnow()

    status_value = getattr(row.status, "value", row.status) if row.status else None
    if status_value in ("accepted", "completed", "cancelled", "archived"):
        raise HTTPException(status_code=400, detail="Request is no longer editable")

    want_submit = bool(getattr(body, "submit", False))
    if want_submit:
        merged = schemas.TripRequestCreateRequest(
            destination=body.destination if body.destination is not None else row.destination,
            destination_type=body.destination_type if body.destination_type is not None else (getattr(row.destination_type, "value", row.destination_type) if row.destination_type else "any"),
            country=body.country if body.country is not None else row.country,
            city=body.city if body.city is not None else row.city,
            start_date=body.start_date if body.start_date is not None else (row.start_date.isoformat() if row.start_date else None),
            end_date=body.end_date if body.end_date is not None else (row.end_date.isoformat() if row.end_date else None),
            flexible_dates=body.flexible_dates if body.flexible_dates is not None else bool(row.flexible_dates),
            duration=body.duration if body.duration is not None else row.duration,
            adults=body.adults if body.adults is not None else row.adults,
            children=body.children if body.children is not None else row.children,
            ideal_budget=body.ideal_budget if body.ideal_budget is not None else row.ideal_budget,
            max_budget=body.max_budget if body.max_budget is not None else row.max_budget,
            budget=body.budget if body.budget is not None else row.budget,
            currency=body.currency if body.currency is not None else row.currency,
            budget_currency=body.budget_currency if body.budget_currency is not None else (row.budget_currency or "USD"),
            budget_flexibility=body.budget_flexibility if body.budget_flexibility is not None else (getattr(row.budget_flexibility, "value", row.budget_flexibility) if row.budget_flexibility else "fixed"),
            hotel_stars=body.hotel_stars if body.hotel_stars is not None else row.hotel_stars,
            meal_type=body.meal_type if body.meal_type is not None else row.meal_type,
            meal_preference=body.meal_preference if body.meal_preference is not None else row.meal_preference,
            transportation=body.transportation if body.transportation is not None else row.transportation,
            flight_included=body.flight_included if body.flight_included is not None else bool(row.flight_included),
            transfer_included=body.transfer_included if body.transfer_included is not None else bool(row.transfer_included),
            visa_assistance=body.visa_assistance if body.visa_assistance is not None else bool(row.visa_assistance),
            visa_required=body.visa_required if body.visa_required is not None else bool(row.visa_required),
            travel_insurance=body.travel_insurance if body.travel_insurance is not None else bool(row.travel_insurance),
            travel_style=body.travel_style if body.travel_style is not None else row.travel_style,
            preferred_airline=body.preferred_airline if body.preferred_airline is not None else row.preferred_airline,
            accommodation_preferences=body.accommodation_preferences if body.accommodation_preferences is not None else row.accommodation_preferences,
            activities_interests=body.activities_interests if body.activities_interests is not None else row.activities_interests,
            special_notes=body.special_notes if body.special_notes is not None else row.special_notes,
            special_requirements=body.special_requirements if body.special_requirements is not None else row.special_requirements,
            notes=body.notes if body.notes is not None else row.notes,
            attachments=body.attachments if body.attachments is not None else _parse_json_list(row.attachments),
            offer_expiration_hours=body.offer_expiration_hours if body.offer_expiration_hours is not None else int(row.offer_expiration_hours or 48),
            save_as_draft=False,
        )
        _validate_request_for_submit(merged)

    _apply_request_body(row, body)
    row.updated_at = now

    if want_submit:
        offer_expiration_hours = int(row.offer_expiration_hours or 48)
        row.expires_at = now + datetime.timedelta(hours=offer_expiration_hours)
        row.submitted_at = now
        agencies = _match_request_to_agencies(db, row)
        if agencies:
            row.status = models.TripRequestStatus.RECEIVING_OFFERS
            for agency in agencies:
                existing = (
                    db.query(models.TripRequestAgencyMatch)
                    .filter(models.TripRequestAgencyMatch.trip_request_id == row.id)
                    .filter(models.TripRequestAgencyMatch.agency_id == agency.id)
                    .first()
                )
                if not existing:
                    db.add(
                        models.TripRequestAgencyMatch(
                            trip_request_id=row.id,
                            agency_id=agency.id,
                            status=models.MatchAgencyStatus.PENDING.value,
                            created_at=now,
                        )
                    )
                    recipient_ids = _agency_recipient_user_ids(db, agency.id)
                    _notify_many(
                        db,
                        recipient_ids,
                        title="New Custom Trip Request",
                        body=f"Request {row.request_code} matches your coverage area.",
                        link_url=f"/agency/incoming-requests/{row.id}",
                        trip_request_id=row.id,
                        notif_type="new_matching_request",
                    )
        else:
            row.status = models.TripRequestStatus.ACTIVE
        _notify_user(
            db,
            user.id,
            title="Trip Request Submitted",
            body=f"Your request {row.request_code} is being shared with eligible agencies.",
            link_url=f"/dashboard/requests?tab=active",
            trip_request_id=row.id,
            notif_type="request_submitted",
        )
    else:
        if status_value == "expired":
            row.status = models.TripRequestStatus.DRAFT
            row.expires_at = None

    db.add(row)
    db.commit()
    db.refresh(row)
    _enrich_request(db, row)
    return row


@router.delete("/trip-requests/{trip_request_id}", response_model=dict)
def delete_trip_request(
    trip_request_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("user")),
):
    row = db.query(models.TripRequest).filter(models.TripRequest.id == trip_request_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Trip request not found")
    _require_user_owns_request(user, row)
    status_value = getattr(row.status, "value", row.status) if row.status else None
    if status_value not in (None, "draft", "cancelled", "expired", "archived"):
        raise HTTPException(status_code=400, detail="Only draft/cancelled/expired/archived requests can be deleted")
    db.delete(row)
    db.commit()
    return {"deleted": True}


@router.post("/trip-requests/{trip_request_id}/submit", response_model=schemas.TripRequest)
def submit_trip_request(
    trip_request_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("user")),
):
    return update_trip_request(
        trip_request_id=trip_request_id,
        body=schemas.TripRequestUpdateRequest(submit=True),
        db=db,
        user=user,
        _={},
    )


@router.post("/trip-requests/{trip_request_id}/cancel", response_model=schemas.TripRequest)
def cancel_trip_request(
    trip_request_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("user")),
):
    row = db.query(models.TripRequest).filter(models.TripRequest.id == trip_request_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Trip request not found")
    _require_user_owns_request(user, row)
    status_value = getattr(row.status, "value", row.status) if row.status else None
    if status_value == "accepted":
        raise HTTPException(status_code=400, detail="Request already accepted")
    row.status = models.TripRequestStatus.CANCELLED
    row.updated_at = _utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
    _enrich_request(db, row)
    return row


@router.post("/trip-requests/{trip_request_id}/archive", response_model=schemas.TripRequest)
def archive_trip_request(
    trip_request_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("user")),
):
    row = db.query(models.TripRequest).filter(models.TripRequest.id == trip_request_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Trip request not found")
    _require_user_owns_request(user, row)
    row.status = models.TripRequestStatus.ARCHIVED
    row.archived_at = _utcnow()
    row.updated_at = _utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
    _enrich_request(db, row)
    return row


@router.post("/trip-requests/{trip_request_id}/rematch", response_model=schemas.TripRequest)
def rematch_trip_request(
    trip_request_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("admin", "user")),
):
    row = db.query(models.TripRequest).filter(models.TripRequest.id == trip_request_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Trip request not found")
    if user.role == models.UserRole.USER:
        _require_user_owns_request(user, row)
    now = _utcnow()
    status_value = getattr(row.status, "value", row.status) if row.status else None
    if status_value in ("accepted", "completed", "archived", "cancelled"):
        raise HTTPException(status_code=400, detail="Request is not rematchable")

    agencies = _match_request_to_agencies(db, row)
    added = 0
    for agency in agencies:
        existing = (
            db.query(models.TripRequestAgencyMatch)
            .filter(models.TripRequestAgencyMatch.trip_request_id == row.id)
            .filter(models.TripRequestAgencyMatch.agency_id == agency.id)
            .first()
        )
        if existing:
            continue
        db.add(
            models.TripRequestAgencyMatch(
                trip_request_id=row.id,
                agency_id=agency.id,
                status=models.MatchAgencyStatus.PENDING.value,
                created_at=now,
            )
        )
        recipient_ids = _agency_recipient_user_ids(db, agency.id)
        _notify_many(
            db,
            recipient_ids,
            title="New Custom Trip Request",
            body=f"Request {row.request_code} matches your coverage area.",
            link_url=f"/agency/incoming-requests/{row.id}",
            trip_request_id=row.id,
            notif_type="new_matching_request",
        )
        added += 1
    if added:
        row.status = models.TripRequestStatus.RECEIVING_OFFERS
    else:
        row.status = models.TripRequestStatus.ACTIVE
    if row.offer_expiration_hours and not row.expires_at or (row.expires_at and row.expires_at < now):
        row.expires_at = now + datetime.timedelta(hours=int(row.offer_expiration_hours or 48))
    row.updated_at = now
    db.add(row)
    db.commit()
    db.refresh(row)
    _enrich_request(db, row)
    return row


@router.get("/trip-requests/{trip_request_id}/offers", response_model=List[schemas.TripOffer])
def list_trip_request_offers(
    trip_request_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("user")),
):
    req = db.query(models.TripRequest).filter(models.TripRequest.id == trip_request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Trip request not found")
    _require_user_owns_request(user, req)
    offers = (
        db.query(models.TripOffer)
        .filter(models.TripOffer.trip_request_id == trip_request_id)
        .order_by(models.TripOffer.created_at.desc())
        .all()
    )
    _apply_offer_lifecycle(db, offers)
    for offer in offers:
        _sync_comparison(db, req, offer)
    db.commit()
    return offers


@router.get("/trip-offers/me", response_model=List[schemas.TripOffer])
def list_my_trip_offers(
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("user")),
):
    request_ids = [r.id for r in db.query(models.TripRequest.id).filter(models.TripRequest.user_id == user.id).all()]
    if not request_ids:
        return []
    offers = (
        db.query(models.TripOffer)
        .filter(models.TripOffer.trip_request_id.in_(request_ids))
        .order_by(models.TripOffer.created_at.desc())
        .all()
    )
    _apply_offer_lifecycle(db, offers)
    db.commit()
    return offers


@router.get("/trip-offers/{trip_offer_id}", response_model=schemas.TripOffer)
def get_trip_offer(
    trip_offer_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    offer = db.query(models.TripOffer).filter(models.TripOffer.id == trip_offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    req = db.query(models.TripRequest).filter(models.TripRequest.id == offer.trip_request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Trip request not found")
    if user.role == models.UserRole.USER:
        _require_user_owns_request(user, req)
    elif user.role == models.UserRole.AGENCY:
        agency_id = _require_agency_access(user)
        if offer.agency_id != agency_id:
            raise HTTPException(status_code=403, detail="Not allowed")
    elif user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not allowed")
    _apply_offer_lifecycle(db, [offer])
    db.commit()
    return offer


@router.post("/trip-offers/{trip_offer_id}/bookmark", response_model=schemas.TripOffer)
def bookmark_offer(
    trip_offer_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("user")),
):
    offer = db.query(models.TripOffer).filter(models.TripOffer.id == trip_offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    req = db.query(models.TripRequest).filter(models.TripRequest.id == offer.trip_request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Trip request not found")
    _require_user_owns_request(user, req)
    offer.is_bookmarked = not bool(offer.is_bookmarked)
    offer.updated_at = _utcnow()
    db.add(offer)
    db.commit()
    db.refresh(offer)
    return offer


@router.post("/trip-offers/{trip_offer_id}/reject", response_model=schemas.TripOffer)
def reject_offer(
    trip_offer_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("user")),
):
    offer = db.query(models.TripOffer).filter(models.TripOffer.id == trip_offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    req = db.query(models.TripRequest).filter(models.TripRequest.id == offer.trip_request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Trip request not found")
    _require_user_owns_request(user, req)
    status_value = getattr(offer.status, "value", offer.status) if offer.status else None
    if status_value != "submitted":
        raise HTTPException(status_code=400, detail="Only submitted offers can be rejected")
    now = _utcnow()
    offer.status = models.TripOfferStatus.REJECTED
    offer.declined_at = now
    offer.updated_at = now
    db.add(offer)
    for recipient_user_id in _agency_recipient_user_ids(db, offer.agency_id):
        _notify_user(
            db,
            recipient_user_id,
            title="Offer Rejected",
            body=f"Offer #{offer.id} for {req.request_code} was rejected.",
            link_url=f"/agency/incoming-requests/{req.id}",
            trip_request_id=req.id,
            trip_offer_id=offer.id,
            notif_type="offer_rejected",
        )
    db.commit()
    db.refresh(offer)
    return offer


@router.post("/trip-offers/{trip_offer_id}/request-revision", response_model=schemas.TripOffer)
def request_offer_revision(
    trip_offer_id: int,
    body: schemas.OfferRevisionRequest,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("user")),
):
    offer = db.query(models.TripOffer).filter(models.TripOffer.id == trip_offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    req = db.query(models.TripRequest).filter(models.TripRequest.id == offer.trip_request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Trip request not found")
    _require_user_owns_request(user, req)
    now = _utcnow()
    offer.revision_requested_at = now
    notes_value = getattr(body, "notes", None)
    offer.revision_notes = notes_value.strip() if isinstance(notes_value, str) and notes_value.strip() else None
    offer.updated_at = now
    db.add(offer)
    for recipient_user_id in _agency_recipient_user_ids(db, offer.agency_id):
        _notify_user(
            db,
            recipient_user_id,
            title="Revision Requested",
            body=f"Revision requested for offer #{offer.id} ({req.request_code}).",
            link_url=f"/agency/incoming-requests/{req.id}/create-offer?offer={offer.id}",
            trip_request_id=req.id,
            trip_offer_id=offer.id,
            notif_type="revision_requested",
        )
    db.commit()
    db.refresh(offer)
    return offer


@router.post("/trip-offers/{trip_offer_id}/accept", response_model=schemas.TripBooking)
def accept_trip_offer(
    trip_offer_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("user")),
):
    offer = db.query(models.TripOffer).filter(models.TripOffer.id == trip_offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    existing_booking = db.query(models.TripBooking).filter(models.TripBooking.trip_offer_id == offer.id).first()
    if existing_booking:
        _enrich_booking_summary(db, existing_booking)
        return existing_booking
    req = db.query(models.TripRequest).filter(models.TripRequest.id == offer.trip_request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Trip request not found")
    preexisting = db.query(models.TripBooking).filter(models.TripBooking.trip_request_id == req.id).first()
    if preexisting:
        raise HTTPException(status_code=400, detail="A booking already exists for this request")
    _require_user_owns_request(user, req)
    status_value = getattr(req.status, "value", req.status) if req.status else None
    if status_value == "accepted" or status_value == "completed":
        raise HTTPException(status_code=400, detail="A booking already exists for this request")
    offer_status_value = getattr(offer.status, "value", offer.status) if offer.status else None
    if offer_status_value != "submitted":
        raise HTTPException(status_code=400, detail="Offer cannot be accepted")
    if offer.expires_at and offer.expires_at <= _utcnow():
        raise HTTPException(status_code=400, detail="Offer has expired")

    now = _utcnow()
    offer.status = models.TripOfferStatus.ACCEPTED
    offer.accepted_at = now
    offer.updated_at = now
    db.add(offer)

    req.status = models.TripRequestStatus.COMPLETED
    req.updated_at = now
    db.add(req)

    other_offers = (
        db.query(models.TripOffer)
        .filter(models.TripOffer.trip_request_id == req.id)
        .filter(models.TripOffer.id != offer.id)
        .all()
    )
    for other in other_offers:
        other_status_value = getattr(other.status, "value", other.status) if other.status else None
        if other_status_value == "submitted":
            other.status = models.TripOfferStatus.DECLINED
            other.declined_at = now
            other.updated_at = now
            db.add(other)

    booking_code = _make_booking_code(db)
    agency = db.query(models.Agency).filter(models.Agency.id == offer.agency_id).first()
    ideal_price, offer_currency = _effective_budget(req)
    offer_price = _effective_offer_price(offer)
    offer_snapshot_dict = _offer_to_snapshot_dict(offer)
    offer_snapshot_json = json.dumps(offer_snapshot_dict, default=str, ensure_ascii=False)
    agreement_dict = {
        "booking_code": booking_code,
        "customer": {
            "user_id": req.user_id,
            "email": getattr(user, "email", None),
            "display_name": getattr(user, "display_name", None) or getattr(user, "full_name", None) or getattr(user, "email", None),
        },
        "agency": {
            "agency_id": offer.agency_id,
            "name": getattr(agency, "name", None) if agency else None,
        },
        "destination": getattr(req, "destination", None),
        "country": getattr(req, "country", None),
        "city": getattr(req, "city", None),
        "travel_start_date": getattr(req, "start_date", None),
        "travel_end_date": getattr(req, "end_date", None),
        "duration": getattr(req, "duration", None),
        "adults": getattr(req, "adults", None),
        "children": getattr(req, "children", None),
        "accepted_offer": {
            "trip_offer_id": offer.id,
            "hotel": offer_snapshot_dict.get("hotel"),
            "hotel_stars": offer_snapshot_dict.get("hotel_stars"),
            "meal_plan": offer_snapshot_dict.get("meal_plan"),
            "flight_included": offer_snapshot_dict.get("flight_included"),
            "airport_transfer": offer_snapshot_dict.get("airport_transfer"),
            "insurance_included": offer_snapshot_dict.get("insurance_included"),
            "visa_support": offer_snapshot_dict.get("visa_support"),
            "breakfast_included": offer_snapshot_dict.get("breakfast_included"),
            "lunch_included": offer_snapshot_dict.get("lunch_included"),
            "dinner_included": offer_snapshot_dict.get("dinner_included"),
        },
        "price": offer_price,
        "currency": offer_currency,
        "ideal_budget": ideal_price,
        "included_services": offer_snapshot_dict.get("included_services") or offer_snapshot_dict.get("offer_description"),
        "excluded_services": offer_snapshot_dict.get("excluded_services"),
        "travel_program": offer_snapshot_dict.get("travel_program"),
        "activities": offer_snapshot_dict.get("activities"),
        "acceptance_date": now.isoformat(),
        "booking_created_at": now.isoformat(),
        "terms": "This booking confirms agency obligation to provide services as described in the accepted offer, subject to agency standard terms and TourPie booking conditions. TourPie does not process payments; payment tracking is informational only.",
    }
    agreement_json = json.dumps(agreement_dict, default=str, ensure_ascii=False)

    booking = models.TripBooking(
        booking_code=booking_code,
        trip_request_id=req.id,
        trip_offer_id=offer.id,
        user_id=req.user_id,
        agency_id=offer.agency_id,
        status=models.TripBookingStatus.CONFIRMED,
        created_at=now,
        accepted_at=now,
        offer_snapshot=offer_snapshot_json,
        agreement_snapshot=agreement_json,
        terms_snapshot=agreement_dict["terms"],
    )
    db.add(booking)
    db.flush()

    _append_timeline(db, booking.id, "request_created", actor_role="system", note=f"Request {req.request_code} created")
    _append_timeline(db, booking.id, "offer_accepted", actor_role="user", actor_user_id=user.id, note=f"Offer #{offer.id} accepted")
    _append_timeline(db, booking.id, "booking_created", actor_role="system", note=f"Booking {booking_code} created")
    _append_timeline(db, booking.id, "booking_confirmed", actor_role="system", note="Booking confirmed")

    for idx, (label, recommended) in enumerate(DEFAULT_BOOKING_CHECKLIST):
        db.add(models.TripBookingChecklistItem(
            booking_id=booking.id,
            label=label,
            is_completed=False,
            is_recommended=recommended,
            sort_order=idx,
        ))

    db.add(models.TripBookingPaymentRecord(
        booking_id=booking.id,
        status=models.TripBookingPaymentStatus.WAITING,
        amount=offer_price,
        currency=offer_currency,
        note="Waiting for payment",
    ))

    for recipient_user_id in _agency_recipient_user_ids(db, offer.agency_id):
        _notify_user(
            db,
            recipient_user_id,
            title="Offer Accepted",
            body=f"Offer #{offer.id} was accepted. Booking {booking_code} created.",
            link_url=f"/dashboard/trip-bookings/{booking.id}",
            trip_request_id=req.id,
            trip_offer_id=offer.id,
            notif_type="offer_accepted",
        )
    _notify_user(
        db,
        req.user_id,
        title="Booking Confirmed",
        body=f"Booking {booking_code} created for {req.destination or req.request_code}.",
        link_url=f"/dashboard/trip-bookings/{booking.id}",
        trip_request_id=req.id,
        trip_offer_id=offer.id,
        notif_type="accepted_booking",
    )

    db.commit()
    db.refresh(booking)
    _enrich_booking_summary(db, booking)
    db.commit()
    return booking


@router.get("/agency/trip-requests", response_model=List[schemas.TripRequest])
def list_agency_incoming_requests(
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("agency")),
):
    agency_id = _require_agency_access(user)
    match_rows = (
        db.query(models.TripRequestAgencyMatch)
        .filter(models.TripRequestAgencyMatch.agency_id == agency_id)
        .order_by(models.TripRequestAgencyMatch.created_at.desc())
        .all()
    )
    request_ids = [m.trip_request_id for m in match_rows]
    if not request_ids:
        return []
    rows = (
        db.query(models.TripRequest)
        .filter(models.TripRequest.id.in_(request_ids))
        .order_by(models.TripRequest.created_at.desc())
        .all()
    )
    _apply_request_lifecycle(db, rows)
    _enrich_many_requests(db, rows)
    db.commit()
    return rows


@router.get("/agency/trip-requests/{trip_request_id}/match", response_model=schemas.TripRequestAgencyMatch)
def get_agency_trip_request_match(
    trip_request_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("agency")),
):
    agency_id = _require_agency_access(user)
    match_row = (
        db.query(models.TripRequestAgencyMatch)
        .filter(models.TripRequestAgencyMatch.trip_request_id == trip_request_id)
        .filter(models.TripRequestAgencyMatch.agency_id == agency_id)
        .first()
    )
    if not match_row:
        raise HTTPException(status_code=404, detail="Match not found")
    return match_row


@router.post("/agency/trip-requests/{trip_request_id}/viewed", response_model=schemas.TripRequestAgencyMatch)
def mark_agency_trip_request_viewed(
    trip_request_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("agency")),
):
    agency_id = _require_agency_access(user)
    match_row = (
        db.query(models.TripRequestAgencyMatch)
        .filter(models.TripRequestAgencyMatch.trip_request_id == trip_request_id)
        .filter(models.TripRequestAgencyMatch.agency_id == agency_id)
        .first()
    )
    if not match_row:
        raise HTTPException(status_code=404, detail="Match not found")
    now = _utcnow()
    if not match_row.viewed_at:
        match_row.viewed_at = now
        if match_row.status not in ("interested", "rejected", "offered"):
            match_row.status = models.MatchAgencyStatus.VIEWED.value
    db.add(match_row)
    db.commit()
    db.refresh(match_row)
    return match_row


@router.post("/agency/trip-requests/{trip_request_id}/interested", response_model=schemas.TripRequestAgencyMatch)
def mark_agency_trip_request_interested(
    trip_request_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("agency")),
):
    agency_id = _require_agency_access(user)
    match_row = (
        db.query(models.TripRequestAgencyMatch)
        .filter(models.TripRequestAgencyMatch.trip_request_id == trip_request_id)
        .filter(models.TripRequestAgencyMatch.agency_id == agency_id)
        .first()
    )
    if not match_row:
        raise HTTPException(status_code=404, detail="Match not found")
    now = _utcnow()
    match_row.interested_at = now
    if not match_row.viewed_at:
        match_row.viewed_at = now
    if match_row.status not in ("rejected", "offered"):
        match_row.status = models.MatchAgencyStatus.INTERESTED.value
    db.add(match_row)
    req = db.query(models.TripRequest).filter(models.TripRequest.id == match_row.trip_request_id).first()
    if req:
        agency = db.query(models.Agency).filter(models.Agency.id == agency_id).first()
        _notify_user(
            db,
            req.user_id,
            title="Agency Interested",
            body=f"{getattr(agency, 'name', 'An agency')} is interested in preparing an offer.",
            link_url=f"/dashboard/offers?request={req.id}",
            trip_request_id=req.id,
            notif_type="agency_interested",
        )
    db.commit()
    db.refresh(match_row)
    return match_row


@router.post("/agency/trip-requests/{trip_request_id}/decline", response_model=schemas.TripRequestAgencyMatch)
def decline_trip_request(
    trip_request_id: int,
    reason: Optional[str] = Query(default=None),
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("agency")),
):
    agency_id = _require_agency_access(user)
    match_row = (
        db.query(models.TripRequestAgencyMatch)
        .filter(models.TripRequestAgencyMatch.trip_request_id == trip_request_id)
        .filter(models.TripRequestAgencyMatch.agency_id == agency_id)
        .first()
    )
    if not match_row:
        raise HTTPException(status_code=404, detail="Match not found")
    match_row.status = models.MatchAgencyStatus.REJECTED.value
    match_row.declined_reason = reason.strip() if isinstance(reason, str) and reason.strip() else None
    db.add(match_row)
    db.commit()
    db.refresh(match_row)
    return match_row


def _apply_offer_body(db: Session, offer: models.TripOffer, req: models.TripRequest, body: schemas.TripOfferCreateRequest | schemas.TripOfferUpdateRequest, created_by_user_id: int, agency_id: int) -> None:
    price: Optional[float] = None
    for attr in ("price", "total_price"):
        if hasattr(body, attr):
            val = getattr(body, attr)
            if isinstance(val, (int, float)):
                price = float(val)
                break
    currency = None
    for attr in ("currency",):
        if hasattr(body, attr):
            val = getattr(body, attr)
            if isinstance(val, str) and val:
                currency = _normalize_currency(val)
    offer.currency = currency or getattr(offer, "currency", None) or (req.budget_currency if req else "USD") or "USD"
    if price is not None:
        offer.price = price
        offer.total_price = price
    now = _utcnow()
    expiration_hours: Optional[int] = None
    expiration_date: Optional[datetime.date] = None
    if hasattr(body, "offer_expiration_hours") and getattr(body, "offer_expiration_hours") is not None:
        try:
            expiration_hours = int(getattr(body, "offer_expiration_hours"))
        except Exception:
            expiration_hours = None
    if hasattr(body, "expiration_date") and getattr(body, "expiration_date") is not None:
        expiration_date = _parse_date(str(getattr(body, "expiration_date")))
    field_map = {
        "hotel": "hotel",
        "hotel_stars": "hotel_stars",
        "room_type": "room_type",
        "meal_plan": "meal_plan",
        "flight": "flight",
        "transfer": "transfer",
        "visa": "visa",
        "visa_support": "visa_support",
        "insurance": "insurance",
        "travel_program": "travel_program",
        "included_services": "included_services",
        "excluded_services": "excluded_services",
        "activities": "activities",
        "offer_description": "offer_description",
        "additional_benefits": "additional_benefits",
        "notes": "notes",
        "price_difference_notes": "price_difference_notes",
    }
    bool_fields = ("flight_included", "airport_transfer", "breakfast_included", "lunch_included", "dinner_included")
    for src_attr, dst_attr in field_map.items():
        if not hasattr(body, src_attr):
            continue
        value = getattr(body, src_attr)
        if value is None:
            continue
        if isinstance(value, str):
            setattr(offer, dst_attr, value.strip() or None)
        else:
            setattr(offer, dst_attr, value)
    for field in bool_fields:
        if hasattr(body, field) and getattr(body, field) is not None:
            setattr(offer, field, bool(getattr(body, field)))
    if hasattr(body, "price_difference_reason") and getattr(body, "price_difference_reason", None):
        try:
            setattr(offer, "price_difference_reason", models.TripPriceDifferenceReason(str(getattr(body, "price_difference_reason"))))
        except Exception:
            pass
    if hasattr(body, "offer_attachments") and getattr(body, "offer_attachments", None) is not None:
        offer.offer_attachments = _serialize_json_list(list(getattr(body, "offer_attachments") or []))
    if expiration_date:
        offer.expiration_date = expiration_date
        offer.expires_at = datetime.datetime.combine(expiration_date, datetime.time(23, 59, 59), tzinfo=datetime.timezone.utc)
    elif expiration_hours:
        offer.expires_at = now + datetime.timedelta(hours=expiration_hours)
    elif offer.expires_at is None:
        req_hours = int(getattr(req, "offer_expiration_hours", None) or 48)
        offer.expires_at = now + datetime.timedelta(hours=req_hours)


def _validate_offer_submit(req: models.TripRequest, offer: models.TripOffer) -> None:
    price = _effective_offer_price(offer)
    if price is None or price <= 0:
        raise HTTPException(status_code=400, detail="Total price must be greater than 0")
    ideal_budget = float(getattr(req, "ideal_budget", None) or getattr(req, "budget", None) or 0)
    max_budget = float(req.max_budget) if isinstance(req.max_budget, (int, float)) else None
    needs_justification = price > ideal_budget or (max_budget is not None and price > max_budget)
    if needs_justification and not getattr(offer, "price_difference_reason", None):
        raise HTTPException(status_code=400, detail="Reason for price difference is required")
    reason_value = getattr(offer.price_difference_reason, "value", offer.price_difference_reason) if offer.price_difference_reason else None
    if reason_value == "other" and not (getattr(offer, "price_difference_notes", None) or "").strip():
        raise HTTPException(status_code=400, detail="Reason notes are required")


@router.get("/agency/trip-requests/{trip_request_id}/offers", response_model=List[schemas.TripOffer])
def list_agency_trip_request_offers(
    trip_request_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("agency")),
):
    agency_id = _require_agency_access(user)
    req = db.query(models.TripRequest).filter(models.TripRequest.id == trip_request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Trip request not found")
    allowed = (
        db.query(models.TripRequestAgencyMatch)
        .filter(models.TripRequestAgencyMatch.trip_request_id == req.id)
        .filter(models.TripRequestAgencyMatch.agency_id == agency_id)
        .first()
    )
    if not allowed:
        raise HTTPException(status_code=403, detail="Not allowed")
    offers = (
        db.query(models.TripOffer)
        .filter(models.TripOffer.trip_request_id == req.id)
        .filter(models.TripOffer.agency_id == agency_id)
        .order_by(models.TripOffer.created_at.desc())
        .all()
    )
    _apply_offer_lifecycle(db, offers)
    db.commit()
    return offers


@router.post("/agency/trip-requests/{trip_request_id}/offers", response_model=schemas.TripOffer)
def create_trip_offer(
    trip_request_id: int,
    body: schemas.TripOfferCreateRequest,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("agency")),
):
    agency_id = _require_agency_access(user)
    agency = db.query(models.Agency).filter(models.Agency.id == agency_id).first()
    if not agency or not _agency_is_matchable(agency):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Agency cannot submit offers")

    req = db.query(models.TripRequest).filter(models.TripRequest.id == trip_request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Trip request not found")

    allowed = (
        db.query(models.TripRequestAgencyMatch)
        .filter(models.TripRequestAgencyMatch.trip_request_id == req.id)
        .filter(models.TripRequestAgencyMatch.agency_id == agency_id)
        .first()
    )
    if not allowed or allowed.status == "rejected":
        raise HTTPException(status_code=403, detail="Not allowed")

    existing = (
        db.query(models.TripOffer)
        .filter(models.TripOffer.trip_request_id == req.id)
        .filter(models.TripOffer.agency_id == agency_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Offer already exists; use PATCH to edit it")

    if req.expires_at and req.expires_at < _utcnow():
        raise HTTPException(status_code=400, detail="Request expired")

    is_draft = bool(getattr(body, "is_draft", False))
    now = _utcnow()
    offer = models.TripOffer(
        trip_request_id=req.id,
        agency_id=agency_id,
        created_by_user_id=user.id,
        status=models.TripOfferStatus.DRAFT if is_draft else models.TripOfferStatus.SUBMITTED,
        submitted_at=None if is_draft else now,
        created_at=now,
        updated_at=now,
    )
    _apply_offer_body(db, offer, req, body, user.id, agency_id)
    if not is_draft:
        _validate_offer_submit(req, offer)
    db.add(offer)
    db.flush()

    if not is_draft:
        match_status_value = _normalize(getattr(allowed, "status", None))
        if match_status_value != "rejected":
            allowed.status = models.MatchAgencyStatus.OFFERED.value
        db.add(allowed)
        _sync_comparison(db, req, offer)
        _notify_user(
            db,
            req.user_id,
            title="New Offer",
            body=f"New offer for {req.destination or req.request_code} from {getattr(agency, 'name', 'an agency')}.",
            link_url=f"/dashboard/offers/{offer.id}",
            trip_request_id=req.id,
            trip_offer_id=offer.id,
            notif_type="new_offer",
        )
    db.commit()
    db.refresh(offer)
    return offer


@router.patch("/agency/offers/{trip_offer_id}", response_model=schemas.TripOffer)
def update_trip_offer(
    trip_offer_id: int,
    body: schemas.TripOfferUpdateRequest,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("agency")),
):
    agency_id = _require_agency_access(user)
    offer = db.query(models.TripOffer).filter(models.TripOffer.id == trip_offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    if offer.agency_id != agency_id:
        raise HTTPException(status_code=403, detail="Not allowed")
    req = db.query(models.TripRequest).filter(models.TripRequest.id == offer.trip_request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Trip request not found")
    now = _utcnow()
    status_value = getattr(offer.status, "value", offer.status) if offer.status else None
    editable_statuses = {"draft", "expired", "rejected", "declined", "cancelled"}
    if status_value not in editable_statuses:
        raise HTTPException(status_code=400, detail="Only draft or rejected offers can be edited")

    _apply_offer_body(db, offer, req, body, user.id, agency_id)
    if getattr(body, "submit", False):
        _validate_offer_submit(req, offer)
        offer.status = models.TripOfferStatus.SUBMITTED
        offer.submitted_at = now
        match_row = (
            db.query(models.TripRequestAgencyMatch)
            .filter(models.TripRequestAgencyMatch.trip_request_id == req.id)
            .filter(models.TripRequestAgencyMatch.agency_id == agency_id)
            .first()
        )
        if match_row and _normalize(getattr(match_row, "status", None)) != "rejected":
            match_row.status = models.MatchAgencyStatus.OFFERED.value
            db.add(match_row)
        _sync_comparison(db, req, offer)
        agency = db.query(models.Agency).filter(models.Agency.id == agency_id).first()
        _notify_user(
            db,
            req.user_id,
            title="New Offer",
            body=f"New offer for {req.destination or req.request_code} from {getattr(agency, 'name', 'an agency')}.",
            link_url=f"/dashboard/offers/{offer.id}",
            trip_request_id=req.id,
            trip_offer_id=offer.id,
            notif_type="new_offer",
        )
    else:
        offer.status = models.TripOfferStatus.DRAFT
    offer.updated_at = now
    db.add(offer)
    db.commit()
    db.refresh(offer)
    return offer


@router.post("/agency/offers/{trip_offer_id}/submit", response_model=schemas.TripOffer)
def submit_trip_offer(
    trip_offer_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("agency")),
):
    return update_trip_offer(
        trip_offer_id=trip_offer_id,
        body=schemas.TripOfferUpdateRequest(submit=True),
        db=db,
        user=user,
        _={},
    )


@router.post("/agency/offers/{trip_offer_id}/cancel", response_model=schemas.TripOffer)
def cancel_trip_offer(
    trip_offer_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("agency")),
):
    agency_id = _require_agency_access(user)
    offer = db.query(models.TripOffer).filter(models.TripOffer.id == trip_offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    if offer.agency_id != agency_id:
        raise HTTPException(status_code=403, detail="Not allowed")
    status_value = getattr(offer.status, "value", offer.status) if offer.status else None
    if status_value not in ("submitted", "draft", "expired"):
        raise HTTPException(status_code=400, detail="Offer cannot be cancelled")
    now = _utcnow()
    offer.status = models.TripOfferStatus.CANCELLED
    offer.cancelled_at = now
    offer.updated_at = now
    db.add(offer)
    req = db.query(models.TripRequest).filter(models.TripRequest.id == offer.trip_request_id).first()
    if req:
        _notify_user(
            db,
            req.user_id,
            title="Offer Cancelled",
            body=f"Offer #{offer.id} for {req.destination or req.request_code} was cancelled by the agency.",
            link_url=f"/dashboard/offers?request={req.id}",
            trip_request_id=req.id,
            trip_offer_id=offer.id,
            notif_type="offer_cancelled",
        )
    db.commit()
    db.refresh(offer)
    return offer


@router.get("/trip-notifications", response_model=List[schemas.TripOfferNotification])
def list_trip_notifications(
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    rows = (
        db.query(models.TripOfferNotification)
        .filter(models.TripOfferNotification.recipient_user_id == user.id)
        .order_by(models.TripOfferNotification.created_at.desc())
        .limit(200)
        .all()
    )
    return rows


@router.post("/trip-notifications/{notification_id}/read", response_model=schemas.TripOfferNotification)
def mark_trip_notification_read(
    notification_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    row = (
        db.query(models.TripOfferNotification)
        .filter(models.TripOfferNotification.id == notification_id)
        .filter(models.TripOfferNotification.recipient_user_id == user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Notification not found")
    row.is_read = True
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/trip-offers/{trip_offer_id}/messages", response_model=List[schemas.TripOfferMessage])
def list_trip_offer_messages(
    trip_offer_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    offer = db.query(models.TripOffer).filter(models.TripOffer.id == trip_offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    req = db.query(models.TripRequest).filter(models.TripRequest.id == offer.trip_request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Trip request not found")

    if user.role == models.UserRole.USER:
        _require_user_owns_request(user, req)
    elif user.role == models.UserRole.AGENCY:
        agency_id = _require_agency_access(user)
        if offer.agency_id != agency_id:
            raise HTTPException(status_code=403, detail="Not allowed")
    elif user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not allowed")

    rows = (
        db.query(models.TripOfferMessage)
        .filter(models.TripOfferMessage.trip_offer_id == offer.id)
        .order_by(models.TripOfferMessage.created_at.asc())
        .all()
    )
    return rows


@router.post("/trip-offers/{trip_offer_id}/messages", response_model=schemas.TripOfferMessage)
def send_trip_offer_message(
    trip_offer_id: int,
    body: schemas.TripOfferMessageCreateRequest,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    content = (body.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message content is required")

    offer = db.query(models.TripOffer).filter(models.TripOffer.id == trip_offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    req = db.query(models.TripRequest).filter(models.TripRequest.id == offer.trip_request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Trip request not found")

    sender_role = None
    recipient_user_ids: List[int] = []
    if user.role == models.UserRole.USER:
        _require_user_owns_request(user, req)
        sender_role = models.MessageSenderRole.USER
        recipient_user_ids = _agency_recipient_user_ids(db, offer.agency_id)
    elif user.role == models.UserRole.AGENCY:
        agency_id = _require_agency_access(user)
        if offer.agency_id != agency_id:
            raise HTTPException(status_code=403, detail="Not allowed")
        sender_role = models.MessageSenderRole.AGENCY
        recipient_user_ids = [req.user_id]
    elif user.role == models.UserRole.ADMIN:
        sender_role = models.MessageSenderRole.ADMIN
        recipient_user_ids = [req.user_id]
    else:
        raise HTTPException(status_code=403, detail="Not allowed")

    now = _utcnow()
    msg = models.TripOfferMessage(
        trip_request_id=req.id,
        trip_offer_id=offer.id,
        user_id=req.user_id,
        agency_id=offer.agency_id,
        sender_role=sender_role,
        sender_user_id=user.id,
        content=content,
        created_at=now,
    )
    db.add(msg)

    for recipient_user_id in recipient_user_ids:
        if isinstance(recipient_user_id, int):
            _notify_user(
                db,
                recipient_user_id,
                title="New Message",
                body=content[:180],
                link_url=f"/dashboard/offers/{offer.id}",
                trip_request_id=req.id,
                trip_offer_id=offer.id,
                notif_type="new_message",
            )

    db.commit()
    db.refresh(msg)
    return msg


@router.get("/admin/trip-requests", response_model=List[schemas.TripRequest])
def admin_list_trip_requests(
    db: Session = Depends(database.get_db),
    _: models.User = Depends(get_current_user),
    __: dict = Depends(require_roles("admin")),
):
    rows = db.query(models.TripRequest).order_by(models.TripRequest.created_at.desc()).limit(500).all()
    _enrich_many_requests(db, rows)
    return rows


@router.get("/admin/trip-offers", response_model=List[schemas.TripOffer])
def admin_list_trip_offers(
    db: Session = Depends(database.get_db),
    _: models.User = Depends(get_current_user),
    __: dict = Depends(require_roles("admin")),
):
    rows = db.query(models.TripOffer).order_by(models.TripOffer.created_at.desc()).limit(500).all()
    _apply_offer_lifecycle(db, rows)
    db.commit()
    return rows


def _require_booking_access(user: models.User, booking: models.TripBooking) -> None:
    role_value = getattr(user.role, "value", user.role) if user.role else None
    if role_value == "admin":
        return
    if getattr(user, "id", None) == getattr(booking, "user_id", None):
        return
    if role_value == "agency" and getattr(user, "agency_id", None) == getattr(booking, "agency_id", None):
        return
    raise HTTPException(status_code=403, detail="Not allowed")


def _actor_name(user: Optional[models.User]) -> Optional[str]:
    if not user:
        return None
    for attr in ("display_name", "full_name", "email"):
        v = getattr(user, attr, None)
        if v:
            return str(v)
    return None


def _agreement_from_booking(db: Session, booking: models.TripBooking) -> schemas.TripBookingAgreement:
    req = db.query(models.TripRequest).filter(models.TripRequest.id == booking.trip_request_id).first()
    offer = db.query(models.TripOffer).filter(models.TripOffer.id == booking.trip_offer_id).first()
    cust = db.query(models.User).filter(models.User.id == booking.user_id).first()
    ag = db.query(models.Agency).filter(models.Agency.id == booking.agency_id).first()
    offer_price = _effective_offer_price(offer) if offer else None
    offer_currency = _normalize_currency(getattr(offer, "currency", None)) if offer else None
    if booking.agreement_snapshot:
        try:
            snap = json.loads(booking.agreement_snapshot)
        except Exception:
            snap = {}
    else:
        snap = {}
    return schemas.TripBookingAgreement(
        booking_id=booking.id,
        booking_code=booking.booking_code or f"TP-{booking.id}",
        customer={
            "user_id": booking.user_id,
            "display_name": _actor_name(cust),
            "email": getattr(cust, "email", None),
        } if cust else None,
        agency={
            "agency_id": booking.agency_id,
            "name": getattr(ag, "name", None),
        } if ag else None,
        destination=snap.get("destination") or (req and req.destination),
        country=snap.get("country") or (req and req.country),
        city=snap.get("city") or (req and req.city),
        travel_start_date=snap.get("travel_start_date") or (req and str(req.start_date) if req.start_date else None),
        travel_end_date=snap.get("travel_end_date") or (req and str(req.end_date) if req.end_date else None),
        duration=snap.get("duration") or (req and req.duration),
        accepted_offer=snap.get("accepted_offer") or _offer_to_snapshot_dict(offer) if offer else None,
        price=offer_price if offer_price is not None else snap.get("price"),
        currency=offer_currency or snap.get("currency"),
        included_services=snap.get("included_services") or (offer and (offer.included_services or offer.offer_description)),
        excluded_services=snap.get("excluded_services") or (offer and offer.excluded_services),
        terms=booking.terms_snapshot or snap.get("terms") or "TourPie booking conditions apply.",
        booking_status=str(getattr(booking.status, "value", booking.status)) if booking.status else "confirmed",
        accepted_at=booking.accepted_at,
        booking_created_at=booking.created_at,
    )


def _enrich_one_document(db: Session, doc: models.TripBookingDocument) -> None:
    up = db.query(models.User).filter(models.User.id == doc.uploader_user_id).first()
    doc.uploader_display_name = _actor_name(up)


def _enrich_one_timeline_event(db: Session, ev: models.TripBookingTimelineEvent) -> None:
    if getattr(ev, "actor_user_id", None):
        u = db.query(models.User).filter(models.User.id == ev.actor_user_id).first()
        ev.actor_display_name = _actor_name(u)
    else:
        ev.actor_display_name = None


def _enrich_one_message(db: Session, m: models.TripBookingMessage) -> None:
    u = db.query(models.User).filter(models.User.id == m.sender_user_id).first()
    m.sender_display_name = _actor_name(u)


def _enrich_one_review(db: Session, r: models.TripBookingReview) -> None:
    u = db.query(models.User).filter(models.User.id == r.user_id).first()
    r.user_display_name = _actor_name(u)


@router.get("/trip-bookings/me", response_model=List[schemas.TripBooking])
def list_my_trip_bookings(
    status: Optional[str] = Query(None),
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    role_value = getattr(user.role, "value", user.role) if user.role else None
    q = db.query(models.TripBooking)
    if role_value == "admin":
        pass
    elif role_value == "agency":
        agency_id = _require_agency_access(user)
        q = q.filter(models.TripBooking.agency_id == agency_id)
    else:
        q = q.filter(models.TripBooking.user_id == user.id)
    if status:
        q = q.filter(models.TripBooking.status == status)
    q = q.order_by(models.TripBooking.created_at.desc())
    rows = q.limit(500).all()
    for b in rows:
        _enrich_booking_summary(db, b)
    db.commit()
    return rows


@router.get("/trip-bookings/{trip_booking_id}/workspace", response_model=schemas.TripBookingWorkspace)
def get_trip_booking_workspace(
    trip_booking_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    booking = db.query(models.TripBooking).filter(models.TripBooking.id == trip_booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    _require_booking_access(user, booking)
    _enrich_booking_summary(db, booking)
    req = db.query(models.TripRequest).filter(models.TripRequest.id == booking.trip_request_id).first()
    offer = db.query(models.TripOffer).filter(models.TripOffer.id == booking.trip_offer_id).first()
    req_dict = None
    if req:
        req_dict = {
            "id": req.id,
            "request_code": getattr(req, "request_code", None),
            "destination": getattr(req, "destination", None),
            "country": getattr(req, "country", None),
            "city": getattr(req, "city", None),
            "start_date": getattr(req, "start_date", None),
            "end_date": getattr(req, "end_date", None),
            "duration": getattr(req, "duration", None),
            "adults": getattr(req, "adults", None),
            "children": getattr(req, "children", None),
            "budget": getattr(req, "budget", None),
            "ideal_budget": getattr(req, "ideal_budget", None),
            "max_budget": getattr(req, "max_budget", None),
            "currency": getattr(req, "currency", None),
            "budget_currency": getattr(req, "budget_currency", None),
            "hotel_stars": getattr(req, "hotel_stars", None),
            "meal_preference": getattr(req, "meal_preference", None),
            "transportation": getattr(req, "transportation", None),
            "travel_style": getattr(req, "travel_style", None),
            "visa_required": getattr(req, "visa_required", None),
            "special_requirements": getattr(req, "special_requirements", None),
            "notes": getattr(req, "notes", None),
            "attachments": _parse_json_list(getattr(req, "attachments", None)),
            "status": str(getattr(req.status, "value", req.status)) if req.status else None,
            "created_at": req.created_at.isoformat() if req.created_at else None,
        }
    offer_dict = None
    if offer:
        offer_dict = _offer_to_snapshot_dict(offer)
        offer_dict["currency"] = _normalize_currency(offer_dict.get("currency"))
        offer_dict["offer_attachments"] = _parse_json_list(offer_dict.get("offer_attachments"))
        offer_dict["attachments"] = _parse_json_list(offer_dict.get("attachments"))

    timeline = (
        db.query(models.TripBookingTimelineEvent)
        .filter(models.TripBookingTimelineEvent.booking_id == booking.id)
        .order_by(models.TripBookingTimelineEvent.created_at.asc())
        .all()
    )
    for ev in timeline:
        _enrich_one_timeline_event(db, ev)

    documents = (
        db.query(models.TripBookingDocument)
        .filter(models.TripBookingDocument.booking_id == booking.id)
        .order_by(models.TripBookingDocument.created_at.desc())
        .all()
    )
    for d in documents:
        _enrich_one_document(db, d)

    payments = (
        db.query(models.TripBookingPaymentRecord)
        .filter(models.TripBookingPaymentRecord.booking_id == booking.id)
        .order_by(models.TripBookingPaymentRecord.created_at.desc())
        .all()
    )

    checklist = (
        db.query(models.TripBookingChecklistItem)
        .filter(models.TripBookingChecklistItem.booking_id == booking.id)
        .order_by(models.TripBookingChecklistItem.sort_order.asc(), models.TripBookingChecklistItem.created_at.asc())
        .all()
    )

    messages = (
        db.query(models.TripBookingMessage)
        .filter(models.TripBookingMessage.booking_id == booking.id)
        .order_by(models.TripBookingMessage.created_at.asc())
        .all()
    )
    if getattr(user, "id", None):
        for m in messages:
            if (
                m.sender_user_id != user.id
                and not m.is_read
            ):
                m.is_read = True
                db.add(m)
    for m in messages:
        _enrich_one_message(db, m)

    review = (
        db.query(models.TripBookingReview)
        .filter(models.TripBookingReview.booking_id == booking.id)
        .filter(models.TripBookingReview.is_hidden.is_(False))
        .first()
    )
    if review:
        _enrich_one_review(db, review)

    agreement_snapshot_dict = None
    if booking.agreement_snapshot:
        try:
            agreement_snapshot_dict = json.loads(booking.agreement_snapshot)
        except Exception:
            agreement_snapshot_dict = None

    db.commit()

    return schemas.TripBookingWorkspace(
        booking=booking,
        trip_request=req_dict,
        trip_offer=offer_dict,
        timeline=timeline,
        documents=documents,
        payments=payments,
        checklist=checklist,
        messages=messages,
        review=review,
        agreement_snapshot=agreement_snapshot_dict,
    )


@router.get("/trip-bookings/{trip_booking_id}", response_model=schemas.TripBooking)
def get_trip_booking(
    trip_booking_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    booking = db.query(models.TripBooking).filter(models.TripBooking.id == trip_booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    _require_booking_access(user, booking)
    _enrich_booking_summary(db, booking)
    db.commit()
    return booking


@router.get("/trip-bookings/{trip_booking_id}/agreement", response_model=schemas.TripBookingAgreement)
def get_trip_booking_agreement(
    trip_booking_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    booking = db.query(models.TripBooking).filter(models.TripBooking.id == trip_booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    _require_booking_access(user, booking)
    return _agreement_from_booking(db, booking)


@router.patch("/trip-bookings/{trip_booking_id}/status", response_model=schemas.TripBooking)
def set_trip_booking_status(
    trip_booking_id: int,
    body: schemas.TripBookingStatusUpdateRequest,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    booking = db.query(models.TripBooking).filter(models.TripBooking.id == trip_booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    _require_booking_access(user, booking)
    role_value = getattr(user.role, "value", user.role) if user.role else None
    new_status = (body.status or "").strip().lower()
    now = _utcnow()
    if new_status in ("travelling",):
        booking.trip_started_at = now
    if new_status in ("completed", "reviewed"):
        if not booking.trip_started_at:
            booking.trip_started_at = now
        booking.trip_completed_at = now
    if new_status in ("cancelled",):
        booking.cancelled_at = now
    booking.status = new_status
    db.add(booking)
    actor_role = role_value if role_value in ("admin", "agency") else "user"
    actor_uid = user.id
    _append_timeline(
        db,
        booking.id,
        f"status_{new_status}",
        actor_role=actor_role,
        actor_user_id=actor_uid,
        note=body.note or f"Status changed to {new_status}",
    )
    db.commit()
    db.refresh(booking)
    _enrich_booking_summary(db, booking)
    db.commit()
    return booking


@router.patch("/trip-bookings/{trip_booking_id}/notes", response_model=schemas.TripBooking)
def set_trip_booking_notes(
    trip_booking_id: int,
    body: schemas.TripBookingSetNotesRequest,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    booking = db.query(models.TripBooking).filter(models.TripBooking.id == trip_booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    _require_booking_access(user, booking)
    booking.notes = body.notes
    db.add(booking)
    db.commit()
    db.refresh(booking)
    _enrich_booking_summary(db, booking)
    db.commit()
    return booking


@router.get("/trip-bookings/{trip_booking_id}/documents", response_model=List[schemas.TripBookingDocument])
def list_trip_booking_documents(
    trip_booking_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    booking = db.query(models.TripBooking).filter(models.TripBooking.id == trip_booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    _require_booking_access(user, booking)
    rows = (
        db.query(models.TripBookingDocument)
        .filter(models.TripBookingDocument.booking_id == booking.id)
        .order_by(models.TripBookingDocument.created_at.desc())
        .all()
    )
    for r in rows:
        _enrich_one_document(db, r)
    db.commit()
    return rows


@router.post("/trip-bookings/{trip_booking_id}/documents", response_model=schemas.TripBookingDocument)
def create_trip_booking_document(
    trip_booking_id: int,
    body: schemas.TripBookingDocumentCreateRequest,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    booking = db.query(models.TripBooking).filter(models.TripBooking.id == trip_booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    _require_booking_access(user, booking)
    role_value = getattr(user.role, "value", user.role) if user.role else None
    if role_value != "agency" and role_value != "admin":
        raise HTTPException(status_code=403, detail="Only agency or admin can upload documents")
    if role_value == "agency":
        agency_id = _require_agency_access(user)
        if booking.agency_id != agency_id:
            raise HTTPException(status_code=403, detail="Not allowed")
    file_url = body.file_url.strip()
    if not file_url:
        raise HTTPException(status_code=400, detail="file_url required")
    doc = models.TripBookingDocument(
        booking_id=booking.id,
        uploader_user_id=user.id,
        document_type=(body.document_type or "other").strip().lower() or "other",
        filename=(body.filename or None),
        file_url=file_url,
        status=models.TripBookingDocumentStatus.UPLOADED,
        note=body.note,
        created_at=_utcnow(),
    )
    db.add(doc)
    db.flush()
    _append_timeline(
        db,
        booking.id,
        "document_uploaded",
        actor_role=role_value,
        actor_user_id=user.id,
        note=f"Document uploaded: {body.document_type or 'other'}",
    )
    if role_value == "agency":
        _notify_user(db, booking.user_id, "Document Uploaded", f"New document for booking {booking.booking_code or booking.id}.", f"/dashboard/trip-bookings/{booking.id}", notif_type="document_uploaded")
    db.commit()
    db.refresh(doc)
    _enrich_one_document(db, doc)
    db.commit()
    return doc


@router.patch("/trip-bookings/{trip_booking_id}/documents/{document_id}/status", response_model=schemas.TripBookingDocument)
def set_trip_booking_document_status(
    trip_booking_id: int,
    document_id: int,
    body: schemas.TripBookingDocumentSetStatusRequest,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    booking = db.query(models.TripBooking).filter(models.TripBooking.id == trip_booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    _require_booking_access(user, booking)
    doc = db.query(models.TripBookingDocument).filter(models.TripBookingDocument.id == document_id).filter(models.TripBookingDocument.booking_id == booking.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    new_status = (body.status or "").strip().lower()
    now = _utcnow()
    if new_status == "viewed":
        doc.status = models.TripBookingDocumentStatus.VIEWED
        doc.viewed_at = now
    elif new_status == "approved":
        doc.status = models.TripBookingDocumentStatus.APPROVED
        doc.reviewed_at = now
        doc.viewed_at = doc.viewed_at or now
    elif new_status == "rejected":
        doc.status = models.TripBookingDocumentStatus.REJECTED
        doc.reviewed_at = now
        doc.viewed_at = doc.viewed_at or now
    else:
        raise HTTPException(status_code=400, detail="Invalid status")
    db.add(doc)
    _append_timeline(
        db,
        booking.id,
        f"document_{new_status}",
        actor_role=str(getattr(user.role, "value", user.role) or "user"),
        actor_user_id=user.id,
        note=f"Document {document_id}: {new_status}",
    )
    db.commit()
    db.refresh(doc)
    _enrich_one_document(db, doc)
    db.commit()
    return doc


@router.get("/trip-bookings/{trip_booking_id}/payments", response_model=List[schemas.TripBookingPaymentRecord])
def list_trip_booking_payments(
    trip_booking_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    booking = db.query(models.TripBooking).filter(models.TripBooking.id == trip_booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    _require_booking_access(user, booking)
    rows = (
        db.query(models.TripBookingPaymentRecord)
        .filter(models.TripBookingPaymentRecord.booking_id == booking.id)
        .order_by(models.TripBookingPaymentRecord.created_at.desc())
        .all()
    )
    return rows


@router.post("/trip-bookings/{trip_booking_id}/payments", response_model=schemas.TripBookingPaymentRecord)
def upsert_trip_booking_payment(
    trip_booking_id: int,
    body: schemas.TripBookingPaymentUpsertRequest,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    booking = db.query(models.TripBooking).filter(models.TripBooking.id == trip_booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    _require_booking_access(user, booking)
    role_value = getattr(user.role, "value", user.role) if user.role else None
    payment = (
        db.query(models.TripBookingPaymentRecord)
        .filter(models.TripBookingPaymentRecord.booking_id == booking.id)
        .order_by(models.TripBookingPaymentRecord.created_at.desc())
        .first()
    )
    now = _utcnow()
    event_note = "Payment updated"
    if not payment:
        payment = models.TripBookingPaymentRecord(
            booking_id=booking.id,
            status=models.TripBookingPaymentStatus.WAITING,
            created_at=now,
        )
        db.add(payment)
        db.flush()
    if body.status:
        s = body.status.strip().lower()
        mapping = {
            "waiting_payment": models.TripBookingPaymentStatus.WAITING,
            "waiting": models.TripBookingPaymentStatus.WAITING,
            "payment_sent": models.TripBookingPaymentStatus.SENT,
            "sent": models.TripBookingPaymentStatus.SENT,
            "agency_confirmed": models.TripBookingPaymentStatus.AGENCY_CONFIRMED,
            "customer_confirmed": models.TripBookingPaymentStatus.CUSTOMER_CONFIRMED,
            "completed": models.TripBookingPaymentStatus.COMPLETED,
        }
        mapped = mapping.get(s, models.TripBookingPaymentStatus.WAITING)
        payment.status = mapped
        event_note = f"Payment status: {s}"
    if body.payment_method:
        payment.payment_method = body.payment_method
    if body.reference_number:
        payment.reference_number = body.reference_number
    if body.amount is not None:
        payment.amount = body.amount
    if body.currency:
        payment.currency = body.currency
    if body.payment_date:
        try:
            payment.payment_date = datetime.datetime.fromisoformat(body.payment_date.replace("Z", "+00:00"))
        except Exception:
            payment.payment_date = _utcnow()
    if body.note is not None:
        payment.note = body.note
    if body.agency_confirm:
        if role_value not in ("agency", "admin"):
            raise HTTPException(status_code=403, detail="Only agency/admin can confirm")
        payment.agency_confirmed_at = now
        payment.agency_confirmed_by_user_id = user.id
        if payment.status == models.TripBookingPaymentStatus.WAITING or payment.status == models.TripBookingPaymentStatus.SENT:
            payment.status = models.TripBookingPaymentStatus.AGENCY_CONFIRMED
        event_note = "Agency confirmed payment"
    if body.customer_confirm:
        if role_value not in ("user", "admin"):
            raise HTTPException(status_code=403, detail="Only customer/admin can confirm")
        if role_value == "user" and booking.user_id != user.id:
            raise HTTPException(status_code=403, detail="Not allowed")
        payment.customer_confirmed_at = now
        payment.customer_confirmed_by_user_id = user.id
        if (
            payment.agency_confirmed_at
            and payment.customer_confirmed_at
        ):
            payment.status = models.TripBookingPaymentStatus.COMPLETED
        elif payment.status == models.TripBookingPaymentStatus.WAITING or payment.status == models.TripBookingPaymentStatus.SENT:
            payment.status = models.TripBookingPaymentStatus.CUSTOMER_CONFIRMED
        event_note = "Customer confirmed payment"
    db.add(payment)
    _append_timeline(
        db,
        booking.id,
        "payment_updated",
        actor_role=role_value,
        actor_user_id=user.id,
        note=event_note,
    )
    if payment.status == models.TripBookingPaymentStatus.COMPLETED:
        booking.status = models.TripBookingStatus.PAID
        db.add(booking)
        _append_timeline(db, booking.id, "payment_confirmed", actor_role="system", note="Payment fully confirmed")
    db.commit()
    db.refresh(payment)
    return payment


@router.get("/trip-bookings/{trip_booking_id}/checklist", response_model=List[schemas.TripBookingChecklistItem])
def list_trip_booking_checklist(
    trip_booking_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    booking = db.query(models.TripBooking).filter(models.TripBooking.id == trip_booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    _require_booking_access(user, booking)
    return (
        db.query(models.TripBookingChecklistItem)
        .filter(models.TripBookingChecklistItem.booking_id == booking.id)
        .order_by(models.TripBookingChecklistItem.sort_order.asc(), models.TripBookingChecklistItem.created_at.asc())
        .all()
    )


@router.patch("/trip-bookings/{trip_booking_id}/checklist", response_model=List[schemas.TripBookingChecklistItem])
def update_trip_booking_checklist(
    trip_booking_id: int,
    body: schemas.TripBookingChecklistUpdateRequest,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    booking = db.query(models.TripBooking).filter(models.TripBooking.id == trip_booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    _require_booking_access(user, booking)
    role_value = getattr(user.role, "value", user.role) if user.role else None
    item = (
        db.query(models.TripBookingChecklistItem)
        .filter(models.TripBookingChecklistItem.id == body.item_id)
        .filter(models.TripBookingChecklistItem.booking_id == booking.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    changed = False
    if body.is_completed is not None:
        item.is_completed = bool(body.is_completed)
        item.completed_by_user_id = user.id if body.is_completed else None
        item.completed_at = _utcnow() if body.is_completed else None
        changed = True
    if body.is_recommended is not None:
        if role_value not in ("agency", "admin"):
            raise HTTPException(status_code=403, detail="Only agency/admin can set recommended")
        if role_value == "agency":
            agency_id = _require_agency_access(user)
            if booking.agency_id != agency_id:
                raise HTTPException(status_code=403, detail="Not allowed")
        item.is_recommended = bool(body.is_recommended)
        changed = True
    if body.label:
        item.label = body.label.strip()
        changed = True
    if changed:
        db.add(item)
        db.commit()
    return (
        db.query(models.TripBookingChecklistItem)
        .filter(models.TripBookingChecklistItem.booking_id == booking.id)
        .order_by(models.TripBookingChecklistItem.sort_order.asc(), models.TripBookingChecklistItem.created_at.asc())
        .all()
    )


@router.post("/trip-bookings/{trip_booking_id}/checklist", response_model=List[schemas.TripBookingChecklistItem])
def add_trip_booking_checklist_item(
    trip_booking_id: int,
    body: schemas.TripBookingChecklistAddRequest,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    booking = db.query(models.TripBooking).filter(models.TripBooking.id == trip_booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    _require_booking_access(user, booking)
    label = body.label.strip()
    if not label:
        raise HTTPException(status_code=400, detail="label required")
    role_value = getattr(user.role, "value", user.role) if user.role else None
    recommended = bool(body.is_recommended)
    if recommended and role_value not in ("agency", "admin"):
        recommended = False
    max_sort = (
        db.query(func.max(models.TripBookingChecklistItem.sort_order))
        .filter(models.TripBookingChecklistItem.booking_id == booking.id)
        .scalar()
    ) or 0
    db.add(models.TripBookingChecklistItem(
        booking_id=booking.id,
        label=label,
        is_completed=False,
        is_recommended=recommended,
        sort_order=int(max_sort) + 1,
    ))
    db.commit()
    return (
        db.query(models.TripBookingChecklistItem)
        .filter(models.TripBookingChecklistItem.booking_id == booking.id)
        .order_by(models.TripBookingChecklistItem.sort_order.asc(), models.TripBookingChecklistItem.created_at.asc())
        .all()
    )


@router.get("/trip-bookings/{trip_booking_id}/messages", response_model=List[schemas.TripBookingMessage])
def list_trip_booking_messages(
    trip_booking_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    booking = db.query(models.TripBooking).filter(models.TripBooking.id == trip_booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    _require_booking_access(user, booking)
    rows = (
        db.query(models.TripBookingMessage)
        .filter(models.TripBookingMessage.booking_id == booking.id)
        .order_by(models.TripBookingMessage.created_at.asc())
        .all()
    )
    for m in rows:
        if m.sender_user_id != user.id and not m.is_read:
            m.is_read = True
            db.add(m)
    for m in rows:
        _enrich_one_message(db, m)
    db.commit()
    return rows


@router.post("/trip-bookings/{trip_booking_id}/messages", response_model=schemas.TripBookingMessage)
def send_trip_booking_message(
    trip_booking_id: int,
    body: schemas.TripBookingMessageSendRequest,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    booking = db.query(models.TripBooking).filter(models.TripBooking.id == trip_booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    _require_booking_access(user, booking)
    content = (body.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="content required")
    role_value = getattr(user.role, "value", user.role) if user.role else None
    if role_value == "agency":
        sender_role = models.MessageSenderRole.AGENCY
        recipient_id = booking.user_id
    elif role_value == "user":
        sender_role = models.MessageSenderRole.USER
        recipient_ids = _agency_recipient_user_ids(db, booking.agency_id)
        recipient_id = recipient_ids[0] if recipient_ids else None
    else:
        sender_role = models.MessageSenderRole.USER
        recipient_id = booking.user_id
    m = models.TripBookingMessage(
        booking_id=booking.id,
        sender_role=sender_role,
        sender_user_id=user.id,
        content=content,
        attachment_url=(body.attachment_url or None),
        is_read=False,
        created_at=_utcnow(),
    )
    db.add(m)
    db.flush()
    _append_timeline(db, booking.id, "message_sent", actor_role=role_value, actor_user_id=user.id, note=f"Message: {content[:80]}")
    if recipient_id:
        _notify_user(db, recipient_id, "New Booking Message", f"New message for booking {booking.booking_code or booking.id}.", f"/dashboard/trip-bookings/{booking.id}", notif_type="booking_message")
    db.commit()
    db.refresh(m)
    _enrich_one_message(db, m)
    db.commit()
    return m


@router.get("/trip-bookings/{trip_booking_id}/review", response_model=Optional[schemas.TripBookingReview])
def get_trip_booking_review(
    trip_booking_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
):
    booking = db.query(models.TripBooking).filter(models.TripBooking.id == trip_booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    _require_booking_access(user, booking)
    rv = (
        db.query(models.TripBookingReview)
        .filter(models.TripBookingReview.booking_id == booking.id)
        .filter(models.TripBookingReview.is_hidden.is_(False))
        .first()
    )
    if rv:
        _enrich_one_review(db, rv)
        db.commit()
    return rv


@router.post("/trip-bookings/{trip_booking_id}/review", response_model=schemas.TripBookingReview)
def submit_trip_booking_review(
    trip_booking_id: int,
    body: schemas.TripBookingReviewSubmitRequest,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("user")),
):
    booking = db.query(models.TripBooking).filter(models.TripBooking.id == trip_booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    _require_booking_access(user, booking)
    if booking.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    existing = (
        db.query(models.TripBookingReview)
        .filter(models.TripBookingReview.booking_id == booking.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Review already submitted")
    if not booking.trip_completed_at:
        now = _utcnow()
        booking.trip_completed_at = now
        if not booking.trip_started_at:
            booking.trip_started_at = now
        booking.status = models.TripBookingStatus.COMPLETED
        db.add(booking)
    rating = int(body.rating or 0)
    if rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="rating must be 1-5")
    rv = models.TripBookingReview(
        booking_id=booking.id,
        trip_request_id=booking.trip_request_id,
        user_id=user.id,
        agency_id=booking.agency_id,
        rating=rating,
        comment=body.comment or None,
        photos=_serialize_json_list(body.photos) if body.photos else None,
        trip_story=body.trip_story or None,
        is_hidden=False,
        created_at=_utcnow(),
    )
    db.add(rv)
    db.flush()
    if booking.status != models.TripBookingStatus.REVIEWED:
        booking.status = models.TripBookingStatus.REVIEWED
        db.add(booking)
    _append_timeline(db, booking.id, "review_submitted", actor_role="user", actor_user_id=user.id, note=f"Review submitted: {rating}/5")
    for uid in _agency_recipient_user_ids(db, booking.agency_id):
        _notify_user(db, uid, "New Review", f"New review for booking {booking.booking_code or booking.id}.", f"/dashboard/trip-bookings/{booking.id}", notif_type="review_submitted")
    db.commit()
    db.refresh(rv)
    _enrich_one_review(db, rv)
    db.commit()
    return rv


@router.post("/trip-bookings/{trip_booking_id}/review/agency-response", response_model=schemas.TripBookingReview)
def agency_respond_trip_booking_review(
    trip_booking_id: int,
    body: schemas.TripBookingAgencyReviewResponseRequest,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("agency")),
):
    agency_id = _require_agency_access(user)
    booking = db.query(models.TripBooking).filter(models.TripBooking.id == trip_booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.agency_id != agency_id:
        raise HTTPException(status_code=403, detail="Not allowed")
    rv = (
        db.query(models.TripBookingReview)
        .filter(models.TripBookingReview.booking_id == booking.id)
        .first()
    )
    if not rv:
        raise HTTPException(status_code=404, detail="Review not found")
    rv.agency_response = body.agency_response.strip() or None
    rv.agency_response_at = _utcnow()
    db.add(rv)
    db.commit()
    db.refresh(rv)
    _enrich_one_review(db, rv)
    db.commit()
    return rv


@router.get("/admin/trip-bookings", response_model=List[schemas.TripBooking])
def admin_list_trip_bookings(
    db: Session = Depends(database.get_db),
    _: models.User = Depends(get_current_user),
    __: dict = Depends(require_roles("admin")),
):
    rows = db.query(models.TripBooking).order_by(models.TripBooking.created_at.desc()).limit(500).all()
    for b in rows:
        _enrich_booking_summary(db, b)
    db.commit()
    return rows
