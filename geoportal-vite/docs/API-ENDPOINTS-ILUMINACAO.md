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

Payload conceitual:

- `poste_id`;
- `coordenada`;
- `tipo_problema`;
- `descricao`;
- `solicitante_nome` opcional;
- `solicitante_contato` opcional;
- `foto` opcional futuramente.

Resposta conceitual:

- `protocolo`;
- `status_inicial`;
- `data_abertura`;
- `mensagem`.

Validacoes:

- `poste_id` obrigatorio;
- `tipo_problema` obrigatorio;
- `descricao` com limite de tamanho;
- coordenada valida;
- contato opcional com validacao;
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
- nunca retornar dados pessoais sensiveis sem decisao formal;
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
- Encaminhada -> Em execucao.
- Em execucao -> Resolvida.
- Aberta/Em triagem -> Indeferida.
- Aberta/Em triagem/Encaminhada -> Cancelada.

Transicoes devem ser validadas pela API, nao apenas pelo front-end.

## 8. Permissoes por endpoint

| Endpoint | Publico | Atendente | Campo | Gestor | Admin | Auditor |
|---|---|---|---|---|---|---|
| `POST /api/public/iluminacao/solicitacoes` | Sim | Sim | Nao | Sim | Sim | Nao |
| `GET /api/public/iluminacao/protocolo/{protocolo}` | Sim | Sim | Sim | Sim | Sim | Sim |
| `GET /api/internal/iluminacao/solicitacoes` | Nao | Sim | Sim limitado | Sim | Sim | Sim |
| `GET /api/internal/iluminacao/solicitacoes/{id}` | Nao | Sim | Sim limitado | Sim | Sim | Sim |
| `PATCH /api/internal/iluminacao/solicitacoes/{id}/status` | Nao | Sim | Sim limitado | Sim | Sim | Nao |
| `POST /api/internal/iluminacao/solicitacoes/{id}/observacoes` | Nao | Sim | Sim | Sim | Sim | Nao |
| `POST /api/internal/iluminacao/solicitacoes/{id}/anexos` | Nao | Sim | Sim | Sim | Sim | Nao |
| `PATCH /api/internal/iluminacao/solicitacoes/{id}/finalizar` | Nao | Nao ou limitado | Sim | Sim | Sim | Nao |
| `PATCH /api/internal/iluminacao/solicitacoes/{id}/cancelar` | Nao | Sim limitado | Nao | Sim | Sim | Nao |

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

- Nome e contato sao opcionais ou dependem de politica definida.
- Endpoint publico de protocolo nao deve retornar dados pessoais, salvo decisao formal.
- Acesso interno a dados pessoais deve ser limitado por perfil.
- Finalidade da coleta deve ser registrada.
- Dados pessoais nao devem aparecer no mapa publico.

## 11. Anexos

- Upload publico pode ser fase posterior.
- Comecar sem anexo ou com anexo opcional controlado.
- Validar tipo e tamanho.
- Armazenar metadados.
- Nao expor caminho fisico.
- Acesso interno protegido.
- Registrar hash e usuario que enviou.

## 12. Integracao com Geoportal publico

- Botao Solicitar Reparo futuramente chamara formulario/API propria.
- Camada publica de postes continua sendo base visual.
- Status publico podera vir de endpoint publico ou view controlada.
- Google Forms podera ser substituido gradualmente.
- O front-end publico nao deve acessar endpoints internos.

## 13. Integracao com painel interno

- Painel interno usara endpoints internos.
- Filtros por status, periodo, tipo, prioridade e regiao.
- Mapa operacional usara dados internos protegidos.
- Indicadores serao derivados de endpoints internos ou views internas.
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
