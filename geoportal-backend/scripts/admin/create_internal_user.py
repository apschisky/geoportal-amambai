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
    create_internal_user,
    internal_user_exists,
)
from app.security.passwords import hash_password


@dataclass(frozen=True)
class AdminUserInput:
    login: str
    email: str
    nome: str


class AdminUserCreationError(Exception):
    pass


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Cria o primeiro usuario interno do Geoportal de forma manual e segura."
    )
    parser.add_argument("--login", required=True, help="Login interno do usuario.")
    parser.add_argument("--email", required=True, help="Email institucional do usuario.")
    parser.add_argument("--nome", required=True, help="Nome de exibicao do usuario.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Valida entradas e senha sem conectar ao banco ou persistir usuario.",
    )
    return parser


def normalize_admin_user_input(login: str, email: str, nome: str) -> AdminUserInput:
    normalized_login = login.strip().lower()
    normalized_email = email.strip().lower()
    normalized_nome = nome.strip()

    if not normalized_login:
        raise AdminUserCreationError("login nao pode ser vazio.")
    if not normalized_email:
        raise AdminUserCreationError("email nao pode ser vazio.")
    if "@" not in normalized_email:
        raise AdminUserCreationError("email deve ter formato minimo valido.")
    if not normalized_nome:
        raise AdminUserCreationError("nome nao pode ser vazio.")

    return AdminUserInput(
        login=normalized_login,
        email=normalized_email,
        nome=normalized_nome,
    )


def read_password(
    *,
    getpass_func: Callable[[str], str] = getpass.getpass,
) -> str:
    password = getpass_func("Senha inicial: ")
    confirmation = getpass_func("Confirme a senha inicial: ")

    if password != confirmation:
        raise AdminUserCreationError("senha e confirmacao nao conferem.")
    if not password.strip():
        raise AdminUserCreationError("senha nao pode ser vazia.")

    return password


def run(
    argv: Sequence[str] | None = None,
    *,
    getpass_func: Callable[[str], str] = getpass.getpass,
    hash_password_func: Callable[[str], str] = hash_password,
    user_exists_func: Callable[..., bool] = internal_user_exists,
    create_user_func: Callable[..., object] = create_internal_user,
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
        user_input = normalize_admin_user_input(
            login=args.login,
            email=args.email,
            nome=args.nome,
        )
        password = read_password(getpass_func=getpass_func)
        password_hash = hash_password_func(password)

        if args.dry_run:
            print("Dry-run validado. Nenhum usuario foi criado.", file=stdout)
            return 0

        if user_exists_func(login=user_input.login, email=user_input.email):
            raise AdminUserCreationError("login ou email ja cadastrado.")

        create_user_func(
            nome=user_input.nome,
            email=user_input.email,
            login=user_input.login,
            senha_hash=password_hash,
        )
    except AdminUserCreationError as exc:
        print(f"Erro: {exc}", file=stdout)
        return 1

    print("Usuario interno criado com sucesso.", file=stdout)
    return 0


def main() -> None:
    raise SystemExit(run())


if __name__ == "__main__":
    main()
