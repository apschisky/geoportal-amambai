# UX e Implantacao Segura do Painel Interno do Geoportal

Este documento define o fluxo de uso, telas conceituais e estrategia de implantacao segura do ambiente interno do Geoportal/SIG Municipal, sem interromper o Geoportal publico existente.

## 1. Objetivo

Planejar a experiencia do futuro portal interno multi-modulo dos servicos municipais, com foco inicial no modulo de Iluminacao Publica / Manutencao de Postes.

O objetivo e garantir que novas funcionalidades internas sejam criadas de forma paralela, segura e reversivel, sem quebrar mapa, camadas, busca, popups, rotas, medicao, geolocalizacao, impressao, mobile ou barra publica do Geoportal atual.

## 1.0. Decisao de UX: Portal Unico Multi-Modulo

O Geoportal Interno deve evoluir como portal unico multi-modulo. A shell inicial em `/interno/` nasceu visualmente focada em Iluminacao Publica porque esse e o primeiro modulo interno, mas a evolucao recomendada e transformar a tela em uma base comum do `Geoportal Interno`, com Iluminacao Publica como modulo ativo.

O layout comum deve prever:

- topo com nome do Geoportal Interno e identificacao de ambiente;
- menu lateral ou superior com modulos permitidos ao usuario;
- area de conteudo para o modulo ativo;
- estados de autenticacao, sessao expirada, sem permissao, carregamento, vazio e erro seguro;
- separacao clara entre area publica e area interna.

O menu deve ser montado conforme permissoes efetivas do usuario autenticado. O frontend pode esconder modulos, menus e botoes para melhorar a experiencia, mas a autorizacao real deve permanecer no backend.

Perfis de leitura geral, como prefeito, gestor geral ou equivalentes, devem poder acessar resumos e indicadores dos modulos permitidos sem receber permissoes operacionais desnecessarias. Usuarios operacionais devem ver apenas o modulo ou os modulos autorizados. A administracao do sistema deve ser area propria, restrita a perfis autorizados.

Registro historico do recorte inicial: dashboard, mapa operacional, endpoints de estatisticas, endpoints de mapa, proxy, producao interna e botao publico de login eram etapas futuras. Posteriormente, proxy e producao interna foram ativados de forma controlada; a shell tambem passou a exibir coordenadas, rota Google Maps e mapa simples no detalhe. Dashboard, mapa operacional amplo e endpoints agregados continuam fora do MVP.

## 1.1. Recorte da Primeira Tela Interna Minima

Esta etapa e exclusivamente documental/estrategica. Nao implementa codigo, frontend, endpoint, migration, schema, proxy, producao interna, `.env`, NSSM, usuario, perfil, permissao real, role ou GRANT.

A primeira tela interna minima do modulo de Iluminacao Publica deve ser planejada inicialmente para homologacao, consumindo o runtime interno `GeoportalAPIInternaHomologacao` em `127.0.0.1:8002`, sem exposicao publica e sem producao interna. Apache/proxy publico, Geoportal publico e API publica permanecem inalterados.

A tela minima deve consumir somente endpoints internos ja implementados, testados, aplicados em homologacao interna e documentados:

- `GET /api/internal/iluminacao/solicitacoes`;
- `GET /api/internal/iluminacao/solicitacoes/{id}`;
- `GET /api/internal/iluminacao/solicitacoes/{id}/historico`;
- `GET /api/internal/iluminacao/solicitacoes/{id}/observacoes`;
- `POST /api/internal/iluminacao/solicitacoes/{id}/observacoes`;
- `PATCH /api/internal/iluminacao/solicitacoes/{id}/status`.

Funcionalidades planejadas para a primeira tela minima:

- login interno usando o fluxo de autenticacao ja existente;
- listagem de solicitacoes;
- filtros basicos por protocolo, status, tipo, prioridade, poste e periodo;
- detalhe da solicitacao;
- historico interno somente leitura;
- observacoes internas com leitura e criacao;
- alteracao normal de status usando o `PATCH` ja existente;
- tratamento seguro de erros;
- mensagens amigaveis para carregamento, vazio, sem permissao, sessao expirada, falha tecnica e operacao concluida;
- preservacao da API publica.

A primeira versao nao deve incluir:

- correcao/reversao administrativa de status;
- saida de status terminal;
- anexos;
- upload de foto;
- dashboard;
- estatisticas;
- gestao de usuarios;
- gestao de permissoes;
- edicao de dados pessoais;
- exclusao ou soft delete;
- nova rota no Apache/proxy;
- producao interna.

A decisao de excluir dashboard, estatisticas e anexos da primeira tela minima reduz escopo, evita criacao de novos endpoints e preserva a validacao incremental ja feita no backend. O mapa operacional completo permanece objetivo futuro; se a primeira tela exibir coordenadas ou uma visualizacao simples, ela deve usar apenas latitude/longitude ja retornadas pelos endpoints existentes e nao deve bloquear o aceite minimo.

Correcao ou reversao administrativa de status sera fluxo futuro separado, muito controlado, com justificativa obrigatoria, permissao especifica restrita a poucos perfis autorizados, auditoria propria e regra no backend. Essa regra nao deve ser duplicada livremente no frontend. O frontend pode orientar a UX, ocultar acoes e explicar transicoes permitidas, mas a validacao real permanece na API.

Anexos, upload de fotos, dashboard, estatisticas, proxy/Apache e producao interna ficam para etapas posteriores, com contrato, permissoes, GRANTs e validacoes proprias.

## 2. Principio de nao interrupcao

- O Geoportal publico deve continuar online.
- Novas funcionalidades devem ser criadas em paralelo.
- Nenhuma alteracao deve quebrar mapa, camadas, busca, popups, rotas, medicao, geolocalizacao, impressao, mobile ou barra publica.
- O Google Forms atual de postes pode continuar como fallback ate o modulo proprio estar validado.
- Toda integracao nova deve ter rollback.
- Publicacoes internas devem ser testadas antes de qualquer mudanca no fluxo publico.

## 3. Separacao entre publico, interno e API

### Opcao A - rotas no mesmo dominio

- `geoportal.amambai.ms.gov.br/` para publico.
- `geoportal.amambai.ms.gov.br/interno` para ambiente interno.
- `geoportal.amambai.ms.gov.br/api` para API.

