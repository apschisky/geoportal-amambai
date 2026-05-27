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
  - Service interno de validação de sessão autenticada implementado.
  - Service puro de transporte de token implementado.
  - Dependency FastAPI interna de autenticação criada.
  - Router técnico de smoke auth `GET /api/internal/auth/smoke` criado e validado isoladamente.

- Preparado, mas ainda não exposto:
  - Dependency FastAPI interna existe, mas não está aplicada a endpoint real.
  - Router de smoke auth existe, mas não está incluído no app principal.
  - `geoportal-backend/app/main.py` e `geoportal-backend/app/api/router.py` não foram alterados.
  - `GEOPORTAL_INTERNAL_SESSION_SECRET` documentado como configuração futura, sem valor real no repositório.
  - Cookie HttpOnly/Secure/SameSite permanece preferência futura.
  - Bearer permanece alternativa operacional futura.

- Pendente:
  - Feature flag para ativar rotas internas.
  - Incluir router interno no app apenas por feature flag.
  - Configurar segredo real somente no servidor, fora do Git.
  - Criar primeiro usuário interno por script administrativo seguro.
  - Criar endpoint de login.
  - Setar cookie real HttpOnly/Secure/SameSite.
  - Criar CSRF antes de rotas mutáveis.
  - Criar endpoint `/me` real.
  - Criar logout/revogação de sessão.
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
- O repository de usuarios busca por login ou e-mail com bind param `:login_informado`, usando comparação case-insensitive via `lower(login)` e `lower(email)`. Login vazio ou só com espaços retorna `None` sem executar SQL.
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
- O nome futuro do cookie interno ficou definido como `geoportal_internal_session`, mas nenhum cookie real é criado ou configurado nesta etapa.
- `session_secret` é obtido por função injetável/testável; ausência de configuração crítica gera RuntimeError interno, sem valor real no repositório.
- Cookie HttpOnly/Secure/SameSite permanece preferencia futura; Bearer permanece alternativa operacional a decidir antes do endpoint.
- O servico de sessao usa token aleatorio forte (`secrets.token_urlsafe(32)`), HMAC-SHA256 e comparacao segura com `hmac.compare_digest`.
- O token bruto nao e persistido nem logado. O hash de sessao e prefixado com `hmac-sha256:`.
- A expiração usa `datetime` timezone-aware em UTC. A revogacao e tratada quando `revoked_at` esta preenchido.
- Validacao local desta etapa: `tests/test_internal_routes_feature_flag.py` passou com 9 testes; `tests/test_internal_routes_config.py` passou com 28 testes; `tests/test_internal_auth_smoke_router.py` passou com 7 testes; suite completa local passou com 245 testes.
- Validacao no servidor: git pull aplicado; testes no servidor passaram; homologacao, producao local e producao publica foram reiniciadas e validadas.
- Endpoints de saude confirmados saudaveis em homologacao, producao local e producao publica: `/api/health`, `/api/public/iluminacao/health`, `/api/version` retornaram status correto em todos os ambientes.
- Ainda nao ha endpoint interno de login, cookie real, CSRF, JWT, middleware, usuario real ou sessao real criada por endpoint. O router tecnico de smoke so fica ativo quando a feature flag e ligada explicitamente.
- Proxima etapa: validar no servidor com a flag desligada e depois ativar somente em homologacao para smoke controlado. Classificacao de risco: Codex High.

Atualizacao preparatoria: a estrutura do script administrativo `geoportal-backend/scripts/admin/create_internal_user.py` foi criada para futura criacao manual do primeiro usuario interno, sem execucao contra banco real. O script usa `getpass` para senha e confirmacao, rejeita senha vazia, nao aceita senha por argumento CLI, usa `hash_password(...)`, possui `--dry-run` sem conexao ao banco e nao imprime senha ou hash. O repository administrativo usa SQLAlchemy `text(...)` com bind parameters para existencia e `INSERT` em `mod_auth.usuarios`, recebendo apenas `senha_hash`. Esta etapa nao criou usuario real, seed, migration, endpoint, cookie, JWT, CSRF, token ou sessao real.

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
- Segredo real de HMAC ainda nao foi configurado e deve ser definido em etapa futura segura, antes de qualquer endpoint de login.
- Repository interno de sessoes criado em `geoportal-backend/app/repositories/auth_session_repository.py`, operando apenas com `token_hash`, expiracao e revogacao por `revogado_em`.
- Service interno de validacao de sessao autenticada criado em `geoportal-backend/app/services/auth_current_session_service.py`, recebendo token bruto e `session_secret` para consultar sessao ativa por `token_hash`.
- Service puro de transporte de token criado em `geoportal-backend/app/services/auth_token_transport_service.py`, extraindo token de cookie ou bearer sem depender de FastAPI.
- Dependency FastAPI interna criada em `geoportal-backend/app/dependencies/auth_dependencies.py`, ainda sem ser aplicada a endpoint real.
- Router tecnico protegido de smoke criado em `geoportal-backend/app/api/routes/internal_auth_smoke.py`, ainda sem ser incluido no app principal.
- Parser fail-closed da feature flag `GEOPORTAL_INTERNAL_ROUTES_ENABLED` criado em `geoportal-backend/app/core/internal_routes_config.py` e conectado ao `include_router` em `geoportal-backend/app/main.py`.
- Ainda nao ha endpoint de login, sessao real no banco criada por endpoint, middleware global, cookie real, CSRF ou JWT implementado.
- A proxima etapa pode validar em servidor com flag desligada e ativar o smoke somente em homologacao controlada.

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
- Decidir transporte após desenho do frontend interno e domínio final.
- Não implementar endpoint de login antes dessa decisão.

