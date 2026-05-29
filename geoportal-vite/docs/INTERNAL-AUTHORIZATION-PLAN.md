# Plano de Autenticacao e Autorizacao Interna

Este documento registra o desenho conceitual dos endpoints internos protegidos do modulo de Iluminacao Publica. Ele nao cria codigo, migrations, endpoints, usuarios reais, senhas, tokens ou configuracoes de ambiente.

O modelo conceitual transversal de dados de autenticacao/autorizacao esta em `docs/INTERNAL-AUTH-DATA-MODEL.md`.

A decisao tecnica de autenticacao interna e autorizacao deve ser alinhada com `docs/INTERNAL-AUTH-TECHNICAL-DECISIONS.md` antes de implementar endpoints.

O plano tecnico das futuras migrations de `mod_auth` esta em `docs/INTERNAL-AUTH-MIGRATIONS-PLAN.md`.

O plano de threat model, controles e validacao para a implementacao segura da autenticacao backend esta em `docs/INTERNAL-AUTH-SECURITY-IMPLEMENTATION-PLAN.md`.

Registro documental: a migration `0008_create_mod_auth_perfis_permissoes.sql` foi aplicada e validada em homologacao e no banco ativo de producao para estruturar perfis, permissoes e vinculos. Dados ficticios de validacao foram removidos em homologacao, todas as tabelas `mod_auth` permaneceram vazias apos a criacao em producao e nenhum usuario, perfil, permissao, vinculo, seed, endpoint ou login funcional foi criado.

Registro documental: a migration `0009_create_mod_auth_sessoes_login_auditoria.sql` foi aplicada e validada em homologacao e no banco ativo de producao para estruturar sessoes e auditoria de login. Dados ficticios de validacao foram removidos em homologacao, todas as tabelas `mod_auth` permaneceram vazias apos a criacao em producao e nenhum login funcional, endpoint, token real, sessao real, auditoria real ou seed foi criado. A base estrutural inicial do schema `mod_auth` esta concluida; a proxima etapa deve planejar e implementar autenticacao backend com testes, sem criar acesso interno publico sem autenticacao.

## 1. Separacao publico/interno

- Endpoints publicos continuam em `/api/public/...`.
- Endpoints internos devem ficar em `/api/internal/...`.
- Endpoints internos nao devem reutilizar endpoints publicos.
- Endpoints publicos nunca retornam observacoes internas.
- Endpoints publicos nunca retornam historico administrativo completo.
- Endpoints internos nao devem ser protegidos apenas por regras do front-end.
- Toda validacao de autenticacao e autorizacao deve ocorrer no backend.

## 2. Endpoints internos conceituais

Primeira versao conceitual para Iluminacao Publica:

- `GET /api/internal/iluminacao/solicitacoes`
- `GET /api/internal/iluminacao/solicitacoes/{id}`
- `PATCH /api/internal/iluminacao/solicitacoes/{id}/status`
- `POST /api/internal/iluminacao/solicitacoes/{id}/observacoes`
- `GET /api/internal/iluminacao/solicitacoes/{id}/historico`
- `GET /api/internal/iluminacao/estatisticas`

Nenhum endpoint interno deve ser implementado sem autenticacao. Nenhum endpoint interno deve ser publicado sem autorizacao por perfil e testes automatizados de acesso permitido e negado.

## 3. Autenticacao conceitual

- Login interno obrigatorio.
- Sessao opaca com expiracao; para navegador, transporte principal por cookie HttpOnly `geoportal_internal_session`.
- Renovacao controlada quando aplicavel.
- Usuario precisa estar ativo para acessar.
- Senha armazenada somente como hash com algoritmo adequado.
- Senha nunca armazenada em texto puro.
- Senha, token e segredo nunca registrados em log.
- Falhas de autenticacao devem retornar erro generico.
- Endpoints internos mutaveis devem exigir protecao CSRF/equivalente; a protecao inicial definida e o header `X-Geoportal-Internal-Request: 1`, alem de SameSite=Lax no cookie.
- Tentativas excessivas de login devem aplicar atraso, bloqueio temporario ou outra protecao equivalente.
- Politica de senha deve ser revisada antes do uso por equipe real.
- Integracao futura com provedor externo pode ser avaliada, mas a primeira versao nao deve depender disso para ser segura.

