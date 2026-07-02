from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from typing import List, Optional
import datetime

from .. import models, schemas, database
from ..deps import get_current_user

router = APIRouter()

def _role_value(user: models.User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)

@router.get("/logs", response_model=List[schemas.ModerationLog])
def list_logs(
    skip: int = 0,
    limit: int = 200,
    entity_type: Optional[str] = None,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    if _role_value(user) != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    query = db.query(models.ModerationLog)
    if entity_type:
        query = query.filter(models.ModerationLog.entity_type == entity_type)
    rows = query.order_by(desc(models.ModerationLog.created_at)).offset(skip).limit(limit).all()
    return rows

@router.post("/restore")
def restore_entity(
    entity_type: str,
    entity_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    if _role_value(user) != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    if entity_type == "community_post":
        row = db.query(models.CommunityPost).filter(models.CommunityPost.id == entity_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Not found")
        row.is_hidden = False
    elif entity_type == "community_comment":
        row = db.query(models.CommunityComment).filter(models.CommunityComment.id == entity_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Not found")
        row.is_hidden = False
    elif entity_type == "review":
        row = db.query(models.Review).filter(models.Review.id == entity_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Not found")
        row.is_hidden = False
    else:
        raise HTTPException(status_code=400, detail="Unsupported entity_type")

    db.add(
        models.ModerationLog(
            entity_type=entity_type,
            entity_id=entity_id,
            user_id=row.user_id if hasattr(row, "user_id") else None,
            reason="admin_restore",
            action="restored",
            reviewed_at=datetime.datetime.now(datetime.timezone.utc),
            reviewed_by_user_id=user.id,
        )
    )
    db.commit()
    return {"message": "restored"}

@router.get("/community/posts", response_model=List[schemas.CommunityPost])
def list_community_posts(
    skip: int = 0,
    limit: int = 50,
    status_filter: Optional[str] = None,
    q: Optional[str] = None,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    if _role_value(user) != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    query = db.query(models.CommunityPost).options(joinedload(models.CommunityPost.user))
    if status_filter:
        query = query.filter(models.CommunityPost.status == status_filter)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter((models.CommunityPost.title.ilike(like)) | (models.CommunityPost.body.ilike(like)))
    rows = query.order_by(desc(models.CommunityPost.created_at)).offset(skip).limit(limit).all()
    return rows

@router.post("/community/posts/{post_id}/decision", response_model=schemas.CommunityPost)
def decide_community_post(
    post_id: int,
    body: schemas.ModerationCommunityPostDecisionRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    if _role_value(user) != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    post = db.query(models.CommunityPost).filter(models.CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Not found")

    now = datetime.datetime.now(datetime.timezone.utc)
    action = body.action
    note = (body.note or "").strip() or None

    if action == "approve":
        post.status = "approved"
        post.is_hidden = False
        post.moderation_note = None
    elif action == "reject":
        post.status = "rejected"
        post.is_hidden = True
        post.moderation_note = note
    elif action == "needs_revision":
        post.status = "needs_revision"
        post.is_hidden = True
        post.moderation_note = note
    elif action == "hide":
        post.status = "hidden"
        post.is_hidden = True
        post.moderation_note = note
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    post.reviewed_at = now
    post.reviewed_by_user_id = user.id
    post.updated_at = now

    db.add(
        models.ModerationLog(
            entity_type="community_post",
            entity_id=post.id,
            user_id=post.user_id,
            reason="admin_decision",
            note=note,
            action=f"post_{action}",
            reviewed_at=now,
            reviewed_by_user_id=user.id,
        )
    )
    if post.user_id:
        title = "i18n:moderation_post_title"
        body_text = f"i18n:moderation_post_body:{post.status}"
        db.add(
            models.Notification(
                user_id=post.user_id,
                type=models.NotificationType.SYSTEM,
                title=title,
                body=body_text + (f":{note}" if note else ""),
                link_url=f"/community/posts/{post.id}",
                created_at=now,
            )
        )

    db.commit()
    db.refresh(post)
    return post

@router.post("/users/{user_id}/ban", response_model=dict)
def ban_user(
    user_id: int,
    body: schemas.ModerationUserBanRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    if _role_value(user) != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if _role_value(target) == "admin":
        raise HTTPException(status_code=400, detail="Cannot ban admin")

    now = datetime.datetime.now(datetime.timezone.utc)
    duration_days = body.duration_days if isinstance(body.duration_days, int) else None
    until = None
    if duration_days is not None and duration_days > 0:
        until = now + datetime.timedelta(days=duration_days)
    target.is_banned = True
    target.banned_until = until
    target.banned_reason = (body.reason or "").strip() or None

    db.add(
        models.ModerationLog(
            entity_type="user",
            entity_id=target.id,
            user_id=target.id,
            reason="admin_ban",
            note=target.banned_reason,
            action="banned",
            reviewed_at=now,
            reviewed_by_user_id=user.id,
        )
    )
    db.commit()
    return {"message": "banned"}

@router.post("/users/{user_id}/unban", response_model=dict)
def unban_user(
    user_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    if _role_value(user) != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.datetime.now(datetime.timezone.utc)
    target.is_banned = False
    target.banned_until = None
    target.banned_reason = None
    db.add(
        models.ModerationLog(
            entity_type="user",
            entity_id=target.id,
            user_id=target.id,
            reason="admin_unban",
            action="unbanned",
            reviewed_at=now,
            reviewed_by_user_id=user.id,
        )
    )
    db.commit()
    return {"message": "unbanned"}
