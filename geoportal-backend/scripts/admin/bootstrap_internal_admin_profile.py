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


PROFILE_KEY = "administrador-interno-geoportal"
PROFILE_NAME = "Administrador Interno do Geoportal"
PROFILE_DESCRIPTION = "Perfil administrativo inicial do Geoportal Interno."

INITIAL_ADMIN_PERMISSIONS: tuple[AdminPermissionSeed, ...] = (
    AdminPermissionSeed("admin", "usuarios.ler", "Ler usuarios internos."),
    AdminPermissionSeed("admin", "usuarios.criar", "Criar usuarios internos."),
    AdminPermissionSeed("admin", "usuarios.bloquear", "Bloquear usuarios internos."),
    AdminPermissionSeed(
        "admin",
        "usuarios.redefinir_senha",
        "Redefinir senha de usuarios internos.",
    ),
    AdminPermissionSeed(
        "admin",
        "usuarios.atribuir_perfis",
        "Atribuir perfis a usuarios internos.",
    ),
    AdminPermissionSeed("admin", "perfis.ler", "Ler perfis internos."),
    AdminPermissionSeed("admin", "perfis.gerenciar", "Gerenciar perfis internos."),
    AdminPermissionSeed("admin", "permissoes.ler", "Ler permissoes internas."),
    AdminPermissionSeed(
        "admin",
        "permissoes.gerenciar",
        "Gerenciar permissoes internas.",
    ),
    AdminPermissionSeed(
        "internal",
        "auth.me",
        "Consultar endpoint tecnico de autenticacao/autorizacao atual.",
    ),
)


@dataclass(frozen=True)
class BootstrapAdminProfileInput:
    login: str


class BootstrapAdminProfileError(Exception):
    pass


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Garante o perfil administrativo inicial do Geoportal Interno."
    )
    parser.add_argument(
        "--login",
        required=True,
        help="Login interno do usuario que recebera o perfil administrativo.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Valida entradas e plano sem conectar ao banco ou persistir alteracao.",
    )
    return parser


def normalize_bootstrap_input(login: str) -> BootstrapAdminProfileInput:
    normalized_login = login.strip().lower()
    if not normalized_login:
        raise BootstrapAdminProfileError("login nao pode ser vazio.")
    return BootstrapAdminProfileInput(login=normalized_login)


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
            return 0

        bootstrap_func(
            login=bootstrap_input.login,
            perfil_chave=PROFILE_KEY,
            perfil_nome=PROFILE_NAME,
            perfil_descricao=PROFILE_DESCRIPTION,
            permissoes=INITIAL_ADMIN_PERMISSIONS,
        )
    except BootstrapAdminProfileError as exc:
        print(f"Erro: {exc}", file=stdout)
        return 1
    except ValueError as exc:
        if str(exc) == "internal user was not found":
            print("Erro: usuario interno nao encontrado.", file=stdout)
            return 1
        print(f"Erro: {exc}", file=stdout)
        return 1

    print("Bootstrap do perfil administrativo interno concluido com sucesso.", file=stdout)
    return 0


def main() -> None:
    raise SystemExit(run())


if __name__ == "__main__":
    main()
