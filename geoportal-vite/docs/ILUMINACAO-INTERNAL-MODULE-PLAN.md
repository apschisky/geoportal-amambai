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
- `PATCH /api/internal/iluminacao/solicitacoes/{id}/prioridade`;
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

O endpoint interno de leitura de historico ja consome `mod_iluminacao.solicitacoes_historico` em homologacao interna. O endpoint interno de leitura de observacoes ja consome `mod_iluminacao.solicitacoes_observacoes` em homologacao interna, filtrando `deleted_at IS NULL` e `visibilidade = 'interna'`. O primeiro endpoint mutavel do modulo, `POST /api/internal/iluminacao/solicitacoes/{id}/observacoes`, ja grava observacao e evento resumido no historico na mesma transacao. Os endpoints mutaveis de alteracao normal de status e de prioridade operacional tambem ja foram implementados e validados no fluxo interno, mantendo auditoria em historico e separacao entre status, prioridade e observacoes.

Diagnostico posterior confirmou que o schema atual de `solicitacoes_historico` e `solicitacoes_observacoes` e suficiente para leitura de historico, leitura/criacao de observacoes internas, alteracao normal de status e alteracao de prioridade com auditoria obrigatoria. Como nao existe trigger obrigando historico, qualquer operacao mutavel deve gravar o evento correspondente na mesma transacao.

O `PATCH /api/internal/iluminacao/solicitacoes/{id}/status` foi implementado e validado em homologacao interna conforme contrato planejado: permissao `iluminacao.solicitacoes.atualizar_status`, header mutavel `X-Geoportal-Internal-Request: 1`, payload restrito a `status` e `observacao`, observacao obrigatoria de 3 a 1000 caracteres, matriz conservadora de transicoes, status terminais (`resolvida`, `cancelada`, `indeferida`, `nao_localizado`), preenchimento de `finalizado_em` ao entrar em terminal e auditoria obrigatoria com `acao='alteracao_status'` e `origem_acao='usuario_interno'`. O GRANT operacional foi por coluna, restrito a `status`, `atualizado_em` e `finalizado_em`, reduzindo o risco de UPDATE amplo. Essa frase descreve a etapa historica do backend de status; posteriormente a tela, prioridade e producao interna evoluiram em fases separadas.

O `PATCH /api/internal/iluminacao/solicitacoes/{id}/prioridade` foi implementado e validado conforme contrato de prioridade operacional: permissao `iluminacao.solicitacoes.atualizar_prioridade`, header mutavel `X-Geoportal-Internal-Request: 1`, payload restrito a `prioridade` e `observacao`, observacao obrigatoria de 3 a 1000 caracteres, valores `baixa`, `normal`, `alta` e `urgente`, bloqueio em status terminal e auditoria obrigatoria com `acao='alteracao_prioridade'`, `prioridade_anterior`, `prioridade_nova` e `origem_acao='usuario_interno'`. A alteracao de prioridade nao altera status, nao altera `finalizado_em`, nao cria observacao separada e nao altera dados pessoais, protocolo ou geometria. O schema real ja suporta a coluna e o historico, entao nao houve migration para prioridade nesta etapa.

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
- alteracao de prioridade;
- historico da solicitacao;
- visao de chamados ativos.

A interface deve priorizar uso operacional repetido: informacao densa, clara, filtravel e sem elementos decorativos excessivos.

Mapa operacional completo, dashboard e indicadores consolidados continuam como evolucao futura. Para Iluminacao, a shell interna ja passou a exibir coordenadas, rota Google Maps e mapa simples no detalhe, consumindo apenas latitude/longitude ja retornadas pelos endpoints internos. A evolucao posterior do mapa deve tratar visualizacao ampla de postes e solicitacoes por status, filtros, permissao, privacidade e fallback quando camada externa ou GeoServer falhar.

Marco da shell interna: a listagem somente leitura foi integrada no commit `a6269d2`. A shell `/interno/` chama `GET /api/internal/iluminacao/solicitacoes?limit=20&offset=0` apenas depois de sessao autenticada, `/me` valido e permissao `iluminacao.solicitacoes.ler`. A tabela inicial mostra somente campos minimos nao pessoais e mantem ocultos nome, contato, descricao, observacoes de localizacao, ponto de referencia, poste proximo informado, latitude e longitude.

