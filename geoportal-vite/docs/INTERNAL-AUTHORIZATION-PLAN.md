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
- Sessao ou token com expiracao.
- Renovacao controlada quando aplicavel.
- Usuario precisa estar ativo para acessar.
- Senha armazenada somente como hash com algoritmo adequado.
- Senha nunca armazenada em texto puro.
- Senha, token e segredo nunca registrados em log.
- Falhas de autenticacao devem retornar erro generico.
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

- `geoportal_api_homolog` fica planejada como futura role runtime da API interna em homologacao, ainda sem criacao real nesta etapa.
- `geoportal_auth_admin_homolog` e apenas role de bootstrap administrativo e nao deve ser usada pelo endpoint de login.
- A matriz minima prevista para login e validacao de sessao inclui `CONNECT`, `USAGE` em `mod_auth`, `SELECT` em `mod_auth.usuarios`, `UPDATE` apenas de `ultimo_login_em`/`atualizado_em`, `SELECT`/`INSERT`/`UPDATE` em `mod_auth.sessoes` sem `DELETE`, `SELECT`/`INSERT` em `mod_auth.login_auditoria` sem `UPDATE`/`DELETE`, e `USAGE`/`SELECT` nas sequences `mod_auth.sessoes_id_seq` e `mod_auth.login_auditoria_id_seq`.
- A role nao deve ter `CREATE`, `DROP`, `ALTER`, `TRUNCATE`, `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION`, `BYPASSRLS`, acesso automatico a `plano`, `web_map` ou `mod_iluminacao`, nem deve reutilizar `postgres` como usuario runtime.
- A criacao real deve ser etapa operacional separada, sem producao, com backup de roles, comandos revisados e validacao de permissoes.
- O endpoint de login permanece etapa separada, com testes e feature flag ou controle equivalente de exposicao.

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
