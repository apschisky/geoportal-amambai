# Decisões Técnicas da Autenticação Interna

## 1. Objetivo

Este documento define as decisões técnicas iniciais para implementar autenticação e sessão interna do Geoportal com segurança.

Ele complementa o plano de segurança já existente e orienta a implementação, os testes, a revisão e a documentação da autenticação interna.

Pontos importantes:

- A autenticação será transversal para todos os módulos internos futuros, não apenas Iluminação Pública.
- Nenhum endpoint `/api/internal/...` deve existir sem autenticação e autorização.
- Estas decisões devem orientar implementação, testes, revisão de segurança e documentação.
- O documento não implementa código, endpoints, telas, migrations, usuários reais, senhas reais, tokens reais ou acesso interno público.

## 1.1 Status de implementação atual

- Concluído e validado:
  - Schema `mod_auth` criado e validado.
  - Hash de senha Argon2id implementado.
  - Serviço de sessão opaca/token implementado.
  - Repository interno de usuários criado.
  - Repository interno de sessões criado.
  - Repository interno de auditoria de login criado.
  - Service puro de rate limit implementado.
  - `auth_service.py` com auditoria e rate limit integrado.
  - Atualização de `ultimo_login_em` tornada best effort via try/except para reduzir risco de inconsistência; sessão autenticada permanece válida se falhar.
  - Testes de robustez de auditoria e tratamento de exceções passaram em `tests/test_auth_service.py` com 26 testes.
  - Service interno de validação de sessão autenticada implementado.
  - Service puro de transporte de token implementado.
  - Dependency FastAPI interna de autenticação criada.
  - Router técnico de smoke auth `GET /api/internal/auth/smoke` criado e validado isoladamente.
  - Endpoint interno de login `POST /api/internal/auth/login` criado sob feature flag, chamando `auth_service.authenticate_user(...)`.
  - Feature flag `GEOPORTAL_INTERNAL_ROUTES_ENABLED` implementada com comportamento fail-closed.
  - Script administrativo `scripts/admin/reset_internal_user_password.py` criado para redefinir senha de usuario interno existente por login, com `getpass`, sem senha/hash por argumento e com `--dry-run` sem banco.
  - Repository administrativo possui update parametrizado de senha por login, alterando somente `senha_hash` e `atualizado_em`.
  - Transporte principal por cookie HttpOnly implementado no login interno, com nome `geoportal_internal_session`, SameSite=Lax, Path `/api/internal`, Max-Age alinhado a sessao e Secure configuravel com padrao seguro em producao.
  - Endpoint `POST /api/internal/auth/logout` criado sob feature flag, com revogacao por `revogado_em` e limpeza de cookie, sem DELETE fisico.
  - Protecao CSRF/equivalente inicial implementada para rotas internas mutaveis protegidas por header `X-Geoportal-Internal-Request: 1`; login e GET de smoke ficam fora dessa exigencia.
  - Bearer permanece aceito como suporte tecnico/intermediario e para clientes nao navegador, mas o fluxo principal de navegador passa a ser cookie HttpOnly.
  - Testes automatizados locais passaram: 298 testes no total, incluindo 14 testes do endpoint interno de login/logout/cookie, 15 `test_auth_dependencies`, 12 testes do reset administrativo, 26 `test_auth_service`, 17 `test_create_internal_user` e 9 `test_auth_user_repository`.
  - Migration `0010_make_auth_user_email_optional.sql` aplicada em homologação e produção.
  - Email agora é opcional; login permanece obrigatório como identificador principal de autenticação.
  - Validação operacional realizada pelo harness operacional em homologação e produção: `/api/health`, `/api/public/iluminacao/health` e `/api/version` permaneceram OK.
  - Tabelas `mod_auth.usuarios`, `mod_auth.sessoes` e `mod_auth.login_auditoria` permaneceram vazias após aplicação.

- Preparado, mas ainda não exposto:
  - Dependency FastAPI interna existe, mas não está aplicada a endpoint real.
  - Router de smoke auth existe, mas não está incluído no app principal.
  - `geoportal-backend/app/main.py` e `geoportal-backend/app/api/router.py` não foram alterados.
  - `GEOPORTAL_INTERNAL_SESSION_SECRET` documentado como configuração futura, sem valor real no repositório.
  - Cookie HttpOnly/Secure/SameSite esta implementado como transporte principal para navegador.
  - Bearer permanece alternativa tecnica/intermediaria, nao fluxo principal de navegador.

- Pendente:
  - Feature flag para ativar rotas internas.
  - Incluir router interno no app apenas por feature flag.
  - Configurar segredo real somente no servidor, fora do Git.
  - Criar primeiro usuário interno por script administrativo seguro.
  - Validar endpoint de login em homologação controlada antes de qualquer exposição operacional.
  - Avaliar validacao complementar de Origin/Referer para rotas internas mutaveis.
  - Criar endpoint `/me` real.
  - Criar autorização/perfis/permissões.
  - Criar primeiro módulo interno de negócio.

## 2. Princípios de segurança

- Segurança no backend, não apenas no frontend.
- Menor privilégio para contas, serviços e permissões.
- Autenticação separada de autorização.
- Sessão/token revogável.
- Senha nunca armazenada em texto puro.
- Token bruto nunca armazenado no banco.
- Logs sem senha, token, hash real ou payload sensível.
- Nenhuma conta administrativa criada por migration pública.
- Nenhum dado real em teste automatizado.
- Nenhum endpoint interno sem teste de acesso negado.
- Resposta de login inválido sempre genérica.
- Redefinicao administrativa de senha deve ocorrer por ferramenta operacional controlada, com `getpass`, sem senha/hash por CLI, sem endpoint dedicado e sem tentativa de recuperar senha a partir de hash.

## 3. Decisão sobre hash de senha

### Opção A — Argon2id

- Algoritmo moderno recomendado para hashing de senha.
- Resistente a ataques com GPU quando bem configurado.
- Permite parâmetros de memória, tempo e paralelismo.
- Adequado para novas aplicações.

Prós:

- Forte para senhas.
- Recomendado para sistemas novos.
- Parametrização robusta.
- Melhor resistência a hardware especializado.

Contras:

- Exige biblioteca confiável instalada no backend.
- Configuração inadequada pode afetar desempenho.
- Precisa testar compatibilidade no ambiente Windows/serviço.

Riscos:

- Parâmetros altos demais podem causar lentidão.
- Parâmetros baixos demais reduzem segurança.
- Usar biblioteca sem manutenção seria inadequado.

### Opção B — bcrypt

- Algoritmo consolidado e amplamente usado.
- Mais simples operacionalmente.
- Boa compatibilidade com bibliotecas Python.

Prós:

- Muito conhecido.
- Fácil de testar.
- Suporte amplo.
- Boa opção se Argon2id gerar problema operacional.

Contras:

- Menos moderno que Argon2id.
- Limitações históricas de tamanho de senha dependendo da biblioteca.
- Custo parametrizado principalmente por fator de trabalho.

### Opção C — SHA/MD5/hash caseiro

Proibida.

Explicação:

- SHA simples, MD5, SHA256 direto, hash caseiro ou criptografia reversível não devem ser usados para senha.
- Não possuem proteção adequada contra ataques offline.
- Não têm salt/custo adaptativo adequados por padrão.

### Decisão recomendada

- Usar Argon2id como primeira escolha.
- Usar bcrypt como alternativa aceitável se houver impeditivo operacional.
- Nunca usar SHA/MD5/hash caseiro.
- Armazenar somente `senha_hash` em `mod_auth.usuarios`.
- Nunca retornar `senha_hash` em endpoint.
- Nunca registrar senha ou hash em log.
- Criar usuário real apenas por fluxo administrativo seguro futuro, não por migration pública.

Status:

- Biblioteca escolhida para a implementacao inicial: `argon2-cffi` com Argon2id.
- Servico interno criado em `geoportal-backend/app/security/passwords.py`, apenas para hash e verificacao de senha.
- Repository interno de usuarios criado em `geoportal-backend/app/repositories/auth_user_repository.py`.
- O repository de usuarios busca por login com bind param `:login_informado`, usando comparacao case-insensitive via `lower(login)`. Login vazio ou so com espacos retorna `None` sem executar SQL. E-mail e opcional e nao e chave obrigatoria de autenticacao.
- O repository de usuarios pode ler `senha_hash` somente em record interno para verificacao futura no backend; `senha_hash` nunca deve ser retornado por endpoint.
- O repository registra `ultimo_login_em` e `atualizado_em` em login bem-sucedido, sem alterar `senha_hash`, sem criar sessão e sem criar auditoria.
- Servico interno de sessao opaca criado em `geoportal-backend/app/security/sessions.py`.
- Repository interno de sessoes criado em `geoportal-backend/app/repositories/auth_session_repository.py`.
- O repository opera com `mod_auth.sessoes` usando `token_hash` e nunca persiste o token bruto.
- A busca de sessao ativa filtra `token_hash` parametrizado, `revogado_em IS NULL`, `expira_em > now()` e o estado do usuário (ativo, não desativado, não bloqueado).
- Revogacao usa `UPDATE ... SET revogado_em = now()`, sem `DELETE`.
- Service interno de autenticacao/sessao criado em `geoportal-backend/app/services/auth_service.py`, sem endpoint e sem login exposto.
- O service orquestra busca de usuario, verificacao de senha, geracao de token opaco, persistencia de `token_hash`, expiracao, revogacao e registro de `ultimo_login_em`.
- Falhas de autenticacao retornam resultado generico interno (`None`), sem distinguir usuario inexistente, senha invalida, usuario inativo, desativado ou bloqueado.
- Repository interno de auditoria de login criado em `geoportal-backend/app/repositories/auth_login_audit_repository.py`.
  - Funcoes expostas: `record_login_attempt(...)` e `count_recent_failed_attempts(...)`.
  - Campos auditados: `usuario_id`, `login_informado`, `sucesso`, `motivo_falha`, `criado_em`, `origem`.
  - O repository nao registra senha, senha_hash, token, token_hash, session_secret ou corpo bruto de requisicao.
  - Usa parametrizacao SQL para INSERT e SELECT count(*).
