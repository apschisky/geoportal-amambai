"""Uso manual: validar repository de Iluminacao Publica em homologacao/local.

Execute somente em homologacao/local. Este script pode criar registro de teste.
Limpe o registro depois se necessario. Nunca use em producao sem revisao.
"""

from pathlib import Path
import sys


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from app.repositories.iluminacao_repository import create_solicitacao  # noqa: E402
from app.schemas.iluminacao import IluminacaoSolicitacaoCreate  # noqa: E402


def main() -> None:
    solicitacao = IluminacaoSolicitacaoCreate.model_validate(
        {
            "localizacao_tipo": "poste_mapa",
            "poste_id": "POSTE-TESTE-001",
            "coordenada": {
                "latitude": -23.100001,
                "longitude": -55.200001,
            },
            "tipo_problema": "lampada_apagada",
            "descricao": "Solicitacao de teste do repository em homologacao.",
            "nome_solicitante": "Solicitante Teste",
            "contato_solicitante": "00000000000",
        }
    )

    try:
        response = create_solicitacao(
            solicitacao=solicitacao,
            protocolo="IP-TESTE-REPO-000001",
        )
    except RuntimeError as exc:
        if str(exc) == "DATABASE_URL nao configurada.":
            print("DATABASE_URL nao configurada. Crie geoportal-backend/.env local.")
            return
        raise

    print(f"Protocolo retornado: {response.protocolo}")
    print(f"Status retornado: {response.status}")
    print("Teste manual do repository finalizado.")


if __name__ == "__main__":
    main()
