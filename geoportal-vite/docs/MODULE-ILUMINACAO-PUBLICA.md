# Modulo de Iluminacao Publica / Manutencao de Postes

Este documento planeja o primeiro modulo interno operacional do Geoportal de Amambai, usando a camada de postes como base espacial e funcional.

## 1. Objetivo

Definir o escopo inicial do modulo de Iluminacao Publica / Manutencao de Postes, incluindo fluxo do cidadao, fluxo interno, dados minimos, permissao, auditoria, painel, mapa operacional e fases de implantacao.

Este modulo deve validar a arquitetura futura do Geoportal/SIG Municipal com API, protocolo, status, painel interno, PostGIS operacional, login, permissoes e auditoria.

## 2. Por que este e o modulo piloto

Este e o melhor modulo piloto porque:

- ja existe camada de postes no Geoportal;
- ja existe popup;
- ja existe botao de Solicitar Reparo via Google Forms;
- ja existe busca por poste;
- ja existe relacao espacial clara;
- o fluxo e simples o suficiente para validar API, protocolo, painel interno, status e auditoria.

## 3. Estado atual

Hoje o Geoportal possui:

- camada publica de postes;
- popup com ID do poste;
- rota para o poste;
- botao de solicitacao via formulario externo;
- busca por poste;
- ausencia de protocolo proprio;
- ausencia de painel interno;
- ausencia de status operacional no Geoportal;
- ausencia de historico auditado dentro do sistema.

## 4. Fluxo futuro do cidadao

1. Cidadao acessa o Geoportal.
2. Ativa Postes da Rede Eletrica.
3. Clica no poste.
4. Solicita reparo.
5. Preenche formulario proprio.
6. Recebe protocolo.
7. Acompanha andamento quando aplicavel.

## 5. Fluxo futuro do setor interno

1. Servidor acessa ambiente interno com login.
2. Visualiza solicitacoes abertas.
3. Filtra por bairro, status, data, tipo de problema e prioridade.
4. Abre detalhe da solicitacao.
5. Atualiza status.
6. Registra execucao.
7. Anexa foto ou observacao.
8. Finaliza atendimento.
9. Tudo fica auditado.

## 6. Status sugeridos

- Aberta.
- Em triagem.
- Encaminhada.
- Em execucao.
- Resolvida.
- Indeferida.
- Cancelada.

Os nomes devem ser validados com o setor responsavel antes da implementacao.

## 7. Dados minimos da solicitacao

Campos publicos ou semipublicos candidatos:

- protocolo;
- data/hora;
- ID do poste;
- coordenada;
- nome do solicitante, se permitido;
- contato, se permitido;
- tipo de problema;
- descricao;
- foto opcional;
- status;
- responsavel/setor;
- data de atualizacao;
- data de conclusao;
- observacoes.

Alerta LGPD: coletar apenas o necessario, informar finalidade e evitar exibir dados pessoais no mapa publico.

## 8. Dados operacionais internos

Campos internos candidatos:

- prioridade;
- equipe responsavel;
- ordem de servico;
- historico de encaminhamentos;
- motivo de indeferimento/cancelamento;
- custo estimado, se houver;
- material usado, se houver;
- foto de antes/depois;
- usuario responsavel pela alteracao.

Esses dados nao devem ser publicados diretamente no Geoportal publico.

## 9. Proposta inicial de schema

Schema sugerido:

- `mod_iluminacao`

Tabelas iniciais candidatas:

- `mod_iluminacao.solicitacoes`;
- `mod_iluminacao.solicitacao_historico`;
- `mod_iluminacao.solicitacao_anexos`;
- `mod_iluminacao.status_solicitacao`;
- `mod_iluminacao.tipo_problema`.

Este documento nao cria SQL. O desenho fisico deve ser feito em etapa propria, com revisao de seguranca, chaves, indices, constraints, permissoes e auditoria.