- Service puro de rate limit de login criado em `geoportal-backend/app/services/auth_rate_limit_service.py`.
  - Expoe `LoginRateLimitDecision` e `evaluate_login_rate_limit(...)`.
  - Decisao baseada em `failed_attempts`, `max_attempts` e `window_minutes`.
  - A decisao nao depende da existencia do usuario e nao revela se usuario existe.
  - Sem dependencia de FastAPI ou banco de dados; apenas logica pura.
- Auditoria e rate limit foram integrados ao `auth_service.py` antes de qualquer endpoint de login; o rate limit e avaliado antes de verificar senha.
- Auditoria registra sucesso/falha sem incluir senha, senha_hash, token, token_hash ou session_secret.
- Service interno de validacao de sessao autenticada criado em `geoportal-backend/app/services/auth_current_session_service.py`, sem endpoint, sem rota, sem middleware e sem dependency FastAPI.
- A validacao de sessao recebe token bruto e `session_secret` apenas internamente, calcula `token_hash`, consulta sessao ativa pelo repository e retorna apenas dados internos minimos (`usuario_id`, `sessao_id`, `expira_em`), sem retornar token bruto, `token_hash`, `session_secret`, senha ou `senha_hash`.
- Sessao invalida ou token vazio retorna `None`.
- `session_secret` invalido e erros de repository/banco sobem como erro interno, sem fallback inseguro.
- Service puro de transporte/extracao de token criado em `geoportal-backend/app/services/auth_token_transport_service.py`, sem FastAPI, sem `Request`, sem endpoint e sem middleware.
- Ele aceita apenas valores simples de `session_cookie` ou `Authorization: Bearer <token>`.
- Cookie valido retorna token com `transport = "cookie"`.
- Authorization Bearer valido retorna token com `transport = "bearer"`.
- Cookie e Bearer simultaneos produzem resultado ambiguo, sem escolher silenciosamente.
- Token ausente retorna `token = None`.
- Authorization malformado, Basic, Bearer sem token ou Bearer com partes extras retornam `is_malformed = True`.
- O resultado não mantém o `authorization_header` bruto nem o `session_cookie` bruto.
- Esse service não valida criptograficamente a sessão nem consulta o banco; ele apenas extrai e normaliza o token.
- A validação real de sessão continua em `auth_current_session_service.py`.
- Dependency FastAPI interna criada em `geoportal-backend/app/dependencies/auth_dependencies.py`, sem aplicar a endpoints reais.
- A dependency `get_current_authenticated_session(...)` compõe `extract_session_token(...)` de `auth_token_transport_service.py` e `resolve_authenticated_session(...)` de `auth_current_session_service.py`.
- Falhas de autenticação retornam `HTTPException 401` com detalhe genérico `Not authenticated`; a resposta não revela token ausente, token malformado, cookie+bearer simultâneos, sessão expirada, sessão revogada ou usuário inativo.
- `get_session_secret(...)` lê `GEOPORTAL_INTERNAL_SESSION_SECRET` apenas como configuração futura; nenhum valor real de segredo foi incluído no repositório e `.env` não foi alterado.
- Router técnico protegido de smoke test criado em `geoportal-backend/app/api/routes/internal_auth_smoke.py`, com rota `GET /api/internal/auth/smoke`.
- O router usa `Depends(get_current_authenticated_session)` e retorna apenas `authenticated`, `usuario_id` e `sessao_id`; nao retorna token, `token_hash`, `session_secret`, senha, `senha_hash`, nome, e-mail ou dado de negocio.
- O router de smoke e incluido no app principal somente quando `GEOPORTAL_INTERNAL_ROUTES_ENABLED` retorna `True`; com flag ausente, desligada ou invalida, a rota nao existe no app principal.
- Base de feature flag futura criada em `geoportal-backend/app/core/internal_routes_config.py` com `GEOPORTAL_INTERNAL_ROUTES_ENABLED`.
- A flag e fail-closed: ausencia, vazio, valor desligado ou valor invalido retornam `False`; apenas `true`, `1`, `yes` e `on` ativam o parser e incluem o router tecnico.
- O cookie interno `geoportal_internal_session` foi implementado para o login interno.
- `session_secret` é obtido por função injetável/testável; ausência de configuração crítica gera RuntimeError interno, sem valor real no repositório.
- Cookie HttpOnly/Secure/SameSite=Lax passa a ser o transporte principal para navegador; Bearer permanece alternativa tecnica/intermediaria.
- O servico de sessao usa token aleatorio forte (`secrets.token_urlsafe(32)`), HMAC-SHA256 e comparacao segura com `hmac.compare_digest`.
- O token bruto nao e persistido nem logado. O hash de sessao e prefixado com `hmac-sha256:`.
- A expiração usa `datetime` timezone-aware em UTC. A revogacao e tratada quando `revoked_at` esta preenchido.
- Validacao local desta etapa: `tests/test_internal_routes_feature_flag.py` passou com 9 testes; `tests/test_internal_routes_config.py` passou com 28 testes; `tests/test_internal_auth_smoke_router.py` passou com 7 testes; suite completa local passou com 245 testes.
- Validacao no servidor: git pull aplicado; testes no servidor passaram; homologacao, producao local e producao publica foram reiniciadas e validadas.
- Endpoints de saude confirmados saudaveis em homologacao, producao local e producao publica: `/api/health`, `/api/public/iluminacao/health`, `/api/version` retornaram status correto em todos os ambientes.
- O endpoint interno `POST /api/internal/auth/login` existe somente sob `GEOPORTAL_INTERNAL_ROUTES_ENABLED`, retorna 401 generico em falha e dados minimos em sucesso, incluindo token opaco bruto temporariamente no corpo. Em sucesso, tambem seta o cookie HttpOnly `geoportal_internal_session` com o token opaco bruto, SameSite=Lax, Path `/api/internal`, Max-Age alinhado a expiracao da sessao e Secure configuravel com padrao seguro em producao. Ainda nao ha JWT, middleware global ou exposicao publica do login. O usuario `admin.homologacao` existe somente em homologacao por bootstrap administrativo controlado.
- Proxima etapa: validar no servidor com a flag desligada e depois ativar somente em homologacao para smoke controlado. Classificacao de risco: Codex High.

Atualizacao preparatoria: a estrutura do script administrativo `geoportal-backend/scripts/admin/create_internal_user.py` foi criada para futura criacao manual do primeiro usuario interno, sem execucao contra banco real. O script usa `getpass` para senha e confirmacao, rejeita senha vazia, nao aceita senha por argumento CLI, usa `hash_password(...)`, possui `--dry-run` sem conexao ao banco e nao imprime senha ou hash. O bootstrap do script administrativo foi corrigido; o script agora calcula a raiz `geoportal-backend` a partir de `__file__` e ajusta `sys.path` antes dos imports de `app.*`, permitindo execucao direta a partir da raiz `geoportal-backend` sem `PYTHONPATH` manual. O repository administrativo usa SQLAlchemy `text(...)` com bind parameters para existencia e `INSERT` em `mod_auth.usuarios`, recebendo apenas `senha_hash`. Esta etapa nao criou usuario real, seed, migration, endpoint, cookie, JWT, CSRF, token ou sessao real. Localmente, `tests/test_auth_service.py` passou com 26 testes de robustez de `ultimo_login_em` best effort, `tests/test_create_internal_user_admin.py` passou com 12 testes e a suite completa local passou com 264 testes. No servidor, git pull aplicado; `tests/test_auth_service.py` passou com 26 testes, `tests/test_create_internal_user_admin.py` passou com 12 testes e a suite completa no servidor passou com 264 testes. No servidor, o dry-run foi validado sem `PYTHONPATH` manual usando `python scripts/admin/create_internal_user.py --login "admin.homologacao" --email "admin.homologacao@example.test" --nome "Administrador Homologacao" --dry-run`; o script pediu senha via `getpass` e retornou: "Dry-run validado. Nenhum usuario foi criado." Homologacao e producao foram reiniciadas e validadas pelo harness operacional, mantendo a API publica saudavel.

Atualizacao de validacao operacional de login real: commits `0baeeca` Corrige filtros opcionais da auditoria de login, `8431e0e` Adiciona reset administrativo de senha interna, `3ebfc4f` Adiciona endpoint interno de login foram aplicados. Testes: `tests/test_auth_login_audit_repository.py` passou com 6 testes; `tests/test_reset_internal_user_password_admin.py` passou com 12 testes; `tests/test_internal_auth_login_router.py` passou com 5 testes; pytest completo passou com 283 testes no servidor. Role `geoportal_api_homolog` foi criada em homologacao com permissoes runtime minimas: CONNECT, USAGE mod_auth, SELECT mod_auth.usuarios, SELECT/INSERT mod_auth.sessoes. Validacao operacional realizada em processo isolado em homologacao: POST /api/internal/auth/login status 200, authenticated true, usuario_id 7, token presente; GET /api/internal/auth/smoke status 200, authenticated true, sessao_id presente. Contadores apos teste: usuarios=1, sessoes=1, login_auditoria=1. Nenhuma alteracao em producao, NSSM, .env versionado ou migration. Em etapa posterior, o transporte principal por cookie HttpOnly foi implementado no backend.

