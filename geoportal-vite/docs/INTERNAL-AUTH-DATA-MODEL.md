# Modelo de Dados de Autenticacao e Autorizacao Interna

Este documento define o modelo conceitual de autenticacao e autorizacao para o Geoportal Interno. Ele nao cria codigo, migrations, endpoints, telas, usuarios reais, senhas, tokens ou configuracoes de ambiente.

O detalhamento tecnico das futuras migrations do schema `mod_auth` esta em `docs/INTERNAL-AUTH-MIGRATIONS-PLAN.md`.
As escolhas de hash, sessao, transporte de token e autorizacao devem seguir as decisoes iniciais documentadas em `docs/INTERNAL-AUTH-TECHNICAL-DECISIONS.md`.
O serviço interno de hash/verificação de senha com Argon2id já foi implementado e validado. O serviço interno de sessão opaca/token foi implementado e validado. O repository interno de sessões foi criado para operar somente com `token_hash` e filtrar revogação, expiração e estado do usuário. O repository interno de usuários foi criado para busca autenticável por login/e-mail. O service interno de autenticação/sessão foi criado em `geoportal-backend/app/services/auth_service.py` sem endpoint. O service interno de validação de sessão autenticada foi criado em `geoportal-backend/app/services/auth_current_session_service.py`; recebe token bruto e `session_secret`, calcula `token_hash`, consulta sessão ativa e retorna apenas `usuario_id`, `sessao_id` e `expira_em`, sem retornar token bruto, `token_hash`, `session_secret`, senha ou `senha_hash`. O service puro de transporte de token foi criado em `geoportal-backend/app/services/auth_token_transport_service.py`; ele extrai token de `session_cookie` ou `Authorization: Bearer`, retorna `transport = "cookie"` para cookie válido e `transport = "bearer"` para Bearer válido, marca cookie+bearer simultâneos como ambíguos e não escolhe silenciosamente, e não depende de FastAPI, `Request`, endpoint ou middleware. Token ausente retorna `token = None`. Authorization malformado, Basic, Bearer sem token ou Bearer com partes extras retornam `is_malformed = True`. Esse service não valida sessão criptograficamente nem consulta banco; ele apenas extrai e normaliza o token. A validação real de sessão continua em `auth_current_session_service.py`. `session_secret` inválido e erros de repository/banco sobem como erro interno, sem fallback inseguro. O repository interno de auditoria de login foi criado em `geoportal-backend/app/repositories/auth_login_audit_repository.py` com `record_login_attempt(...)` e `count_recent_failed_attempts(...)`; registra apenas campos seguros (`usuario_id`, `login_informado`, `sucesso`, `motivo_falha`, `criado_em`, `origem`); não registra senha, token ou session_secret. O service puro de rate limit de login foi criado em `geoportal-backend/app/services/auth_rate_limit_service.py` com lógica pura que não revela existência de usuário. Auditoria e rate limit foram integrados ao `auth_service.py` antes de qualquer endpoint de login; o rate limit é avaliado antes da verificação de senha. Auditoria registra sucesso/falha sem incluir senha, senha_hash, token, token_hash ou session_secret. A revogação de sessão usa `revogado_em`, sem `DELETE`. Ainda não há endpoint interno exposto, usuário real, sessão real criada por endpoint, token real, cookie real, CSRF, JWT ou middleware; a dependency FastAPI existe apenas como preparação interna e não está aplicada a rota real.
Registro de dependency interna: `geoportal-backend/app/dependencies/auth_dependencies.py` foi criada para compor o transporte de token com a validacao de sessao autenticada. Ela retorna 401 generico para falhas de autenticacao, usa segredo de sessao por funcao injetavel/testavel, nao registra token/segredo e ainda nao esta aplicada a endpoint real. Portanto, ainda nao ha endpoint interno exposto, usuario real, sessao real criada por endpoint, token real, cookie real, CSRF, JWT ou middleware; a dependency existe apenas como preparacao interna.
O plano de threat model, controles e validacao para a implementacao segura da autenticacao backend esta em `docs/INTERNAL-AUTH-SECURITY-IMPLEMENTATION-PLAN.md`.

