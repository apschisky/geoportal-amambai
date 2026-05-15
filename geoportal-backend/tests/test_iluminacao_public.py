from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def valid_payload() -> dict[str, object]:
    return {
        "localizacao_tipo": "poste_mapa",
        "poste_id": "POSTE-001",
        "coordenada": {
            "latitude": -23.105,
            "longitude": -55.225,
        },
        "tipo_problema": "lampada_apagada",
        "descricao": "Lampada apagada durante a noite.",
        "ponto_referencia": "Proximo a praca central.",
        "poste_proximo_informado": "Poste ao lado do cruzamento.",
        "nome_solicitante": "Solicitante de teste",
        "contato_solicitante": "contato de teste",
    }


def test_create_solicitacao_valid_payload_returns_simulated_protocol() -> None:
    response = client.post("/api/public/iluminacao/solicitacoes", json=valid_payload())

    assert response.status_code in (200, 201)
    assert response.json()["protocolo"] == "IP-2026-000001"
    assert response.json()["status"] == "aberta"


def test_create_solicitacao_rejects_poste_mapa_without_poste_id() -> None:
    payload = valid_payload()
    payload.pop("poste_id")

    response = client.post("/api/public/iluminacao/solicitacoes", json=payload)

    assert response.status_code == 422


def test_create_solicitacao_rejects_poste_mapa_with_blank_poste_id() -> None:
    payload = valid_payload()
    payload["poste_id"] = "   "

    response = client.post("/api/public/iluminacao/solicitacoes", json=payload)

    assert response.status_code == 422


def test_create_solicitacao_accepts_ponto_manual_with_observacoes() -> None:
    payload = valid_payload()
    payload["localizacao_tipo"] = "ponto_manual"
    payload.pop("poste_id")
    payload.pop("ponto_referencia")
    payload["observacoes_localizacao"] = "Pin marcado manualmente no local do poste."

    response = client.post("/api/public/iluminacao/solicitacoes", json=payload)

    assert response.status_code == 201
    assert response.json()["protocolo"] == "IP-2026-000001"


def test_create_solicitacao_accepts_ponto_manual_with_ponto_referencia() -> None:
    payload = valid_payload()
    payload["localizacao_tipo"] = "ponto_manual"
    payload.pop("poste_id")
    payload["ponto_referencia"] = "Em frente ao predio publico."

    response = client.post("/api/public/iluminacao/solicitacoes", json=payload)

    assert response.status_code == 201
    assert response.json()["status"] == "aberta"


def test_create_solicitacao_rejects_ponto_manual_without_location_notes() -> None:
    payload = valid_payload()
    payload["localizacao_tipo"] = "ponto_manual"
    payload.pop("poste_id")
    payload.pop("ponto_referencia")

    response = client.post("/api/public/iluminacao/solicitacoes", json=payload)

    assert response.status_code == 422


def test_create_solicitacao_rejects_invalid_localizacao_tipo() -> None:
    payload = valid_payload()
    payload["localizacao_tipo"] = "localizacao_invalida"

    response = client.post("/api/public/iluminacao/solicitacoes", json=payload)

    assert response.status_code == 422


def test_status_enum_is_exposed_in_openapi_schema() -> None:
    response = client.get("/openapi.json")

    assert response.status_code == 200
    status_schema = response.json()["components"]["schemas"][
        "StatusSolicitacaoIluminacao"
    ]
    assert "aberta" in status_schema["enum"]


def test_create_solicitacao_rejects_invalid_tipo_problema() -> None:
    payload = valid_payload()
    payload["tipo_problema"] = "tipo_invalido"

    response = client.post("/api/public/iluminacao/solicitacoes", json=payload)

    assert response.status_code == 422


def test_create_solicitacao_rejects_short_descricao() -> None:
    payload = valid_payload()
    payload["descricao"] = "abc"

    response = client.post("/api/public/iluminacao/solicitacoes", json=payload)

    assert response.status_code == 422


def test_create_solicitacao_rejects_invalid_latitude() -> None:
    payload = valid_payload()
    payload["coordenada"] = deepcopy(payload["coordenada"])
    payload["coordenada"]["latitude"] = -91

    response = client.post("/api/public/iluminacao/solicitacoes", json=payload)

    assert response.status_code == 422


def test_create_solicitacao_rejects_invalid_longitude() -> None:
    payload = valid_payload()
    payload["coordenada"] = deepcopy(payload["coordenada"])
    payload["coordenada"]["longitude"] = -181

    response = client.post("/api/public/iluminacao/solicitacoes", json=payload)

    assert response.status_code == 422


def test_create_solicitacao_rejects_extra_field() -> None:
    payload = valid_payload()
    payload["campo_extra"] = "nao permitido"

    response = client.post("/api/public/iluminacao/solicitacoes", json=payload)

    assert response.status_code == 422


def test_create_solicitacao_rejects_public_status_field() -> None:
    payload = valid_payload()
    payload["status"] = "resolvida"

    response = client.post("/api/public/iluminacao/solicitacoes", json=payload)

    assert response.status_code == 422


def test_create_solicitacao_accepts_omitted_optional_name_and_contact() -> None:
    payload = valid_payload()
    payload.pop("nome_solicitante")
    payload.pop("contato_solicitante")

    response = client.post("/api/public/iluminacao/solicitacoes", json=payload)

    assert response.status_code in (200, 201)
    assert response.json()["protocolo"] == "IP-2026-000001"


@pytest.mark.parametrize(
    ("field_name", "max_length"),
    [
        ("ponto_referencia", 300),
        ("observacoes_localizacao", 500),
        ("poste_proximo_informado", 120),
        ("nome_solicitante", 120),
        ("contato_solicitante", 120),
    ],
)
def test_create_solicitacao_rejects_too_long_optional_fields(
    field_name: str,
    max_length: int,
) -> None:
    payload = valid_payload()
    payload[field_name] = "x" * (max_length + 1)

    response = client.post("/api/public/iluminacao/solicitacoes", json=payload)

    assert response.status_code == 422
