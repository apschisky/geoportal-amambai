from fastapi import APIRouter


router = APIRouter(prefix="/public/iluminacao", tags=["iluminacao-publica"])


@router.get("/health")
def iluminacao_public_health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "module": "iluminacao-publica",
    }
