# Architecture Decision Records (ADRs) do Geoportal Amambai

Este documento registra decisões arquiteturais importantes do projeto. Cada ADR traz Status, Contexto, Decisão, Consequências e Validação atual.

## ADR-001: Backend FastAPI separado do GeoServer

- Status: Confirmado
- Contexto: O GeoServer serve o frontend público e o backend precisa evoluir com uma API propriamente dita.
- Decisão: Implementar o backend em FastAPI separado do GeoServer.
- Consequências: Permite controle de API, segurança e validação de entrada; exige proxy reverso e configuração de CORS.
- Validação atual: Backend FastAPI está documentado e implantado em homologação/producão local com healthchecks validados.

## ADR-002: API pública versionada sob `/api`

- Status: Confirmado
- Contexto: O projeto precisa expor endpoints públicos de forma consistente e controlada.
- Decisão: Servir a API pública sob prefixo `/api`.
- Consequências: Permite roteamento claro e separação de endpoints públicos e internos.
- Validação atual: `/api/health`, `/api/public/iluminacao/health` e `/api/version` estão validados em ambientes relevantes.

## ADR-003: Autenticação interna com sessão opaca, não JWT inicialmente

- Status: Confirmado
- Contexto: A primeira versão interna deve priorizar revogação e controle central.
- Decisão: Usar sessão opaca com token aleatório forte e `token_hash` no banco, em vez de JWT para a primeira fase.
- Consequências: Revogação direta, menor exposição de token bruto no banco, maior necessidade de consulta ao backend para validação.
- Validação atual: Serviço interno de sessão opaca e repository de sessões estão implementados e documentados; integração com endpoint ainda pendente.

## ADR-004: Hash de senha com Argon2id

- Status: Confirmado
- Contexto: Senhas devem ser armazenadas com hash forte e custo adaptativo.
- Decisão: Usar Argon2id com `argon2-cffi` para hashing de senha.
- Consequências: Boa resistência a ataques offline; requer parâmetros operacionais e validação de compatibilidade.
- Validação atual: Serviço interno de hash/verificação de senha implementado e validado localmente e em servidor.

## ADR-005: Token bruto nunca persistido; banco armazena `token_hash`

- Status: Confirmado
- Contexto: Persistir token bruto aumenta risco em caso de vazamento de banco.
- Decisão: Armazenar apenas `token_hash` no banco e nunca persistir o token bruto.
- Consequências: Necessita cálculo seguro de hash e armazenamento de segredos bem gerenciado.
- Validação atual: Repository interno de sessões implementado com `token_hash`; serviço de sessão não persiste token bruto.

## ADR-006: Auditoria e rate limit antes de endpoint de login

- Status: Confirmado
- Contexto: A lógica de login deve ser observável e protegida contra abuso antes de expor um endpoint.
- Decisão: Implementar repository de auditoria de login e service puro de rate limit antes de criar o endpoint de login.
- Consequências: Melhora a detecção de abuso e ajuda a manter resposta genérica em falhas.
- Validação atual: Repository de auditoria e service de rate limit criados; integração com `auth_service.py` realizada; rate limit agora é avaliado antes de verificar senha. Serviço interno de validação de sessão autenticada criado e documentado; ele recebe token bruto e `session_secret`, calcula `token_hash` e retorna apenas `usuario_id`, `sessao_id` e `expira_em`. Serviço puro de transporte de token criado e documentado; ele extrai token de cookie ou `Authorization: Bearer`, marca cookie+bearer simultâneos como ambíguos e não depende de FastAPI. A dependency FastAPI interna `get_current_authenticated_session(...)` foi criada e validada em testes; ela usa `GEOPORTAL_INTERNAL_SESSION_SECRET` como configuração futura via `get_session_secret(...)`, mas não inclui segredo real nem altera `.env`. Falhas de autenticação retornam 401 genérico `Not authenticated` sem revelar causa. Testes locais e de servidor passaram; homologação e produção local/pública foram reiniciadas e validadas.

## ADR-007: Cookie HttpOnly/Secure/SameSite como preferência provisória

- Status: Provisório
- Contexto: O transporte de sessão ainda não foi decidido definitivamente.
- Decisão: Preferir cookie seguro (`HttpOnly`, `Secure`, `SameSite`) se usar cookie; CSRF obrigatório nesse caso.
- Consequências: Requer configuração adequada de CORS, segurança de cookie e proteção CSRF.
- Validação atual: Preferência documentada; implementação futura dependente de decisão do transporte de token.

## ADR-008: Endpoints internos somente após middleware/dependency de autenticação

- Status: Confirmado
- Contexto: Endpoints internos não devem existir sem proteção adequada.
- Decisão: Não criar endpoints internos sem middleware/dependency de autenticação e autorização.
- Consequências: Obriga validação de security antes da exposição de APIs internas.
- Validação atual: Documentação registra que não há endpoint interno de login exposto; middleware ainda não implementado.
