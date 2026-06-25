from sqlalchemy import bindparam, text
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.exc import IntegrityError

from app.core.database import get_engine
from app.repositories.auth_admin_audit_repository import AdminAuditContext
from app.repositories.auth_admin_audit_repository import (
    record_admin_audit_event_with_connection,
)
from app.repositories.auth_admin_user_repository import AssignedInternalUserProfile
from app.repositories.auth_admin_user_repository import CreatedBasicInternalUser
from app.repositories.auth_admin_user_repository import InternalUserConflictError
from app.repositories.auth_admin_user_repository import InternalUserNotFoundError
from app.repositories.auth_admin_user_repository import (
    InternalUserProfileInactiveConflictError,
)
from app.repositories.auth_admin_user_repository import InternalUserProfileNotFoundError
from app.repositories.auth_admin_user_repository import UpdatedInternalUserBlockStatus
from app.repositories.auth_admin_user_repository import UpdatedInternalUserPasswordStatus
from app.repositories.auth_admin_user_profile_repository import (
    InternalAdminUserProfileLink,
)
from app.repositories.auth_admin_user_profile_repository import (
    InternalUserProfileLinkInactiveConflictError,
)
from app.repositories.auth_admin_user_profile_repository import (
    InternalUserProfileLinkNotFoundError,
)


ADMIN_SECURITY_LOCK_KEY = 714_202_606
CRITICAL_ADMIN_PERMISSIONS = (
    'admin.usuarios.criar',
    'admin.usuarios.bloquear',
    'admin.usuarios.redefinir_senha',
    'admin.usuarios.editar',
    'admin.usuarios.desativar',
    'admin.usuarios.resetar_senha',
    'admin.usuarios.remover_perfis',
    'admin.perfis.criar',
    'admin.perfis.editar',
    'admin.perfis.desativar',
    "admin.usuarios.atribuir_perfis",
    "admin.perfis.gerenciar",
    "admin.permissoes.gerenciar",
    "admin.permissoes.conceder",
    "admin.permissoes.revogar",
)


class AdministrativeSecurityDeniedError(RuntimeError):
    pass


def _acquire_admin_security_lock(connection: Connection) -> None:
    connection.execute(
        text("SELECT pg_advisory_xact_lock(:lock_key)"),
        {"lock_key": ADMIN_SECURITY_LOCK_KEY},
    )


def _critical_permission_statement(sql: str):
    return text(sql).bindparams(bindparam("critical_permissions", expanding=True))


def _profile_grants_critical_admin_permission(
    connection: Connection,
    *,
    perfil_id: int,
) -> bool:
    statement = _critical_permission_statement(
        """
        SELECT 1
        FROM mod_auth.perfil_permissoes pp
        INNER JOIN mod_auth.permissoes p
            ON p.id = pp.permissao_id
        WHERE pp.perfil_id = :perfil_id
          AND p.ativo IS true
          AND (
              lower(btrim(p.modulo)) || '.' || lower(btrim(p.chave))
          ) IN :critical_permissions
        LIMIT 1
        """
    )
    row = connection.execute(
        statement,
        {
            "perfil_id": perfil_id,
            "critical_permissions": CRITICAL_ADMIN_PERMISSIONS,
        },
    ).mappings().first()
    return row is not None


def _is_effective_admin(
    connection: Connection,
    *,
    usuario_id: int,
) -> bool:
    statement = _critical_permission_statement(
        """
        SELECT 1
        FROM mod_auth.usuarios u
        INNER JOIN mod_auth.usuario_perfis up
            ON up.usuario_id = u.id
        INNER JOIN mod_auth.perfis pf
            ON pf.id = up.perfil_id
        INNER JOIN mod_auth.perfil_permissoes pp
            ON pp.perfil_id = pf.id
        INNER JOIN mod_auth.permissoes p
            ON p.id = pp.permissao_id
        WHERE u.id = :usuario_id
          AND u.ativo IS true
          AND u.desativado_em IS NULL
          AND (u.bloqueado_ate IS NULL OR u.bloqueado_ate <= now())
          AND up.ativo IS true
          AND pf.ativo IS true
          AND p.ativo IS true
          AND (
              lower(btrim(p.modulo)) || '.' || lower(btrim(p.chave))
          ) IN :critical_permissions
        LIMIT 1
        """
    )
    row = connection.execute(
        statement,
        {
            "usuario_id": usuario_id,
            "critical_permissions": CRITICAL_ADMIN_PERMISSIONS,
        },
    ).mappings().first()
    return row is not None