Atualizacao de validacao operacional de cookie HttpOnly, logout e protecao mutavel inicial: commit `eaf5724` Implementa cookie e logout internos foi aplicado no servidor e validado com pytest completo: 298 passed. A validacao operacional foi realizada em processo isolado em homologacao, sem alterar NSSM, sem alterar producao e sem alterar `.env` versionado. O processo usou variaveis temporarias: `DATABASE_URL` temporaria com `geoportal_api_homolog`, `GEOPORTAL_INTERNAL_ROUTES_ENABLED`, `GEOPORTAL_INTERNAL_SESSION_SECRET`, `GEOPORTAL_INTERNAL_SESSION_COOKIE_SECURE=false` para TestClient/local e `TEST_INTERNAL_PASSWORD`; todas foram limpas apos o teste.

Resultado sanitizado:

- Login: `login_status=200`, `login_authenticated=True`, `login_usuario_id=7`, `login_login=admin.homologacao`, `login_tem_token_no_corpo=True`, `login_set_cookie=True`, `cookie_jar_tem_sessao=True`, `cookie_httponly=True`, `cookie_samesite_lax=True`, `cookie_path_internal=True`.
- Smoke com cookie: `smoke_cookie_status=200`, `smoke_authenticated=True`, `smoke_usuario_id=7`, `smoke_tem_sessao_id=True`.
- Protecao mutavel: `POST /api/internal/auth/logout` sem header retornou 403; header exigido `X-Geoportal-Internal-Request: 1`; login e `GET /api/internal/auth/smoke` nao exigem esse header.
- Logout: `logout_status=200`, `logout_logged_out=True`, `logout_limpa_cookie=True`, `cookie_jar_tem_sessao_apos_logout=False`, `smoke_apos_logout_status=401`.
- Contagens apos teste: `mod_auth.usuarios=1`, `mod_auth.sessoes=2`, `mod_auth.login_auditoria=2`, `sessoes_revogadas=1`.

A validacao confirmou cookie HttpOnly, SameSite=Lax, Path `/api/internal`, sessao opaca, revogacao logica por `revogado_em`, sem DELETE fisico, Bearer ainda como suporte tecnico/intermediario e cookie como transporte principal planejado para navegador. Proximos passos: decidir quando remover o token do corpo da resposta ou restringi-lo a ambiente tecnico, planejar Origin/Referer como camada complementar, e criar endpoints internos de negocio somente apos autorizacao por perfis/permissoes e frontend seguro.

Atualizacao de identificador interno: o login passa a ser o identificador obrigatorio de autenticacao do Geoportal Interno. E-mail e opcional para cadastro e nao deve ser usado como chave obrigatoria de login, permissao ou autorizacao. A migration `0010_make_auth_user_email_optional.sql` foi criada para tornar `mod_auth.usuarios.email` nullable e manter unicidade de e-mail apenas quando informado. O script administrativo agora exige `--login` e `--nome`, aceita `--email` opcional, continua lendo senha somente via `getpass` e mantem `--dry-run` sem banco. Naquela etapa, nenhum usuario real, endpoint de login, cookie, CSRF, JWT, token real, sessao real ou segredo foi criado.

## Decisão sobre Bloqueio/Desbloqueio de Usuário Interno

- Endpoints preferidos (documental): `POST /api/internal/admin/users/{usuario_id}/block` e `POST /api/internal/admin/users/{usuario_id}/unblock` para contrato explícito.
- Persistência: usar apenas `mod_auth.usuarios.bloqueado_ate` para registrar bloqueios; a API deve expor somente `bloqueado` booleano derivado (não retornar `bloqueado_ate`).
- Efeito: bloquear revoga sessões ativas atualizando `mod_auth.sessoes.revogado_em = now()` (revogação lógica sem DELETE); desbloquear limpa `bloqueado_ate` e não cria sessão.
- Proteções: exigir `GEOPORTAL_INTERNAL_ROUTES_ENABLED`, sessão autenticada, `require_permission("admin.usuarios.bloquear")` e header `X-Geoportal-Internal-Request: 1` para rotas mutáveis.
- Observação: esta decisão é documental — não aplicar migrations, roles, grants, código ou alterações em produção nesta etapa.

## 4. Política inicial de senha

Proposta inicial:

- Tamanho mínimo razoável.
- Aceitar frases-senha.
- Bloquear senhas vazias ou triviais.
- Não registrar senha em log.
- Avaliar troca obrigatória de senha inicial no futuro.
- Avaliar recuperação/redefinição segura no futuro.
- Não criar complexidade excessiva que incentive senha fraca anotada em local inseguro.
- Priorizar senha longa e única.

Observação:

- A política final pode ser ajustada conforme usuários internos e capacidade operacional.

## 5. Estratégia de sessão/token

### Opção A — Sessão opaca com token aleatório forte

- Backend gera token aleatório forte.
- Token bruto é entregue uma única vez ao cliente.
- O banco armazena somente `token_hash` em `mod_auth.sessoes`.
- A cada requisição, o backend calcula hash do token recebido e procura sessão válida.
- Permite expiração e revogação direta no banco.

Prós:

- Revogação simples.
- Controle centralizado.
- Reduz exposição caso o banco vaze.
- Combina com tabela `mod_auth.sessoes` já criada.
- Bom para primeira versão interna.
- Facilita logout e bloqueio de usuário.

Contras:

- Exige consulta ao banco/cache para validar sessão.
- Precisa cuidar de desempenho.
- Exige boa geração aleatória e hashing do token.
- Precisa definir política de expiração e limpeza de sessões.

Riscos:

- Token roubado continua válido até expirar/revogar.
- Se armazenado de forma insegura no cliente, pode ser roubado por XSS.
- Logs não podem registrar `Authorization` ou cookie.

### Opção B — JWT curto com assinatura

- Token assinado contém claims.
- Backend valida assinatura sem necessariamente consultar banco.
- Pode ter expiração curta.
- Revogação imediata exige lista de revogação, versionamento de sessão ou consulta complementar.

Prós:

- Validação rápida.
- Útil para arquiteturas distribuídas.
- Padrão conhecido.

Contras:

- Revogação mais complexa.
- Risco de excesso de dados dentro do token.
- Exige gestão segura de chave de assinatura.
- Erro de configuração pode comprometer segurança.
- Pode ser mais complexo que o necessário para a primeira versão interna.

Riscos:

- Token com dados sensíveis.
- Algoritmo/configuração errada.
- Chave exposta.
- Dificuldade de invalidar imediatamente.

### Decisão recomendada

- Para a primeira versão interna, usar sessão opaca com token aleatório forte.
- O banco armazena somente `token_hash`.
- A sessão tem expiração obrigatória.
- A sessão deve ser revogável.
- Logout deve revogar a sessão.
- Bloqueio/inativação de usuário deve impedir uso da sessão.
- Alteração de senha deve revogar sessões anteriores.
- JWT deve ficar como opção futura, se houver necessidade real.

Status:

- Servico interno criado em `geoportal-backend/app/security/sessions.py`, apenas para gerar token opaco, calcular `token_hash`, verificar token, preparar expiracao UTC e avaliar revogacao.
- Token opaco usa geracao criptograficamente segura; `token_hash` usa HMAC-SHA256 com segredo recebido por parametro.
- Segredo real de HMAC deve permanecer configurado somente em ambiente operacional controlado, fora do Git, antes de qualquer uso do endpoint de login.
- Repository interno de sessoes criado em `geoportal-backend/app/repositories/auth_session_repository.py`, operando apenas com `token_hash`, expiracao e revogacao por `revogado_em`.
- Service interno de validacao de sessao autenticada criado em `geoportal-backend/app/services/auth_current_session_service.py`, recebendo token bruto e `session_secret` para consultar sessao ativa por `token_hash`.
- Service puro de transporte de token criado em `geoportal-backend/app/services/auth_token_transport_service.py`, extraindo token de cookie ou bearer sem depender de FastAPI.
- Dependency FastAPI interna criada em `geoportal-backend/app/dependencies/auth_dependencies.py`.
- Router tecnico protegido de smoke criado em `geoportal-backend/app/api/routes/internal_auth_smoke.py`.
- Endpoint interno de login criado em `geoportal-backend/app/api/routes/internal_auth_login.py`, chamando `auth_service.authenticate_user(...)`, retornando 401 generico em falha e setando cookie HttpOnly em sucesso.
- Parser fail-closed da feature flag `GEOPORTAL_INTERNAL_ROUTES_ENABLED` criado em `geoportal-backend/app/core/internal_routes_config.py` e conectado ao `include_router` em `geoportal-backend/app/main.py`.
- Cookie HttpOnly, logout e protecao mutavel inicial por header customizado foram implementados no backend. Ainda nao ha JWT ou middleware global.
- A proxima etapa pode validar cookie/logout/header em homologacao controlada antes de integracao frontend/proxy.

## 6. Transporte do token no cliente

### Opção A — Authorization: Bearer

- Frontend envia token no cabeçalho `Authorization: Bearer`.
- Token precisa ser armazenado no cliente de alguma forma.

Prós:

- Simples para APIs.
- Fácil de testar com ferramentas.
- Não depende automaticamente de cookies.
- Reduz risco de CSRF tradicional.

Contras:

- Se armazenado em `localStorage/sessionStorage`, pode ser roubado por XSS.
- Exige cuidado rigoroso no frontend.
- Logs/proxy não podem registrar `Authorization`.

Riscos:

- XSS.
- Token em log.
- Token copiado indevidamente.

