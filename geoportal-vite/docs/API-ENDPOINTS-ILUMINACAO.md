# Endpoints da API do Modulo de Iluminacao Publica

Este documento detalha os endpoints conceituais da futura API/FastAPI para o modulo de Iluminacao Publica / Manutencao de Postes. Ele nao implementa codigo, nao cria SQL e nao define rotas finais obrigatorias.

## 1. Objetivo

Planejar os endpoints publicos e internos do modulo piloto de Iluminacao Publica, incluindo payloads conceituais, validacoes, permissoes, auditoria, erros e integracao com Geoportal publico e painel interno.

## 2. Principios

- Separar endpoints publicos e internos.
- Validar entrada no servidor.
- Aplicar rate limit nos endpoints publicos.
- Exigir autenticacao nos endpoints internos.
- Aplicar autorizacao por acao.
- Registrar auditoria nas operacoes internas.
- Nao expor dados pessoais desnecessarios.
- Nao expor detalhes tecnicos em erros.
- Evitar acesso direto do front-end publico a tabelas operacionais.

## 3. Convencao de rotas

Prefixos conceituais:

- `/api/public/iluminacao`
- `/api/internal/iluminacao`

Os nomes finais podem mudar na implementacao, desde que a separacao entre publico e interno seja preservada.

Contrato operacional atual relacionado a autenticacao interna: `GET /api/internal/auth/me` retorna `authenticated`, `usuario_id`, `login`, `nome`, `perfis` e `permissoes`. O endpoint continua protegido por sessao/cookie HttpOnly, nao retorna token, cookie, senha, hash, `session_secret` ou `DATABASE_URL`, e a shell interna preserva fallback visual antigo se uma resposta legada/parcial nao trouxer `login`, `nome` ou `perfis`.

## 4. Endpoints publicos

### `POST /api/public/iluminacao/solicitacoes`

Finalidade: criar solicitacao publica de reparo de poste.

Status da POC local: endpoint disponivel em `geoportal-backend/`, com validacao Pydantic, status tecnico padronizado como `aberta` e persistencia controlada por configuracao.

A persistencia real e feita via repository com SQLAlchemy Core quando `PERSIST_SOLICITACOES=true`; a ativacao deve permanecer controlada por ambiente.

O teste de persistencia e feito por script manual antes da ativacao no endpoint publico.

O endpoint pode operar em modo simulado ou persistente conforme `PERSIST_SOLICITACOES`. Em modo simulado, usa protocolo fixo de POC/testes; em modo persistente, gera protocolo pela sequence do banco. A ativacao real depende de homologacao validada.

O endpoint foi validado em modo persistente em homologacao, com protocolo real por sequence e gravacao em `mod_iluminacao.solicitacoes`; a ativacao deve continuar controlada por ambiente.

Solicitacoes repetidas podem ser marcadas internamente como `duplicidade_suspeita`, mas a resposta publica permanece simples e a solicitacao nao e bloqueada nesta etapa.

A marcacao interna de `duplicidade_suspeita` foi validada em homologacao; mesmo quando marcada, a resposta publica continua simples.

Regra de duplicidade ativa por poste implementada: para `localizacao_tipo = poste_mapa`, se existir solicitacao ativa para o mesmo `poste_id`, a API nao cria nova solicitacao e retorna `409 Conflict`. Esta regra substitui a abordagem inicial de apenas marcar `duplicidade_suspeita` nos casos de mesmo poste ativo.

Status considerados ativos para o bloqueio: `aberta`, `em_triagem`, `encaminhada`, `em_execucao` e `aguardando_material`. Status que permitem nova solicitacao: `concluida`, `cancelada`, `nao_atendida` e `encerrada`, se existir futuramente.

O escopo inicial do bloqueio e somente `poste_mapa` com `poste_id`. Solicitacoes `ponto_manual` continuam permitidas nesta etapa; bloqueio espacial por proximidade para pontos manuais deve ser etapa futura.

Resposta para duplicidade ativa por poste: `409 Conflict`, com mensagem publica segura: "Ja existe uma solicitacao aberta para este poste. A equipe responsavel ja foi notificada." A resposta nao retorna protocolo de outra pessoa, dados pessoais, contato, descricao ou detalhes administrativos.

Validacao manual registrada: a primeira solicitacao para um poste ativo retornou `201 Created`; nova solicitacao para o mesmo poste ativo retornou `409 Conflict`; o front-end exibiu mensagem amigavel e a resposta nao expos protocolo de terceiro, nome, contato, descricao ou detalhes administrativos.

Payload conceitual:

- `localizacao_tipo`, com valores `poste_mapa` ou `ponto_manual`;
- `poste_id`, obrigatorio apenas em `poste_mapa`;
- `coordenada`;
- `tipo_problema`;
- `descricao`;
- `ponto_referencia`;
- `observacoes_localizacao`, quando o cidadao marcar manualmente o local;
- `poste_proximo_informado`, quando o cidadao nao localizar o poste correto;
- `nome_solicitante` obrigatorio na POC/local e na primeira versao planejada;
- `contato_solicitante` obrigatorio na POC/local e na primeira versao planejada;
- sem `foto` publica na primeira versao.

Cenarios de localizacao:

- `poste_mapa`: cidadao seleciona poste existente no mapa; `poste_id` e `coordenada` sao obrigatorios.
- `ponto_manual`: cidadao nao encontra o poste no mapa; `poste_id` pode ser nulo, `coordenada` e obrigatoria e deve haver `observacoes_localizacao`.

Resposta conceitual:

- `protocolo`;
- `status_inicial`, inicialmente Aberta;
- `data_abertura`;
- `mensagem`, com texto sugerido: "Solicitacao realizada. Protocolo no IP-AAAA-NNNNNN."

Validacoes:

- `poste_id` obrigatorio apenas quando `localizacao_tipo` for `poste_mapa`;
- `tipo_problema` obrigatorio;
- `descricao` com limite de tamanho;
- coordenada valida;
- `localizacao_tipo` obrigatorio;
- ponto de referencia opcional, com limite de tamanho;
- nome e contato obrigatorios, com limite de tamanho e validacao;
- `observacoes_localizacao` obrigatoria quando `localizacao_tipo = ponto_manual`;
- protocolo no formato previsto `IP-YYYY-000001`, com prefixo, ano e sequencial;
- protocolo deixara de ser fixo/simulado e sera gerado com sequence do banco;
- em persistencia ativa, a sequence de protocolo gera o protocolo real no formato `IP-YYYY-NNNNNN`;
- rate limit;
- validacao futura de duplicidade por poste e por proximidade espacial;
- resposta controlada para possivel duplicidade;
- protecao contra abuso automatizado;
- protecao contra spam.

Auditoria/log:

- registrar criacao;
- registrar IP/origem quando possivel;
- nao expor dados tecnicos ao cidadao.

### `POST /api/public/iluminacao/consulta`

Finalidade: consultar andamento publico de uma solicitacao.

Status de implementacao: endpoint criado no backend, com testes automatizados e validacao manual em ambiente controlado.

Justificativa para `POST`:

- Permite enviar dado complementar minimo de confirmacao.
- Reduz exposicao do protocolo em URL, historico do navegador, logs de proxy e compartilhamentos acidentais.
- Ajuda a reduzir risco de enumeracao quando combinado com rate limit e resposta generica.

Payload conceitual:

```json
{
  "protocolo": "IP-YYYY-NNNNNN",
  "contato_confirmacao": "ultimos_digitos_ou_codigo_de_confirmacao"
}
```

O dado complementar deve ser minimo. A implementacao inicial usa os ultimos 4 digitos do contato informado. A API nao deve retornar nem comparar publicamente o telefone completo.

Resposta publica conceitual:

```json
{
  "protocolo": "IP-YYYY-NNNNNN",
  "status": "aberta",
  "data_abertura": "YYYY-MM-DD",
  "ultima_atualizacao": "YYYY-MM-DD",
  "mensagem": "Mensagem publica segura."
}
```

Campos publicos permitidos:

- `protocolo`;
- `status`;
- `data_abertura`;
- `ultima_atualizacao`;
- `mensagem`.

Regras:

- nunca retornar nome do solicitante;
- nunca retornar telefone completo, `contato_solicitante` ou dado de confirmacao;
- nunca retornar observacoes internas, detalhes administrativos, id interno, geometria, logs, SQL ou dados tecnicos do banco;
- status internos podem existir, mas devem ser traduzidos para status/mensagens publicas seguras;
- nao diferenciar claramente protocolo inexistente de dado de confirmacao incorreto.

Validacoes:

- normalizacao do protocolo;
- formato `IP-YYYY-NNNNNN`;
- dado complementar minimo;
- protecao contra enumeracao;
- rate limit;
- logs seguros sem dados pessoais;
- avaliacao futura de captcha ou protecao adicional se necessario.

Status publicos iniciais:

- `aberta`;
- `em analise`;
- `encaminhada`;
- `em execucao`;
- `concluida`;
- `nao atendida` ou `cancelada`, se aplicavel.

Testes automatizados antes da ativacao:

- protocolo valido;
- protocolo inexistente;
- confirmacao invalida;
- rate limit;
- resposta sem dados sensiveis.

A consulta foi validada manualmente em ambiente controlado. O front-end foi preparado com link discreto no modal de solicitacao pela API, controlado por `consultaEnabled=false` por padrao.

Validacao manual registrada:

- Protocolo correto com confirmacao correta retornou dados publicos.
- Protocolo correto com confirmacao incorreta retornou `404` generico.
- Protocolo inexistente retornou o mesmo `404` generico.
- Formato invalido de protocolo retornou `422`.
- A resposta publica nao expos dados sensiveis.
- Registro de teste foi limpo apos a validacao.
- Link discreto "Ja possui protocolo? Consultar andamento" fica disponivel somente quando `enabled=true` e `consultaEnabled=true`; nao ha menu global de consultas nesta etapa.
- O modal de consulta formata automaticamente o protocolo para `IP-YYYY-NNNNNN`, reduzindo erro de digitacao antes do envio.

## 5. Endpoints internos

### `GET /api/internal/iluminacao/solicitacoes`

Finalidade: listar solicitacoes para painel interno.

Versao atual implementada:

- Rota interna somente leitura sob `GEOPORTAL_INTERNAL_ROUTES_ENABLED`.
- Exige sessao autenticada e `require_permission("iluminacao.solicitacoes.ler")`.
- Nao exige `X-Geoportal-Internal-Request`, por ser GET.
- Query params:
  - `status` opcional validado contra `StatusSolicitacaoIluminacao`;
  - `protocolo` opcional, busca parcial segura com bind parameter;
  - `poste_id` opcional, busca parcial segura com bind parameter;
  - `tipo_problema` opcional validado contra o enum do modulo;
  - `prioridade` opcional, string limitada e usada com bind parameter;
  - `criado_de` opcional para filtrar `criado_em >= criado_de`;
  - `criado_ate` opcional para filtrar `criado_em <= criado_ate`;
  - `limit` de 1 a 100 com padrao 50;
  - `offset` minimo 0 com padrao 0.
- Retorna `items`, `limit`, `offset` e `total`.
- `total` considera os mesmos filtros da listagem e nao e afetado por `limit` ou `offset`.
- Cada item retorna campos operacionais da solicitacao e coordenadas `latitude`/`longitude` em WGS84/EPSG:4326, calculadas a partir de `geom` com `ST_Transform(geom, 4326)`.
- A consulta filtra sempre `deleted_at IS NULL`, usa colunas explicitas, bind parameters e nao usa `SELECT *`.
- Periodo invalido, com `criado_de > criado_ate`, retorna `422` seguro.

Campos retornados por item:

- `id`, `protocolo`, `origem`, `localizacao_tipo`, `poste_id`, `tipo_problema`, `descricao`, `observacoes_localizacao`, `ponto_referencia`, `poste_proximo_informado`, `nome_solicitante`, `contato_solicitante`, `status`, `prioridade`, `duplicidade_suspeita`, `latitude`, `longitude`, `criado_em`, `atualizado_em`, `finalizado_em`.

