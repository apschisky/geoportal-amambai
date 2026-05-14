from fastapi import APIRouter

from app.api.routes import health, iluminacao_public


api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(iluminacao_public.router)
