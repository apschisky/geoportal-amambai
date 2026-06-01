# Plano de Implementacao Segura da Autenticacao Interna

Este documento orienta a implementacao futura da autenticacao interna do Geoportal. Ele nao cria codigo, migrations, endpoints, telas, usuarios reais, senhas, tokens, sessoes, seeds ou configuracoes de ambiente.

A base estrutural inicial do schema `mod_auth` ja foi criada, aplicada e documentada em homologacao e producao pelas migrations `0006` a `0009`. O endpoint interno de login existe apenas sob feature flag e agora seta cookie HttpOnly para navegador; ainda nao ha tela interna, JWT, token real operacional amplo ou seed.

Antes de expor endpoints internos, a API publica atual deve permanecer revisada e saudavel conforme `docs/PUBLIC-API-SECURITY-REVIEW.md`.

Registro atual de implementação: o serviço interno de hash/verificação de senha usando Argon2id (`argon2-cffi`) foi implementado e validado. O serviço interno de sessão opaca/token foi implementado e validado. O repository interno de sessões foi criado para `mod_auth.sessoes`, usando `token_hash`, expiração e revogação por `revogado_em`, sem `DELETE`. O repository interno de usuários foi criado para `mod_auth.usuarios`, buscando por login com bind param e comparação case-insensitive; e-mail é opcional e não é chave obrigatória de autenticação. O service interno de autenticação/sessão foi criado em `geoportal-backend/app/services/auth_service.py` sem endpoint. O service interno de validação de sessão autenticada foi criado em `geoportal-backend/app/services/auth_current_session_service.py`; recebe token bruto e `session_secret` apenas internamente, calcula `token_hash`, consulta sessão ativa e retorna apenas dados internos mínimos, sem retornar token bruto, `token_hash`, `session_secret`, senha ou `senha_hash`. Sessão inválida ou token vazio retorna `None`. `session_secret` inválido e erros de repository/banco sobem como erro interno, sem fallback inseguro. O service puro de transporte de token foi criado em `geoportal-backend/app/services/auth_token_transport_service.py`; ele extrai token de `session_cookie` ou `Authorization: Bearer`, retorna `transport = "cookie"` para cookie válido, `transport = "bearer"` para Bearer válido, marca cookie+bearer simultâneos como ambíguos e não escolhe silenciosamente, e não depende de FastAPI, `Request`, endpoint ou middleware. A dependency FastAPI interna `get_current_authenticated_session(...)` foi criada em `geoportal-backend/app/dependencies/auth_dependencies.py`; ela compõe `extract_session_token(...)` e `resolve_authenticated_session(...)`, e retorna `HTTPException 401` genérico para falhas sem revelar o motivo específico. O router técnico protegido de smoke foi criado em `geoportal-backend/app/api/routes/internal_auth_smoke.py` com `GET /api/internal/auth/smoke`; ele e incluido no app principal somente quando `GEOPORTAL_INTERNAL_ROUTES_ENABLED` esta explicitamente ativada. Ele serve apenas para teste técnico da dependency, não é endpoint de negócio e não é endpoint de login. A feature flag `GEOPORTAL_INTERNAL_ROUTES_ENABLED` foi criada em `geoportal-backend/app/core/internal_routes_config.py` com comportamento fail-closed; ausência, valor inválido ou valor desligado não ativam rotas internas. `get_session_secret(...)` lê `GEOPORTAL_INTERNAL_SESSION_SECRET` apenas como configuração futura; nenhum valor real de segredo foi incluído e `.env` não foi alterado. Token ausente retorna `token = None`. Authorization malformado, Basic, Bearer sem token ou Bearer com partes extras retornam `is_malformed = True`. Esse service não valida criptograficamente a sessão nem consulta o banco; ele apenas extrai e normaliza o token. A validação real de sessão continua em `auth_current_session_service.py`. O repository interno de auditoria de login foi criado em `geoportal-backend/app/repositories/auth_login_audit_repository.py` com funções `record_login_attempt(...)` e `count_recent_failed_attempts(...)`; registra apenas campos seguros (`usuario_id`, `login_informado`, `sucesso`, `motivo_falha`, `criado_em`, `origem`); não registra senha, token ou session_secret. O service puro de rate limit de login foi criado em `geoportal-backend/app/services/auth_rate_limit_service.py` com `LoginRateLimitDecision` e `evaluate_login_rate_limit(...)`; não depende de FastAPI ou banco; não revela existência de usuário; decide por `failed_attempts`, `max_attempts` e `window_minutes`. Auditoria e rate limit foram integrados ao `auth_service.py`; o rate limit é avaliado antes da verificação de senha. A atualização de `ultimo_login_em` foi tornada best effort via try/except controlado para reduzir risco de inconsistência; se falhar, a sessão autenticada já criada permanece válida e a auditoria de sucesso continua sendo registrada. Em etapa futura com logging estruturado seguro, o except poderá registrar log interno sanitizado, sem senha, token, hash, session_secret ou DATABASE_URL.
Validação local desta etapa: `tests/test_internal_auth_login_router.py` passou com 14 testes de login, cookie, Bearer, smoke e logout; `tests/test_auth_dependencies.py` passou com 15 testes, incluindo cookie seguro e header interno mutavel; `tests/test_auth_login_audit_repository.py` passou com 6 testes; `tests/test_reset_internal_user_password_admin.py` passou com 12 testes; `tests/test_internal_routes_feature_flag.py`, `tests/test_internal_routes_config.py` e `tests/test_internal_auth_smoke_router.py` passaram; `tests/test_auth_service.py` passou com 26 testes incluindo validação de robustez da atualização best effort de `ultimo_login_em`; `tests/test_auth_user_repository.py` passou com 9 testes; suite completa local passou com 298 testes.
Validação no servidor: commits `0baeeca` Corrige filtros opcionais da auditoria de login, `8431e0e` Adiciona reset administrativo de senha interna, `3ebfc4f` Adiciona endpoint interno de login foram aplicados. Testes no servidor: `tests/test_auth_login_audit_repository.py` passou com 6 testes; `tests/test_auth_service.py` passou com 26 testes; `tests/test_internal_auth_login_router.py` passou com 5 testes; pytest completo passou com 283 testes. Homologação, produção local e produção pública foram reiniciadas e validadas. A API pública continuou saudável em todos os ambientes. Em homologação, `GeoportalAPIHomologacao` foi configurado via NSSM com `GEOPORTAL_INTERNAL_ROUTES_ENABLED=true` e `GEOPORTAL_INTERNAL_SESSION_SECRET` forte apenas no serviço, fora do Git. `.env` não foi alterado. A homologação foi reiniciada e validada pelo harness operacional `scripts/deploy/backend-restart-validate-service.ps1 -Environment Homologacao -Restart -Validate`. Em homologação, `/api/health`, `/api/public/iluminacao/health` e `/api/version` permaneceram OK, e `/api/internal/auth/smoke` retornou `401`, confirmando que a rota interna está ativa e protegida. Em produção pública, `/api/internal/auth/smoke` continuou retornando `404`, confirmando que a rota interna permanece não exposta.
O endpoint interno `POST /api/internal/auth/login` existe somente sob `GEOPORTAL_INTERNAL_ROUTES_ENABLED`; em sucesso, seta cookie `geoportal_internal_session` HttpOnly, SameSite=Lax, Path `/api/internal`, Max-Age alinhado a sessao e Secure configuravel com padrao seguro em producao. Bearer continua aceito como suporte tecnico/intermediario. O endpoint `POST /api/internal/auth/logout` revoga a sessao por `revogado_em`, limpa o cookie e exige header `X-Geoportal-Internal-Request: 1`. Não há endpoint de negócio interno, JWT ou middleware de autenticação global. O usuário `admin.homologacao` existe somente em homologação por bootstrap administrativo controlado. O router técnico de smoke e os endpoints de login/logout só ficam ativos com feature flag ligada explicitamente.
Próximos passos: manter a flag desligada em produção; homologação permanece como ambiente controlado para smoke test protegido, login interno inicial e validação operacional do cookie/logout; ainda sem JWT, endpoint `/me` ou endpoint de negócio interno.

Validação operacional de cookie HttpOnly, logout e proteção mutável inicial em homologação (processo isolado):

Commit validado no servidor: `eaf5724` Implementa cookie e logout internos. Pytest completo no servidor: 298 passed.

A validação foi executada em processo isolado, sem alterar NSSM, sem alterar produção, sem alterar `.env` versionado e sem manter variáveis temporárias no ambiente. Foram usadas apenas durante o processo: `DATABASE_URL` temporária com `geoportal_api_homolog`, `GEOPORTAL_INTERNAL_ROUTES_ENABLED`, `GEOPORTAL_INTERNAL_SESSION_SECRET`, `GEOPORTAL_INTERNAL_SESSION_COOKIE_SECURE=false` para TestClient/local e `TEST_INTERNAL_PASSWORD`. Todas foram limpas após o teste.