### Opção B — Cookie HttpOnly, Secure, SameSite

- Backend envia cookie seguro.
- JavaScript não acessa o token quando `HttpOnly` está ativo.
- Navegador envia cookie automaticamente conforme política.

Prós:

- Reduz risco de roubo por XSS.
- `HttpOnly` protege contra leitura direta por JavaScript.
- `Secure` exige HTTPS.
- `SameSite` reduz risco de CSRF.

Contras:

- Exige tratamento de CSRF dependendo do fluxo.
- Depende de domínio/subdomínio.
- Configuração com CORS e credenciais é mais delicada.
- Precisa validar bem em ambiente real com Apache/proxy.

Riscos:

- CSRF se `SameSite`/CSRF token forem mal configurados.
- Problemas com subdomínio.
- Cookies persistentes mal configurados.

### Decisão recomendada

- Não decidir definitivamente no escuro.
- Para a primeira API interna, avaliar duas possibilidades em homologação.
- Se o painel interno estiver no mesmo domínio/subdomínio controlado e houver capacidade de configurar cookie corretamente, preferir cookie `HttpOnly` + `Secure` + `SameSite`.
- Se a implementação inicial precisar de simplicidade operacional, `Authorization: Bearer` pode ser usado, desde que:
  - não use `localStorage` se houver alternativa mais segura;
  - não registre `Authorization` em log;
  - tokens sejam curtos e revogáveis;
  - XSS seja tratado como risco crítico.
- Documentar preferência técnica por sessão opaca.
- O transporte principal para navegador foi definido como cookie HttpOnly/Secure/SameSite=Lax.
- O endpoint inicial ainda retorna token opaco bruto no corpo da resposta de forma temporaria para compatibilidade tecnica; o cookie HttpOnly passa a ser o fluxo principal para navegador.

#### Decisão provisória

- Preferência técnica implementada: usar cookie `HttpOnly` + `Secure` + `SameSite=Lax` para navegador.
- A proteção mutável inicial usa header customizado `X-Geoportal-Internal-Request: 1` em rotas internas mutáveis protegidas.
- `Authorization: Bearer` fica como alternativa operacional/tecnica, não como primeira preferência para navegador.
- Se `Authorization: Bearer` for usado, evitar `localStorage` quando possível, não registrar `Authorization` em logs, usar sessão opaca revogável, expiração curta/moderada e validar risco de XSS.
- Validacao complementar de `Origin`/`Referer` permanece etapa futura antes de ativacao operacional ampla, se necessaria ao desenho de dominio/proxy.

#### Decisão arquitetural sobre transporte final e CSRF

**Validação técnica intermediária realizada em homologação**:

- Token opaco retornado no corpo da resposta de `POST /api/internal/auth/login` foi usado com `Authorization: Bearer` em validação técnica isolada em homologação.
- Smoke test `GET /api/internal/auth/smoke` foi validado com Bearer token.
- Esta abordagem foi aceita **apenas como validação técnica intermediária**, sem uso real por usuários finais.
- Nenhum cookie real, CSRF ou frontend de usuários havia sido criado nesta validação intermediaria. Em etapa posterior, cookie HttpOnly e header mutavel inicial foram implementados no backend, ainda sem frontend e sem producao.

**Decisão recomendada para uso real em navegador**:

Para o Geoportal Interno acessado por usuários finais em navegador, a decisão arquitetural implementada no backend é **cookie HttpOnly + Secure + SameSite=Lax**:

- **Cookie HttpOnly**: JavaScript não pode ler o token, reduzindo risco de roubo por XSS.
- **Cookie Secure**: Cookie enviado apenas por HTTPS em produção, protegendo contra sniffing.
- **Cookie SameSite**: Configurado inicialmente como Lax.
- **Padronização**: Nome `geoportal_internal_session`, Path `/api/internal`, Max-Age alinhado a expiracao da sessao opaca.
- **Conteúdo**: Cookie carrega apenas o token opaco bruto; nunca deve conter senha, hash, token_hash ou session_secret.
- **Persistência de token_hash**: Continua persistido apenas em `mod_auth.sessoes` no banco, nunca no cookie.

**Alternativa operacional temporária**:

- `Authorization: Bearer` pode continuar para testes técnicos ou clientes não navegador (APIs de terceiros, ferramentas administrativas), se a arquitetura permitir.
- Bearer **não deve ser o fluxo principal** para a tela interna de usuários reais em navegador.
- Se Bearer for mantido em paralelo, aplicar salvaguardas: tokens curtos, revogação rápida, sem localStorage, sem registrar Authorization em logs.

**Proteção CSRF antes de endpoints mutáveis**:

Antes de implementar endpoints internos que alterem dados (POST/PUT/PATCH/DELETE), proteção CSRF ou equivalente é **obrigatória**. A primeira proteção implementada exige o header `X-Geoportal-Internal-Request: 1` em rotas internas mutáveis protegidas, com exceção do login por ser início da sessão.

**Opções complementares para etapa futura**:

1. **Token CSRF separado**: Gerar token específico por sessão, enviado em cookie ou session storage, validado em requisições mutáveis.
   - Prós: Padrão estabelecido, bem testado.
   - Contras: Exige gerenciamento duplo (token de sessão + token CSRF).

2. **Double-submit cookie**: Enviar token em cookie e exigir o mesmo valor em cabeçalho customizado `X-CSRF-Token`.
   - Prós: Simples, sem estado adicional.
   - Contras: Requer JavaScript para ler e reenviar.

3. **Header customizado obrigatório**: Exigir cabeçalho específico (ex: `X-Requested-With: XMLHttpRequest`) em todas as requisições mutáveis.
   - Prós: Simples para SPA.
   - Contras: Pode ser falsificado se origem/referer não forem validados.

4. **Validação de Origin/Referer**: Comparar header `Origin` ou `Referer` da requisição com domínio esperado.
   - Prós: Camada adicional, não depende apenas de cookie.
   - Contras: Pode ter impacto com proxies/firewalls; não é única defesa.

5. **SameSite como base**: Configurar SameSite=Strict ou SameSite=Lax como base, combinado com outra técnica acima.
   - Prós: Nativa do navegador, sem código extra.
   - Contras: Nem todos os navegadores antigos suportam; não deve ser única defesa.

**Critério de escolha**:

- SameSite **não deve ser tratado como única proteção** para todos os cenários.
- GET de consulta não precisa de CSRF (idempotente, sem efeito colateral).
- POST/PUT/PATCH/DELETE de negocio (criar/editar/deletar) **exigem** protecao CSRF/equivalente deliberada.
- O header customizado inicial esta implementado e testado para logout; rotas mutaveis futuras devem reutilizar ou fortalecer esse controle.
- Validacao de Origin/Referer permanece camada complementar futura e deve ser configuravel/testada antes de uso amplo, se adotada.

**Logout e revogação de sessão**:

Logout foi implementado no backend:

- Endpoint `POST /api/internal/auth/logout` revoga sessão em `mod_auth.sessoes` preenchendo `revogado_em`.
- Uso de `DELETE` físico **não é permitido**; sessão revogada deve ser auditada, não deletada.
- O cookie é limpo no cliente com Set-Cookie de expiração.
- Se Bearer for usado em paralelo, tambem é invalidado no servidor por revogação em `revogado_em`.
- Logout exige sessão autenticada e header `X-Geoportal-Internal-Request: 1`.

**Cronograma**:

- Fase atual: cookie HttpOnly, logout e header mutavel inicial implementados e testados no backend, sem producao e sem NSSM.
- Próxima fase: validar operacionalmente em homologação controlada e decidir se Origin/Referer sera exigido.
- Liberação: não liberar tela interna para usuários reais antes de validacao operacional e integracao frontend/proxy.

**Confirmações desta etapa**:

- Código Python de backend alterado apenas no fluxo interno de autenticacao.
- Testes automatizados adicionados/ajustados.
- Nenhuma migração SQL criada.
- Cookie HttpOnly implementado.
- Protecao CSRF/equivalente inicial por header customizado implementada.
- Nenhuma mudança em produção.
- Nenhuma mudança em NSSM.
- Nenhuma mudança em `.env` versionado.
- Nenhum dado sensivel incluido.

## 7. Expiração, revogação e ciclo de vida da sessão

Proposta:

- Expiração curta ou moderada para sessão.
- `revogado_em` preenchido no logout ou bloqueio.
- Sessão expirada não autentica.
- Sessão revogada não autentica.
- Usuário inativo/bloqueado não autentica.
- Renovação/refresh deve ser etapa futura separada.
- Limpeza de sessões expiradas deve ser planejada.
- Auditoria deve registrar login, falha e revogação, sem token bruto.

Critérios:

- Nenhuma sessão sem `expira_em`.
- Nenhuma sessão sem `token_hash`.
- Nenhuma sessão com token bruto persistido.
- Nenhuma resposta deve retornar `token_hash`.

## 8. Autenticação vs autorização

- Autenticação responde “quem é o usuário?”.
- Autorização responde “o que esse usuário pode fazer?”.
- Login válido não basta para acessar módulo/ação.

Diretrizes:

- Todo endpoint `/api/internal/...` exige usuário autenticado.
- Todo endpoint `/api/internal/...` exige permissão ativa.
- Permissões consultadas no backend.
- Autorização nunca depende apenas do frontend.
- Perfis são agrupadores.
- Permissões são as regras reais.
- Um usuario pode ter um ou mais perfis.
- Um perfil agrupa permissoes granulares por modulo/recurso/acao.
- Ações sensíveis precisam de permissão específica.
- Listagens devem aplicar escopo por módulo/setor quando necessário.
- Nao usar regra hardcoded do tipo `if login == "admin.homologacao": libera tudo`; autorizacao deve vir de `mod_auth`.

