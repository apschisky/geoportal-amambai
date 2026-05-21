from collections.abc import Generator
from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from app.api.routes import iluminacao_public
from app.core.rate_limit import reset_rate_limit_state
from app.main import app
from app.schemas.iluminacao import IluminacaoConsultaPublicResponse
from app.services import iluminacao_service
from app.services.exceptions import DatabaseUnavailableError, PublicConsultaNotFoundError
from app.services.exceptions import SolicitacaoDuplicadaAtivaError


client = TestClient(app)


@pytest.fixture(autouse=True)
def force_simulated_mode(
    monkeypatch: pytest.MonkeyPatch,
) -> Generator[None, None, None]:
    def fail_if_database_protocol_is_requested(*args: object, **kwargs: object) -> None:
        raise AssertionError("database protocol should not be used in public tests")

    reset_rate_limit_state()
    monkeypatch.setattr(iluminacao_service.settings, "persist_solicitacoes", False)
    monkeypatch.setattr(iluminacao_public.settings, "rate_limit_enabled", False)
    monkeypatch.setattr(
        iluminacao_service,
        "generate_protocol_from_database",
        fail_if_database_protocol_is_requested,
    )
    yield
    reset_rate_limit_state()


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


def test_create_solicitacao_returns_safe_503_when_database_is_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_with_safe_error(*args: object, **kwargs: object) -> None:
        raise DatabaseUnavailableError(
            "Servico temporariamente indisponivel. Tente novamente mais tarde."
        )

    monkeypatch.setattr(
        iluminacao_public,
        "create_solicitacao_simulada",
        fail_with_safe_error,
    )

    response = client.post("/api/public/iluminacao/solicitacoes", json=valid_payload())

    assert response.status_code == 503
    assert response.json() == {
        "detail": "Servico temporariamente indisponivel. Tente novamente mais tarde."
    }
    body = response.text
    assert "traceback" not in body.lower()
    assert "DATABASE_URL" not in body
    assert "host" not in body.lower()
    assert "senha" not in body.lower()
    assert "SELECT" not in body


