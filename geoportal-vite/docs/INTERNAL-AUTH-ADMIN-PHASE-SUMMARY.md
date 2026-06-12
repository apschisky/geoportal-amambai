# Resumo Executivo: Fase Administrativa de Autenticação/Autorização Interna

**Status**: Funcional e validada em homologação | **Data**: Junho 1, 2026 | **Commits**: 88ff004 a 1f3b19e

## 1. Conclusão da Fase Administrativa

A fase administrativa da autenticação e autorização interna do Geoportal Amambai está completa, operacional em homologação e pronta para escalabilidade multi-módulo.

### Blocos Funcionais Implementados

1. **Autenticação interna por login/senha**
   - Identificador principal: `login` obrigatório
   - Email: opcional desde Migration 0010
   - Hash: Argon2id (algoritmo robusto)
   - Política centralizada: 6-128 caracteres, letra+número, não igual a login/nome, bloqueada se comum

2. **Sessão opaca**
   - Token: 32 bytes aleatórios (sem JWT)
   - Storage: `mod_auth.sessoes` com `token_hash` (HMAC-SHA256, nunca token bruto)
   - Expiração: configurável
   - Revogação: lógica por `revogado_em = now()` (sem DELETE físico)

3. **Transporte de cookie**
   - Nome: `geoportal_internal_session`
   - HttpOnly: `true`
   - SameSite: `Lax`
   - Path: `/api/internal`
   - Secure: obrigatório em produção, configurável em homologação/local
   - Max-Age: alinhado à sessão

4. **Logout com revogação**
   - Endpoint: `POST /api/internal/auth/logout`
   - Ação: `UPDATE mod_auth.sessoes SET revogado_em = now()`
   - Resultado: Sessão inválida imediatamente, cookie limpo

5. **Autorização por permissões**
   - Base: `mod_auth.perfis`, `mod_auth.permissoes`, `mod_auth.usuario_perfis`, `mod_auth.perfil_permissoes`
   - Padrão de permissão: `modulo.recurso.acao` (ex: `admin.usuarios.criar`)
   - Sem regra hardcoded por login
   - Verificação em tempo de requisição via `require_permission("...")`

6. **Proteção de rotas mutáveis**
   - Feature flag: `GEOPORTAL_INTERNAL_ROUTES_ENABLED` (fail-closed)
   - Header obrigatório em mutáveis: `X-Geoportal-Internal-Request: 1`
   - GET não exigem header (consultas somente leitura)
   - POST/PUT/PATCH exigem header

7. **Smoke tests internos**
   - `GET /api/internal/auth/smoke`: validação de feature flag e autenticação
   - `GET /api/internal/auth/permission-smoke`: validação de permissão específica

## 2. Endpoints Internos Validados

### Autenticação e Sessão

| Endpoint | Método | Permissão | Descrição | Status |
|----------|--------|-----------|-----------|--------|
| `/api/internal/auth/login` | POST | (autenticação) | Login por login/senha, seta cookie | ✅ Validado |
| `/api/internal/auth/logout` | POST | autenticado | Logout com revogação e limpeza de cookie | ✅ Validado |
| `/api/internal/auth/me` | GET | autenticado | Retorna usuário_id e permissões efetivas | ✅ Validado |
| `/api/internal/auth/smoke` | GET | autenticado | Smoke test de sessão | ✅ Validado |
| `/api/internal/auth/permission-smoke` | GET | `internal.auth.me` | Smoke test de permissão | ✅ Validado |

### Administração de Usuários

