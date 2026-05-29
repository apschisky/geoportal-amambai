# Geoportal Backend

Prova de conceito local e segura da futura API do Geoportal de Amambai, iniciando pelo modulo de Iluminacao Publica / Manutencao de Postes.

Esta etapa nao conecta banco de dados, nao implementa autenticacao real, nao usa dados de producao e nao integra com o Geoportal publico em producao.

As decisoes tecnicas para autenticacao interna estao documentadas em `geoportal-vite/docs/INTERNAL-AUTH-TECHNICAL-DECISIONS.md`.

**Decisão arquitetural sobre transporte final de sessão**:

A validação técnica com `Authorization: Bearer` e token retornado no corpo foi aceita apenas para validação intermediária isolada em homologação. Para uso real em navegador por usuários finais, o login interno agora seta cookie `geoportal_internal_session` com HttpOnly, SameSite=Lax, Path `/api/internal` e Secure configurável por ambiente, obrigatório por padrão em produção. SameSite não é tratado como única proteção: rotas internas mutáveis protegidas devem exigir o header `X-Geoportal-Internal-Request: 1`. Bearer continua disponível para testes técnicos e clientes não navegador, mas o fluxo principal de navegador passa a ser cookie HttpOnly.
Implementacao backend: o servico interno de hash/verificacao de senha usando Argon2id foi implementado e validado. O servico interno de sessao opaca/token foi implementado e validado. O repository interno de usuarios foi criado para `mod_auth.usuarios` e o repository interno de sessoes foi criado para operar com `mod_auth.sessoes`, `token_hash`, expiracao e revogacao por `revogado_em`, sem `DELETE`. O service interno de autenticacao/sessao foi implementado em `geoportal-backend/app/services/auth_service.py`, com auditoria e rate limit integrados, sem endpoint. A atualizacao de `ultimo_login_em` foi tornada best effort via try/except controlado; se falhar, a sessao autenticada ja criada permanece valida e a auditoria de sucesso continua sendo registrada, reduzindo risco de inconsistencia no futuro login. O service interno de validacao de sessao autenticada foi criado em `geoportal-backend/app/services/auth_current_session_service.py`; ele resolve sessao ativa a partir de token bruto e `session_secret`, consulta o banco somente por `token_hash` e nao retorna token bruto, `token_hash`, `session_secret`, senha ou `senha_hash`. O service puro de transporte de token foi criado em `geoportal-backend/app/services/auth_token_transport_service.py`; ele extrai token de cookie ou `Authorization: Bearer`, retorna `transport = "cookie"` para cookie válido e `transport = "bearer"` para Bearer válido, marca cookie+bearer simultaneos como ambiguos e não escolhe silenciosamente, e não depende de FastAPI, `Request`, endpoint ou middleware. Token ausente retorna `None`. Authorization malformado, Basic, Bearer sem token ou Bearer com partes extras retornam `is_malformed = True`. Esse service não valida criptograficamente a sessão nem consulta o banco; ele apenas extrai e normaliza o token. A validação real de sessão continua em `auth_current_session_service.py`. `session_secret` invalido e erros de repository/banco sobem como erro interno, sem fallback inseguro. O repository interno de auditoria de login foi criado em `geoportal-backend/app/repositories/auth_login_audit_repository.py` com `record_login_attempt(...)` e `count_recent_failed_attempts(...)`; nao registra senha, token ou session_secret. O service puro de rate limit foi criado em `geoportal-backend/app/services/auth_rate_limit_service.py` com logica que nao revela existencia de usuario.
Validacao: testes locais passaram (298 total). `tests/test_internal_auth_login_router.py` passou com 14 testes de login, cookie, Bearer, smoke e logout; `tests/test_auth_dependencies.py` passou com 15 testes, incluindo cookie seguro e header interno mutavel; `tests/test_auth_login_audit_repository.py` passou com 6 testes; `tests/test_reset_internal_user_password_admin.py` passou com 12 testes; `tests/test_auth_service.py` passou com 26 testes, incluindo validacao de robustez da atualizacao de `ultimo_login_em` com try/except; `tests/test_internal_routes_feature_flag.py` passou com 10 testes; `tests/test_auth_user_repository.py` passou com 9 testes. A dependency FastAPI interna `get_current_authenticated_session(...)` foi criada em `geoportal-backend/app/dependencies/auth_dependencies.py` e valida sessao usando `extract_session_token(...)` e `resolve_authenticated_session(...)`. O router tecnico protegido de smoke foi criado em `geoportal-backend/app/api/routes/internal_auth_smoke.py` com `GET /api/internal/auth/smoke`.

A feature flag `GEOPORTAL_INTERNAL_ROUTES_ENABLED` foi conectada ao app principal em `geoportal-backend/app/main.py` e condiciona os routers internos de autenticacao. O comportamento é fail-closed: ausencia, false, valor invalido ou valor desligado mantêm as rotas `/api/internal/auth/...` fora do app principal. Apenas valores explícitos de ativação permitem incluir o router técnico interno.

Validação operacional:
- `scripts/deploy/backend-restart-validate-service.ps1` foi usado para reiniciar e validar `GeoportalAPIHomologacao` e `GeoportalAPIProducao`.
- Em homologação, `GeoportalAPIHomologacao` foi configurado via NSSM com `GEOPORTAL_INTERNAL_ROUTES_ENABLED=true` e `GEOPORTAL_INTERNAL_SESSION_SECRET` forte apenas no serviço, fora do Git. `.env` não foi alterado.
- A homologação foi reiniciada e validada pelo harness operacional `scripts/deploy/backend-restart-validate-service.ps1 -Environment Homologacao -Restart -Validate`.
- Em homologação, `/api/health`, `/api/public/iluminacao/health` e `/api/version` permaneceram OK.
- Em homologação, `/api/internal/auth/smoke` retornou `401`, confirmando que a rota interna está ativa e protegida.
- Em produção pública, `/api/internal/auth/smoke` continuou retornando `404`, confirmando que a rota interna permanece não exposta.
- A API pública continuou saudável: `/api/health`, `/api/public/iluminacao/health` e `/api/version` retornaram status correto em homologação e produção.

`get_session_secret(...)` le `GEOPORTAL_INTERNAL_SESSION_SECRET` apenas como configuracao futura; nenhum valor real de segredo foi incluido no repositorio e `.env` nao foi alterado. Falhas de autenticacao geram 401 genérico sem revelar se o problema foi token ausente, token malformado, cookie+bearer, sessao expirada, sessao revogada ou usuario inativo. O endpoint interno de login existe somente sob feature flag e seta cookie HttpOnly para navegador, mantendo o token no corpo temporariamente para compatibilidade tecnica. Nao ha CSRF token separado, JWT, middleware global ou endpoint interno de negocio. O usuario `admin.homologacao` existe somente em homologacao, criado por bootstrap administrativo controlado.