def test_create_solicitacao_returns_409_for_active_duplicate_poste(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_with_duplicate(*args: object, **kwargs: object) -> None:
        raise SolicitacaoDuplicadaAtivaError(
            "Já existe uma solicitação aberta para este poste. "
            "A equipe responsável já foi notificada."
        )

    monkeypatch.setattr(
        iluminacao_public,
        "create_solicitacao_simulada",
        fail_with_duplicate,
    )

    response = client.post("/api/public/iluminacao/solicitacoes", json=valid_payload())

    assert response.status_code == 409
    assert response.json() == {
        "detail": (
            "Já existe uma solicitação aberta para este poste. "
            "A equipe responsável já foi notificada."
        )
    }
    body = response.text
    assert "IP-2026" not in body
    assert "nome" not in body.lower()
    assert "contato" not in body.lower()
    assert "descricao" not in body.lower()


def test_create_solicitacao_returns_429_when_rate_limit_is_exceeded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = {"service": 0}

    def fake_create_solicitacao(*args: object, **kwargs: object) -> object:
        calls["service"] += 1
        return iluminacao_service.create_solicitacao_simulada(*args, **kwargs)

    monkeypatch.setattr(iluminacao_public.settings, "rate_limit_enabled", True)
    monkeypatch.setattr(iluminacao_public.settings, "rate_limit_max_requests", 1)
    monkeypatch.setattr(iluminacao_public.settings, "rate_limit_window_seconds", 600)
    monkeypatch.setattr(
        iluminacao_public,
        "create_solicitacao_simulada",
        fake_create_solicitacao,
    )

    first_response = client.post(
        "/api/public/iluminacao/solicitacoes",
        json=valid_payload(),
    )
    second_response = client.post(
        "/api/public/iluminacao/solicitacoes",
        json=valid_payload(),
    )

    assert first_response.status_code == 201
    assert second_response.status_code == 429
    assert second_response.json() == {
        "detail": "Muitas solicitacoes em pouco tempo. Tente novamente mais tarde."
    }
    assert calls["service"] == 1


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


def test_create_solicitacao_rejects_missing_nome_solicitante() -> None:
    payload = valid_payload()
    payload.pop("nome_solicitante")

    response = client.post("/api/public/iluminacao/solicitacoes", json=payload)

    assert response.status_code == 422


def test_create_solicitacao_rejects_missing_contato_solicitante() -> None:
    payload = valid_payload()
    payload.pop("contato_solicitante")

    response = client.post("/api/public/iluminacao/solicitacoes", json=payload)

    assert response.status_code == 422


def test_create_solicitacao_rejects_blank_nome_solicitante() -> None:
    payload = valid_payload()
    payload["nome_solicitante"] = "   "

    response = client.post("/api/public/iluminacao/solicitacoes", json=payload)

    assert response.status_code == 422


def test_create_solicitacao_rejects_blank_contato_solicitante() -> None:
    payload = valid_payload()
    payload["contato_solicitante"] = "   "

    response = client.post("/api/public/iluminacao/solicitacoes", json=payload)

    assert response.status_code == 422


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
def test_create_solicitacao_rejects_too_long_text_fields(
    field_name: str,
    max_length: int,
) -> None:
    payload = valid_payload()
    payload[field_name] = "x" * (max_length + 1)

    response = client.post("/api/public/iluminacao/solicitacoes", json=payload)

    assert response.status_code == 422


def valid_consulta_payload() -> dict[str, str]:
    return {
        "protocolo": " ip-2026-000017 ",
        "contato_confirmacao": "9999",
    }


def public_consulta_response() -> IluminacaoConsultaPublicResponse:
    return IluminacaoConsultaPublicResponse.model_validate(
        {
            "protocolo": "IP-2026-000017",
            "status": "aberta",
            "status_publico": "Aberta",
            "data_abertura": "2026-05-20",
            "ultima_atualizacao": "2026-05-20",
            "mensagem": "Sua solicitacao foi registrada e esta aguardando analise.",
        }
    )


def test_consulta_publica_valid_request_returns_filtered_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: dict[str, object] = {}

    def fake_consultar(consulta: object) -> IluminacaoConsultaPublicResponse:
        calls["protocolo"] = getattr(consulta, "protocolo")
        calls["contato_confirmacao"] = getattr(consulta, "contato_confirmacao")
        return public_consulta_response()

    monkeypatch.setattr(
        iluminacao_public,
        "consultar_solicitacao_publica",
        fake_consultar,
    )

    response = client.post(
        "/api/public/iluminacao/consulta",
        json=valid_consulta_payload(),
    )

    assert response.status_code == 200
    body = response.json()
    assert calls == {
        "protocolo": "IP-2026-000017",
        "contato_confirmacao": "9999",
    }
    assert body == {
        "protocolo": "IP-2026-000017",
        "status": "aberta",
        "status_publico": "Aberta",
        "data_abertura": "2026-05-20",
        "ultima_atualizacao": "2026-05-20",
        "mensagem": "Sua solicitacao foi registrada e esta aguardando analise.",
    }
    forbidden_fields = {
        "id",
        "nome_solicitante",
        "contato_solicitante",
        "descricao",
        "ponto_referencia",
        "observacoes",
        "geom",
        "latitude",
        "longitude",
        "origem",
        "prioridade",
        "duplicidade_suspeita",
    }
    assert forbidden_fields.isdisjoint(body)


@pytest.mark.parametrize(
    "error",
    [
        PublicConsultaNotFoundError(
            "Solicitacao nao encontrada ou dados de confirmacao invalidos."
        ),
        PublicConsultaNotFoundError(
            "Solicitacao nao encontrada ou dados de confirmacao invalidos."
        ),
    ],
)
def test_consulta_publica_returns_same_404_for_not_found_or_wrong_confirmation(
    monkeypatch: pytest.MonkeyPatch,
    error: PublicConsultaNotFoundError,
) -> None:
    def fail_consulta(*args: object, **kwargs: object) -> None:
        raise error

    monkeypatch.setattr(
        iluminacao_public,
        "consultar_solicitacao_publica",
        fail_consulta,
    )

    response = client.post(
        "/api/public/iluminacao/consulta",
        json=valid_consulta_payload(),
    )

    assert response.status_code == 404
    assert response.json() == {
        "detail": "Solicitacao nao encontrada ou dados de confirmacao invalidos."
    }


@pytest.mark.parametrize(
    "payload",
    [
        {"protocolo": "2026-000017", "contato_confirmacao": "9999"},
        {"protocolo": "IP-2026-000017", "contato_confirmacao": "999"},
        {"protocolo": "IP-2026-000017", "contato_confirmacao": "abcd"},
        {
            "protocolo": "IP-2026-000017",
            "contato_confirmacao": "9999",
            "campo_extra": "nao permitido",
        },
    ],
)
def test_consulta_publica_rejects_invalid_payload(
    payload: dict[str, str],
) -> None:
    response = client.post("/api/public/iluminacao/consulta", json=payload)

    assert response.status_code == 422


def test_consulta_publica_returns_429_when_rate_limit_is_exceeded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = {"service": 0}

    def fake_consultar(*args: object, **kwargs: object) -> IluminacaoConsultaPublicResponse:
        calls["service"] += 1
        return public_consulta_response()

    monkeypatch.setattr(iluminacao_public.settings, "rate_limit_enabled", True)
    monkeypatch.setattr(iluminacao_public.settings, "rate_limit_max_requests", 1)
    monkeypatch.setattr(iluminacao_public.settings, "rate_limit_window_seconds", 600)
    monkeypatch.setattr(
        iluminacao_public,
        "consultar_solicitacao_publica",
        fake_consultar,
    )

    first_response = client.post(
        "/api/public/iluminacao/consulta",
        json=valid_consulta_payload(),
    )
    second_response = client.post(
        "/api/public/iluminacao/consulta",
        json=valid_consulta_payload(),
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 429
    assert second_response.json() == {
        "detail": "Muitas solicitacoes em pouco tempo. Tente novamente mais tarde."
    }
    assert calls["service"] == 1


def test_consulta_publica_returns_safe_503_when_database_is_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_with_safe_error(*args: object, **kwargs: object) -> None:
        raise DatabaseUnavailableError(
            "Servico temporariamente indisponivel. Tente novamente mais tarde."
        )

    monkeypatch.setattr(
        iluminacao_public,
        "consultar_solicitacao_publica",
        fail_with_safe_error,
    )

    response = client.post(
        "/api/public/iluminacao/consulta",
        json=valid_consulta_payload(),
    )

    assert response.status_code == 503
    assert response.json() == {
        "detail": "Servico temporariamente indisponivel. Tente novamente mais tarde."
    }
    body = response.text
    assert "traceback" not in body.lower()
    assert "DATABASE_URL" not in body
    assert "host" not in body.lower()
    assert "senha" not in body.lower()
    assert "SELECT" not in body