Fases futuras podem adicionar filtros por regiao, resumo por status e agregacoes operacionais. Esses campos nao fazem parte desta versao para manter menor escopo e menor risco.

Filtro implementado para a visao de manutencao: `ativos=true`. O objetivo e fazer o backend retornar apenas chamados nao terminais para a equipe de campo, antes da paginacao, evitando depender apenas de filtro visual no frontend quando houver muitos chamados ou paginas com finalizados. Comportamento: `ativos=true` exclui `resolvida`, `cancelada`, `indeferida` e `nao_localizado`; ausencia do filtro ou `ativos=false` mantem a listagem completa para perfis autorizados. O backend continua aplicando sessao, permissao `iluminacao.solicitacoes.ler`, bind parameters, total/paginacao coerentes, respostas 401/403/422/503 sanitizadas e nenhum vazamento de SQL, role, GRANT, senha, token, cookie, hash, `session_secret` ou `DATABASE_URL`. A shell de manutencao passa a consumir `ativos=true`; a visao administrativa permanece sem o filtro e o frontend mantem filtro visual terminal apenas como defesa complementar.

Erros: 401 sem sessao, 403 sem permissao, 422 para query invalida e 503 generico se o banco estiver indisponivel, sem expor SQL, traceback, host, role, segredo ou `DATABASE_URL`.

### `GET /api/internal/iluminacao/relatorios/solicitacoes.csv`

Finalidade: exportar relatorio administrativo sanitizado de solicitacoes/servicos de Iluminacao Publica. O endpoint nao depende da tabela visivel no frontend e consulta o backend diretamente com filtros de periodo antes de montar o CSV.

Contrato atual:

- Disponivel somente para perfil administrativo/autorizado. Na versao 1, a protecao backend usa permissao administrativa existente; manutencao nao acessa a exportacao.
- Query temporal opcional: `data_inicio=YYYY-MM-DD` e `data_fim=YYYY-MM-DD`.
- Filtros opcionais: `status`, `prioridade` e `tipo`.
- Regras: sem datas, o endpoint gera relatorio geral; apenas `data_inicio` gera relatorio desde a data informada; apenas `data_fim` gera relatorio ate a data informada; com ambas, usa o intervalo informado. `data_inicio`/`data_fim` invalidos retornam `422`; periodo invertido retorna `422`; periodo acima do limite validado pelo service retorna `422`; autenticacao e autorizacao continuam no backend.
- Formato: `text/csv; charset=utf-8`, com cabecalho e nome de arquivo seguro como `relatorio_iluminacao_geral.csv`, `relatorio_iluminacao_desde_2026-06-01.csv`, `relatorio_iluminacao_ate_2026-06-30.csv` ou `relatorio_iluminacao_2026-06-01_2026-06-30.csv`.
- Compatibilidade: CSV v1 compativel com Excel, gerado com biblioteca padrao do Python e BOM UTF-8 para preservar acentuacao em Windows.
- Colunas sanitizadas atuais: `protocolo`, `status`, `prioridade`, `tipo_problema`, `poste_id`, `origem`, `localizacao_tipo`, `criado_em`, `atualizado_em`, `finalizado_em`, `duplicidade_suspeita`, `tempo_finalizacao_segundos`.
- Excluir por padrao: `nome_solicitante`, `contato_solicitante`, telefone/WhatsApp, observacoes internas livres, descricao livre do cidadao, coordenadas, SQL, role, GRANT, senha, token, cookie, hash, `session_secret` e `DATABASE_URL`.
- Erros sanitizados: `401`, `403`, `404`, `422` e `503`. Na shell administrativa, `404` deve ser tratado como indicio de API interna ainda nao atualizada ou restart pendente no servidor.

### `GET /api/internal/iluminacao/relatorios/solicitacoes/resumo`

Finalidade: retornar resumo administrativo JSON do mesmo recorte temporal do CSV, sem exportacao de dados pessoais e sem depender da tabela paginada do frontend.

Contrato atual:

- Mesmo controle administrativo e mesmos filtros do CSV: `data_inicio`, `data_fim`, `status`, `prioridade` e `tipo`, todos opcionais.
- Retorna agregados sanitizados por periodo: `total`, `abertas`, `em_triagem`, `em_andamento`, `resolvidas`, `canceladas`, `indeferidas`, `nao_localizadas`, `por_prioridade` e `por_tipo_problema`.
- `em_andamento` agrega `encaminhada`, `em_execucao` e `aguardando_material`.
- Sem datas, o resumo representa o recorte geral retornado pelo backend; com uma ou duas datas, aplica apenas os limites informados.
- Erros sanitizados: `401`, `403`, `404`, `422` e `503`.

Nota de autorizacao: a evolucao futura recomendada continua sendo uma permissao especifica de relatorio/exportacao, separada das permissoes operacionais de manutencao. Na versao 1 foi adotada uma permissao administrativa existente para evitar criar privilegio novo sem ciclo proprio de bootstrap/GRANT.

**Validacao operacional (filtros e paginacao da listagem interna)**

- Commit: `4731edc` Aprimora filtros da listagem interna de iluminacao.
- Testes locais antes do commit: `tests/test_internal_iluminacao_solicitacoes_router.py`: 19 passed; `tests/test_iluminacao_repository.py`: 12 passed; `tests/test_iluminacao_service.py`: 23 passed; `tests/test_iluminacao_public.py`: 37 passed; suite completa: 520 passed. Houve 1 warning de depreciacao relacionado a constante HTTP 422, sem impacto bloqueante.
- Validacao em homologacao interna: codigo aplicado no servidor, testes focados passaram, runtime interno `InternaHomologacao` reiniciado e validado pelo harness com porta `8002`, `/api/health` OK, `/api/version` com `environment=homologacao` e `/api/internal/auth/me` sem sessao retornando 401.
- Login interno foi validado no runtime interno com usuario administrativo de homologacao, sem registrar token, senha ou cookie real.
- Listagem basica `GET /api/internal/iluminacao/solicitacoes?limit=5&offset=0` retornou `limit=5`, `offset=0` e `total=2`.
- Filtro por protocolo com dado de homologacao/teste (`protocolo=IP-2026-000020`) retornou `total=1` e item de teste `id=18`.
- Filtro por poste com dado de homologacao/teste (`poste_id=3638`) retornou `total=1` e item de teste `id=18`.
- Combinacao `status=aberta` e `tipo_problema=lampada_apagada` retornou `total=2`.
- Periodo invalido (`criado_de > criado_ate`) retornou status 422.
- O filtro `poste_id` e opcional: sem ele, a listagem continua retornando solicitacoes com `poste_mapa` e futuras solicitacoes `ponto_manual`; com ele, a listagem restringe corretamente a um poste especifico.
- Producao, proxy/Apache, frontend, migrations, schema, `.env`, NSSM, roles e GRANTs nao foram alterados nesta validacao.
- Leitura de observacoes internas, anexos, filtro `localizacao_tipo` e alteracao de status ficam para etapas posteriores.

### `GET /api/internal/iluminacao/solicitacoes/{id}`

Finalidade: ver detalhe interno da solicitacao.

Primeira versao implementada:

- Rota interna somente leitura sob `GEOPORTAL_INTERNAL_ROUTES_ENABLED`.
- Exige sessao autenticada e `require_permission("iluminacao.solicitacoes.ler")`.
- Nao exige `X-Geoportal-Internal-Request`, por ser GET.
- Path param: `id` inteiro positivo.
- Filtra sempre `deleted_at IS NULL`, usa bind parameter para `id`, colunas explicitas e nao usa `SELECT *`.
- Retorna coordenadas `latitude`/`longitude` em WGS84/EPSG:4326, calculadas a partir de `geom` com `ST_Transform(geom, 4326)`.

Resposta:

- item detalhado principal da solicitacao com `id`, `protocolo`, `origem`, `localizacao_tipo`, `poste_id`, `tipo_problema`, `descricao`, `observacoes_localizacao`, `ponto_referencia`, `poste_proximo_informado`, `nome_solicitante`, `contato_solicitante`, `status`, `prioridade`, `duplicidade_suspeita`, `latitude`, `longitude`, `criado_em`, `atualizado_em` e `finalizado_em`.

Erros: 401 sem sessao, 403 sem permissao, 404 generico quando a solicitacao nao existir, 422 para `id` invalido e 503 generico se o banco estiver indisponivel, sem expor SQL, traceback, host, role, segredo ou `DATABASE_URL`.

Historico e observacoes internas possuem contratos proprios somente leitura descritos a seguir. Anexos ficam para etapa posterior com contrato, permissao e auditoria proprios.

Diagnostico do schema interno confirmou que `mod_iluminacao.solicitacoes_historico` e `mod_iluminacao.solicitacoes_observacoes` ja suportam os proximos endpoints basicos sem nova migration. A ordem recomendada e implementar primeiro leitura de historico, depois leitura de observacoes internas, depois criacao de observacao interna com evento resumido no historico, e somente depois alteracao de status com auditoria obrigatoria.

**Validação operacional (detalhe de solicitação)**

- Commit: `d198710` Adiciona detalhe interno de solicitacao de iluminacao.
- Implementado como rota somente leitura que exige sessão interna e `require_permission("iluminacao.solicitacoes.ler")`, com `id` path param inteiro positivo, bind parameter, filtro `deleted_at IS NULL`, colunas explícitas (sem `SELECT *`) e coordenadas `latitude`/`longitude` em WGS84 via `ST_Transform(geom, 4326)`.
- Testes locais focados: `tests/test_internal_iluminacao_solicitacoes_router.py`: 18 passed; `tests/test_iluminacao_repository.py`: 11 passed; `tests/test_iluminacao_service.py`: 22 passed; `tests/test_iluminacao_public.py`: 37 passed; `tests/test_internal_routes_feature_flag.py`: 10 passed. Suíte completa local: 517 passed.
- Validação em homologação: código aplicado via `git pull`, testes focados acima passaram no servidor, runtime interno reiniciado e validado via `scripts/deploy/backend-restart-validate-service.ps1 -Environment InternaHomologacao -Restart -Validate`, porta 8002 confirmada, `/api/health` e `/api/version` OK, login interno validado, permissão `iluminacao.solicitacoes.ler` confirmada e `GET http://127.0.0.1:8002/api/internal/iluminacao/solicitacoes/18` retornou 200 OK com os campos esperados (dado de homologação/teste). 404 e 503 permanecem retornos sanitizados conforme contrato.

### `GET /api/internal/iluminacao/solicitacoes/{id}/historico`

Finalidade: consultar a linha do tempo operacional de uma solicitacao interna de Iluminacao Publica.

Primeira versao implementada:

- Rota interna somente leitura sob `GEOPORTAL_INTERNAL_ROUTES_ENABLED`.
- Exige sessao autenticada e `require_permission("iluminacao.solicitacoes.ver_historico")`.
- Nao reutiliza `iluminacao.solicitacoes.ler`, pois historico possui permissao propria.
- Nao exige `X-Geoportal-Internal-Request`, por ser GET.
- Path param: `id` inteiro positivo.
- Query params: `limit` de 1 a 100 com padrao 50 e `offset` minimo 0 com padrao 0.
- Antes de retornar eventos, valida que a solicitacao existe em `mod_iluminacao.solicitacoes` e nao esta soft-deletada (`deleted_at IS NULL`).
- Se a solicitacao nao existir ou estiver soft-deletada, retorna 404 generico.
- Se a solicitacao existir sem historico, retorna 200 com `items=[]` e `total=0`.
- A consulta usa `mod_iluminacao.solicitacoes_historico`, colunas explicitas, bind parameters, `ORDER BY criado_em ASC, id ASC`, `COUNT(*)` para `total` e nao usa `SELECT *`.
- `total` considera o mesmo `solicitacao_id` e nao e afetado por `limit` ou `offset`.

Resposta:

- Envelope com `items`, `limit`, `offset` e `total`.
- Cada item contem `id`, `solicitacao_id`, `acao`, `status_anterior`, `status_novo`, `prioridade_anterior`, `prioridade_nova`, `usuario_id`, `usuario_nome`, `origem_acao`, `observacao_resumida` e `criado_em`.

Erros: 401 sem sessao, 403 sem permissao, 404 generico quando a solicitacao nao existir, 422 para parametros invalidos e 503 generico se o banco estiver indisponivel, sem expor SQL, traceback, host, role, segredo ou `DATABASE_URL`.

**Validacao operacional (historico interno de solicitacao)**

- Commit: `b68bc32` Adiciona historico interno de solicitacoes de iluminacao.
- Testes locais antes do commit: `tests/test_internal_iluminacao_solicitacoes_router.py`: 28 passed; `tests/test_iluminacao_repository.py`: 18 passed; `tests/test_iluminacao_service.py`: 29 passed; `tests/test_iluminacao_public.py`: 37 passed; `tests/test_internal_routes_feature_flag.py`: 10 passed; suite completa: 541 passed. Houve 1 warning conhecido e nao bloqueante de depreciacao da constante HTTP 422.
- Em homologacao, a permissao real `iluminacao.solicitacoes.ver_historico` foi criada com modulo `iluminacao`, chave `solicitacoes.ver_historico`, descricao segura e `ativo=true`, e vinculada ao perfil `administrador-interno-geoportal`.
- O unico GRANT aplicado nesta etapa foi `SELECT` minimo em `mod_iluminacao.solicitacoes_historico` para `geoportal_api_homolog`; a verificacao final confirmou `schema_usage=true`, `SELECT=true`, `INSERT=false`, `UPDATE=false` e `DELETE=false`.
- O runtime interno `InternaHomologacao` foi reiniciado e validado pelo harness: porta `8002`, `/api/health` OK, `/api/version` com `environment=homologacao` e `/api/internal/auth/me` sem sessao retornando 401.
- Login interno foi validado no runtime interno com usuario administrativo de homologacao, sem registrar token, senha ou cookie real; `/api/internal/auth/me` confirmou `iluminacao.solicitacoes.ver_historico=True`.
- `GET http://127.0.0.1:8002/api/internal/iluminacao/solicitacoes/18/historico?limit=10&offset=0` retornou 200 OK com `limit=10`, `offset=0` e `total=0` para dado de homologacao/teste.
- `total=0` foi comportamento esperado: a solicitacao de homologacao/teste existia, a sessao tinha permissao e o banco liberou SELECT, mas ainda nao havia eventos gravados em `mod_iluminacao.solicitacoes_historico` para essa solicitacao.
- Em testes focados no servidor, houve uma falha inicial ambiental em `tests/test_internal_iluminacao_solicitacoes_router.py` porque o processo PowerShell herdou `GEOPORTAL_INTERNAL_ROUTES_ENABLED=true`; apos limpar apenas a variavel do processo atual, o arquivo passou com 28 passed.
- Producao, producao interna, Apache/proxy, frontend/tela interna, migrations, schema, `.env` versionado e NSSM nao foram alterados nesta etapa, exceto restart controlado do servico interno de homologacao ja existente.
- Nenhum endpoint mutavel, usuario novo, perfil novo, role nova ou GRANT adicional foi criado; a API publica permaneceu preservada.
- Leitura de observacoes internas e etapa seguinte; criacao de observacao, anexos e alteracao de status com auditoria obrigatoria continuam em etapas posteriores.

### `GET /api/internal/iluminacao/solicitacoes/{id}/observacoes`

Finalidade: consultar observacoes internas registradas para uma solicitacao de Iluminacao Publica.

Primeira versao implementada:

- Rota interna somente leitura sob `GEOPORTAL_INTERNAL_ROUTES_ENABLED`.
- Exige sessao autenticada e `require_permission("iluminacao.solicitacoes.ver_observacoes")`.
- Nao reutiliza `iluminacao.solicitacoes.comentar`, pois leitura e comentario usam permissoes separadas.
- Nao exige `X-Geoportal-Internal-Request`, por ser GET.
- Path param: `id` inteiro positivo.
- Query params: `limit` de 1 a 100 com padrao 50 e `offset` minimo 0 com padrao 0.
- Antes de retornar observacoes, valida que a solicitacao existe em `mod_iluminacao.solicitacoes` e nao esta soft-deletada (`deleted_at IS NULL`).
- Se a solicitacao nao existir ou estiver soft-deletada, retorna 404 generico.
- Se a solicitacao existir sem observacoes internas, retorna 200 com `items=[]` e `total=0`.
- A consulta usa `mod_iluminacao.solicitacoes_observacoes`, colunas explicitas, bind parameters, filtro `deleted_at IS NULL`, filtro `visibilidade = 'interna'`, `ORDER BY criado_em ASC, id ASC`, `COUNT(*)` para `total` e nao usa `SELECT *`.
- `total` considera o mesmo `solicitacao_id`, `deleted_at IS NULL` e `visibilidade = 'interna'`, sem ser afetado por `limit` ou `offset`.
- Observacoes com `visibilidade = 'publica_futura'` nao sao retornadas nesta versao.

Resposta:

- Envelope com `items`, `limit`, `offset` e `total`.
- Cada item contem `id`, `solicitacao_id`, `observacao`, `visibilidade`, `usuario_id`, `usuario_nome`, `criado_em` e `editado_em`.
- A resposta nao retorna `deleted_at`, `deleted_reason`, senha, token, cookie, hash, `session_secret`, SQL, role, GRANT, segredo ou `DATABASE_URL`.

Erros: 401 sem sessao, 403 sem permissao, 404 generico quando a solicitacao nao existir, 422 para parametros invalidos e 503 generico se o banco estiver indisponivel, sem expor SQL, traceback, host, role, segredo ou `DATABASE_URL`.

Esta etapa nao cria endpoint mutavel, migration, schema, usuario, perfil, permissao real no banco, role ou GRANT. A permissao real `iluminacao.solicitacoes.ver_observacoes` e eventuais GRANTs minimos devem ser tratados em etapa operacional propria de homologacao.

**Validacao operacional (observacoes internas de solicitacao)**

- Commit: `da236c4` Adiciona observacoes internas de solicitacoes de iluminacao.
- Testes locais antes do commit: `tests/test_internal_iluminacao_solicitacoes_router.py`: 37 passed; `tests/test_iluminacao_repository.py`: 21 passed; `tests/test_iluminacao_service.py`: 35 passed; `tests/test_iluminacao_public.py`: 37 passed; `tests/test_internal_routes_feature_flag.py`: 10 passed; suite completa: 559 passed. Houve 1 warning conhecido e nao bloqueante de depreciacao da constante HTTP 422.
- Em homologacao, os testes focados passaram no servidor. Antes dos testes, foi removida apenas a variavel do processo atual `GEOPORTAL_INTERNAL_ROUTES_ENABLED` para evitar interferencia ambiental da flag herdada no PowerShell; isso nao alterou `.env`, NSSM ou configuracao permanente.
- A permissao real `iluminacao.solicitacoes.ver_observacoes` foi criada com modulo `iluminacao`, chave `solicitacoes.ver_observacoes`, descricao segura e `ativo=true`, e vinculada ao perfil `administrador-interno-geoportal`.
- Na etapa de leitura, a permissao `iluminacao.solicitacoes.comentar` permaneceu reservada para o endpoint mutavel de criacao de observacao, posteriormente implementado e validado no commit `2b05e4a`.
- O unico GRANT aplicado nesta etapa foi `SELECT` minimo em `mod_iluminacao.solicitacoes_observacoes` para `geoportal_api_homolog`; a verificacao final confirmou `schema_usage=true`, `SELECT=true`, `INSERT=false`, `UPDATE=false` e `DELETE=false`.
- O runtime interno `InternaHomologacao` foi reiniciado e validado pelo harness: porta `8002`, `/api/health` OK, `/api/version` com `environment=homologacao` e `/api/internal/auth/me` sem sessao retornando 401.
- Login interno foi validado no runtime interno com usuario administrativo de homologacao, sem registrar token, senha ou cookie real; `/api/internal/auth/me` confirmou `iluminacao.solicitacoes.ver_observacoes=True`.
- `GET http://127.0.0.1:8002/api/internal/iluminacao/solicitacoes/18/observacoes?limit=10&offset=0` retornou 200 OK com `limit=10`, `offset=0` e `total=0` para dado de homologacao/teste.
- `total=0` foi comportamento esperado: a solicitacao de homologacao/teste existia, a sessao tinha permissao e o banco liberou SELECT, mas ainda nao havia observacoes internas gravadas em `mod_iluminacao.solicitacoes_observacoes` para essa solicitacao.
- Producao, producao interna, Apache/proxy, frontend/tela interna, migrations, schema, `.env` versionado e NSSM nao foram alterados nesta etapa, exceto restart controlado do servico interno de homologacao ja existente.
- Nenhum endpoint mutavel, usuario novo, perfil novo, role nova ou GRANT adicional foi criado; a API publica permaneceu preservada.
- `POST observacao`, anexos e alteracao de status com auditoria obrigatoria continuam em etapas posteriores; a tela ainda nao deve comecar nesta etapa.

### `PATCH /api/internal/iluminacao/solicitacoes/{id}/status`

Finalidade: alterar o status operacional de uma solicitacao interna de Iluminacao Publica, com auditoria obrigatoria em historico.

Estado: implementado no backend nesta etapa, seguindo o contrato planejado. A validacao operacional em homologacao, criacao de permissao real e GRANTs minimos permanecem etapas manuais posteriores.

Caracteristicas:

- Endpoint interno mutavel.
- Exige sessao interna autenticada.
- Exige `require_permission("iluminacao.solicitacoes.atualizar_status")`.
- Exige header `X-Geoportal-Internal-Request: 1`.
- Deve permanecer sob `GEOPORTAL_INTERNAL_ROUTES_ENABLED`.
- Nao altera API publica, frontend, proxy, producao, migrations ou schema.

Payload:

```json
{
  "status": "em_execucao",
  "observacao": "Equipe iniciou atendimento."
}
```

Campos permitidos no payload:

- `status`;
- `observacao`.

Campos proibidos no payload:

- `status_anterior`;
- `usuario_id`;
- `usuario_nome`;
- `finalizado_em`;
- `criado_em`;
- `atualizado_em`;
- `protocolo`;
- `prioridade`;
- campos de sessao;
- campos de auditoria;
- SQL, role, GRANT, token, senha, cookie, segredo ou qualquer campo extra.

Validacao:

- `status` deve ser um dos valores reais aceitos por `mod_iluminacao.solicitacoes.status`: `aberta`, `em_triagem`, `encaminhada`, `em_execucao`, `aguardando_material`, `nao_localizado`, `resolvida`, `indeferida` ou `cancelada`.
- Nao usar `rejeitada` como valor interno; a migration usa `indeferida`. A tela futura pode exibir "Rejeitada" apenas como rotulo visual mapeado para `indeferida`.
- `observacao` e obrigatoria para qualquer alteracao de status.
- `observacao` deve receber trim seguro, ter minimo de 3 caracteres apos trim e maximo de 1000 caracteres, compativel com `solicitacoes_historico.observacao_resumida varchar(1000)`.
- Texto maior deve ser registrado pelo endpoint de observacao interna ja existente, nao pelo `PATCH status`.

Matriz conservadora de transicoes da primeira versao:

- `aberta` pode ir para `em_triagem`, `em_execucao`, `cancelada` ou `indeferida`.
- `em_triagem` pode ir para `encaminhada`, `aguardando_material`, `nao_localizado`, `cancelada` ou `indeferida`.
- `encaminhada` pode ir para `em_execucao`, `aguardando_material`, `nao_localizado` ou `cancelada`.
- `em_execucao` pode ir para `aguardando_material`, `resolvida` ou `nao_localizado`.
- `aguardando_material` pode ir para `encaminhada`, `em_execucao` ou `cancelada`.