## 4. Perfis e permissoes

Perfis sugeridos:

- `admin`
- `gestor_modulo`
- `atendente_triagem`
- `equipe_execucao`
- `leitura`

Permissoes conceituais:

- `visualizar_solicitacoes`
- `visualizar_detalhe`
- `alterar_status`
- `registrar_observacao`
- `visualizar_historico`
- `visualizar_estatisticas`
- `administrar_usuarios`

`administrar_usuarios` deve ficar restrita a `admin` em etapa futura.

## 5. Matriz de permissoes sugerida

| Perfil | Permissoes |
|---|---|
| `admin` | Todas as permissoes, incluindo administracao futura de usuarios. |
| `gestor_modulo` | Visualizar solicitacoes e detalhe, alterar status, registrar observacao, visualizar historico e estatisticas. |
| `atendente_triagem` | Visualizar solicitacoes e detalhe, alterar status de triagem, registrar observacao e visualizar historico. |
| `equipe_execucao` | Visualizar solicitacoes encaminhadas ou em execucao, registrar observacao, alterar para `em_execucao`, `resolvida` ou `nao_localizado`, e visualizar historico limitado. |
| `leitura` | Visualizar solicitacoes, detalhe permitido e historico permitido, sem operacoes de escrita. |

A matriz final deve ser validada com a operacao antes de qualquer ativacao real.

## 6. Auditoria obrigatoria

- Alteracao de status deve gravar em `mod_iluminacao.solicitacoes_historico`.
- Nao deve existir alteracao de status sem historico.
- Criacao de observacao deve gravar em `mod_iluminacao.solicitacoes_observacoes`.
- Criacao de observacao tambem deve gravar evento resumido em `mod_iluminacao.solicitacoes_historico`.
- Acoes internas devem registrar `usuario_id`, `usuario_nome` e `origem_acao = 'usuario_interno'` quando aplicavel.
- Acoes automaticas devem registrar `origem_acao = 'sistema'`.
- Ajustes administrativos devem registrar `origem_acao = 'ajuste_administrativo'`.
- Auditoria deve registrar data/hora e resumo seguro da acao.

## 7. Seguranca de dados

- Listagens devem minimizar dados pessoais.
- Detalhes internos podem exibir mais dados conforme perfil e necessidade operacional.
- Telefone ou contato nao deve aparecer em listagem ampla se nao for necessario.
- Observacoes internas nunca aparecem na consulta publica.
- Historico administrativo completo nunca aparece na consulta publica.
- Logs devem evitar dados pessoais.
- Logs nunca devem conter senha, token, `DATABASE_URL`, SQL sensivel ou credenciais.

## 8. Protecao operacional

- Endpoints internos devem ter rate limit ou protecao equivalente contra abuso.
- CORS deve permanecer restrito.
- HTTPS deve ser obrigatorio em producao.
- Cookie de sessao interno deve usar HttpOnly, Secure em producao, SameSite=Lax e Path `/api/internal`.
- Mensagens de erro nao devem revelar detalhes de seguranca.
- Falhas de autenticacao devem usar resposta generica.
- Tentativas excessivas de login devem gerar atraso, bloqueio temporario ou alerta operacional.
- Usuario inativo deve ser bloqueado.
- Permissoes devem ser revisadas periodicamente.

## 9. Estrategia de implementacao segura

1. Fase 1: documentacao de autenticacao e autorizacao.
2. Fase 2: modelo de dados de usuarios, perfis e sessoes, ou decisao tecnica equivalente.
3. Fase 3: migrations de seguranca e autenticacao.
4. Fase 4: implementacao de autenticacao no backend com testes.
5. Fase 5: implementacao dos endpoints internos protegidos.
6. Fase 6: tela interna minima consumindo endpoints protegidos.
7. Fase 7: auditoria e revisao de seguranca antes de uso por equipe real.

## 9.1 Escalabilidade multi-módulo

