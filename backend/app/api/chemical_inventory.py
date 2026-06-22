"""Chemical inventory API — products the user has on hand."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import PoolConfig, ChemicalInventoryItem
from app.schemas.treatment_plan import InventoryItemCreate, InventoryResponse
from app.services.products import CHEMICAL_PRODUCTS, get_catalog_grouped

router = APIRouter(prefix="/api/chemical-inventory", tags=["chemical-inventory"])


async def _get_pool_config_id(db: AsyncSession) -> int:
    result = await db.execute(select(PoolConfig).limit(1))
    config = result.scalar_one_or_none()
    if not config:
        raise Exception("Pool config not found")
    return config.id


def _enrich_inventory_item(item: ChemicalInventoryItem) -> dict:
    product = CHEMICAL_PRODUCTS.get(item.product_id, {})
    return {
        "id": item.id,
        "pool_config_id": item.pool_config_id,
        "product_id": item.product_id,
        "quantity": item.quantity,
        "unit": item.unit,
        "updated_at": item.updated_at,
        "product_name": product.get("name"),
        "product_type": product.get("type"),
        "product_brand": product.get("brand"),
    }


@router.get("", response_model=list[InventoryResponse])
async def get_inventory(db: AsyncSession = Depends(get_db)):
    pool_id = await _get_pool_config_id(db)
    result = await db.execute(
        select(ChemicalInventoryItem).where(ChemicalInventoryItem.pool_config_id == pool_id)
    )
    items = result.scalars().all()
    return [_enrich_inventory_item(i) for i in items]


@router.put("", response_model=list[InventoryResponse])
async def save_inventory(items: list[InventoryItemCreate], db: AsyncSession = Depends(get_db)):
    pool_id = await _get_pool_config_id(db)

    # Delete all existing inventory for this pool and replace
    existing = await db.execute(
        select(ChemicalInventoryItem).where(ChemicalInventoryItem.pool_config_id == pool_id)
    )
    for item in existing.scalars().all():
        await db.delete(item)
    await db.flush()

    new_items = []
    for item_data in items:
        if item_data.product_id not in CHEMICAL_PRODUCTS:
            continue  # skip unknown products
        new_item = ChemicalInventoryItem(
            pool_config_id=pool_id,
            product_id=item_data.product_id,
            quantity=item_data.quantity,
            unit=item_data.unit,
        )
        db.add(new_item)
        new_items.append(new_item)

    await db.commit()
    for item in new_items:
        await db.refresh(item)

    return [_enrich_inventory_item(i) for i in new_items]


@router.get("/products")
async def get_chemical_products():
    """Return the full chemical product catalog grouped by type."""
    return get_catalog_grouped()