Resultados sanitizados:
- Login: `login_status=200`, `login_authenticated=True`, `login_usuario_id=7`, `login_login=admin.homologacao`, `login_tem_token_no_corpo=True`, `login_set_cookie=True`.
- Cookie: `cookie_jar_tem_sessao=True`, `cookie_httponly=True`, `cookie_samesite_lax=True`, `cookie_path_internal=True`.
- Smoke autenticado por cookie: `smoke_cookie_status=200`, `smoke_authenticated=True`, `smoke_usuario_id=7`, `smoke_tem_sessao_id=True`.
- Proteção mutável inicial: logout sem header retornou 403; header exigido `X-Geoportal-Internal-Request: 1`; login e GET smoke não exigem esse header.
- Logout: `logout_status=200`, `logout_logged_out=True`, `logout_limpa_cookie=True`, `cookie_jar_tem_sessao_apos_logout=False`, `smoke_apos_logout_status=401`.
- Contagens após teste: `mod_auth.usuarios=1`, `mod_auth.sessoes=2`, `mod_auth.login_auditoria=2`, `sessoes_revogadas=1`.

Confirmações: cookie HttpOnly, SameSite=Lax, Path `/api/internal`, sessão opaca, revogação lógica por `revogado_em`, sem DELETE físico, Bearer mantido como suporte técnico/intermediário e cookie como transporte principal planejado para navegador. Próximos passos: decidir quando remover o token do corpo da resposta ou restringi-lo a ambiente técnico; planejar validação Origin/Referer como camada complementar; planejar endpoints internos de negócio apenas após autorização por perfis/permissões; não liberar tela interna para usuários reais antes de autorização e frontend seguro.

Registro arquitetural de autorizacao funcional: a proxima fase apos autenticacao/sessao nao e tela/frontend. A proxima fase deve implementar autorizacao por `mod_auth.usuarios`, `mod_auth.perfis`, `mod_auth.permissoes`, `mod_auth.usuario_perfis` e `mod_auth.perfil_permissoes`. Um usuario pode ter um ou mais perfis; um perfil agrupa permissoes; permissoes devem ser granulares por modulo/recurso/acao, como `admin.usuarios.criar`, `admin.usuarios.bloquear`, `admin.usuarios.redefinir_senha`, `admin.usuarios.atribuir_perfis`, `admin.perfis.gerenciar`, `iluminacao.solicitacoes.ler`, `iluminacao.solicitacoes.atualizar_status`, `iluminacao.solicitacoes.comentar`, `iluminacao.dashboard.ler` e `iluminacao.relatorios.ler`. Nao usar regra hardcoded por login, especialmente `admin.homologacao`, para liberar tudo.

Base tecnica de autorizacao implementada: repository de permissoes efetivas, service `has_permission(usuario_id, permissao)`, dependency `require_permission("permissao")` e endpoint tecnico `GET /api/internal/auth/me`. O endpoint `/me` retorna apenas `authenticated`, `usuario_id` e lista ordenada de permissoes efetivas, sem token, cookie, `senha_hash`, `token_hash`, `session_secret` ou `DATABASE_URL`. Testes locais passaram com 311 testes. Nenhum perfil real, permissao real, vinculo real, usuario real, seed, role, GRANT, migration, schema, endpoint administrativo real, frontend, producao, NSSM ou `.env` foi alterado.

Validacao operacional do `/api/internal/auth/me`: o commit `03efa10` Implementa base de autorizacao interna foi aplicado no servidor e validado com pytest completo: 311 passed. O teste foi feito em processo isolado de homologacao com variaveis temporarias (`DATABASE_URL` usando `geoportal_api_homolog`, `GEOPORTAL_INTERNAL_ROUTES_ENABLED`, `GEOPORTAL_INTERNAL_SESSION_SECRET`, `GEOPORTAL_INTERNAL_SESSION_COOKIE_SECURE=false` para TestClient/local e `TEST_INTERNAL_PASSWORD`), todas limpas ao final. O primeiro acesso a `/me` falhou por ausencia de `SELECT` em `mod_auth.usuario_perfis`, e a matriz runtime foi ajustada operacionalmente apenas com leitura para `geoportal_api_homolog` em `mod_auth.usuario_perfis`, `mod_auth.perfis`, `mod_auth.perfil_permissoes` e `mod_auth.permissoes`. A validacao confirmou `SELECT=true` e `INSERT=false`, `UPDATE=false`, `DELETE=false` para cada tabela.

Resultado sanitizado final: `login_status=200`, `login_set_cookie=True`, `cookie_jar_tem_sessao=True`, `me_status=200`, `me_authenticated=True`, `me_usuario_id=7`, `me_permissoes=[]`, `me_tem_token=False`, `me_tem_cookie=False`, `me_tem_senha_hash=False`, `me_tem_token_hash=False`, `me_tem_session_secret=False`, `me_tem_database_url=False`. `permissoes=[]` e esperado antes da criacao e atribuicao de perfis/permissoes reais ao `admin.homologacao`. A role `geoportal_api_homolog` ficou com leitura suficiente para autenticacao, sessao e autorizacao, sem escrita nas tabelas de perfis/permissoes, sem superuser, sem `CREATEDB`, sem `CREATEROLE`, sem `BYPASSRLS` e sem acesso automatico a outros schemas.

Plano de bootstrap seguro do perfil administrativo inicial: a proxima etapa deve criar o perfil `Administrador Interno do Geoportal`, as permissoes administrativas iniciais e a atribuicao ao `admin.homologacao` primeiro em homologacao. Isso deve ocorrer por script administrativo idempotente, com `--dry-run`, bind parameters, testes automatizados e validacao de ambiente, nao por SQL manual solto. O script nao deve apagar registros, duplicar perfis/permissoes/vinculos, depender de login hardcoded ou imprimir senha, token, hash, `session_secret` ou `DATABASE_URL`. A role runtime `geoportal_api_homolog` continuara apenas lendo permissoes; criacao/alteracao de perfis/permissoes, se necessaria, deve usar role administrativa operacional controlada, como `geoportal_auth_admin_homolog`, com permissoes temporarias e revogacao quando aplicavel.

Permissoes iniciais propostas: `admin.usuarios.ler`, `admin.usuarios.criar`, `admin.usuarios.bloquear`, `admin.usuarios.redefinir_senha`, `admin.usuarios.atribuir_perfis`, `admin.perfis.ler`, `admin.perfis.gerenciar`, `admin.permissoes.ler`, `admin.permissoes.gerenciar` e `internal.auth.me`. O administrador funcional nao e superuser de banco e nao recebe privilegios PostgreSQL especiais por ser administrador da aplicacao.

Implementacao local do bootstrap: foram criados o script `geoportal-backend/scripts/admin/bootstrap_internal_admin_profile.py`, o repository `geoportal-backend/app/repositories/auth_admin_profile_repository.py` e testes automatizados. O script exige `--login`, possui `--dry-run` sem persistencia, usa bind parameters, nao aceita senha, nao usa login hardcoded, nao executa `DELETE` e nao imprime dados sensiveis. Nesta etapa, nao foi executado contra banco real, nao criou perfil/permissao/vinculo real, nao alterou schema, nao criou endpoint e nao alterou producao.

Validacao operacional do bootstrap em homologacao: o commit `5a4d2bf` Adiciona bootstrap de perfil administrativo foi aplicado no servidor e validado com pytest completo: 327 passed. Antes da operacao, foram realizados backup de roles e backup custom do banco de homologacao. O dry-run passou com mensagem segura e a execucao real concluiu com sucesso. Foram criados/validados o perfil `administrador-interno-geoportal`, 10 permissoes administrativas ativas, 10 vinculos perfil-permissao e o vinculo global `admin.homologacao` -> `administrador-interno-geoportal` com `modulo NULL`. `geoportal_auth_admin_homolog` recebeu `SELECT`/`INSERT` temporario nas tabelas de autorizacao e `USAGE`/`SELECT` temporario nas sequences `perfis_id_seq` e `permissoes_id_seq`; depois da operacao, `INSERT` e permissoes de sequence foram revogadas, restando apenas leitura nas tabelas de autorizacao, sem `UPDATE`/`DELETE`. O `/api/internal/auth/me` retornou 10 permissoes esperadas para `admin.homologacao` e nao retornou token, cookie, `senha_hash`, `token_hash`, `session_secret` ou `DATABASE_URL`. Producao, NSSM, `.env` versionado e frontend nao foram alterados.

Endpoint tecnico de permissao implementado: `GET /api/internal/auth/permission-smoke` valida `require_permission("internal.auth.me")` em rota real, sob `GEOPORTAL_INTERNAL_ROUTES_ENABLED`. O endpoint exige sessao autenticada e permissao, nao exige header mutavel por ser GET tecnico de consulta e retorna payload minimo sanitizado. Respostas padronizadas: 401 generico sem sessao, 403 generico sem permissao e 200 quando autorizado. Ele nao retorna token, cookie, senha, `senha_hash`, `token_hash`, `session_secret`, `DATABASE_URL`, SQL, role ou GRANT; nao usa login hardcoded e nao cria endpoint administrativo real.

