from app.schemas.iluminacao import (
    IluminacaoSolicitacaoCreate,
    IluminacaoSolicitacaoResponse,
    StatusSolicitacaoIluminacao,
)
from app.services import iluminacao_service


def valid_solicitacao() -> IluminacaoSolicitacaoCreate:
    return IluminacaoSolicitacaoCreate.model_validate(
        {
            "localizacao_tipo": "poste_mapa",
            "poste_id": "POSTE-001",
            "coordenada": {
                "latitude": -23.105,
                "longitude": -55.225,
            },
            "tipo_problema": "lampada_apagada",
            "descricao": "Lampada apagada durante a noite.",
            "nome_solicitante": "Solicitante de teste",
            "contato_solicitante": "contato de teste",
        }
    )


def test_create_solicitacao_simulada_returns_protocol_without_repository(
    monkeypatch,
) -> None:
    def fail_if_called(*args: object, **kwargs: object) -> None:
        raise AssertionError("repository should not be called")

    monkeypatch.setattr(
        iluminacao_service.settings,
        "persist_solicitacoes",
        False,
    )
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "create_solicitacao",
        fail_if_called,
    )

    response = iluminacao_service.create_solicitacao_simulada(valid_solicitacao())

    assert response.protocolo == "IP-2026-000001"
    assert response.status == "aberta"


def test_create_solicitacao_simulada_calls_repository_when_enabled(
    monkeypatch,
) -> None:
    calls: dict[str, object] = {}

    def fake_create_solicitacao(
        solicitacao: IluminacaoSolicitacaoCreate,
        protocolo: str,
    ) -> IluminacaoSolicitacaoResponse:
        calls["solicitacao"] = solicitacao
        calls["protocolo"] = protocolo
        return IluminacaoSolicitacaoResponse(
            protocolo=protocolo,
            status=StatusSolicitacaoIluminacao.aberta,
            message="Solicitação registrada em ambiente de teste.",
        )

    monkeypatch.setattr(
        iluminacao_service.settings,
        "persist_solicitacoes",
        True,
    )
    monkeypatch.setattr(
        iluminacao_service.iluminacao_repository,
        "create_solicitacao",
        fake_create_solicitacao,
    )

    solicitacao = valid_solicitacao()
    response = iluminacao_service.create_solicitacao_simulada(solicitacao)

    assert calls["solicitacao"] is solicitacao
    assert calls["protocolo"] == "IP-2026-000001"
    assert response.protocolo == "IP-2026-000001"
    assert response.status == "aberta"