Esta e a decisao preliminar recomendada para a primeira homologacao, por simplicidade operacional, menor complexidade inicial de DNS/certificado e menor risco de CORS.

### Opcao B - subdominios futuros

- `geoportal.amambai.ms.gov.br` para publico.
- `interno.geoportal.amambai.ms.gov.br` para ambiente interno.
- `api.geoportal.amambai.ms.gov.br` para API.

Subdominios continuam como alternativa futura se a arquitetura exigir maior separacao operacional. A decisao final deve considerar Apache, Tomcat, FastAPI, HTTPS, CORS, certificados, firewall, proxy reverso e seguranca antes da prova de conceito.

## 4. Ambientes recomendados

- **Producao publica atual**: Geoportal publico online, mantido estavel.
- **Homologacao**: ambiente para testar banco, API, painel interno e integracoes.
- **Ambiente interno futuro**: painel autenticado para servidores e setores.
- **API futura**: servico separado para regras de negocio, validacao, auditoria e integracao com PostGIS.

Homologacao deve ser usada antes de qualquer alteracao em producao.

## 5. Fluxo operacional do modulo de Iluminacao Publica

1. Cidadao solicita reparo pelo Geoportal publico.
2. Sistema gera protocolo.
3. Solicitacao aparece no painel interno.
4. Atendente/equipe de manutencao faz triagem, junto com secretario ou chefe de setor quando necessario.
5. Equipe de campo executa.
6. Servidor atualiza status.
7. Gestor acompanha indicadores.
8. Cidadao consulta protocolo.
9. Dados publicos sao exibidos apenas de forma controlada.

## 6. Telas conceituais do ambiente interno

### Login

- Usuario/senha.
- Recuperacao futura.
- Mensagem de erro segura.
- HTTPS obrigatorio.
- Bloqueio ou protecao contra tentativas suspeitas.

### Painel inicial

- Resumo de solicitacoes abertas.
- Urgentes.
- Em execucao.
- Vencidas.
- Finalizadas no periodo.
- Fica fora da primeira tela minima; entra em etapa futura de dashboard/indicadores.
- A tela inicial futura do portal deve mostrar cards apenas dos modulos permitidos ao usuario.
- Gestores gerais podem ter resumo consolidado de varios modulos, preferencialmente em modo leitura.

### Lista de solicitacoes

- Tabela paginada.
- Filtros por status, periodo, tipo, prioridade, bairro/regiao, `poste_id` e protocolo.
- Ordenacao.
- Busca rapida.
- Decisao inicial: a lista de solicitacoes e suficiente para a primeira versao, desde que integrada ao mapa operacional.

### Mapa operacional

- Solicitacoes abertas.
- Em execucao.
- Resolvidas.
- Filtros por status/periodo.
- Destaque de reincidencia.
- Cores por status.
- Visualizacao de postes/solicitacoes em diferentes estados.
- Sem dados pessoais no mapa publico.
- Para a primeira tela minima, o mapa operacional completo nao e requisito obrigatorio. Uma visualizacao simples pode ser avaliada se consumir apenas latitude/longitude ja retornadas pelos endpoints existentes, sem novo endpoint e sem exposicao publica.
- Para Iluminacao, o mapa interno futuro deve exibir postes e solicitacoes por status, com cores por fase.
- Clique em poste ou solicitacao deve abrir detalhe operacional conforme permissao.
- A tela futura pode oferecer rota pelo Google Maps ate o poste, sem expor dados pessoais indevidos.
- Se o mapa exigir endpoint novo, camada interna, GeoServer interno ou view controlada, isso deve ser planejado em etapa propria.

### Detalhe da solicitacao

- Protocolo.
- `poste_id`.
- Localizacao.
- Tipo de problema.
- Descricao.
- Status.
- Historico.
- Observacoes internas.
- Acoes permitidas conforme perfil.
- Anexos ficam para etapa posterior.

### Alteracao de status

- Status novo.
- Observacao obrigatoria em qualquer alteracao de status normal.
- Confirmacao antes de finalizar/cancelar.
- Auditoria obrigatoria.
- A primeira tela deve usar apenas o `PATCH /api/internal/iluminacao/solicitacoes/{id}/status` normal ja existente.
- Correcao/reversao administrativa e saida de status terminal nao entram no fluxo normal.

### Anexos

- Upload controlado.
- Foto antes/depois.
- Restricao de tipo/tamanho.
- Visualizacao apenas para perfis autorizados.
- Fora da primeira tela minima.

### Indicadores

- Solicitacoes por status.
- Solicitacoes por tipo.
- Reincidencia por poste.
- Solicitacoes por regiao.
- Atrasadas, com alerta inicial para mais de 15 dias paradas.
- Finalizadas no periodo.
- Periodo de analise mais usado: semanal.
- Fora da primeira tela minima.

## 7. Permissoes por tela

| Tela | Atendente | Equipe de campo | Gestor | Admin | Auditor |
|---|---|---|---|---|---|
| Login | Sim | Sim | Sim | Sim | Sim |
| Painel inicial | Sim se acumulado com campo | Sim | Sim | Sim | Sim |
| Lista de solicitacoes | Sim se acumulado com campo | Sim | Sim | Sim | Sim |
| Mapa operacional | Sim se acumulado com campo | Sim | Sim | Sim | Sim |
| Detalhe da solicitacao | Sim se acumulado com campo | Sim | Sim | Sim | Sim |
| Alteracao de status | Sim se acumulado com campo | Sim | Sim | Sim | Nao |
| Anexos | Nao ou acumulado com campo | Sim | Sim | Sim | Nao |
| Indicadores | Nao ou limitado | Nao ou limitado | Sim | Sim | Sim |
| Administracao | Nao | Nao | Nao ou limitado | Sim | Nao |

O front-end pode ocultar botoes conforme perfil, mas a API deve validar permissao no servidor.

## 8. Estados de interface

- Carregando.
- Sem registros.
- Erro de conexao.
- Sem permissao.
- Sessao expirada.
- Operacao concluida.
- Operacao negada.
- Falha ao salvar.
- Fallback temporario.

Cada estado deve ter mensagem clara, sem detalhes tecnicos sensiveis.

## 9. Estrategia de implantacao sem quebrar o Geoportal publico