Registro atual de endpoint interno: `POST /api/internal/auth/login` foi implementado em `geoportal-backend/app/api/routes/internal_auth_login.py` e incluido apenas quando `GEOPORTAL_INTERNAL_ROUTES_ENABLED` esta ativo. O endpoint recebe `login` e `senha`, chama `auth_service.authenticate_user(...)`, usa `get_session_secret(...)`, retorna 401 generico em falha e, em sucesso, retorna somente `authenticated`, `usuario_id`, `nome`, `login`, `expira_em` e o token opaco bruto retornado pelo service. Em sucesso, tambem seta o cookie `geoportal_internal_session` com o token opaco bruto, HttpOnly, SameSite=Lax, Path `/api/internal`, Max-Age alinhado a expiracao da sessao e Secure configuravel por `GEOPORTAL_INTERNAL_SESSION_COOKIE_SECURE`, com padrao seguro em `production`/`producao`. Ele nao retorna `senha_hash`, `token_hash` ou `session_secret` e nao cria endpoint publico.

Registro atual de logout e protecao mutavel: `POST /api/internal/auth/logout` foi criado sob a mesma feature flag, exige sessao autenticada por cookie ou Bearer e exige o header `X-Geoportal-Internal-Request: 1`. O logout chama `revoke_session(...)`, preenchendo `revogado_em` em `mod_auth.sessoes`, limpa o cookie `geoportal_internal_session` e retorna payload minimo sem token ou hash. O header customizado e a configuracao SameSite=Lax sao a protecao CSRF/equivalente inicial para rotas internas mutaveis; validacao de Origin/Referer permanece etapa complementar futura. Login e GET `/api/internal/auth/smoke` nao exigem esse header. A API publica de Iluminacao nao exige esse header.

Registro operacional de autorizacao interna: o commit `03efa10` Implementa base de autorizacao interna foi aplicado no servidor e validado com pytest completo: 311 passed. O endpoint tecnico `GET /api/internal/auth/me` foi validado em processo isolado de homologacao com `DATABASE_URL` temporaria usando `geoportal_api_homolog`, `GEOPORTAL_INTERNAL_ROUTES_ENABLED`, `GEOPORTAL_INTERNAL_SESSION_SECRET`, `GEOPORTAL_INTERNAL_SESSION_COOKIE_SECURE=false` para TestClient/local e `TEST_INTERNAL_PASSWORD`; todas as variaveis temporarias foram limpas ao final. O primeiro teste de `/me` falhou por falta de `SELECT` em `mod_auth.usuario_perfis`, confirmando a necessidade de ampliar a matriz runtime apenas para leitura das tabelas de autorizacao. Em etapa operacional de homologacao, foram concedidos somente `GRANT SELECT` para `geoportal_api_homolog` em `mod_auth.usuario_perfis`, `mod_auth.perfis`, `mod_auth.perfil_permissoes` e `mod_auth.permissoes`; a validacao confirmou `SELECT=true` e `INSERT=false`, `UPDATE=false`, `DELETE=false` em cada tabela. O teste final sanitizado retornou `login_status=200`, cookie de sessao presente, `me_status=200`, `me_authenticated=True`, `me_usuario_id=7`, `me_permissoes=[]` e ausencia de token, cookie, `senha_hash`, `token_hash`, `session_secret` ou `DATABASE_URL` no corpo. `permissoes=[]` e esperado neste momento porque nenhum perfil/permissao real foi criado ou atribuido ao `admin.homologacao`.

Plano documental do bootstrap de perfis/permissoes iniciais: a proxima etapa operacional deve criar, primeiro em homologacao, o perfil sugerido `Administrador Interno do Geoportal` e as permissoes administrativas iniciais por script administrativo idempotente, com `--dry-run`, testes automatizados e validacao de ambiente, nunca por SQL manual solto. O script deve exigir parametros explicitos como `--login`, usar bind parameters, nao apagar registros, nao duplicar perfis/permissoes/vinculos, criar permissoes e perfil somente se nao existirem, associar permissoes ao perfil quando faltar, atribuir o perfil ao usuario informado quando ainda nao atribuido, nao depender de login hardcoded e nao imprimir senha, token, hash, `session_secret` ou `DATABASE_URL`. Permissoes propostas: `admin.usuarios.ler`, `admin.usuarios.criar`, `admin.usuarios.bloquear`, `admin.usuarios.redefinir_senha`, `admin.usuarios.atribuir_perfis`, `admin.perfis.ler`, `admin.perfis.gerenciar`, `admin.permissoes.ler`, `admin.permissoes.gerenciar` e `internal.auth.me`. Em homologacao, o perfil sera atribuido ao `admin.homologacao`; esse administrador funcional nao e superuser de banco e nao recebe permissoes PostgreSQL especiais por ser administrador da aplicacao. A role runtime `geoportal_api_homolog` continua apenas lendo permissoes; bootstrap pode exigir role administrativa operacional controlada, como `geoportal_auth_admin_homolog`, com permissoes temporarias e revogacao quando aplicavel.

Implementacao local do bootstrap de perfis: `scripts/admin/bootstrap_internal_admin_profile.py` foi criado com `--login` obrigatorio e `--dry-run` sem conexao/persistencia, usando repository administrativo idempotente em `app/repositories/auth_admin_profile_repository.py`. O script garante o perfil `Administrador Interno do Geoportal`, as permissoes administrativas iniciais e os vinculos necessarios, sempre com bind parameters, sem `DELETE`, sem interpolar valores na SQL e sem depender de login hardcoded. Nesta etapa, ele nao foi executado contra banco real, nao criou perfil/permissao/vinculo real, nao alterou schema, nao criou endpoint e nao alterou producao.

Validacao operacional do bootstrap de perfis em homologacao: o commit `5a4d2bf` Adiciona bootstrap de perfil administrativo foi aplicado no servidor e validado com pytest completo: 327 passed. Antes da operacao, foram realizados backup de roles e backup custom do banco de homologacao. O dry-run retornou "Dry-run validado. Nenhum perfil, permissao ou vinculo foi alterado."; a execucao real retornou "Bootstrap do perfil administrativo interno concluido com sucesso.". Em homologacao, foram criados/validados o perfil `administrador-interno-geoportal` (`Administrador Interno do Geoportal`, ativo), 10 permissoes administrativas ativas, 10 vinculos perfil-permissao e o vinculo global `admin.homologacao` -> `administrador-interno-geoportal` com `modulo NULL`. A role operacional `geoportal_auth_admin_homolog` recebeu permissoes temporarias controladas de `SELECT`/`INSERT` nas tabelas de autorizacao e `USAGE`/`SELECT` temporarios nas sequences `perfis_id_seq` e `permissoes_id_seq`; apos a operacao, `INSERT` e permissoes de sequence foram revogadas, mantendo estado final com `SELECT=true`, `INSERT=false`, `UPDATE=false`, `DELETE=false` nas tabelas de autorizacao. A validacao de `/api/internal/auth/me` com `geoportal_api_homolog` confirmou 10 permissoes esperadas para `admin.homologacao`, sem retornar token, cookie, `senha_hash`, `token_hash`, `session_secret` ou `DATABASE_URL`. Producao, NSSM, `.env` versionado e frontend nao foram alterados.

