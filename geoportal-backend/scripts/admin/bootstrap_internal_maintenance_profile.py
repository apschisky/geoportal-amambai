import argparse
import sys
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import TextIO


BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.repositories.auth_admin_profile_repository import (
    AdminPermissionSeed,
    BootstrapAdminProfileResult,
    bootstrap_internal_admin_profile,
)


PROFILE_KEY = "manutencao-iluminacao"
PROFILE_NAME = "Manutencao - Iluminacao Publica"
PROFILE_DESCRIPTION = (
    "Perfil operacional minimo para equipe de manutencao de Iluminacao Publica"
)

MAINTENANCE_PERMISSIONS: tuple[AdminPermissionSeed, ...] = (
    AdminPermissionSeed(
        "internal",
        "auth.me",
        "Consultar endpoint tecnico de autenticacao/autorizacao atual.",
    ),
    AdminPermissionSeed(
        "iluminacao",
        "solicitacoes.ler",
        "Ler solicitacoes internas de Iluminacao Publica.",
    ),
    AdminPermissionSeed(
        "iluminacao",
        "solicitacoes.ver_observacoes",
        "Consultar observacoes internas de solicitacoes de Iluminacao Publica.",
    ),
    AdminPermissionSeed(
        "iluminacao",
        "solicitacoes.comentar",
        "Registrar observacao interna em solicitacoes de Iluminacao Publica.",
    ),
    AdminPermissionSeed(
        "iluminacao",
        "solicitacoes.atualizar_status",
        "Atualizar status operacional de solicitacoes de Iluminacao Publica.",
    ),
)


@dataclass(frozen=True)
class BootstrapMaintenanceProfileInput:
    login: str


class BootstrapMaintenanceProfileError(Exception):
    pass


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Garante o perfil operacional de manutencao do modulo interno de "
            "Iluminacao Publica."
        )
    )
    parser.add_argument(
        "--login",
        required=True,
        help="Login interno do usuario existente que recebera o perfil.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Valida entradas e plano sem conectar ao banco ou persistir alteracao.",
    )
    return parser


def normalize_bootstrap_input(login: str) -> BootstrapMaintenanceProfileInput:
    normalized_login = login.strip().lower()
    if not normalized_login:
        raise BootstrapMaintenanceProfileError("login nao pode ser vazio.")
    return BootstrapMaintenanceProfileInput(login=normalized_login)


def run(
    argv: Sequence[str] | None = None,
    *,
    bootstrap_func: Callable[..., BootstrapAdminProfileResult] = bootstrap_internal_admin_profile,
    stdout: TextIO = sys.stdout,
) -> int:
    parser = build_parser()
    args, unknown_args = parser.parse_known_args(argv)
    if unknown_args:
        print(
            "Erro: argumento nao reconhecido. Senha, token ou segredo nunca devem ser passados por linha de comando.",
            file=stdout,
        )
        return 2

    try:
        bootstrap_input = normalize_bootstrap_input(args.login)

        if args.dry_run:
            print(
                "Dry-run validado. Nenhum perfil, permissao ou vinculo foi alterado.",
                file=stdout,
            )
            print(
                f"Plano: garantir perfil {PROFILE_KEY} para usuario existente {bootstrap_input.login}.",
                file=stdout,
            )
            return 0

        bootstrap_func(
            login=bootstrap_input.login,
            perfil_chave=PROFILE_KEY,
            perfil_nome=PROFILE_NAME,
            perfil_descricao=PROFILE_DESCRIPTION,
            permissoes=MAINTENANCE_PERMISSIONS,
        )
    except BootstrapMaintenanceProfileError as exc:
        print(f"Erro: {exc}", file=stdout)
        return 1
    except ValueError as exc:
        if str(exc) == "internal user was not found":
            print("Erro: usuario interno nao encontrado.", file=stdout)
            return 1
        print(f"Erro: {exc}", file=stdout)
        return 1

    print("Bootstrap do perfil operacional de manutencao concluido com sucesso.", file=stdout)
    return 0


def main() -> None:
    raise SystemExit(run())


if __name__ == "__main__":
    main()
