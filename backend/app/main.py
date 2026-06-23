"""FastAPI application entry point."""

import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager

from app.database import async_session
from app.services.reminders import ensure_default_schedules
from app.models import PoolConfig
from sqlalchemy import select

STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup tasks: ensure default data exists."""
    async with async_session() as db:
        await ensure_default_schedules(db)
        # Ensure default pool config
        result = await db.execute(select(PoolConfig).limit(1))
        if not result.scalar_one_or_none():
            db.add(PoolConfig(
                name="My Pool", shape="round", length_ft=27,
                depth_ft=4, volume_gallons=17000,
                pool_type="above_ground", sanitizer_type="chlorine",
                filter_type="cartridge",
            ))
            await db.commit()
    yield


app = FastAPI(title="Pooly", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
from app.api.dashboard import router as dashboard_router
from app.api.journal import router as journal_router
from app.api.measurements import router as measurements_router
from app.api.chemicals import router as chemicals_router
from app.api.maintenance import router as maintenance_router
from app.api.sensors import router as sensors_router
from app.api.settings import router as settings_router
from app.api.home_assistant import router as ha_router
from app.api.treatment_plans import router as treatment_plans_router
from app.api.chemical_inventory import router as chemical_inventory_router
from app.api.custom_products import router as custom_products_router
from app.api.ai import router as ai_router

app.include_router(dashboard_router)
app.include_router(journal_router)
app.include_router(measurements_router)
app.include_router(chemicals_router)
app.include_router(maintenance_router)
app.include_router(sensors_router)
app.include_router(settings_router)
app.include_router(ha_router)
app.include_router(treatment_plans_router)
app.include_router(chemical_inventory_router)
app.include_router(custom_products_router)
app.include_router(ai_router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "pooly"}


# Serve frontend static files (CSS, JS, images, manifest)
if os.path.isdir(os.path.join(STATIC_DIR, "css")):
    app.mount("/css", StaticFiles(directory=os.path.join(STATIC_DIR, "css")), name="css")
if os.path.isdir(os.path.join(STATIC_DIR, "js")):
    app.mount("/js", StaticFiles(directory=os.path.join(STATIC_DIR, "js")), name="js")

# Serve manifest.json and other root-level static files
if os.path.isfile(os.path.join(STATIC_DIR, "manifest.json")):
    @app.get("/manifest.json")
    async def manifest():
        return FileResponse(os.path.join(STATIC_DIR, "manifest.json"))

# SPA catch-all: serve index.html for any non-API, non-static route
@app.get("/{path:path}")
async def spa_catchall(path: str):
    # If the path looks like a file with an extension, try to serve it
    file_path = os.path.join(STATIC_DIR, path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    # Otherwise serve the SPA shell
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)
    return {"detail": "Not found"}
