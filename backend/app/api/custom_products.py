"""Product catalog API — built-in products + user-defined custom products."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import time

from app.database import get_db
from app.models import PoolConfig, UserProductCatalog
from app.services.products import CHEMICAL_PRODUCTS, PRODUCT_TYPE_LABELS

router = APIRouter(prefix="/api/products", tags=["products"])


# ── Schemas ────────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    name: str
    brand: Optional[str] = None
    product_type: str
    form: Optional[str] = None
    package_size: Optional[float] = None
    package_unit: Optional[str] = None
    notes: Optional[str] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    product_type: Optional[str] = None
    form: Optional[str] = None
    package_size: Optional[float] = None
    package_unit: Optional[str] = None
    notes: Optional[str] = None
    enabled: Optional[bool] = None


class BuiltinToggle(BaseModel):
    enabled: bool


# ── Helpers ────────────────────────────────────────────────────────────────

async def _get_pool_id(db: AsyncSession) -> int:
    result = await db.execute(select(PoolConfig).limit(1))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=500, detail="Pool config not found")
    return config.id


def _entry_to_dict(entry: UserProductCatalog) -> dict:
    return {
        "catalog_id": entry.id,
        "id": entry.product_id,
        "name": entry.name,
        "brand": entry.brand,
        "type": entry.product_type,
        "form": entry.form,
        "package_size": entry.package_size,
        "package_unit": entry.package_unit,
        "notes": entry.notes,
        "is_custom": entry.is_custom,
        "enabled": entry.enabled,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
    }


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("")
async def get_all_products(db: AsyncSession = Depends(get_db)):
    """Merged catalog: built-in products with enabled flags + custom products, grouped by type."""
    pool_id = await _get_pool_id(db)

    result = await db.execute(
        select(UserProductCatalog).where(UserProductCatalog.pool_config_id == pool_id)
    )
    overrides: dict[str, UserProductCatalog] = {
        e.product_id: e for e in result.scalars().all()
    }

    grouped: dict[str, list[dict]] = {}

    # Built-in products
    for product_id, product in CHEMICAL_PRODUCTS.items():
        ptype = product["type"]
        if ptype not in grouped:
            grouped[ptype] = []
        override = overrides.get(product_id)
        grouped[ptype].append({
            "catalog_id": override.id if override else None,
            "id": product_id,
            "name": product["name"],
            "brand": product["brand"],
            "type": ptype,
            "form": product.get("form"),
            "package_size": product.get("package_size"),
            "package_unit": product.get("package_unit"),
            "notes": product.get("notes"),
            "is_custom": False,
            "enabled": override.enabled if override else True,
        })

    # Custom products
    for entry in overrides.values():
        if not entry.is_custom:
            continue
        ptype = entry.product_type or "other"
        if ptype not in grouped:
            grouped[ptype] = []
        grouped[ptype].append(_entry_to_dict(entry))

    return grouped


@router.post("")
async def create_product(data: ProductCreate, db: AsyncSession = Depends(get_db)):
    """Create a custom product."""
    if not data.name or not data.name.strip():
        raise HTTPException(status_code=400, detail="Product name is required")
    if data.product_type not in PRODUCT_TYPE_LABELS and data.product_type != "other":
        raise HTTPException(status_code=400, detail=f"Invalid product type: {data.product_type}")

    pool_id = await _get_pool_id(db)
    product_id = f"custom_{int(time.time() * 1000)}"

    entry = UserProductCatalog(
        pool_config_id=pool_id,
        product_id=product_id,
        is_custom=True,
        enabled=True,
        name=data.name.strip(),
        brand=data.brand.strip() if data.brand else None,
        product_type=data.product_type,
        form=data.form,
        package_size=data.package_size,
        package_unit=data.package_unit,
        notes=data.notes.strip() if data.notes else None,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return _entry_to_dict(entry)


@router.put("/{catalog_id}")
async def update_product(catalog_id: int, data: ProductUpdate, db: AsyncSession = Depends(get_db)):
    """Update a custom product (by its catalog row ID)."""
    result = await db.execute(
        select(UserProductCatalog).where(UserProductCatalog.id == catalog_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Product not found")
    if not entry.is_custom:
        raise HTTPException(status_code=400, detail="Cannot edit built-in products; use the toggle endpoint")

    if data.name is not None:         entry.name = data.name.strip()
    if data.brand is not None:        entry.brand = data.brand.strip() or None
    if data.product_type is not None: entry.product_type = data.product_type
    if data.form is not None:         entry.form = data.form
    if data.package_size is not None: entry.package_size = data.package_size
    if data.package_unit is not None: entry.package_unit = data.package_unit
    if data.notes is not None:        entry.notes = data.notes.strip() or None
    if data.enabled is not None:      entry.enabled = data.enabled

    await db.commit()
    await db.refresh(entry)
    return _entry_to_dict(entry)


@router.delete("/{catalog_id}")
async def delete_product(catalog_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a custom product."""
    result = await db.execute(
        select(UserProductCatalog).where(UserProductCatalog.id == catalog_id)
    )
    entry = result.scalar_one_or_none()
    if not entry or not entry.is_custom:
        raise HTTPException(status_code=404, detail="Custom product not found")
    await db.delete(entry)
    await db.commit()
    return {"deleted": True, "catalog_id": catalog_id}


@router.patch("/builtin/{product_id}/enabled")
async def toggle_builtin(product_id: str, body: BuiltinToggle, db: AsyncSession = Depends(get_db)):
    """Enable or disable a built-in product for this pool."""
    if product_id not in CHEMICAL_PRODUCTS:
        raise HTTPException(status_code=404, detail="Built-in product not found")

    pool_id = await _get_pool_id(db)
    result = await db.execute(
        select(UserProductCatalog).where(
            UserProductCatalog.pool_config_id == pool_id,
            UserProductCatalog.product_id == product_id,
        )
    )
    entry = result.scalar_one_or_none()

    if not entry:
        entry = UserProductCatalog(
            pool_config_id=pool_id,
            product_id=product_id,
            is_custom=False,
            enabled=body.enabled,
        )
        db.add(entry)
    else:
        entry.enabled = body.enabled

    await db.commit()
    return {"product_id": product_id, "enabled": body.enabled}
