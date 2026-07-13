from __future__ import annotations

import datetime
import json
import secrets
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import database, models, schemas
from ..deps import get_current_user, require_roles


router = APIRouter()


def _utcnow() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def _parse_date(value: Optional[str]) -> Optional[datetime.date]:
    if not value:
        return None
    return datetime.date.fromisoformat(value)


def _parse_json_list(raw: Optional[str]) -> List[str]:
    if not raw:
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


def _normalize(value: str) -> str:
    return (value or "").strip().lower()


def _budget_status(request: models.TripRequest, offer_price: float) -> tuple[str, float | None, float | None]:
    ideal = float(request.ideal_budget or 0)
    max_budget = request.max_budget
    if offer_price <= ideal:
        return ("within_ideal", offer_price - ideal, None)
    if max_budget is not None and offer_price <= float(max_budget):
        return ("within_maximum", offer_price - ideal, offer_price - float(max_budget))
    if max_budget is not None and offer_price > float(max_budget):
        return ("above_maximum", offer_price - ideal, offer_price - float(max_budget))
    return ("above_ideal", offer_price - ideal, None)


def _make_request_code() -> str:
    stamp = datetime.datetime.utcnow().strftime("%Y%m%d")
    suffix = secrets.token_hex(3).upper()
    return f"TPR-{stamp}-{suffix}"


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
    if agency.status != "active":
        return False
    if agency.subscription_status != models.AgencySubscriptionStatus.ACTIVE:
        return False
    if not bool(agency.custom_trip_requests_enabled):
        return False
    return True


def _agency_matches_destination(agency: models.Agency, destination: str, destination_type: models.TripDestinationType) -> bool:
    dest = _normalize(destination)
    countries = [_normalize(x) for x in _parse_json_list(agency.countries_served)]
    cities = [_normalize(x) for x in _parse_json_list(agency.cities_served)]
    if destination_type == models.TripDestinationType.ANY:
        return bool(countries or cities)
    if destination_type == models.TripDestinationType.COUNTRY:
        return dest in countries
    if destination_type == models.TripDestinationType.CITY:
        return dest in cities
    return False


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
    trip_row = models.TripOfferNotification(
        recipient_user_id=user_id,
        trip_request_id=trip_request_id,
        trip_offer_id=trip_offer_id,
        type=notif_type,
        title=title,
        body=body,
        link_url=link_url,
    )
    db.add(trip_row)
    try:
        fallback = models.Notification(
            user_id=user_id,
            type=models.NotificationType.SYSTEM,
            title=title,
            body=body,
            link_url=link_url,
        )
        db.add(fallback)
    except Exception:
        pass