Refino operacional aprovado: `em_triagem` continua existindo e continua disponivel quando a triagem separada fizer sentido, mas deixa de ser etapa obrigatoria para toda solicitacao. Em operacao enxuta, a mesma pessoa/equipe pode levar `aberta -> em_execucao` diretamente pelo fluxo normal, mantendo justificativa, permissao atual e historico obrigatorio. `encaminhada` continua disponivel e volta de fase/reabertura continua fora deste ciclo.

Estado operacional atual: a transicao `aberta -> em_execucao` foi implementada, publicada e validada em chamado teste/controlado no ambiente publicado. A validacao confirmou historico `alteracao_status` normal, `finalizado_em` permanecendo nulo por se tratar de status nao terminal, chamado mantendo-se ativo e sem qualquer volta de fase ou reabertura administrativa neste ciclo.

Status terminais na primeira versao:

- `resolvida`;
- `cancelada`;
- `indeferida`;
- `nao_localizado`.

Regras de transicao:

- Status terminal nao deve sair para outro status nesta primeira versao.
- Reabertura ou correcao administrativa deve ficar para fluxo separado futuro, com decisao explicita.
- Se futuramente houver reabertura, avaliar `acao='reabertura'` e/ou `origem_acao='ajuste_administrativo'`, valores ja aceitos pelo historico, mas fora da primeira implementacao.
- Se o novo status for igual ao atual, retornar `200 OK` idempotente sem novo `UPDATE` e sem novo historico.

Regra de `finalizado_em`:

- Ao entrar em `resolvida`, `cancelada`, `indeferida` ou `nao_localizado`, preencher `finalizado_em = now()`.
- Para status nao terminais, manter `finalizado_em = NULL`.
- Nao limpar `finalizado_em` nesta primeira versao, porque saida de status terminal sera proibida.

Auditoria obrigatoria:

- Inserir evento em `mod_iluminacao.solicitacoes_historico` na mesma transacao do `UPDATE`.
- Usar `acao='alteracao_status'`, valor permitido pela migration de historico.
- Usar `origem_acao='usuario_interno'`, valor permitido pela migration de historico.
- Gravar `status_anterior` e `status_novo`.
- Gravar `prioridade_anterior=NULL` e `prioridade_nova=NULL`.
- Gravar `usuario_id` da sessao interna autenticada.
- Gravar `usuario_nome` somente se disponivel de forma segura; caso contrario, pode ficar nulo.
- Gravar `observacao_resumida` com a observacao obrigatoria normalizada.
- Usar default do banco para `criado_em`.

Transacao obrigatoria futura:

1. Buscar solicitacao com `deleted_at IS NULL`.
2. Travar a linha, preferencialmente com `SELECT ... FOR UPDATE`.
3. Validar a transicao com base no status atual.
4. Se o status for igual, retornar 200 idempotente sem `UPDATE` e sem historico.
5. Fazer `UPDATE` somente de `status`, `atualizado_em` e `finalizado_em`.
6. Inserir historico.
7. Se o INSERT no historico falhar, o UPDATE nao deve permanecer.
8. Se o UPDATE falhar, o historico nao deve ser gravado.

Campos que nao devem ser alterados:

- `protocolo`, `origem`, `localizacao_tipo`, `poste_id`, `geom`, `tipo_problema`, `descricao`, `observacoes_localizacao`, `ponto_referencia`, `poste_proximo_informado`, `nome_solicitante`, `contato_solicitante`, `prioridade`, `duplicidade_suspeita`, `deleted_at` e `deleted_reason`.

Resposta recomendada:

- `200 OK`.
- Retornar resumo atualizado, sem historico junto.

```json
{
  "solicitacao": {
    "id": 18,
    "status": "em_execucao",
    "atualizado_em": "...",
    "finalizado_em": null
  }
}
```

Erros recomendados:

- `401` sem sessao.
- `403` sem permissao.
- `403` quando faltar ou for invalido o header `X-Geoportal-Internal-Request`.
- `404` quando a solicitacao nao existir ou estiver soft-deletada.
- `409 Conflict` para transicao invalida, pois o payload e sintaticamente valido, mas conflita com o estado atual.
- `422` para payload invalido.
- `503` para erro de banco sanitizado, sem SQL, traceback, host, role, senha, token, cookie, hash, `session_secret` ou `DATABASE_URL`.

Permissoes e GRANTs futuros:

- Permissao de aplicacao: `iluminacao.solicitacoes.atualizar_status`.
- GRANTs devem ser aplicados somente na etapa operacional de homologacao apos implementacao e testes.
- Minimo previsto para `geoportal_api_homolog`: `SELECT` e `UPDATE` em `mod_iluminacao.solicitacoes`, `INSERT` em `mod_iluminacao.solicitacoes_historico` e `USAGE` na sequence de historico se ainda necessario.
- Nao conceder `DELETE`, `UPDATE` em historico, `INSERT/UPDATE` em observacoes por causa deste endpoint nem `UPDATE` em sequence.

Riscos registrados:

- `GRANT UPDATE` em PostgreSQL tende a ser amplo por tabela, salvo uso de privilegios por coluna ou RLS; compensar com backend parametrizado, testes de campos alterados, runtime interno separado e validacao operacional.
- Nao ha trigger obrigando historico; a atomicidade deve ser garantida pela aplicacao nesta fase incremental.
- Reabertura de status terminal, inconsistencia entre status e `finalizado_em`, regra duplicada no frontend e uso acidental de `rejeitada` em vez de `indeferida` devem ser evitados por contrato e testes.

Testes obrigatorios futuros:

- Router: sucesso em transicao valida, idempotencia de status igual, 401 sem sessao, 403 sem permissao, 403 sem header mutavel, 404 para solicitacao inexistente ou soft-deletada, 409 para transicao invalida, 422 para payload/status/observacao/campos extras invalidos, 503 sanitizado, permissao `iluminacao.solicitacoes.atualizar_status` e ausencia de login hardcoded.
- Service: matriz de transicoes, status terminal, `finalizado_em`, rejeicao de saida de terminal, normalizacao da observacao, erro seguro e preservacao de prioridade/dados publicos.
- Repository: `SELECT ... FOR UPDATE`, bind parameters, sem `SELECT *`, `UPDATE` apenas de `status`, `atualizado_em` e `finalizado_em`, INSERT de historico na mesma transacao, atomicidade quando historico falha, sem DELETE e sem alteracao de dados publicos.
- Regressao: API publica preservada, feature flag interna fail-closed, GETs internos existentes e POST observacao interna continuando verdes.

Estado da implementacao:

- Endpoint criado como `PATCH /api/internal/iluminacao/solicitacoes/{id}/status`.
- Usa `require_permission("iluminacao.solicitacoes.atualizar_status")`.
- Usa `require_internal_mutating_request_header` para exigir `X-Geoportal-Internal-Request: 1`.
- Implementa matriz conservadora de transicoes, status terminal, regra de `finalizado_em`, idempotencia para status igual e auditoria em historico na mesma transacao.
- Nao cria reabertura, anexos, migration, schema, permissao real, role ou GRANT.
- Nao altera API publica, producao, proxy, NSSM, `.env` ou frontend.

Recomendacao:

- Endpoint ja validado em homologacao interna com permissao real e GRANT minimo por coluna.
- Nao criar migration nem trigger agora; transacao no backend com testes e suficiente para esta fase incremental.
- Nao aplicar GRANTs fora da etapa operacional de homologacao posterior.
- Producao, proxy, frontend e tela interna permanecem inalterados.

**Validacao operacional (alteracao interna de status)**

- Commit: `28f00dc` Adiciona alteracao interna de status de iluminacao.
- Testes locais antes do commit: `tests/test_internal_iluminacao_solicitacoes_router.py`: 57 passed; `tests/test_iluminacao_repository.py`: 32 passed; `tests/test_iluminacao_service.py`: 46 passed; `tests/test_iluminacao_public.py`: 37 passed; `tests/test_internal_routes_feature_flag.py`: 10 passed; suite completa: 601 passed. Houve 1 warning conhecido e nao bloqueante de depreciacao da constante HTTP 422.
- Em homologacao, o codigo foi aplicado via `git pull`, os testes focados passaram no servidor e a variavel do processo atual `GEOPORTAL_INTERNAL_ROUTES_ENABLED` foi removida antes dos testes para evitar interferencia ambiental da flag herdada no PowerShell. Isso nao alterou `.env`, NSSM ou configuracao permanente.
- A permissao real `iluminacao.solicitacoes.atualizar_status` foi criada com modulo `iluminacao`, chave `solicitacoes.atualizar_status`, descricao segura e `ativo=true`, e vinculada ao perfil `administrador-interno-geoportal`. A verificacao confirmou a permissao `id=17` nesse perfil.
- Antes do GRANT, `mod_iluminacao.solicitacoes` tinha `SELECT=true`, `INSERT=false`, `UPDATE=false` e `DELETE=false`; `mod_iluminacao.solicitacoes_historico` ja tinha `SELECT=true`, `INSERT=true`, `UPDATE=false` e `DELETE=false`.
- O GRANT aplicado foi minimo e por coluna, mais restrito que UPDATE amplo na tabela: `UPDATE` apenas em `status`, `atualizado_em` e `finalizado_em` para `geoportal_api_homolog`.
- A verificacao final confirmou `UPDATE=true` em `status`, `atualizado_em` e `finalizado_em`, e `UPDATE=false` em `prioridade`, `protocolo`, `geom`, `deleted_at`, `deleted_reason`, `nome_solicitante` e `contato_solicitante`. Esse resultado reduz o risco do `UPDATE` amplo em PostgreSQL, pois a role interna recebeu privilegio somente nas colunas que o backend deve alterar.
- O runtime interno `InternaHomologacao` foi reiniciado e validado pelo harness: porta `8002`, `/api/health` OK, `/api/version` com `environment=homologacao` e `/api/internal/auth/me` sem sessao retornando 401.
- Login interno foi validado no runtime interno com usuario administrativo de homologacao, sem registrar token, senha ou cookie real; `/api/internal/auth/me` confirmou `iluminacao.solicitacoes.atualizar_status=True`.
- A validacao funcional usou a solicitacao `id=18`, protocolo `IP-2026-000020`, como dado de homologacao/teste.
- Estado inicial: `status=aberta`, `prioridade=normal`, `finalizado_em` nulo e `atualizado_em=2026-05-21T10:14:24.404719-04:00`.
- Transicao valida `aberta -> em_triagem`: retornou 200 OK, manteve `finalizado_em` nulo, atualizou `atualizado_em` para `2026-06-03T09:24:19.864153-04:00` e criou historico `alteracao_status` com `status_anterior=aberta`, `status_novo=em_triagem`, `usuario_id=7`, `origem_acao=usuario_interno` e observacao resumida coerente.
- Idempotencia `em_triagem -> em_triagem`: retornou 200 OK, manteve `status`, `atualizado_em` e `finalizado_em`, e o total de historico continuou 2. Isso confirmou que status igual nao faz novo UPDATE e nao cria historico duplicado.
- Transicao invalida `em_triagem -> aberta`: retornou 409 Conflict e o total de historico continuou 2, confirmando bloqueio sem historico indevido.
- Nova transicao valida `em_triagem -> encaminhada`: retornou 200 OK, manteve `finalizado_em` nulo e o historico passou para total 3 com evento `alteracao_status`, `status_anterior=em_triagem`, `status_novo=encaminhada`, `usuario_id=7`, `origem_acao=usuario_interno` e observacao resumida coerente.
- Transicao terminal `encaminhada -> nao_localizado`: retornou 200 OK, preencheu `finalizado_em`, manteve `prioridade=normal` e o detalhe confirmou `status=nao_localizado`, `finalizado_em=2026-06-03T09:37:55.853105-04:00` e `atualizado_em=2026-06-03T09:37:55.853105-04:00`. O historico passou para total 4 com evento `alteracao_status`, `status_anterior=encaminhada`, `status_novo=nao_localizado`, `usuario_id=7`, `origem_acao=usuario_interno` e observacao resumida coerente.
- Saida de terminal `nao_localizado -> em_execucao`: retornou 409 Conflict e o total de historico continuou 4, confirmando que status terminal nao sai pelo PATCH normal e nao cria historico indevido.
- A validacao confirmou o comportamento atomico esperado pela aplicacao: UPDATE de status e INSERT em historico caminham juntos, sem alteracao de prioridade, dados publicos, geometria, dados do solicitante, `deleted_at` ou `deleted_reason`.
- Producao, producao interna, Apache/proxy, frontend/tela interna, migrations, schema, `.env` versionado e NSSM nao foram alterados nesta etapa, exceto restart controlado do servico interno de homologacao ja existente. Nenhum endpoint de reabertura/correcao, endpoint de anexos, usuario novo, perfil novo ou role nova foi criado; a API publica permaneceu preservada.