Registro historico do detalhe inicial: o detalhe somente leitura foi integrado no commit `6c4ce39`. Naquela fase, a shell chamava `GET /api/internal/iluminacao/solicitacoes/{id}` apenas apos sessao autenticada, `/me` valido, permissao `iluminacao.solicitacoes.ler` e selecao explicita de item da listagem. O painel organizava os dados em secoes operacionais e restritas, sem exibir coordenadas no painel comum e sem JSON bruto. Dados pessoais ou campos livres apareciam apenas no detalhe interno, nunca na tabela. Historico, observacoes, alteracao de status, dashboard real, mapa operacional, anexos e rota Google Maps permaneciam fora daquela fase; etapas posteriores ja integraram historico, observacoes, status, prioridade, coordenadas, rota e mapa simples.

Marco da shell interna: o historico somente leitura sob demanda foi integrado no commit `31d70b2`. A shell chama `GET /api/internal/iluminacao/solicitacoes/{id}/historico?limit=20&offset=0` apenas apos sessao autenticada, `/me` valido, detalhe carregado, identificador valido, permissao `iluminacao.solicitacoes.ver_historico` e clique explicito em `Ver historico`. O historico nao carrega automaticamente ao abrir detalhe, e a timeline permanece somente leitura. Campos operacionais sensiveis do historico, como usuario interno e `observacao_resumida`, devem continuar tratados com cuidado visual.

Marco da shell interna: as observacoes internas somente leitura sob demanda foram integradas no commit `3d127cf`. A shell chama `GET /api/internal/iluminacao/solicitacoes/{id}/observacoes?limit=20&offset=0` apenas apos sessao autenticada, `/me` valido, detalhe carregado, identificador valido, permissao `iluminacao.solicitacoes.ver_observacoes` e clique explicito em `Ver observacoes`. As observacoes nao carregam automaticamente ao abrir o detalhe, e a lista/cards exibida e somente leitura. A observacao e texto livre operacional interno e deve continuar sendo tratada com cuidado visual.

Marco da shell interna: a criacao de observacao interna foi integrada no commit `7ccb724`. A shell chama `POST /api/internal/iluminacao/solicitacoes/{id}/observacoes` apenas apos sessao autenticada, `/me` valido, detalhe carregado, identificador valido, permissao `iluminacao.solicitacoes.comentar` e acao explicita do usuario pelo formulario de observacao. A criacao usa `credentials: "include"`, `Content-Type: application/json`, `Accept: application/json`, header `X-Geoportal-Internal-Request: 1` e payload restrito a `{ observacao: textoTrimado }`. A validacao frontend exige trim, minimo de 3 caracteres, maximo de 2000 caracteres, bloqueio de envio invalido e protecao contra duplo envio. Depois do `201 Created`, o campo e limpo e as observacoes sao recarregadas por GET. Leitura e escrita permanecem visualmente separadas. A criacao nao altera status, prioridade, `finalizado_em` ou dados principais da solicitacao, nao ha `PATCH` nesta fase e o backend grava a observacao e o evento resumido no historico na mesma transacao.

Marco da shell interna: a alteracao normal de status foi integrada no commit `b860c5d`. A shell chama `PATCH /api/internal/iluminacao/solicitacoes/{id}/status` apenas apos sessao autenticada, `/me` valido, detalhe carregado, identificador valido, permissao `iluminacao.solicitacoes.atualizar_status` e acao explicita do usuario pela caixa de status. O PATCH usa `credentials: "include"`, `Content-Type: application/json`, `Accept: application/json`, header `X-Geoportal-Internal-Request: 1` e payload restrito a `{ status, observacao }`. A validacao frontend exige status permitido pela matriz, status diferente do atual, observacao trimada, minimo de 3 caracteres, maximo de 1000 caracteres, bloqueio de envio invalido e protecao contra duplo envio. Status terminal bloqueia a alteracao normal na interface. Depois do `200 OK`, detalhe e listagem sao recarregados, o historico e recarregado somente se ja estava aberto e as observacoes nao sao recarregadas por causa do PATCH. O fluxo nao envia prioridade, nao envia campos extras, nao cria observacao separada e o backend grava evento de alteracao de status no historico na mesma transacao.