Endpoint tecnico de permissao: `GET /api/internal/auth/permission-smoke` foi criado sob `GEOPORTAL_INTERNAL_ROUTES_ENABLED` para validar `require_permission("internal.auth.me")` em rota real. Ele exige sessao autenticada, exige a permissao `internal.auth.me`, nao exige header mutavel por ser GET tecnico de consulta e retorna apenas `authorized`, `permission` e `usuario_id`. Falha sem sessao retorna 401 generico; sessao sem permissao retorna 403 generico; sucesso retorna 200. O endpoint nao retorna token, cookie, senha, `senha_hash`, `token_hash`, `session_secret`, `DATABASE_URL`, SQL, role ou GRANT, nao usa regra hardcoded por login e nao cria endpoint administrativo real.

Validacao operacional do permission-smoke em homologacao: o commit `251cf65` Adiciona smoke de permissao interna foi aplicado no servidor e validado com pytest completo: 335 passed. A validacao ocorreu em processo isolado de homologacao com variaveis temporarias; todas foram limpas ao final. Sem sessao, o endpoint retornou 401 com `{'detail': 'Not authenticated'}`. Com admin.homologacao autenticado (que possui a permissao internal.auth.me), o endpoint retornou 200 autorizado. Resultado sanitizado: `login_status=200`, `login_set_cookie=True`, `cookie_jar_tem_sessao=True`, `permission_status=200`, `permission_authorized=True`, `permission_code=internal.auth.me`, `permission_usuario_id=7`. A resposta nao expôs token, cookie, `senha_hash`, `token_hash`, `session_secret`, `DATABASE_URL`, SQL, role ou GRANT. Producao, NSSM, `.env` versionado e frontend nao foram alterados.

Registro atual de ferramenta administrativa: `scripts/admin/reset_internal_user_password.py` foi criado para redefinir senha de usuario interno existente por `login`, em etapa operacional controlada. O script le e confirma a nova senha somente via `getpass`, nao aceita senha ou hash por argumento CLI, gera hash Argon2id apenas em memoria e nao imprime senha ou hash. O modo `--dry-run` valida entrada e senha sem conectar ao banco e sem persistir. Fora de `--dry-run`, o repository administrativo atualiza somente `senha_hash` e `atualizado_em` em `mod_auth.usuarios` por `lower(login) = lower(:login)`, com bind parameters, retornando erro controlado se o login nao existir. Esta etapa nao criou endpoint, migration, usuario real, role, GRANT, seed, cookie, CSRF/JWT ou alteracao de schema; producao nao foi alterada.

Para metodologia e validação de engenharia, consulte `geoportal-vite/docs/PROJECT-ENGINEERING-METHOD.md` e `geoportal-vite/docs/SECURE-DEVELOPMENT-HARNESS.md`.
Registro atual: o bootstrap do script administrativo `scripts/admin/create_internal_user.py` foi corrigido. O script agora calcula a raiz `geoportal-backend` a partir de `__file__` e ajusta `sys.path` antes dos imports de `app.*`, permitindo a execução direta a partir da raiz `geoportal-backend` sem `PYTHONPATH` manual. O script le a senha via `getpass`, pede confirmacao, rejeita senha vazia, usa Argon2id por `hash_password(...)` e nao aceita senha por argumento de linha de comando. O modo `--dry-run` valida entradas, gera hash apenas em memoria, nao conecta ao banco, nao persiste usuario e nao imprime senha ou hash. Foi criado repository administrativo testavel para `mod_auth.usuarios`, usando bind parameters e recebendo apenas `senha_hash`, nunca senha bruta. Esta etapa nao foi executada contra banco real, nao criou usuario operacional, nao criou seed, nao criou migration, nao criou endpoint, nao criou cookie, nao criou JWT e nao alterou `.env`. Localmente, `tests/test_create_internal_user_admin.py` passou com 12 testes e a suite completa local passou com 257 testes. No servidor, git pull aplicado; `tests/test_create_internal_user_admin.py` passou com 12 testes e a suite completa no servidor passou com 257 testes. No servidor, o dry-run foi validado sem `PYTHONPATH` manual usando `python scripts/admin/create_internal_user.py --login "admin.homologacao" --email "admin.homologacao@example.test" --nome "Administrador Homologacao" --dry-run`; o script pediu senha via `getpass` e retornou: "Dry-run validado. Nenhum usuario foi criado." Homologação e produção foram reiniciadas e validadas pelo harness operacional `scripts/deploy/backend-restart-validate-service.ps1 -Environment Homologacao -Restart -Validate` e `-Environment Producao -Restart -Validate -CheckPublicProxy`; a API pública continuou saudável. A criacao operacional deve ocorrer primeiro em homologacao, em etapa futura, com operador humano; nao usar migration ou seed para credencial operacional.

Atualizacao de autenticacao interna: o identificador obrigatorio do usuario interno passa a ser `login`; `email` e opcional e nao deve ser requisito para criacao ou autenticacao. A migration `0010_make_auth_user_email_optional.sql` foi criada para tornar `mod_auth.usuarios.email` nullable e trocar a unicidade de e-mail para indice unico parcial apenas quando `email IS NOT NULL`, mantendo `login` obrigatorio e unico por comparacao case-insensitive. O script administrativo `scripts/admin/create_internal_user.py` agora exige `--login` e `--nome`, aceita `--email` opcional, le senha somente via `getpass`, nao aceita `--password` e preserva `--dry-run` sem banco e sem persistencia. O repository de autenticacao busca o usuario por `login`; permissoes futuras devem se vincular ao usuario por `id` e, quando necessario para exibicao/auditoria, por `login`, nunca por e-mail. Naquela etapa, nenhum usuario real foi criado, nenhum endpoint de login foi criado, nenhum cookie/CSRF/JWT foi criado, nenhum segredo foi incluido e nenhum dado sensivel foi adicionado ao Git.

Validacao da etapa 0010:

