from fastapi import APIRouter

from app.core.config import settings
from app.schemas.common import VersionResponse


router = APIRouter(tags=["version"])


@router.get("/version", response_model=VersionResponse)
def version() -> VersionResponse:
    return VersionResponse(
        service="geoportal-api",
        version="0.1.0",
        environment=settings.app_env,
    )