#### Decisão provisória

- Preferência técnica inicial: usar cookie `HttpOnly` + `Secure` + `SameSite` se o painel interno estiver no mesmo domínio ou subdomínio controlado e se a configuração com Apache/proxy/CORS for validada em homologação.
- Se cookie for escolhido, a proteção contra CSRF passa a ser obrigatória e deve ser implementada/testada antes de expor endpoints internos sensíveis.
- `Authorization: Bearer` fica como alternativa operacional, não como primeira preferência, caso cookies seguros tragam complexidade operacional excessiva no primeiro ciclo.
- Se `Authorization: Bearer` for usado, evitar `localStorage` quando possível, não registrar `Authorization` em logs, usar sessão opaca revogável, expiração curta/moderada e validar risco de XSS.
- A decisão final sobre transporte deve ser tomada antes da criação do endpoint de login.
- Nenhum endpoint de login deve ser implementado enquanto essa decisão estiver pendente.

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
- Ações sensíveis precisam de permissão específica.
- Listagens devem aplicar escopo por módulo/setor quando necessário.

Exemplos de permissões futuras:

- `iluminacao.solicitacoes.ler`
- `iluminacao.solicitacoes.triagem`
- `iluminacao.solicitacoes.atualizar_status`
- `iluminacao.solicitacoes.adicionar_observacao`
- `iluminacao.solicitacoes.ver_contato`
- `auth.usuarios.gerenciar`

Observação:

- Nomes são exemplos; permissões reais devem ser criadas em etapa própria, sem seed pública com dados reais.

## 9. Proteção contra brute force e credential stuffing

Controles obrigatórios:

- Rate limit no endpoint de login.
- Atraso progressivo ou bloqueio temporário após falhas repetidas.
- Resposta genérica para login inválido.
- Não revelar se login/e-mail existe.
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
- `GRANT`s devem ser etapa separada e documentada.
- Evitar superuser.
- Evitar `DELETE` em tabelas de auditoria.
- Avaliar permissões separadas para leitura/escrita.
- Produção deve começar sem usuário real até fluxo seguro ser criado.

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
| Hash de senha | Argon2id com `argon2-cffi`; bcrypt apenas como alternativa operacional | Serviço, repository de usuários e service de autenticação criados sem endpoint |
| Sessão/token | Sessão opaca com token_hash HMAC-SHA256 no banco | Services, repositories, dependency, router tecnico de smoke e feature flag fail-closed criados; router ativo somente com flag ligada |
| Auditoria de login | Repository com `record_login_attempt(...)` e `count_recent_failed_attempts(...)` | Repository criado e integrado ao `auth_service.py` |
| Rate limit de login | Service puro com `LoginRateLimitDecision` e `evaluate_login_rate_limit(...)` | Service criado e integrado ao `auth_service.py` |
| Atraso progressivo e bloqueio temporário | Implementar integrado ao rate limit antes de endpoint | Pendente; pronto para integração |
| Transporte do token | Cookie HttpOnly/Secure/SameSite como preferência futura; Bearer como alternativa operacional | Service puro de extração criado; decisão final ainda pendente antes de endpoint |
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
5. Manter `GEOPORTAL_INTERNAL_ROUTES_ENABLED` desligada por padrao; ativar o smoke apenas em homologacao controlada.
6. Configurar segredo real de HMAC em etapa segura, sem registrar em log.
7. Planejar smoke test protegido ou middleware de autenticacao.
8. Implementar autorização por permissão.
9. Criar endpoint de login somente após testes, auditoria integrada, rate limit integrado e transporte de token definido.
10. Trabalhar as próximas etapas críticas com Codex High.
11. Criar endpoints internos mínimos protegidos.
12. Criar tela interna mínima.
13. Continuar a próxima etapa crítica com Codex High.

Observação:

- Quando chegar na implementação de middleware, endpoints internos e telas, a tarefa deve ser feita com Codex High, não Copilot, por envolver segurança crítica e integração sensível.

## 16. Referências curtas

- `docs/INTERNAL-AUTH-SECURITY-IMPLEMENTATION-PLAN.md`
- `docs/INTERNAL-AUTH-DATA-MODEL.md`
- `docs/INTERNAL-AUTHORIZATION-PLAN.md`
- `docs/SECURITY-HARDENING-PLAN.md`
- `docs/API-SERVER-DEPLOYMENT-PLAN.md`
