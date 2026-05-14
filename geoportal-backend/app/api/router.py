from fastapi import APIRouter

from app.api.routes import health, iluminacao_public, version


api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(iluminacao_public.router)
api_router.include_router(version.router)