@router.post("/trip-requests", response_model=schemas.TripRequest)
def create_trip_request(
    body: schemas.TripRequestCreateRequest,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("user")),
):
    destination = (body.destination or "").strip()
    if not destination:
        raise HTTPException(status_code=400, detail="Destination is required")
    if body.adults < 1:
        raise HTTPException(status_code=400, detail="Adults must be at least 1")
    if body.children < 0:
        raise HTTPException(status_code=400, detail="Children must be 0 or more")
    if body.ideal_budget <= 0:
        raise HTTPException(status_code=400, detail="Ideal budget must be greater than 0")
    if body.max_budget is not None and body.max_budget < body.ideal_budget:
        raise HTTPException(status_code=400, detail="Maximum budget must be greater than or equal to ideal budget")

    start_date = _parse_date(body.start_date)
    end_date = _parse_date(body.end_date)
    if not body.flexible_dates:
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="Travel dates are required unless flexible")
        if start_date > end_date:
            raise HTTPException(status_code=400, detail="Start date must be before end date")

    now = _utcnow()
    expires_at = now + datetime.timedelta(hours=int(body.offer_expiration_hours))

    try:
        dest_type = models.TripDestinationType(body.destination_type)
    except Exception:
        dest_type = models.TripDestinationType.ANY

    try:
        budget_flex = models.TripBudgetFlexibility(body.budget_flexibility)
    except Exception:
        budget_flex = models.TripBudgetFlexibility.FIXED

    request_code = _make_request_code()
    row = models.TripRequest(
        request_code=request_code,
        user_id=user.id,
        destination=destination,
        destination_type=dest_type,
        start_date=start_date,
        end_date=end_date,
        flexible_dates=bool(body.flexible_dates),
        adults=int(body.adults),
        children=int(body.children),
        ideal_budget=float(body.ideal_budget),
        max_budget=float(body.max_budget) if body.max_budget is not None else None,
        budget_currency=str(body.budget_currency or "USD").upper(),
        budget_flexibility=budget_flex,
        hotel_stars=body.hotel_stars,
        meal_type=body.meal_type,
        flight_included=bool(body.flight_included),
        transfer_included=bool(body.transfer_included),
        visa_assistance=bool(body.visa_assistance),
        travel_insurance=bool(body.travel_insurance),
        preferred_airline=body.preferred_airline,
        accommodation_preferences=body.accommodation_preferences,
        activities_interests=body.activities_interests,
        special_notes=body.special_notes,
        offer_expiration_hours=int(body.offer_expiration_hours),
        expires_at=expires_at,
        status=models.TripRequestStatus.SUBMITTED,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    agencies = db.query(models.Agency).all()
    matched = []
    for agency in agencies:
        if not _agency_is_matchable(agency):
            continue
        if not _agency_matches_destination(agency, destination, dest_type):
            continue
        matched.append(agency)

    if matched:
        row.status = models.TripRequestStatus.SEARCHING_AGENCIES
        db.add(row)
        for agency in matched:
            match_row = models.TripRequestAgencyMatch(trip_request_id=row.id, agency_id=agency.id, status="sent")
            db.add(match_row)
            for recipient_user_id in _agency_recipient_user_ids(db, agency.id):
                _notify_user(
                    db,
                    recipient_user_id,
                    title="New Custom Trip Request",
                    body=f"Request {row.request_code} matches your coverage area.",
                    link_url=f"/agency/incoming-requests?request={row.id}",
                    trip_request_id=row.id,
                    notif_type="new_matching_request",
                )
        row.status = models.TripRequestStatus.RECEIVING_OFFERS
    else:
        row.status = models.TripRequestStatus.SEARCHING_AGENCIES

    db.commit()
    db.refresh(row)
    return row


@router.get("/trip-requests/me", response_model=List[schemas.TripRequest])
def list_my_trip_requests(
    db: Session = Depends(database.get_db),
    user: models.User = Depends(get_current_user),
    _: dict = Depends(require_roles("user")),
):
    now = _utcnow()
    rows = (
        db.query(models.TripRequest)
        .filter(models.TripRequest.user_id == user.id)
        .order_by(models.TripRequest.created_at.desc())
        .all()
    )
    for row in rows:
        if row.status not in (models.TripRequestStatus.ACCEPTED, models.TripRequestStatus.CANCELLED, models.TripRequestStatus.EXPIRED):
            if row.expires_at and row.expires_at < now:
                row.status = models.TripRequestStatus.EXPIRED
                db.add(row)
    db.commit()
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
    return row


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
    if row.status == models.TripRequestStatus.ACCEPTED:
        raise HTTPException(status_code=400, detail="Request already accepted")
    row.status = models.TripRequestStatus.CANCELLED
    row.updated_at = _utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
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
    if req.status == models.TripRequestStatus.RECEIVING_OFFERS:
        req.status = models.TripRequestStatus.COMPARING_OFFERS
        req.updated_at = _utcnow()
        db.add(req)
        db.commit()
    offers = (
        db.query(models.TripOffer)
        .filter(models.TripOffer.trip_request_id == trip_request_id)
        .order_by(models.TripOffer.created_at.desc())
        .all()
    )
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
    req = db.query(models.TripRequest).filter(models.TripRequest.id == offer.trip_request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Trip request not found")
    _require_user_owns_request(user, req)
    if req.status == models.TripRequestStatus.ACCEPTED:
        raise HTTPException(status_code=400, detail="A booking already exists for this request")
    if offer.status != models.TripOfferStatus.SUBMITTED:
        raise HTTPException(status_code=400, detail="Offer cannot be accepted")

    now = _utcnow()
    offer.status = models.TripOfferStatus.ACCEPTED
    offer.accepted_at = now
    offer.updated_at = now
    db.add(offer)

    req.status = models.TripRequestStatus.ACCEPTED
    req.updated_at = now
    db.add(req)

    other_offers = (
        db.query(models.TripOffer)
        .filter(models.TripOffer.trip_request_id == req.id)
        .filter(models.TripOffer.id != offer.id)
        .all()
    )
    for other in other_offers:
        if other.status == models.TripOfferStatus.SUBMITTED:
            other.status = models.TripOfferStatus.DECLINED
            other.declined_at = now
            other.updated_at = now
            db.add(other)

    booking = models.TripBooking(
        trip_request_id=req.id,
        trip_offer_id=offer.id,
        user_id=req.user_id,
        agency_id=offer.agency_id,
        status="booking_confirmed",
        created_at=now,
    )
    db.add(booking)

    for recipient_user_id in _agency_recipient_user_ids(db, offer.agency_id):
        _notify_user(
            db,
            recipient_user_id,
            title="Offer Accepted",
            body=f"Offer #{offer.id} was accepted.",
            link_url=f"/agency/incoming-requests?request={req.id}",
            trip_request_id=req.id,
            trip_offer_id=offer.id,
            notif_type="offer_accepted",
        )
    _notify_user(
        db,
        req.user_id,
        title="Booking Confirmed",
        body=f"You accepted an offer for {req.destination}.",
        link_url=f"/dashboard/offers?offer={offer.id}",
        trip_request_id=req.id,
        trip_offer_id=offer.id,
        notif_type="accepted_booking",
    )

    db.commit()
    db.refresh(booking)
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
    return rows


@router.post("/agency/trip-requests/{trip_request_id}/decline", response_model=schemas.TripRequestAgencyMatch)
def decline_trip_request(
    trip_request_id: int,
    reason: Optional[str] = None,
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
    match_row.status = "declined"
    match_row.declined_reason = reason
    db.add(match_row)
    db.commit()
    db.refresh(match_row)
    return match_row


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
    if not allowed or allowed.status == "declined":
        raise HTTPException(status_code=403, detail="Not allowed")
    if req.expires_at and req.expires_at < _utcnow():
        raise HTTPException(status_code=400, detail="Request expired")

    if body.total_price <= 0:
        raise HTTPException(status_code=400, detail="Total price must be greater than 0")

    offer_price = float(body.total_price)
    needs_reason = offer_price > float(req.ideal_budget or 0) or (req.max_budget is not None and offer_price > float(req.max_budget))
    if needs_reason and not body.price_difference_reason:
        raise HTTPException(status_code=400, detail="Reason for price difference is required")

    if body.price_difference_reason == models.TripPriceDifferenceReason.OTHER.value and not (body.price_difference_notes or "").strip():
        raise HTTPException(status_code=400, detail="Reason notes are required")

    now = _utcnow()
    exp_hours = int(body.offer_expiration_hours or req.offer_expiration_hours or 48)
    offer_expires_at = now + datetime.timedelta(hours=exp_hours)
    if req.expires_at and offer_expires_at > req.expires_at:
        offer_expires_at = req.expires_at

    try:
        reason_enum = models.TripPriceDifferenceReason(body.price_difference_reason) if body.price_difference_reason else None
    except Exception:
        reason_enum = None

    offer = models.TripOffer(
        trip_request_id=req.id,
        agency_id=agency_id,
        created_by_user_id=user.id,
        total_price=offer_price,
        currency=str(body.currency or req.budget_currency or "USD").upper(),
        hotel=body.hotel,
        room_type=body.room_type,
        meal_plan=body.meal_plan,
        flight=body.flight,
        transfer=body.transfer,
        visa=body.visa,
        insurance=body.insurance,
        activities=body.activities,
        offer_description=body.offer_description,
        additional_benefits=body.additional_benefits,
        price_difference_reason=reason_enum,
        price_difference_notes=body.price_difference_notes,
        expires_at=offer_expires_at,
        status=models.TripOfferStatus.SUBMITTED,
        created_at=now,
        updated_at=now,
    )
    db.add(offer)
    db.flush()

    budget_status, delta_ideal, delta_max = _budget_status(req, offer_price)
    comparison = models.OfferComparison(
        trip_request_id=req.id,
        trip_offer_id=offer.id,
        ideal_budget=float(req.ideal_budget or 0),
        max_budget=float(req.max_budget) if req.max_budget is not None else None,
        offer_price=offer_price,
        budget_status=budget_status,
        delta_from_ideal=float(delta_ideal) if delta_ideal is not None else None,
        delta_from_max=float(delta_max) if delta_max is not None else None,
        created_at=now,
    )
    db.add(comparison)

    allowed.status = "offered"
    db.add(allowed)

    _notify_user(
        db,
        req.user_id,
        title="New Offer",
        body=f"New offer for {req.destination} from {agency.name}.",
        link_url=f"/dashboard/offers?request={req.id}",
        trip_request_id=req.id,
        trip_offer_id=offer.id,
        notif_type="new_offer",
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
                link_url=f"/dashboard/offers?offer={offer.id}",
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
    return rows


@router.get("/admin/trip-offers", response_model=List[schemas.TripOffer])
def admin_list_trip_offers(
    db: Session = Depends(database.get_db),
    _: models.User = Depends(get_current_user),
    __: dict = Depends(require_roles("admin")),
):
    rows = db.query(models.TripOffer).order_by(models.TripOffer.created_at.desc()).limit(500).all()
    return rows
