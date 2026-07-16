from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import json
from .. import models, schemas, database
from ..deps import get_current_user
from .packages import _apply_lifecycle_updates, _today_utc
from sqlalchemy import or_

router = APIRouter()

def format_package(pkg):
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

@router.get("/trending", response_model=List[schemas.Package])
def get_trending_packages(limit: int = 5, db: Session = Depends(database.get_db)):
    """
    Get packages with the most bookings in the last 30 days.
    """
    # Simplified: Get packages with most bookings overall
    _apply_lifecycle_updates(db)
    today = _today_utc()
    trending = (
        db.query(models.Package)
        .join(models.Booking)
        .filter(models.Package.status == "active")
        .filter(or_(models.Package.start_date.is_(None), models.Package.start_date <= today))
        .filter(or_(models.Package.end_date.is_(None), models.Package.end_date >= today))
        .group_by(models.Package.id)
        .order_by(func.count(models.Booking.id).desc())
        .limit(limit)
        .all()
    )
    
    # If not enough trending, fill with latest packages
    if len(trending) < limit:
        remaining = limit - len(trending)
        latest = (
            db.query(models.Package)
            .filter(models.Package.status == "active")
            .filter(or_(models.Package.start_date.is_(None), models.Package.start_date <= today))
            .filter(or_(models.Package.end_date.is_(None), models.Package.end_date >= today))
            .order_by(models.Package.created_at.desc(), models.Package.id.desc())
            .limit(remaining)
            .all()
        )
        trending.extend([p for p in latest if p not in trending])
        
    return [format_package(p) for p in trending]

@router.get("/top-rated", response_model=List[schemas.Package])
def get_top_rated_packages(limit: int = 5, db: Session = Depends(database.get_db)):
    """
    Get packages with the highest average rating.
    """
    _apply_lifecycle_updates(db)
    today = _today_utc()
    top_rated = (
        db.query(models.Package)
        .join(models.Review)
        .filter(models.Package.status == "active")
        .filter(or_(models.Package.start_date.is_(None), models.Package.start_date <= today))
        .filter(or_(models.Package.end_date.is_(None), models.Package.end_date >= today))
        .group_by(models.Package.id)
        .order_by(func.avg(models.Review.rating).desc())
        .limit(limit)
        .all()
    )
    
    # If not enough top rated, fill with latest packages
    if len(top_rated) < limit:
        remaining = limit - len(top_rated)
        latest = (
            db.query(models.Package)
            .filter(models.Package.status == "active")
            .filter(or_(models.Package.start_date.is_(None), models.Package.start_date <= today))
            .filter(or_(models.Package.end_date.is_(None), models.Package.end_date >= today))
            .order_by(models.Package.created_at.desc(), models.Package.id.desc())
            .limit(remaining)
            .all()
        )
        top_rated.extend([p for p in latest if p not in top_rated])
        
    return [format_package(p) for p in top_rated]

@router.get("/personalized", response_model=List[schemas.Package])
def get_personalized_recommendations(
    user_id: int | None = None,
    limit: int = 5,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    """
    Personalized recommendations based on user's past bookings and reviews.
    """
    # Logic: Find destinations the user has booked before and suggest similar ones
    _apply_lifecycle_updates(db)
    today = _today_utc()
    if user_id is not None and user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    resolved_user_id = user.id
    user_bookings = (
        db.query(models.Booking)
        .options()
        .filter(models.Booking.user_id == resolved_user_id)
        .all()
    )
    if not user_bookings:
        # Fallback to trending if no history
        return get_trending_packages(limit=limit, db=db)
        
    booked_destinations = [b.package.destination for b in user_bookings if b.package]
    
    recommendations = (
        db.query(models.Package)
        .filter(models.Package.destination.in_(booked_destinations))
        .filter(~models.Package.id.in_([b.package_id for b in user_bookings]))
        .filter(models.Package.status == "active")
        .filter(or_(models.Package.start_date.is_(None), models.Package.start_date <= today))
        .filter(or_(models.Package.end_date.is_(None), models.Package.end_date >= today))
        .limit(limit)
        .all()
    )
    
    if len(recommendations) < limit:
        remaining = limit - len(recommendations)
        trending = get_trending_packages(limit=remaining, db=db)
        recommendations.extend([p for p in trending if p not in recommendations])
        
    return [format_package(p) for p in recommendations]
