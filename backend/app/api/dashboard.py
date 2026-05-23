"""Dashboard API endpoint."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.dashboard import build_dashboard

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard")
async def get_dashboard(db: AsyncSession = Depends(get_db)):
    return await build_dashboard(db)
