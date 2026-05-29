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

Autorizacao funcional de usuarios humanos deve vir de `mod_auth.usuarios`, `mod_auth.perfis`, `mod_auth.permissoes`, `mod_auth.usuario_perfis` e `mod_auth.perfil_permissoes`. Um usuario pode ter um ou mais perfis; perfis agrupam permissoes; permissoes devem ser granulares por modulo/recurso/acao. Administrador funcional do Geoportal Interno nao deve ser superuser de banco e nao deve ser liberado por regra hardcoded de login. A base tecnica de autorizacao no backend foi implementada com repository de permissoes efetivas, service `has_permission(...)`, dependency `require_permission(...)` e endpoint tecnico `/api/internal/auth/me`, sem criar perfis/permissoes reais ou alterar schema. Tela/frontend continuam etapa posterior.

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

**Finalidade inicial prevista**: role runtime da futura API interna de autenticacao em homologacao, separada da role de bootstrap `geoportal_auth_admin_homolog`. A role `geoportal_auth_admin_homolog` nao deve ser reutilizada pelo endpoint de login.

**Matriz minima prevista derivada dos repositories atuais:**

```
CONNECT no banco de homologação;
USAGE no schema mod_auth;

mod_auth.usuarios:
- SELECT;
- UPDATE somente para ultimo_login_em e atualizado_em via record_successful_login;
- Sem INSERT;
- Sem DELETE.

mod_auth.sessoes:
- SELECT;
- INSERT;
- UPDATE para revogacao de sessao;
- Sem DELETE.

mod_auth.login_auditoria:
- SELECT;
- INSERT;
- Sem UPDATE;
- Sem DELETE.

Sequences:
- USAGE e SELECT em mod_auth.sessoes_id_seq;
- USAGE e SELECT em mod_auth.login_auditoria_id_seq.

Sem CREATE;
Sem DROP, ALTER ou TRUNCATE;
Sem SUPERUSER, CREATEDB, CREATEROLE, REPLICATION ou BYPASSRLS;
Sem acesso automatico a plano, web_map ou mod_iluminacao;
Sem usar postgres como usuario runtime;
Sem ampliar api_iluminacao_homolog para mod_auth.
```

**Base tecnica atual**:

- `auth_user_repository.py`: `SELECT` em `mod_auth.usuarios` e `UPDATE` apenas de `ultimo_login_em`/`atualizado_em`.
- `auth_session_repository.py`: `INSERT`, `SELECT` e `UPDATE` em `mod_auth.sessoes`.
- `auth_login_audit_repository.py`: `INSERT` e `SELECT` em `mod_auth.login_auditoria`.
- `auth_current_session_service.py`: depende da consulta de sessao ativa por `token_hash`.

**Etapa operacional futura**: a criacao real de `geoportal_api_homolog` deve ocorrer separadamente, sem producao, com backup de roles, comandos revisados, execucao manual e validacao de permissoes. Esta documentacao nao cria role real, nao cria GRANT real executavel e nao altera banco.

**Criação operacional realizada em homologação**:

A role `geoportal_api_homolog` foi criada em homologação com sucesso para permitir validação do fluxo de login interno isolado. Permissões implementadas (mínimas):

```sql
CONNECT ao banco de homologação;
USAGE no schema mod_auth;

mod_auth.usuarios:
- SELECT;

mod_auth.sessoes:
- SELECT;
- INSERT;
- Sem UPDATE nesta validação;
- Sem DELETE.

mod_auth.login_auditoria:
- INSERT;
- SELECT;

Sequences:
- USAGE e SELECT em mod_auth.usuarios_id_seq;
- USAGE e SELECT em mod_auth.sessoes_id_seq;
- USAGE e SELECT em mod_auth.login_auditoria_id_seq.

Sem DELETE, UPDATE global, CREATE, DROP, ALTER, TRUNCATE, ou SUPERUSER.
```