Marco da shell interna: a alteracao de prioridade operacional foi integrada apos a validacao do backend. A shell chama `PATCH /api/internal/iluminacao/solicitacoes/{id}/prioridade` apenas apos sessao autenticada, `/me` valido, detalhe carregado, identificador valido, permissao `iluminacao.solicitacoes.atualizar_prioridade` e acao explicita do usuario pela caixa de prioridade. O PATCH usa `credentials: "include"`, `Content-Type: application/json`, `Accept: application/json`, header `X-Geoportal-Internal-Request: 1` e payload restrito a `{ prioridade, observacao }`. A validacao frontend exige prioridade diferente da atual, prioridade entre `baixa`, `normal`, `alta` e `urgente`, observacao trimada, minimo de 3 caracteres, maximo de 1000 caracteres, bloqueio de envio invalido e protecao contra duplo envio. Status terminal bloqueia a alteracao normal de prioridade na interface. Depois do `200 OK`, detalhe, listagem e historico sao recarregados. O fluxo nao altera status, nao cria observacao separada e nao modifica dados principais da solicitacao.

Marco da shell interna: o logout visual foi integrado no commit `70865c0`. A shell chama `POST /api/internal/auth/logout` apenas por acao explicita do usuario no botao `Sair`, usando `credentials: "include"`, `Accept: application/json` e header `X-Geoportal-Internal-Request: 1`, conforme exigencia da rota mutavel de autenticacao. Em `200` ou `401`, a shell volta para o estado de login e limpa de memoria usuario, permissoes, listagem, detalhe, historico e observacoes carregadas. O cookie HttpOnly e limpo pelo backend; a shell nao manipula cookie diretamente, nao grava token em `localStorage` ou `sessionStorage` e nao imprime cookie/token/senha em console.

Marco atual do MVP interno/piloto: a area interna de Iluminacao Publica esta pronta para piloto controlado em `https://geoserver.amambai.ms.gov.br/interno/`, servida no mesmo dominio da API interna `https://geoserver.amambai.ms.gov.br/api/internal/`. O MVP inclui login, `/me`, listagem, detalhe, coordenadas no detalhe, rota Google Maps baseada somente em latitude/longitude, mapa operacional simples com OSM/OpenLayers, historico sob demanda, observacoes sob demanda, criacao de observacao interna, alteracao normal de status, alteracao de prioridade operacional e logout. O backend permanece como autoridade de autorizacao; a interface usa permissoes apenas para orientar a navegacao e habilitar controles visuais.

A shell continua sem dashboard real, anexos ou correcao/reabertura administrativa de status terminal. O mapa atual e uma visualizacao simples no detalhe da solicitacao; mapa operacional amplo, dashboard e fluxo administrativo de correcao/reabertura permanecem etapas separadas. A UX de manutencao em campo foi refinada com listagem compacta, rota proxima ao protocolo e alteracao rapida de fase/status conforme permissao.

Perfil operacional minimo para equipe de campo: o perfil `manutencao-iluminacao` (`Manutencao - Iluminacao Publica`) foi criado/vinculado e validado com `manutencao.homologacao` e `manutencao.producao`. O perfil inclui somente `internal.auth.me`, `iluminacao.solicitacoes.ler`, `iluminacao.solicitacoes.ver_observacoes`, `iluminacao.solicitacoes.comentar` e `iluminacao.solicitacoes.atualizar_status`. Ele nao inclui `admin.*` nem `iluminacao.solicitacoes.atualizar_prioridade`. O objetivo e permitir operacao de campo com protocolos, fase/status, observacoes, coordenadas, mapa/rota e alteracao normal de status, mantendo prioridade e administracao fora do perfil operacional inicial. Como a URL real `https://geoserver.amambai.ms.gov.br/interno/` usa `/api/internal/` em `127.0.0.1:8003`, a validacao visual publicada foi feita com `manutencao.producao`.

