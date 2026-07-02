from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
import json

from .. import models, schemas, database

router = APIRouter()

SUPPORTED_LANGS = {"en", "ru", "az", "tr"}

def _resolve_i18n(value: str | None, lang: str, fallback: str) -> str:
    if not value:
        return fallback
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, dict):
                v = parsed.get(lang)
                if isinstance(v, str) and v.strip():
                    return v
        except Exception:
            return fallback
    return fallback

def _normalize_lang(lang: str | None) -> str:
    if not lang:
        return "en"
    v = str(lang).lower().strip()
    return v if v in SUPPORTED_LANGS else "en"

def _project_article(a: models.BlogArticle, lang: str) -> models.BlogArticle:
    a.title = _resolve_i18n(getattr(a, "title_i18n", None), lang, a.title)
    a.excerpt = _resolve_i18n(getattr(a, "excerpt_i18n", None), lang, a.excerpt)
    a.content = _resolve_i18n(getattr(a, "content_i18n", None), lang, a.content)
    return a

@router.get("/articles", response_model=List[schemas.BlogArticleSummary])
def list_articles(
    skip: int = 0,
    limit: int = 20,
    q: Optional[str] = None,
    category: Optional[str] = None,
    lang: Optional[str] = None,
    db: Session = Depends(database.get_db),
):
    resolved_lang = _normalize_lang(lang)
    query = db.query(models.BlogArticle).filter(models.BlogArticle.is_published == True)  # noqa: E712
    if category and category != "all":
        query = query.filter(models.BlogArticle.category == category)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter((models.BlogArticle.title.ilike(like)) | (models.BlogArticle.excerpt.ilike(like)))
    rows = query.order_by(desc(models.BlogArticle.published_at)).offset(skip).limit(limit).all()
    return [_project_article(a, resolved_lang) for a in rows]

@router.get("/articles/{slug}", response_model=schemas.BlogArticle)
def get_article(
    slug: str,
    lang: Optional[str] = None,
    db: Session = Depends(database.get_db),
):
    resolved_lang = _normalize_lang(lang)
    a = (
        db.query(models.BlogArticle)
        .filter(models.BlogArticle.slug == slug)
        .filter(models.BlogArticle.is_published == True)  # noqa: E712
        .first()
    )
    if not a:
        raise HTTPException(status_code=404, detail="Article not found")
    return _project_article(a, resolved_lang)

@router.post("/newsletter/subscribe", response_model=schemas.NewsletterSubscriber)
def subscribe_newsletter(
    payload: schemas.NewsletterSubscribeRequest,
    db: Session = Depends(database.get_db),
):
    email = str(payload.email).strip().lower()
    lang = _normalize_lang(payload.language)
    existing = db.query(models.NewsletterSubscriber).filter(models.NewsletterSubscriber.email == email).first()
    if existing:
        existing.language = lang
        db.commit()
        db.refresh(existing)
        return existing
    row = models.NewsletterSubscriber(email=email, language=lang)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