Validacao operacional do permission-smoke em homologacao: o commit `251cf65` Adiciona smoke de permissao interna foi aplicado no servidor e validado com pytest completo: 335 passed. A validacao ocorreu em processo isolado de homologacao com variaveis temporarias; todas foram limpas ao final. Sem sessao, o endpoint retornou 401 com `{'detail': 'Not authenticated'}`. Com admin.homologacao autenticado (que possui a permissao internal.auth.me), o endpoint retornou 200 autorizado. Resultado sanitizado: `login_status=200`, `login_set_cookie=True`, `cookie_jar_tem_sessao=True`, `permission_status=200`, `permission_authorized=True`, `permission_code=internal.auth.me`, `permission_usuario_id=7`. A resposta nao expôs token, cookie, `senha_hash`, `token_hash`, `session_secret`, `DATABASE_URL`, SQL, role ou GRANT. Producao, NSSM, `.env` versionado e frontend nao foram alterados.

Primeiro endpoint administrativo real implementado: `GET /api/internal/admin/users` lista usuarios internos de forma somente leitura, protegido por `require_permission("admin.usuarios.ler")` e condicionado por `GEOPORTAL_INTERNAL_ROUTES_ENABLED`. A resposta e sanitizada e limitada a campos seguros (`id`, `login`, `nome`, `email`, `ativo`, `bloqueado`, `criado_em`), sem senha, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, dados de sessao, auditoria, SQL, role, GRANT ou `bloqueado_ate`. Nao exige header mutavel por ser GET e nao cria endpoint de escrita, criacao, bloqueio/desbloqueio, reset de senha ou atribuicao de perfil. Nao ha migration, schema novo, producao, NSSM, `.env`, frontend ou tela nesta etapa.

Validacao operacional de GET /api/internal/admin/users em homologacao: o commit `119390e` Adiciona listagem interna de usuarios foi aplicado no servidor e validado com pytest completo: 347 passed. A validacao ocorreu em processo isolado de homologacao com variaveis temporarias; todas foram limpas ao final. Sem sessao, o endpoint retornou 401 com `{'detail': 'Not authenticated'}`. Com admin.homologacao autenticado (que possui a permissao admin.usuarios.ler), o endpoint retornou 200 com lista sanitizada de usuarios. Resultado sanitizado: `login_status=200`, `login_set_cookie=True`, `cookie_jar_tem_sessao=True`, `users_status=200`, `users_tem_lista=True`, `users_total=1`, `users_tem_admin_homologacao=True`. Campos retornados em cada usuario: `id`, `login`, `nome`, `email`, `ativo`, `bloqueado`, `criado_em`. A resposta nao expôs senha, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, SQL, role, GRANT, dados de sessao, auditoria ou `bloqueado_ate`. Variaveis temporarias foram limpas apos o teste. Producao, NSSM, `.env` versionado e frontend nao foram alterados. Nenhum endpoint mutavel foi criado nesta etapa.

Sequencia segura recomendada a partir daqui: validar o endpoint de detalhe somente leitura em homologacao e planejar endpoint de criacao de usuario interno como etapa separada; manter bloqueio, reset de senha e atribuicao de perfil para etapas posteriores; depois criar o primeiro endpoint interno de negocio do modulo Iluminacao; tela interna continua etapa posterior. Producao permanece sem alteracao nesta etapa.

Nota sobre bloqueio/desbloqueio (resumo):

- Persistir bloqueio usando `mod_auth.usuarios.bloqueado_ate` somente em colunas existentes; **não** propor nova coluna booleana permanente.
- A API deve expor apenas `bloqueado` como booleano derivado de `bloqueado_ate` (não retornar `bloqueado_ate`).
- Bloquear deve revogar sessoes ativas atualizando `mod_auth.sessoes.revogado_em = now()` (sem DELETE físico).
- Desbloquear deve limpar `bloqueado_ate` e não deve criar sessao automaticamente.

Endpoint administrativo de detalhe somente leitura implementado: `GET /api/internal/admin/users/{usuario_id}` consulta um usuario interno por `id`, sob feature flag interna e protegido por `require_permission("admin.usuarios.ler")`. A consulta usa bind parameter e seleciona apenas campos seguros (`id`, `login`, `nome`, `email`, `ativo`, `bloqueado`, `criado_em`), sem expor senha, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, sessao, auditoria, SQL, role, GRANT, `bloqueado_ate`, `atualizado_em` ou `ultimo_login_em`. Sem sessao retorna 401 generico, sem permissao retorna 403 generico e usuario inexistente retorna 404 generico. Por ser GET de consulta, nao exige header mutavel. Esta etapa nao cria endpoint mutavel, nao cria usuario, nao bloqueia/desbloqueia, nao redefine senha, nao atribui perfil, nao altera schema, nao cria migration, nao altera producao e nao cria tela.

Validacao operacional de GET /api/internal/admin/users/{usuario_id} em homologacao: o commit `ea4e457` Adiciona detalhe interno de usuario foi aplicado no servidor e validado com pytest completo: 358 passed. A validacao ocorreu em processo isolado de homologacao com variaveis temporarias; todas foram limpas ao final. Sem sessao, o endpoint retornou 401 com `{'detail': 'Not authenticated'}`. Com admin.homologacao autenticado (que possui a permissao admin.usuarios.ler), o endpoint retornou 200 para o usuario_id=7 (admin.homologacao) com objeto `usuario` sanitizado contendo `id`, `login`, `nome`, `email`, `ativo`, `bloqueado`, `criado_em`. Usuario inexistente retornou 404 generico `{'detail': 'Not found'}`. A resposta nao expôs senha, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, SQL, role, GRANT, dados de sessao, auditoria, `bloqueado_ate`, `atualizado_em` ou `ultimo_login_em`. Variaveis temporarias foram limpas apos o teste. Producao, NSSM, `.env` versionado e frontend nao foram alterados. Nenhum endpoint mutavel foi criado nesta etapa.

Plano de seguranca para o primeiro endpoint mutavel: `POST /api/internal/admin/users` deve ser o proximo endpoint planejado, mas somente em etapa separada com Codex High. Por ser POST mutavel, deve ficar sob `GEOPORTAL_INTERNAL_ROUTES_ENABLED`, exigir sessao autenticada, `require_permission("admin.usuarios.criar")`, header `X-Geoportal-Internal-Request: 1` e a protecao CSRF/equivalente ja definida. O escopo e criar somente usuario basico; nao atribuir perfil, nao bloquear/desbloquear, nao resetar senha de usuario existente, nao criar permissoes, nao criar sessao, nao enviar e-mail e nao criar tela. Payload planejado: `login`, `nome`, `email` opcional e `senha_inicial`; sao proibidos `id`, `ativo`, `bloqueado`, `bloqueado_ate`, `senha_hash`, `perfil`, `perfis`, `permissoes`, `role`, `token`, `session_secret`, `DATABASE_URL`, campos de auditoria e campos de sessao. Validacoes obrigatorias: `login` com `strip`, nao vazio e unico case-insensitive; `nome` nao vazio; `email` opcional validado quando informado e unico conforme regra existente; `senha_inicial` obrigatoria conforme politica de senha existente; rejeicao de campos extras se o padrao Pydantic permitir; sem login hardcoded e sem perfil/permissao no mesmo endpoint. Persistencia planejada: inserir em `mod_auth.usuarios`, gerar `senha_hash` Argon2id com utilitario existente, `ativo=true`, `desativado_em=NULL`, `bloqueado_ate=NULL`, `atualizado_em=NULL` ou conforme padrao existente, sem criar sessao, perfil, vinculo `usuario_perfis`, registro em `login_auditoria` salvo decisao futura especifica, e sem apagar nada. Resposta 201 planejada: `usuario.id`, `usuario.login`, `usuario.nome`, `usuario.email`, `usuario.ativo`, `usuario.bloqueado`, `usuario.criado_em`, nunca senha, `senha_inicial`, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, SQL, role, GRANT, sessao, auditoria, `bloqueado_ate`, `atualizado_em` ou `ultimo_login_em`. Erros planejados: 401 `Not authenticated`, 403 `Forbidden`, 409 `Conflict` para login/e-mail duplicado e 422 para payload invalido, sempre sanitizados e sem detalhes de tabela, SQL ou constraint.

