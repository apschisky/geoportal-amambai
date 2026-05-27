# Plano de Implementacao Segura da Autenticacao Interna

Este documento orienta a implementacao futura da autenticacao interna do Geoportal. Ele nao cria codigo, migrations, endpoints, telas, usuarios reais, senhas, tokens, sessoes, seeds ou configuracoes de ambiente.

A base estrutural inicial do schema `mod_auth` ja foi criada, aplicada e documentada em homologacao e producao pelas migrations `0006` a `0009`. Ainda nao existe login funcional, endpoint interno, tela interna, usuario real, senha real, token real, sessao real ou seed.

Antes de expor endpoints internos, a API publica atual deve permanecer revisada e saudavel conforme `docs/PUBLIC-API-SECURITY-REVIEW.md`.

Registro atual de implementação: o serviço interno de hash/verificação de senha usando Argon2id (`argon2-cffi`) foi implementado e validado. O serviço interno de sessão opaca/token foi implementado e validado. O repository interno de sessões foi criado para `mod_auth.sessoes`, usando `token_hash`, expiração e revogação por `revogado_em`, sem `DELETE`. O repository interno de usuários foi criado para `mod_auth.usuarios`, buscando por login ou e-mail com bind param e comparações case-insensitive. O service interno de autenticação/sessão foi criado em `geoportal-backend/app/services/auth_service.py` sem endpoint. O service interno de validação de sessão autenticada foi criado em `geoportal-backend/app/services/auth_current_session_service.py`; recebe token bruto e `session_secret` apenas internamente, calcula `token_hash`, consulta sessão ativa e retorna apenas dados internos mínimos, sem retornar token bruto, `token_hash`, `session_secret`, senha ou `senha_hash`. Sessão inválida ou token vazio retorna `None`. `session_secret` inválido e erros de repository/banco sobem como erro interno, sem fallback inseguro. O service puro de transporte de token foi criado em `geoportal-backend/app/services/auth_token_transport_service.py`; ele extrai token de `session_cookie` ou `Authorization: Bearer`, retorna `transport = "cookie"` para cookie válido, `transport = "bearer"` para Bearer válido, marca cookie+bearer simultâneos como ambíguos e não escolhe silenciosamente, e não depende de FastAPI, `Request`, endpoint ou middleware. A dependency FastAPI interna foi criada em `geoportal-backend/app/dependencies/auth_dependencies.py`; ela compõe transporte e validação de sessão, retorna `HTTPException 401` genérica para falhas e ainda não protege endpoints reais. Token ausente retorna `token = None`. Authorization malformado, Basic, Bearer sem token ou Bearer com partes extras retornam `is_malformed = True`. Esse service não valida criptograficamente a sessão nem consulta o banco; ele apenas extrai e normaliza o token. A validação real de sessão continua em `auth_current_session_service.py`. O repository interno de auditoria de login foi criado em `geoportal-backend/app/repositories/auth_login_audit_repository.py` com funções `record_login_attempt(...)` e `count_recent_failed_attempts(...)`; registra apenas campos seguros (`usuario_id`, `login_informado`, `sucesso`, `motivo_falha`, `criado_em`, `origem`); não registra senha, token ou session_secret. O service puro de rate limit de login foi criado em `geoportal-backend/app/services/auth_rate_limit_service.py` com `LoginRateLimitDecision` e `evaluate_login_rate_limit(...)`; não depende de FastAPI ou banco; não revela existência de usuário; decide por `failed_attempts`, `max_attempts` e `window_minutes`. Auditoria e rate limit foram integrados ao `auth_service.py`; o rate limit é avaliado antes da verificação de senha.
Validação local desta etapa: `tests/test_auth_dependencies.py`, `tests/test_auth_token_transport_service.py` e `tests/test_auth_current_session_service.py` passaram; suite completa local passou com 201 testes.
Validação no servidor: git pull aplicado; testes no servidor passaram; homologação, produção local e produção pública foram reiniciadas e validadas. A API pública continuou saudável em todos os ambientes.
Ainda não há endpoint interno de login exposto, endpoint interno protegido real, usuário real, sessão real criada por endpoint, token real, cookie real, CSRF, JWT ou middleware de autenticação. A dependency FastAPI existe, mas não está aplicada a rota real.
Próximos passos: planejar endpoint técnico de smoke test protegido ou endpoint de login com cautela, mantendo respostas genéricas e controles de auditoria/rate limit; esta etapa crítica deve seguir Codex High.

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
11. → Implementar atraso progressivo e bloqueio temporário persistente integrados.
12. → Planejar smoke test protegido ou middleware de autenticação/autorização.
13. → Criar testes automatizados de acesso negado/autorizado com rota controlada, dependency ou middleware.
14. → Criar endpoint de login em homologação com auditoria/rate limit integrados.
15. → Criar endpoints internos mínimos, todos protegidos.
16. → Criar tela interna mínima.
17. → Fazer revisão de segurança antes de uso por equipe real.

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
