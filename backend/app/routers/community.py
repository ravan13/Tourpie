from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, or_, and_
from typing import List, Optional
import datetime
import json
import re

from .. import models, schemas, database
from ..deps import get_current_user, get_optional_user

router = APIRouter()

_LINK_RE = re.compile(r"https?://\S+", re.IGNORECASE)
_OFFICIAL_KINDS = {
    "announcement",
    "update",
    "guidelines",
    "campaign",
    "featured",
    "notice",
}

def _role_value(user: models.User | None) -> str:
    if not user:
        return "guest"
    return user.role.value if hasattr(user.role, "value") else str(user.role)

def _safe_text(value: str | None) -> str:
    return (value or "").strip()

def _detect_violation(text: str) -> str | None:
    v = text.lower()
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
    links = _LINK_RE.findall(text)
    if len(links) >= 3:
        return "suspicious_links"
    if links and ("verify" in v or "login" in v or "password" in v):
        return "phishing_like_text"
    return None

def _format_post(p: models.CommunityPost) -> models.CommunityPost:
    if getattr(p, "images", None) and isinstance(p.images, str):
        try:
            parsed = json.loads(p.images)
            p.images = parsed if isinstance(parsed, list) else []
        except json.JSONDecodeError:
            p.images = []
    return p

@router.get("/posts", response_model=List[schemas.CommunityPost])
def list_posts(
    skip: int = 0,
    limit: int = 20,
    q: Optional[str] = None,
    tag: Optional[str] = None,
    kind: Optional[str] = None,
    tab: Optional[str] = "trending",
    user: models.User | None = Depends(get_optional_user),
    db: Session = Depends(database.get_db),
):
    role = _role_value(user)
    query = (
        db.query(models.CommunityPost)
        .options(joinedload(models.CommunityPost.user))
    )
    if role != "admin":
        approved = or_(models.CommunityPost.status == "approved", models.CommunityPost.status.is_(None))
        if user:
            query = query.filter(
                or_(
                    and_(models.CommunityPost.is_hidden.is_(False), approved),
                    models.CommunityPost.user_id == user.id,
                )
            )
        else:
            query = query.filter(models.CommunityPost.is_hidden.is_(False)).filter(approved)
    if tag and tag != "all":
        query = query.filter(models.CommunityPost.tag == tag)
    if kind and kind != "all":
        query = query.filter(models.CommunityPost.kind == kind)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            (models.CommunityPost.title.ilike(like)) |
            (models.CommunityPost.body.ilike(like))
        )

    if tab == "saved":
        if not user:
            return []
        query = (
            query.join(models.CommunityPostBookmark, models.CommunityPostBookmark.post_id == models.CommunityPost.id)
            .filter(models.CommunityPostBookmark.user_id == user.id)
            .order_by(desc(models.CommunityPost.created_at))
        )
    elif tab == "latest":
        query = query.order_by(desc(models.CommunityPost.created_at))
    else:
        query = query.order_by(desc(models.CommunityPost.likes_count + models.CommunityPost.comments_count))

    posts = query.offset(skip).limit(limit).all()

    liked_ids: set[int] = set()
    bookmarked_ids: set[int] = set()
    if user:
        ids = [p.id for p in posts]
        if ids:
            liked_ids = {
                r.post_id
                for r in db.query(models.CommunityPostLike)
                .filter(models.CommunityPostLike.user_id == user.id)
                .filter(models.CommunityPostLike.post_id.in_(ids))
                .all()
            }
            bookmarked_ids = {
                r.post_id
                for r in db.query(models.CommunityPostBookmark)
                .filter(models.CommunityPostBookmark.user_id == user.id)
                .filter(models.CommunityPostBookmark.post_id.in_(ids))
                .all()
            }

    for p in posts:
        _format_post(p)
        p.user = schemas.UserPublic.model_validate(p.user) if p.user else None
        setattr(p, "liked", p.id in liked_ids)
        setattr(p, "bookmarked", p.id in bookmarked_ids)

    return posts

