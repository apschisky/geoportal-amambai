# Revisao de Seguranca da API Publica

Este documento registra uma revisao defensiva da API publica atual do Geoportal, baseada em cenarios de ameaca e boas praticas alinhadas ao OWASP API Security Top 10 e ASVS. Ele nao altera codigo, migrations, endpoints, configuracoes reais, usuarios, senhas, tokens ou dados de producao.

## 1. Objetivo

- Avaliar riscos da API publica atual.
- Proteger dados pessoais do cidadao.
- Impedir abuso de endpoints publicos.
- Garantir que a API publica nao exponha dados internos.
- Preparar uma base segura antes da criacao de endpoints internos.

## 2. Inventario dos Endpoints Publicos

| Endpoint | Entrada do usuario | Retorna dado sensivel | Finalidade | Riscos principais | Controles esperados |
| --- | --- | --- | --- | --- | --- |
| `GET /api/health` | Nao | Nao | Healthcheck geral. | Exposicao de detalhes tecnicos se expandido indevidamente. | Resposta minima, sem stack, host, versoes internas ou segredos. |
| `GET /api/version` | Nao | Nao | Metadados publicos da API. | Expor ambiente ou versao alem do necessario. | Nao retornar segredo, host, caminho, `DATABASE_URL` ou configuracao sensivel. |
| `GET /api/public/iluminacao/health` | Nao | Nao | Healthcheck publico do modulo de Iluminacao. | Exposicao de detalhes internos do modulo. | Resposta minima e estavel. |
| `POST /api/public/iluminacao/solicitacoes` | Sim | Retorna protocolo e status inicial. | Registrar solicitacao publica de Iluminacao. | Spam, payload grande, dados pessoais em logs, HTML/script em campos, SQL-like input, abuso de fluxo de negocio. | Schema estrito, limites de campo, rate limit, CORS restrito, persistencia controlada, logs sem payload completo. |
| `POST /api/public/iluminacao/consulta` | Sim | Retorna status publico filtrado. | Permitir consulta publica por protocolo e confirmacao de contato. | Enumeracao de protocolos, IDOR/BOLA, retorno excessivo de dados pessoais, erro diferenciando protocolo inexistente de contato incorreto. | Confirmacao por contato, erro generico, resposta minimizada, rate limit e testes de enumeracao. |

## 3. Modelo de Ameaca Defensivo

Cenarios a considerar:

- Abuso de `POST /api/public/iluminacao/solicitacoes` com alto volume.
- Envio de payloads grandes.
- Campos com HTML ou script.
- Campos com entrada parecida com SQL.
- Tentativa de enumeracao de protocolos em `/api/public/iluminacao/consulta`.
- Tentativa de descobrir contato correto por erro diferente.
- Consulta publica retornando dados pessoais demais.
- CORS permissivo.
- Origem nao autorizada tentando consumir a API.
- Erro 500 revelando stack trace.
- `API_DEBUG` ligado em producao.
- Logs gravando payload completo com dados pessoais.
- Usuario de banco da API publica com permissoes excessivas.
- `PERSIST_SOLICITACOES` ligado ou desligado incorretamente.
- `RATE_LIMIT_ENABLED` desligado em producao.
- Swagger/OpenAPI/docs publicas expondo endpoints em producao, se aplicavel.
- Falta de limite global de tamanho de request.
- Falta de testes de abuso.

## 4. Mapeamento OWASP API Security