Testes automatizados:
- `tests/test_auth_service.py` passou com 26 testes localmente e no servidor, incluindo validação de robustez da atualização best effort de `ultimo_login_em`.
- `tests/test_auth_user_repository.py` passou com 9 testes localmente e no servidor.
- `tests/test_create_internal_user_admin.py` passou com 17 testes localmente e no servidor.
- Suite completa passou localmente com 269 testes apos a criacao do endpoint interno de login.

Validacao operacional (harness):
- A migration `0010_make_auth_user_email_optional.sql` foi aplicada em homologacao com backup manual validado.
- A migration `0010` foi aplicada no banco ativo de producao com backup manual validado.
- Em homologacao e producao, `email` foi alterado para `NULL` em `mod_auth.usuarios`.
- Em homologacao e producao, `ux_mod_auth_usuarios_email_lower` foi recreado como indice unico parcial com `WHERE email IS NOT NULL`.
- Em homologacao e producao, `ux_mod_auth_usuarios_login_lower` permanece como indice unico obrigatorio.
- Comentarios foram validados em homologacao e producao.
- Tabelas `mod_auth.usuarios`, `mod_auth.sessoes` e `mod_auth.login_auditoria` permaneceram vazias apos a criacao em homologacao e producao.
- A API publica continuou saudavel: `/api/health`, `/api/public/iluminacao/health` e `/api/version` retornaram status correto em homologacao e producao.
- Homologacao e producao foram reiniciadas e validadas pelo harness operacional `scripts/deploy/backend-restart-validate-service.ps1 -Environment Homologacao -Restart -Validate` e `-Environment Producao -Restart -Validate -CheckPublicProxy`.
- Naquela etapa, nenhum usuario real, seed, endpoint, sessao, cookie ou login funcional foi criado.

Bootstrap operacional de autenticacao interna concluído:

A role PostgreSQL `geoportal_auth_admin_homolog` foi criada em homologacao com sucesso para permitir bootstrap seguro de usuarios internos. O primeiro usuario administrativo `admin.homologacao` foi criado e validado:

- Backup do banco realizado via `pg_dumpall -g` antes de qualquer operacao.
- Role `geoportal_auth_admin_homolog` criada manualmente com permissoes minimas em `mod_auth`:
  - CONNECT ao banco de homologacao
  - USAGE no schema `mod_auth`
  - SELECT e INSERT em `mod_auth.usuarios`
  - USAGE e SELECT na sequence `mod_auth.usuarios_id_seq`
  - Sem DELETE, UPDATE ou CREATE
- Primeiro usuario `admin.homologacao` criado via `scripts/admin/create_internal_user.py`:
  - Login: `admin.homologacao`
  - Nome: `Administrador Homologacao`
  - Email: `NULL` (opcional, conforme especificado)
  - Ativo: `true`
  - Hash de senha: Argon2id, nao incluido no Git nem em logs
- Permissoes validadas: conexao bem-sucedida, insercao confirmada em `mod_auth.usuarios`, sequence avancou corretamente
- Servico reiniciado e validado:
  - `/api/health` OK
  - `/api/public/iluminacao/health` OK
  - `/api/version` OK
  - Nenhuma endpoint interna criada nesta etapa
  - Nenhuma sessao ou token criado
  - Nenhuma alteracao em `.env` ou migration
- Producao nao foi alterada; todas as operacoes restritas a homologacao
- Proxima etapa: nao ampliar `geoportal_auth_admin_homolog` automaticamente; planejar `geoportal_api_homolog` como futura role runtime da API interna em homologacao, com matriz minima documentada em `geoportal-backend/db/security/README.md`, sem criacao real nesta etapa

Validacao operacional de reset de senha e login interno em homologacao (processo isolado):

Commits no servidor: `0baeeca` Corrige filtros opcionais da auditoria de login; `8431e0e` Adiciona reset administrativo de senha interna; `3ebfc4f` Adiciona endpoint interno de login.

Testes no servidor: `tests/test_auth_login_audit_repository.py` passou com 6 testes; `tests/test_auth_service.py` passou com 26 testes; `tests/test_internal_auth_login_router.py` passou com 5 testes; pytest completo passou com 283 testes.

Reset da senha em homologacao: O script administrativo `scripts/admin/reset_internal_user_password.py` redefiniu a senha do usuario `admin.homologacao` em homologacao via etapa controlada:
- Role `geoportal_auth_admin_homolog` recebeu GRANT UPDATE temporario em `mod_auth.usuarios` para permitir atualizacao de `senha_hash` e `atualizado_em`.
- Reset executado com o script administrativo (sem imprimir senha ou hash).
- Apos o reset, REVOKE UPDATE foi executado, restringindo a role novamente apenas para SELECT e INSERT.
- Validacao final confirmou: SELECT true, INSERT true, UPDATE false, DELETE false.
- Nenhuma alteracao em schema, migration ou producao.

Validacao real do login interno: Foi realizada validacao com processo isolado em homologacao:
- Role `geoportal_api_homolog` foi criada em homologacao com permissoes runtime minimas: CONNECT, USAGE mod_auth, SELECT/INSERT mod_auth.sessoes, SELECT mod_auth.usuarios.
- Processo isolado foi executado com variaveis temporarias: DATABASE_URL apontando para geoportal_api_homolog + homologacao, GEOPORTAL_INTERNAL_ROUTES_ENABLED=true, GEOPORTAL_INTERNAL_SESSION_SECRET temporario, TEST_INTERNAL_PASSWORD temporario.
- NSSM / servico Windows nao foi alterado nesta etapa; validacao foi isolada.
- Todas as variaveis temporarias foram limpas apos o teste.
- Resultado sanitizado do teste (sem token real, sem hash, sem session_secret):
  - POST /api/internal/auth/login status=200, authenticated=True, usuario_id=7, login=admin.homologacao, tem_token=True.
  - GET /api/internal/auth/smoke (usando token do login) status=200, authenticated=True, usuario_id=7, tem_sessao_id=True.
- Contadores apos teste: mod_auth.usuarios=1, mod_auth.sessoes=1, mod_auth.login_auditoria=1.
- Nenhuma alteracao em producao, NSSM, .env versionado, migration, endpoint adicional ou exposicao de senha/token/hash/segredo.

Proxima etapa recomendada: Decidir transporte final de sessao para uso real com usuarios finais (preferencialmente cookie HttpOnly + Secure + SameSite); planejar CSRF se necessario; nao liberar tela interna para usuarios antes dessa decisao; depois implementar autorizacao por modulo/perfil/permissao.

Validacao operacional de cookie HttpOnly, logout e protecao mutavel inicial em homologacao (processo isolado):

Commit validado no servidor: `eaf5724` Implementa cookie e logout internos.

Testes no servidor: pytest completo passou com 298 testes.