Registro documental: a migration `0006_create_mod_auth_schema.sql` foi criada e aplicada em homologacao e no banco ativo de producao apos backup manual validado. O schema `mod_auth` foi criado com comentario validado, e nenhuma tabela foi criada nesta etapa. O rollback correspondente permanece disponivel para ambiente controlado.

Registro documental: a migration `0007_create_mod_auth_usuarios.sql` foi aplicada e validada em homologacao e no banco ativo de producao apos backup manual validado. A tabela `mod_auth.usuarios` foi criada, indices e constraints foram validados com dados ficticios em homologacao, os dados ficticios foram removidos e a tabela ficou vazia apos a limpeza. Em producao, os indices foram validados, a tabela permaneceu vazia apos a criacao e nenhum usuario real, seed, endpoint ou login funcional foi criado.

Registro documental: a migration `0008_create_mod_auth_perfis_permissoes.sql` foi aplicada e validada em homologacao e no banco ativo de producao apos backup manual validado. As tabelas de perfis, permissoes e vinculos foram criadas, indices e FKs restritivas foram validados, constraints e vinculos foram testados com dados ficticios em homologacao, os dados ficticios foram removidos e todas as tabelas `mod_auth` ficaram vazias apos a limpeza. Em producao, todas as tabelas `mod_auth` permaneceram vazias apos a criacao, a API publica continuou saudavel, `/api/health` e `/api/public/iluminacao/health` continuaram OK, `/api/version` continuou retornando ambiente `producao` e nenhum usuario, perfil, permissao, vinculo, seed, endpoint ou login funcional foi criado.

Registro documental: a migration `0009_create_mod_auth_sessoes_login_auditoria.sql` foi aplicada e validada em homologacao e no banco ativo de producao apos backup manual validado. As tabelas `mod_auth.sessoes` e `mod_auth.login_auditoria` foram criadas, indices e FKs restritivas foram validados, constraints foram testadas com dados ficticios em homologacao, os dados ficticios foram removidos e todas as tabelas `mod_auth` ficaram vazias apos a limpeza. Em producao, todas as tabelas `mod_auth` permaneceram vazias apos a criacao, a API publica continuou saudavel, `/api/health` e `/api/public/iluminacao/health` continuaram OK, `/api/version` continuou retornando ambiente `producao` e nenhum login funcional, endpoint, usuario real, token real, sessao real, auditoria real ou seed foi criado. A base estrutural inicial do schema `mod_auth` esta concluida; a proxima etapa deve planejar e implementar autenticacao backend com testes, sem criar acesso interno publico sem autenticacao.

## 1. Objetivo

- Definir um modelo transversal de autenticacao e autorizacao para o Geoportal Interno.
- Atender todos os modulos internos futuros, nao apenas Iluminacao Publica.
- Evitar multiplos sistemas de login separados por modulo.
- Permitir que usuarios tenham perfis e permissoes diferentes conforme o modulo.

## 2. Schema conceitual

O schema futuro recomendado e `mod_auth`.

`mod_auth` deve ser transversal aos modulos internos. Ele deve concentrar usuarios, perfis, permissoes, sessoes e auditoria de login, enquanto schemas de modulo, como `mod_iluminacao`, continuam responsaveis pelos dados operacionais especificos.

## 3. Tabelas conceituais futuras

- `mod_auth.usuarios`
- `mod_auth.perfis`
- `mod_auth.permissoes`
- `mod_auth.usuario_perfis`
- `mod_auth.perfil_permissoes`
- `mod_auth.sessoes`
- `mod_auth.login_auditoria`

## 4. `mod_auth.usuarios`

Campos conceituais:

- `id`
- `nome`
- `email`
- `login`
- `senha_hash`
- `ativo`
- `bloqueado_ate`
- `ultimo_login_em`
- `criado_em`
- `atualizado_em`
- `desativado_em`

Regras:

- Senha nunca deve ser armazenada em texto puro.
- `email` e `login` devem ser unicos.
- Usuario desativado nao deve acessar endpoints internos.
- Tentativas excessivas de login devem aplicar bloqueio temporario, atraso ou protecao equivalente.
- Logs nunca devem registrar senha, hash de senha ou token.
- Repository interno criado em `geoportal-backend/app/repositories/auth_user_repository.py`, sem endpoint e sem login funcional.
- O repository pode ler `senha_hash` apenas em record interno para verificacao futura de senha no backend.
- `senha_hash` nao deve ser retornado por endpoint e nao deve ser registrado em log.
- A busca usa login ou e-mail normalizado de forma case-insensitive e nao cria sessao, auditoria ou usuario.
- O service interno de autenticacao/sessao usa esse record apenas no backend, retorna falha generica e nao expõe `senha_hash`.