| Endpoint | Método | Permissão | Descrição | Status |
|----------|--------|-----------|-----------|--------|
| `/api/internal/admin/users` | GET | `admin.usuarios.ler` | Lista usuários sanitizados | ✅ Validado |
| `/api/internal/admin/users/{usuario_id}` | GET | `admin.usuarios.ler` | Detalhe de usuário | ✅ Validado |
| `/api/internal/admin/users` | POST | `admin.usuarios.criar` | Criar usuário | ✅ Validado |
| `/api/internal/admin/users/{usuario_id}/block` | POST | `admin.usuarios.bloquear` | Bloquear usuário | ✅ Validado |
| `/api/internal/admin/users/{usuario_id}/unblock` | POST | `admin.usuarios.bloquear` | Desbloquear usuário | ✅ Validado |
| `/api/internal/admin/users/{usuario_id}/reset-password` | POST | `admin.usuarios.redefinir_senha` | Reset administrativo de senha | ✅ Validado |

### Administração de Perfis

| Endpoint | Método | Permissão | Descrição | Status |
|----------|--------|-----------|-----------|--------|
| `/api/internal/admin/profiles` | GET | `admin.perfis.ler` | Lista perfis ativos | ✅ Validado |
| `/api/internal/admin/users/{usuario_id}/profiles` | POST | `admin.usuarios.atribuir_perfis` | Atribuir perfil a usuário | ✅ Validado |

## 3. Permissões Administrativas Implementadas

```
Núcleo de autenticação:
- internal.auth.me

Gestão de usuários:
- admin.usuarios.ler
- admin.usuarios.criar
- admin.usuarios.bloquear
- admin.usuarios.redefinir_senha
- admin.usuarios.atribuir_perfis

Gestão de perfis e permissões:
- admin.perfis.ler
- admin.perfis.gerenciar
- admin.permissoes.ler
- admin.permissoes.gerenciar
```

Perfil administrativo interno criado em homologação: `administrador-interno-geoportal` com 10 permissões acima. Usuário `admin.homologacao` criado em homologação com este perfil.

## 4. Garantias de Segurança Validadas

### Arquitetura de Privilégio

- ✅ Administrador funcional **não** é superuser de banco
- ✅ Permissões são de **aplicação**, não privilégios PostgreSQL especiais
- ✅ Matriz de privilégios confirmada (menor privilégio):
  - `usuarios`: SELECT=t, INSERT=t, UPDATE=t, DELETE=f
  - `sessoes`: SELECT=t, INSERT=t, UPDATE=t, DELETE=f
  - `usuario_perfis`: SELECT=t, INSERT=t, UPDATE=f, DELETE=f
  - `perfis`, `perfil_permissoes`, `permissoes`: SELECT=t, INSERT=f, UPDATE=f, DELETE=f

### Autenticação

- ✅ Sem login hardcoded (ex: `if login == "admin.homologacao"`)
- ✅ Sem JWT (sessão opaca + cookie seguro)
- ✅ Argon2id com configuração robusto
- ✅ Política centralizada de senha, verificação antes de hash
- ✅ Rate limit de login (fallback de auditoria)

### Sessão e Revogação

- ✅ Sessões revogadas **logicamente** por `revogado_em = now()`
- ✅ **Nunca** DELETE físico (auditoria conservada)
- ✅ Reset de senha **revoga** sessões ativas (usuário re-autentica)
- ✅ Bloqueio **revoga** sessões ativas (acesso negado imediatamente)
- ✅ Logout **revoga** sessão (cookie limpo)

### Operações de Administração

- ✅ Reset de senha **não** desbloqueia usuário bloqueado (operações independentes)
- ✅ Bloqueio **impede** novo login (verificação em autenticação)
- ✅ Desbloqueio **não cria** sessão automaticamente (usuário re-autentica)
- ✅ Criação de usuário **não atribui** perfil (etapa separada)
- ✅ Atribuição de perfil é **idempotente** (sem duplicação)

### Sanitização de Resposta

Todas as respostas internas retornam **apenas** campos públicos do usuário:

```
Campos retornados: id, login, nome, email, ativo, bloqueado, criado_em

Campos NUNCA retornados:
- senha, nova_senha, confirmar_nova_senha
- senha_hash, token_hash
- bloqueado_ate, atualizado_em, ultimo_login_em
- token, cookie, session_secret
- DATABASE_URL, SQL
- role, GRANT
- sessão, auditoria interna
```