1. Documentacao e validacao de fluxo.
2. Homologacao de banco.
3. Homologacao de API.
4. Homologacao de painel interno.
5. Teste com dados ficticios.
6. Teste com usuarios do setor.
7. Publicacao interna restrita.
8. Integracao opcional com botao publico.
9. Manter Google Forms como fallback temporario.
10. Retirada do fallback apenas apos estabilidade comprovada, com validacao final do Prefeito.

Decisao inicial de transicao: o setor aceita testar primeiro internamente. Se for facil retornar ao Google Forms em caso de inconsistencia, a troca do botao publico pode ocorrer apos testes controlados.

## 10. Pontos de configuracao de infraestrutura

Itens a decidir:

- rotas de homologacao e possivel evolucao para subdominios;
- Apache reverse proxy;
- Tomcat/GeoServer existente;
- FastAPI rodando como servico separado;
- HTTPS/certificado;
- CORS;
- firewall;
- portas expostas;
- logs;
- backup;
- rollback;
- monitoramento.

Este documento nao implementa configuracao. Ele apenas registra decisoes futuras.

## 11. Riscos

- Quebrar servico publico.
- Expor endpoint interno.
- CORS mal configurado.
- Login sem protecao adequada.
- Permissoes excessivas.
- Dados pessoais no mapa publico.
- Anexos inseguros.
- Falta de rollback.
- Falta de homologacao.
- Misturar fluxo publico com fluxo interno cedo demais.
- Confiar no frontend como autoridade de permissao.
- Expor dados pessoais em dashboard ou mapa sem necessidade operacional.
- Criar endpoints de estatisticas ou mapa sem contrato, permissao, auditoria e revisao de seguranca.

## 12. Criterios para avancar para implementacao

- [ ] Fluxo validado com setor.
- [ ] Telas conceituais aprovadas.
- [ ] Perfis aprovados.
- [ ] Status aprovados.
- [ ] Ambiente de homologacao definido.
- [ ] Estrategia de rotas de homologacao definida, com subdominios como evolucao possivel.
- [ ] Politica de anexos definida.
- [ ] Banco/schema aprovado.
- [ ] API desenhada.
- [ ] Rollback planejado.
- [ ] Fallback definido.

## 12.1. Sequencia Sugerida para a Primeira Tela Minima

1. Revisar documentacao e validar o recorte funcional com o setor.
2. Desenhar wireframe simples da listagem, detalhe e acoes permitidas.
3. Criar estrutura minima da rota/tela interna em homologacao, sem expor publicamente.
4. Implementar cliente de API interno sem segredo no frontend.
5. Implementar listagem e filtros por protocolo, status, tipo, prioridade, poste e periodo.
6. Implementar detalhe da solicitacao.
7. Implementar historico interno e observacoes internas em leitura.
8. Implementar criacao de observacao interna.
9. Implementar alteracao normal de status com o PATCH existente.
10. Executar build/testes do frontend e validar que a API publica continua saudavel.
11. Validar manualmente no runtime interno de homologacao.
12. Somente depois avaliar proxy/Apache e producao interna em etapa separada.

## 12.2. Criterios de Aceite da Primeira Tela Minima

- API publica preservada.
- Rotas internas consumidas apenas com sessao e permissoes adequadas.
- Nenhum token, cookie, segredo, senha, hash, `session_secret` ou `DATABASE_URL` exposto no frontend.
- Erros tecnicos tratados com mensagens sanitizadas e amigaveis.
- Nenhuma alteracao de producao, Apache/proxy, migrations, schema, `.env` ou NSSM.
- Acoes mutaveis respeitam permissao e header mutavel conforme contrato do backend.
- Historico interno e observacoes internas nao aparecem em consulta publica.
- Correcao/reversao administrativa de status nao esta disponivel na tela minima.
- Saida de status terminal permanece bloqueada pelo backend.
- Anexos, dashboard, estatisticas, gestao administrativa e producao interna permanecem fora do escopo.

## 12.3. Checklist Local da Shell Inicial em `/interno/`

A Fase 1 criou uma shell frontend isolada da primeira tela interna minima em `/interno/`, com entrada multi-page no Vite. Esta shell e apenas estrutural: nao consome API interna, nao implementa login real, nao manipula cookie ou token, nao executa `POST` ou `PATCH` e nao carrega dados reais.

Arquivos da shell:

- `geoportal-vite/interno/index.html`;
- `geoportal-vite/src/internal-iluminacao-shell.js`;
- `geoportal-vite/src/internal-iluminacao-shell.css`.

Validacao local sugerida:

1. Entrar no diretorio do frontend:

```powershell
cd "C:\Users\COMPRAS\OneDrive\Documentos\Anderson\Pos Geo\TCC\geoportal_site\30-05-25\geoportal-vite"
```

2. Rodar build e preview:

```powershell
npm.cmd run build
npm.cmd run preview
```

3. Abrir o Geoportal publico no preview:

```text
http://localhost:4173/
```

4. Abrir a tela interna:

```text
http://localhost:4173/interno/
```

5. Validar que a tela interna exibe:

- titulo `Geoportal Interno - Iluminacao Publica`;
- aviso de homologacao;
- login apenas como placeholder/desabilitado;
- filtros desabilitados;
- listagem sem dados reais;
- placeholders de detalhe, historico, observacoes e alteracao de status;
- aviso de que nenhuma acao real e executada nesta fase.

6. Validar no DevTools/Network que nao ha chamadas para:

- `/api/internal`;
- `/api/internal/auth/me`;
- `/api/internal/iluminacao/solicitacoes`;
- endpoints `POST` ou `PATCH`.

7. Validar que o Geoportal publico continua funcionando:

- mapa carrega;
- camadas continuam disponiveis;
- busca, painel de camadas e barra publica nao foram alterados;
- nao ha redirecionamento indevido para `/interno/`.

8. Registrar que login real, sessao, cookies, API interna, `POST` observacao e `PATCH` status ficam para fases posteriores.

Validacao pratica registrada em desenvolvimento local:

