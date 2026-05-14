from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    service: str


class VersionResponse(BaseModel):
    service: str
    version: str
    environment: str


class IluminacaoHealthResponse(BaseModel):
    status: str
    module: str