O Geoportal Interno é arquiteturado para ser escalável a múltiplos módulos, não apenas Iluminação Pública. A estratégia de autenticação e autorização reflete essa escalabilidade:

**Estrutura de schemas:**

- `mod_auth`: Schema transversal centralizado com usuários, perfis, permissões, sessões e auditoria de login.
- `mod_iluminacao`: Schema do módulo de Iluminação Pública com dados operacionais específicos.
- `mod_*`: Futuros schemas de outros módulos.

**Modelo de usuários:**

- Um usuário humano em `mod_auth.usuarios` representa uma pessoa.
- O mesmo usuário pode ter diferentes perfis em diferentes módulos.
- Exemplo: Um supervisor pode ser `admin` em Iluminação Pública, mas apenas `gestor_modulo` em futuro módulo de Drenagem.
- Permissões específicas por módulo são controladas via `mod_auth.usuario_perfis` (vinculo entre usuário, perfil e módulo) e `mod_auth.perfil_permissoes`.

**Separação de permissões:**

- Permissões no banco (roles PostgreSQL) devem ser mínimas e restritas a schemas específicos.
- Exemplos: `api_iluminacao_homolog` acessa apenas `mod_iluminacao`.
- Permissões de aplicação (lógica de negócio) são controladas em `mod_auth` via perfis e permissões de aplicação.
- Exemplo: Um usuário com permissão `visualizar_solicitacoes` no módulo de Iluminação Pública será verificado no backend antes de retornar dados.

**Role runtime de autenticacao em homologacao:**

- `geoportal_api_homolog` foi criada em homologacao como role runtime da API interna de autenticacao com permissoes minimas: `CONNECT`, `USAGE mod_auth`, `SELECT mod_auth.usuarios`, `SELECT/INSERT mod_auth.sessoes`. Validada com endpoint de login operacional.
- `geoportal_auth_admin_homolog` e apenas role de bootstrap administrativo e nao deve ser usada pelo endpoint de login.
- A matriz minima para login e validacao de sessao foi implementada e testada: `CONNECT`, `USAGE` em `mod_auth`, `SELECT` em `mod_auth.usuarios`, `SELECT`/`INSERT` em `mod_auth.sessoes`, `SELECT`/`INSERT` em `mod_auth.login_auditoria`, `USAGE`/`SELECT` nas sequences.
- A role nao deve ter `CREATE`, `DROP`, `ALTER`, `TRUNCATE`, `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION`, `BYPASSRLS`, acesso automatico a `plano`, `web_map` ou `mod_iluminacao`, nem deve reutilizar `postgres` como usuario runtime.
- A criacao real foi etapa operacional separada em homologacao, sem producao, com validacao de permissoes confirmada.
- O endpoint de login `POST /api/internal/auth/login` foi implementado sob feature flag `GEOPORTAL_INTERNAL_ROUTES_ENABLED`, testado e validado em homologacao com sucesso; retorna token opaco protegido temporariamente no corpo e seta cookie HttpOnly `geoportal_internal_session`; ainda sem JWT nesta etapa.

**Proteção CSRF e logout antes de endpoints mutáveis**:

Antes de expor endpoints internos que alteram dados (POST/PUT/DELETE para negócio), as seguintes etapas devem ser planejadas e implementadas:

1. **Estratégia CSRF/equivalente inicial**: Header customizado obrigatório `X-Geoportal-Internal-Request: 1` em rotas internas mutáveis protegidas; Origin/Referer permanece camada complementar futura configurável. Documentado em `geoportal-vite/docs/INTERNAL-AUTH-TECHNICAL-DECISIONS.md`.
2. **Transporte de sessão seguro**: Cookie HttpOnly + Secure em produção + SameSite=Lax + Path `/api/internal`.
3. **Logout implementado**: Endpoint `POST /api/internal/auth/logout` revoga sessão preenchendo `revogado_em` em `mod_auth.sessoes`, sem DELETE físico, e limpa o cookie.
4. **Testes de CSRF/equivalente**: Validar que requisições mutáveis internas sem header são bloqueadas.
5. **Testes de logout**: Validar que sessão revogada não autentica mais.
6. **Validação operacional**: Testar em homologação com usuários reais antes de liberar para produção.