### Proteção CSRF

- ✅ GET: sem header mutável exigido
- ✅ POST/PUT/PATCH: header `X-Geoportal-Internal-Request: 1` obrigatório
- ✅ Cookie SameSite=Lax + HttpOnly
- ✅ Validação de Origin/Referer: planejada como camada complementar

## 5. Validações Operacionais Finais

### Reset de Senha (Commit 72e7d80, Pytest 488 passed)

- ✅ Backup pré-operacional: roles e banco de homologação
- ✅ Matriz de privilégios: confirmada sem novo GRANT
- ✅ Cenários validados (11):
  - 401 sem sessão
  - 403 sem header mutável
  - 422 senhas divergentes
  - 422 senha fraca/inválida
  - 404 usuário inexistente
  - 200 reset válido
  - 401 sessão antiga após reset (revogada)
  - 401 login com senha antiga
  - 200 login com senha nova
  - Reset não desbloqueia usuário bloqueado
  - Desbloqueio final estabilizou ambiente

### Bloqueio/Desbloqueio (Commit 88ff004, Pytest 462 passed)

- ✅ Matriz de privilégios expandida para UPDATE em sessões
- ✅ Cenários validados (8):
  - 401 sem sessão
  - 403 sem header mutável
  - 200 bloqueio com revogação de sessões
  - 401 bloqueio impede novo login
  - 200 bloqueio idempotente
  - 200 desbloqueio permite re-autenticação
  - 200 desbloqueio idempotente
  - Resposta sanitizada

### API Pública

- ✅ `/api/health` permaneceu OK
- ✅ `/api/public/iluminacao/health` permaneceu OK
- ✅ `/api/version` permaneceu OK
- ✅ Endpoints públicos não afetados

## 6. Estado de Produção

**Produção não foi alterada por esta fase**, exceto por estruturas SQL de base (migrations 0006-0010) autorizadas previamente.

- ❌ Nenhum usuário administrativo real criado em produção
- ❌ Nenhuma sessão real criada em produção
- ❌ Nenhum token real criado em produção
- ❌ Nenhuma role runtime real criada em produção
- ❌ Feature flag `GEOPORTAL_INTERNAL_ROUTES_ENABLED` permanece desligada em produção
- ✅ Rotas internas retornam 404 em produção (fail-closed)

**Migração para produção futura**:
- Código versionado via Git será deployado normalmente
- Migrations estruturais (0006-0010) já estão em produção
- Bootstrap administrativo operacional será executado manualmente em produção com confirmação humana
- Nenhuma cópia de usuários/senhas/sessões/tokens de homologação para produção
- Nenhum restart de produção sem confirmação humana

## 7. Transição para Próxima Fase: Módulo Iluminação Pública

A base administrativa está madura o suficiente para planejar o **primeiro módulo interno de negócio**: Iluminação Pública.

### Objetivo do Módulo Iluminação

Substituir fluxo baseado em Google Forms por sistema próprio controlado:

- **Cidadão**: registrar solicitação de iluminação/reparo
- **Equipe autorizada**: visualizar, atualizar status, comentar, executar manutenção, acompanhar painel/mapa
- **Relatórios e dashboard**: consolidar dados operacionais

### Permissões Iniciais Sugeridas (Planejamento)

```
Permissões do módulo Iluminação (não criadas ainda):
- iluminacao.solicitacoes.ler
- iluminacao.solicitacoes.criar
- iluminacao.solicitacoes.atualizar_status
- iluminacao.solicitacoes.comentar
- iluminacao.dashboard.ler
- iluminacao.relatorios.ler
```

### Roadmap Recomendado