- API1 Broken Object Level Authorization: aplicavel principalmente a consulta por protocolo; mitigacao atual esperada e exigir confirmacao de contato e erro generico.
- API3 Broken Object Property Level Authorization: aplicavel a respostas publicas; a consulta deve retornar apenas campos publicos e nunca observacoes internas, contato completo, geometrias ou historico administrativo.
- API4 Unrestricted Resource Consumption: aplicavel a POSTs publicos; depende de rate limit, limites de campo e limite de tamanho de request.
- API6 Unrestricted Access to Sensitive Business Flows: aplicavel ao fluxo de criacao de solicitacoes; mitigacao envolve rate limit, duplicidade controlada e monitoramento.
- API8 Security Misconfiguration: aplicavel a debug, CORS, OpenAPI/docs publicas, headers e configuracao de ambiente.
- API9 Improper Inventory Management: mitigado por inventario documentado dos endpoints publicos e separacao futura de `/api/internal/...`.
- API10 Unsafe Consumption of APIs: nao ha integracao externa sensivel nesta revisao; aplicar se houver integracoes futuras.

## 5. Controles Existentes a Verificar

Legenda de status: `OK`, `ATENCAO`, `PENDENTE`, `NAO APLICAVEL`.

| Controle | Status | Evidencia/observacao |
| --- | --- | --- |
| CORS restrito | OK | `CORSMiddleware` usa `allowed_origins` configuravel, sem wildcard no codigo. Validar valor real em producao fora do Git. |
| Rate limit habilitado | OK | `rate_limit_enabled=true` por padrao e testes cobrem `429`. Validar variavel real em producao. |
| Validacao de payload por schema/Pydantic | OK | Schemas usam `extra="forbid"`, enums, ranges, `min_length`, `max_length` e validadores. |
| Limite de tamanho ou orientacao para limitar request body | ATENCAO | Ha limites por campo, mas nao foi identificado limite global de body no app; pode ser aplicado no proxy/API. |
| Erro generico em consulta inexistente | OK | Consulta publica usa mesma mensagem para protocolo inexistente ou confirmacao invalida. |
| Confirmacao por contato na consulta publica | OK | Consulta exige os 4 ultimos digitos normalizados do contato. |
| Minimizacao de dados na resposta de consulta | OK | Resposta publica nao inclui contato, nome, descricao, coordenadas, observacoes internas ou historico. |
| Persistencia controlada por variavel | OK | `PERSIST_SOLICITACOES` controla gravacao real. Validar valor operacional esperado por ambiente. |
| Logs sem payload sensivel | ATENCAO | Nao foi identificado log explicito de payload no codigo revisado; revisar servidor, proxy e plataforma. |
| `API_DEBUG=false` em producao | ATENCAO | Existe configuracao `api_debug`; validar valor real em producao fora do Git e uso efetivo na inicializacao. |
| `/api/version` sem dados sensiveis | OK | Retorna apenas servico, versao e ambiente. |
| Usuario de banco com privilegio minimo | OK | Documentacao registra usuario restrito, sem `UPDATE`/`DELETE` para API publica. Revalidar periodicamente no banco. |
| Endpoints internos inexistentes ou nao expostos | OK | Router atual inclui apenas health, version e Iluminacao publica. |
| OpenAPI/docs publicas em producao | ATENCAO | Testes acessam `/openapi.json`; decidir politica para docs em producao antes dos endpoints internos. |
| Testes automatizados de abuso ampliados | PENDENTE | Ha testes de rate limit, payload invalido e consulta segura; faltam cenarios ampliados de payload muito grande, origem CORS negada e logs. |
| Consumo de APIs externas | NAO APLICAVEL | Nao foi identificada integracao externa sensivel na API publica revisada. Reavaliar se novas integracoes forem adicionadas. |

## 6. Resultados da validação prática em produção

As validações práticas realizadas na API pública de Iluminação Pública em produção confirmaram os seguintes resultados:

- **CORS autorizado**: OK
  - `OPTIONS /api/public/iluminacao/solicitacoes` com origem `https://geoportal.amambai.ms.gov.br` retornou `200`.
  - `Access-Control-Allow-Origin` retornou `https://geoportal.amambai.ms.gov.br`.
  - Métodos permitidos: `GET`, `POST`, `HEAD`, `OPTIONS`.
  - Headers permitidos: `Origin`, `Content-Type`, `Accept`, `Authorization`, `X-Requested-With`.