Implementacao do primeiro endpoint mutavel: `POST /api/internal/admin/users` foi criado com escopo limitado a usuario basico, sob feature flag interna, sessao autenticada, `require_permission("admin.usuarios.criar")` e header `X-Geoportal-Internal-Request: 1`. O payload usa `extra="forbid"` e aceita apenas `login`, `nome`, `email` opcional e `senha_inicial`; login e nome sao normalizados, e-mail vazio vira nulo, e senha vazia e rejeitada. O service gera `senha_hash` Argon2id com utilitario existente e o repository insere em `mod_auth.usuarios` com bind parameters, `ativo=true`, `bloqueado_ate=NULL`, `desativado_em=NULL` e `atualizado_em=NULL`. A resposta 201 e sanitizada e nao contem senha, senha inicial, hash, token, cookie, segredo, SQL, role, GRANT, sessao, auditoria, `bloqueado_ate`, `atualizado_em` ou `ultimo_login_em`. Conflitos de login/e-mail retornam 409 generico. A implementacao nao atribui perfil, nao cria sessao, nao escreve em `login_auditoria`, nao envia e-mail, nao cria endpoints de bloqueio/reset/perfis, nao altera schema, nao cria migration e nao altera producao, NSSM, `.env`, frontend ou tela.

Reforco de politica de senha inicial: antes da validacao em homologacao, foi criada validacao centralizada em `app/security/passwords.py`. A senha inicial deve ser obrigatoria, ter entre 6 e 128 caracteres apos `strip`, conter letra e numero, nao ser igual ao login ou ao nome e nao estar na lista curta de senhas comuns bloqueadas. O service aplica essa validacao antes de gerar Argon2id; se falhar, o endpoint retorna 422 generico sem expor a senha, o campo `senha_inicial`, hash, SQL ou detalhe interno.

Validacao operacional de `POST /api/internal/admin/users` em homologacao: o commit `99f2987` Reforca politica de senha interna foi aplicado no servidor e validado com pytest completo: 403 passed. Antes do teste real foram feitos backup de roles e backup custom do banco de homologacao. A role `geoportal_api_homolog` recebeu permissao minima adicional para criacao via endpoint (`INSERT` em `mod_auth.usuarios` e `USAGE`/`SELECT` em `mod_auth.usuarios_id_seq`), com validacao final: `usuarios_select=t`, `usuarios_insert=t`, `usuarios_update=t`, `usuarios_delete=f`, `usuarios_seq_usage=t`, `usuarios_seq_select=t`. Em processo isolado, com variaveis temporarias limpas ao final, foram validados: 401 sem sessao; 403 sem header mutavel; 422 para senha invalida/fraca; 201 para criacao valida; 409 para duplicidade; 200 no detalhe do usuario criado; 200 no login do usuario criado. O usuario `teste.criacao` foi criado em homologacao com `id=8`, `email=NULL`, `ativo=true`, `bloqueado=false` e `criado_em` presente. Ele nao recebeu perfil automaticamente; `/me` retornou `permissoes=[]`. A resposta nao expos senha real, `senha_inicial`, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, SQL, role, GRANT, sessao, auditoria ou `bloqueado_ate`. Producao, NSSM, `.env` versionado e frontend nao foram alterados.

Plano de seguranca para atribuicao de perfil: o endpoint futuro `POST /api/internal/admin/users/{usuario_id}/profiles` deve exigir feature flag interna, sessao autenticada, `require_permission("admin.usuarios.atribuir_perfis")` e header `X-Geoportal-Internal-Request: 1`. Para reduzir risco, o primeiro ciclo atribui um unico perfil por requisicao; nao havera batch, remocao de perfil, criacao de perfil, criacao de permissao, alteracao de senha, sessao automatica ou envio de e-mail. Payload permitido: `perfil_id` obrigatorio e `modulo` opcional/nulo; proibidos `usuario_id` no corpo, `perfil_chave`, `permissoes`, `login`, senha, `senha_hash`, token, role, GRANT, `session_secret`, `DATABASE_URL`, auditoria e sessao. Respostas planejadas: 201 para novo vinculo ativo, 200 para vinculo ativo ja existente sem duplicar, 401 sem sessao, 403 sem permissao, 403 sem header mutavel, 404 generico para usuario/perfil inexistente e 422 para payload invalido. A primeira versao nao deve reativar vinculo inativo automaticamente sem decisao posterior. A resposta deve usar envelope `vinculo` com `usuario_id`, `perfil_id`, `modulo` e `ativo`. Em homologacao, validar com `teste.criacao`: `/me` deve sair de `permissoes=[]` para permissoes do perfil atribuido.

Implementacao segura da atribuicao de perfil: `POST /api/internal/admin/users/{usuario_id}/profiles` foi implementado com as protecoes planejadas. A rota mutavel exige feature flag interna, sessao autenticada, `require_permission("admin.usuarios.atribuir_perfis")` e `X-Geoportal-Internal-Request: 1`; login/criacao de usuario e GETs internos continuam sem esse header quando aplicavel. O endpoint aceita somente `perfil_id` positivo e `modulo` opcional/nulo, rejeita campos extras com resposta 422 generica, retorna 201 para vinculo novo, 200 para vinculo ativo ja existente, 404 generico para usuario/perfil inexistente e 409 generico para vinculo inativo, sem reativacao automatica. A resposta e limitada a `vinculo.usuario_id`, `vinculo.perfil_id`, `vinculo.modulo` e `vinculo.ativo`. A implementacao nao cria perfil, permissao, usuario, sessao, auditoria, batch, remocao de perfil, migration ou schema e nao altera producao, NSSM, `.env`, frontend ou tela. A validacao operacional em homologacao permanece proxima etapa separada.

Validacao operacional de `POST /api/internal/admin/users/{usuario_id}/profiles` em homologacao: o commit `092b5bb` foi aplicado no servidor e validado com pytest completo: 426 passed. A role `geoportal_api_homolog` recebeu apenas `INSERT` em `mod_auth.usuario_perfis` para a validacao; a matriz final manteve `usuario_perfis_update=f` e `usuario_perfis_delete=f`, com `SELECT` em `usuarios`, `perfis`, `permissoes` e `perfil_permissoes`. Em processo isolado, com variaveis temporarias limpas ao final, foram validados: 401 sem sessao; 403 sem header mutavel; 201 para atribuicao valida; 200 para repeticao idempotente; 404 para perfil inexistente; 422 para payload invalido. O usuario `teste.criacao` (`id=8`) passou de `/me` com `permissoes=[]` para 10 permissoes do perfil, incluindo `internal.auth.me` e `admin.usuarios.ler`. A resposta nao expos senha real, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, SQL, role, GRANT, sessao ou auditoria; a ocorrencia `response_tem_senha=True` foi causada apenas pelo nome tecnico `admin.usuarios.redefinir_senha`. Producao, NSSM, `.env` versionado e frontend nao foram alterados; nenhum batch, remocao de perfil, bloqueio/desbloqueio ou reset de senha foi criado.

Endpoint de perfis somente leitura implementado: `GET /api/internal/admin/profiles` foi criado para fornecer a lista sanitizada de perfis ativos para a futura tela de checkboxes. A rota exige feature flag interna, sessao autenticada e `require_permission("admin.perfis.ler")`; por ser GET, nao exige header mutavel. A consulta seleciona apenas `id`, `chave`, `nome`, `ativo` e `criado_em` de `mod_auth.perfis`, com filtro `ativo=true` e ordenacao estavel. A resposta nao contem permissoes detalhadas, usuarios, sessoes, auditoria, senha, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, SQL, role ou GRANT. A etapa nao cria endpoint mutavel, nao cria/edita/remove perfil, nao cria permissao, usuario, vinculo, migration ou schema, e nao altera producao, NSSM, `.env`, frontend ou tela.

Validacao operacional de GET /api/internal/admin/profiles em homologacao: o commit `93d96f4` Adiciona listagem interna de perfis foi aplicado no servidor e validado com pytest completo: 439 passed. A validacao ocorreu em processo isolado de homologacao com variaveis temporarias; todas foram limpas ao final. Sem sessao, o endpoint retornou 401 com `{'detail': 'Not authenticated'}`. Com admin.homologacao autenticado e com `admin.perfis.ler`, o endpoint retornou 200. Resultado sanitizado: `profiles_status=200`, `profiles_tem_lista=True`, `profiles_total=1`, `profiles_tem_admin_interno=True`. Campos retornados: `id`, `chave`, `nome`, `ativo`, `criado_em`. A resposta nao expôs senha, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, SQL, role, GRANT, sessao, auditoria, permissoes, `perfil_permissoes` ou usuarios. Producao, NSSM, `.env` versionado e frontend nao foram alterados. Nenhum endpoint mutavel, usuario, perfil, permissao, vinculo, role ou GRANT foi criado nesta validacao.