Validacao executada em processo isolado, sem alterar NSSM, sem alterar producao e sem alterar `.env` versionado. Foram usadas variaveis temporarias apenas no processo de teste: `DATABASE_URL` temporaria com `geoportal_api_homolog`, `GEOPORTAL_INTERNAL_ROUTES_ENABLED`, `GEOPORTAL_INTERNAL_SESSION_SECRET`, `GEOPORTAL_INTERNAL_SESSION_COOKIE_SECURE=false` para TestClient/local e `TEST_INTERNAL_PASSWORD`. Todas as variaveis temporarias foram limpas apos o teste.

Resultado sanitizado do login:
- `login_status=200`
- `login_authenticated=True`
- `login_usuario_id=7`
- `login_login=admin.homologacao`
- `login_tem_token_no_corpo=True`
- `login_set_cookie=True`
- `cookie_jar_tem_sessao=True`
- `cookie_httponly=True`
- `cookie_samesite_lax=True`
- `cookie_path_internal=True`

Resultado sanitizado do smoke autenticado por cookie:
- `smoke_cookie_status=200`
- `smoke_authenticated=True`
- `smoke_usuario_id=7`
- `smoke_tem_sessao_id=True`

Protecao mutavel inicial validada:
- `POST /api/internal/auth/logout` sem header retornou 403.
- Header exigido: `X-Geoportal-Internal-Request: 1`.
- `POST /api/internal/auth/login` nao exige esse header.
- `GET /api/internal/auth/smoke` nao exige esse header.

Resultado sanitizado do logout:
- `logout_status=200`
- `logout_logged_out=True`
- `logout_limpa_cookie=True`
- `cookie_jar_tem_sessao_apos_logout=False`
- `smoke_apos_logout_status=401`

Contagens apos teste:
- `mod_auth.usuarios=1`
- `mod_auth.sessoes=2`
- `mod_auth.login_auditoria=2`
- `sessoes_revogadas=1`

Confirmacoes da validacao: cookie HttpOnly, SameSite=Lax, Path `/api/internal`, sessao opaca, revogacao logica por `revogado_em`, sem DELETE fisico, Bearer ainda disponivel como suporte tecnico/intermediario e cookie como transporte principal planejado para navegador. Nenhuma senha, token real, cookie real, hash, `token_hash`, `session_secret`, `DATABASE_URL` real, IP, host ou segredo foi registrado.

Proximos passos: decidir quando remover o token do corpo da resposta ou restringi-lo a ambiente tecnico; planejar validacao de Origin/Referer como camada complementar; planejar endpoints internos de negocio somente apos autorizacao por perfis/permissoes; nao liberar tela interna para usuarios reais antes de fechar autorizacao e frontend seguro.

Arquitetura funcional de autorizacao: apos a validacao de autenticacao/sessao, a proxima fase segura e implementar autorizacao por usuarios, perfis, permissoes, modulos e acoes, nao tela/frontend. O backend deve buscar permissoes efetivas em `mod_auth`, expor service `has_permission(usuario_id, permissao)` e dependency `require_permission("permissao")`, sem regra hardcoded como `login == "admin.homologacao"`. O administrador funcional pode criar/bloquear usuarios, redefinir senha e atribuir perfis em etapa futura, mas nao deve ser superuser de banco. Usuarios de modulo, como Iluminacao Publica, devem acessar somente o modulo e as acoes permitidas. O primeiro modulo pratico previsto e Iluminacao Publica, mas endpoints de negocio e tela interna so devem vir depois da autorizacao base validada em homologacao.

Base tecnica de autorizacao implementada: foi criado repository para permissoes efetivas em `app/repositories/auth_permission_repository.py`, service `app/services/auth_permission_service.py` com `get_user_permissions(...)` e `has_permission(...)`, dependency `require_permission("permissao")` em `auth_dependencies.py` e endpoint tecnico `GET /api/internal/auth/me` sob feature flag. O endpoint `/me` exige sessao autenticada e retorna apenas `authenticated`, `usuario_id` e `permissoes` ordenadas, sem token, cookie, `senha_hash`, `token_hash`, `session_secret` ou `DATABASE_URL`. Nenhum perfil, permissao, usuario, seed, role, GRANT, migration, schema novo, endpoint administrativo real, tela, producao, NSSM ou `.env` foi alterado nesta etapa. `admin.homologacao` ainda precisara receber perfil/permissoes por etapa operacional posterior em homologacao. Testes locais passaram com 311 testes.

Harness operacional seguro: `scripts/deploy/backend-restart-validate-service.ps1` reinicia e valida servicos da API apenas quando executado explicitamente. Ele nao faz deploy, `git pull`, migrations, alteracao de banco, alteracao de `.env`, instalacao de dependencias ou alteracao de Apache/proxy. Em producao, restart exige confirmacao interativa ou `-Force`.

