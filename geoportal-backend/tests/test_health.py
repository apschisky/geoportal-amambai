from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_check_returns_ok() -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "geoportal-api",
    }


def test_iluminacao_public_health_check_returns_ok() -> None:
    response = client.get("/api/public/iluminacao/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "module": "iluminacao-publica",
    }


def test_version_returns_api_metadata() -> None:
    response = client.get("/api/version")

    assert response.status_code == 200
    assert response.json() == {
        "service": "geoportal-api",
        "version": "0.1.0",
        "environment": "development",
    }


def test_cors_allows_configured_origin() -> None:
    response = client.options(
        "/api/version",
        headers={
            "Origin": "http://localhost:5195",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5195"