**Decisao futura: correcao/reversao de status**

- Correcao ou reversao de status por erro operacional nao entra no `PATCH status` normal.
- Esse fluxo deve ser separado, muito controlado, com justificativa obrigatoria e permissao especifica diferente de `iluminacao.solicitacoes.atualizar_status`.
- A permissao deve ser restrita a poucos perfis autorizados, nao a todos os perfis que operam o fluxo normal.
- Deve ter auditoria propria no historico e, conforme contrato futuro, pode usar `origem_acao='ajuste_administrativo'` e/ou `acao='reabertura'` quando aplicavel, sempre respeitando os valores permitidos pela migration.
- Esse fluxo deve ser documentado e implementado em etapa separada. Nao liberar reabertura no PATCH normal e nao permitir que a tela futura replique a regra livremente; a regra deve permanecer no backend.

### `PATCH /api/internal/iluminacao/solicitacoes/{id}/status-correcao` (planejado)

Finalidade: permitir correcao administrativa de status, volta de fase e reabertura de chamado terminal sem enfraquecer o fluxo normal da manutencao.

Este endpoint planejado deve ser separado de `PATCH /api/internal/iluminacao/solicitacoes/{id}/status`. O fluxo normal continua sem volta de fase e sem saida de status terminal.

Permissao planejada:

- Permissao efetiva esperada pela aplicacao: `iluminacao.solicitacoes.corrigir_status`.
- Representacao real em `mod_auth.permissoes`: `modulo = 'iluminacao'` e `chave = 'solicitacoes.corrigir_status'`.
- Nao reutilizar `iluminacao.solicitacoes.atualizar_status`.
- Nao conceder essa permissao ao perfil `manutencao-iluminacao`.
- Restringir a perfil administrativo/autorizado, com menor privilegio.

Payload planejado v1:

```json
{
  "novo_status": "em_execucao",
  "justificativa": "Correcao administrativa: chamado reaberto para continuidade do atendimento."
}
```

Decisao sobre `tipo_correcao`: nao incluir no payload da v1. O backend deve inferir se a operacao e `reabertura`, `volta_fase` ou `correcao_status` a partir do status atual e do `novo_status`. Isso reduz a chance de o cliente declarar um tipo incoerente com a transicao. Se a operacao futura precisar expor esse tipo, recomenda-se retornar o tipo calculado na resposta ou gravar no historico, nao aceitar como autoridade do frontend.

Campos aceitos:

- `novo_status`;
- `justificativa`.

Campos proibidos:

- `status`;
- `status_anterior`;
- `usuario_id`;
- `usuario_nome`;
- `finalizado_em`;
- `protocolo`;
- `prioridade`;
- `geom`, `latitude`, `longitude`;
- dados do solicitante;
- campos de sessao;
- campos de auditoria;
- SQL, role, GRANT, token, senha, cookie, hash, `session_secret`, `DATABASE_URL`;
- qualquer campo extra.

Validacao planejada:

- `novo_status` obrigatorio e dentro dos valores reais de `mod_iluminacao.solicitacoes.status`.
- `justificativa` obrigatoria, com trim seguro, minimo de 10 caracteres apos trim e maximo de 1000 caracteres.
- Payload com campo extra deve retornar `422`.
- Status igual ao atual deve retornar `200 OK` idempotente, sem novo UPDATE e sem novo historico, ou `409` se a equipe optar por exigir justificativa apenas quando houver mudanca real; a decisao recomendada e `200 OK` idempotente para manter consistencia com o fluxo normal.

Regras de negocio propostas:

- Correcao entre status ativos e permitida somente por esse endpoint administrativo. Exemplos: `em_execucao -> encaminhada`, `aguardando_material -> em_execucao`, `encaminhada -> em_triagem`.
- Reabertura de terminal e permitida somente para status ativos controlados: preferencialmente `em_triagem`, `em_execucao` ou `aguardando_material`.
- Evitar reabrir diretamente para `aberta`, salvo decisao administrativa explicita e justificativa forte, para nao parecer reset invisivel do chamado.
- Correcao entre terminais, como `cancelada -> indeferida`, deve ser permitida apenas se houver erro administrativo claro; manter `finalizado_em` preenchido e registrar historico.
- Nao alterar prioridade nesse endpoint.
- Nao criar observacao interna separada automaticamente; a justificativa fica no historico administrativo.
- Nao alterar dados pessoais, protocolo, geometria, `deleted_at` ou `deleted_reason`.

Regra recomendada para `finalizado_em`:

- Ao reabrir de status terminal para status ativo, definir `finalizado_em = NULL`, porque o chamado deixa de estar finalizado.
- O encerramento anterior deve permanecer auditavel no historico.
- Quando o chamado for finalizado novamente pelo fluxo normal, `finalizado_em` recebe novo timestamp.
- Em correcao entre status ativos, manter `finalizado_em = NULL`.
- Em correcao de status ativo para terminal, preencher `finalizado_em = now()`.
- Em correcao entre status terminais, manter `finalizado_em` existente, salvo se a implementacao futura documentar uma regra administrativa explicita para recalculo.
- Se houver necessidade de preservar multiplos ciclos de fechamento de forma analitica, planejar relatorio/historico de ciclos em etapa futura, sem migration nesta fase documental.

Historico/auditoria:

- Inserir evento em `mod_iluminacao.solicitacoes_historico` na mesma transacao do UPDATE.
- Gravar `status_anterior`, `status_novo`, `usuario_id`, `usuario_nome` quando disponivel de forma segura e `observacao_resumida` com a justificativa.
- Diferenciar evento administrativo do evento normal. Recomendacao: usar `origem_acao='ajuste_administrativo'`.
- Para `acao`, preferir `reabertura` quando o status anterior for terminal e o novo status for ativo, se o valor ja for aceito pelo schema. Para outras correcoes, preferir `correcao_status` se o schema permitir; caso contrario, usar valor existente semanticamente aceito somente apos documentar a decisao.
- Antes de implementar, confirmar se os valores de `acao` e `origem_acao` ja sao aceitos em producao/homologacao. Se nao forem, planejar migration separada, com backup, rollback e validacao.

Erros esperados:

- `401` sem sessao.
- `403` sem permissao `iluminacao.solicitacoes.corrigir_status`.
- `403` sem header `X-Geoportal-Internal-Request: 1`.
- `404` para solicitacao inexistente ou soft-deletada.
- `409` para correcao administrativa proibida pelo estado atual.
- `422` para payload invalido, status invalido, justificativa invalida ou campos extras.
- `503` para erro de banco sanitizado.

Resposta planejada:

```json
{
  "solicitacao": {
    "id": 18,
    "status": "em_execucao",
    "atualizado_em": "...",
    "finalizado_em": null
  },
  "correcao": {
    "tipo": "reabertura"
  }
}
```

Subfases recomendadas:

1. Revisao humana deste contrato e confirmacao dos valores permitidos em `solicitacoes_historico`.
2. Inventario local/homologacao do schema de `acao`, `origem_acao`, `status_anterior` e `status_novo`.
3. Implementacao backend local com testes de router, service e repository.
4. Migration apenas se o schema real nao aceitar os valores administrativos necessarios.
5. GRANT minimo por coluna em homologacao: `UPDATE` apenas em `status`, `atualizado_em` e `finalizado_em`; `INSERT` em historico; `USAGE` na sequence se necessario.
6. Validacao operacional em homologacao com chamado teste/controlado.
7. Ajuste frontend administrativo, oculto para manutencao.
8. Validacao de relatorio e listagem ativa apos reabertura.
9. Publicacao controlada em producao interna com backup, rollback e checklist.

Inventario tecnico local para implementacao futura:

- `mod_iluminacao.solicitacoes` ja possui `status varchar(40) NOT NULL`, `finalizado_em timestamptz NULL`, `atualizado_em timestamptz NOT NULL`, `deleted_at timestamptz NULL` e constraint de status com todos os valores atuais (`aberta`, `em_triagem`, `encaminhada`, `em_execucao`, `aguardando_material`, `nao_localizado`, `resolvida`, `indeferida`, `cancelada`).
- A coluna `finalizado_em` e anulavel, portanto a regra terminal -> ativo com `finalizado_em = NULL` nao indica necessidade de migration estrutural na tabela principal.
- `mod_iluminacao.solicitacoes_historico` ja possui `status_anterior`, `status_novo`, `usuario_id`, `usuario_nome`, `origem_acao`, `observacao_resumida` e `criado_em`, cobrindo os campos minimos de auditoria da correcao administrativa.
- A constraint de `origem_acao` ja aceita `ajuste_administrativo`.
- A constraint de `acao` ja aceita `reabertura`, mas nao ha evidencia local de que aceite `correcao_status`. Para evitar migration imediata, a primeira implementacao pode usar `acao='reabertura'` em terminal -> ativo e `acao='alteracao_status'` com `origem_acao='ajuste_administrativo'` nas demais correcoes administrativas, desde que essa decisao seja confirmada pela revisao humana. Se a equipe quiser valor dedicado `correcao_status`, sera necessaria migration de constraint.
- `mod_iluminacao.solicitacoes_observacoes` nao deve ser usada para esse fluxo. A justificativa administrativa deve ficar em `solicitacoes_historico.observacao_resumida`; observacoes livres continuam como registro operacional separado, nao como trilha de auditoria de correcao.
- O repository atual de status usa `SELECT ... FOR UPDATE`, `UPDATE` de `status`, `atualizado_em` e `finalizado_em`, e `INSERT` no historico dentro de `engine.begin()`. O futuro metodo deve ser separado, mas reutilizar esse padrao transacional.
- A alteracao normal de status ja trata status igual como idempotente sem novo historico. A correcao administrativa deve preservar esse comportamento, salvo decisao explicita em contrario.
- O inventario real de homologacao confirmou que `mod_auth.permissoes` nao possui coluna `codigo`; o identificador efetivo da permissao e composto por `lower(btrim(modulo)) || '.' || lower(btrim(chave))`.
- A permissao planejada ainda nao existe em homologacao: a consulta por `modulo = 'iluminacao'` e `chave = 'solicitacoes.corrigir_status'` retornou zero linhas.
- Como a permissao ainda nao esta cadastrada, nenhum perfil a possui em homologacao.
- A permissao planejada `iluminacao.solicitacoes.corrigir_status` deve ser criada/vinculada em etapa operacional separada, preferencialmente por script administrativo idempotente ou seed controlado seguindo o padrao existente, sem conceder ao perfil `manutencao-iluminacao`.

Classificacao de migration neste inventario:

- Migration estrutural em `mod_iluminacao.solicitacoes`: aparentemente nao necessaria pelo codigo/migrations locais.
- Migration estrutural em `mod_iluminacao.solicitacoes_historico`: nao necessaria se a v1 aceitar `reabertura` e `alteracao_status` + `origem_acao='ajuste_administrativo'`; necessaria apenas se for exigido novo valor dedicado `acao='correcao_status'`.
- Migration/seed/script de permissao: necessario em ciclo separado, porque a permissao (`modulo = 'iluminacao'`, `chave = 'solicitacoes.corrigir_status'`) precisa existir e ser vinculada somente a perfil administrativo/autorizado.
- Confirmacao em banco real/homologacao continua obrigatoria antes de implementar, pois o inventario local le migrations/codigo versionado e nao consulta o banco.