- **CORS não autorizado**: OK
  - Origem `https://site-invalido.example` retornou `400`.
  - Mensagem: `Disallowed CORS origin`.
- **Solicitação pública válida**: OK
  - `POST /api/public/iluminacao/solicitacoes` retornou protocolo e status `aberta`.
  - O teste criou registro de validação identificado por `poste_id` de teste.
  - Observação: o registro de teste deve ser removido após a validação.
- **Consulta pública com confirmação correta**: OK
  - `POST /api/public/iluminacao/consulta` com protocolo existente e últimos dígitos corretos retornou apenas dados públicos:
    - `protocolo`;
    - `status`;
    - `status_publico`;
    - `data_abertura`;
    - `ultima_atualizacao`;
    - `mensagem`.
  - Não retornou telefone completo, nome, descrição, observações internas ou histórico administrativo.
- **Consulta pública com protocolo inexistente**: OK
  - Retornou `404` com mensagem genérica.
- **Consulta pública com protocolo existente e confirmação errada**: OK
  - Retornou `404` com a mesma mensagem genérica do protocolo inexistente.
  - Conclusão: reduz o risco de enumeração de protocolo.
- **Payload com campo extra**: OK
  - Retornou `422`.
  - Campo extra foi rejeitado.
- **Coordenada inválida**: OK
  - Retornou `422`.
  - Latitude/longitude fora da faixa foram rejeitadas.
