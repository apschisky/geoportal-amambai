# Plano do Modulo Interno de Iluminacao Publica

Este documento registra o desenho inicial da proxima fase do modulo de Iluminacao Publica. Ele e apenas planejamento: nao altera codigo, banco, rotas existentes, migrations, rollbacks ou configuracoes de ambiente.

## 1. Objetivo

O modulo interno deve permitir a gestao das solicitacoes de iluminacao publica registradas pelo Geoportal.

Objetivos principais:

- apoiar triagem, acompanhamento, execucao e encerramento das solicitacoes;
- permitir que a equipe administrativa/operacional acompanhe chamados em uma interface propria;
- substituir gradualmente controles manuais e o fluxo baseado apenas em Google Forms;
- manter a API publica de criacao e consulta funcionando de forma estavel e segura durante a transicao.

## 2. Escopo da primeira versao

A primeira versao deve ser minima, operacional e segura.

Escopo inicial:

- listar solicitacoes;
- filtrar por status, tipo de problema, data e poste;
- visualizar detalhe da solicitacao;
- alterar status;
- registrar observacao interna;
- preservar historico e auditoria;
- manter a consulta publica limitada e segura.

## 3. Fora do escopo da primeira versao

Nao fazem parte da primeira entrega:

- aplicativo mobile nativo;
- integracao automatica com equipes terceirizadas;
- notificacoes automaticas ao cidadao;
- anexos ou fotos;
- SLA avancado;
- dashboard executivo completo.

Esses itens podem ser avaliados depois que a operacao basica estiver estavel.

## 4. Status operacionais

Status previstos para gestao interna:

- `aberta`;
- `em_triagem`;
- `encaminhada`;
- `em_execucao`;
- `aguardando_material`;
- `nao_localizado`;
- `resolvida`;
- `indeferida`;
- `cancelada`.

## 5. Regras de transicao

- Toda solicitacao nova entra como `aberta`.
- A equipe interna pode avancar o status conforme a triagem e execucao.
- Status finalizadores: `resolvida`, `indeferida`, `cancelada` e `nao_localizado`.
- Uma vez finalizada, nova solicitacao para o mesmo poste pode ser aceita.
- Status ativos continuam bloqueando duplicidade por poste.

Status ativos para bloqueio de nova solicitacao por `poste_id`:

- `aberta`;
- `em_triagem`;
- `encaminhada`;
- `em_execucao`;
- `aguardando_material`.

## 6. Endpoints internos futuros

Endpoints conceituais para a fase interna:

- `GET /api/internal/iluminacao/solicitacoes`;
- `GET /api/internal/iluminacao/solicitacoes/{id}`;
- `PATCH /api/internal/iluminacao/solicitacoes/{id}/status`;
- `POST /api/internal/iluminacao/solicitacoes/{id}/observacoes`;
- `GET /api/internal/iluminacao/solicitacoes/{id}/historico`;
- `GET /api/internal/iluminacao/estatisticas`.

Esses endpoints devem ser separados dos endpoints publicos em `/api/public/...`. Eles nao devem reutilizar endpoints publicos e nao devem ser ativados sem autenticacao, autorizacao por perfil, auditoria e testes automatizados. A seguranca deve ser validada no backend; nao e aceitavel expor endpoint interno confiando apenas em esconder botoes ou telas no front-end.

O desenho de autenticacao, autorizacao, perfis e matriz de permissoes esta em `docs/INTERNAL-AUTHORIZATION-PLAN.md`.

O modelo de dados de autenticacao/autorizacao deve ser transversal aos modulos internos e esta descrito em `docs/INTERNAL-AUTH-DATA-MODEL.md`.

## 7. Seguranca

Regras de seguranca para o modulo interno:

- endpoints internos nao devem ser publicos;
- exigir autenticacao;
- exigir autorizacao por perfil ou permissao;
- nao reutilizar endpoints publicos para gestao interna;
- validar autenticacao e autorizacao no backend;
- registrar usuario, data/hora e acao em auditoria;
- evitar exposicao de dados pessoais quando nao houver necessidade operacional;
- minimizar dados pessoais em listagens;
- nao exibir telefone ou contato em listagens amplas quando nao for necessario;
- aplicar menor privilegio no banco;
- manter logs sem senha, token, `DATABASE_URL`, telefone completo ou dados sensiveis;
- nao expor detalhes administrativos na consulta publica do cidadao;
- separar operacoes internas de listagem, status e observacoes da API publica.