GRANTs minimos previstos para homologacao/producao interna:

- `SELECT` em `mod_iluminacao.solicitacoes`;
- `UPDATE` preferencialmente por coluna em `mod_iluminacao.solicitacoes(status, atualizado_em, finalizado_em)`;
- `INSERT` em `mod_iluminacao.solicitacoes_historico`;
- `USAGE` na sequence `mod_iluminacao.solicitacoes_historico_id_seq` para `INSERT` com `DEFAULT`/`nextval`;
- `SELECT` na sequence somente se houver necessidade operacional de leitura direta da sequence;
- `SELECT` em `mod_auth.usuarios`, `mod_auth.usuario_perfis`, `mod_auth.perfis`, `mod_auth.perfil_permissoes` e `mod_auth.permissoes` para autenticacao/autorizacao;
- `SELECT` e, no ciclo de bootstrap controlado, `INSERT` nas tabelas de `mod_auth` necessarias para criar permissao/vinculo, nunca como privilegio permanente amplo da role runtime sem revisao.

Confirmacao real de homologacao para GRANTs:

- `geoportal_api_homolog` ja possui `SELECT/UPDATE` por coluna em `mod_iluminacao.solicitacoes.status`, `mod_iluminacao.solicitacoes.atualizado_em` e `mod_iluminacao.solicitacoes.finalizado_em`.
- `geoportal_api_homolog` ja possui `INSERT` e `SELECT` em `mod_iluminacao.solicitacoes_historico`.
- A sequence `mod_iluminacao.solicitacoes_historico_id_seq` foi validada com `USAGE = true` e `SELECT = false`. Isso nao bloqueia `INSERT` com valor default; `USAGE` e suficiente para o `nextval` implicito.

SQLs somente leitura recomendados para confirmacao em homologacao antes da implementacao:

```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema IN ('mod_iluminacao', 'mod_auth')
ORDER BY table_schema, table_name;
```

```sql
SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema IN ('mod_iluminacao', 'mod_auth')
ORDER BY table_schema, table_name, ordinal_position;
```

```sql
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       con.conname AS constraint_name,
       con.contype AS constraint_type,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('mod_iluminacao', 'mod_auth')
ORDER BY n.nspname, c.relname, con.conname;
```

```sql
SELECT modulo, chave, descricao
FROM mod_auth.permissoes
WHERE lower(modulo) = 'iluminacao'
ORDER BY modulo, chave;
```

PowerShell seguro para o operador rodar leitura em homologacao, sem senha na linha de comando:

```powershell
$PSQL = "C:\Users\Anderson\OneDrive\Documentos\postgres_pref\bin\psql.exe"
$HostDb = "127.0.0.1"
$PortDb = "5434"
$DbName = "amambaiGis_homologacao"
$UserDb = "postgres"

& $PSQL -h $HostDb -p $PortDb -U $UserDb -d $DbName -W -c "SELECT current_database(), current_user, inet_server_addr(), inet_server_port();"
```

### `PATCH /api/internal/iluminacao/solicitacoes/{id}/prioridade` (implementado)

Finalidade: alterar a prioridade operacional de uma solicitacao interna de Iluminacao Publica, sem substituir o status e sem afetar o Geoportal publico.

Objetivo da prioridade:

- apoiar triagem e ordenacao operacional;
- permitir destaque visual futuro na shell interna;
- orientar atendimento em campo e distribuicao de esforco;
- alimentar dashboard futuro;
- classificar urgencia/criticidade sem representar andamento do chamado.

Valores recomendados:

- `baixa`;
- `normal`;
- `alta`;
- `urgente`.

Valor padrao recomendado: `normal`.

Observacao de schema: a verificacao manual do banco real de homologacao confirmou que `mod_iluminacao.solicitacoes.prioridade` ja existe como `varchar(20) NOT NULL`, com default `normal` e constraint permitindo `baixa`, `normal`, `alta` e `urgente`. A tabela `mod_iluminacao.solicitacoes_historico` ja possui `prioridade_anterior` e `prioridade_nova`, e a constraint de `acao` ja permite `alteracao_prioridade`. Portanto, nao foi criada migration para prioridade nesta etapa.

Caracteristicas implementadas:

- Endpoint interno mutavel.
- Exige sessao interna autenticada.
- Exige `require_permission("iluminacao.solicitacoes.atualizar_prioridade")`.
- Exige header `X-Geoportal-Internal-Request: 1`.
- Permanece sob feature flag/rotas internas ja existentes.
- Nao altera API publica, Geoportal publico, proxy, Apache, producao, migrations ou schema.
- Nao altera status, dados pessoais, geometria, protocolo ou `finalizado_em`.
- Nao cria observacao separada.
- Registra historico obrigatorio.

Permissao de aplicacao:

- `iluminacao.solicitacoes.atualizar_prioridade`.

Essa permissao deve ser diferente de `iluminacao.solicitacoes.atualizar_status`, `iluminacao.solicitacoes.comentar` e `iluminacao.solicitacoes.ler`, preservando menor privilegio e separacao de responsabilidades.

Payload aceito:

```json
{
  "prioridade": "alta",
  "observacao": "Justificativa operacional."
}
```

Campos permitidos no payload:

- `prioridade`;
- `observacao`.

Campos proibidos no payload:

- `status`;
- `status_anterior`;
- `usuario_id`;
- `usuario_nome`;
- `protocolo`;
- `geom`;
- `latitude`;
- `longitude`;
- `nome_solicitante`;
- `contato_solicitante`;
- `finalizado_em`;
- `criado_em`;
- `atualizado_em`;
- campos de sessao;
- campos de auditoria;
- SQL, role, GRANT, token, senha, cookie ou qualquer campo extra.

Validacao implementada:

- `prioridade` obrigatoria.
- `prioridade` deve estar entre `baixa`, `normal`, `alta` e `urgente`.
- `observacao` obrigatoria.
- `observacao` deve receber trim seguro.
- `observacao` deve ter minimo de 3 caracteres apos trim.
- `observacao` deve ter maximo de 1000 caracteres, compativel com `observacao_resumida` do historico.
- Payload com campo extra deve retornar `422`.

Regra operacional implementada:

- Alteracao de prioridade e independente da alteracao de status.
- Alteracao de prioridade nao altera status.
- Alteracao de prioridade nao altera `finalizado_em`.
- Alteracao de prioridade nao cria observacao separada em `solicitacoes_observacoes`.
- Alteracao de prioridade registra evento em historico na mesma transacao.
- Justificativa e obrigatoria para qualquer mudanca real.
- Prioridade igual a atual deve retornar `200 OK` idempotente, sem novo `UPDATE` e sem novo historico.
- Para status terminal (`resolvida`, `cancelada`, `indeferida`, `nao_localizado`), a primeira versao bloqueia a alteracao de prioridade pelo fluxo normal. Se houver necessidade operacional de corrigir prioridade em chamado finalizado, isso deve entrar em fluxo administrativo futuro, com permissao especifica, justificativa forte e auditoria propria.

Auditoria obrigatoria:

- Inserir evento em `mod_iluminacao.solicitacoes_historico` na mesma transacao do `UPDATE`.
- Usar `acao='alteracao_prioridade'`, valor ja confirmado no schema de homologacao.
- Usar `origem_acao='usuario_interno'`.
- Gravar `prioridade_anterior` e `prioridade_nova`.
- Gravar `usuario_id` da sessao interna autenticada.
- Gravar `usuario_nome` somente se disponivel de forma segura.
- Gravar `observacao_resumida` com a justificativa normalizada.
- Se o INSERT no historico falhar, o UPDATE da prioridade nao deve permanecer.

Transacao implementada:

1. Buscar solicitacao com `deleted_at IS NULL`.
2. Travar a linha, preferencialmente com `SELECT ... FOR UPDATE`.
3. Validar status atual e regra de terminal.
4. Validar prioridade nova.
5. Se a prioridade for igual, retornar 200 idempotente sem `UPDATE` e sem historico.
6. Fazer `UPDATE` somente de `prioridade` e `atualizado_em`.
7. Inserir historico.
8. Se o INSERT no historico falhar, o UPDATE nao deve permanecer.

Campos que nao devem ser alterados:

- `status`;
- `finalizado_em`;
- `protocolo`;
- `origem`;
- `localizacao_tipo`;
- `poste_id`;
- `geom`;
- `tipo_problema`;
- `descricao`;
- `observacoes_localizacao`;
- `ponto_referencia`;
- `poste_proximo_informado`;
- `nome_solicitante`;
- `contato_solicitante`;
- `duplicidade_suspeita`;
- `deleted_at`;
- `deleted_reason`.

Resposta implementada:

- `200 OK`.
- Retornar resumo atualizado, sem historico junto.

```json
{
  "solicitacao": {
    "id": 18,
    "prioridade": "alta",
    "atualizado_em": "..."
  }
}
```

Erros previstos:

- `401` sem sessao.
- `403` sem permissao.
- `403` quando faltar ou for invalido o header `X-Geoportal-Internal-Request`.
- `404` quando a solicitacao nao existir ou estiver soft-deletada.
- `409 Conflict` para regra invalida por estado atual, especialmente tentativa de alterar prioridade em status terminal se o bloqueio for adotado.
- `422` para prioridade invalida, observacao invalida ou campos extras.
- `503` para erro de banco sanitizado, sem SQL, traceback, host, role, senha, token, cookie, hash, `session_secret` ou `DATABASE_URL`.

Banco e migration:

- Nao houve migration para prioridade nesta etapa porque o schema real de homologacao ja possuia coluna, default, constraints de valores e suporte a `acao='alteracao_prioridade'` no historico.
- A evolucao futura pode avaliar indice por prioridade apenas se filtros/ordenacao por prioridade se tornarem gargalo real.
- Qualquer migration futura deve passar por homologacao primeiro, backup manual validado, aplicacao controlada, validacao de schema, API publica, API interna e rollback possivel. Producao somente depois de validacao.

GRANTs minimos para runtime:

- `SELECT` em `mod_iluminacao.solicitacoes`.
- `UPDATE` preferencialmente somente nas colunas `prioridade` e `atualizado_em`.
- `INSERT` em `mod_iluminacao.solicitacoes_historico`.
- `USAGE` na sequence do historico, se necessario.
- Registrar risco de `UPDATE` amplo em PostgreSQL caso nao seja usado privilegio por coluna.

Testes e regressao:

- Router: 200 em alteracao valida, 200 idempotente quando prioridade for igual a atual, 401 sem sessao, 403 sem permissao, 403 sem header mutavel, 404 para solicitacao inexistente ou soft-deletada, 409 ou 422 para regra invalida conforme contrato, 422 para prioridade invalida, 422 para observacao invalida, 422 para campos extras e 503 sanitizado para erro de banco.
- Service: normalizacao de prioridade, normalizacao de observacao, regra de status terminal, idempotencia, conversao de erro tecnico em erro seguro e preservacao de status, dados pessoais, protocolo, geometria e finalizacao.
- Repository: bind parameters, sem `SELECT *`, `SELECT ... FOR UPDATE` se aplicavel, UPDATE somente de `prioridade` e `atualizado_em` se esse for o contrato, INSERT de historico na mesma transacao, rollback se historico falhar, sem alteracao de status, sem alteracao de `finalizado_em` e sem alteracao de dados publicos/pessoais.
- Regressao: API publica preservada, listagem interna preservada, detalhe preservado, historico preservado, observacoes preservadas, alteracao normal de status preservada e logout/auth preservados.

Frontend implementado e evolucoes futuras:

- A listagem e o detalhe exibem prioridade em formato amigavel.
- O detalhe exibe acao de alterar prioridade somente quando `/api/internal/auth/me` retorna `iluminacao.solicitacoes.atualizar_prioridade`.
- O PATCH de prioridade usa `credentials: "include"`, `Content-Type: application/json`, `Accept: application/json`, header `X-Geoportal-Internal-Request: 1` e payload restrito a `{ prioridade, observacao }`.
- A interface exige justificativa obrigatoria, aplica trim, minimo visual de 3 caracteres, bloqueia envio invalido e protege contra duplo envio.
- Apos sucesso, recarrega detalhe, listagem e historico.
- A regra real continua no backend; a interface apenas orienta e valida o basico.
- Filtro por prioridade, destaque visual avancado e ordenacao operacional ficam como evolucoes futuras.

Marco atual: backend e frontend internos ja consomem `PATCH /api/internal/iluminacao/solicitacoes/{id}/prioridade` com permissao especifica, header mutavel obrigatorio, justificativa, auditoria em historico e bloqueio de status terminal. A implementacao nao cria observacao separada, nao altera status, nao altera `finalizado_em`, nao altera dados pessoais e nao afeta o Geoportal publico.

Riscos registrados:

- Alteracao de prioridade sem historico.
- Permissao ampla demais.
- `UPDATE` amplo na tabela.
- Regra duplicada no frontend.
- Uso indevido de `urgente`.
- Observacao com dados pessoais desnecessarios.
- Inconsistencia se prioridade mudar junto com status.
- Migration mal planejada em producao.
- Quebra do Geoportal publico se proxy/Apache forem alterados sem necessidade.
- Duplicacao documental.

Ordem recomendada:

1. Planejamento/contrato documental da prioridade.
2. Revisao humana do contrato.
3. Implementacao local backend com testes.
4. Se necessario, migration local/homologacao planejada.
5. Validacao local.
6. Aplicacao controlada em homologacao.
7. Criacao de permissao real em homologacao.
8. GRANTs minimos em homologacao.
9. Validacao runtime interno homologacao.
10. Frontend minimo.
11. Validacao operacional em navegador.
12. Documentacao do marco.
13. Commit e push.
14. Producao somente apos backup manual validado, roteiro de rollback e validacao.

### `POST /api/internal/iluminacao/solicitacoes/{id}/observacoes`

Finalidade: adicionar observacao interna em uma solicitacao de Iluminacao Publica.

Uso na shell interna: este endpoint agora e consumido pelo formulario de observacao na shell autenticada `/interno/`, de forma explicitamente acionada pelo usuario e separada da leitura das observacoes. A interface usa a permissao `iluminacao.solicitacoes.ver_observacoes` para leitura, a permissao `iluminacao.solicitacoes.comentar` para criacao e o backend continua sendo a autoridade de autorizacao.

Caracteristicas:

- Endpoint interno mutavel.
- Exige sessao autenticada.
- Exige `require_permission("iluminacao.solicitacoes.comentar")`.
- Exige header `X-Geoportal-Internal-Request: 1`.
- Nao altera status, prioridade, finalizacao, anexos ou dados principais da solicitacao.
- Nao cria endpoint de `PATCH status` nesta etapa.

Payload:

- `observacao`: string obrigatoria, com trim seguro, minimo de 3 caracteres apos trim e maximo de 2000 caracteres.

Campos nao aceitos no payload nesta etapa:

- `visibilidade`;
- `usuario_id`;
- `usuario_nome`;
- `criado_em`;
- `editado_em`;
- `deleted_at`;
- qualquer campo de sessao, auditoria, token, senha, SQL, role, GRANT ou segredo.

Persistencia:

- Insere em `mod_iluminacao.solicitacoes_observacoes`.
- Define `visibilidade='interna'` no backend.
- Preenche `usuario_id` a partir da sessao interna autenticada.
- Preenche `usuario_nome` somente se estiver disponivel de forma segura no fluxo autenticado; caso contrario, pode ficar nulo.
- Insere evento resumido em `mod_iluminacao.solicitacoes_historico` na mesma transacao.
- Usa `acao='observacao_interna'` e `origem_acao='usuario_interno'`, valores permitidos pela migration de historico.
- Trunca `observacao_resumida` para caber em `varchar(1000)`.
- Se o INSERT no historico falhar, a observacao nao deve permanecer gravada.

Resposta 201:

- Retorna a observacao criada com `id`, `solicitacao_id`, `observacao`, `visibilidade`, `usuario_id`, `usuario_nome`, `criado_em` e `editado_em`.
- Nao retorna `deleted_at`, SQL, traceback, host, role, GRANT, senha, token, cookie, hash, `session_secret` ou `DATABASE_URL`.

Estado desta etapa:

- Nao criou migration nem alterou schema.
- Nao altera producao, proxy, NSSM, `.env`, frontend ou API publica.
- Anexos e `PATCH status` permanecem em etapas posteriores.

Na shell interna, apos `201 Created`, o campo e limpo e a lista de observacoes e recarregada por GET. O historico correspondente nao e recarregado automaticamente pela interface, apenas permanece disponivel para nova consulta sob demanda.

**Validacao operacional (criacao de observacao interna)**

- Commit: `2b05e4a` Adiciona criacao de observacoes internas de iluminacao.
- Testes locais antes do commit: `tests/test_internal_iluminacao_solicitacoes_router.py`: 46 passed; `tests/test_iluminacao_repository.py`: 25 passed; `tests/test_iluminacao_service.py`: 39 passed; `tests/test_iluminacao_public.py`: 37 passed; `tests/test_internal_routes_feature_flag.py`: 10 passed; suite completa: 576 passed. Houve 1 warning conhecido e nao bloqueante de depreciacao da constante HTTP 422.
- Em homologacao, os testes focados passaram no servidor. Antes dos testes, foi removida apenas a variavel do processo atual `GEOPORTAL_INTERNAL_ROUTES_ENABLED` para evitar interferencia ambiental da flag herdada no PowerShell; isso nao alterou `.env`, NSSM ou configuracao permanente.
- A permissao real `iluminacao.solicitacoes.comentar` foi criada com modulo `iluminacao`, chave `solicitacoes.comentar`, descricao segura e `ativo=true`, e vinculada ao perfil `administrador-interno-geoportal`.
- Antes dos novos GRANTs, `mod_iluminacao.solicitacoes_historico` e `mod_iluminacao.solicitacoes_observacoes` ja tinham `SELECT=true`, mas `INSERT=false`, `UPDATE=false`, `DELETE=false`; as sequences correspondentes ainda nao tinham `USAGE` para `geoportal_api_homolog`.
- Os GRANTs aplicados foram minimos e restritos ao endpoint mutavel de observacao: `INSERT` em `mod_iluminacao.solicitacoes_observacoes`, `INSERT` em `mod_iluminacao.solicitacoes_historico`, `USAGE` na sequence `mod_iluminacao.solicitacoes_observacoes_id_seq` e `USAGE` na sequence `mod_iluminacao.solicitacoes_historico_id_seq`.
- A matriz final manteve `SELECT=true`, `INSERT=true`, `UPDATE=false` e `DELETE=false` nas tabelas de historico e observacoes; nas duas sequences, `USAGE=true`, `SELECT=false` e `UPDATE=false`.
- O runtime interno `InternaHomologacao` foi reiniciado e validado pelo harness: porta `8002`, `/api/health` OK, `/api/version` com `environment=homologacao` e `/api/internal/auth/me` sem sessao retornando 401.
- Login interno foi validado no runtime interno com usuario administrativo de homologacao, sem registrar token, senha ou cookie real; `/api/internal/auth/me` confirmou `iluminacao.solicitacoes.comentar=True`.
- `POST http://127.0.0.1:8002/api/internal/iluminacao/solicitacoes/18/observacoes`, com header `X-Geoportal-Internal-Request: 1`, retornou 201 Created para dado de homologacao/teste. A resposta retornou observacao `id=2`, `solicitacao_id=18`, `visibilidade=interna`, `usuario_id=7`, `usuario_nome` nulo e `editado_em` nulo.
- `GET /api/internal/iluminacao/solicitacoes/18/observacoes?limit=10&offset=0` retornou 200 OK com `total=1` e confirmou a observacao criada.
- `GET /api/internal/iluminacao/solicitacoes/18/historico?limit=10&offset=0` retornou 200 OK com `total=1` e confirmou evento correspondente com `acao=observacao_interna`, `origem_acao=usuario_interno`, `usuario_id=7` e `observacao_resumida` coerente.
- A validacao confirmou o comportamento atomico esperado pela aplicacao: observacao e historico correspondente foram criados juntos.
- O endpoint nao alterou status, prioridade ou `finalizado_em`, nao criou `PATCH status`, nao criou anexos e nao iniciou tela.
- Producao, producao interna, Apache/proxy, frontend/tela interna, migrations, schema, `.env` versionado e NSSM nao foram alterados nesta etapa, exceto restart controlado do servico interno de homologacao ja existente.

### `POST /api/internal/iluminacao/solicitacoes/{id}/anexos`

Finalidade: anexar foto/documento.

Payload:

- `arquivo`;
- `tipo`;
- `descricao` opcional.

Permissao:

- `anexar`.

Validacoes:

- tipo permitido;
- tamanho maximo;
- hash;
- antivirus/varredura futura;
- armazenamento controlado.

### `PATCH /api/internal/iluminacao/solicitacoes/{id}/finalizar`

Finalidade: finalizar atendimento.

Payload:

- `observacao_final`;
- `status_final`;
- `data_conclusao`;
- anexos opcionais.

Permissao:

- `finalizar`.

Auditoria:

- registrar fechamento completo.

### `PATCH /api/internal/iluminacao/solicitacoes/{id}/cancelar`

Finalidade: cancelar ou indeferir solicitacao.

Payload:

- `motivo`;
- `status_final`.

Permissao:

- `cancelar` ou `indeferir`.

Auditoria:

- obrigatoria.

## 6. Respostas e erros

Padrao conceitual:

- `200`: sucesso.
- `201`: criado.
- `400`: entrada invalida.
- `401`: nao autenticado.
- `403`: sem permissao.
- `404`: nao encontrado.
- `409`: conflito de estado.
- `413`: anexo muito grande.
- `415`: tipo de arquivo nao permitido.
- `429`: muitas requisicoes.
- `503`: servico temporariamente indisponivel, por exemplo falha controlada de banco.
- `500`: erro interno generico.

Para criacao publica de solicitacoes, `429` indica muitas solicitacoes em pouco tempo.

Para criacao publica de solicitacoes, `409` deve indicar que ja existe solicitacao ativa para o mesmo poste no escopo `poste_mapa`. A resposta deve ser generica e segura, sem expor protocolo, dados pessoais, contato, descricao ou detalhes administrativos de outra solicitacao.

O retorno `429` foi validado manualmente para excesso de solicitacoes em ambiente controlado.

Erros tecnicos nao devem ser expostos ao cidadao. Stack trace, SQL, caminho de arquivo e credenciais nunca devem aparecer em resposta HTTP.

O retorno `503` foi validado manualmente para indisponibilidade temporaria de banco, mantendo resposta generica e sem detalhes internos.

## 7. Estados e transicoes

Transicoes conceituais permitidas:

- Aberta -> Em triagem.
- Em triagem -> Encaminhada.
- Em triagem/Encaminhada -> Aguardando material.
- Encaminhada -> Em execucao.
- Em execucao -> Aguardando material.
- Em execucao -> Resolvida.
- Aberta/Em triagem/Encaminhada/Em execucao -> Nao localizado.
- Aberta/Em triagem -> Indeferida.
- Aberta/Em triagem/Encaminhada -> Cancelada.

Regras iniciais: Cancelada representa falso chamado; Indeferida representa caso sem seguranca para executar ou outra justificativa definida. "Aguardando equipe" nao entra no conjunto inicial.

Transicoes devem ser validadas pela API, nao apenas pelo front-end.

## 8. Permissoes por endpoint