Exemplos de permissões futuras:

- `admin.usuarios.ler`
- `admin.usuarios.criar`
- `admin.usuarios.bloquear`
- `admin.usuarios.redefinir_senha`
- `admin.usuarios.atribuir_perfis`
- `admin.perfis.ler`
- `admin.perfis.gerenciar`
- `iluminacao.solicitacoes.ler`
- `iluminacao.solicitacoes.atualizar_status`
- `iluminacao.solicitacoes.comentar`
- `iluminacao.dashboard.ler`
- `iluminacao.relatorios.ler`

Observação:

- Nomes são exemplos; permissões reais devem ser criadas em etapa própria, sem seed pública com dados reais.
- A proxima fase apos autenticacao/sessao deve ser repository de permissoes efetivas, service `has_permission(usuario_id, permissao)`, dependency `require_permission("permissao")` e endpoint tecnico `/api/internal/auth/me` ou `/api/internal/auth/permissions`.
- Endpoints administrativos reais, endpoints de negocio de Iluminacao Publica e tela interna devem vir somente depois da autorizacao base validada em homologacao.

Status da base de autorizacao: repository de permissoes efetivas, service `has_permission(usuario_id, permissao)`, dependency `require_permission("permissao")` e endpoint tecnico `GET /api/internal/auth/me` foram implementados no backend. `/me` retorna apenas `authenticated`, `usuario_id` e permissoes efetivas ordenadas. Nenhum perfil/permissao real, vinculo real, seed, migration, role/GRANT, endpoint administrativo real ou tela foi criado. Testes locais passaram com 311 testes.

Validacao operacional do `/api/internal/auth/me`: o commit `03efa10` Implementa base de autorizacao interna foi aplicado no servidor e validado com pytest completo: 311 passed. A validacao foi feita em processo isolado de homologacao com `DATABASE_URL` temporaria usando `geoportal_api_homolog`, `GEOPORTAL_INTERNAL_ROUTES_ENABLED`, `GEOPORTAL_INTERNAL_SESSION_SECRET`, `GEOPORTAL_INTERNAL_SESSION_COOKIE_SECURE=false` para TestClient/local e `TEST_INTERNAL_PASSWORD`; todas as variaveis temporarias foram limpas ao final. O primeiro teste falhou por falta de `SELECT` em `mod_auth.usuario_perfis`, confirmando que a role runtime precisava de leitura nas tabelas de autorizacao. Em homologacao, o ajuste operacional concedeu somente `GRANT SELECT` para `geoportal_api_homolog` em `mod_auth.usuario_perfis`, `mod_auth.perfis`, `mod_auth.perfil_permissoes` e `mod_auth.permissoes`, com validacao final de `SELECT=true` e `INSERT=false`, `UPDATE=false`, `DELETE=false` em cada tabela.

Resultado sanitizado final: `login_status=200`, `login_set_cookie=True`, `cookie_jar_tem_sessao=True`, `me_status=200`, `me_authenticated=True`, `me_usuario_id=7`, `me_permissoes=[]`, `me_tem_token=False`, `me_tem_cookie=False`, `me_tem_senha_hash=False`, `me_tem_token_hash=False`, `me_tem_session_secret=False`, `me_tem_database_url=False`. `permissoes=[]` e esperado porque nenhum perfil/permissao real foi criado ou atribuido ao `admin.homologacao`. Proximos passos: criar etapa operacional controlada para perfil administrativo inicial, criar permissoes administrativas iniciais, atribuir perfil ao `admin.homologacao` em homologacao, validar `/me` retornando permissoes administrativas, e so depois criar endpoints administrativos reais; tela interna permanece etapa posterior.

Decisao para o bootstrap inicial de perfis/permissoes: a criacao do perfil `Administrador Interno do Geoportal`, das permissoes administrativas iniciais e da atribuicao ao `admin.homologacao` deve ser feita por script administrativo idempotente, nao por SQL manual solto. O script deve aceitar `--dry-run`, exigir parametro explicito como `--login`, usar bind parameters, validar ambiente, nao apagar registros, nao duplicar perfis/permissoes/vinculos, criar permissoes e perfil quando ausentes, associar permissoes ao perfil quando faltar, atribuir perfil ao usuario informado quando ainda nao atribuido, nao depender de login hardcoded, ter testes automatizados e nao imprimir senha, token, hash, `session_secret` ou `DATABASE_URL`.

Permissoes administrativas iniciais propostas: `admin.usuarios.ler`, `admin.usuarios.criar`, `admin.usuarios.bloquear`, `admin.usuarios.redefinir_senha`, `admin.usuarios.atribuir_perfis`, `admin.perfis.ler`, `admin.perfis.gerenciar`, `admin.permissoes.ler`, `admin.permissoes.gerenciar` e `internal.auth.me`. O administrador funcional e permissao de aplicacao, nao superuser de banco; a role runtime `geoportal_api_homolog` permanece apenas lendo permissoes e nao deve criar, alterar ou excluir perfis/permissoes.

Implementacao local do bootstrap: `geoportal-backend/scripts/admin/bootstrap_internal_admin_profile.py` e `geoportal-backend/app/repositories/auth_admin_profile_repository.py` foram criados com testes automatizados. O script exige `--login`, aceita `--dry-run` sem persistencia, nao aceita senha por argumento, usa bind parameters, nao executa `DELETE`, nao usa login hardcoded e nao imprime dados sensiveis. Nesta etapa, nao foi executado contra banco real e nao criou perfil/permissao/vinculo real.

Validacao operacional do bootstrap de perfil administrativo: o commit `5a4d2bf` Adiciona bootstrap de perfil administrativo foi aplicado no servidor e validado com pytest completo: 327 passed. Antes da operacao, foram feitos backup de roles e backup custom do banco de homologacao. O dry-run retornou "Dry-run validado. Nenhum perfil, permissao ou vinculo foi alterado." e a execucao real retornou "Bootstrap do perfil administrativo interno concluido com sucesso.". Em homologacao, foram criados/validados o perfil `administrador-interno-geoportal`, 10 permissoes administrativas ativas, 10 vinculos perfil-permissao e o vinculo global `admin.homologacao` -> `administrador-interno-geoportal` com `modulo NULL`.

`geoportal_auth_admin_homolog` recebeu permissoes temporarias controladas de `SELECT`/`INSERT` nas tabelas de autorizacao e `USAGE`/`SELECT` nas sequences `perfis_id_seq` e `permissoes_id_seq`; apos a operacao, as permissoes temporarias foram revogadas, mantendo `SELECT=true`, `INSERT=false`, `UPDATE=false`, `DELETE=false` nas tabelas de autorizacao e sem `USAGE`/`SELECT` nas sequences temporarias. A validacao de `/api/internal/auth/me` com `geoportal_api_homolog` retornou 10 permissoes esperadas para `admin.homologacao` e nao retornou token, cookie, `senha_hash`, `token_hash`, `session_secret` ou `DATABASE_URL`. Producao, NSSM, `.env` versionado e frontend nao foram alterados.

Endpoint tecnico protegido por permissao: `GET /api/internal/auth/permission-smoke` foi criado para validar `require_permission("internal.auth.me")` em rota real antes de endpoints administrativos. A rota fica sob a feature flag interna, exige sessao e permissao, retorna 401 generico sem sessao, 403 generico sem permissao e 200 com `authorized`, `permission` e `usuario_id` quando autorizado. Por ser GET tecnico de consulta, nao exige header mutavel. A resposta nao expoe token, cookie, senha, `senha_hash`, `token_hash`, `session_secret`, `DATABASE_URL`, SQL, role ou GRANT. Nao ha regra hardcoded por login, endpoint administrativo real, tela, migration ou schema novo nesta etapa.

Validacao operacional do permission-smoke em homologacao: o commit `251cf65` Adiciona smoke de permissao interna foi aplicado no servidor e validado com pytest completo: 335 passed. A validacao ocorreu em processo isolado de homologacao com variaveis temporarias; todas foram limpas ao final. Sem sessao, o endpoint retornou 401 com `{'detail': 'Not authenticated'}`. Com admin.homologacao autenticado (que possui a permissao internal.auth.me), o endpoint retornou 200 autorizado. Resultado sanitizado: `login_status=200`, `login_set_cookie=True`, `cookie_jar_tem_sessao=True`, `permission_status=200`, `permission_authorized=True`, `permission_code=internal.auth.me`, `permission_usuario_id=7`. A resposta nao expôs token, cookie, `senha_hash`, `token_hash`, `session_secret`, `DATABASE_URL`, SQL, role ou GRANT. Producao, NSSM, `.env` versionado e frontend nao foram alterados.

Primeiro endpoint administrativo real: `GET /api/internal/admin/users` foi criado como endpoint somente leitura, sob feature flag interna, protegido por `require_permission("admin.usuarios.ler")`. A listagem consulta apenas `mod_auth.usuarios`, usa SQL parametrizado e retorna `id`, `login`, `nome`, `email`, `ativo`, `bloqueado` booleano derivado e `criado_em`. A resposta nao expoe senha, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, sessao, auditoria, SQL, role, GRANT ou `bloqueado_ate`. Esta etapa nao cria endpoint mutavel, nao cria usuario, nao bloqueia/desbloqueia, nao redefine senha, nao atribui perfil, nao altera schema, nao cria migration, nao altera producao e nao cria tela.