## 8. Modelo de dados interno

Modelo conceitual do modulo interno:

- manter `mod_iluminacao.solicitacoes` como tabela principal;
- usar `mod_iluminacao.solicitacoes_historico` para historico/auditoria de alteracoes;
- usar `mod_iluminacao.solicitacoes_observacoes` para observacoes internas;
- avaliar tabela de usuarios internos;
- avaliar tabela de equipes ou setores;
- registrar status anterior, status novo, usuario responsavel e data/hora para mudancas relevantes.

Tabelas internas futuras, como usuarios, perfis ou sessoes, devem manter segregacao no schema operacional adequado e evitar gravacao operacional em `plano` ou `web_map`.

O desenho conceitual detalhado das futuras tabelas `mod_iluminacao.solicitacoes_historico` e `mod_iluminacao.solicitacoes_observacoes` esta em `docs/ILUMINACAO-INTERNAL-DATA-MODEL.md`.

As migrations internas planejadas para `mod_iluminacao.solicitacoes_historico` e `mod_iluminacao.solicitacoes_observacoes` foram criadas e validadas em homologacao com backup previo, FKs restritivas, inserts controlados e limpeza dos registros de teste.

As migrations internas `0004` e `0005` tambem foram aplicadas no banco ativo apos backup manual validado como legivel. As tabelas internas foram criadas, os indices foram validados, as FKs restritivas para `mod_iluminacao.solicitacoes(id)` foram confirmadas com `ON UPDATE RESTRICT` e `ON DELETE RESTRICT`, a API publica continuou saudavel e `/api/version` continuou retornando ambiente `producao`. As tabelas internas permaneceram vazias apos a criacao.

O endpoint interno de leitura de historico ja consome `mod_iluminacao.solicitacoes_historico` em homologacao interna. O endpoint interno de leitura de observacoes ja consome `mod_iluminacao.solicitacoes_observacoes` em homologacao interna, filtrando `deleted_at IS NULL` e `visibilidade = 'interna'`. O primeiro endpoint mutavel do modulo, `POST /api/internal/iluminacao/solicitacoes/{id}/observacoes`, ja grava observacao e evento resumido no historico na mesma transacao. Ainda nao ha endpoint mutavel de status nem tela interna consumindo essas operacoes.

Diagnostico posterior confirmou que o schema atual de `solicitacoes_historico` e `solicitacoes_observacoes` e suficiente para leitura de historico, leitura/criacao de observacoes internas e futura alteracao de status com auditoria obrigatoria. Nao ha recomendacao de migration para os proximos endpoints basicos. Como nao existe trigger obrigando historico, qualquer operacao mutavel deve gravar o evento correspondente na mesma transacao.

O `PATCH /api/internal/iluminacao/solicitacoes/{id}/status` foi implementado e validado em homologacao interna conforme contrato planejado: permissao `iluminacao.solicitacoes.atualizar_status`, header mutavel `X-Geoportal-Internal-Request: 1`, payload restrito a `status` e `observacao`, observacao obrigatoria de 3 a 1000 caracteres, matriz conservadora de transicoes, status terminais (`resolvida`, `cancelada`, `indeferida`, `nao_localizado`), preenchimento de `finalizado_em` ao entrar em terminal e auditoria obrigatoria com `acao='alteracao_status'` e `origem_acao='usuario_interno'`. O GRANT operacional foi por coluna, restrito a `status`, `atualizado_em` e `finalizado_em`, reduzindo o risco de UPDATE amplo. Tela, anexos, proxy e producao interna permanecem etapas posteriores.