## Como preparar o ambiente

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt -r requirements-dev.txt
```

## Como rodar localmente

```powershell
uvicorn app.main:app --reload
```

## Como executar testes

```powershell
pytest
```

## Configuracao de banco

A conexao com PostgreSQL/PostGIS usa `DATABASE_URL` em arquivo `.env` local ou variavel de ambiente.

O arquivo `.env` real nao deve ser versionado. Use `.env.example` apenas como referencia com placeholders:

```text
DATABASE_URL=postgresql+psycopg://<USER>:<PASSWORD>@<HOST>:<PORT>/<DATABASE>
PERSIST_SOLICITACOES=false
```

Credenciais de banco nunca devem ir para o front-end, Vite ou `dist`. A API roda separada do build do front-end.

`PERSIST_SOLICITACOES` controla a persistencia real:

- `false`: mantem o endpoint em modo simulado, sem gravar no banco, com protocolo fixo de POC/testes.
- `true`: usa o repository e `DATABASE_URL` para gravar em `mod_iluminacao.solicitacoes`, com protocolo gerado pela sequence `mod_iluminacao.solicitacoes_protocolo_seq`.

A sequence do banco evita duplicidade em cenarios concorrentes. Em homologacao/producao, ative apenas apos banco, usuario restrito e testes validados.

A persistencia real com protocolo por sequence ja foi validada em homologacao. Mantenha `PERSIST_SOLICITACOES=false` por padrao e ative `true` somente em ambiente controlado.

Se houver falha temporaria de banco em modo persistente, o endpoint publico retorna `503` com mensagem segura. Detalhes tecnicos, SQL, stack trace e credenciais nao sao expostos ao cidadao.

O retorno `503` seguro para indisponibilidade temporaria de banco foi validado manualmente em ambiente controlado, sem registrar detalhes sensiveis.

O endpoint publico possui rate limit inicial em memoria. O padrao e 5 solicitacoes por IP em 10 minutos; em producao futura, avaliar solucao persistente ou distribuida, como reverse proxy, Redis, WAF ou API gateway.

O retorno `429` do rate limit foi validado manualmente em ambiente controlado. O padrao planejado e 5 solicitacoes por IP em 10 minutos.

O envio real controlado pelo front-end do Geoportal tambem foi validado em homologacao com ativacao temporaria por flags e `PERSIST_SOLICITACOES=true`. A API retornou `201 Created`, o front-end exibiu sucesso com protocolo/status e a gravacao foi confirmada em `mod_iluminacao.solicitacoes`, sem registrar dados reais na documentacao. Apos validacoes, mantenha `enabled=false`, `submitEnabled=false` e `PERSIST_SOLICITACOES=false` por padrao; limpe registros de teste e mantenha o Google Forms como fallback.

O endpoint publico `POST /api/public/iluminacao/consulta` foi criado para consulta por protocolo, com protocolo e dado complementar minimo de confirmacao. Nesta etapa, a confirmacao usa os ultimos 4 digitos do contato informado. A resposta e limitada a protocolo, status, status publico, datas publicas e mensagem segura, sem expor dados pessoais, contato, observacoes internas, detalhes administrativos, id interno, geometria, logs, SQL ou dados tecnicos de banco. O endpoint possui testes automatizados e foi validado manualmente em ambiente controlado, mantendo resposta generica para protocolo inexistente ou confirmacao invalida.

Antes de qualquer ativacao publica da API de Iluminacao, siga o checklist `geoportal-vite/docs/ILUMINACAO-CONTROLLED-ACTIVATION-CHECKLIST.md`. O padrao seguro deve manter `enabled=false`, `submitEnabled=false`, `consultaEnabled=false` e `PERSIST_SOLICITACOES=false`, com Google Forms como fallback.

O plano de implantacao em servidor esta em `geoportal-vite/docs/API-SERVER-DEPLOYMENT-PLAN.md`. A decisao arquitetural e implantar a API no servidor PostgreSQL/PostGIS como servico controlado, com variaveis reais fora do Git, usuario restrito de banco e uso operacional do schema `mod_iluminacao`, sem gravar em `plano` ou `web_map`.

Registro de homologacao: a API foi implantada no servidor PostgreSQL/PostGIS como servico Windows controlado, escutando apenas em `127.0.0.1:8000`. Os testes automatizados, healthchecks, solicitacao simulada e consulta inexistente com `404` seguro foram validados no servidor. `PERSIST_SOLICITACOES=false` permanece como padrao seguro; a exposicao controlada ocorre via Apache HTTPS em `/api/`.

Registro de proxy/HTTPS: o Apache HTTPS foi configurado para encaminhar `/api/` ao servico local da API em `127.0.0.1:8000`. Healthcheck, health de Iluminacao, versao, criacao simulada com `PERSIST_SOLICITACOES=false` e consulta inexistente com `404` seguro foram validados via HTTPS. GeoServer e Geoportal publico permaneceram funcionando. CORS foi validado para a origem oficial do Geoportal, com `ALLOWED_ORIGINS` real fora do Git e sem wildcard. A API experimental seguira temporariamente em `https://geoserver.amambai.ms.gov.br/api/`, acessada pelo front-end oficial em `https://geoportal.amambai.ms.gov.br` por CORS restrito. A opcao `https://geoportal.amambai.ms.gov.br/api/` fica para evolucao futura de infraestrutura. A ativacao publica permanente do botao da API ainda depende de revisao operacional e aprovacao gradual; Google Forms permanece fallback.

Registro de teste do front-end publicado: o Geoportal publicado foi testado em build controlado com o botao experimental da API habilitado temporariamente. A chamada HTTPS para a API no dominio tecnico do GeoServer funcionou com CORS restrito para a origem oficial e o envio simulado retornou sucesso no modal. Como `PERSIST_SOLICITACOES=false` estava ativo, nao houve gravacao real; a conferencia posterior no banco confirmou ausencia de novo registro. As flags temporarias devem voltar para `false` apos testes e nao devem ser commitadas como `true`. A chave correta para o endpoint de envio e `apiUrl`; erro de grafia pode gerar chamada para `/undefined`.

Registro de persistencia em homologacao: o fluxo completo foi validado com `PERSIST_SOLICITACOES=true` ativado temporariamente fora do Git. O servico de homologacao foi reiniciado, o healthcheck permaneceu ok, o front-end publicado enviou solicitacao real via HTTPS, a API gravou registros no banco de homologacao e a consulta publica por protocolo funcionou. O bloqueio `409 Conflict` por duplicidade ativa no mesmo poste retornou mensagem amigavel, o rate limit foi acionado em testes intensivos e o usuario restrito da API nao conseguiu executar `DELETE`. A limpeza dos registros de teste exigiu usuario administrativo. Ao final, `PERSIST_SOLICITACOES=false` foi restaurado; `enabled=false`, `submitEnabled=false` e `consultaEnabled=false` devem permanecer no repositorio. Google Forms permanece fallback.

Registro de preparacao e pre-producao: o banco ativo recebeu a estrutura `mod_iluminacao` apos backup manual validado como legivel. Foram criadas a tabela `mod_iluminacao.solicitacoes` e as sequences `mod_iluminacao.solicitacoes_id_seq` e `mod_iluminacao.solicitacoes_protocolo_seq`. Um usuario restrito de producao foi criado e validado sem registrar senha ou `DATABASE_URL` real; ele possui permissoes minimas para conexao, uso do schema, leitura/insercao na tabela e uso/leitura das sequences, sem `UPDATE` e sem `DELETE`. O arquivo real de ambiente de producao foi criado fora do Git, com `PERSIST_SOLICITACOES=false`. O servico Windows `GeoportalAPIProducao` foi criado e iniciado em `127.0.0.1:8001`, separado da homologacao em `127.0.0.1:8000`. O healthcheck de producao passou, o `POST` simulado retornou sucesso e nao gravou no banco ativo, que permaneceu sem solicitacoes reais criadas pela API. Em pre-producao, apos backup do arquivo ativo do Apache, validacao `Syntax OK` e reinicio bem-sucedido, o Apache publico `/api/` passou a apontar para `GeoportalAPIProducao`. `/api/version` via HTTPS retornou ambiente `producao`, o health publico de Iluminacao retornou ok, `POST` via HTTPS e pelo front-end publicado retornou protocolo simulado, CORS restrito permitiu a origem oficial e bloqueou origem invalida com `400`, e Geoportal publico, GeoServer e camadas continuaram funcionando. Naquele momento, a API ainda nao estava com gravacao real ativa no banco de producao. Google Forms permaneceu fallback.

