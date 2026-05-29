from fastapi import FastAPI
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import internal_admin_users
from app.api.routes import internal_auth_login
from app.api.routes import internal_auth_me
from app.api.routes import internal_auth_permission_smoke
from app.api.routes import internal_auth_smoke
from app.api.router import api_router
from app.core.config import settings
from app.core.internal_routes_config import are_internal_routes_enabled_from_env
from app.dependencies.auth_dependencies import INTERNAL_MUTATING_REQUEST_HEADER_NAME


allowed_origins = [
    origin.strip()
    for origin in settings.allowed_origins.split(",")
    if origin.strip()
]


app = FastAPI(
    title="Geoportal Amambai API",
    version="0.1.0",
)


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(
    _request: object,
    exc: RequestValidationError,
) -> JSONResponse:
    safe_detail = []
    for error in exc.errors():
        safe_error = {
            key: error[key]
            for key in ("type", "loc", "msg", "ctx")
            if key in error
        }
        safe_detail.append(safe_error)

    return JSONResponse(
        status_code=422,
        content={"detail": jsonable_encoder(safe_detail)},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        INTERNAL_MUTATING_REQUEST_HEADER_NAME,
    ],
)

app.include_router(api_router)

if are_internal_routes_enabled_from_env():
    app.include_router(internal_admin_users.router)
    app.include_router(internal_auth_login.router)
    app.include_router(internal_auth_me.router)
    app.include_router(internal_auth_permission_smoke.router)
    app.include_router(internal_auth_smoke.router)