Validação realizada (processo isolado em homologação):
- Teste isolado com DATABASE_URL apontado para `geoportal_api_homolog` + homologação.
- POST /api/internal/auth/login com `admin.homologacao`: status 200, token presente.
- GET /api/internal/auth/smoke com token: status 200, sessão ativa.
- Confirmada: SELECT em usuarios, INSERT em sessoes, INSERT em login_auditoria.
- Nenhuma alteração em produção, NSSM ou .env versionado.

Validação operacional posterior do commit `eaf5724` Implementa cookie e logout internos confirmou, em processo isolado de homologação, o transporte por cookie HttpOnly e o logout com a mesma role runtime. O processo usou variáveis temporárias (`DATABASE_URL` com `geoportal_api_homolog`, feature flag interna, segredo de sessão, cookie secure desabilitado apenas para TestClient/local e senha temporária de teste), todas limpas ao final. Pytest completo no servidor: 298 passed. Resultado sanitizado: login status 200, cookie HttpOnly/SameSite=Lax/Path `/api/internal` setado, smoke autenticado por cookie status 200, logout sem `X-Geoportal-Internal-Request: 1` retornou 403, logout com header retornou 200 e limpou cookie, smoke após logout retornou 401. Contagens após teste: `mod_auth.usuarios=1`, `mod_auth.sessoes=2`, `mod_auth.login_auditoria=2`, `sessoes_revogadas=1`. Nenhum token, cookie real, senha, hash, segredo, host, IP ou `DATABASE_URL` real foi registrado.

**Validacao operacional de autorizacao e ajuste minimo da matriz runtime**:

O commit `03efa10` Implementa base de autorizacao interna foi aplicado no servidor e validado com pytest completo: 311 passed. O endpoint tecnico `GET /api/internal/auth/me` foi validado em processo isolado de homologacao com variaveis temporarias (`DATABASE_URL` usando `geoportal_api_homolog`, `GEOPORTAL_INTERNAL_ROUTES_ENABLED`, `GEOPORTAL_INTERNAL_SESSION_SECRET`, `GEOPORTAL_INTERNAL_SESSION_COOKIE_SECURE=false` para TestClient/local e `TEST_INTERNAL_PASSWORD`), todas limpas ao final.

O primeiro teste de `/me` falhou por falta de privilegio `SELECT` em `mod_auth.usuario_perfis`, confirmando que a role runtime precisava de leitura nas tabelas de autorizacao. O ajuste operacional em homologacao concedeu apenas:

```sql
GRANT SELECT ON TABLE mod_auth.usuario_perfis TO geoportal_api_homolog;
GRANT SELECT ON TABLE mod_auth.perfis TO geoportal_api_homolog;
GRANT SELECT ON TABLE mod_auth.perfil_permissoes TO geoportal_api_homolog;
GRANT SELECT ON TABLE mod_auth.permissoes TO geoportal_api_homolog;
```

A validacao confirmou, para cada uma dessas tabelas: `SELECT=true`, `INSERT=false`, `UPDATE=false`, `DELETE=false`. A role `geoportal_api_homolog` passa a ter leitura suficiente para autenticacao, sessao e autorizacao, mantendo privilegio minimo: sem escrita nas tabelas de perfis/permissoes, sem superuser, sem `CREATEDB`, sem `CREATEROLE`, sem `BYPASSRLS` e sem acesso automatico a outros schemas.

Resultado sanitizado final: `login_status=200`, `login_set_cookie=True`, `cookie_jar_tem_sessao=True`, `me_status=200`, `me_authenticated=True`, `me_usuario_id=7`, `me_permissoes=[]`, `me_tem_token=False`, `me_tem_cookie=False`, `me_tem_senha_hash=False`, `me_tem_token_hash=False`, `me_tem_session_secret=False`, `me_tem_database_url=False`. `permissoes=[]` e comportamento esperado porque nenhum perfil/permissao real foi criado ou atribuido ao `admin.homologacao`.

**Plano de bootstrap do perfil administrativo inicial**:

