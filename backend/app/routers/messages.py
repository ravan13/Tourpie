from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import datetime

from .. import database, models, schemas
from ..deps import get_current_user

router = APIRouter()

def _is_agency_user(user: models.User) -> bool:
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    return role_value == "agency" and bool(user.agency_id)

def _is_regular_user(user: models.User) -> bool:
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    return role_value == "user"

def _conversation_accessible(user: models.User, conv: models.Conversation) -> bool:
    if _is_regular_user(user):
        return conv.user_id == user.id
    if _is_agency_user(user):
        return conv.agency_id == user.agency_id
    return False

def _notify_user(db: Session, user_id: int, title: str, body: str | None = None, link_url: str | None = None):
    n = models.Notification(
        user_id=user_id,
        type=models.NotificationType.MESSAGE,
        title=title,
        body=body,
        link_url=link_url,
        is_read=False,
    )
    db.add(n)

@router.get("/conversations", response_model=list[schemas.Conversation])
def list_conversations(user: models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    if _is_regular_user(user):
        rows = (
            db.query(models.Conversation)
            .filter(models.Conversation.user_id == user.id)
            .order_by(models.Conversation.updated_at.desc())
            .all()
        )
        return rows
    if _is_agency_user(user):
        rows = (
            db.query(models.Conversation)
            .filter(models.Conversation.agency_id == user.agency_id)
            .order_by(models.Conversation.updated_at.desc())
            .all()
        )
        return rows
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

@router.post("/conversations", response_model=schemas.Conversation, status_code=201)
def create_conversation(
    body: schemas.ConversationCreateRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    if not _is_regular_user(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    agency = db.query(models.Agency).filter(models.Agency.id == body.agency_id).first()
    if not agency:
        raise HTTPException(status_code=404, detail="Agency not found")

    existing = (
        db.query(models.Conversation)
        .filter(
            models.Conversation.user_id == user.id,
            models.Conversation.agency_id == body.agency_id,
            models.Conversation.package_id == body.package_id,
        )
        .first()
    )
    if existing:
        return existing

    conv = models.Conversation(
        user_id=user.id,
        agency_id=body.agency_id,
        package_id=body.package_id,
        created_at=datetime.datetime.now(datetime.timezone.utc),
        updated_at=datetime.datetime.now(datetime.timezone.utc),
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv

@router.get("/conversations/{conversation_id}/messages", response_model=list[schemas.Message])
def list_messages(
    conversation_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    conv = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conv or not _conversation_accessible(user, conv):
        raise HTTPException(status_code=404, detail="Conversation not found")

    msgs = (
        db.query(models.Message)
        .filter(models.Message.conversation_id == conversation_id)
        .order_by(models.Message.created_at.asc())
        .all()
    )
    return msgs

@router.post("/conversations/{conversation_id}/messages", response_model=schemas.Message, status_code=201)
def send_message(
    conversation_id: int,
    body: schemas.MessageCreateRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    conv = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conv or not _conversation_accessible(user, conv):
        raise HTTPException(status_code=404, detail="Conversation not found")

    if _is_regular_user(user):
        sender_role = models.MessageSenderRole.USER
    elif _is_agency_user(user):
        sender_role = models.MessageSenderRole.AGENCY
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    msg = models.Message(
        conversation_id=conversation_id,
        sender_role=sender_role,
        sender_user_id=user.id,
        content=body.content.strip(),
        created_at=datetime.datetime.now(datetime.timezone.utc),
    )
    conv.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.add(msg)

    if sender_role == models.MessageSenderRole.USER:
        agency_user = db.query(models.User).filter(models.User.agency_id == conv.agency_id).order_by(models.User.id.asc()).first()
        if agency_user:
            _notify_user(
                db,
                agency_user.id,
                title="New message",
                body=body.content.strip()[:240],
                link_url=f"/admin?tab=messages&conversation={conv.id}",
            )
    else:
        _notify_user(
            db,
            conv.user_id,
            title="New message",
            body=body.content.strip()[:240],
            link_url=f"/dashboard/messages?conversation={conv.id}",
        )

    db.commit()
    db.refresh(msg)
    return msg