1. **Etapa 1 - Planejamento Backend** (próxima):
   - Estudar schema/tabelas existentes de `mod_iluminacao`
   - Revisar endpoints públicos atuais de Iluminação
   - Planejar contrato backend do primeiro endpoint interno de negócio
   - Definir permissões mínimas do módulo
   - Definir modelo de status da solicitação
   - Definir auditoria de alteração de status

2. **Etapa 2 - Implementação Backend**:
   - Criar primeiro endpoint interno GET (consulta)
   - Criar primeiro endpoint interno POST (criação/comentário)
   - Implementar permissões via `require_permission`
   - Testar em homologação

3. **Etapa 3 - Frontend/Tela Interna**:
   - Depois de endpoints backend validados em homologação
   - Integração com proxy/autenticação do navegador
   - Tela interna com Vite/React/OpenLayers

4. **Etapa 4 - Produção**:
   - Validação operacional em homologação
   - Deployment de código backend em produção
   - Bootstrap de perfis/permissões em produção
   - Liberação da tela interna para usuários reais

### Marco Atual do Modulo Iluminacao

O modulo interno de Iluminacao ja possui, em homologacao interna, listagem, detalhe, leitura de historico, leitura de observacoes e criacao de observacao interna validadas. O primeiro endpoint mutavel do modulo, `POST /api/internal/iluminacao/solicitacoes/{id}/observacoes`, foi implementado no commit `2b05e4a`, exige `iluminacao.solicitacoes.comentar`, exige `X-Geoportal-Internal-Request: 1` e grava observacao + evento de historico na mesma transacao.

A validacao operacional confirmou, com dado de homologacao/teste, 201 Created no POST, `total=1` em `GET observacoes` e `total=1` em `GET historico`. O endpoint nao altera status, prioridade ou `finalizado_em`. Os GRANTs aplicados foram minimos para INSERT nas tabelas de observacoes/historico e USAGE nas sequences correspondentes, sem UPDATE ou DELETE.

O `PATCH status` foi implementado no backend e validado em homologacao interna conforme contrato documentado, com permissao `iluminacao.solicitacoes.atualizar_status`, header mutavel, payload restrito a `status` e `observacao`, matriz conservadora de transicoes, regra de `finalizado_em`, auditoria obrigatoria em historico e idempotencia para status igual. A validacao operacional confirmou transicoes validas com historico, idempotencia sem novo historico, bloqueio de transicoes invalidas, preenchimento de `finalizado_em` em terminal e bloqueio de saida de terminal. O GRANT foi por coluna, restrito a `status`, `atualizado_em` e `finalizado_em`. Correcao/reversao de status fica para fluxo futuro separado, com justificativa obrigatoria, permissao especifica restrita e auditoria propria. Tela interna, anexos, proxy e producao interna permanecem etapas posteriores.

## 8. Consolidação desta Etapa

Esta consolidação **não**:

- ❌ cria endpoint novo
- ❌ altera código Python
- ❌ cria/altera migration SQL
- ❌ altera schema
- ❌ cria usuário real
- ❌ cria perfil/permissão real
- ❌ cria vínculo usuário-perfil real
- ❌ cria role PostgreSQL
- ❌ cria GRANT
- ❌ altera produção
- ❌ altera NSSM
- ❌ altera .env versionado
- ❌ altera frontend
- ❌ inclui senha real, token real, hash real, DATABASE_URL real ou segredo

É **exclusivamente documental**, consolidando o status da fase administrativa e preparando a transição.

## 9. Referências Técnicas

- Detalhes de autenticação/sessão: [INTERNAL-AUTH-TECHNICAL-DECISIONS.md](INTERNAL-AUTH-TECHNICAL-DECISIONS.md)
- Plano de implementação segura: [INTERNAL-AUTH-SECURITY-IMPLEMENTATION-PLAN.md](INTERNAL-AUTH-SECURITY-IMPLEMENTATION-PLAN.md)
- Autorização e endpoints: [INTERNAL-AUTHORIZATION-PLAN.md](INTERNAL-AUTHORIZATION-PLAN.md)
- Matriz de privilégios: [geoportal-backend/db/security/README.md](../../geoportal-backend/db/security/README.md)
- Status de implementação: [geoportal-backend/README.md](../../geoportal-backend/README.md)

