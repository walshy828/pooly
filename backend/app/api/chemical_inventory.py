"""Chemical inventory API — products the user has on hand."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import PoolConfig, ChemicalInventoryItem, UserProductCatalog
from app.schemas.treatment_plan import InventoryItemCreate, InventoryResponse
from app.services.products import CHEMICAL_PRODUCTS, get_catalog_grouped

router = APIRouter(prefix="/api/chemical-inventory", tags=["chemical-inventory"])


async def _get_pool_config_id(db: AsyncSession) -> int:
    result = await db.execute(select(PoolConfig).limit(1))
    config = result.scalar_one_or_none()
    if not config:
        raise Exception("Pool config not found")
    return config.id


def _enrich_inventory_item(item: ChemicalInventoryItem, custom_catalog: dict | None = None) -> dict:
    product = CHEMICAL_PRODUCTS.get(item.product_id, {})
    if not product and custom_catalog:
        custom = custom_catalog.get(item.product_id, {})
        product = {
            "name": custom.get("name"),
            "type": custom.get("product_type"),
            "brand": custom.get("brand"),
        }
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


async def _get_custom_product_ids(db: AsyncSession, pool_id: int) -> dict[str, dict]:
    """Return dict of {product_id: entry} for all custom products belonging to this pool."""
    result = await db.execute(
        select(UserProductCatalog).where(
            UserProductCatalog.pool_config_id == pool_id,
            UserProductCatalog.is_custom == True,  # noqa: E712
        )
    )
    return {e.product_id: {"name": e.name, "product_type": e.product_type, "brand": e.brand}
            for e in result.scalars().all()}


@router.get("", response_model=list[InventoryResponse])
async def get_inventory(db: AsyncSession = Depends(get_db)):
    pool_id = await _get_pool_config_id(db)
    result = await db.execute(
        select(ChemicalInventoryItem).where(ChemicalInventoryItem.pool_config_id == pool_id)
    )
    items = result.scalars().all()
    custom_catalog = await _get_custom_product_ids(db, pool_id)
    return [_enrich_inventory_item(i, custom_catalog) for i in items]


@router.put("", response_model=list[InventoryResponse])
async def save_inventory(items: list[InventoryItemCreate], db: AsyncSession = Depends(get_db)):
    pool_id = await _get_pool_config_id(db)
    custom_catalog = await _get_custom_product_ids(db, pool_id)

    # Delete all existing inventory for this pool and replace
    existing = await db.execute(
        select(ChemicalInventoryItem).where(ChemicalInventoryItem.pool_config_id == pool_id)
    )
    for item in existing.scalars().all():
        await db.delete(item)
    await db.flush()

    new_items = []
    for item_data in items:
        # Accept both built-in and custom product IDs
        if item_data.product_id not in CHEMICAL_PRODUCTS and item_data.product_id not in custom_catalog:
            continue
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

    return [_enrich_inventory_item(i, custom_catalog) for i in new_items]


@router.get("/products")
async def get_chemical_products():
    """Return the full chemical product catalog grouped by type."""
    return get_catalog_grouped()