Validacao operacional: o endpoint `GET /api/internal/iluminacao/solicitacoes/{id}/historico` foi implementado no commit `b68bc32` e validado no runtime interno de homologacao com sessao real, permissao `iluminacao.solicitacoes.ver_historico`, `SELECT` minimo em `mod_iluminacao.solicitacoes_historico` para `geoportal_api_homolog` e dado de homologacao/teste. O retorno `total=0` para a solicitacao de teste foi esperado porque ainda nao havia eventos historicos gravados. Producao, proxy, frontend, migrations, schema, `.env` versionado e endpoint mutavel permaneceram inalterados.

Validacao operacional: o endpoint `GET /api/internal/iluminacao/solicitacoes/{id}/observacoes` foi implementado no commit `da236c4` e validado no runtime interno de homologacao com sessao real, permissao `iluminacao.solicitacoes.ver_observacoes`, `SELECT` minimo em `mod_iluminacao.solicitacoes_observacoes` para `geoportal_api_homolog` e dado de homologacao/teste. O retorno `total=0` para a solicitacao de teste foi esperado porque ainda nao havia observacoes internas gravadas. Naquela etapa, a permissao `iluminacao.solicitacoes.comentar` permaneceu reservada para o futuro `POST observacao`, posteriormente implementado e validado no commit `2b05e4a`. Producao, proxy, frontend, migrations, schema, `.env` versionado e endpoint mutavel permaneceram inalterados naquela etapa.

Validacao operacional: o endpoint `POST /api/internal/iluminacao/solicitacoes/{id}/observacoes` foi implementado no commit `2b05e4a` e validado no runtime interno de homologacao com sessao real, permissao `iluminacao.solicitacoes.comentar` e header `X-Geoportal-Internal-Request: 1`. A permissao real foi criada em homologacao e vinculada ao perfil administrativo. Os GRANTs aplicados foram minimos: `INSERT` nas tabelas de observacoes e historico e `USAGE` nas duas sequences correspondentes, sem `UPDATE` ou `DELETE`. O POST com dado de homologacao/teste (`solicitacao_id=18`) retornou 201 Created; depois, `GET observacoes` confirmou `total=1` e `GET historico` confirmou `total=1` com `acao=observacao_interna` e `origem_acao=usuario_interno`. O endpoint nao alterou status, prioridade ou `finalizado_em`. Producao, proxy, frontend, migrations, schema e `.env` versionado permaneceram inalterados.

Validacao operacional: o endpoint `PATCH /api/internal/iluminacao/solicitacoes/{id}/status` foi implementado no commit `28f00dc` e validado no runtime interno de homologacao com sessao real, permissao `iluminacao.solicitacoes.atualizar_status` e header mutavel. Foram confirmadas transicoes validas com historico, idempotencia sem novo historico, bloqueio de transicoes invalidas, preenchimento de `finalizado_em` em terminal e bloqueio de saida de terminal. A role `geoportal_api_homolog` recebeu apenas `UPDATE` por coluna em `status`, `atualizado_em` e `finalizado_em`; prioridade, protocolo, geometria, soft delete e dados do solicitante permaneceram sem UPDATE. Correcao/reversao de status fica para fluxo futuro separado, com justificativa obrigatoria, permissao especifica restrita e auditoria propria.

## 9. Interface interna

Iluminacao Publica deve ser o primeiro modulo dentro de um portal interno unico multi-modulo. A interface propria do modulo deve existir dentro do layout comum do Geoportal Interno, com menu por permissoes e separacao da area publica.

Componentes previstos para a interface interna:

- painel de listagem;
- filtros por status, tipo, data e poste;
- detalhe da solicitacao;
- mapa com pontos;
- alteracao de status;
- historico da solicitacao;
- visao de chamados ativos.

A interface deve priorizar uso operacional repetido: informacao densa, clara, filtravel e sem elementos decorativos excessivos.

Mapa operacional, dashboard e indicadores consolidados continuam como evolucao futura. Para Iluminacao, o mapa interno devera mostrar postes e solicitacoes por status, permitir detalhe operacional conforme permissao e, quando aprovado, oferecer rota ate o poste. Essa evolucao nao faz parte da shell inicial nem da proxima integracao minima.