- `http://localhost:5195/interno/` abriu corretamente sem exigir `/interno/index.html`;
- `http://localhost:5195/interno/index.html` tambem abriu corretamente;
- a tela exibiu a shell `Geoportal Interno - Iluminacao Publica`, aviso de homologacao e placeholders de login, filtros, listagem, detalhe, historico, observacoes e alteracao de status;
- nao houve login real, consumo de API interna, cookie/token real, `POST` ou `PATCH`;
- no DevTools/Network, a shell carregou apenas recursos estaticos do Vite, como `interno/`, client de desenvolvimento, `internal-iluminacao-shell.js`, `env.mjs`, `internal-iluminacao-shell.css`, websocket de HMR e assets inline;
- o `101 websocket` e esperado no `npm run dev`, por causa do hot reload do Vite;
- respostas `304` sao esperadas por cache/revalidacao de arquivos estaticos;
- nao houve chamada para `/api/internal`, `/api/internal/auth/me`, `/api/internal/iluminacao/solicitacoes` ou endpoints `POST`/`PATCH`;
- o Geoportal publico abriu normalmente em desenvolvimento, com mapa, camadas, busca, painel e barra publica preservados;
- o fluxo publico de solicitacao de Iluminacao abriu o formulario, mas o pedido nao foi finalizado para evitar criar registro real, ja que o fluxo publico esta em producao;
- nenhuma acao real foi executada pela shell interna.

Proxima fase recomendada: integrar de forma incremental login/sessao ou listagem interna, ainda sem acoes mutaveis, conforme decisao posterior. `POST` observacao e `PATCH` status devem continuar desabilitados na tela ate a fase especifica de integracao autenticada e validada.

Antes de integrar login real ou listagem real, recomenda-se evoluir a shell para representar visualmente o portal interno multi-modulo:

- titulo geral `Geoportal Interno`;
- Iluminacao Publica como modulo ativo;
- menu com modulos planejados, como Iluminacao, Alvaras, Viabilidade, Meio Ambiente e Limpeza de Lotes;
- placeholders de resumo inicial e modulos futuros;
- estados visuais de autenticacao e permissao;
- sem API real, sem `POST`, sem `PATCH` e sem acoes mutaveis nessa etapa visual.

Registro de implementacao visual: a Fase 2A evoluiu a shell em `/interno/` para representar o `Geoportal Interno` como portal unico multi-modulo, com Iluminacao Publica como modulo ativo, menu planejado de modulos, placeholders de resumo inicial e estados visuais de autenticacao/permissao. A shell continua sem API real, sem login real, sem cookie/token, sem `POST`, sem `PATCH`, sem dados reais e sem alterar o Geoportal publico.

## 12.4. Contrato planejado de sessao e permissoes da shell `/interno/`

O contrato desta secao foi usado na primeira integracao real da shell `/interno/` com autenticacao no commit `a6849dd`. A integracao ficou limitada a `GET /api/internal/auth/me`, sem implementar login real, sem chamar `/api/internal/auth/login`, sem manipular token manualmente, sem usar `localStorage` ou `sessionStorage` para token e sem executar `POST` ou `PATCH`.

A verificacao de sessao existente com `GET /api/internal/auth/me` deve continuar sendo a unica chamada real da shell ate a validacao ponta a ponta em ambiente controlado. Listagem real, detalhe real, observacoes, alteracao de status, dashboard, mapa operacional, proxy, producao interna e botao de login no Geoportal publico permanecem fora desta etapa.

Objetivos do `GET /api/internal/auth/me` para a shell:

- descobrir se existe sessao valida;
- carregar dados minimos do usuario autenticado;
- carregar permissoes efetivas;
- carregar modulos acessiveis;
- apoiar estados visuais de sessao e permissao;
- montar menu interno por permissao retornada pelo backend.

O frontend pode ocultar menus e botoes conforme permissao, mas a autorizacao real permanece no backend. Qualquer rota interna de negocio deve continuar validando sessao, feature flag e `require_permission(...)` no backend, independentemente do que a shell renderizar.

Estados recomendados para a interface:

- `checking_session`: exibido enquanto a sessao esta sendo verificada.
- `unauthenticated`: usado quando nao ha sessao valida ou a sessao nao pode ser confirmada.
- `authenticated`: usado quando a sessao e valida e as permissoes foram carregadas.
- `forbidden`: usado quando o usuario esta autenticado, mas nao possui permissao para o modulo ou recurso.
- `expired`: usado quando a sessao expirou ou foi invalidada.
- `technical_error`: usado para erro tecnico seguro, sem detalhes internos.

Tratamento recomendado por HTTP:

- `200`: sessao valida; montar menu e modulos com base nas permissoes retornadas.
- `401`: exibir necessidade de login, sem revelar motivo especifico.
- `403`: exibir acesso negado para modulo ou recurso.
- `429`: exibir mensagem temporaria de excesso de tentativas, se aplicavel.
- `503`: exibir indisponibilidade temporaria, sem SQL, stack trace, host, role, segredo ou `DATABASE_URL`.
- Erro de rede: informar falha temporaria de conexao com o servico interno.

Contrato real usado pela primeira integracao da shell, sem dados reais nesta documentacao:

```json
{
  "authenticated": true,
  "usuario_id": 1,
  "permissoes": [
    "iluminacao.solicitacoes.ler"
  ]
}
```

A shell deve validar esse contrato real e nao deve esperar `usuario.nome`, `usuario.login`, `sessao.expira_em` ou `modulos`, porque esses campos ainda nao fazem parte de `GET /api/internal/auth/me`.

Resposta conceitual futura, se o backend evoluir o contrato em etapa propria:

```json
{
  "usuario": {
    "id": "identificador seguro",
    "login": "login do usuario",
    "nome": "nome exibivel, se permitido"
  },
  "sessao": {
    "expira_em": "timestamp"
  },
  "permissoes": [
    "iluminacao.solicitacoes.ler"
  ],
  "modulos": [
    {
      "chave": "iluminacao",
      "nome": "Iluminacao Publica"
    }
  ]
}
```

Regras de seguranca para a futura implementacao:

- preferir sessao opaca no backend transportada por cookie `HttpOnly`;
- usar `Secure` conforme ambiente e obrigatorio em producao;
- usar `SameSite` adequado;
- manter expiracao, logout e revogacao;
- nunca persistir token bruto no banco;
- nunca registrar token bruto, cookie, hash, senha, `session_secret` ou `DATABASE_URL`;
- nunca guardar token em `localStorage` ou `sessionStorage`;
- considerar protecao CSRF ou mecanismo equivalente para acoes mutaveis futuras com cookie;
- manter `X-Geoportal-Internal-Request: 1` nas rotas mutaveis internas conforme contrato do backend.