def _count_effective_admins(connection: Connection) -> int:
    statement = _critical_permission_statement(
        """
        SELECT count(DISTINCT u.id) AS total
        FROM mod_auth.usuarios u
        INNER JOIN mod_auth.usuario_perfis up
            ON up.usuario_id = u.id
        INNER JOIN mod_auth.perfis pf
            ON pf.id = up.perfil_id
        INNER JOIN mod_auth.perfil_permissoes pp
            ON pp.perfil_id = pf.id
        INNER JOIN mod_auth.permissoes p
            ON p.id = pp.permissao_id
        WHERE u.ativo IS true
          AND u.desativado_em IS NULL
          AND (u.bloqueado_ate IS NULL OR u.bloqueado_ate <= now())
          AND up.ativo IS true
          AND pf.ativo IS true
          AND p.ativo IS true
          AND (
              lower(btrim(p.modulo)) || '.' || lower(btrim(p.chave))
          ) IN :critical_permissions
        """
    )
    row = connection.execute(
        statement,
        {"critical_permissions": CRITICAL_ADMIN_PERMISSIONS},
    ).mappings().first()
    return int(row["total"]) if row is not None else 0


def ensure_admin_capability_removal_allowed_with_connection(
    connection: Connection,
    *,
    target_usuario_id: int,
) -> bool:
    _acquire_admin_security_lock(connection)
    if not _is_effective_admin(connection, usuario_id=target_usuario_id):
        return True
    return _count_effective_admins(connection) > 1


def _target_link_is_effective_admin_capability(
    connection: Connection,
    *,
    usuario_id: int,
    perfil_id: int,
    modulo: str | None,
) -> bool:
    module_condition = (
        'up.modulo IS NULL'
        if modulo is None
        else 'lower(up.modulo) = lower(:modulo)'
    )
    statement = _critical_permission_statement(
        f'''
        SELECT 1
        FROM mod_auth.usuarios u
        INNER JOIN mod_auth.usuario_perfis up ON up.usuario_id = u.id
        INNER JOIN mod_auth.perfis pf ON pf.id = up.perfil_id
        INNER JOIN mod_auth.perfil_permissoes pp ON pp.perfil_id = pf.id
        INNER JOIN mod_auth.permissoes p ON p.id = pp.permissao_id
        WHERE u.id = :usuario_id
          AND up.perfil_id = :perfil_id
          AND {module_condition}
          AND u.ativo IS true
          AND u.desativado_em IS NULL
          AND (u.bloqueado_ate IS NULL OR u.bloqueado_ate <= now())
          AND up.ativo IS true
          AND pf.ativo IS true
          AND p.ativo IS true
          AND (lower(btrim(p.modulo)) || '.' || lower(btrim(p.chave)))
              IN :critical_permissions
        LIMIT 1
        '''
    )
    row = connection.execute(
        statement,
        {
            'usuario_id': usuario_id,
            'perfil_id': perfil_id,
            'modulo': modulo,
            'critical_permissions': CRITICAL_ADMIN_PERMISSIONS,
        },
    ).mappings().first()
    return row is not None