---

**Próximo passo recomendado**: Abrir nova etapa/agente para "Geoportal Interno — Módulo Iluminação" com escopo específico de planejamento backend do primeiro endpoint de negócio.

## Decisão Operacional — Não ativar agora em produção

Resumo: o código no branch `main` não implica ativação automática em produção. A área interna foi validada em **homologação** e deve permanecer com a feature flag `GEOPORTAL_INTERNAL_ROUTES_ENABLED` **desligada em produção** até uma etapa de ativação formal e controlada.

Pontos-chave:
- Estado 1 — Código versionado em `main`.
- Estado 2 — Homologação: feature flag ligada para validação controlada e desenvolvimento do módulo Iluminação.
- Estado 3 — Produção: feature flag desligada (fail-closed); rotas internas retornam `404` até ativação formal.

Regras operacionais (imediatas):
- Não copiar usuários/senhas/sessões/tokens de homologação para produção.
- Não criar usuários reais em produção sem checklist e confirmação humana.
- Não executar migrations em produção sem confirmação humana.
- Não reiniciar serviços de produção ou alterar NSSM sem confirmação humana.

Próxima etapa: abrir etapa separada "Ativação Controlada do Geoportal Interno em Produção" com checklist de backup, validação, bootstrap de perfis, permissões mínimas, plano de rollback e confirmação humana.
## Decisao Arquitetural: Separacao de Runtime Publico e Interno

A validacao do primeiro endpoint interno de negocio confirmou a decisao arquitetural de separar runtime publico e runtime interno. O runtime publico de homologacao continua usando `api_iluminacao_homolog`, voltado a `/api/public/*` e sem acesso a `mod_auth`; o runtime interno planejado usa `geoportal_api_homolog`, com `GEOPORTAL_INTERNAL_ROUTES_ENABLED=true`, acesso a `mod_auth` conforme matriz validada e leitura minima de `mod_iluminacao.solicitacoes` para a rota interna de Iluminacao.

Essa separacao e uma decisao de seguranca e menor privilegio, nao um contorno temporario. A API publica permanece isolada, a role publica nao deve receber `mod_auth`, os arquivos `.env` reais continuam fora do Git e o NSSM interno, proxy/Apache e tela interna ainda nao foram criados. Detalhes: `INTERNAL-PUBLIC-RUNTIME-SEPARATION.md`.

## Validacao Operacional do Runtime Interno de Homologacao

O servico NSSM `GeoportalAPIInternaHomologacao` foi criado e validado em homologacao na porta `8002`, separado do runtime publico `GeoportalAPIHomologacao` na porta `8000`. O servico interno usa role `geoportal_api_homolog`, env real fora do Git, rotas internas habilitadas e `Start = SERVICE_AUTO_START`.

O harness versionado ja reconhece `InternaHomologacao` e validou `/api/health`, `/api/version` com `environment=homologacao` e `/api/internal/auth/me` sem sessao retornando 401. A validacao autenticada manual confirmou login interno, `/api/internal/auth/me` autenticado, permissao `iluminacao.solicitacoes.ler` e retorno de itens reais em `GET /api/internal/iluminacao/solicitacoes?limit=10&offset=0`, sem documentar token.

Adicionalmente, o endpoint de detalhe `GET /api/internal/iluminacao/solicitacoes/{solicitacao_id}` (commit `d198710`) foi implementado e validado: testes locais focados de router/repository/service/public e feature-flag passaram, a suíte completa local registrou 517 testes passing, e a validação em homologação confirmou `GET http://127.0.0.1:8002/api/internal/iluminacao/solicitacoes/18` retornando `200 OK` com campos esperados (dado de homologação/teste). Todos os retornos de erro seguem o contrato sanitizado (404/503 genéricos quando aplicável).