@router.post("/posts", response_model=schemas.CommunityPost)
def create_post(
    body: schemas.CommunityPostCreateRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    title = _safe_text(body.title)
    text = _safe_text(body.body)
    if not title or not text:
        raise HTTPException(status_code=400, detail="Title and body are required")
    if len(title) > 140:
        raise HTTPException(status_code=400, detail="Title is too long")

    images = body.images if isinstance(body.images, list) else None
    image_url = _safe_text(body.image_url) or (images[0] if images else None)
    kind_value = _safe_text(body.kind) or "story"
    role = _role_value(user)
    if role != "admin" and kind_value in _OFFICIAL_KINDS:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Official post kind is admin-only")

    violation = _detect_violation(f"{title}\n{text}")
    is_hidden = violation is not None
    status_value = "pending_review" if violation else "approved"

    post = models.CommunityPost(
        user_id=user.id,
        title=title,
        body=text,
        tag=_safe_text(body.tag) or None,
        kind=kind_value,
        image_url=image_url,
        images=json.dumps(images) if images else None,
        is_hidden=is_hidden,
        status=status_value,
        created_at=datetime.datetime.now(datetime.timezone.utc),
        updated_at=datetime.datetime.now(datetime.timezone.utc),
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    if violation:
        db.add(
            models.ModerationLog(
                entity_type="community_post",
                entity_id=post.id,
                user_id=user.id,
                reason=violation,
                action="flagged",
            )
        )
        db.commit()

    _format_post(post)
    setattr(post, "liked", False)
    setattr(post, "bookmarked", False)
    return post

@router.get("/posts/{post_id}", response_model=schemas.CommunityPost)
def get_post(
    post_id: int,
    user: models.User | None = Depends(get_optional_user),
    db: Session = Depends(database.get_db),
):
    role = _role_value(user)
    query = (
        db.query(models.CommunityPost)
        .options(joinedload(models.CommunityPost.user))
        .filter(models.CommunityPost.id == post_id)
    )
    if role != "admin":
        approved = or_(models.CommunityPost.status == "approved", models.CommunityPost.status.is_(None))
        if user:
            query = query.filter(
                or_(
                    and_(models.CommunityPost.is_hidden.is_(False), approved),
                    models.CommunityPost.user_id == user.id,
                )
            )
        else:
            query = query.filter(models.CommunityPost.is_hidden.is_(False)).filter(approved)
    post = query.first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    _format_post(post)
    if post.user:
        post.user = schemas.UserPublic.model_validate(post.user)

    if user:
        liked = (
            db.query(models.CommunityPostLike)
            .filter(models.CommunityPostLike.post_id == post_id)
            .filter(models.CommunityPostLike.user_id == user.id)
            .first()
            is not None
        )
        bookmarked = (
            db.query(models.CommunityPostBookmark)
            .filter(models.CommunityPostBookmark.post_id == post_id)
            .filter(models.CommunityPostBookmark.user_id == user.id)
            .first()
            is not None
        )
        setattr(post, "liked", liked)
        setattr(post, "bookmarked", bookmarked)
    else:
        setattr(post, "liked", False)
        setattr(post, "bookmarked", False)
    return post

@router.put("/posts/{post_id}", response_model=schemas.CommunityPost)
def update_post(
    post_id: int,
    body: schemas.CommunityPostUpdateRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    post = db.query(models.CommunityPost).filter(models.CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    role = _role_value(user)
    if role != "admin" and post.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    if body.title is not None:
        post.title = _safe_text(body.title)
    if body.body is not None:
        post.body = _safe_text(body.body)
    if body.tag is not None:
        post.tag = _safe_text(body.tag) or None
    if body.kind is not None:
        next_kind = _safe_text(body.kind) or post.kind
        if role != "admin" and next_kind in _OFFICIAL_KINDS:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Official post kind is admin-only")
        post.kind = next_kind
    if body.image_url is not None:
        post.image_url = _safe_text(body.image_url) or None
    if body.images is not None:
        post.images = json.dumps(body.images) if body.images else None
        if not post.image_url and body.images:
            post.image_url = body.images[0]

    violation = _detect_violation(f"{post.title}\n{post.body}")
    if violation:
        post.is_hidden = True
        post.status = "pending_review"
        db.add(
            models.ModerationLog(
                entity_type="community_post",
                entity_id=post.id,
                user_id=post.user_id,
                reason=violation,
                action="flagged",
            )
        )
    else:
        if role != "admin" and getattr(post, "status", None) in ("needs_revision", "rejected"):
            post.is_hidden = True
            post.status = "pending_review"

    post.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    db.refresh(post)
    _format_post(post)
    return post

@router.delete("/posts/{post_id}")
def delete_post(
    post_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    post = db.query(models.CommunityPost).filter(models.CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    role = _role_value(user)
    if role != "admin" and post.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    db.delete(post)
    db.commit()
    return {"message": "Post deleted"}

@router.post("/posts/{post_id}/like", response_model=schemas.CommunityPost)
def toggle_like(
    post_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    post = db.query(models.CommunityPost).filter(models.CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    existing = (
        db.query(models.CommunityPostLike)
        .filter(models.CommunityPostLike.post_id == post_id)
        .filter(models.CommunityPostLike.user_id == user.id)
        .first()
    )
    if existing:
        db.delete(existing)
        post.likes_count = max(0, int(post.likes_count or 0) - 1)
        liked = False
    else:
        db.add(models.CommunityPostLike(post_id=post_id, user_id=user.id))
        post.likes_count = int(post.likes_count or 0) + 1
        liked = True
    db.commit()
    db.refresh(post)
    _format_post(post)
    setattr(post, "liked", liked)
    return post

@router.post("/posts/{post_id}/bookmark", response_model=schemas.CommunityPost)
def toggle_bookmark(
    post_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    post = db.query(models.CommunityPost).filter(models.CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    existing = (
        db.query(models.CommunityPostBookmark)
        .filter(models.CommunityPostBookmark.post_id == post_id)
        .filter(models.CommunityPostBookmark.user_id == user.id)
        .first()
    )
    if existing:
        db.delete(existing)
        bookmarked = False
    else:
        db.add(models.CommunityPostBookmark(post_id=post_id, user_id=user.id))
        bookmarked = True
    db.commit()
    db.refresh(post)
    _format_post(post)
    setattr(post, "bookmarked", bookmarked)
    return post

@router.post("/posts/{post_id}/share")
def bump_share(post_id: int, db: Session = Depends(database.get_db)):
    post = db.query(models.CommunityPost).filter(models.CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post.shares_count = int(post.shares_count or 0) + 1
    db.commit()
    return {"message": "ok"}

@router.post("/posts/{post_id}/report")
def report_post(
    post_id: int,
    body: schemas.CommunityReportRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    post = db.query(models.CommunityPost).filter(models.CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    note = _safe_text(body.reason) or None
    db.add(
        models.ModerationLog(
            entity_type="community_post",
            entity_id=post.id,
            user_id=post.user_id,
            reporter_user_id=user.id,
            reason="user_report",
            note=note,
            action="reported",
        )
    )
    db.commit()
    return {"message": "reported"}

@router.get("/posts/{post_id}/comments", response_model=List[schemas.CommunityComment])
def list_comments(
    post_id: int,
    skip: int = 0,
    limit: int = 50,
    user: models.User | None = Depends(get_optional_user),
    db: Session = Depends(database.get_db),
):
    role = _role_value(user)
    query = (
        db.query(models.CommunityComment)
        .options(joinedload(models.CommunityComment.user))
        .filter(models.CommunityComment.post_id == post_id)
        .order_by(desc(models.CommunityComment.created_at))
    )
    if role != "admin":
        approved = or_(models.CommunityComment.status == "approved", models.CommunityComment.status.is_(None))
        if user:
            query = query.filter(
                or_(
                    and_(models.CommunityComment.is_hidden.is_(False), approved),
                    models.CommunityComment.user_id == user.id,
                )
            )
        else:
            query = query.filter(models.CommunityComment.is_hidden.is_(False)).filter(approved)
    rows = query.offset(skip).limit(limit).all()
    for c in rows:
        c.user = schemas.UserPublic.model_validate(c.user) if c.user else None
    return rows

@router.post("/posts/{post_id}/comments", response_model=schemas.CommunityComment)
def create_comment(
    post_id: int,
    body: schemas.CommunityCommentCreateRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    post = db.query(models.CommunityPost).filter(models.CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    text = _safe_text(body.body)
    if not text:
        raise HTTPException(status_code=400, detail="Comment is required")

    violation = _detect_violation(text)
    is_hidden = violation is not None
    comment = models.CommunityComment(
        post_id=post_id,
        user_id=user.id,
        body=text,
        is_hidden=is_hidden,
        status="pending_review" if violation else "approved",
        created_at=datetime.datetime.now(datetime.timezone.utc),
        updated_at=datetime.datetime.now(datetime.timezone.utc),
    )
    db.add(comment)
    post.comments_count = int(post.comments_count or 0) + (0 if is_hidden else 1)
    db.commit()
    db.refresh(comment)

    if violation:
        db.add(
            models.ModerationLog(
                entity_type="community_comment",
                entity_id=comment.id,
                user_id=user.id,
                reason=violation,
                action="flagged",
            )
        )
        db.commit()

    comment.user = schemas.UserPublic.model_validate(user)
    return comment

@router.put("/comments/{comment_id}", response_model=schemas.CommunityComment)
def update_comment(
    comment_id: int,
    body: schemas.CommunityCommentUpdateRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    comment = db.query(models.CommunityComment).filter(models.CommunityComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    role = _role_value(user)
    if role != "admin" and comment.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    text = _safe_text(body.body)
    if not text:
        raise HTTPException(status_code=400, detail="Comment is required")
    comment.body = text
    violation = _detect_violation(text)
    if violation:
        comment.is_hidden = True
        comment.status = "pending_review"
        db.add(
            models.ModerationLog(
                entity_type="community_comment",
                entity_id=comment.id,
                user_id=comment.user_id,
                reason=violation,
                action="flagged",
            )
        )
    comment.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    db.refresh(comment)
    comment.user = schemas.UserPublic.model_validate(db.query(models.User).filter(models.User.id == comment.user_id).first())
    return comment

@router.delete("/comments/{comment_id}")
def delete_comment(
    comment_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    comment = db.query(models.CommunityComment).filter(models.CommunityComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    role = _role_value(user)
    if role != "admin" and comment.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    post = db.query(models.CommunityPost).filter(models.CommunityPost.id == comment.post_id).first()
    if post and not comment.is_hidden:
        post.comments_count = max(0, int(post.comments_count or 0) - 1)
    db.delete(comment)
    db.commit()
    return {"message": "Comment deleted"}
