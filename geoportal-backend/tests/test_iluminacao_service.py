from app.schemas.iluminacao import IluminacaoSolicitacaoCreate
from app.services.iluminacao_service import create_solicitacao_simulada


def test_create_solicitacao_simulada_returns_protocol_and_initial_status() -> None:
    solicitacao = IluminacaoSolicitacaoCreate.model_validate(
        {
            "localizacao_tipo": "poste_mapa",
            "poste_id": "POSTE-001",
            "coordenada": {
                "latitude": -23.105,
                "longitude": -55.225,
            },
            "tipo_problema": "lampada_apagada",
            "descricao": "Lampada apagada durante a noite.",
        }
    )

    response = create_solicitacao_simulada(solicitacao)

    assert response.protocolo == "IP-2026-000001"
    assert response.status == "aberta"