Bloqueio/desbloqueio administrativo implementados: `POST /api/internal/admin/users/{usuario_id}/block` e `POST /api/internal/admin/users/{usuario_id}/unblock` foram criados como endpoints mutaveis protegidos por feature flag interna, sessao autenticada, `require_permission("admin.usuarios.bloquear")` e `X-Geoportal-Internal-Request: 1`. O bloqueio usa `bloqueado_ate` em `mod_auth.usuarios`, revoga sessoes ativas com `revogado_em = now()` em `mod_auth.sessoes` e nao usa `DELETE`. O desbloqueio limpa `bloqueado_ate` e nao cria sessao. As respostas retornam somente usuario sanitizado com `bloqueado` booleano derivado, sem `bloqueado_ate`, senha, hash, token, cookie, segredo, SQL, role, GRANT, sessao ou auditoria. A implementacao nao altera senha, perfis ou permissoes, nao escreve em auditoria de login, nao envia e-mail, nao cria reset de senha, nao altera schema/migration, producao, NSSM, `.env`, frontend ou tela.

Sequencia segura recomendada a partir daqui: validar bloqueio/desbloqueio em homologacao com `teste.criacao`; planejar reset de senha via endpoint; depois criar o primeiro endpoint interno de negocio do modulo Iluminacao; tela interna continua etapa posterior. Producao permanece sem alteracao nesta etapa.

Validacao operacional de bloqueio/desbloqueio em homologacao (processo isolado, commit 88ff004, pytest 462 passed):

Preparacao em homologacao:
- Backup de roles e customizado do banco foram realizados antes das operacoes.
- Matriz de privilegios da role `geoportal_api_homolog` foi expandida operacionalmente para UPDATE (bloqueio revoga sessoes): `usuarios_select=t`, `usuarios_insert=t`, `usuarios_update=t`, `usuarios_delete=f`; `sessoes_select=t`, `sessoes_insert=t`, `sessoes_update=t`, `sessoes_delete=f`.
- Nenhum novo GRANT foi necessario alem de `UPDATE` em `sessoes` para revogacao.

Execucao do teste operacional com `teste.criacao` (id=8):
- Processo isolado em homologacao com variaveis temporarias limpas ao final.
- Cenarios validados:
  - 401 sem sessao autenticada.
  - 403 sem header mutavel `X-Geoportal-Internal-Request: 1`.
  - 200 bloqueio com resposta `bloqueado=true`; usuario bloqueado nao consegue novo login (401).
  - 200 bloqueio idempotente se bloqueio ja existe.
  - 401 com sessao ativa existente durante bloqueio: sessao revogada com `revogado_em = now()` e acesso negado imediatamente.
  - 404 para usuario inexistente.
  - 200 desbloqueio com resposta `bloqueado=false`; usuario desbloqueado consegue novo login (200 com sessao).
  - 200 desbloqueio idempotente se ja desbloqueado.
  - Resposta sanitizada retornou `id`, `login`, `nome`, `email`, `ativo`, `bloqueado`, `criado_em` apenas.
  - Resposta nao retornou `bloqueado_ate`, `senha_hash`, `token_hash`, token, cookie, `session_secret`, `DATABASE_URL`, SQL, role, GRANT, sessao, auditoria ou segredo.

Confirmacoes de seguranca:
- Bloqueio revogou sessoes logicamente (UPDATE `revogado_em`, sem DELETE).
- Novo login bloqueado foi negado com 401 generico.
- Desbloqueio permitiu re-autenticacao normal sem criar sessao automaticamente.
- Nenhuma alteracao em producao, NSSM, `.env` versionado, schema, migration, perfis, permissoes, senha ou frontend.
- Variaveis temporarias (DATABASE_URL, GEOPORTAL_INTERNAL_ROUTES_ENABLED, GEOPORTAL_INTERNAL_SESSION_SECRET, TEST_INTERNAL_PASSWORD) foram limpas apos teste.

Nao havera copia cega de dados de homologacao para producao. Migram codigo versionado, migrations estruturais quando existirem, scripts administrativos validados e roteiro operacional. Nao migram senhas, sessoes, tokens, dados de teste ou usuarios ficticios. Nenhuma migration ou restart de producao deve ocorrer sem confirmacao humana, e a feature flag interna deve permanecer sob controle.

Plano de seguranca para reset administrativo de senha: o endpoint futuro `POST /api/internal/admin/users/{usuario_id}/reset-password` sera implementado em etapa separada com Codex High como acao mutavel de seguranca sensivel. Deve ficar sob `GEOPORTAL_INTERNAL_ROUTES_ENABLED`, exigir sessao autenticada, `require_permission("admin.usuarios.redefinir_senha")`, header `X-Geoportal-Internal-Request: 1` e usar bind parameters em SQL. Payload aceito: `nova_senha` obrigatoria e `confirmar_nova_senha` obrigatoria; nao aceitar por query string/path. Payload proibido: `senha_hash`, `token`, `token_hash`, `cookie`, `session_secret`, `DATABASE_URL`, `role`, `GRANT`, `perfil`, `perfis`, `permissoes`, `ativo`, `bloqueado`, `bloqueado_ate`, `usuario_id` no corpo, campos de auditoria e campos de sessao. Validacoes obrigatorias: `nova_senha` e `confirmar_nova_senha` nao vazios apos `strip`; senhas identicas comparadas seguramente; `nova_senha` cumprindo politica existente (6-128 caracteres, letra+numero, nao igual a login/nome, bloqueada se comum); rejeicao de campos extras; sem login hardcoded. Persistencia planejada: nao aceitar senha por query/path; gerar novo hash Argon2id pelo utilitario existente; atualizar somente `mod_auth.usuarios.senha_hash` e `mod_auth.usuarios.atualizado_em`, se aplicavel; revogar sessoes ativas atualizando `mod_auth.sessoes.revogado_em = now()`, sem DELETE fisico; nao desbloquear usuario se bloqueado; nao alterar perfil, permissoes ou `ativo`; nao criar sessao, auditoria de login (salvo decisao futura) ou e-mail. Resposta 200 planejada: `usuario.id`, `usuario.login`, `usuario.nome`, `usuario.email`, `usuario.ativo`, `usuario.bloqueado`, `usuario.criado_em`, nunca `senha`, `nova_senha`, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, SQL, role, GRANT, sessao, auditoria, `bloqueado_ate`, `atualizado_em` ou `ultimo_login_em`. Erros planejados: 401 `Not authenticated`, 403 `Forbidden`, 404 generico para usuario inexistente, 422 para payload invalido ou senha que nao cumpre politica, sempre sem expor detalhe de banco ou SQL. Esta etapa nao cria usuario, perfil, permissao, vinculo, migration, schema, producao, NSSM, `.env`, frontend ou tela. Proxima validacao: homologacao com `teste.criacao`, confirmando que senha antiga falha (401), senha nova funciona (200), sessoes ativas sao revogadas (401), usuario bloqueado continua bloqueado (sem desbloquear).

Validação operacional de login real em homologação (processo isolado):

Preparação em homologação:
- Role `geoportal_api_homolog` foi criada em homologação com permissões runtime mínimas: `CONNECT` ao banco de homologação, `USAGE` no schema `mod_auth`, `SELECT` e `INSERT` em `mod_auth.sessoes`, `SELECT` em `mod_auth.usuarios`, `USAGE` e `SELECT` nas sequences de `mod_auth.usuarios` e `mod_auth.sessoes`.
- Usuário `admin.homologacao` foi redefinido operacionalmente em homologação com senha temporária via `scripts/admin/reset_internal_user_password.py`:
  - Role `geoportal_auth_admin_homolog` recebeu `GRANT UPDATE` temporário em `mod_auth.usuarios` para permitir atualização de `senha_hash` e `atualizado_em`.
  - Reset executado interativamente com `getpass` (sem imprimir senha ou hash em log).
  - Apos o reset, `REVOKE UPDATE` foi executado, restringindo a role novamente apenas para `SELECT` e `INSERT`.
  - Nenhuma alteração em schema, migration ou produção.

Execução do teste operacional:
- Processo isolado foi executado em homologação com variáveis temporárias (não no serviço NSSM):
  - `DATABASE_URL` apontado para `geoportal_api_homolog` + homologação.
  - `GEOPORTAL_INTERNAL_ROUTES_ENABLED=true`.
  - `GEOPORTAL_INTERNAL_SESSION_SECRET` temporário.
  - `TEST_INTERNAL_PASSWORD` temporário (senha redefinida).
- Todas as variáveis temporárias foram limpas após o teste.
- Serviço NSSM / Windows não foi alterado nesta etapa; validação foi isolada e controlada.

Resultados sanitizados do teste (sem token real, sem hash, sem session_secret):
- `POST /api/internal/auth/login` com `login=admin.homologacao` e `TEST_INTERNAL_PASSWORD`: status `200`, `authenticated=true`, `usuario_id=7`, `login=admin.homologacao`, token presente.
- `GET /api/internal/auth/smoke` usando token do login: status `200`, `authenticated=true`, `usuario_id=7`, `sessao_id` presente.
- Contadores apos teste: `mod_auth.usuarios=1`, `mod_auth.sessoes=1`, `mod_auth.login_auditoria=1`.