def _count_effective_admins_after_link_deactivation(
    connection: Connection,
    *,
    usuario_id: int,
    perfil_id: int,
    modulo: str | None,
) -> int:
    statement = _critical_permission_statement(
        '''
        SELECT count(DISTINCT u.id) AS total
        FROM mod_auth.usuarios u
        INNER JOIN mod_auth.usuario_perfis up ON up.usuario_id = u.id
        INNER JOIN mod_auth.perfis pf ON pf.id = up.perfil_id
        INNER JOIN mod_auth.perfil_permissoes pp ON pp.perfil_id = pf.id
        INNER JOIN mod_auth.permissoes p ON p.id = pp.permissao_id
        WHERE u.ativo IS true
          AND u.desativado_em IS NULL
          AND (u.bloqueado_ate IS NULL OR u.bloqueado_ate <= now())
          AND up.ativo IS true
          AND pf.ativo IS true
          AND p.ativo IS true
          AND (lower(btrim(p.modulo)) || '.' || lower(btrim(p.chave)))
              IN :critical_permissions
          AND NOT (
              up.usuario_id = :usuario_id
              AND up.perfil_id = :perfil_id
              AND (
                  (:modulo IS NULL AND up.modulo IS NULL)
                  OR (:modulo IS NOT NULL AND lower(up.modulo) = lower(:modulo))
              )
          )
        '''
    )
    row = connection.execute(
        statement,
        {
            'usuario_id': usuario_id,
            'perfil_id': perfil_id,
            'modulo': modulo,
            'critical_permissions': CRITICAL_ADMIN_PERMISSIONS,
        },
    ).mappings().first()
    return int(row['total']) if row is not None else 0


def create_basic_internal_user_audited(
    *,
    nome: str,
    login: str,
    senha_hash: str,
    email: str | None,
    audit_context: AdminAuditContext,
    engine: Engine | None = None,
) -> CreatedBasicInternalUser:
    db_engine = engine or get_engine()
    statement = text(
        """
        INSERT INTO mod_auth.usuarios (
            nome, email, login, senha_hash, ativo,
            bloqueado_ate, desativado_em, atualizado_em
        )
        VALUES (
            :nome, :email, :login, :senha_hash, true,
            NULL, NULL, NULL
        )
        RETURNING
            id, login, nome, email, ativo,
            (bloqueado_ate IS NOT NULL AND bloqueado_ate > now()) AS bloqueado,
            criado_em
        """
    )
    try:
        with db_engine.begin() as connection:
            row = connection.execute(
                statement,
                {
                    "nome": nome,
                    "email": email,
                    "login": login,
                    "senha_hash": senha_hash,
                },
            ).mappings().first()
            if row is None:
                raise RuntimeError("internal user was not created")
            record_admin_audit_event_with_connection(
                connection,
                context=audit_context,
                acao="admin.user.create",
                entidade_tipo="usuario",
                entidade_id=row["id"],
                resultado="sucesso",
                resumo="Usuario interno criado.",
            )
    except IntegrityError as exc:
        raise InternalUserConflictError("internal user already exists") from exc
    return CreatedBasicInternalUser(**dict(row))


