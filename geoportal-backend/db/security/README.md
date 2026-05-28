# Templates de Seguranca do Banco

Esta pasta contem templates seguros de permissoes e roles.

Os scripts sao modelos com placeholders e nao devem conter valores reais.

Regras:

- nunca incluir senha real;
- nunca incluir nome real de banco, host ou porta;
- executar primeiro somente em homologacao;
- producao exige revisao, backup e autorizacao formal.

## Arquitetura de usuários técnicos e escalabilidade

### Decisão de arquitetura

O Geoportal é escalável para múltiplos módulos. Usuários técnicos de banco (roles PostgreSQL) devem permanecer restritos aos seus schemas específicos. Permissões de aplicação são controladas em `mod_auth` via perfis e permissões de aplicação, não em roles PostgreSQL.

Usuários técnicos de módulos específicos (ex: `api_iluminacao_homolog`, `api_iluminacao_producao`) não serão ampliados automaticamente para acessar `mod_auth`.

### Roles técnicas sugeridas

As seguintes roles técnicas poderão ser criadas em etapas operacionais futuras, sempre com backup, inspeção, execução manual e validação. **Nenhuma role real será criada nesta etapa.**

#### Para bootstrap de usuários internos em homologação (etapa futura)

**Sugestão de nome**: `geoportal_auth_admin_homolog`

**Permissões mínimas sugeridas:**

```
CONNECT no banco de homologação;
USAGE no schema mod_auth;
SELECT e INSERT em mod_auth.usuarios;
USAGE e SELECT na sequence de mod_auth.usuarios;
Sem DELETE;
Sem UPDATE nesta etapa;
Sem CREATE;
Sem acesso a plano, web_map ou mod_iluminacao.
```

**Finalidade**: Permitir que o script administrativo `geoportal-backend/scripts/admin/create_internal_user.py` crie o primeiro usuário interno manualmente em homologação.

#### Para futura API interna em homologação (etapa futura)

**Sugestão de nome**: `geoportal_api_homolog`

**Permissões mínimas sugeridas (crescem conforme novos módulos forem implementados):**

```
CONNECT no banco de homologação;
USAGE no schema mod_auth;
SELECT, INSERT e UPDATE em mod_auth.sessoes (para gerenciar sessões de usuários internos);
SELECT em mod_auth.usuarios (para resolver dados de usuário autenticado);
SELECT em mod_auth.perfis, mod_auth.permissoes, mod_auth.usuario_perfis, mod_auth.perfil_permissoes (para validar autorização);
USAGE e SELECT em sequences de mod_auth conforme necessário;
SELECT, INSERT em mod_iluminacao (conforme endpoints internos forem implementados);
USAGE e SELECT em sequences de mod_iluminacao conforme necessário;
Sem DELETE em tabelas de auditoria;
Sem CREATE, ALTER ou DROP;
Sem acesso a plano, web_map ou schemas administrativos.
```

**Finalidade**: Suportar endpoints internos (`/api/internal/...`) que acessam dados de `mod_auth` e de módulos específicos como `mod_iluminacao`.

**Evolução esperada**: Conforme novos módulos (ex: drenagem, manutenção de vias) forem implementados, esta role poderá receber permissões adicionais SELECT/INSERT em seus schemas, mantendo o princípio de menor privilégio.

#### Para produção (etapa futura)

**Sugestão de nome**: `geoportal_api_producao`

**Mesma estrutura que `geoportal_api_homolog`, mas restrita a produção.**

### Usuários técnicos de módulos específicos (existentes)

- `api_iluminacao_homolog`: Restrito a `mod_iluminacao` em homologação. **Não será expandido para `mod_auth`.**
- `api_iluminacao_producao`: Restrito a `mod_iluminacao` em produção. **Não será expandido para `mod_auth`.**

Novos módulos terão seus próprios usuários técnicos específicos (ex: `api_drenagem_homolog`) seguindo o mesmo padrão de restrição.

### Execução concluída

A role `geoportal_auth_admin_homolog` foi criada em homologação com sucesso:

1. **Backup do banco**: Realizado via `pg_dumpall -g` antes de qualquer operação.
2. **SQL revisado**: Roles criadas com permissões mínimas, sem superuser, sem createdb, sem createrole.
3. **Execução**: SQL executado manualmente em terminal contra banco de homologação.
4. **Validação de permissões**:
   - ✓ CONNECT ao banco de homologação
   - ✓ USAGE no schema `mod_auth`
   - ✓ SELECT em `mod_auth.usuarios`
   - ✓ INSERT em `mod_auth.usuarios`
   - ✓ USAGE na sequence `mod_auth.usuarios_id_seq`
   - ✓ SELECT na sequence `mod_auth.usuarios_id_seq`
   - ✓ Nenhum DELETE, UPDATE ou CREATE autorizado
5. **Primeiro usuário**: O usuário administrativo `admin.homologacao` foi criado com sucesso via `create_internal_user.py` usando a role `geoportal_auth_admin_homolog`.
6. **Validação do usuário**:
   - ✓ Login: `admin.homologacao`
   - ✓ Nome: `Administrador Homologacao`
   - ✓ Ativo: `true`
   - ✓ Email: `NULL` (opcional, não necessário)
   - ✓ ID do usuário inserido corretamente
7. **Validação de serviço**:
   - ✓ Restart da aplicação via harness
   - ✓ Health checks: `/api/health`, `/api/public/iluminacao/health`, `/api/version` OK
   - ✓ Nenhuma endpoint nova criada
   - ✓ Nenhuma sessão ou token criado
   - ✓ Nenhuma mudança em `.env` ou migração
8. **Estado de produção**: Não alterado. Todas as operações restritas a homologação.

**Próxima etapa**: Não ampliar automaticamente `geoportal_auth_admin_homolog` para login runtime. Em etapa operacional separada, criar role `geoportal_api_homolog` com permissões ampliadas para endpoints internos (`/api/internal/...`).