Mapeamento inicial de permissoes para UX:

- `iluminacao.solicitacoes.ler` permite exibir o modulo Iluminacao Publica.
- Permissoes como `iluminacao.solicitacoes.ver_historico`, `iluminacao.solicitacoes.ver_observacoes`, `iluminacao.solicitacoes.comentar` e `iluminacao.solicitacoes.atualizar_status` devem controlar botoes e secoes futuras dentro do modulo, mas o backend continua sendo a autoridade.
- Permissoes administrativas como `admin.usuarios.ler` podem exibir Administracao do Sistema, se a etapa de UX decidir mostrar esse modulo.
- Permissoes futuras de dashboard/indicadores podem habilitar cards de resumo sem conceder acoes operacionais.

Riscos e controles:

- Token em `localStorage` ou `sessionStorage`: evitar armazenamento de token no frontend.
- Frontend virar autoridade de permissao: backend deve validar sempre.
- Menu ou botao visivel indevidamente: backend deve bloquear acesso indevido mesmo que o frontend erre.
- Vazamento tecnico em erro: mensagens devem ser sanitizadas.
- Mistura entre runtime publico e interno: manter separacao publico/interno ja documentada.
- Login no Geoportal publico cedo demais: deixar botao publico de login para etapa futura, depois de proxy, producao interna, logs e rollback.
- CSRF em mutaveis futuros com cookie: exigir protecao apropriada antes de `POST` ou `PATCH`.
- Sessao expirada confusa: usar estado visual claro e retorno seguro ao futuro login.

## 12.5. Validacao operacional da integracao `GET /api/internal/auth/me`

A shell interna `/interno/` implementada no commit `a6849dd` chama somente `GET /api/internal/auth/me`, usa `credentials: "include"` e valida o contrato real do backend: `authenticated`, `usuario_id` e `permissoes`. Ela nao implementa login, nao chama `/api/internal/auth/login`, nao armazena token, nao usa `localStorage` ou `sessionStorage` para token, nao executa `POST` ou `PATCH`, nao carrega listagem, dashboard ou mapa e preserva o Geoportal publico.

Validacao frontend local em desenvolvimento:

- em `npm run dev`, a pagina `/interno/` tentou `GET /api/internal/auth/me`;
- como o Vite local nao possui backend/proxy interno ativo, a chamada retornou `404`;
- esse `404` local e esperado nesse ambiente e confirma que a shell tentou a rota correta;
- no DevTools/Network foi confirmado que nao houve chamada para `/api/internal/auth/login`, endpoints de Iluminacao, `POST` ou `PATCH`.

Validacao backend no servidor de homologacao interna:

- codigo atualizado no servidor em `C:\apps\geoportal-api\backend\geoportal-amambai`;
- branch `main` alinhada com `origin/main`, working tree limpo e commit atual `a6849dd`;
- servico `GeoportalAPIInternaHomologacao` reiniciado e validado na porta `8002`;
- `/api/health` retornou OK;
- `/api/version` retornou OK com `environment=homologacao`;
- `/api/internal/auth/me` sem sessao retornou `401 Unauthorized` com corpo vazio.

Conclusoes da validacao:

- o backend interno de homologacao esta saudavel;
- o endpoint `/api/internal/auth/me` existe e esta protegido;
- sem sessao, o endpoint retorna `401`, como esperado;
- a shell local chama a rota correta;
- o `404` local no Vite e esperado enquanto nao houver proxy/backend interno local;
- ainda falta validacao ponta a ponta da shell em ambiente que consiga alcancar o backend interno real;
- Apache/proxy publico e producao permanecem inalterados;
- nao se deve avancar para listagem de solicitacoes antes da validacao ponta a ponta de sessao.

Situacao operacional atualizada: `GeoportalAPIInternaHomologacao` permanece ativo em `127.0.0.1:8002` para homologacao interna, e `GeoportalAPIInternaProducao` esta ativo em `127.0.0.1:8003` para producao interna. O Apache HTTPS `/api/internal/` aponta para `8003`, sem expor diretamente as portas internas na rede. O registro anterior de validacao em `8002` permanece como historico de homologacao.

Proxima decisao tecnica recomendada: manter o piloto controlado, validar periodicamente `/interno/` contra `/api/internal/auth/me` real, preservar rollback de `/api/internal/` para `8002` se necessario e confirmar que login, listagem, detalhe, historico, observacoes, status, prioridade e logout continuam sem expor portas internas diretamente.

Registro de integracao de desenvolvimento: apos a validacao do proxy Apache real para `https://geoserver.amambai.ms.gov.br/api/internal/`, o Vite local pode usar proxy apenas em `npm run dev` para encaminhar `/api/internal/` ao dominio HTTPS de homologacao. Essa configuracao serve somente para validar a shell local `/interno/` chamando `GET /api/internal/auth/me` por caminho relativo; nao altera build de producao, nao cria login, nao chama listagem, nao habilita `POST`/`PATCH` e nao armazena token.

Validacao manual autenticada em homologacao via proxy HTTPS real:

- `POST /api/internal/auth/login` foi testado manualmente contra `https://geoserver.amambai.ms.gov.br/api/internal/auth/login` e retornou `LOGIN_STATUS=200`;
- na mesma sessao PowerShell, `GET /api/internal/auth/me` retornou `ME_STATUS=200`, `AUTHENTICATED=True`, `USUARIO_ID=7`, `PERMISSOES_COUNT=15` e `TEM_ILUMINACAO_LER=True`;
- a validacao confirma que o login interno funciona via proxy HTTPS real, que a sessao/cookie foi aceito no `/me` seguinte e que a base tecnica para liberar o modulo Iluminacao Publica por `iluminacao.solicitacoes.ler` esta validada em homologacao;
- nenhum token, cookie real, senha, hash, `session_secret` ou `DATABASE_URL` foi registrado;
- a shell ainda nao implementa login visual, listagem de solicitacoes, `POST` ou `PATCH`.

Decisao sobre login visual:

- o Geoportal publico deve continuar separado da logica de autenticacao interna;
- futuramente, a tela publica pode oferecer um link simples como `Entrar`, `Acesso interno` ou `Geoportal Interno`, redirecionando para `/interno/`;
- a primeira implementacao do formulario de login deve ocorrer dentro da shell interna `/interno/`, nao como popup acoplado ao mapa publico;
- a shell interna deve primeiro chamar `GET /api/internal/auth/me`; em `401`, mostrar formulario de login interno; depois chamar `POST /api/internal/auth/login`, ignorar o token retornado no corpo, depender do cookie HttpOnly, chamar `/me` novamente e montar menu/modulos por permissoes;
- o Geoportal publico nao deve manipular token, cookie, senha ou estado de sessao interna diretamente;
- popup de login na tela publica pode ser reavaliado futuramente apenas como decisao de UX, mas nao deve ser a primeira implementacao.

Registro de implementacao: a fase de login visual minimo em `/interno/` implementa formulario interno somente quando `/api/internal/auth/me` retorna `401`. O submit chama apenas `POST /api/internal/auth/login` com `credentials: "include"`, ignora o corpo da resposta de login, nao usa token, nao grava `localStorage` ou `sessionStorage`, limpa o campo de senha apos a tentativa e confirma a autenticacao chamando novamente `/api/internal/auth/me`. A shell continua sem listagem, dashboard, mapa, observacoes, alteracao de status, logout completo ou `POST`/`PATCH` de Iluminacao.

Hardening visual posterior: a shell deixa de exibir a lista completa de strings tecnicas de permissoes retornadas por `/me`. As permissoes continuam sendo usadas internamente para derivar menu, modulos e capacidades visuais, mas a interface comum mostra apenas resumo seguro: sessao autenticada, usuario interno, quantidade de permissoes carregadas, modulos permitidos e aviso de que a autorizacao real permanece no backend.

Marco implementado: no commit `a6269d2`, a shell autenticada `/interno/` passou a consumir a primeira listagem real somente leitura de Iluminacao Publica. A chamada permitida e `GET /api/internal/iluminacao/solicitacoes?limit=20&offset=0`, sempre com `credentials: "include"` e somente apos sessao confirmada por `/api/internal/auth/me`, payload valido e permissao `iluminacao.solicitacoes.ler`.

A tabela inicial exibe apenas campos minimos nao pessoais: protocolo, status, tipo de problema, prioridade, poste, datas de criacao/atualizacao quando presentes e indicacao de duplicidade suspeita. Ela nao deve exibir nome ou contato do solicitante, descricao, observacoes de localizacao, ponto de referencia, poste proximo informado, latitude ou longitude.

Validacao registrada para o marco historico da listagem: `npm.cmd run build` passou, `npm.cmd test` passou com 85 testes, `git diff --check` nao apontou erros alem dos avisos normais LF/CRLF do Windows, e a validacao visual confirmou login, `/me` 200, listagem GET 200 e ausencia de chamadas mutaveis. Naquela fase, detalhe, historico, observacoes, alteracao de status, dashboard real, mapa operacional e anexos continuavam desabilitados ou reservados a fases futuras. Etapas posteriores ja integraram detalhe, historico, observacoes, status, prioridade, coordenadas, rota e mapa simples. Nao ha token em `localStorage` ou `sessionStorage`, o backend continua sendo a autoridade de autorizacao e o Geoportal publico permanece preservado.

Marco implementado: no commit `6c4ce39`, a shell interna passou a oferecer painel de detalhe somente leitura acionado explicitamente pela tabela. A chamada permitida e `GET /api/internal/iluminacao/solicitacoes/{id}`, sempre com `credentials: "include"` e somente apos sessao autenticada, `/me` valido, permissao `iluminacao.solicitacoes.ler` e selecao explicita de uma solicitacao da listagem. O painel exibe dados operacionais do detalhe em secoes de identificacao, origem/localizacao operacional, dados do solicitante, descricao, datas e acoes futuras. A tabela continua sem nome, contato, descricao, observacoes de localizacao, ponto de referencia, poste proximo informado, latitude ou longitude.

Restricoes mantidas naquela fase de detalhe: coordenadas nao apareciam no painel comum; JSON bruto nao era exibido; nao havia chamada para historico, observacoes ou status; nao havia `POST` ou `PATCH` de Iluminacao; nao havia token em `localStorage` ou `sessionStorage`; o backend continuava sendo a autoridade de autorizacao; o menu/permissoes da interface eram apenas orientacao visual; e o Geoportal publico permanecia preservado. Etapas posteriores ja integraram coordenadas, rota e mapa simples no detalhe.

Validacao registrada para este marco: `npm.cmd run build` passou, `npm.cmd test` passou com 85 testes, `git diff --check` nao apontou erros alem dos avisos normais LF/CRLF do Windows, e a validacao visual confirmou login, `/me` 200, listagem GET 200 e detalhe GET 200. A aba Network mostrou apenas chamadas GET de listagem e detalhe para Iluminacao, sem chamadas mutaveis.

Marco implementado: no commit `31d70b2`, a shell interna passou a permitir consulta de historico somente leitura sob demanda no painel de detalhe. A chamada permitida e `GET /api/internal/iluminacao/solicitacoes/{id}/historico?limit=20&offset=0`, sempre com `credentials: "include"` e somente apos sessao autenticada, `/me` valido, detalhe carregado, identificador valido, permissao `iluminacao.solicitacoes.ver_historico` e acao explicita do usuario pelo botao `Ver historico`.

O historico nao carrega automaticamente ao abrir o detalhe. A resposta paginada e exibida como timeline somente leitura, com tratamento seguro para `401`, `403`, `404`, `422` e `503`. Campos operacionais sensiveis do historico, como usuario interno e `observacao_resumida`, devem continuar tratados com cuidado visual, sem JSON bruto, sem console e sem exposicao na consulta publica.

Validacao registrada para este marco: `npm.cmd run build` passou, `npm.cmd test` passou com 85 testes, `git diff --check` nao apontou erros alem dos avisos normais LF/CRLF do Windows, e a validacao visual confirmou login, `/me` 200, listagem GET 200, detalhe GET 200 e historico GET 200 apos clique explicito. A aba Network mostrou o historico com status 200, sem chamadas para observacoes e sem `POST` ou `PATCH` de Iluminacao.
Marco implementado: no commit `3d127cf`, a shell interna passou a permitir consulta de observacoes internas somente leitura sob demanda. A chamada permitida e `GET /api/internal/iluminacao/solicitacoes/{id}/observacoes?limit=20&offset=0`, sempre com `credentials: "include"` e somente apos sessao autenticada, `/me` valido, detalhe carregado, identificador valido, permissao `iluminacao.solicitacoes.ver_observacoes` e acao explicita do usuario pelo botao `Ver observacoes`.