Confirmações:
- Nenhuma alteração em produção.
- Nenhuma alteração em NSSM / serviço Windows.
- Nenhuma alteração em `.env` versionado.
- Nenhuma migration executada nesta etapa.
- Nenhum endpoint adicional criado.
- Nenhuma exposição de senha, token, hash, ou segredo.

Decisão arquitetural sobre transporte final e CSRF:

A validação técnica com `Authorization: Bearer` e token retornado no corpo foi aceita apenas como validação intermediária isolada em homologação. Para uso real em navegador por usuários finais do Geoportal Interno, foi implementado **cookie HttpOnly + Secure + SameSite=Lax** no login, com Secure configuravel e obrigatorio por padrao em producao. SameSite nao e a unica protecao: rotas internas mutaveis protegidas devem exigir o header `X-Geoportal-Internal-Request: 1`. O logout revoga sessão em `mod_auth.sessoes` com `revogado_em`, sem DELETE físico, e limpa o cookie. Validacao de Origin/Referer permanece camada complementar futura, configuravel e testavel se adotada. Não liberar tela interna para usuários reais antes de validação operacional em homologação e integração frontend/proxy. Bearer pode continuar para testes técnicos ou clientes não navegador, mas não como fluxo principal.

Registro atual de reset administrativo: foi criado `geoportal-backend/scripts/admin/reset_internal_user_password.py` para redefinir senha de usuario interno existente por `login` quando a senha original nao foi registrada e nao deve ser recuperavel. O script nao e endpoint, nao e importado pelo app principal e nao cria rota. Ele le e confirma a nova senha via `getpass`, rejeita senha vazia e confirmacao divergente, nao aceita `--password`, nao recebe hash por argumento e nao imprime senha ou hash. O modo `--dry-run` valida entrada e senha, gera hash apenas em memoria, nao conecta ao banco e nao persiste. Fora de `--dry-run`, o repository administrativo usa bind parameters e atualiza somente `senha_hash` e `atualizado_em` do usuario existente encontrado por login, retornando erro controlado se o login nao existir. Esta etapa nao criou migration, endpoint, usuario real, role, GRANT, seed, cookie, CSRF/JWT, alteracao de schema ou alteracao de producao.

Registro atual adicional: foi criada somente a estrutura preparatoria do script administrativo `geoportal-backend/scripts/admin/create_internal_user.py` para futura criacao manual do primeiro usuario interno. O script nao e endpoint, nao e importado pelo app principal e nao cria rota. O bootstrap do script administrativo foi corrigido; o script agora calcula a raiz `geoportal-backend` a partir de `__file__` e ajusta `sys.path` antes dos imports de `app.*`, permitindo a execucao direta a partir da raiz `geoportal-backend` sem `PYTHONPATH` manual. A senha sera lida no servidor com `getpass`, com confirmacao, nunca por argumento CLI. O modo `--dry-run` nao conecta ao banco e nao persiste nada. O repository administrativo usa bind parameters para consultar existencia e inserir em `mod_auth.usuarios`, recebe apenas `senha_hash` e nao recebe senha bruta. Esta etapa nao foi executada contra banco real e nao criou usuario operacional, credencial operacional, hash operacional documentado, token, sessao, cookie, JWT, CSRF, seed ou migration. Localmente, `tests/test_auth_service.py` passou com 26 testes de robustez de `ultimo_login_em` best effort, `tests/test_create_internal_user_admin.py` passou com 12 testes e a suite completa local passou com 264 testes. No servidor, git pull aplicado; `tests/test_auth_service.py` passou com 26 testes, `tests/test_create_internal_user_admin.py` passou com 12 testes e a suite completa no servidor passou com 264 testes. No servidor, o dry-run foi validado sem `PYTHONPATH` manual usando `python scripts/admin/create_internal_user.py --login "admin.homologacao" --email "admin.homologacao@example.test" --nome "Administrador Homologacao" --dry-run`; o script pediu senha via `getpass` e retornou: "Dry-run validado. Nenhum usuario foi criado." Homologacao e producao foram reiniciadas e validadas pelo harness operacional `scripts/deploy/backend-restart-validate-service.ps1 -Environment Homologacao -Restart -Validate` e `-Environment Producao -Restart -Validate -CheckPublicProxy`; a API publica continuou saudavel. A criacao operacional deve ocorrer primeiro em homologacao, em etapa futura, com operador humano; nao usar migration ou seed para credencial operacional.

Atualizacao de identificador interno: o Geoportal Interno deve autenticar por `login` obrigatorio e senha. `email` e opcional, nao e requisito para criacao de usuario e nao deve ser usado como chave de autorizacao. A migration `0010_make_auth_user_email_optional.sql` foi criada para tornar `mod_auth.usuarios.email` nullable e manter unicidade de e-mail apenas quando informado. O script administrativo agora exige `--login` e `--nome`, aceita `--email` opcional, continua lendo senha via `getpass` e nao aceita `--password`. Naquela etapa, nenhum usuario real, endpoint de login, cookie, CSRF, JWT, token real, sessao real ou segredo foi criado.

## Status e roadmap

### Concluído e validado
- Schema `mod_auth` criado e validado.
- Hash de senha Argon2id implementado.
- Serviço de sessão opaca/token implementado.
- Repository interno de usuários criado.
- Repository interno de sessões criado.
- Repository interno de auditoria de login criado.
- Service puro de rate limit implementado.
- `auth_service.py` com auditoria e rate limit integrado.
- Service interno de validação de sessão autenticada implementado.
- Service puro de transporte de token implementado.
- Dependency FastAPI interna de autenticação criada.
- Router técnico de smoke auth `GET /api/internal/auth/smoke` criado e testado isoladamente.
- `GEOPORTAL_INTERNAL_ROUTES_ENABLED` conectada ao app principal em `geoportal-backend/app/main.py` e aplicada ao `include_router` do router técnico interno.
- Feature flag fail-closed validada em homologação com `/api/internal/auth/smoke` retornando `404` quando a flag estava desligada/ausente.
- Feature flag fail-closed validada em produção pública com `/api/internal/auth/smoke` retornando `404` quando a flag estava desligada/ausente.
- A API pública continuou saudável em homologação e produção.
- `GEOPORTAL_INTERNAL_ROUTES_ENABLED` ativada somente em homologação para smoke controlado.
- `GEOPORTAL_INTERNAL_SESSION_SECRET` configurada somente no serviço `GeoportalAPIHomologacao` via NSSM, fora do Git, sem valor real documentado.
- Homologação reiniciada e validada pelo harness operacional `scripts/deploy/backend-restart-validate-service.ps1 -Environment Homologacao -Restart -Validate`.
- Em homologação, `/api/internal/auth/smoke` retornou `401`, confirmando rota ativa e protegida.
- Em produção pública, `/api/internal/auth/smoke` continuou retornando `404`, confirmando a rota interna não exposta.
- Script administrativo de reset de senha criado e testado: `tests/test_reset_internal_user_password_admin.py` passou com 12 testes; sem endpoint, sem migration, sem schema novo e sem execucao contra banco real nesta etapa.
- Validação do script administrativo de usuário interno implementado: testes automatizados `tests/test_create_internal_user_admin.py` passaram com 12 testes localmente e no servidor; suite completa de 264 testes passou localmente e no servidor.
- Reinício operacional e validação realizados pelo harness operacional `scripts/deploy/backend-restart-validate-service.ps1`.
- Harnesses/metodologia de validação do projeto aplicados.
- Migration `0010_make_auth_user_email_optional.sql` foi aplicada em homologação e no banco ativo de produção.
- Email agora é opcional em `mod_auth.usuarios`; login permanece obrigatório como identificador principal.
- Testes automatizados de autenticação passaram localmente com 298 testes no total, incluindo 14 testes do login/logout/cookie interno, 15 `test_auth_dependencies`, 12 testes do reset administrativo, 26 `test_auth_service` com robustez de `ultimo_login_em` best effort, 17 `test_create_internal_user` e 9 `test_auth_user_repository`.
- Validação operacional da migração 0010 realizada pelo harness operacional em homologação e produção: `/api/health`, `/api/public/iluminacao/health` e `/api/version` permaneceram OK; tabelas `mod_auth.usuarios`, `mod_auth.sessoes` e `mod_auth.login_auditoria` permaneceram vazias após aplicação.
- Naquela etapa, nenhum usuario real, endpoint de login, sessao real, token real, cookie real, CSRF ou JWT havia sido criado. Em etapas posteriores, o primeiro usuario `admin.homologacao` foi criado somente em homologacao, o endpoint de login foi criado sob feature flag e o transporte por cookie/logout/header mutavel inicial foi implementado no backend.

### Decisão de arquitetura — Escalabilidade multi-módulo e usuários técnicos