Registro de ativacao real controlada em producao: `PERSIST_SOLICITACOES=true` foi ativado no ambiente real fora do Git e `GeoportalAPIProducao` foi reiniciado. O front-end publicado enviou solicitacao real por poste e por ponto manual. A consulta publica dos protocolos gerados funcionou, e o bloqueio de duplicidade ativa por poste retornou mensagem amigavel. O botao Tracar rota, o botao de solicitacao via Google Forms, o Geoportal publico, o GeoServer e as camadas permaneceram funcionando. Google Forms permanece como fallback durante o periodo de transicao. A proxima evolucao recomendada e o modulo interno para triagem, acompanhamento e encerramento das solicitacoes, com plano inicial em `geoportal-vite/docs/ILUMINACAO-INTERNAL-MODULE-PLAN.md`.

O desenho conceitual das futuras tabelas internas de historico/auditoria e observacoes esta em `geoportal-vite/docs/ILUMINACAO-INTERNAL-DATA-MODEL.md`.

A migration `0004_create_iluminacao_solicitacoes_historico.sql` foi criada para a tabela interna de historico/auditoria, com rollback correspondente. Sua aplicacao deve ocorrer somente com backup, validacao e autorizacao operacional.

A migration `0005_create_iluminacao_solicitacoes_observacoes.sql` foi criada para a tabela interna de observacoes operacionais, com rollback correspondente. Observacoes internas nao devem aparecer na consulta publica, e a visibilidade `publica_futura` e apenas reserva conceitual, sem exposicao automatica ao cidadao.

As migrations internas `0004` e `0005` foram aplicadas e validadas em homologacao, apos backup manual validado. As tabelas internas foram criadas, FKs restritivas foram testadas, inserts controlados funcionaram e os registros de teste foram removidos, deixando as tabelas internas vazias.

As migrations internas `0004` e `0005` tambem foram aplicadas no banco ativo de producao apos backup manual validado como legivel. Antes da aplicacao, o banco ativo possuia apenas `mod_iluminacao.solicitacoes` entre as tabelas internas. Apos a aplicacao, `mod_iluminacao.solicitacoes_historico` e `mod_iluminacao.solicitacoes_observacoes` foram criadas, os indices foram validados e as FKs restritivas para `mod_iluminacao.solicitacoes(id)` foram confirmadas com `ON UPDATE RESTRICT` e `ON DELETE RESTRICT`. A API publica continuou saudavel, `/api/version` continuou retornando ambiente `producao` e as tabelas internas permaneceram vazias apos a criacao. Ainda nao ha endpoints internos nem tela interna usando essas tabelas; a proxima etapa e desenhar endpoints internos protegidos para status, historico e observacoes.

O desenho conceitual dos endpoints internos protegidos esta em `geoportal-vite/docs/INTERNAL-AUTHORIZATION-PLAN.md`. Endpoints internos ainda nao foram implementados e devem exigir autenticacao, autorizacao no backend e auditoria antes de qualquer publicacao.

O modelo conceitual transversal de autenticacao/autorizacao para futuros modulos internos esta em `geoportal-vite/docs/INTERNAL-AUTH-DATA-MODEL.md`.

O plano tecnico das migrations do schema `mod_auth` esta em `geoportal-vite/docs/INTERNAL-AUTH-MIGRATIONS-PLAN.md`.

O plano de threat model, controles e validacao para implementar autenticacao backend com seguranca esta em `geoportal-vite/docs/INTERNAL-AUTH-SECURITY-IMPLEMENTATION-PLAN.md`.

A revisao defensiva da API publica atual esta em `geoportal-vite/docs/PUBLIC-API-SECURITY-REVIEW.md`.

Registro atual: a migration `0006_create_mod_auth_schema.sql` foi aplicada em homologacao e no banco ativo de producao apos backup manual validado. O schema `mod_auth` foi criado com comentario validado, e nenhuma tabela foi criada nesta etapa. O rollback `0006_drop_mod_auth_schema.sql` permanece disponivel para ambiente controlado.

Registro atual: a migration `0007_create_mod_auth_usuarios.sql` foi aplicada e validada em homologacao e no banco ativo de producao apos backup manual validado. A tabela `mod_auth.usuarios` foi criada, indices foram validados e a tabela permaneceu vazia em producao apos a criacao. Nenhum usuario real, seed, GRANT, trigger, funcao, endpoint ou login funcional foi criado.

Registro atual: a migration `0008_create_mod_auth_perfis_permissoes.sql` foi aplicada e validada em homologacao e no banco ativo de producao apos backup manual validado. As tabelas de perfis, permissoes e vinculos foram criadas, indices e FKs restritivas foram validados, dados ficticios foram removidos em homologacao e todas as tabelas `mod_auth` permaneceram vazias apos a criacao em producao. Nenhum usuario, perfil real, permissao real, vinculo real, seed, GRANT, trigger, funcao, endpoint ou login funcional foi criado.

Registro atual: a migration `0009_create_mod_auth_sessoes_login_auditoria.sql` foi aplicada e validada em homologacao e no banco ativo de producao apos backup manual validado. As tabelas `mod_auth.sessoes` e `mod_auth.login_auditoria` foram criadas, indices e FKs restritivas foram validados, dados ficticios foram removidos em homologacao e todas as tabelas `mod_auth` permaneceram vazias apos a criacao em producao. Nenhum login funcional, endpoint, usuario real, token real, sessao real, auditoria real, seed, GRANT, trigger ou funcao foi criado. A base estrutural inicial do schema `mod_auth` esta concluida; a proxima etapa deve planejar e implementar autenticacao backend com testes, sem criar acesso interno publico sem autenticacao.

Registro atual: a migration `0010_make_auth_user_email_optional.sql` foi criada para alinhar o Geoportal Interno ao login obrigatorio sem e-mail obrigatorio. Ela altera apenas a estrutura de `mod_auth.usuarios`: remove `NOT NULL` de `email`, recria `ux_mod_auth_usuarios_email_lower` como indice unico parcial para e-mails informados e atualiza comentarios de `email` e `login`. Ela nao cria usuario real, seed, endpoint, sessao, cookie, CSRF, JWT, GRANT, trigger ou funcao.

## Endpoints disponiveis

- `GET /api/health`
- `GET /api/version`
- `GET /api/public/iluminacao/health`
- `POST /api/public/iluminacao/solicitacoes`
- `POST /api/public/iluminacao/consulta`

Nao ha endpoints internos publicos implementados nesta etapa.
Endpoints internos de autenticacao existem apenas quando `GEOPORTAL_INTERNAL_ROUTES_ENABLED` esta ativo:

- `GET /api/internal/auth/smoke`
- `POST /api/internal/auth/login`
- `POST /api/internal/auth/logout`
- `GET /api/internal/auth/me`
- `GET /api/internal/auth/permission-smoke`

Essas rotas nao fazem parte da API publica e permanecem fora do app principal quando a feature flag esta desligada.

