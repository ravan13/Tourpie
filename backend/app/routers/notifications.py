from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import database, models, schemas
from ..deps import get_current_user

router = APIRouter()

@router.get("", response_model=list[schemas.Notification])
def list_notifications(user: models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    items = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == user.id)
        .order_by(models.Notification.created_at.desc())
        .limit(200)
        .all()
    )
    return items

@router.post("/mark-read", response_model=dict)
def mark_read(
    body: schemas.NotificationMarkReadRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    if not body.notification_ids:
        return {"updated": 0}
    updated = (
        db.query(models.Notification)
        .filter(
            models.Notification.user_id == user.id,
            models.Notification.id.in_(body.notification_ids),
        )
        .update({models.Notification.is_read: True}, synchronize_session=False)
    )
    db.commit()
    return {"updated": int(updated or 0)}

@router.post("/mark-all-read", response_model=dict)
def mark_all_read(user: models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    updated = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == user.id, models.Notification.is_read == False)
        .update({models.Notification.is_read: True}, synchronize_session=False)
    )
    db.commit()
    return {"updated": int(updated or 0)}