Registro de decisão: Tentativa realizada de usar `api_iluminacao_homolog` (usuário técnico restrito ao módulo de Iluminação Pública) para executar o script administrativo `create_internal_user.py`. A conexão ao banco funcionou, mas o acesso a `mod_auth` foi negado, confirmando que o usuário técnico está corretamente restrito ao seu escopo. Decisão tomada:

1. **Manter restrição de usuários técnicos de módulos**: `api_iluminacao_homolog` permanece restrito a `mod_iluminacao` em homologação; `api_iluminacao_producao` permanece restrito a `mod_iluminacao` em produção. Não ampliar automaticamente para `mod_auth`.

2. **Separação clara entre usuários humanos e técnicos**: Usuários humanos são armazenados em `mod_auth.usuarios` com login, senha e dados pessoais. Usuários técnicos são contas PostgreSQL com permissões mínimas limitadas a schemas específicos. Permissões de aplicação de usuários humanos são controladas em `mod_auth.perfis` e `mod_auth.permissoes`, não em roles PostgreSQL.

3. **Escalabilidade transversal**: O Geoportal Interno é arquiteturado para suportar múltiplos módulos futuros. Cada módulo permanece em seu schema (ex: `mod_iluminacao`). Autenticação/autorização é centralizada em `mod_auth` de forma transversal. Um usuário humano em `mod_auth.usuarios` pode ter diferentes perfis e permissões em diferentes módulos, controlados via `mod_auth.usuario_perfis` e `mod_auth.perfil_permissoes`.

4. **Roles tecnicas futuras necessarias**: Para bootstrap inicial em homologacao, a role tecnica `geoportal_auth_admin_homolog` foi criada com permissoes minimas para inserir o primeiro usuario interno. Ela nao deve ser usada como role runtime do endpoint de login. Para a futura API interna de autenticacao em homologacao, planejar role separada sugerida como `geoportal_api_homolog`, com permissao minima apenas sobre `mod_auth.usuarios`, `mod_auth.sessoes`, `mod_auth.login_auditoria` e sequences estritamente necessarias. A criacao real dessa role sera etapa operacional separada com backup, inspecao, execucao manual e validacao. Nenhuma role runtime real sera criada nesta etapa documental.

5. **Nada em producao nesta etapa**: Nenhuma role runtime real e nenhuma alteracao em producao nesta etapa documental. O endpoint de login foi implementado apenas sob feature flag; o usuario `admin.homologacao` existe somente em homologacao por bootstrap operacional anterior.

### Preparado, mas ainda não exposto amplamente
- Dependency FastAPI interna existe e ja protege o smoke tecnico e o logout.
- Router tecnico de smoke auth e endpoints de login/logout existem apenas sob feature flag.
- `geoportal-backend/app/main.py` inclui rotas internas somente quando `GEOPORTAL_INTERNAL_ROUTES_ENABLED` esta ativa.
- `GEOPORTAL_INTERNAL_SESSION_SECRET` documentado como configuração futura no código; valor real foi aplicado somente no serviço `GeoportalAPIHomologacao` via NSSM, fora do Git.
- Cookie HttpOnly/Secure/SameSite=Lax implementado como transporte principal de navegador.
- Bearer permanece alternativa tecnica/intermediaria.

### Pendente
- Validar cookie/logout/header interno em homologacao controlada.
- Avaliar validacao complementar de Origin/Referer antes de uso amplo, se necessaria.
- Criar endpoint `/me` real.

### Bootstrap operacional concluído

A role PostgreSQL `geoportal_auth_admin_homolog` foi criada em homologação para permitir bootstrap seguro de usuários internos:

- **Backup préoperacional**: `pg_dumpall -g` executado e validado.
- **SQL revisado manualmente**: Role criada sem superuser, sem createdb, sem createrole; com permissões mínimas exatamente especificadas em `geoportal-backend/db/security/README.md`.
- **Execução operacional**: SQL executado manualmente em terminal contra banco de homologação.
- **Validação de permissões**: CONNECT ✓, USAGE mod_auth ✓, SELECT usuarios ✓, INSERT usuarios ✓, USAGE sequence ✓, SELECT sequence ✓, sem DELETE/UPDATE/CREATE.
- **Primeiro usuário administrativo criado**: `admin.homologacao` criado com sucesso via `geoportal-backend/scripts/admin/create_internal_user.py` usando role bootstrap:
  - Login: `admin.homologacao`
  - Nome: `Administrador Homologacao`
  - Email: `NULL` (opcional conforme Migration 0010)
  - Ativo: `true`
  - Hash: Argon2id, não documentado
- **Validação do usuário**: Conexão bem-sucedida, INSERT confirmado, sequence avançou, `mod_auth.usuarios` inserida e acessível.
- **Validação de serviço**: Restart via harness `scripts/deploy/backend-restart-validate-service.ps1 -Environment Homologacao -Restart -Validate`, health checks OK (`/api/health`, `/api/public/iluminacao/health`, `/api/version`).
- **Estado de produção**: Não alterado; todas operações restritas a homologação.
- **Proxima etapa recomendada**: Nao ampliar automaticamente `geoportal_auth_admin_homolog` para login runtime; planejar role separada `geoportal_api_homolog` em etapa operacional futura, inicialmente limitada ao login e validacao de sessao em `mod_auth`.
- Criar autorização/perfis/permissões.
- Criar primeiro módulo interno de negócio.

Este documento complementa `docs/INTERNAL-AUTH-TECHNICAL-DECISIONS.md`, que registra as decisões técnicas iniciais de autenticação, sessão, transporte de token e autorização.

## 1. Objetivo

- Orientar a implementacao futura da autenticacao interna do Geoportal.
- Criar autenticacao segura desde o inicio.
- Impedir criacao de endpoint interno publico por engano.
- Proteger dados pessoais, dados operacionais e acoes administrativas.
- Servir todos os modulos internos futuros, nao apenas Iluminacao Publica.

## 2. Escopo

Inclui:

- Login interno.
- Validacao de senha.
- Hash de senha.
- Sessao ou token.
- Expiracao.
- Revogacao.
- Auditoria de login.
- Autorizacao por perfil e permissao.
- Protecao contra brute force.
- Logs seguros.
- Testes automatizados.

Fora do escopo desta etapa:

- Criar codigo.
- Criar endpoint.
- Criar tela.
- Cadastrar usuario real.
- Definir senha real.
- Abrir acesso publico interno.

## 3. Modelo de Ameaca

Possiveis formas de ataque a considerar durante a implementacao:

- Tentativa de forca bruta no login.
- Credential stuffing com credenciais vazadas de outros servicos.
- Enumeracao de usuarios por mensagens de erro diferentes.
- Roubo de token por log, URL, armazenamento inseguro no cliente ou trafego sem HTTPS.
- Replay de token ainda valido.
- Sessao sem expiracao.
- Sessao sem revogacao.
- Acesso a endpoint interno sem autenticacao.
- Usuario autenticado acessando solicitacao de outro setor sem permissao.
- Alteracao de status sem autorizacao.
- Consulta de dados pessoais em listagem ampla.
- Abuso de CORS.
- Vazamento de senha, token, hash ou `DATABASE_URL` em log.
- SQL injection por parametros de login.
- Mass assignment em endpoints internos.
- Autorizacao aplicada apenas no front-end.
- Permissoes conferidas apenas por cargo textual, sem validacao no backend.
- IDOR/BOLA em endpoints com identificadores, como `/solicitacoes/{id}`.
- CSRF se cookies forem usados futuramente.
- XSS no painel interno roubando token ou dados de sessao.
- Uso indevido de conta inativa ou bloqueada.
- Falta de auditoria dificultando investigacao.

## 4. Controles Obrigatorios

- Todo endpoint `/api/internal/...` deve exigir autenticacao.
- Todo endpoint `/api/internal/...` deve exigir autorizacao por permissao.
- Autorizacao deve ocorrer sempre no backend.
- O front-end pode esconder botoes, mas isso nunca substitui seguranca no backend.
- Nenhum token ou senha deve trafegar em URL.
- HTTPS deve ser obrigatorio em producao.
- CORS deve ser restrito ao dominio autorizado.
- Falha de login deve retornar resposta generica.
- Tentativas excessivas devem causar bloqueio temporario ou atraso progressivo.
- Login deve ter rate limit.
- Endpoints internos sensiveis devem ter rate limit.
- Senha deve ser armazenada apenas como hash forte.
- Senha nunca deve ser registrada em log.
- Token bruto nunca deve ser persistido.
- O banco deve guardar apenas `token_hash` ou identificador seguro equivalente.
- Sessao ou token deve ter expiracao obrigatoria.
- Sessao ou token deve poder ser revogado.
- Usuario inativo nao deve acessar.
- Usuario bloqueado nao deve acessar.
- Logout deve revogar sessao ou token quando aplicavel.
- Alteracao futura de senha deve revogar sessoes anteriores.
- Erros nao devem revelar se o usuario existe.
- Logs de auditoria nao devem conter senha, token, hash de senha, `DATABASE_URL` ou dados pessoais desnecessarios.

