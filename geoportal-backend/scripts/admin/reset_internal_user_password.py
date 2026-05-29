import argparse
import getpass
import sys
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import TextIO


BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.repositories.auth_admin_user_repository import (
    update_internal_user_password_by_login,
)
from app.security.passwords import hash_password


@dataclass(frozen=True)
class PasswordResetInput:
    login: str


class InternalUserPasswordResetError(Exception):
    pass


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Redefine a senha de um usuario interno existente do Geoportal."
    )
    parser.add_argument("--login", required=True, help="Login interno do usuario existente.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Valida entrada e senha sem conectar ao banco ou persistir alteracao.",
    )
    return parser


def normalize_password_reset_input(login: str) -> PasswordResetInput:
    normalized_login = login.strip().lower()

    if not normalized_login:
        raise InternalUserPasswordResetError("login nao pode ser vazio.")

    return PasswordResetInput(login=normalized_login)


def read_new_password(
    *,
    getpass_func: Callable[[str], str] = getpass.getpass,
) -> str:
    password = getpass_func("Nova senha: ")
    confirmation = getpass_func("Confirme a nova senha: ")

    if password != confirmation:
        raise InternalUserPasswordResetError("senha e confirmacao nao conferem.")
    if not password.strip():
        raise InternalUserPasswordResetError("senha nao pode ser vazia.")

    return password


def run(
    argv: Sequence[str] | None = None,
    *,
    getpass_func: Callable[[str], str] = getpass.getpass,
    hash_password_func: Callable[[str], str] = hash_password,
    update_password_func: Callable[..., bool] = update_internal_user_password_by_login,
    stdout: TextIO = sys.stdout,
) -> int:
    parser = build_parser()
    args, unknown_args = parser.parse_known_args(argv)
    if unknown_args:
        print(
            "Erro: argumento nao reconhecido. Senha nunca deve ser passada por linha de comando.",
            file=stdout,
        )
        return 2

    try:
        reset_input = normalize_password_reset_input(login=args.login)
        password = read_new_password(getpass_func=getpass_func)
        password_hash = hash_password_func(password)

        if args.dry_run:
            print("Dry-run validado. Nenhuma senha foi alterada.", file=stdout)
            return 0

        password_updated = update_password_func(
            login=reset_input.login,
            senha_hash=password_hash,
        )
        if not password_updated:
            raise InternalUserPasswordResetError("usuario interno nao encontrado.")
    except InternalUserPasswordResetError as exc:
        print(f"Erro: {exc}", file=stdout)
        return 1

    print("Senha do usuario interno atualizada com sucesso.", file=stdout)
    return 0


def main() -> None:
    raise SystemExit(run())


if __name__ == "__main__":
    main()