## 10. Relacao com camada de postes

- A camada atual de postes deve continuar publica.
- Dados operacionais nao devem ser gravados diretamente na camada publica.
- Solicitacoes devem referenciar o ID do poste.
- Status publico deve ser exposto apenas por view controlada, se necessario.
- Historico interno nao deve aparecer no Geoportal publico.
- A camada publica pode continuar servindo como base visual e ponto de entrada para solicitacao.

## 11. API/FastAPI futura

Endpoints conceituais:

- criar solicitacao publica;
- consultar protocolo;
- listar solicitacoes internas;
- atualizar status;
- adicionar observacao;
- anexar arquivo;
- finalizar atendimento.

Nenhum endpoint deve ser implementado antes do desenho minimo de autenticacao, autorizacao, validacao, auditoria e tratamento seguro de erros.

## 12. Permissoes iniciais

Perfis sugeridos:

- cidadao/consulta publica;
- atendente/triagem;
- equipe de campo;
- gestor do modulo;
- administrador do sistema.

Permissoes devem ser por acao, como visualizar, criar, editar, encaminhar, finalizar, anexar e cancelar.

## 13. Auditoria obrigatoria

Toda alteracao deve guardar:

- usuario;
- data/hora;
- acao;
- status anterior;
- status novo;
- observacao;
- IP/origem quando possivel.

A auditoria deve ser imutavel para usuarios comuns e consultavel por perfis autorizados.

## 14. Painel interno

Indicadores iniciais:

- solicitacoes abertas;
- solicitacoes por status;
- tempo medio de atendimento;
- solicitacoes por bairro/regiao;
- solicitacoes reincidentes por poste;
- finalizadas no periodo.

O painel deve permitir filtro por status, periodo, prioridade, bairro/regiao e tipo de problema.

## 15. Mapa operacional

Visualizacoes desejadas:

- solicitacoes abertas;
- solicitacoes em execucao;
- solicitacoes resolvidas;
- filtro por periodo;
- filtro por status;
- destaque de reincidencia.

O mapa operacional deve ficar no ambiente interno. O mapa publico pode exibir apenas status agregados ou informacoes controladas, quando aprovado.

## 16. Seguranca e privacidade

- Nao expor dados pessoais no mapa publico.
- Nao publicar historico interno.
- Validar entrada na API.
- Limitar anexos por tipo, tamanho e quantidade.
- Controlar permissoes.
- Registrar auditoria.
- Usar views publicas controladas.
- Evitar acesso direto do front-end publico as tabelas operacionais.
- Separar dados publicos, operacionais e historicos.

## 17. Fases de implantacao

1. Documento e validacao com setor responsavel.
2. Desenho do schema.
3. API minima.
4. Formulario publico proprio.
5. Painel interno basico.
6. Mapa operacional.
7. Consulta publica de protocolo.
8. Relatorios e indicadores.

## 18. Criterios para iniciar implementacao

- [ ] Fluxo validado com setor.
- [ ] Campos aprovados.
- [ ] Status aprovados.
- [ ] Schema desenhado.
- [ ] Permissoes definidas.
- [ ] Auditoria definida.
- [ ] Estrategia de anexos definida.
- [ ] Ambiente de homologacao definido.
- [ ] Backup/rollback planejado.

## 19. Relacao com documentos existentes

Este documento deve ser lido junto com:

- `docs/INTERNAL-MODULES-ARCHITECTURE.md`;
- `docs/SECURITY-HARDENING-PLAN.md`;
- `docs/DATABASE-INVENTORY.md`;
- `docs/LAYER-INVENTORY.md`;
- `docs/GEOPORTAL-MATURITY-CHECKLIST.md`.

## 20. Proximos documentos recomendados

- `docs/POSTGIS-SCHEMA-PLAN.md`
- `docs/API-ARCHITECTURE.md`
- `docs/AUTH-PERMISSIONS-PLAN.md`