## 5. `mod_auth.perfis`

Exemplos de perfis:

- `admin`
- `gestor_modulo`
- `atendente_triagem`
- `equipe_execucao`
- `leitura`

Regras:

- Perfis sao agrupadores de permissoes.
- Perfis podem ser reaproveitados entre modulos.
- O perfil `admin` deve ser restrito e revisado periodicamente.
- A matriz final de perfis deve ser validada com a operacao antes do uso real.

## 6. `mod_auth.permissoes`

Modelo recomendado:

- `id`
- `modulo`
- `chave`
- `descricao`
- `ativo`

Exemplos:

- `iluminacao.visualizar_solicitacoes`
- `iluminacao.alterar_status`
- `iluminacao.registrar_observacao`
- `iluminacao.visualizar_historico`
- `defesa_civil.visualizar_ocorrencias`
- `meio_ambiente.analisar_denuncias`
- `admin.gerenciar_usuarios`

Regras:

- Permissoes devem ser granulares por acao.
- Permissoes devem ser verificadas no backend.
- Permissoes inativas nao devem autorizar acesso.

## 7. `mod_auth.usuario_perfis`

Finalidade:

- Vincular usuarios a perfis.
- Permitir escopo por modulo quando necessario.

Campos conceituais:

- `usuario_id`
- `perfil_id`
- `modulo`
- `ativo`
- `criado_em`

Regras:

- Um usuario pode ter perfis diferentes por modulo.
- Um vinculo inativo nao deve conceder permissao.
- O campo `modulo` pode ser usado para limitar o perfil a um modulo especifico.

## 8. `mod_auth.perfil_permissoes`

Finalidade:

- Vincular perfis a permissoes.
- Permitir montar matriz de acesso por modulo.

Regras:

- Um perfil pode ter varias permissoes.
- Uma permissao pode ser usada por varios perfis.
- A resolucao final de acesso deve considerar usuario ativo, perfil ativo, permissao ativa e escopo de modulo.

## 9. `mod_auth.sessoes`

Finalidade:

- Registrar sessoes, tokens ativos ou identificadores seguros.
- Permitir expiracao e revogacao.

Campos conceituais:

- `id`
- `usuario_id`
- `token_hash` ou identificador seguro equivalente
- `criado_em`
- `expira_em`
- `revogado_em`
- `ip_hash`, se necessario futuramente
- `user_agent_hash`, se necessario futuramente

Regras:

- Nao armazenar token puro se houver alternativa segura.
- Expiracao de sessao ou token e obrigatoria.
- Sessoes devem poder ser revogadas.
- Repository interno criado em `geoportal-backend/app/repositories/auth_session_repository.py`, sem endpoint e sem login funcional.
- O repository insere e consulta `token_hash`; ele nao cria token bruto, nao retorna token bruto e nao retorna `senha_hash`.
- A consulta de sessao ativa filtra `revogado_em IS NULL`, `expira_em > now()` e usuario ativo, nao desativado e nao bloqueado no momento da consulta.
- Revogacao usa preenchimento de `revogado_em` por `UPDATE`; nao usa `DELETE`.
- Evitar IP bruto e user-agent bruto sem politica de retencao definida.
- Logs nao devem conter token, cookie de sessao ou identificador sensivel.

## 10. `mod_auth.login_auditoria`

Finalidade:

- Registrar tentativas de login.
- Apoiar detecção de abuso e investigação operacional segura.

Campos conceituais:

- `id`
- `usuario_id`, quando identificado
- `login_informado`
- `sucesso`
- `motivo_falha`
- `criado_em`
- `origem`

Regras:

- Não registrar senha.
- `motivo_falha` deve ser genérico.
- Evitar IP bruto se não houver política definida.
- Registro de auditoria não deve expor token, senha, hash de senha ou detalhes internos sensíveis.
- Repository interno criado em `geoportal-backend/app/repositories/auth_login_audit_repository.py` com funções `record_login_attempt(...)` e `count_recent_failed_attempts(...)`.
- `record_login_attempt(...)` insere usando parametrização SQL; registra apenas campos seguros (`usuario_id`, `login_informado`, `sucesso`, `motivo_falha`, `criado_em`, `origem`); não registra senha, token, token_hash ou session_secret.
- `count_recent_failed_attempts(...)` consulta usando parametrização SQL; conta tentativas falhadas em janela de tempo para suportar rate limit.
- Service puro de rate limit criado em `geoportal-backend/app/services/auth_rate_limit_service.py` com `LoginRateLimitDecision` e `evaluate_login_rate_limit(...)`; não depende de FastAPI ou banco; decide por `failed_attempts`, `max_attempts` e `window_minutes`; não revela se usuário existe.
- Auditoria e rate limit estão integrados ao `auth_service.py`; ainda não há endpoint de login.
- Testes passaram: `tests/test_auth_login_audit_repository.py` (4) + `tests/test_auth_rate_limit_service.py` (8) + suite completa (155).
- O repository usa `usuario_id`, `login_informado`, `sucesso`, `motivo_falha`, `criado_em` e `origem`, conforme a migration `0009`.
- Contagem de falhas recentes usa `SELECT count(*)`, janela temporal, falhas (`sucesso IS false`) e filtros opcionais por `login_informado` e `origem`.
- Service puro de rate limit criado em `geoportal-backend/app/services/auth_rate_limit_service.py`; a integracao com endpoint ainda e etapa futura.

## 11. Seguranca

- Senhas devem usar hash forte e algoritmo adequado.
- Sessao ou token deve ter expiracao.
- Senha, token e `DATABASE_URL` nunca devem aparecer em logs.
- Falha de login deve retornar erro generico.
- Tentativas excessivas devem aplicar bloqueio temporario, atraso ou protecao equivalente.
- Contas inativas devem ser bloqueadas.
- Banco deve seguir menor privilegio.
- Endpoints internos devem validar autenticacao e autorizacao no backend.
- HTTPS deve ser obrigatorio em producao.
- CORS deve permanecer restrito.

## 12. Escopo por modulo

O modelo deve permitir que o mesmo usuario tenha permissoes diferentes por modulo.

Exemplo conceitual:

- `leitura` em Iluminacao Publica.
- `gestor_modulo` em Defesa Civil.
- Sem acesso em Fiscalizacao.

Essa separacao evita dar permissao ampla quando a necessidade operacional e limitada a um modulo.

## 13. Relacao com endpoints internos

- Endpoints em `/api/internal/...` devem consultar esse modelo ou uma camada equivalente de autorizacao.
- Permissoes devem ser verificadas no backend.
- Esconder botoes, menus ou telas no front-end nao e seguranca suficiente.
- Endpoints publicos em `/api/public/...` nao devem depender de login interno.
- Endpoints publicos nunca devem retornar observacoes internas, historico administrativo completo ou dados de autenticacao.

## 14. Roadmap

1. ✓ Documentar o modelo conceitual.
2. ✓ Criar migrations de `mod_auth` conforme `docs/INTERNAL-AUTH-MIGRATIONS-PLAN.md`.
3. ✓ Implementar services internos de hash/sessão/token.
4. ✓ Implementar repository de auditoria e service puro de rate limit.
5. ✓ Integrar auditoria e rate limit ao `auth_service.py`.
6. ✓ Implementar service interno de validação de sessão autenticada sem endpoint.
7. ✓ Implementar service puro de transporte de token sem endpoint.
8. → Implementar endpoint controlado somente depois de transporte de token, middleware/dependency e testes.
9. → Implementar autorização por dependência, middleware ou mecanismo equivalente.
10. → Testar acesso autorizado e negado com auditoria registrada.
11. → Criar endpoints internos operacionais somente depois da autenticação/autorização validada.

## 15. Fora do escopo desta etapa

- Implementar login.
- Criar migrations.
- Criar endpoints.
- Criar telas.
- Cadastrar usuarios reais.
- Definir senhas reais.
- Registrar tokens reais.

## 16. Criterios de aceite

- Documentacao clara.
- Modelo transversal aos modulos internos.
- Sem dados sensiveis.
- Sem codigo funcional.
- Sem migrations.
- Sem endpoints.
- Pronto para orientar a proxima fase de autenticacao/autorizacao interna.
