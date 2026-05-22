# Modelo de Dados Interno de Iluminacao Publica

Este documento detalha o modelo conceitual futuro para historico/auditoria e observacoes internas do modulo interno de Iluminacao Publica. Ele nao aplica migrations, nao altera codigo e nao altera banco nesta etapa.

## 1. Objetivo

Registrar o desenho das futuras tabelas internas:

- `mod_iluminacao.solicitacoes_historico`;
- `mod_iluminacao.solicitacoes_observacoes`.

Essas tabelas devem apoiar triagem, acompanhamento, execucao, encerramento, auditoria e rastreabilidade operacional das solicitacoes registradas pelo Geoportal.

## 2. Separacao de responsabilidades

- `mod_iluminacao.solicitacoes`: tabela principal, guarda o estado atual da solicitacao.
- `mod_iluminacao.solicitacoes_historico`: trilha de auditoria de mudancas relevantes.
- `mod_iluminacao.solicitacoes_observacoes`: comentarios internos operacionais.

A tabela principal continua sendo a fonte do estado atual. O historico registra eventos append-only. As observacoes registram contexto operacional interno sem expor esse conteudo ao cidadao.

## 3. Tabela `solicitacoes_historico`

Campos conceituais:

- `id`;
- `solicitacao_id`;
- `acao`;
- `status_anterior`;
- `status_novo`;
- `prioridade_anterior`;
- `prioridade_nova`;
- `usuario_id`;
- `usuario_nome`;
- `origem_acao`;
- `observacao_resumida`;
- `criado_em`.

### Acoes esperadas

- `criacao`;
- `alteracao_status`;
- `alteracao_prioridade`;
- `observacao_interna`;
- `encerramento`;
- `cancelamento`;
- `reabertura`, se vier a existir futuramente.

### Origem da acao

- `sistema`;
- `usuario_interno`;
- `importacao_controlada`;
- `ajuste_administrativo`.

## 4. Tabela `solicitacoes_observacoes`

Campos conceituais:

- `id`;
- `solicitacao_id`;
- `observacao`;
- `visibilidade`;
- `usuario_id`;
- `usuario_nome`;
- `criado_em`;
- `editado_em`, se necessario futuramente;
- `deleted_at`, se necessario futuramente.

### Visibilidade

- `interna`;
- `publica_futura`.

Na primeira fase, somente `interna` deve ser usada. A visibilidade `publica_futura` fica apenas como possibilidade conceitual e nao autoriza exposicao automatica ao cidadao.

## 5. Regras de auditoria e privacidade

- Consulta publica nunca deve retornar observacoes internas.
- Consulta publica nunca deve retornar historico administrativo completo.
- Alteracao de status deve sempre gerar registro em `solicitacoes_historico`.
- Alteracao de prioridade deve sempre gerar registro em `solicitacoes_historico`.
- Criacao de observacao interna deve gerar registro em `solicitacoes_observacoes` e evento resumido em `solicitacoes_historico`.
- Historico deve ser append-only.
- Exclusao fisica deve ser evitada.
- Soft delete, se usado em observacoes, deve ser auditado.
- Dados pessoais devem ser minimizados.
- Usuario e data/hora devem ser registrados nas acoes internas.
- Logs nao devem conter senha, token, telefone completo ou dados sensiveis desnecessarios.

## 6. Referencia para outros modulos

Este desenho deve servir como referencia para modulos futuros do Geoportal, como:

- Meio Ambiente;
- Defesa Civil;
- Obras;
- Fiscalizacao;
- outros servicos urbanos.

Cada modulo pode adaptar nomes e campos, mas deve preservar os principios de estado atual, historico append-only, observacoes internas, auditoria e separacao entre dados publicos e internos.

## 7. Migrations futuras

As futuras migrations devem ser pequenas, revisaveis e reversiveis:

- uma migration para `solicitacoes_historico`;
- uma migration para `solicitacoes_observacoes`;
- rollbacks correspondentes;
- foreign key para `mod_iluminacao.solicitacoes(id)`;
- indices por `solicitacao_id`;
- indices por `criado_em`;
- indices por `acao`;
- indices por `usuario_id`;
- constraints para `acao`;
- constraints para `origem_acao`;
- constraints para `visibilidade`.

As migrations devem manter o schema `mod_iluminacao` como area operacional da API e do modulo interno. Nao devem gravar em `plano` nem em `web_map`.

Registro documental: a migration `0004_create_iluminacao_solicitacoes_historico.sql` e o rollback correspondente foram criados para a tabela `mod_iluminacao.solicitacoes_historico`. A migration `0005_create_iluminacao_solicitacoes_observacoes.sql` e o rollback correspondente foram criados para a tabela `mod_iluminacao.solicitacoes_observacoes`. Essas migrations ainda precisam ser aplicadas somente com backup, validacao em homologacao e autorizacao operacional.

A visibilidade `publica_futura` em `solicitacoes_observacoes` e apenas reserva conceitual. Ela nao autoriza exposicao automatica ao cidadao; observacoes internas nao devem aparecer na consulta publica.

Validacao em homologacao: as migrations `0004` e `0005` foram aplicadas em homologacao apos backup manual validado como legivel. As tabelas internas foram criadas, FKs restritivas foram testadas, inserts controlados funcionaram e a exclusao da solicitacao principal foi bloqueada quando havia historico vinculado. Os registros internos de teste foram removidos, as tabelas ficaram vazias apos a limpeza e producao ainda nao recebeu essas migrations.

## 8. Uso pelos endpoints internos

Endpoints internos futuros devem usar essas tabelas da seguinte forma:

- `PATCH /api/internal/iluminacao/solicitacoes/{id}/status` altera o estado atual e grava historico.
- `POST /api/internal/iluminacao/solicitacoes/{id}/observacoes` grava observacao e evento resumido no historico.
- `GET /api/internal/iluminacao/solicitacoes/{id}` pode retornar detalhe interno com historico e observacoes, respeitando permissao.
- `GET /api/public/iluminacao/consulta` nao retorna historico interno nem observacoes internas.

## 9. Riscos prevenidos

Este desenho reduz os seguintes riscos:

- perda de rastreabilidade;
- alteracao manual sem auditoria;
- exposicao indevida de dados internos;
- dificuldade de apurar quem alterou um chamado;
- inconsistencia entre status atual e historico;
- dificuldade de replicar o padrao para outros modulos.

## 10. Criterios de aceite desta etapa documental

- Nenhum codigo funcional alterado.
- Nenhuma migration aplicada no banco ainda.
- Modelo conceitual claro.
- Regras de auditoria explicitas.
- Separacao publico/interno preservada.
- Documento pronto para orientar a proxima etapa de criacao das migrations.
