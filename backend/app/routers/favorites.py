from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import database, models, schemas
from ..deps import get_current_user

router = APIRouter()

@router.get("", response_model=list[schemas.Favorite])
def list_favorites(user: models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    items = (
        db.query(models.Favorite)
        .filter(models.Favorite.user_id == user.id)
        .order_by(models.Favorite.created_at.desc())
        .all()
    )
    return items

@router.get("/packages", response_model=list[schemas.Package])
def list_favorite_packages(user: models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    favorites = db.query(models.Favorite.package_id).filter(models.Favorite.user_id == user.id).all()
    package_ids = [row[0] for row in favorites]
    if not package_ids:
        return []
    items = db.query(models.Package).filter(models.Package.id.in_(package_ids)).all()
    return items

@router.post("", response_model=schemas.Favorite, status_code=201)
def add_favorite(
    body: schemas.FavoriteCreateRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    pkg = db.query(models.Package).filter(models.Package.id == body.package_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")

    existing = (
        db.query(models.Favorite)
        .filter(models.Favorite.user_id == user.id, models.Favorite.package_id == body.package_id)
        .first()
    )
    if existing:
        return existing

    fav = models.Favorite(user_id=user.id, package_id=body.package_id)
    db.add(fav)
    db.commit()
    db.refresh(fav)
    return fav

@router.delete("/{package_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(
    package_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    existing = (
        db.query(models.Favorite)
        .filter(models.Favorite.user_id == user.id, models.Favorite.package_id == package_id)
        .first()
    )
    if not existing:
        return
    db.delete(existing)
    db.commit()
    return