def assign_internal_user_profile_audited(
    *,
    usuario_id: int,
    perfil_id: int,
    modulo: str | None,
    audit_context: AdminAuditContext,
    engine: Engine | None = None,
) -> AssignedInternalUserProfile:
    db_engine = engine or get_engine()
    denied = False
    result: AssignedInternalUserProfile | None = None
    with db_engine.begin() as connection:
        _acquire_admin_security_lock(connection)
        user = connection.execute(
            text(
                """
                SELECT id FROM mod_auth.usuarios
                WHERE id = :usuario_id
                FOR UPDATE
                """
            ),
            {"usuario_id": usuario_id},
        ).mappings().first()
        profile = connection.execute(
            text(
                """
                SELECT id FROM mod_auth.perfis
                WHERE id = :perfil_id AND ativo IS true
                """
            ),
            {"perfil_id": perfil_id},
        ).mappings().first()
        if user is None or profile is None:
            raise InternalUserProfileNotFoundError(
                "internal user or profile not found"
            )

        module_condition = "modulo IS NULL" if modulo is None else "lower(modulo) = lower(:modulo)"
        existing = connection.execute(
            text(
                f"""
                SELECT usuario_id, perfil_id, modulo, ativo
                FROM mod_auth.usuario_perfis
                WHERE usuario_id = :usuario_id
                  AND perfil_id = :perfil_id
                  AND {module_condition}
                LIMIT 1
                """
            ),
            {"usuario_id": usuario_id, "perfil_id": perfil_id, "modulo": modulo},
        ).mappings().first()
        if existing is not None:
            if existing["ativo"] is not True:
                raise InternalUserProfileInactiveConflictError(
                    "internal user profile link is inactive"
                )
            result = AssignedInternalUserProfile(
                usuario_id=int(existing["usuario_id"]),
                perfil_id=int(existing["perfil_id"]),
                modulo=existing["modulo"],
                ativo=True,
                created=False,
            )
        elif (
            usuario_id == audit_context.ator_usuario_id
            and _profile_grants_critical_admin_permission(
                connection,
                perfil_id=perfil_id,
            )
        ):
            record_admin_audit_event_with_connection(
                connection,
                context=audit_context,
                acao="admin.security.denied_self_elevation",
                entidade_tipo="usuario_perfil",
                entidade_id=f"{usuario_id}:{perfil_id}",
                resultado="negada",
                motivo="self_elevation",
                resumo="Atribuicao administrativa ao proprio ator foi negada.",
            )
            denied = True
        else:
            inserted = connection.execute(
                text(
                    """
                    INSERT INTO mod_auth.usuario_perfis (
                        usuario_id, perfil_id, modulo, ativo
                    )
                    VALUES (:usuario_id, :perfil_id, :modulo, true)
                    RETURNING usuario_id, perfil_id, modulo, ativo
                    """
                ),
                {"usuario_id": usuario_id, "perfil_id": perfil_id, "modulo": modulo},
            ).mappings().first()
            if inserted is None:
                raise RuntimeError("internal user profile link was not created")
            result = AssignedInternalUserProfile(
                usuario_id=int(inserted["usuario_id"]),
                perfil_id=int(inserted["perfil_id"]),
                modulo=inserted["modulo"],
                ativo=bool(inserted["ativo"]),
                created=True,
            )

        if result is not None:
            record_admin_audit_event_with_connection(
                connection,
                context=audit_context,
                acao="admin.user.assign_profile",
                entidade_tipo="usuario_perfil",
                entidade_id=f"{usuario_id}:{perfil_id}",
                resultado="sucesso",
                resumo=(
                    "Perfil atribuido ao usuario."
                    if result.created
                    else "Perfil ja estava atribuido ao usuario."
                ),
            )
    if denied:
        raise AdministrativeSecurityDeniedError("administrative action denied")
    if result is None:
        raise RuntimeError("internal user profile assignment was not resolved")
    return result