Marco da shell interna: a listagem somente leitura foi integrada no commit `a6269d2`. A shell `/interno/` chama `GET /api/internal/iluminacao/solicitacoes?limit=20&offset=0` apenas depois de sessao autenticada, `/me` valido e permissao `iluminacao.solicitacoes.ler`. A tabela inicial mostra somente campos minimos nao pessoais e mantem ocultos nome, contato, descricao, observacoes de localizacao, ponto de referencia, poste proximo informado, latitude e longitude.

Marco da shell interna: o detalhe somente leitura foi integrado no commit `6c4ce39`. A shell chama `GET /api/internal/iluminacao/solicitacoes/{id}` apenas apos sessao autenticada, `/me` valido, permissao `iluminacao.solicitacoes.ler` e selecao explicita de item da listagem. O painel organiza os dados em secoes operacionais e restritas, sem exibir coordenadas no painel comum e sem JSON bruto. Dados pessoais ou campos livres aparecem apenas no detalhe interno, nunca na tabela. Historico, observacoes, alteracao de status, dashboard real, mapa operacional, anexos e rota Google Maps permanecem fora desta fase.

## 10. Roadmap

Fases sugeridas:

1. Fase 1: documentacao de autenticacao, autorizacao, modelo de dados auth e endpoints internos.
2. Fase 2: modelo de dados de usuarios, perfis e sessoes, ou decisao tecnica equivalente.
3. Fase 3: migrations de seguranca/autenticacao. Migrations de historico e observacoes ja aplicadas em homologacao e no banco ativo.
4. Fase 4: implementacao de autenticacao no backend com testes.
5. Fase 5: endpoints internos protegidos para historico, observacoes e status. Leitura de historico, leitura de observacoes internas, criacao de observacao interna e alteracao de status ja foram validadas em homologacao interna.
6. Fase 6: criar e validar a shell inicial da tela interna minima em homologacao. A shell em `/interno/` ja foi criada como entrada multi-page do Vite, evoluida para portal interno multi-modulo, integrada ao login visual minimo, integrada a listagem somente leitura de Iluminacao e integrada ao detalhe somente leitura por selecao explicita. Ela usa cookie HttpOnly, ignora token retornado no corpo do login, nao grava token em `localStorage` ou `sessionStorage`, libera visualmente Iluminacao por `iluminacao.solicitacoes.ler`, chama `GET /api/internal/iluminacao/solicitacoes?limit=20&offset=0` apos sessao e permissao confirmadas e chama `GET /api/internal/iluminacao/solicitacoes/{id}` apenas para item selecionado da tabela. A shell continua sem historico, observacoes, alteracao de status, dashboard real, mapa operacional, anexos, rota Google Maps, correcao/reversao administrativa ou `POST`/`PATCH` de Iluminacao. A proxima subfase recomendada e inventariar o contrato do historico somente leitura antes de implementar qualquer painel de historico.
7. Fase 7: auditoria e revisao de seguranca antes de uso por equipe real.
8. Fase 8: mapa interno, relatorios e indicadores.

## 11. Criterios de aceite

Antes de ativar qualquer parte do modulo interno:

- nao quebrar a API publica;
- nao quebrar o Geoportal publico;
- nao quebrar o GeoServer;
- manter Google Forms como fallback durante a transicao;
- preservar registros existentes;
- criar testes automatizados para services, repositories e endpoints internos;
- validar permissoes de banco com menor privilegio;
- registrar auditoria para alteracoes internas;
- impedir alteracao de status sem registro em historico;
- exigir autenticacao obrigatoria e autorizacao por perfil;
- testar acesso autorizado e negado;
- manter a consulta publica limitada a dados seguros;
- atualizar documentacao antes de ativacao.

## 12. Relacao com a fase publica

A API publica ja permite criacao de solicitacoes, consulta por protocolo e bloqueio de duplicidade ativa por poste. O modulo interno deve consumir e evoluir essa base sem enfraquecer as protecoes publicas.

Durante a transicao:

- Google Forms permanece como fallback;
- a consulta publica continua exibindo apenas dados minimos;
- dados pessoais e observacoes internas nao devem aparecer para o cidadao;
- status internos devem ser traduzidos para mensagens publicas seguras quando consultados externamente.
