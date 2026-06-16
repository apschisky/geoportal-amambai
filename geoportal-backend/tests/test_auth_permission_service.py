from app.services import auth_permission_service


def test_has_permission_returns_true_when_permission_exists(monkeypatch) -> None:
    monkeypatch.setattr(
        auth_permission_service,
        "get_user_permissions",
        lambda usuario_id, engine=None: {"admin.usuarios.ler"},
    )

    assert auth_permission_service.has_permission(7, " admin.usuarios.ler ") is True


def test_has_permission_returns_false_when_permission_is_missing(monkeypatch) -> None:
    monkeypatch.setattr(
        auth_permission_service,
        "get_user_permissions",
        lambda usuario_id, engine=None: {"admin.usuarios.ler"},
    )

    assert auth_permission_service.has_permission(7, "admin.usuarios.criar") is False


def test_has_permission_returns_false_for_blank_permission(monkeypatch) -> None:
    calls = {"get": 0}
    monkeypatch.setattr(
        auth_permission_service,
        "get_user_permissions",
        lambda usuario_id, engine=None: calls.__setitem__("get", 1) or set(),
    )

    assert auth_permission_service.has_permission(7, "   ") is False
    assert calls == {"get": 0}


def test_get_user_permissions_delegates_to_repository(monkeypatch) -> None:
    calls: dict[str, object] = {}

    def fake_get_effective_permissions_for_user(
        usuario_id: int,
        engine: object = None,
    ) -> set[str]:
        calls.update({"usuario_id": usuario_id, "engine": engine})
        return {"iluminacao.solicitacoes.ler"}

    monkeypatch.setattr(
        auth_permission_service,
        "get_effective_permissions_for_user",
        fake_get_effective_permissions_for_user,
    )

    response = auth_permission_service.get_user_permissions(7, engine="engine-ficticio")

    assert response == {"iluminacao.solicitacoes.ler"}
    assert calls == {"usuario_id": 7, "engine": "engine-ficticio"}


def test_get_user_profiles_delegates_to_repository(monkeypatch) -> None:
    calls: dict[str, object] = {}

    def fake_get_effective_profiles_for_user(
        usuario_id: int,
        engine: object = None,
    ) -> set[str]:
        calls.update({"usuario_id": usuario_id, "engine": engine})
        return {"manutencao-iluminacao"}

    monkeypatch.setattr(
        auth_permission_service,
        "get_effective_profiles_for_user",
        fake_get_effective_profiles_for_user,
    )

    response = auth_permission_service.get_user_profiles(7, engine="engine-ficticio")

    assert response == {"manutencao-iluminacao"}
    assert calls == {"usuario_id": 7, "engine": "engine-ficticio"}