def deactivate_internal_user_profile_audited(
    *,
    usuario_id: int,
    perfil_id: int,
    modulo: str | None,
    justificativa: str,
    audit_context: AdminAuditContext,
    engine: Engine | None = None,
) -> InternalAdminUserProfileLink:
    db_engine = engine or get_engine()
    denied = False
    row = None
    module_condition = (
        'up.modulo IS NULL'
        if modulo is None
        else 'lower(up.modulo) = lower(:modulo)'
    )
    scope = modulo or 'global'
    entity_id = f'{usuario_id}:{perfil_id}:{scope}'

    with db_engine.begin() as connection:
        _acquire_admin_security_lock(connection)
        link = connection.execute(
            text(
                f'''
                SELECT up.usuario_id, up.perfil_id, pf.chave, pf.nome,
                       up.modulo, up.ativo, up.criado_em
                FROM mod_auth.usuario_perfis up
                INNER JOIN mod_auth.perfis pf ON pf.id = up.perfil_id
                WHERE up.usuario_id = :usuario_id
                  AND up.perfil_id = :perfil_id
                  AND {module_condition}
                FOR UPDATE OF up
                '''
            ),
            {
                'usuario_id': usuario_id,
                'perfil_id': perfil_id,
                'modulo': modulo,
            },
        ).mappings().first()
        if link is None:
            raise InternalUserProfileLinkNotFoundError(
                'internal user profile link was not found'
            )
        if link['ativo'] is not True:
            raise InternalUserProfileLinkInactiveConflictError(
                'internal user profile link is inactive'
            )

        if usuario_id == audit_context.ator_usuario_id:
            record_admin_audit_event_with_connection(
                connection,
                context=audit_context,
                acao='admin.security.denied_self_demotion',
                entidade_tipo='usuario_perfil',
                entidade_id=entity_id,
                resultado='negada',
                motivo='self_demotion',
                resumo='Remocao do proprio vinculo administrativo foi negada.',
                justificativa=justificativa,
            )
            denied = True
        elif _target_link_is_effective_admin_capability(
            connection,
            usuario_id=usuario_id,
            perfil_id=perfil_id,
            modulo=modulo,
        ) and _count_effective_admins_after_link_deactivation(
            connection,
            usuario_id=usuario_id,
            perfil_id=perfil_id,
            modulo=modulo,
        ) == 0:
            record_admin_audit_event_with_connection(
                connection,
                context=audit_context,
                acao='admin.security.denied_last_admin_removal',
                entidade_tipo='usuario_perfil',
                entidade_id=entity_id,
                resultado='negada',
                motivo='last_effective_admin',
                resumo='Remocao de vinculo administrativo foi negada.',
                justificativa=justificativa,
            )
            denied = True
        else:
            row = connection.execute(
                text(
                    f'''
                    UPDATE mod_auth.usuario_perfis up
                    SET ativo = false
                    FROM mod_auth.perfis pf
                    WHERE up.usuario_id = :usuario_id
                      AND up.perfil_id = :perfil_id
                      AND {module_condition}
                      AND up.ativo IS true
                      AND pf.id = up.perfil_id
                    RETURNING up.usuario_id, up.perfil_id, pf.chave, pf.nome,
                              up.modulo, up.ativo, up.criado_em
                    '''
                ),
                {
                    'usuario_id': usuario_id,
                    'perfil_id': perfil_id,
                    'modulo': modulo,
                },
            ).mappings().first()
            if row is None:
                raise InternalUserProfileLinkInactiveConflictError(
                    'internal user profile link state changed'
                )
            record_admin_audit_event_with_connection(
                connection,
                context=audit_context,
                acao='admin.user.remove_profile',
                entidade_tipo='usuario_perfil',
                entidade_id=entity_id,
                resultado='sucesso',
                resumo='Perfil removido do usuario por desativacao logica.',
                justificativa=justificativa,
            )

    if denied:
        raise AdministrativeSecurityDeniedError('administrative action denied')
    if row is None:
        raise RuntimeError('internal user profile link was not deactivated')
    return InternalAdminUserProfileLink(**dict(row))


def block_internal_user_audited(
    *,
    usuario_id: int,
    audit_context: AdminAuditContext,
    engine: Engine | None = None,
) -> UpdatedInternalUserBlockStatus:
    db_engine = engine or get_engine()
    denied = False
    row = None
    with db_engine.begin() as connection:
        if usuario_id == audit_context.ator_usuario_id:
            record_admin_audit_event_with_connection(
                connection,
                context=audit_context,
                acao='admin.security.denied_self_change',
                entidade_tipo='usuario',
                entidade_id=usuario_id,
                resultado='negada',
                motivo='self_block',
                resumo='Bloqueio administrativo do proprio ator foi negado.',
            )
            denied = True
        elif not ensure_admin_capability_removal_allowed_with_connection(
            connection,
            target_usuario_id=usuario_id,
        ):
            record_admin_audit_event_with_connection(
                connection,
                context=audit_context,
                acao="admin.security.denied_last_admin_disable",
                entidade_tipo="usuario",
                entidade_id=usuario_id,
                resultado="negada",
                motivo="last_effective_admin",
                resumo="Bloqueio administrativo negado.",
            )
            denied = True
        else:
            row = connection.execute(
                text(
                    """
                    WITH updated_user AS (
                        UPDATE mod_auth.usuarios
                        SET bloqueado_ate = now() + (:block_days * interval '1 day')
                        WHERE id = :usuario_id
                        RETURNING id, login, nome, email, ativo, criado_em
                    ),
                    revoked_sessions AS (
                        UPDATE mod_auth.sessoes
                        SET revogado_em = now()
                        WHERE usuario_id = :usuario_id
                          AND revogado_em IS NULL
                        RETURNING id
                    )
                    SELECT id, login, nome, email, ativo,
                           true AS bloqueado, criado_em
                    FROM updated_user
                    """
                ),
                {"usuario_id": usuario_id, "block_days": 36500},
            ).mappings().first()
            if row is None:
                raise InternalUserNotFoundError("internal user was not found")
            record_admin_audit_event_with_connection(
                connection,
                context=audit_context,
                acao="admin.user.disable",
                entidade_tipo="usuario",
                entidade_id=usuario_id,
                resultado="sucesso",
                resumo="Usuario interno bloqueado.",
            )
    if denied:
        raise AdministrativeSecurityDeniedError("administrative action denied")
    return UpdatedInternalUserBlockStatus(**dict(row))