A proxima etapa deve criar, primeiro em homologacao, o perfil `Administrador Interno do Geoportal` e as permissoes administrativas iniciais por script administrativo idempotente, nao por SQL manual solto. O script devera aceitar `--dry-run`, exigir `--login` ou parametro explicito equivalente, usar bind parameters, validar ambiente antes da execucao real, nao apagar registros, nao duplicar perfis/permissoes/vinculos, criar permissoes e perfil somente quando ausentes, associar permissoes ao perfil quando faltar e atribuir o perfil ao usuario informado quando ainda nao atribuido. Tambem devera ter testes automatizados e nao imprimir senha, token, hash, `session_secret` ou `DATABASE_URL`.

Permissoes administrativas iniciais propostas: `admin.usuarios.ler`, `admin.usuarios.criar`, `admin.usuarios.bloquear`, `admin.usuarios.redefinir_senha`, `admin.usuarios.atribuir_perfis`, `admin.perfis.ler`, `admin.perfis.gerenciar`, `admin.permissoes.ler`, `admin.permissoes.gerenciar` e `internal.auth.me`. Em homologacao, o perfil sera atribuido ao `admin.homologacao`.

O administrador funcional do Geoportal Interno nao e superuser de banco e nao deve receber permissoes PostgreSQL especiais por ser administrador da aplicacao. A role runtime `geoportal_api_homolog` continua apenas lendo permissoes e nao deve criar, alterar ou excluir perfis/permissoes. Para executar bootstrap em homologacao, pode ser necessaria role administrativa operacional, como `geoportal_auth_admin_homolog`, com permissoes temporarias e controladas, seguidas de revogacao quando forem apenas operacionais.

Roteiro recomendado em homologacao: backup antes; `--dry-run` do script; execucao real controlada; validacao das tabelas `mod_auth`; validacao de `/api/internal/auth/me` retornando permissoes administrativas; documentacao do resultado.

Estrategia para producao: producao nao recebe dados automaticamente da homologacao e nao deve ter copia cega de dados. Usar o mesmo script idempotente apenas depois de validado, com backup obrigatorio e `--dry-run` obrigatorio antes da execucao real. Criacao de usuario real de producao e etapa propria. Nenhuma senha, token ou hash deve ser documentado; nenhuma migration ou restart de producao deve ocorrer sem confirmacao humana; a feature flag interna permanece sob controle; tela interna so depois de autorizacao e endpoints administrativos seguros.

Implementacao local: o script `geoportal-backend/scripts/admin/bootstrap_internal_admin_profile.py` e o repository `geoportal-backend/app/repositories/auth_admin_profile_repository.py` foram criados para esse bootstrap, com idempotencia, bind parameters, `--dry-run` sem persistencia e sem `DELETE`. Nesta etapa, nenhum perfil/permissao/vinculo real foi criado e nenhuma operacao foi executada contra banco real.

**Finalidade**: Suportar o endpoint de login e validacao de sessao interna em homologacao usando apenas `mod_auth`.

**Evolucao esperada**: Permissoes para schemas de modulos, como `mod_iluminacao`, devem ser avaliadas apenas quando endpoints internos de negocio forem implementados e testados. Permissoes de aplicacao continuam em `mod_auth.perfis`, `mod_auth.permissoes`, `mod_auth.usuario_perfis` e `mod_auth.perfil_permissoes`; roles PostgreSQL controlam somente acesso tecnico minimo as tabelas.

**Logout e revogacao**: Logout foi implementado no endpoint interno `POST /api/internal/auth/logout`; sessoes revogadas sao marcadas com `revogado_em` preenchido no update, nunca deletadas fisicamente. O cookie `geoportal_internal_session` e limpo no cliente; se Bearer for usado como suporte tecnico/intermediario, a sessao tambem fica invalidada no servidor por revogacao.

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

**Próxima etapa**: Não ampliar automaticamente `geoportal_auth_admin_homolog` para login runtime. Em etapa operacional separada, planejar e criar `geoportal_api_homolog` com a matriz minima prevista acima, inicialmente voltada ao futuro login e validacao de sessao em `mod_auth`.