| Endpoint | Publico | Atendente | Campo | Gestor | Admin | Auditor |
|---|---|---|---|---|---|---|
| `POST /api/public/iluminacao/solicitacoes` | Sim | Sim | Nao | Sim | Sim | Nao |
| `POST /api/public/iluminacao/consulta` | Sim | Sim | Sim | Sim | Sim | Sim |
| `GET /api/internal/iluminacao/solicitacoes` | Nao | Sim se acumulado com campo | Sim | Sim | Sim | Sim |
| `GET /api/internal/iluminacao/solicitacoes/{id}` | Nao | Sim se acumulado com campo | Sim | Sim | Sim | Sim |
| `GET /api/internal/iluminacao/solicitacoes/{id}/historico` | Nao | Sim se acumulado com campo | Sim | Sim | Sim | Sim |
| `GET /api/internal/iluminacao/solicitacoes/{id}/observacoes` | Nao | Sim se acumulado com campo | Sim | Sim | Sim | Sim |
| `PATCH /api/internal/iluminacao/solicitacoes/{id}/status` | Nao | Sim se acumulado com campo | Sim | Sim | Sim | Nao |
| `POST /api/internal/iluminacao/solicitacoes/{id}/observacoes` | Nao | Sim se acumulado com campo | Sim | Sim | Sim | Nao |
| `POST /api/internal/iluminacao/solicitacoes/{id}/anexos` | Nao | Nao ou acumulado com campo | Sim | Sim | Sim | Nao |
| `PATCH /api/internal/iluminacao/solicitacoes/{id}/finalizar` | Nao | Nao ou acumulado com campo | Sim | Sim | Sim | Nao |
| `PATCH /api/internal/iluminacao/solicitacoes/{id}/cancelar` | Nao | Nao | Nao | Sim | Sim | Nao |

## 9. Auditoria por endpoint

| Endpoint | Auditar? | Evento |
|---|---|---|
| `POST /api/public/iluminacao/solicitacoes` | Sim | Criacao de solicitacao publica |
| `POST /api/public/iluminacao/consulta` | Opcional | Consulta publica de protocolo, com confirmacao minima e cuidado para volume |
| `GET /api/internal/iluminacao/solicitacoes` | Opcional | Consulta/listagem interna |
| `GET /api/internal/iluminacao/solicitacoes/{id}` | Opcional | Visualizacao interna de detalhe |
| `GET /api/internal/iluminacao/solicitacoes/{id}/historico` | Opcional | Consulta interna de historico |
| `GET /api/internal/iluminacao/solicitacoes/{id}/observacoes` | Opcional | Consulta interna de observacoes internas |
| `PATCH /api/internal/iluminacao/solicitacoes/{id}/status` | Sim | Alteracao de status |
| `POST /api/internal/iluminacao/solicitacoes/{id}/observacoes` | Sim | Inclusao de observacao |
| `POST /api/internal/iluminacao/solicitacoes/{id}/anexos` | Sim | Upload de anexo |
| `PATCH /api/internal/iluminacao/solicitacoes/{id}/finalizar` | Sim | Finalizacao de atendimento |
| `PATCH /api/internal/iluminacao/solicitacoes/{id}/cancelar` | Sim | Cancelamento ou indeferimento |

## 10. Dados pessoais

- Nome e contato nao devem ser obrigatorios.
- Contato pode ser util quando o poste nao for localizado ou faltar informacao.
- Endpoint publico de protocolo nao deve retornar dados pessoais.
- Acesso interno a dados pessoais deve ser limitado a gestor e administrador.
- Finalidade da coleta deve ser registrada.
- Dados pessoais nao devem aparecer no mapa publico.
- Retencao inicial sugerida: manter dados pessoais ate a finalizacao do chamado, sujeita a validacao juridica/LGPD.

## 11. Anexos

- Nao prever upload publico na primeira versao.
- Equipe pode anexar foto antes/depois em casos mais graves.
- Tipo inicial aceito: `jpg`.
- Tamanho maximo inicial: 5 MB.
- Armazenar metadados.
- Nao expor caminho fisico.
- Acesso interno protegido para equipe, gestor e administrador.
- Registrar hash e usuario que enviou.

## 12. Integracao com Geoportal publico

- O botao atual do Google Forms deve permanecer ativo e funcional.
- A integracao inicial com a API propria deve ser paralela ao Google Forms, sem substituicao imediata.
- Um segundo botao de teste podera ser criado futuramente para enviar solicitacao pela API.
- O botao de teste da API deve ser controlado por feature flag ou configuracao do front-end, permitindo ativar e desativar facilmente.
- O botao de teste preparado nesta etapa abre um formulario local de teste e ainda nao chama o endpoint nem envia dados para a API.
- A selecao manual do formulario de teste permanece local no front-end e ainda nao envia dados ao endpoint.
- O front-end pode montar uma previa local do JSON esperado pelo endpoint, mas ainda nao realiza `POST` real nesta etapa.
- Na previa local, `contato_solicitante` deve ser montado de forma normalizada a partir do pais selecionado e do numero informado, ainda sem envio real ao endpoint.
- O envio real pelo front-end fica preparado por configuracao e desligado por padrao; quando ativado em ambiente controlado, deve tratar `201`, `422`, `429` e `503` com mensagens publicas seguras.
- O envio real controlado pelo front-end foi validado em homologacao com flags ativadas temporariamente e persistencia ativa; `201 Created`, protocolo/status no modal de sucesso e gravacao em `mod_iluminacao.solicitacoes` foram confirmados sem registrar dados reais.
- O modal de sucesso permite copiar somente o protocolo para facilitar consulta e compartilhamento pelo cidadao, sem copiar dados pessoais.
- O front-end trata `409 Conflict` com modal amigavel quando houver solicitacao ativa no mesmo poste, mantendo o Google Forms como fallback durante validacao.
- Apos a validacao, `enabled=false`, `submitEnabled=false` e `PERSIST_SOLICITACOES=false` devem ser restaurados como padrao seguro, e registros de teste devem ser limpos.
- Camada publica de postes continua sendo base visual.
- Status publico podera vir de endpoint publico ou view controlada.
- Google Forms deve continuar como fallback ate o modulo proprio estar estavel; a troca definitiva deve ser validada pelo Prefeito.
- A substituicao definitiva do Forms so deve ocorrer apos testes em homologacao/producao, estabilidade de rede, logs, monitoramento e plano de rollback validados.
- O front-end publico nao deve acessar endpoints internos.

### Consulta publica de protocolo

- O endpoint `POST /api/public/iluminacao/consulta` foi criado no backend, com protocolo e confirmacao inicial pelos ultimos 4 digitos do contato informado.
- A resposta publica deve limitar dados a protocolo, status, datas publicas e mensagens seguras.
- Dados pessoais, contato, observacoes internas e detalhes administrativos nao devem ser expostos.
- A consulta deve ser protegida contra enumeracao de protocolos.
- Testes automatizados cobrem protocolo valido, protocolo inexistente, confirmacao invalida, rate limit, erro seguro e ausencia de dados sensiveis.
- A validacao manual confirmou retorno publico filtrado, `404` generico para inexistente/confirmacao invalida e `422` para formato invalido.
- A integracao ao front-end foi preparada por feature flag e permanece desligada por padrao com `consultaEnabled=false`.

## 13. Integracao com painel interno

- Painel interno usara endpoints internos.
- Filtros por status, periodo, tipo, prioridade, regiao, `poste_id` e protocolo.
- Mapa operacional usara dados internos protegidos.
- Mapa operacional e essencial desde o inicio, com cores por status e reincidencia por poste.
- Indicadores iniciais: solicitacoes por tipo, solicitacoes por regiao e reincidencia por poste; periodo de analise mais usado: semanal.
- Acoes de status, observacao e anexo devem respeitar permissao.

## 14. Criterios antes de implementar

- [ ] Schema aprovado.
- [ ] Status aprovados.
- [ ] Tipos de problema definidos.
- [ ] Permissoes aprovadas.
- [ ] Politica de anexos definida.
- [ ] Autenticacao definida.
- [ ] Ambiente de homologacao preparado.
- [ ] Logs/auditoria definidos.
- [ ] Rate limit planejado.
- [ ] Regras de erro e mensagens aprovadas.

## 15. Relacao com documentos existentes

Este documento complementa:

- `docs/API-ARCHITECTURE.md`;
- `docs/AUTH-PERMISSIONS-PLAN.md`;
- `docs/POSTGIS-SCHEMA-PLAN.md`;
- `docs/MODULE-ILUMINACAO-PUBLICA.md`;
- `docs/SECURITY-HARDENING-PLAN.md`.
- `docs/ILUMINACAO-CONTROLLED-ACTIVATION-CHECKLIST.md`.

## 16. Proximos passos

- seguir `docs/ILUMINACAO-CONTROLLED-ACTIVATION-CHECKLIST.md` antes de qualquer ativacao publica;
- `docs/SQL-MIGRATION-PLAN.md`;
- historico interno ja implementado e validado em homologacao; manter validacao operacional documentada antes de uso por tela;
- leitura de observacoes internas implementada e validada em homologacao; manter validacao operacional documentada antes de uso por tela;
- criacao de observacao interna implementada e validada em homologacao, com INSERT em observacoes e INSERT em historico na mesma transacao;
- antes de implementar `PATCH status`, planejar transicoes permitidas, regra de `finalizado_em`, obrigatoriedade de observacao/motivo, contrato de auditoria e GRANTs minimos para `UPDATE` em `mod_iluminacao.solicitacoes` e `INSERT` em historico;
- manter anexos e tela interna para etapas posteriores;
- validacao com setor responsavel;
- desenho de telas do painel interno somente depois dos contratos backend validados.
## Decisao de Runtime para Endpoints Internos

Os endpoints internos de Iluminacao devem rodar em runtime interno, nunca no runtime publico. A role publica permanece dedicada a `/api/public/*` e nao deve receber acesso a `mod_auth`.

Estado atual de producao interna validado em 2026-06-12:

- runtime publico de producao: `GeoportalAPIProducao` em `127.0.0.1:8001`;
- runtime interno de homologacao: `GeoportalAPIInternaHomologacao` em `127.0.0.1:8002`;
- runtime interno de producao: `GeoportalAPIInternaProducao` em `127.0.0.1:8003`;
- Apache HTTPS `/api/internal/` aponta para `127.0.0.1:8003`;
- `127.0.0.1:8002` permanece para homologacao interna e rollback temporario.

A separacao entre runtime publico, runtime interno de homologacao e runtime interno de producao e decisao de seguranca e menor privilegio, nao um contorno temporario. Os arquivos `.env` reais continuam fora do Git. Detalhes: `INTERNAL-PUBLIC-RUNTIME-SEPARATION.md` e `API-SERVER-DEPLOYMENT-PLAN.md`.

## Validacao Operacional do Endpoint Interno

O runtime interno de homologacao foi criado como `GeoportalAPIInternaHomologacao` na porta `8002`, com `Start = SERVICE_AUTO_START`, role `geoportal_api_homolog` e env real fora do Git. O harness `InternaHomologacao` validou `/api/health`, `/api/version` com `environment=homologacao` e `/api/internal/auth/me` sem sessao retornando 401.

Em validacao autenticada manual pelo servico NSSM, o endpoint `GET /api/internal/iluminacao/solicitacoes?limit=10&offset=0` retornou itens reais apos login interno e confirmacao da permissao `iluminacao.solicitacoes.ler`, sem registrar token ou cookie real. `geoportal_api_homolog` possui somente `USAGE` no schema `mod_iluminacao` e `SELECT` em `mod_iluminacao.solicitacoes` para essa etapa; nao recebeu `INSERT`, `UPDATE` ou `DELETE` em `mod_iluminacao`.

Registro historico: nessa validacao inicial de homologacao, producao, Apache/proxy, frontend, migrations, schema e `.env` versionado nao haviam sido alterados. O marco posterior de 2026-06-12 publicou a API interna de producao via Apache HTTPS em `/api/internal/`, apontando para `127.0.0.1:8003`.