def unblock_internal_user_audited(
    *,
    usuario_id: int,
    audit_context: AdminAuditContext,
    engine: Engine | None = None,
) -> UpdatedInternalUserBlockStatus:
    db_engine = engine or get_engine()
    with db_engine.begin() as connection:
        row = connection.execute(
            text(
                """
                UPDATE mod_auth.usuarios
                SET bloqueado_ate = NULL
                WHERE id = :usuario_id
                RETURNING id, login, nome, email, ativo,
                          false AS bloqueado, criado_em
                """
            ),
            {"usuario_id": usuario_id},
        ).mappings().first()
        if row is None:
            raise InternalUserNotFoundError("internal user was not found")
        record_admin_audit_event_with_connection(
            connection,
            context=audit_context,
            acao="admin.user.enable",
            entidade_tipo="usuario",
            entidade_id=usuario_id,
            resultado="sucesso",
            resumo="Usuario interno desbloqueado.",
        )
    return UpdatedInternalUserBlockStatus(**dict(row))


def reset_internal_user_password_audited(
    *,
    usuario_id: int,
    senha_hash: str,
    audit_context: AdminAuditContext,
    engine: Engine | None = None,
) -> UpdatedInternalUserPasswordStatus:
    db_engine = engine or get_engine()
    with db_engine.begin() as connection:
        row = connection.execute(
            text(
                """
                WITH updated_user AS (
                    UPDATE mod_auth.usuarios
                    SET senha_hash = :senha_hash, atualizado_em = now()
                    WHERE id = :usuario_id
                    RETURNING id, login, nome, email, ativo,
                              (bloqueado_ate IS NOT NULL AND bloqueado_ate > now())
                              AS bloqueado,
                              criado_em
                ),
                revoked_sessions AS (
                    UPDATE mod_auth.sessoes
                    SET revogado_em = now()
                    WHERE usuario_id = :usuario_id
                      AND revogado_em IS NULL
                    RETURNING id
                )
                SELECT id, login, nome, email, ativo, bloqueado, criado_em
                FROM updated_user
                """
            ),
            {"usuario_id": usuario_id, "senha_hash": senha_hash},
        ).mappings().first()
        if row is None:
            raise InternalUserNotFoundError("internal user was not found")
        record_admin_audit_event_with_connection(
            connection,
            context=audit_context,
            acao="admin.user.reset_password",
            entidade_tipo="usuario",
            entidade_id=usuario_id,
            resultado="sucesso",
            resumo="Senha de usuario interno redefinida.",
        )
    return UpdatedInternalUserPasswordStatus(**dict(row))


__all__ = [
    'deactivate_internal_user_profile_audited',
    "ADMIN_SECURITY_LOCK_KEY",
    "CRITICAL_ADMIN_PERMISSIONS",
    "AdministrativeSecurityDeniedError",
    "assign_internal_user_profile_audited",
    "block_internal_user_audited",
    "create_basic_internal_user_audited",
    "ensure_admin_capability_removal_allowed_with_connection",
    "reset_internal_user_password_audited",
    "unblock_internal_user_audited",
]