As observacoes nao carregam automaticamente ao abrir o detalhe. A resposta e paginada e exibida como lista/cards somente leitura. A shell trata `401`, `403`, `404`, `422` e `503` com mensagens sanitizadas. A observacao e texto livre operacional interno e deve continuar sendo tratada com cuidado. Nesta fase nao ha formulario de criacao de observacao, nao ha `POST` de observacao e nao ha `PATCH` de Iluminacao. O backend continua sendo a autoridade de autorizacao. O menu/permissoes da interface sao apenas orientacao visual. O Geoportal publico permanece preservado.

Marco implementado: no commit `7ccb724`, a shell interna passou a permitir criacao de observacao interna a partir do formulario explicito de detalhe. A chamada permitida e `POST /api/internal/iluminacao/solicitacoes/{id}/observacoes`, sempre com `credentials: "include"`, `Content-Type: application/json`, `Accept: application/json`, header `X-Geoportal-Internal-Request: 1` e payload restrito a `{ observacao: textoTrimado }`. A criacao ocorre somente apos sessao autenticada, `/me` valido, detalhe carregado, identificador valido, permissao `iluminacao.solicitacoes.comentar` e acao explicita do usuario.

A validacao frontend aplica trim, minimo de 3 caracteres, maximo de 2000 caracteres, bloqueio de envio invalido e protecao contra duplo envio. Depois do `201 Created`, o campo e limpo e a lista de observacoes e recarregada por GET. Leitura e escrita de observacoes permanecem visualmente separadas. A criacao nao altera status, prioridade, `finalizado_em` ou dados principais da solicitacao, e nao ha `PATCH` nesta fase. O backend grava a observacao e o evento resumido no historico na mesma transacao. O Geoportal publico permanece preservado.

Marco implementado: no commit `b860c5d`, a shell interna passou a permitir alteracao normal de status a partir da caixa explicita de detalhe. A chamada permitida e `PATCH /api/internal/iluminacao/solicitacoes/{id}/status`, sempre com `credentials: "include"`, `Content-Type: application/json`, `Accept: application/json`, header `X-Geoportal-Internal-Request: 1` e payload restrito a `{ status, observacao }`. A alteracao ocorre somente apos sessao autenticada, `/me` valido, detalhe carregado, identificador valido, permissao `iluminacao.solicitacoes.atualizar_status` e acao explicita do usuario.

A validacao frontend exige status novo permitido pela matriz, status novo diferente do atual, observacao trimada, minimo de 3 caracteres, maximo de 1000 caracteres, bloqueio de envio invalido e protecao contra duplo envio. Status terminal bloqueia a alteracao normal na interface. Depois do `200 OK`, o detalhe e a listagem sao recarregados, o historico e recarregado somente se ja estava aberto e as observacoes nao sao recarregadas por causa do `PATCH`. O fluxo nao envia prioridade, nao envia campos extras, nao altera prioridade, nao cria observacao separada e nao modifica dados principais da solicitacao. O backend grava o evento de alteracao de status no historico na mesma transacao. O Geoportal publico permanece preservado.

Marco implementado: a shell interna passou a permitir alteracao de prioridade operacional a partir de caixa propria no detalhe. A chamada permitida e `PATCH /api/internal/iluminacao/solicitacoes/{id}/prioridade`, sempre com `credentials: "include"`, `Content-Type: application/json`, `Accept: application/json`, header `X-Geoportal-Internal-Request: 1` e payload restrito a `{ prioridade, observacao }`. A alteracao ocorre somente apos sessao autenticada, `/me` valido, detalhe carregado, identificador valido, permissao `iluminacao.solicitacoes.atualizar_prioridade` e acao explicita do usuario.

A validacao frontend exige prioridade nova diferente da atual, valor entre `baixa`, `normal`, `alta` e `urgente`, observacao trimada, minimo de 3 caracteres, maximo de 1000 caracteres, bloqueio de envio invalido e protecao contra duplo envio. Status terminal bloqueia a alteracao de prioridade na interface. Depois do `200 OK`, detalhe, listagem e historico sao recarregados. O fluxo nao altera status, nao cria observacao separada, nao altera `finalizado_em`, nao modifica dados principais da solicitacao e nao afeta o Geoportal publico.

Marco validado: o ciclo de mapa/rota e modo manutencao foi publicado e validado em 2026-06-12. A shell interna passou a exibir coordenadas no detalhe, botao `Abrir rota no Google Maps`, link externo baseado apenas em latitude/longitude, mapa simples com OSM/OpenLayers e marcador do ponto do chamado. O mapa nao carrega camadas internas, dados pessoais, observacoes ou descricoes. A validacao visual ocorreu em desktop e mobile na URL `https://geoserver.amambai.ms.gov.br/interno/`, usando a producao interna em `127.0.0.1:8003`.

Perfil de manutencao validado: o modo visual manutencao foi validado com `manutencao.producao`, vinculado ao perfil `manutencao-iluminacao`. As permissoes retornadas por `/api/internal/auth/me` foram `internal.auth.me`, `iluminacao.solicitacoes.ler`, `iluminacao.solicitacoes.ver_observacoes`, `iluminacao.solicitacoes.comentar` e `iluminacao.solicitacoes.atualizar_status`. O perfil nao possui `admin.*` nem `iluminacao.solicitacoes.atualizar_prioridade`; portanto, historico e prioridade aparecem apenas conforme permissao real retornada pelo backend.

Testes do ciclo: `npm.cmd test -- --run src/internal-iluminacao-shell.test.js` passou com 13 testes, cobrindo coordenadas validas/invalidas, link Google Maps seguro, modo manutencao, permissoes de observacao/status/prioridade e renderizacao dos formularios operacionais. `npm.cmd run build` concluiu com sucesso e 233 modules transformed.