Tambem foi validado o aprimoramento da listagem interna `GET /api/internal/iluminacao/solicitacoes` (commit `4731edc`), com filtros operacionais por protocolo, poste, tipo, prioridade e periodo, alem de `total` para paginacao. A validacao local registrou suite completa com 520 passed; em homologacao interna, a listagem basica retornou `total=2`, filtros por dados de homologacao/teste retornaram os resultados esperados e periodo invalido retornou 422. A rota continuou somente leitura, protegida por `iluminacao.solicitacoes.ler`, sem header mutavel e sem alteracao da API publica.

O diagnostico do schema de historico e observacoes internas confirmou que as tabelas `mod_iluminacao.solicitacoes_historico` e `mod_iluminacao.solicitacoes_observacoes` ja suportam os proximos endpoints basicos sem nova migration. A sequencia recomendada antes de tela e antes de alteracao de status e: leitura de historico, leitura de observacoes, criacao de observacao interna com evento resumido no historico e, somente depois, `PATCH status` com auditoria obrigatoria e transacao atomica.

O endpoint de leitura de historico foi implementado e validado em homologacao interna no commit `b68bc32`: `GET /api/internal/iluminacao/solicitacoes/{id}/historico`, protegido por `iluminacao.solicitacoes.ver_historico`. A permissao real foi criada e vinculada ao perfil administrativo de homologacao, e o unico GRANT aplicado foi `SELECT` minimo em `mod_iluminacao.solicitacoes_historico` para `geoportal_api_homolog`, mantendo `INSERT=false`, `UPDATE=false` e `DELETE=false`.

A validacao autenticada no runtime interno confirmou a permissao em `/api/internal/auth/me` e retornou 200 OK para uma solicitacao de homologacao/teste com `total=0`, resultado esperado porque ainda nao havia eventos historicos gravados. Producao, proxy, frontend, migrations, schema, `.env` versionado e endpoint mutavel permaneceram inalterados. A proxima etapa tecnica recomendada e `GET observacoes internas`, seguida de `POST observacao interna`, e somente depois `PATCH status` com auditoria obrigatoria.

O endpoint de leitura de observacoes internas foi implementado e validado em homologacao interna no commit `da236c4`: `GET /api/internal/iluminacao/solicitacoes/{id}/observacoes`, protegido por `iluminacao.solicitacoes.ver_observacoes`. A permissao real foi criada e vinculada ao perfil administrativo de homologacao; naquela etapa, `iluminacao.solicitacoes.comentar` permaneceu reservada para o futuro `POST observacao`, posteriormente implementado e validado no commit `2b05e4a`. O unico GRANT aplicado foi `SELECT` minimo em `mod_iluminacao.solicitacoes_observacoes` para `geoportal_api_homolog`, mantendo `INSERT=false`, `UPDATE=false` e `DELETE=false`.

A validacao autenticada no runtime interno confirmou a permissao em `/api/internal/auth/me` e retornou 200 OK para uma solicitacao de homologacao/teste com `total=0`, resultado esperado porque ainda nao havia observacoes internas gravadas. Producao, proxy, frontend, migrations, schema, `.env` versionado e endpoint mutavel permaneceram inalterados. A proxima etapa tecnica recomendada e `POST observacao interna`, com INSERT em observacoes e INSERT em historico na mesma transacao, e somente depois `PATCH status` com auditoria obrigatoria.

Registro historico: nessa etapa, producao, Apache/proxy, frontend, migrations, schema e `.env` versionado permaneciam inalterados, e o runtime interno ainda nao estava exposto publicamente. Marco posterior de 2026-06-12: `GeoportalAPIInternaProducao` foi criado e validado em `127.0.0.1:8003`, e o Apache `/api/internal/` passou a apontar para a producao interna, preservando `127.0.0.1:8002` para homologacao interna.