Validacao operacional de GET /api/internal/admin/users em homologacao: o commit `119390e` Adiciona listagem interna de usuarios foi aplicado no servidor e validado com pytest completo: 347 passed. A validacao ocorreu em processo isolado de homologacao com variaveis temporarias; todas foram limpas ao final. Sem sessao, o endpoint retornou 401 com `{'detail': 'Not authenticated'}`. Com admin.homologacao autenticado (que possui a permissao admin.usuarios.ler), o endpoint retornou 200 com lista sanitizada de usuarios. Resultado sanitizado: `login_status=200`, `login_set_cookie=True`, `cookie_jar_tem_sessao=True`, `users_status=200`, `users_tem_lista=True`, `users_total=1`, `users_tem_admin_homologacao=True`. Campos retornados em cada usuario: `id`, `login`, `nome`, `email`, `ativo`, `bloqueado`, `criado_em`. A resposta nao expôs senha, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, SQL, role, GRANT, dados de sessao, auditoria ou `bloqueado_ate`. Variaveis temporarias foram limpas apos o teste. Producao, NSSM, `.env` versionado e frontend nao foram alterados. Nenhum endpoint mutavel foi criado nesta etapa.

Segundo endpoint administrativo real: `GET /api/internal/admin/users/{usuario_id}` foi criado como endpoint somente leitura, sob feature flag interna, protegido por `require_permission("admin.usuarios.ler")`. O detalhe consulta apenas `mod_auth.usuarios` por `id` com bind parameter, usa SQL parametrizado e retorna objeto `usuario` com `id`, `login`, `nome`, `email`, `ativo`, `bloqueado` booleano derivado e `criado_em`. Sem sessao retorna 401 generico, usuario inexistente retorna 404 generico e sem permissao retorna 403 generico. A resposta nao expoe senha, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, sessao, auditoria, SQL, role, GRANT, `bloqueado_ate`, `atualizado_em` ou `ultimo_login_em`. Esta etapa nao cria endpoint mutavel, nao cria usuario, nao bloqueia/desbloqueia, nao redefine senha, nao atribui perfil, nao altera schema, nao cria migration, nao altera producao e nao cria tela.

Validacao operacional de GET /api/internal/admin/users/{usuario_id} em homologacao: o commit `ea4e457` Adiciona detalhe interno de usuario foi aplicado no servidor e validado com pytest completo: 358 passed. A validacao ocorreu em processo isolado de homologacao com variaveis temporarias; todas foram limpas ao final. Sem sessao, o endpoint retornou 401 com `{'detail': 'Not authenticated'}`. Com admin.homologacao autenticado (que possui a permissao admin.usuarios.ler), o endpoint retornou 200 para o usuario_id=7 (admin.homologacao) com objeto `usuario` sanitizado contendo `id`, `login`, `nome`, `email`, `ativo`, `bloqueado`, `criado_em`. Usuario inexistente retornou 404 generico `{'detail': 'Not found'}`. A resposta nao expôs senha, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, SQL, role, GRANT, dados de sessao, auditoria, `bloqueado_ate`, `atualizado_em` ou `ultimo_login_em`. Variaveis temporarias foram limpas apos o teste. Producao, NSSM, `.env` versionado e frontend nao foram alterados. Nenhum endpoint mutavel foi criado nesta etapa.

Endpoint administrativo de detalhe somente leitura: `GET /api/internal/admin/users/{usuario_id}` foi criado sob a mesma feature flag interna e protegido por `require_permission("admin.usuarios.ler")`. O repository consulta apenas `mod_auth.usuarios` por `id` com bind parameter e retorna payload sanitizado com `usuario` contendo `id`, `login`, `nome`, `email`, `ativo`, `bloqueado` booleano e `criado_em`. A rota retorna 401 generico sem sessao, 403 generico sem permissao, 404 generico quando o usuario nao existe e 200 quando autorizado e encontrado. Por ser GET de consulta, nao exige header mutavel. A resposta nao expoe senha, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, sessao, auditoria, SQL, role, GRANT, `bloqueado_ate`, `atualizado_em` ou `ultimo_login_em`. Esta etapa nao cria endpoint mutavel, usuario, perfil, permissao, role, GRANT, migration, schema novo, producao, NSSM, `.env`, frontend ou tela.

Decisao tecnica planejada para o primeiro endpoint mutavel: `POST /api/internal/admin/users` deve ser implementado em etapa separada com Codex High como criacao basica de usuario interno, protegido por `require_permission("admin.usuarios.criar")`, sob `GEOPORTAL_INTERNAL_ROUTES_ENABLED`, com sessao autenticada e header `X-Geoportal-Internal-Request: 1`. Payload aceito: `login` obrigatorio, `nome` obrigatorio, `email` opcional e `senha_inicial` obrigatoria. Payload proibido: `id`, `ativo`, `bloqueado`, `bloqueado_ate`, `senha_hash`, `perfil`, `perfis`, `permissoes`, `role`, `token`, `session_secret`, `DATABASE_URL`, campos de auditoria e campos de sessao. Validacoes: login com `strip`, nao vazio e unico case-insensitive; nome nao vazio; e-mail opcional validado e unico quando informado; senha inicial conforme politica existente; rejeicao de campos extras quando possivel; sem login hardcoded; sem aceitar perfil/permissao no mesmo endpoint. Persistencia: inserir em `mod_auth.usuarios`, gerar `senha_hash` Argon2id pelo utilitario existente, usar `ativo=true`, `desativado_em=NULL`, `bloqueado_ate=NULL`, `atualizado_em=NULL` ou padrao existente, nao criar sessao, perfil, vinculo `usuario_perfis`, permissao, auditoria de login salvo decisao futura, e nao apagar registros. Resposta 201: `usuario.id`, `usuario.login`, `usuario.nome`, `usuario.email`, `usuario.ativo`, `usuario.bloqueado`, `usuario.criado_em`; nunca retornar senha, `senha_inicial`, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, SQL, role, GRANT, sessao, auditoria, `bloqueado_ate`, `atualizado_em` ou `ultimo_login_em`. Erros: 401 `Not authenticated`, 403 `Forbidden`, 409 `Conflict` para login/e-mail duplicado e 422 para payload invalido, sempre sem detalhes de tabela, SQL ou constraint. O endpoint nao deve atribuir perfil, bloquear/desbloquear, resetar senha existente, criar permissoes, criar sessao, enviar e-mail ou criar tela. Esta etapa e apenas documental e nao altera producao.

Decisao tecnica implementada para criacao basica de usuario: `POST /api/internal/admin/users` foi criado como primeiro endpoint administrativo mutavel. A rota fica no router interno administrativo, sob a feature flag existente, e exige sessao autenticada, `require_permission("admin.usuarios.criar")` e header `X-Geoportal-Internal-Request: 1`. O modelo Pydantic rejeita campos extras, normaliza `login`, `nome` e `email`, aceita e-mail opcional e exige senha inicial nao vazia. A senha inicial e enviada apenas ao service, que gera Argon2id pelo utilitario de senha; o repository recebe somente `senha_hash`, usa bind parameters e trata conflito de unicidade como erro controlado para 409. A resposta 201 reutiliza o modelo sanitizado de usuario e nao retorna senha, hash, token, cookie, segredo, SQL, role, GRANT, sessao, auditoria ou campos operacionais sensiveis. O endpoint nao atribui perfil, nao cria permissao, nao cria sessao, nao escreve auditoria de login, nao envia e-mail, nao apaga registros e nao cria endpoints mutaveis adicionais. Nao houve migration, alteracao de schema, producao, NSSM, `.env`, frontend ou tela.

Decisao tecnica de politica de senha inicial: a regra de forca foi centralizada em `app/security/passwords.py` e aplicada por `auth_admin_user_service.py` antes de chamar `hash_password(...)`. A senha inicial deve ser obrigatoria, ter entre 6 e 128 caracteres apos `strip`, conter pelo menos uma letra e um numero, nao ser igual ao login ou ao nome normalizados e nao pertencer a lista curta de senhas comuns bloqueadas. A funcao nao retorna a senha, nao registra a senha e usa mensagens genericas. O router converte falha de politica em 422 generico sem expor `senha_inicial` ou o valor enviado.

Validacao operacional da criacao interna de usuarios: o commit `99f2987` Reforca politica de senha interna foi aplicado no servidor e validado com pytest completo: 403 passed. A validacao de `POST /api/internal/admin/users` ocorreu em processo isolado em homologacao, apos backup de roles e backup custom do banco. A role runtime `geoportal_api_homolog` recebeu o minimo necessario para criacao via endpoint: `INSERT` em `mod_auth.usuarios` e `USAGE`/`SELECT` em `mod_auth.usuarios_id_seq`; a validacao final confirmou `usuarios_select=t`, `usuarios_insert=t`, `usuarios_update=t`, `usuarios_delete=f`, `usuarios_seq_usage=t` e `usuarios_seq_select=t`. Foram validados 401 sem sessao, 403 sem header mutavel, 422 para senha invalida/fraca, 201 para criacao valida, 409 para duplicidade, 200 no detalhe do usuario criado e 200 no login do usuario criado. O usuario `teste.criacao` foi criado em homologacao com `id=8`, sem perfil automatico; `/api/internal/auth/me` para ele retornou `permissoes=[]`. A resposta permaneceu sanitizada e nao retornou senha real, `senha_inicial`, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, SQL, role, GRANT, sessao, auditoria ou `bloqueado_ate`. Variaveis temporarias foram limpas; producao, NSSM, `.env` versionado e frontend nao foram alterados.