Marco implementado: a listagem de manutencao foi compactada para uso em campo, especialmente no mobile. Para usuario operacional sem `admin.*`, a listagem exibe somente `Protocolo`, `Status/Fase`, `Tipo`, `Prioridade`, `Poste` e `Acoes`, mantendo datas completas, descricao, observacoes, duplicidade e dados do solicitante no detalhe. As acoes proximas ao protocolo sao `Ver detalhe`, `Tracar rota` e `Alterar fase/status`, sempre respeitando permissao e regra real do backend.

Refino operacional adicional: ao clicar em `Ver detalhe`, a shell agora rola automaticamente ate a secao de detalhe para aproximar a leitura operacional da acao escolhida, sem alterar contrato de API ou permissao. No formulario de relatorio administrativo, os campos nativos de data deixaram de disparar re-render durante o evento de `input`; a sincronizacao ficou concentrada em `change`, reduzindo o risco de o calendario fechar ao navegar entre meses no seletor nativo do navegador.

Diretrizes implementadas neste ciclo UX:

- `Tracar rota` aparece na listagem somente quando houver latitude/longitude validas;
- a rota usa somente coordenadas e nao inclui nome, telefone, protocolo, descricao, observacao ou dado pessoal;
- alteracao rapida de status/fase aparece somente com `iluminacao.solicitacoes.atualizar_status`;
- prioridade nao deve ser alterada pela listagem de manutencao;
- telefone/contato clicavel fica somente no detalhe, usando link `https://wa.me/<numero_sanitizado>`, sem mensagem automatica e sem incluir protocolo, descricao, localizacao ou dados pessoais adicionais na URL;
- o backend continua sendo a autoridade real de permissao e transicao.

Regra atual implementada na visao de manutencao: a listagem de campo consome `GET /api/internal/iluminacao/solicitacoes?ativos=true`, para que o backend oculte status terminais antes da paginacao e evite confusao operacional. `ativos=true` exclui `resolvida`, `cancelada`, `indeferida` e `nao_localizado`; ausencia do filtro ou `ativos=false` mantem a listagem completa para perfis autorizados. A comparacao visual no frontend normaliza tanto status tecnico quanto status ja formatado, cobrindo `resolvida`/`Resolvida`, `cancelada`/`Cancelada`, `indeferida`/`Indeferida` e `nao_localizado`/`Não localizado`, como defesa complementar. A visao administrativa/perfil completo continua exibindo todos os chamados para auditoria, conferencia e futura volta de fase controlada.

Estado atual da matriz de fase/status: `aberta -> em_triagem` continua permitido no fluxo normal e `aberta -> em_execucao` passou a ser destino permitido pela matriz backend para a operacao enxuta atual. Isso reduz cliques desnecessarios quando a mesma pessoa recebe e executa o atendimento. `em_triagem` continua opcional e `encaminhada` continua disponivel para fluxos com repasse. Volta de fase/reabertura permanece fora deste ciclo.

Relatorio administrativo atual: a exportacao de solicitacoes/servicos foi implementada por endpoint backend autorizado, nao como exportacao simples da tabela renderizada no frontend. A versao 1 aceita relatorio geral sem datas ou filtros opcionais por `data_inicio`, `data_fim`, status, prioridade e tipo, inclui campos sanitizados como protocolo, status, prioridade, tipo, poste, origem, localizacao, datas de abertura/atualizacao/finalizacao, duplicidade suspeita e tempo ate finalizacao em segundos, e exclui por padrao nome, telefone/WhatsApp, observacoes internas livres, descricao livre e coordenadas quando houver risco de dados pessoais. A exportacao continua administrativa, nao disponivel para manutencao, e o frontend apenas aciona o contrato backend. A shell administrativa atual tambem ja orienta que datas sao opcionais e que a ausencia delas gera recorte geral.

Card mobile conceitual para ate 20 solicitacoes:

```text
IP-2026-000009
Aberta . Normal
Lampada apagada
Poste 3405

[Ver detalhe] [Tracar rota]
[Alterar fase]
```

## 13. Relacao com documentos existentes

Este documento complementa:

- `docs/MODULE-ILUMINACAO-PUBLICA.md`;
- `docs/API-ENDPOINTS-ILUMINACAO.md`;
- `docs/API-ARCHITECTURE.md`;
- `docs/AUTH-PERMISSIONS-PLAN.md`;
- `docs/POSTGIS-SCHEMA-PLAN.md`;
- `docs/SQL-MIGRATION-PLAN.md`;
- `docs/SECURITY-HARDENING-PLAN.md`;
- `docs/FRONTEND-ARCHITECTURE.md`.

## 14. Proximos passos

- Validar o MVP interno com setor responsavel em piloto controlado, incluindo login, listagem, detalhe, coordenadas, rota, mapa simples, observacoes, status, prioridade e logout.
- Validar em piloto controlado a listagem de manutencao compacta, com card mobile, acao de rota proxima ao protocolo e alteracao rapida de fase/status conforme permissao.
- Validar em piloto controlado o contrato backend de listagem ativa da manutencao (`ativos=true`), incluindo paginacao, total filtrado e ausencia de status terminal na visao de campo.
- Publicar e reiniciar a API interna com a versao atual antes da validacao do relatorio administrativo na URL publicada.
- Validar em piloto controlado o relatorio administrativo sanitizado v1 publicado, incluindo recorte geral sem datas, filtros opcionais, CSV compativel com Excel, resumo JSON e ausencia de dados pessoais livres na exportacao.
- Se a shell administrativa receber `404` ao pedir relatorio na URL publicada, tratar como sinal operacional de API interna ainda nao atualizada ou restart pendente, e nao como motivo para reabrir contrato local ja validado em desenvolvimento.
- Definir roteiro operacional para uso em campo: quando alterar status, quando alterar prioridade e como escrever observacoes internas sem dados pessoais desnecessarios.
- Planejar mapa operacional amplo como etapa separada, com contrato de coordenadas/postes, permissao, privacidade e fallback sem rota externa.
- Planejar dashboard real com indicadores derivados do backend, evitando calculos criticos apenas no frontend.
- Planejar correcao/reabertura administrativa de status terminal como fluxo separado, com permissao propria, justificativa forte e auditoria.
- Planejar anexos/fotos em etapa propria, com limites, armazenamento, antivirus/validacao, privacidade e rollback.