**Critério de endpoint**:

- GET de consulta sem efeito colateral: Sem proteção CSRF obrigatória.
- POST/PUT/DELETE de negócio (criar/editar/deletar): Proteção CSRF obrigatória.
- SameSite não deve ser única defesa contra CSRF; usar combinação de técnicas.

**Validação intermediária com Bearer**:

A validação técnica inicial usou `Authorization: Bearer` com token no corpo. Esta abordagem permanece válida apenas para testes técnicos ou clientes não navegador. Para uso real em navegador, o fluxo principal passa a ser cookie HttpOnly.

**Validação operacional do transporte por cookie e logout**:

O commit `eaf5724` Implementa cookie e logout internos foi validado no servidor com pytest completo: 298 passed. A validação operacional ocorreu em processo isolado de homologação, usando variáveis temporárias (`DATABASE_URL` com `geoportal_api_homolog`, `GEOPORTAL_INTERNAL_ROUTES_ENABLED`, `GEOPORTAL_INTERNAL_SESSION_SECRET`, `GEOPORTAL_INTERNAL_SESSION_COOKIE_SECURE=false` para TestClient/local e `TEST_INTERNAL_PASSWORD`), todas limpas ao final. Não houve alteração de produção, NSSM, `.env` versionado, role, GRANT, migration ou schema.

Resultado sanitizado: login status 200 para `admin.homologacao` (`usuario_id=7`), cookie setado com HttpOnly, SameSite=Lax e Path `/api/internal`, smoke autenticado por cookie status 200, logout sem header status 403, logout com `X-Geoportal-Internal-Request: 1` status 200, cookie limpo e smoke após logout status 401. Contagens após teste: `mod_auth.usuarios=1`, `mod_auth.sessoes=2`, `mod_auth.login_auditoria=2`, `sessoes_revogadas=1`.

Próximos passos de autorização: decidir quando remover o token do corpo da resposta ou restringi-lo a ambiente técnico, planejar validação Origin/Referer como camada complementar, implementar endpoints internos de negócio somente após autorização por perfis/permissões, e não liberar tela interna para usuários reais antes de fechar autorização e frontend seguro.

**Adição de novos módulos:**

1. Criar schema dedicado (ex: `mod_drenagem`).
2. Criar tabelas e estrutura específicas do módulo.
3. Criar roles PostgreSQL mínimas para acesso ao novo schema.
4. Adicionar novos perfis em `mod_auth.perfis` (ex: `gestor_drenagem`).
5. Adicionar novas permissões em `mod_auth.permissoes` com `modulo = 'drenagem'`.
6. Vincular usuários, perfis e permissões conforme necessário.
7. Implementar endpoints internos com validação de permissão por módulo.

**Benefícios:**

- Isolamento de dados por módulo.
- Controle de acesso centralizado em `mod_auth`.
- Facilita adição de novos módulos.
- Reduz duplicação de lógica de autenticação/autorização.
- Permite matriz de permissões complexa e flexível por usuário/módulo.

## 10. Criterios de aceite

- Nenhum endpoint interno publico.
- Autenticacao obrigatoria.
- Autorizacao por perfil.
- Validacao de permissao no backend.
- Testes automatizados cobrindo acesso autorizado e negado.
- Acoes internas gravam auditoria.
- Alteracao de status nunca ocorre sem historico.
- API publica permanece inalterada.
- Google Forms permanece fallback durante a transicao.
- Documentacao atualizada antes de ativacao.

## 11. Riscos prevenidos

- Exposicao de dados pessoais.
- Alteracao indevida de status.
- Acesso interno sem autorizacao.
- Ausencia de rastreabilidade.
- Endpoint administrativo publico por engano.
- Vazamento de token ou senha em log.
- Confusao entre API publica e API interna.
- Ampliacão inadvertida de permissões de usuários técnicos de módulos específicos.
- Falta de escalabilidade para múltiplos módulos.
- Duplicação de lógica de autenticação/autorização entre módulos.