Decisao tecnica planejada para atribuicao de perfil: o endpoint futuro sera `POST /api/internal/admin/users/{usuario_id}/profiles`, protegido por sessao autenticada, `require_permission("admin.usuarios.atribuir_perfis")`, header `X-Geoportal-Internal-Request: 1` e `GEOPORTAL_INTERNAL_ROUTES_ENABLED`. A primeira versao atribui somente um perfil por requisicao; payload aceito: `perfil_id` obrigatorio e `modulo` opcional/nulo. Payload proibido: `usuario_id` no corpo, `perfil_chave`, `permissoes`, `login`, senha, `senha_hash`, token, role, GRANT, `session_secret`, `DATABASE_URL`, auditoria e sessao. Comportamento: 201 quando criar vinculo ativo em `usuario_perfis`, 200 quando vinculo ativo ja existir sem duplicar, 401 sem sessao, 403 sem permissao, 403 sem header mutavel, 404 generico se usuario ou perfil nao existir e 422 para payload invalido. A primeira versao nao reativa vinculo inativo automaticamente, nao remove perfil, nao cria perfil/permissao, nao altera senha, nao cria sessao, nao envia e-mail, nao implementa batch e nao altera producao. Resposta planejada: envelope `vinculo` com `usuario_id`, `perfil_id`, `modulo` e `ativo`. A tela futura podera usar checkboxes e chamar o endpoint uma vez por perfil marcado; batch/transacional fica para fase futura com auditoria definida. A validacao em homologacao deve usar `teste.criacao`, verificando que `/me` deixa de retornar `permissoes=[]` apos a atribuicao.

Decisao tecnica implementada para atribuicao de perfil: `POST /api/internal/admin/users/{usuario_id}/profiles` foi criado como endpoint administrativo mutavel minimo, sem batch e sem remocao. Ele fica sob a feature flag interna, exige sessao autenticada, `require_permission("admin.usuarios.atribuir_perfis")` e header `X-Geoportal-Internal-Request: 1`. O payload aceito e restrito a `perfil_id` positivo e `modulo` opcional/nulo, e campos extras retornam 422 generico para evitar mass assignment. O repository usa bind parameters, valida existencia de usuario e perfil ativo, consulta vinculo existente por escopo global ou por `lower(modulo)`, retorna sucesso idempotente para vinculo ativo ja existente, insere somente quando ausente e retorna conflito quando encontra vinculo inativo, sem reativacao automatica. A resposta retorna somente `vinculo.usuario_id`, `vinculo.perfil_id`, `vinculo.modulo` e `vinculo.ativo`. A implementacao nao cria perfil, permissao, usuario, sessao, auditoria, role, GRANT, migration ou schema, nao usa login hardcoded e nao altera producao, NSSM, `.env`, frontend ou tela. Proxima validacao: homologacao com `teste.criacao`, confirmando que `/me` passa a refletir as permissoes do perfil atribuido.

Validacao operacional da atribuicao de perfil: o commit `092b5bb` Adiciona atribuicao interna de perfil foi aplicado no servidor e validado com pytest completo: 426 passed. A role runtime `geoportal_api_homolog` recebeu apenas `INSERT` em `mod_auth.usuario_perfis` para a validacao, e a matriz final confirmou `usuario_perfis_select=t`, `usuario_perfis_insert=t`, `usuario_perfis_update=f`, `usuario_perfis_delete=f`, `usuarios_select=t`, `perfis_select=t`, `permissoes_select=t` e `perfil_permissoes_select=t`. O usuario `teste.criacao` (`id=8`) foi validado antes com `/me` retornando `permissoes=[]`; depois da atribuicao valida do `perfil_id=3`, `/me` retornou 10 permissoes do perfil, incluindo `internal.auth.me`, `admin.usuarios.ler` e `admin.usuarios.atribuir_perfis`. Tambem foram validados 401 sem sessao, 403 sem header mutavel, 200 na repeticao idempotente, 404 para perfil inexistente e 422 para payload invalido. Nenhuma senha real, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, SQL, role, GRANT, sessao ou auditoria foi exposta; `response_tem_senha=True` ocorreu apenas pela permissao tecnica `admin.usuarios.redefinir_senha`. Variaveis temporarias foram limpas, e producao, NSSM, `.env` versionado e frontend nao foram alterados. Proximos passos: planejar bloqueio/desbloqueio, reset de senha via endpoint, listagem de perfis para tela futura e depois o primeiro modulo de negocio, como Iluminacao.

Endpoint de listagem de perfis: `GET /api/internal/admin/profiles` foi criado como endpoint administrativo somente leitura para a futura tela de selecao por checkboxes. Ele fica sob `GEOPORTAL_INTERNAL_ROUTES_ENABLED`, exige sessao autenticada e `require_permission("admin.perfis.ler")`, nao exige header mutavel e retorna envelope `perfis` com itens sanitizados (`id`, `chave`, `nome`, `ativo`, `criado_em`). A consulta usa bind parameters, filtra perfis ativos em `mod_auth.perfis` e ordena por `lower(nome)`, `lower(chave)` e `id`. A primeira versao nao lista permissoes detalhadas do perfil, nao consulta usuarios, sessoes ou auditoria, nao cria/edita/remove perfil, nao cria permissao, usuario ou vinculo, nao cria endpoint mutavel, nao altera schema, nao cria migration e nao altera producao, NSSM, `.env`, frontend ou tela.

Validacao operacional de GET /api/internal/admin/profiles em homologacao: o commit `93d96f4` Adiciona listagem interna de perfis foi aplicado no servidor e validado com pytest completo: 439 passed. A validacao ocorreu em processo isolado de homologacao com variaveis temporarias; todas foram limpas ao final. Sem sessao, o endpoint retornou 401 com `{'detail': 'Not authenticated'}`. Com admin.homologacao autenticado e com `admin.perfis.ler`, o endpoint retornou 200. Resultado sanitizado: `profiles_status=200`, `profiles_tem_lista=True`, `profiles_total=1`, `profiles_tem_admin_interno=True`. Campos retornados: `id`, `chave`, `nome`, `ativo`, `criado_em`. A resposta nao expôs senha, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, SQL, role, GRANT, sessao, auditoria, permissoes, `perfil_permissoes` ou usuarios. Producao, NSSM, `.env` versionado e frontend nao foram alterados. Nenhum endpoint mutavel, usuario, perfil, permissao, vinculo, role ou GRANT foi criado nesta validacao.

Proxima etapa operacional: validar em homologacao e depois planejar bloqueio/desbloqueio ou reset de senha em etapas separadas.

Estrategia homologacao/producao: homologacao deve seguir backup, `--dry-run`, execucao real controlada, validacao de tabelas `mod_auth`, validacao de `/api/internal/auth/me` retornando permissoes administrativas e documentacao do resultado. Producao nao recebe dados automaticamente da homologacao: usa o mesmo script idempotente apenas depois de validado, com backup obrigatorio, `--dry-run` obrigatorio, confirmacao humana, criacao de usuario real de producao em etapa propria, sem documentar senha/token/hash, sem migration ou restart sem confirmacao humana e com feature flag interna sob controle. Nao ha copia cega de senhas, sessoes, tokens, dados de teste ou usuarios ficticios.

## 9. Proteção contra brute force e credential stuffing

Controles obrigatórios:

- Rate limit no endpoint de login.
- Atraso progressivo ou bloqueio temporário após falhas repetidas.
- Resposta genérica para login inválido.
- Não revelar se login existe.
- Auditoria de tentativas.
- Alerta futuro para volume anormal.
- Não registrar senha tentada.
- Não registrar token.
- Não registrar hash de senha.

Critérios:

- Login inválido sempre retorna mensagem genérica.
- Falhas sucessivas não geram respostas diferentes.
- Usuário bloqueado/inativo não deve ser distinguível para atacante por mensagem pública.

## 10. Logs e auditoria

- Login com sucesso registra `usuario_id`, origem e data/hora, sem token.
- Falha registra origem e motivo genérico, sem senha.
- Logout/revogação registra evento.
- Alteração de status registra histórico.
- Criação de observação registra `usuario_id` e data/hora.
- Logs técnicos não devem incluir corpo completo da requisição quando houver dado pessoal.
- Logs não devem incluir `Authorization`, cookie, token, senha, `senha_hash` ou `DATABASE_URL`.
- Auditoria operacional não deve ser editável por usuário comum.

## 11. Banco de dados e menor privilégio

- Usuário da API pública não deve acessar `mod_auth`.
- Usuário da API interna deve ter privilégios mínimos.
- Usuários técnicos de módulos específicos (ex: `api_iluminacao_homolog`) devem permanecer restritos aos seus schemas.
- Usuários técnicos de módulos não devem ser ampliados automaticamente para `mod_auth`.
- `GRANT`s devem ser etapa separada e documentada.
- Evitar superuser.
- Evitar `DELETE` em tabelas de auditoria.
- Avaliar permissões separadas para leitura/escrita.
- Produção deve começar sem usuário real até fluxo seguro ser criado.

## 11.1 Decisão de usuários técnicos e escalabilidade

**Contexto:**

O Geoportal é arquiteturado para ser escalável e suportar múltiplos módulos internos, não apenas Iluminação Pública. A autenticação/autorização deve ser transversal via `mod_auth`, enquanto cada módulo permanece em seu schema específico. Usuários técnicos de banco são contas de serviço e devem ser restritos ao escopo necessário.

**Decisão — Não ampliar usuários técnicos de módulos para `mod_auth`:**

1. `api_iluminacao_homolog` permanece restrito a `mod_iluminacao` em homologação.
2. `api_iluminacao_producao` permanece restrito a `mod_iluminacao` em produção.
3. `mod_auth` não deve ser concedido automaticamente a usuários técnicos de módulos específicos.
4. Permissões de aplicação devem ser controladas em `mod_auth.perfis`, `mod_auth.permissoes`, `mod_auth.usuario_perfis` e `mod_auth.perfil_permissoes`, não em roles de banco.

