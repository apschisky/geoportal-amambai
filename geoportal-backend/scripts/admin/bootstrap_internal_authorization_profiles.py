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
    BootstrapProfilePermissionsResult,
    bootstrap_profile_with_existing_permissions,
)


GESTOR_PROFILE_KEY = "gestor-consulta-global"
GESTOR_PROFILE_NAME = "Gestor - Consulta Global"
GESTOR_PROFILE_DESCRIPTION = (
    "Perfil gerencial somente leitura para dashboards e dados internos autorizados."
)

ILUMINACAO_ADMIN_PROFILE_KEY = "administrador-modulo-iluminacao"
ILUMINACAO_ADMIN_PROFILE_NAME = "Administrador do Modulo - Iluminacao Publica"
ILUMINACAO_ADMIN_PROFILE_DESCRIPTION = (
    "Perfil administrativo operacional restrito ao modulo Iluminacao Publica."
)

GESTOR_CONSULTA_GLOBAL_PERMISSIONS: tuple[AdminPermissionSeed, ...] = (
    AdminPermissionSeed(
        "internal",
        "auth.me",
        "Consultar endpoint tecnico de autenticacao/autorizacao atual.",
    ),
    AdminPermissionSeed(
        "iluminacao",
        "dashboard.ler",
        "Ler dashboard gerencial interno de solicitacoes de Iluminacao Publica.",
    ),
    AdminPermissionSeed(
        "iluminacao",
        "solicitacoes.ler",
        "Ler solicitacoes internas de Iluminacao Publica.",
    ),
    AdminPermissionSeed(
        "iluminacao",
        "solicitacoes.ver_historico",
        "Consultar historico interno de solicitacoes de Iluminacao Publica.",
    ),
    AdminPermissionSeed(
        "iluminacao",
        "solicitacoes.ver_observacoes",
        "Consultar observacoes internas de solicitacoes de Iluminacao Publica.",
    ),
)

ILUMINACAO_ADMIN_PERMISSIONS: tuple[AdminPermissionSeed, ...] = (
    AdminPermissionSeed(
        "internal",
        "auth.me",
        "Consultar endpoint tecnico de autenticacao/autorizacao atual.",
    ),
    AdminPermissionSeed(
        "iluminacao",
        "dashboard.ler",
        "Ler dashboard gerencial interno de solicitacoes de Iluminacao Publica.",
    ),
    AdminPermissionSeed(
        "iluminacao",
        "solicitacoes.ler",
        "Ler solicitacoes internas de Iluminacao Publica.",
    ),
    AdminPermissionSeed(
        "iluminacao",
        "solicitacoes.ver_historico",
        "Consultar historico interno de solicitacoes de Iluminacao Publica.",
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
    AdminPermissionSeed(
        "iluminacao",
        "solicitacoes.atualizar_prioridade",
        "Atualizar prioridade operacional de solicitacoes de Iluminacao Publica.",
    ),
    AdminPermissionSeed(
        "iluminacao",
        "solicitacoes.corrigir_status",
        "Corrigir administrativamente status de solicitacoes de Iluminacao Publica.",
    ),
)


@dataclass(frozen=True)
class ProfileBootstrapPlan:
    key: str
    name: str
    description: str
    permissions: tuple[AdminPermissionSeed, ...]


PROFILE_PLANS: dict[str, ProfileBootstrapPlan] = {
    GESTOR_PROFILE_KEY: ProfileBootstrapPlan(
        key=GESTOR_PROFILE_KEY,
        name=GESTOR_PROFILE_NAME,
        description=GESTOR_PROFILE_DESCRIPTION,
        permissions=GESTOR_CONSULTA_GLOBAL_PERMISSIONS,
    ),
    ILUMINACAO_ADMIN_PROFILE_KEY: ProfileBootstrapPlan(
        key=ILUMINACAO_ADMIN_PROFILE_KEY,
        name=ILUMINACAO_ADMIN_PROFILE_NAME,
        description=ILUMINACAO_ADMIN_PROFILE_DESCRIPTION,
        permissions=ILUMINACAO_ADMIN_PERMISSIONS,
    ),
}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Garante perfis RBAC internos com permissoes de aplicacao ja existentes."
        )
    )
    parser.add_argument(
        "--profile",
        choices=(*PROFILE_PLANS.keys(), "all"),
        default="all",
        help="Perfil a garantir. Padrao: all.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Valida entradas e plano sem conectar ao banco ou persistir alteracao.",
    )
    return parser


def _selected_plans(profile: str) -> tuple[ProfileBootstrapPlan, ...]:
    if profile == "all":
        return tuple(PROFILE_PLANS.values())
    return (PROFILE_PLANS[profile],)


def _permission_codes(permissions: Sequence[AdminPermissionSeed]) -> tuple[str, ...]:
    return tuple(f"{permission.modulo}.{permission.chave}" for permission in permissions)


def _validate_profile_plan(plan: ProfileBootstrapPlan) -> None:
    permission_codes = _permission_codes(plan.permissions)
    if "internal.auth.me" not in permission_codes:
        raise ValueError(f"profile plan missing internal.auth.me: {plan.key}")

    admin_permissions = tuple(
        permission for permission in permission_codes if permission.startswith("admin.")
    )
    if admin_permissions:
        raise ValueError(f"profile plan must not include admin permissions: {plan.key}")


def run(
    argv: Sequence[str] | None = None,
    *,
    bootstrap_func: Callable[..., BootstrapProfilePermissionsResult] = (
        bootstrap_profile_with_existing_permissions
    ),
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

    plans = _selected_plans(args.profile)
    for plan in plans:
        _validate_profile_plan(plan)
    if args.dry_run:
        print(
            "Dry-run validado. Nenhum perfil, permissao ou vinculo foi alterado.",
            file=stdout,
        )
        for plan in plans:
            print(
                f"Plano: garantir perfil {plan.key} com permissoes existentes: "
                + ", ".join(_permission_codes(plan.permissions)),
                file=stdout,
            )
        return 0

    try:
        for plan in plans:
            bootstrap_func(
                perfil_chave=plan.key,
                perfil_nome=plan.name,
                perfil_descricao=plan.description,
                permissoes=plan.permissions,
            )
    except ValueError as exc:
        print(f"Erro: {exc}", file=stdout)
        return 1

    print("Bootstrap dos perfis internos de autorizacao concluido com sucesso.", file=stdout)
    return 0


def main() -> None:
    raise SystemExit(run())


if __name__ == "__main__":
    main()