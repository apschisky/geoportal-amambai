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

Dashboard, mapa operacional, endpoints de estatisticas, endpoints de mapa, proxy, producao interna e botao publico de login sao etapas futuras. Esta decisao e apenas documental e nao cria codigo, endpoint, permissao real, proxy ou producao interna.

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

Esta etapa e apenas documental. A shell `/interno/` nao deve consumir `/api/internal` agora, nao deve chamar `/api/internal/auth/me`, nao deve implementar login real, nao deve manipular cookie ou token real, nao deve usar `localStorage` ou `sessionStorage` para token e nao deve executar `POST` ou `PATCH`.

A proxima integracao real recomendada deve ser limitada a verificar sessao existente com `GET /api/internal/auth/me`. Essa chamada deve acontecer antes de listagem real, detalhe real, observacoes, alteracao de status, dashboard, mapa operacional, proxy, producao interna ou botao de login no Geoportal publico.

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

Resposta conceitual minima esperada, sem dados reais:

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

Proxima fase recomendada: implementar, em etapa separada e controlada, somente a integracao de `GET /api/internal/auth/me` para atualizar o estado visual de sessao, montar menu por permissoes retornadas e tratar `401`, `403`, `429`, `503` e erro de rede. Essa fase ainda nao deve implementar login real novo, listagem de solicitacoes, observacoes, alteracao de status, dashboard, mapa operacional, proxy, producao interna ou botao publico de login.

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

- Validar fluxo com setor responsavel.
- Decidir estrategia de homologacao por rotas, mantendo subdominios como evolucao possivel.
- Desenhar wireframes simples.
- So depois preparar primeira prova de conceito em homologacao.
