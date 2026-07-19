"""Pool care guide API — chemical cheat-sheet entries and how-to articles."""

import re
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models import GuideChemical, GuideArticle

router = APIRouter(prefix="/api/guide", tags=["guide"])


# ── Schemas ────────────────────────────────────────────────────────────────

class ChemicalCreate(BaseModel):
    product_name: str
    chemical_name: str
    common_name: Optional[str] = None
    purpose: Optional[str] = None
    buy_cheaper: Optional[str] = None
    warnings: Optional[str] = None
    active_ingredient: Optional[str] = None
    sort_order: Optional[int] = None


class ChemicalUpdate(BaseModel):
    product_name: Optional[str] = None
    chemical_name: Optional[str] = None
    common_name: Optional[str] = None
    purpose: Optional[str] = None
    buy_cheaper: Optional[str] = None
    warnings: Optional[str] = None
    active_ingredient: Optional[str] = None
    sort_order: Optional[int] = None


class ArticleCreate(BaseModel):
    title: str
    summary: Optional[str] = None
    content_md: str


class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    content_md: Optional[str] = None


# ── Helpers ────────────────────────────────────────────────────────────────

def _make_slug(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:80]
    return slug or f"entry-{int(time.time() * 1000)}"


async def _unique_slug(db: AsyncSession, model, text: str) -> str:
    slug = _make_slug(text)
    result = await db.execute(select(model).where(model.slug == slug))
    if result.scalar_one_or_none():
        slug = f"{slug}-{int(time.time() * 1000)}"
    return slug


def _chemical_to_dict(c: GuideChemical) -> dict:
    return {
        "id": c.id,
        "slug": c.slug,
        "product_name": c.product_name,
        "chemical_name": c.chemical_name,
        "common_name": c.common_name,
        "purpose": c.purpose,
        "buy_cheaper": c.buy_cheaper,
        "warnings": c.warnings,
        "active_ingredient": c.active_ingredient,
        "sort_order": c.sort_order,
        "is_builtin": c.is_builtin,
    }


def _article_to_dict(a: GuideArticle, include_content: bool = True) -> dict:
    data = {
        "id": a.id,
        "slug": a.slug,
        "title": a.title,
        "summary": a.summary,
        "is_builtin": a.is_builtin,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }
    if include_content:
        data["content_md"] = a.content_md
    return data


# ── Chemical endpoints ─────────────────────────────────────────────────────

@router.get("/chemicals")
async def list_chemicals(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(GuideChemical).order_by(GuideChemical.sort_order, GuideChemical.id)
    )
    return [_chemical_to_dict(c) for c in result.scalars().all()]


@router.post("/chemicals")
async def create_chemical(data: ChemicalCreate, db: AsyncSession = Depends(get_db)):
    if not data.product_name.strip() or not data.chemical_name.strip():
        raise HTTPException(status_code=400, detail="Product name and chemical name are required")

    if data.sort_order is None:
        result = await db.execute(select(GuideChemical.sort_order).order_by(GuideChemical.sort_order.desc()).limit(1))
        max_order = result.scalar_one_or_none()
        data.sort_order = (max_order or 0) + 1

    entry = GuideChemical(
        slug=await _unique_slug(db, GuideChemical, data.product_name),
        product_name=data.product_name.strip(),
        chemical_name=data.chemical_name.strip(),
        common_name=data.common_name.strip() if data.common_name else None,
        purpose=data.purpose.strip() if data.purpose else None,
        buy_cheaper=data.buy_cheaper.strip() if data.buy_cheaper else None,
        warnings=data.warnings.strip() if data.warnings else None,
        active_ingredient=data.active_ingredient,
        sort_order=data.sort_order,
        is_builtin=False,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return _chemical_to_dict(entry)


@router.put("/chemicals/{chemical_id}")
async def update_chemical(chemical_id: int, data: ChemicalUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(GuideChemical).where(GuideChemical.id == chemical_id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Chemical entry not found")

    if data.product_name is not None:      entry.product_name = data.product_name.strip()
    if data.chemical_name is not None:     entry.chemical_name = data.chemical_name.strip()
    if data.common_name is not None:       entry.common_name = data.common_name.strip() or None
    if data.purpose is not None:           entry.purpose = data.purpose.strip() or None
    if data.buy_cheaper is not None:       entry.buy_cheaper = data.buy_cheaper.strip() or None
    if data.warnings is not None:          entry.warnings = data.warnings.strip() or None
    if data.active_ingredient is not None: entry.active_ingredient = data.active_ingredient or None
    if data.sort_order is not None:        entry.sort_order = data.sort_order
    entry.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(entry)
    return _chemical_to_dict(entry)


@router.delete("/chemicals/{chemical_id}")
async def delete_chemical(chemical_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(GuideChemical).where(GuideChemical.id == chemical_id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Chemical entry not found")
    await db.delete(entry)
    await db.commit()
    return {"deleted": True, "id": chemical_id}


# ── Article endpoints ──────────────────────────────────────────────────────

@router.get("/articles")
async def list_articles(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(GuideArticle).order_by(GuideArticle.title))
    return [_article_to_dict(a, include_content=False) for a in result.scalars().all()]


@router.get("/articles/{article_id}")
async def get_article(article_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(GuideArticle).where(GuideArticle.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return _article_to_dict(article)


@router.post("/articles")
async def create_article(data: ArticleCreate, db: AsyncSession = Depends(get_db)):
    if not data.title.strip():
        raise HTTPException(status_code=400, detail="Title is required")
    if not data.content_md.strip():
        raise HTTPException(status_code=400, detail="Content is required")

    article = GuideArticle(
        slug=await _unique_slug(db, GuideArticle, data.title),
        title=data.title.strip(),
        summary=data.summary.strip() if data.summary else None,
        content_md=data.content_md,
        is_builtin=False,
    )
    db.add(article)
    await db.commit()
    await db.refresh(article)
    return _article_to_dict(article)


@router.put("/articles/{article_id}")
async def update_article(article_id: int, data: ArticleUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(GuideArticle).where(GuideArticle.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    if data.title is not None:      article.title = data.title.strip()
    if data.summary is not None:    article.summary = data.summary.strip() or None
    if data.content_md is not None: article.content_md = data.content_md
    article.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(article)
    return _article_to_dict(article)


@router.delete("/articles/{article_id}")
async def delete_article(article_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(GuideArticle).where(GuideArticle.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    await db.delete(article)
    await db.commit()
    return {"deleted": True, "id": article_id}