### Exemplo de solicitacao publica simulada com poste no mapa

```json
{
  "localizacao_tipo": "poste_mapa",
  "poste_id": "POSTE-001",
  "coordenada": {
    "latitude": -23.105,
    "longitude": -55.225
  },
  "tipo_problema": "lampada_apagada",
  "descricao": "Lampada apagada durante a noite.",
  "ponto_referencia": "Proximo a praca central.",
  "observacoes_localizacao": null,
  "nome_solicitante": "Solicitante de teste",
  "contato_solicitante": "contato de teste"
}
```

### Exemplo de solicitacao publica simulada com ponto manual

```json
{
  "localizacao_tipo": "ponto_manual",
  "poste_id": null,
  "coordenada": {
    "latitude": -23.106,
    "longitude": -55.226
  },
  "tipo_problema": "poste_danificado",
  "descricao": "Poste nao encontrado no mapa.",
  "observacoes_localizacao": "Pin marcado manualmente no local do poste.",
  "nome_solicitante": "Solicitante de teste",
  "contato_solicitante": "contato de teste"
}
```

Quando o poste nao estiver no mapa, use `localizacao_tipo = "ponto_manual"` e envie a coordenada marcada no mapa com `observacoes_localizacao` ou `ponto_referencia`.

Na primeira versao, `nome_solicitante` e `contato_solicitante` sao obrigatorios porque nao havera login do cidadao e a equipe pode precisar confirmar a localizacao ou detalhes do chamado. Esses dados nao devem ser expostos em mapas ou views publicas.

Com `PERSIST_SOLICITACOES=false`, o endpoint `POST /api/public/iluminacao/solicitacoes` permanece simulado: ele valida o payload e retorna um protocolo ficticio, mas nao grava em banco de dados. Dados reais ainda nao devem ser enviados para esta prova de conceito.

Com `PERSIST_SOLICITACOES=true`, o service usa repository com SQLAlchemy Core para persistir a solicitacao e gerar protocolo pela sequence do banco. A coordenada recebida pela API em EPSG:4326 sera transformada pelo PostGIS para `geometry(Point, 32721)`.

Em modo persistente, o repository marca `duplicidade_suspeita` quando houver solicitacao ativa semelhante nas ultimas 24h para o mesmo poste. Nesta etapa, a solicitacao nao e bloqueada.

A marcacao `duplicidade_suspeita` foi validada em homologacao: a regra inicial apenas encaminha a situacao para triagem interna e nao bloqueia o cidadao.

Regra implementada: para `localizacao_tipo = poste_mapa`, se ja existir solicitacao ativa para o mesmo `poste_id`, o endpoint nao cria nova solicitacao e retorna `409 Conflict`. Status ativos: `aberta`, `em_triagem`, `encaminhada`, `em_execucao` e `aguardando_material`. Status que permitem nova solicitacao: `concluida`, `cancelada`, `nao_atendida` e `encerrada`, se existir futuramente. O escopo inicial nao bloqueia `ponto_manual`; bloqueio espacial por proximidade deve ser etapa futura.

A resposta desse caso usa mensagem publica segura: "Ja existe uma solicitacao aberta para este poste. A equipe responsavel ja foi notificada." A resposta nao retorna protocolo de outra pessoa, dados pessoais, contato, descricao ou detalhes administrativos. Essa regra substitui a abordagem inicial de apenas marcar `duplicidade_suspeita` para casos de mesmo poste ativo.

O bloqueio `409 Conflict` por solicitacao ativa no mesmo poste foi validado manualmente em ambiente controlado: a primeira solicitacao criou registro e a nova solicitacao para o mesmo poste ativo foi bloqueada com mensagem publica segura, sem expor protocolo de terceiro, nome, contato, descricao ou detalhes administrativos. O Google Forms permanece como fallback.

## Teste manual do repository

```powershell
python scripts/test_iluminacao_repository_manual.py
```

Esse teste manual requer `.env` local com `DATABASE_URL`. O endpoint publico nao e alterado por esse script. Ele pode criar registro de teste em homologacao; limpe os dados de teste apos a validacao.

Exemplo de resposta simulada:

```json
{
  "protocolo": "IP-2026-000001",
  "status": "aberta",
  "message": "Solicitacao registrada em ambiente de teste."
}
```

Os status tecnicos usam valores padronizados em minusculo e sem acento. Rotulos amigaveis podem ser tratados futuramente no front-end ou painel interno.

## CORS

As origens permitidas sao lidas da configuracao `ALLOWED_ORIGINS`, em lista separada por virgulas. Para esta POC local, o padrao permite `http://localhost:5195` e `http://127.0.0.1:5195`.

Nao usar `*` como origem permitida em producao.

Em homologacao, CORS foi validado para a origem oficial do Geoportal apos ajuste do ambiente real fora do Git e reinicio do servico. `ALLOWED_ORIGINS` real nao deve ser versionado, e as origens devem permanecer restritas.

Nesta fase, nao usar wildcard para compensar dominios diferentes. A solucao temporaria e manter a API em `https://geoserver.amambai.ms.gov.br/api/` e permitir somente a origem oficial necessaria. A rota `https://geoportal.amambai.ms.gov.br/api/` deve ser avaliada futuramente com proxy no servidor do front-end ou revisao de DNS/VirtualHost.

## Seguranca

### Validacao e tratamento de erros

O backend implementa tratamento global de erros de validacao para evitar expor dados pessoais em respostas HTTP 422:

- **Campos sanitizados na resposta de erro**: as respostas 422 de `RequestValidationError` removem campos sensveis:
  - Campo `input` nao e retornado, evitando ecoar payload bruto inválido.
  - Campo `url` nao e retornado.
  - Apenas campos seguros sao inclusos na resposta: `type`, `loc`, `msg` e `ctx` (quando existir).
- **Validacao corrigida**: correcao foi implementada no handler `RequestValidationError` em `app/main.py`.
- **Ambientes validados**: sanitizacao testada em testes automatizados (76 passed), homologacao, producao local em `127.0.0.1:8001` e URL publica (https://geoserver.amambai.ms.gov.br).
- **Exemplos validados**:
  - Payload com descricao de 10000 caracteres retorna `422` com `type`, `loc`, `msg` sem ecoar o texto grande.
  - Payload com campo extra retorna `422` com `type`, `loc`, `msg` sem ecoar o valor indevido.
  - Nenhum dado pessoal e exposto em respostas de erro.

### Geral

- Nao criar `.env` com credenciais no Git.
- Nao incluir senha, token, IP interno, usuario de banco ou dados reais.
- Usar `.env.example` apenas como referencia segura.
- Esta prova de conceito e local/homologacao e nao deve ser apontada para producao.