- **Texto grande**: OK
  - Descrição com `10000` caracteres retornou `422`.
  - Limite de `1000` caracteres foi aplicado.
  - Sanitização de erros validada: a resposta `422` não ecoa campos sensíveis.
    - Campo `input` não retornado.
    - Campo `url` não retornado.
    - Payload bruto inválido não é ecoado na resposta.
  - Cada erro preserva apenas: `type`, `loc`, `msg` e `ctx` (quando existir).
  - Correção implementada e validada em testes automatizados (76 passed), homologação, produção local e URL pública (https://geoserver.amambai.ms.gov.br).
  - Payload com descrição de 10000 caracteres e payload com campo extra ambos retornam `422` sem expor dados pessoais.
- **Rate limit**: OK
  - Testes repetidos em `/solicitacoes` retornaram `429`.
  - Testes repetidos em `/consulta` retornaram `429`.
- **Documentação pública**: OK
  - `/docs` retornou `404`.
  - `/redoc` retornou `404`.
  - `/openapi.json` retornou `404`.
- **Headers de segurança**: ATENÇÃO
  - `/api/health` retornou apenas headers básicos: `Vary`, `Content-Length`, `Content-Type`, `Date`, `Server: uvicorn`.
  - Estado: PARCIALMENTE CORRIGIDO E VALIDADO
  - A primeira etapa de hardening foi aplicada no proxy/Apache do host `geoserver.amambai.ms.gov.br` dentro do `VirtualHost *:443` e validada:
    - `Header always set X-Content-Type-Options "nosniff"`
    - `Header always set Referrer-Policy "strict-origin-when-cross-origin"`
    - `Header always set Permissions-Policy "geolocation=(), microphone=(), camera=()"`
  - Validação realizada:
    - Backup manual do arquivo Apache (`httpd-ssl.conf`) antes da alteração.
    - `httpd.exe -t` retornou `Syntax OK`.
    - Serviço `Apache2.4` reiniciado e em `Running`.
    - `GET https://geoserver.amambai.ms.gov.br/api/health` retornou `200` com os novos headers presentes.
    - GeoServer, API, Geoportal e camadas permaneceram funcionais; CORS autorizado e bloqueios indevidos mantiveram comportamento esperado.
  - Observação técnica: no endpoint `/geoserver` foi observado `X-Content-Type-Options: nosniff,nosniff`, indicando possível duplicidade entre GeoServer/Tomcat e Apache — registrar para ajuste fino futuro.
  - Itens de hardening pendentes (aplicados com cautela posteriormente): `Content-Security-Policy`, `Strict-Transport-Security` (HSTS) e `X-Frame-Options`.
- **Server header**: ATENÇÃO BAIXA
  - O header `Server` expôs `uvicorn`.
  - Recomendação: avaliar ocultação ou substituição no proxy.
- **Privilégio mínimo no banco**: OK
  - Usuário `api_iluminacao_prod` tem `USAGE` no schema `mod_iluminacao`.
  - Tem `SELECT` e `INSERT` em `mod_iluminacao.solicitacoes`.
  - Não tem `UPDATE`.
  - Não tem `DELETE`.
  - Não tem `USAGE` em `mod_auth`.
  - Não tem `SELECT` em `mod_auth.usuarios`.
- **Mensagem de sucesso**: CORRIGIDO E VALIDADO
  - A criação persistida em produção agora retorna `Solicitação registrada com sucesso.`.
  - Homologação/simulação sem persistência continua a retornar mensagem de ambiente de teste, comportamento esperado para validação controlada.
  - Validação concluída em testes automatizados (77 passed), homologação com `environment=homologacao`, produção local em `127.0.0.1:8001` com `environment=producao`, e URL pública `https://geoserver.amambai.ms.gov.br`.
  - Registros de teste criados para validação foram removidos do banco.

## 7. Recomendacoes Praticas

Prioridade Alta:

- Garantir rate limit ativo em producao.
- Garantir CORS restrito ao dominio autorizado.
- Garantir erros genericos para consulta publica.
- Garantir que consulta publica nao exponha contato completo ou dados internos.
- Garantir que logs nao gravem payload completo.
- Garantir usuario de banco com `INSERT`/`SELECT` minimo e sem `UPDATE`/`DELETE` para API publica.
- Garantir `API_DEBUG=false` em producao.
- Garantir que docs internas nao estejam abertas se existirem ou quando endpoints internos forem criados.

Prioridade Media:

- Adicionar testes automatizados de abuso.
- Adicionar limite explicito de tamanho de payload no proxy/API.
- Padronizar sanitizacao e normalizacao de campos textuais.
- Revisar headers de seguranca no Apache/API.
- Documentar rotacao de logs.

Prioridade Baixa:

- Criar checklist periodico de revisao da API publica.
- Criar playbook de resposta a incidente.
- Criar metricas de abuso e alertas.

## 8. Testes Defensivos Recomendados

- `OPTIONS` CORS com origem autorizada.
- `OPTIONS` CORS com origem nao autorizada.
- `POST /api/public/iluminacao/solicitacoes` valido.
- `POST /api/public/iluminacao/solicitacoes` com payload invalido.
- `POST /api/public/iluminacao/solicitacoes` com campos vazios.
- `POST /api/public/iluminacao/solicitacoes` com texto muito grande.
- `POST /api/public/iluminacao/solicitacoes` repetido ate rate limit.
- `POST /api/public/iluminacao/consulta` com protocolo inexistente.
- `POST /api/public/iluminacao/consulta` com contato incorreto.
- `POST /api/public/iluminacao/consulta` com protocolo existente e contato correto.
- Confirmar que resposta publica nao traz dados internos.
- Confirmar que `404`, `400` e `422` nao trazem stack trace.
- Confirmar que a API publica continua saudavel apos erro.

## 9. Criterios de Aceite Antes de Endpoints Internos

- Inventario publico documentado.
- CORS validado.
- Rate limit validado.
- Consulta publica validada contra enumeracao.
- Logs revisados.
- Privilegios do banco revisados.
- `API_DEBUG=false` validado em producao.
- Testes de abuso definidos.
- Nenhuma regressao na API publica.

## 10. Fora do Escopo

- Pentest ofensivo.
- Exploracao real de terceiros.
- Ataques fora do ambiente proprio.
- Alteracao de codigo nesta etapa.
- Criacao de endpoints internos.
- Alteracao da API publica.
