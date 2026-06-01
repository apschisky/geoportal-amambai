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

Primeira versao implementada:

- Rota interna somente leitura sob `GEOPORTAL_INTERNAL_ROUTES_ENABLED`.
- Exige sessao autenticada e `require_permission("iluminacao.solicitacoes.ler")`.
- Nao exige `X-Geoportal-Internal-Request`, por ser GET.
- Query params: `status` opcional validado contra `StatusSolicitacaoIluminacao`, `limit` de 1 a 100 com padrao 50 e `offset` minimo 0 com padrao 0.
- Retorna `items`, `limit` e `offset`.
- Cada item retorna campos operacionais da solicitacao e coordenadas `latitude`/`longitude` em WGS84/EPSG:4326, calculadas a partir de `geom` com `ST_Transform(geom, 4326)`.
- A consulta filtra sempre `deleted_at IS NULL`, usa colunas explicitas, bind parameters e nao usa `SELECT *`.

Campos retornados por item:

- `id`, `protocolo`, `origem`, `localizacao_tipo`, `poste_id`, `tipo_problema`, `descricao`, `observacoes_localizacao`, `ponto_referencia`, `poste_proximo_informado`, `nome_solicitante`, `contato_solicitante`, `status`, `prioridade`, `duplicidade_suspeita`, `latitude`, `longitude`, `criado_em`, `atualizado_em`, `finalizado_em`.

Fases futuras podem adicionar filtros por periodo, regiao, tipo de problema, prioridade, poste, protocolo, total de registros e resumo por status. Esses campos nao fazem parte da primeira versao para manter menor escopo e menor risco.

Erros: 401 sem sessao, 403 sem permissao, 422 para query invalida e 503 generico se o banco estiver indisponivel, sem expor SQL, traceback, host, role, segredo ou `DATABASE_URL`.

### `GET /api/internal/iluminacao/solicitacoes/{id}`

Finalidade: ver detalhe interno da solicitacao.

Permissao:

- `visualizar`.

Resposta:

- dados completos permitidos ao perfil;
- historico;
- anexos autorizados;
- dados pessoais somente para perfis autorizados.

### `PATCH /api/internal/iluminacao/solicitacoes/{id}/status`

Finalidade: alterar status.

Payload:

- `status_novo`;
- `observacao`;
- `responsavel` ou `equipe` opcional.

Permissao:

- `alterar_status`.

Auditoria:

- status anterior;
- status novo;
- usuario;
- data/hora;
- observacao;
- IP/origem.

### `POST /api/internal/iluminacao/solicitacoes/{id}/observacoes`

Finalidade: adicionar observacao interna.

Payload:

- `observacao`;
- `visibilidade` interna/publica controlada, se aplicavel.

Permissao:

- `editar` ou `encaminhar`.

Auditoria:

- registrar usuario;
- registrar data/hora;
- registrar conteudo resumido.

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
- prova de conceito FastAPI em homologacao;
- validacao com setor responsavel;
- desenho de telas do painel interno.