Refino de campo implementado: para usuario de manutencao, a listagem agora usa cards compactos com protocolo, fase/status, tipo, prioridade, poste e acoes. `Tracar rota` aparece na listagem somente com latitude/longitude validas e usa apenas coordenadas. `Alterar fase` aparece na listagem somente com `iluminacao.solicitacoes.atualizar_status` e continua exigindo justificativa. O contato via WhatsApp fica somente no detalhe, com link `https://wa.me/<numero_sanitizado>`, sem mensagem automatica e sem incluir protocolo, descricao, observacoes, localizacao ou dados pessoais adicionais na URL.

Regra atual da manutencao: a shell de campo consome `GET /api/internal/iluminacao/solicitacoes?ativos=true`, fazendo o backend excluir chamados em status terminal antes da paginacao. O filtro exclui `resolvida`, `cancelada`, `indeferida` e `nao_localizado`. O frontend ainda mantem comparacao normalizada de status tecnico e status formatado, cobrindo `resolvida`/`Resolvida`, `cancelada`/`Cancelada`, `indeferida`/`Indeferida` e `nao_localizado`/`Não localizado`, como defesa complementar. Essa regra evita que a equipe de manutencao acompanhe chamados que nao exigem mais acao. Administrador/perfil completo continua chamando a listagem sem `ativos=true` e vendo todos os chamados para auditoria, conferencia e futura volta de fase controlada.

Contrato atual de identificacao visual: `/api/internal/auth/me` ainda retorna apenas `authenticated`, `usuario_id` e `permissoes`. Por isso a shell pode exibir fallback como `Usuario interno #2`. Evoluir `/auth/me` para retornar `login`, `nome` e `perfis` sanitizados permanece pendencia nao bloqueadora.

Prioridade operacional implementada: a prioridade apoia triagem, ordenacao operacional, destaque visual futuro, atendimento e dashboard, sem substituir o status. Valores aceitos: `baixa`, `normal`, `alta` e `urgente`, com default `normal` no banco. A alteracao e independente da alteracao de status, exige permissao especifica `iluminacao.solicitacoes.atualizar_prioridade`, header `X-Geoportal-Internal-Request: 1`, justificativa obrigatoria e historico transacional com `acao='alteracao_prioridade'`. A primeira versao bloqueia alteracao de prioridade em status terminal pelo fluxo normal; qualquer correcao em chamado finalizado deve ser fluxo administrativo futuro.

Producao interna/piloto: o marco operacional de 2026-06-12 criou e validou `GeoportalAPIInternaProducao` em `127.0.0.1:8003`, com Apache `/api/internal/` apontando para a producao interna e `127.0.0.1:8002` preservado para homologacao interna. O runbook principal esta em `docs/API-SERVER-DEPLOYMENT-PLAN.md`, secao "Marco operacional da producao interna de Iluminacao - 2026-06-12". Qualquer ampliacao do piloto deve preservar o Geoportal publico, manter rollback definido, evitar copia integral de dados, criar migration somente se houver lacuna real e aplicar GRANTs minimos.

## 10. Roadmap

Fases sugeridas:

1. Fase 1: documentacao de autenticacao, autorizacao, modelo de dados auth e endpoints internos.
2. Fase 2: modelo de dados de usuarios, perfis e sessoes, ou decisao tecnica equivalente.
3. Fase 3: migrations de seguranca/autenticacao. Migrations de historico e observacoes ja aplicadas em homologacao e no banco ativo.
4. Fase 4: implementacao de autenticacao no backend com testes.
5. Fase 5: endpoints internos protegidos para historico, observacoes, status e prioridade. Leitura de historico, leitura de observacoes internas, criacao de observacao interna, alteracao normal de status e alteracao de prioridade ja foram validadas no fluxo interno.
6. Fase 6: criar e validar a shell inicial da tela interna minima em homologacao. A shell em `/interno/` ja foi criada como entrada multi-page do Vite, evoluida para portal interno multi-modulo, integrada ao login visual minimo, integrada a listagem somente leitura de Iluminacao, integrada ao detalhe por selecao explicita, integrada a coordenadas, rota Google Maps e mapa simples no detalhe, integrada ao historico somente leitura sob demanda, integrada a leitura e criacao de observacao interna, integrada a alteracao normal de status, integrada a alteracao de prioridade operacional, integrada ao relatorio administrativo sanitizado e integrada ao logout visual. Ela usa cookie HttpOnly, ignora token retornado no corpo do login, nao grava token em `localStorage` ou `sessionStorage`, libera visualmente Iluminacao por `iluminacao.solicitacoes.ler`, chama `GET /api/internal/iluminacao/solicitacoes?limit=20&offset=0` para visao completa e `GET /api/internal/iluminacao/solicitacoes?limit=20&offset=0&ativos=true` para manutencao apos sessao e permissao confirmadas, chama `GET /api/internal/iluminacao/solicitacoes/{id}` apenas para item selecionado da tabela, chama `GET /api/internal/iluminacao/solicitacoes/{id}/historico?limit=20&offset=0` apenas por botao explicito e com permissao `iluminacao.solicitacoes.ver_historico`, chama `GET /api/internal/iluminacao/solicitacoes/{id}/observacoes?limit=20&offset=0` apenas por botao explicito e com permissao `iluminacao.solicitacoes.ver_observacoes`, chama `POST /api/internal/iluminacao/solicitacoes/{id}/observacoes` apenas por formulario explicito, com permissao `iluminacao.solicitacoes.comentar`, chama `PATCH /api/internal/iluminacao/solicitacoes/{id}/status` apenas por caixa explicita de status, com permissao `iluminacao.solicitacoes.atualizar_status`, header mutavel e validacoes de matriz e texto, chama `PATCH /api/internal/iluminacao/solicitacoes/{id}/prioridade` apenas por caixa explicita de prioridade, com permissao `iluminacao.solicitacoes.atualizar_prioridade`, header mutavel e justificativa obrigatoria, chama `GET /api/internal/iluminacao/relatorios/solicitacoes.csv` e `GET /api/internal/iluminacao/relatorios/solicitacoes/resumo` apenas para perfil administrativo/autorizado, e chama `POST /api/internal/auth/logout` apenas pelo botao `Sair`, com limpeza de estado da shell.

A shell continua sem dashboard real, anexos ou correcao/reversao administrativa. O mapa atual e propositalmente simples e fica no detalhe; mapa operacional amplo e dashboard continuam fases futuras. A proxima subfase recomendada e consolidar piloto controlado, monitorar operacao real, validar a listagem compacta de manutencao com `ativos=true` em uso de campo, validar o relatorio administrativo sanitizado em operacao inicial e tratar correcao/reabertura administrativa em contrato separado.
7. Fase 7: auditoria e revisao de seguranca antes de uso por equipe real.
8. Fase 8: mapa interno amplo, relatorios evoluidos e indicadores.

## 10.1. Diagnostico pos-prioridade e proximos passos tecnicos

Diagnostico atual:

- O MVP interno de Iluminacao ja cobre o ciclo operacional minimo: login, sessao, permissoes, listagem, detalhe, historico, observacoes, criacao de observacao, alteracao normal de status, alteracao de prioridade e logout.
- O desenho atual preserva o Geoportal publico porque a shell interna fica em `/interno/`, a API interna fica em `/api/internal/`, e a API publica permanece separada.
- As mutacoes internas existentes usam permissoes especificas, header `X-Geoportal-Internal-Request: 1`, payload restrito, mensagens sanitizadas e auditoria em historico.
- A prioridade foi implementada sem migration porque o schema real ja suportava a coluna, os valores e o evento `alteracao_prioridade`.
- O maior risco daqui para frente nao e adicionar mais botoes; e crescer sem consolidar observabilidade, operacao, rollback e governanca de permissoes.

Proximos passos recomendados, em ordem:

1. **Piloto controlado e observabilidade basica.** Validar o uso com poucos usuarios, registrar erros sem dados sensiveis, revisar logs, confirmar `sessionStorage` vazio e atributos do cookie (`HttpOnly`, `Secure`, `SameSite`) sem copiar valores.
2. **Procedimento operacional.** Documentar como operadores devem usar status, prioridade e observacoes; definir quando usar `urgente`; orientar texto livre sem dados pessoais desnecessarios.
3. **Listagem ativa da manutencao implementada.** O contrato `GET /api/internal/iluminacao/solicitacoes?ativos=true` exclui status terminais pelo backend antes da paginacao. Ausencia do filtro ou `ativos=false` preserva listagem completa para perfis autorizados; a manutencao consome `ativos=true` e a administracao continua sem o filtro.
4. **Relatorio administrativo sanitizado v1 implementado.** O backend agora expoe exportacao CSV e resumo JSON restritos a perfil administrativo/autorizado. A manutencao continua sem acesso ao relatorio. A exportacao nao depende da tabela visivel no frontend; usa consulta backend propria, aceita recorte geral sem datas ou filtros por `data_inicio`, `data_fim`, `status`, `prioridade` e `tipo`, e exclui por padrao nome do solicitante, contato/WhatsApp, observacoes internas livres, descricao livre do cidadao, coordenadas e outros campos com risco LGPD. O contrato local tambem ja cobre nomes de arquivo coerentes para relatorio geral, recorte desde uma data, ate uma data e intervalo fechado, mantendo a shell administrativa alinhada ao backend.

Marco operacional anterior preservado: o contrato `GET /api/internal/iluminacao/solicitacoes?ativos=true` ja foi implementado e validado em servidor; a manutencao consome listagem ativa, o administrador continua sem o filtro, a API interna de producao foi reiniciada/validada, `api/health` local e HTTPS responderam OK, o frontend foi publicado/testado visualmente e o ciclo de testes frontend registrou 26 testes focados, 111 testes totais e build com 233 modulos transformados.
Na validacao visual contra o servidor, um `404` nos endpoints de relatorio deve ser interpretado como indicio de API interna ainda nao atualizada ou restart pendente, e nao como falha do contrato local quando a suite de desenvolvimento confirma as rotas registradas.
5. **Mapa operacional interno completo.** O detalhe ja possui coordenadas, rota Google Maps e mapa simples com marcador. A evolucao ampla deve planejar contrato de dados antes de implementar visualizacao de varios chamados/postes: quais coordenadas mostrar, permissao necessaria, se o mapa usa postes/solicitacoes, como evitar exposicao publica e como degradar se GeoServer/camada falhar.
6. **Dashboard real.** Criar endpoints agregados no backend para indicadores, evitando calculos criticos no frontend. Priorizar chamados ativos, finalizados, por status, por prioridade e por periodo.
7. **Correcao/reabertura administrativa.** Implementar somente como fluxo separado do PATCH normal de status, com permissao propria, justificativa forte, auditoria explicita e bloqueio contra uso acidental.
8. **Anexos/fotos.** Planejar armazenamento, limites, tipos permitidos, verificacao de conteudo, antivirus/validacao, privacidade, retencao, backup e rollback antes de aceitar upload.
9. **Escalabilidade de listagem.** Avaliar filtros, indices e paginacao conforme volume real. Indices por prioridade, status, periodo e poste devem ser guiados por consulta real e plano de execucao, nao por antecipacao.
10. **Administracao interna.** Evoluir telas administrativas de usuarios/perfis com o mesmo padrao: menor privilegio, endpoints pequenos, mutacoes com header interno, sem expor senha/hash/token.
11. **Publicacao da API interna atualizada.** Antes de validar o relatorio administrativo na URL publicada, fazer `push`, `pull` no servidor, executar os testes previstos no harness e reiniciar a API interna correta. Enquanto isso nao ocorrer, um `404` para os endpoints de relatorio no ambiente publicado deve ser lido como atraso de deploy/restart, nao como defeito do contrato local.

Regras para nao quebrar servicos existentes:

- Manter qualquer nova funcionalidade atras de endpoint interno, permissao especifica e testes automatizados.
- Nao alterar `/api/public/...` para atender necessidade operacional interna.
- Nao alterar Apache/proxy ou build base sem checklist de deploy e rollback.
- Nao criar migration sem inventario de schema, backup, validacao em homologacao e plano de reversao.
- Nao duplicar regras criticas apenas no frontend; frontend orienta, backend decide.
- Nao expor coordenadas, dados pessoais, observacoes internas ou historico administrativo no Geoportal publico.

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