**Usuários humanos vs. técnicos:**

- Usuários humanos: Armazenados em `mod_auth.usuarios` com `login`, `senha_hash`, `nome` e `email` opcional.
- Usuários técnicos: Contas de serviço PostgreSQL com permissões mínimas limitadas a schemas específicos.
- Permissões de usuários humanos: Controladas por `mod_auth.perfis` e `mod_auth.permissoes`, não por roles PostgreSQL.

**Bootstrap inicial de usuários internos em homologação (etapa operacional futura):**

Para a criação inicial de usuários internos via `geoportal-backend/scripts/admin/create_internal_user.py`, será necessária uma role técnica de banco com permissões mínimas. Sugestão de nome: `geoportal_auth_admin_homolog`. Permissões mínimas sugeridas:

- `CONNECT` no banco de homologação.
- `USAGE` no schema `mod_auth`.
- `SELECT` e `INSERT` em `mod_auth.usuarios`.
- `USAGE` e `SELECT` na sequence de `mod_auth.usuarios`.
- Sem `DELETE`.
- Sem `UPDATE` nesta etapa.
- Sem `CREATE`.
- Sem acesso a `plano`, `web_map` ou `mod_iluminacao`.

**Status operacional — Bootstrap concluído:**

A role técnica `geoportal_auth_admin_homolog` foi criada em homologação com sucesso conforme especificação acima:

- Backup `pg_dumpall -g` realizado antes de qualquer operação.
- SQL revisado manualmente e executado em terminal contra banco de homologação.
- Permissões validadas: CONNECT ✓, USAGE mod_auth ✓, SELECT usuarios ✓, INSERT usuarios ✓, USAGE sequence ✓, SELECT sequence ✓.
- Primeira role sem DELETE, UPDATE ou CREATE; restrita ao escopo especificado.
- Primeiro usuário administrativo `admin.homologacao` criado com sucesso via `create_internal_user.py`.
- Health checks validados: `/api/health`, `/api/public/iluminacao/health`, `/api/version` OK.
- Produção não alterada; todas as operações restritas a homologação.
- Próxima etapa: não ampliar `geoportal_auth_admin_homolog` para login runtime; planejar role separada `geoportal_api_homolog` com matriz minima para futuro login e validacao de sessao em `mod_auth`.

**Futura API interna de autenticacao em homologacao (role runtime):**

Para o futuro endpoint de login e validacao de sessao em homologacao, planejar uma role runtime separada. Sugestao de nome: `geoportal_api_homolog`. A role `geoportal_auth_admin_homolog` foi criada apenas para bootstrap administrativo e nao deve ser reutilizada como role runtime do endpoint de login.

Matriz minima prevista para `geoportal_api_homolog`, derivada dos repositories atuais:

- `CONNECT` no banco de homologacao.
- `USAGE` no schema `mod_auth`.
- `mod_auth.usuarios`: `SELECT`; `UPDATE` somente para `ultimo_login_em` e `atualizado_em` via `record_successful_login`; sem `INSERT`; sem `DELETE`.
- `mod_auth.sessoes`: `SELECT`; `INSERT`; `UPDATE` para revogacao de sessao; sem `DELETE`.
- `mod_auth.login_auditoria`: `SELECT`; `INSERT`; sem `UPDATE`; sem `DELETE`.
- Sequences: `USAGE` e `SELECT` em `mod_auth.sessoes_id_seq`; `USAGE` e `SELECT` em `mod_auth.login_auditoria_id_seq`.
- Sem `CREATE`.
- Sem `DROP`, `ALTER` ou `TRUNCATE`.
- Sem `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION` ou `BYPASSRLS`.
- Sem acesso automatico a `plano`, `web_map` ou `mod_iluminacao`.
- Sem usar `postgres` como usuario runtime.
- Sem ampliar `api_iluminacao_homolog` para `mod_auth`.

Permissoes de aplicacao continuam controladas em `mod_auth.perfis`, `mod_auth.permissoes`, `mod_auth.usuario_perfis` e `mod_auth.perfil_permissoes`. Roles PostgreSQL controlam somente o acesso tecnico minimo as tabelas. A criacao real de `geoportal_api_homolog` deve ser etapa operacional separada, sem producao, com backup de roles, comandos revisados, execucao manual e validacao de permissoes. Esta documentacao nao cria role real nem GRANT real executavel.

Observacao: Permissoes para schemas de modulos, como `mod_iluminacao`, devem ser avaliadas somente quando endpoints internos de negocio forem implementados e testados, sempre respeitando menor privilegio.

**Restrições aplicadas:**

- Nada será aplicado em produção nesta etapa.
- Nenhuma role runtime real, GRANT real, cookie, CSRF ou JWT sera criada nesta etapa.
- Roles reais, GRANTs reais e usuário interno real ocorrerão em etapa separada com backup e validação.

## 12. Testes obrigatórios antes de expor endpoint de login

Testes mínimos:

- Login válido.
- Senha inválida.
- Usuário inexistente.
- Usuário inativo.
- Usuário bloqueado.
- Resposta genérica em falhas.
- Rate limit após tentativas excessivas.
- Sessão criada com `token_hash`.
- Token bruto não persistido.
- Token expirado negado.
- Token revogado negado.
- Logout revoga sessão.
- Acesso sem token negado.
- Acesso com token inválido negado.
- Acesso com token válido mas sem permissão negado.
- Acesso com permissão permitido.
- Logs não contêm senha/token.
- API pública continua sem regressão.

## 13. Critérios de aceite antes da primeira implementação com Codex High

- Decisões deste documento devem estar revisadas.
- Biblioteca de hash deve estar escolhida.
- Estratégia de sessão deve estar escolhida.
- Transporte do token deve estar decidido ou prototipado.
- Testes devem estar planejados.
- Nenhum endpoint interno deve ser criado sem middleware/dependency de autenticação.
- Nenhum dado real deve ser usado em teste.
- Plano de rollback operacional deve existir.

## 14. Decisões atuais resumidas

| Tema | Decisão recomendada | Status |
|---|---|---|
| Hash de senha | Argon2id com `argon2-cffi`; bcrypt apenas como alternativa operacional | Serviço, repository de usuários, service de autenticação e endpoint interno de login sob feature flag criados |
| Sessão/token | Sessão opaca com token_hash HMAC-SHA256 no banco | Services, repositories, dependency, router tecnico de smoke, endpoint de login e feature flag fail-closed criados; rotas internas ativas somente com flag ligada |
| Auditoria de login | Repository com `record_login_attempt(...)` e `count_recent_failed_attempts(...)` | Repository criado e integrado ao `auth_service.py` |
| Rate limit de login | Service puro com `LoginRateLimitDecision` e `evaluate_login_rate_limit(...)` | Service criado e integrado ao `auth_service.py` |
| Atraso progressivo e bloqueio temporário | Implementar integrado ao rate limit antes de endpoint | Pendente; pronto para integração |
| Transporte do token | Cookie HttpOnly/Secure/SameSite=Lax como fluxo principal de navegador; Bearer como alternativa tecnica/intermediaria | Cookie implementado no login, service de extracao aceita cookie e Bearer |
| JWT | Não recomendado para primeira versão salvo necessidade real | Adiado |
| Usuário admin via migration | Não permitido | Decidido |
| Seed de usuários/perfis reais | Não permitido nesta fase | Decidido |
| Endpoint interno antes de autenticação/autorização | Não permitido | Decidido |
| Logs com senha/token | Proibido | Decidido |

## 15. Próximos passos

1. Revisar este documento.
2. Manter testes do serviço de hash/verificação de senha.
3. Manter auditoria e rate limit integrados ao `auth_service.py`.
4. Implementar atraso progressivo e bloqueio temporário persistente integrados ao rate limit.
5. Manter `GEOPORTAL_INTERNAL_ROUTES_ENABLED` desligada por padrao; ativar rotas internas apenas em homologacao controlada.
6. Configurar segredo real de HMAC em etapa segura, sem registrar em log.
7. Planejar smoke test protegido ou middleware de autenticacao.
8. Implementar repository de permissoes efetivas do usuario autenticado. Concluido.
9. Implementar service `has_permission(usuario_id, permissao)`. Concluido.
10. Implementar dependency `require_permission("permissao")`. Concluido.
11. Criar endpoint tecnico `/api/internal/auth/me` ou `/api/internal/auth/permissions`. Concluido com `/api/internal/auth/me`.
12. Criar mecanismo administrativo controlado para perfil inicial `Administrador Interno`, se necessario, e atribuir ao `admin.homologacao` somente em homologacao.
13. Trabalhar as proximas etapas criticas com Codex High.
14. Criar endpoints administrativos reais somente depois da autorizacao base.
15. Criar endpoints internos de negocio de Iluminacao Publica somente depois da autorizacao base.
16. Criar tela interna minima somente depois que o backend validar autorizacao com seguranca.
17. Continuar a proxima etapa critica com Codex High.

Observação:

- Quando chegar na implementação de middleware, endpoints internos e telas, a tarefa deve ser feita com Codex High, não Copilot, por envolver segurança crítica e integração sensível.

## 16. Referências curtas

- `docs/INTERNAL-AUTH-SECURITY-IMPLEMENTATION-PLAN.md`
- `docs/INTERNAL-AUTH-DATA-MODEL.md`
- `docs/INTERNAL-AUTHORIZATION-PLAN.md`
- `docs/SECURITY-HARDENING-PLAN.md`
- `docs/API-SERVER-DEPLOYMENT-PLAN.md`
