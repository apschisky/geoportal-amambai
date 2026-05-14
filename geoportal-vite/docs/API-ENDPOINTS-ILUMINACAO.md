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

Status da POC local: endpoint simulado disponivel em `geoportal-backend/`, com validacao Pydantic, resposta de protocolo ficticio, status tecnico padronizado como `aberta` e sem persistencia em banco.

Payload conceitual:

- `poste_id`;
- `coordenada`;
- `tipo_problema`;
- `descricao`;
- `ponto_referencia`;
- `poste_proximo_informado`, quando o cidadao nao localizar o poste correto;
- `solicitante_nome` opcional;
- `solicitante_contato` opcional;
- sem `foto` publica na primeira versao.

Resposta conceitual:

- `protocolo`;
- `status_inicial`, inicialmente Aberta;
- `data_abertura`;
- `mensagem`, com texto sugerido: "Solicitacao realizada. Protocolo no IP-AAAA-NNNNNN."

Validacoes:

- `poste_id` obrigatorio;
- `tipo_problema` obrigatorio;
- `descricao` com limite de tamanho;
- coordenada valida;
- ponto de referencia opcional, com limite de tamanho;
- contato opcional com validacao;
- protocolo no formato sugerido `IP-2026-000001`, com prefixo, ano e sequencial;
- rate limit;
- protecao contra spam.

Auditoria/log:

- registrar criacao;
- registrar IP/origem quando possivel;
- nao expor dados tecnicos ao cidadao.

### `GET /api/public/iluminacao/protocolo/{protocolo}`

Finalidade: consultar andamento publico de uma solicitacao.

Resposta conceitual:

- `protocolo`;
- `status_publico`;
- `data_abertura`;
- `data_ultima_atualizacao`;
- `mensagem_publica`.

Regras:

- nunca retornar dados internos;
- nunca retornar dados pessoais;
- nao retornar previsao inicialmente;
- evitar exposicao de historico interno.

Validacoes:

- formato de protocolo;
- protecao contra enumeracao;
- rate limit.

## 5. Endpoints internos

### `GET /api/internal/iluminacao/solicitacoes`

Finalidade: listar solicitacoes para painel interno.

Filtros:

- `status`;
- `data_inicial`;
- `data_final`;
- `bairro` ou `regiao`;
- `tipo_problema`;
- `prioridade`;
- `poste_id`;
- `protocolo`.

Permissao:

- `visualizar`.

Resposta:

- lista paginada;
- total de registros;
- resumo por status, se aplicavel.

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
- `500`: erro interno generico.

Erros tecnicos nao devem ser expostos ao cidadao. Stack trace, SQL, caminho de arquivo e credenciais nunca devem aparecer em resposta HTTP.

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
| `GET /api/public/iluminacao/protocolo/{protocolo}` | Sim | Sim | Sim | Sim | Sim | Sim |
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
| `GET /api/public/iluminacao/protocolo/{protocolo}` | Opcional | Consulta publica de protocolo, com cuidado para volume |
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

- Botao Solicitar Reparo futuramente chamara formulario/API propria.
- Camada publica de postes continua sendo base visual.
- Status publico podera vir de endpoint publico ou view controlada.
- Google Forms deve continuar como fallback ate o modulo proprio estar estavel; a troca definitiva deve ser validada pelo Prefeito.
- O front-end publico nao deve acessar endpoints internos.

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

## 16. Proximos passos

- `docs/SQL-MIGRATION-PLAN.md`;
- prova de conceito FastAPI em homologacao;
- validacao com setor responsavel;
- desenho de telas do painel interno.
