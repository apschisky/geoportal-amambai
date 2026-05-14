from fastapi import APIRouter

from app.core.config import settings


router = APIRouter(tags=["version"])


@router.get("/version")
def version() -> dict[str, str]:
    return {
        "service": "geoportal-api",
        "version": "0.1.0",
        "environment": settings.app_env,
    }