## 5. Estrategia de Senha

- Usar algoritmo proprio para senha, como Argon2id ou bcrypt, por biblioteca consolidada.
- Nao usar SHA simples, MD5 ou hash caseiro.
- Armazenar apenas `senha_hash`.
- Nunca armazenar senha em texto puro.
- Definir politica minima de senha antes do cadastro real.
- Considerar exigencia futura de troca de senha inicial.
- Considerar fluxo futuro de rotacao ou redefinicao segura.
- Nao inserir senha real por migration.
- Nao criar usuario administrador por migration publica.

## 6. Estrategia de Token e Sessao

Decisao tecnica a ser tomada antes do codigo:

- Opcao A: sessao opaca com token aleatorio forte e `token_hash` no banco.
- Opcao B: JWT curto com controle de revogacao.

Recomendacao inicial:

- Preferir sessao opaca para o primeiro modulo interno, por facilitar revogacao e reduzir exposicao.
- Entregar token bruto apenas ao cliente.
- Guardar no banco apenas `token_hash`.
- Usar expiracao curta.
- Tratar refresh token, se existir futuramente, como mecanismo separado.
- Nao gravar token em log.
- Nao enviar token por query string.
- Usar `Authorization: Bearer` ou cookie seguro, conforme decisao futura.
- Se usar cookie, planejar `HttpOnly`, `Secure`, `SameSite` e protecao contra CSRF.

## 7. Estrategia de Autorizacao

- Permissoes devem ser consultadas no backend usando `mod_auth`.
- Separar autenticacao de autorizacao.
- Verificar usuario ativo.
- Verificar usuario nao bloqueado.
- Verificar sessao valida.
- Verificar permissao ativa.
- Verificar vinculo ativo.
- Verificar escopo por modulo.
- Aplicar menor privilegio.
- Endpoints de solicitacao por ID devem validar permissao e escopo.
- Listagens devem filtrar dados conforme perfil.
- Acoes sensiveis exigem permissao especifica, nao apenas login valido.

## 8. Protecao de Dados Pessoais

- Listagens internas devem retornar o minimo necessario.
- Detalhes sensiveis devem aparecer apenas para perfil autorizado.
- Contato do cidadao deve ser minimizado.
- Observacoes internas nunca aparecem na consulta publica.
- Historico administrativo nunca aparece na consulta publica.
- Logs tecnicos nao devem carregar corpo completo da requisicao quando houver dado pessoal.
- Exports futuros devem ter controle de acesso.

## 9. Auditoria

- Login bem-sucedido deve registrar evento.
- Falha de login deve registrar evento generico.
- Logout ou revogacao futura deve registrar evento.
- Alteracao de status deve registrar historico.
- Criacao de observacao deve registrar observacao e evento resumido.
- Acao administrativa deve registrar `usuario_id`, origem e data/hora.
- Auditoria nao deve ser editavel por usuario comum.
- Evitar `DELETE` fisico de auditoria operacional.

## 10. Configuracao Segura

- Secrets devem ficar fora do Git.
- `DATABASE_URL` deve ficar fora do Git.
- Chaves de assinatura devem ficar fora do Git.
- Se houver JWT, segredo de token deve vir de variavel de ambiente obrigatoria.
- Modo debug deve ficar falso em producao.
- CORS deve ser restrito.
- HTTPS deve ser obrigatorio.
- Servidor nao deve expor documentacao interna em producao sem controle, caso existam endpoints internos.
- Logs devem usar nivel adequado e evitar dados sensiveis.

## 11. Banco de Dados e Menor Privilegio

- Usuario da API publica nao deve acessar tabelas `mod_auth`.
- Usuario da API interna deve ter GRANTs minimos.
- GRANTs devem ser etapa separada e documentada.
- Evitar superuser.
- Evitar permissoes de `DELETE` em auditoria.
- Separar permissoes de leitura e escrita conforme necessidade.

### Role runtime planejada para homologacao

`geoportal_api_homolog` fica registrada como sugestao de futura role runtime da API interna em homologacao. Ela ainda nao deve ser criada nesta etapa. A role `geoportal_auth_admin_homolog` ja criada serve apenas para bootstrap administrativo e nao deve ser usada pelo futuro endpoint de login.

Matriz minima prevista:

- `CONNECT` no banco de homologacao.
- `USAGE` no schema `mod_auth`.
- `mod_auth.usuarios`: `SELECT`; `UPDATE` somente para `ultimo_login_em` e `atualizado_em`; sem `INSERT`; sem `DELETE`.
- `mod_auth.sessoes`: `SELECT`; `INSERT`; `UPDATE` para revogacao de sessao; sem `DELETE`.
- `mod_auth.login_auditoria`: `SELECT`; `INSERT`; sem `UPDATE`; sem `DELETE`.
- Sequences: `USAGE` e `SELECT` em `mod_auth.sessoes_id_seq` e `mod_auth.login_auditoria_id_seq`.
- Sem `CREATE`, `DROP`, `ALTER`, `TRUNCATE`, `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION` ou `BYPASSRLS`.
- Sem acesso automatico a `plano`, `web_map` ou `mod_iluminacao`.
- Sem usar `postgres` como usuario runtime e sem ampliar `api_iluminacao_homolog` para `mod_auth`.

Permissoes de aplicacao permanecem em `mod_auth.perfis`, `mod_auth.permissoes`, `mod_auth.usuario_perfis` e `mod_auth.perfil_permissoes`. Roles PostgreSQL controlam apenas acesso tecnico minimo. A criacao real de `geoportal_api_homolog` deve ser etapa operacional separada, sem producao, com backup de roles, comandos revisados e validacao de permissoes. O endpoint de login deve ser etapa separada, com testes e feature flag ou controle equivalente de exposicao.

## 12. Testes Automatizados Obrigatorios

Antes de expor qualquer endpoint interno, os testes devem cobrir:

- Login com credencial valida.
- Login com senha invalida.
- Login de usuario inativo.
- Login de usuario bloqueado.
- Resposta generica em falha.
- Rate limit ou bloqueio apos tentativas excessivas.
- Token expirado negado.
- Token revogado negado.
- Acesso sem token negado.
- Acesso com token invalido negado.
- Acesso autenticado mas sem permissao negado.
- Acesso com permissao concedida permitido.
- Tentativa de acessar solicitacao fora do escopo negada.
- Logs nao contem senha ou token.
- Endpoint publico nao expoe dados internos.
- CORS de origem nao autorizada negado.

## 13. Criterios de Aceite para Iniciar Codigo

- Plano revisado.
- Decisao de sessao/token tomada.
- Bibliotecas definidas.
- Estrategia de teste definida.
- Nenhum endpoint interno sera criado sem dependency ou middleware de autenticacao.
- Nenhum dado real sera usado em teste automatizado.
- Rollback operacional entendido.
- Documentacao atualizada.

## 14. Roadmap Seguro

1. ✓ Documentar threat model e controles.
2. ✓ Escolher bibliotecas e estratégia de sessão/token.
3. ✓ Implementar serviço interno de hash/verificação de senha sem endpoint público.
4. ✓ Implementar serviço de sessão/token sem endpoint público.
5. ✓ Implementar repository de auditoria de login sem endpoint público.
6. ✓ Implementar service puro de rate limit sem endpoint público.
7. ✓ Integrar auditoria e rate limit ao `auth_service.py` antes de criar endpoint.
8. ✓ Implementar service interno de validação de sessão autenticada sem endpoint.
9. ✓ Implementar service puro de transporte de token sem endpoint.
10. ✓ Criar dependency FastAPI interna sem aplicar a endpoint real.
11. ✓ Criar router técnico protegido de smoke sem incluir no app principal.
12. ✓ Criar base de feature flag fail-closed para rotas internas, sem ativar router.
13. ✓ Conectar feature flag ao registro controlado do router tecnico de smoke.
14. → Implementar atraso progressivo e bloqueio temporário persistente integrados.
15. → Validar flag desligada no servidor e ativar smoke somente em homologação controlada.
16. ✓ Criar endpoint de login sob feature flag com auditoria/rate limit integrados.
17. → Criar endpoints internos mínimos, todos protegidos.
18. → Criar tela interna mínima.
19. → Fazer revisão de segurança antes de uso por equipe real.

## 15. Checklist de Validacao Final

- [ ] Autenticacao obrigatoria.
- [ ] Autorizacao obrigatoria.
- [ ] Sessao expira.
- [ ] Sessao revoga.
- [ ] Brute force mitigado.
- [ ] Logs limpos.
- [ ] CORS restrito.
- [ ] HTTPS.
- [ ] Dados pessoais minimizados.
- [ ] Testes automatizados passando.
- [ ] API publica sem regressao.
- [ ] Documentacao atualizada.
