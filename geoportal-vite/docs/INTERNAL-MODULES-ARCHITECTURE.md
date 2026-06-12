# Arquitetura dos Modulos Internos do Geoportal de Amambai

Este documento define uma arquitetura futura para modulos internos do Geoportal/SIG Municipal, com login, API, permissoes, auditoria e dados operacionais, sem substituir o Geoportal publico.

## 1. Objetivo

Orientar a evolucao do Geoportal de Amambai para suportar servicos municipais internos de forma segura, gradual e separada da experiencia publica atual.

O Geoportal publico deve continuar sendo a base de consulta, mapa, camadas publicas, busca e comunicacao com o cidadao. Os modulos internos devem nascer como uma camada adicional, com API, autenticacao, autorizacao, auditoria e schemas operacionais no PostGIS.

## 2. Principios estrategicos

- Preservar o Geoportal publico estavel.
- Separar ambiente publico de ambiente interno.
- Evitar exposicao direta de dados sensiveis.
- Usar API para regras de negocio e gravacoes.
- Usar PostGIS como base operacional e espacial.
- Usar views controladas para publicacao publica.
- Aplicar menor privilegio em banco, API e usuarios.
- Implementar um modulo piloto antes de generalizar a arquitetura.
- Planejar backup, rollback e auditoria antes de qualquer fluxo operacional.

## 3. Arquitetura em camadas

### Geoportal publico

- Consulta publica.
- WMS/WFS publicos revisados.
- Popups publicos.
- Rotas e links externos.
- Solicitacoes publicas simples.
- Dados sensiveis ocultos ou agregados.

### API/FastAPI

- Autenticacao.
- Autorizacao.
- Validacao de dados.
- Regras de negocio.
- Auditoria.
- Integracao com PostGIS.
- Tratamento seguro de erros.
- Separacao entre endpoints publicos e internos.

### Banco PostGIS

- Schemas publicos.
- Schemas operacionais.
- Schemas de auditoria.
- Schemas por modulo.
- Views de publicacao.
- Permissoes minimas por papel e servico.

### Ambiente interno

- Login.
- Portal unico multi-modulo.
- Layout comum com topo, menu, area de conteudo e identificacao de ambiente.
- Menu dinamico por permissoes efetivas do usuario autenticado.
- Paineis por modulo.
- Gestao de solicitacoes.
- Atualizacao de status.
- Anexos.
- Historico.
- Relatorios.
- Trilhas de auditoria.

## 3.1. Decisao Arquitetural: Portal Interno Unico Multi-Modulo

O Geoportal Interno deve evoluir como um portal unico multi-modulo, e nao como telas internas isoladas por secretaria ou por servico. Iluminacao Publica e o primeiro modulo interno, mas a estrutura deve preparar a entrada futura de Alvaras, Viabilidade, Meio Ambiente, Limpeza de Lotes e outros servicos municipais.

O portal interno deve ter layout comum, com topo, menu, area de conteudo e identificacao clara de ambiente. Cada modulo pode ter suas proprias telas, filtros, detalhes e acoes, mas deve operar dentro do mesmo portal interno e da mesma base transversal de autenticacao, autorizacao e auditoria.

O menu de modulos deve ser montado conforme as permissoes efetivas do usuario autenticado. Um usuario pode ter acesso a apenas um modulo, a varios modulos ou a areas administrativas especificas. Perfis de leitura geral, como prefeito, gestor geral ou equivalentes, devem poder visualizar resumos e dados estrategicos dos modulos permitidos sem receber permissoes operacionais desnecessarias.

A administracao do sistema deve ser uma area propria e restrita a perfis autorizados. Ela nao deve ser confundida com modulos operacionais, e tambem deve obedecer ao mesmo principio: o frontend pode ocultar menus e botoes, mas a autorizacao real permanece no backend.

A area interna deve continuar separada da area publica. O Geoportal publico permanece como experiencia aberta ao cidadao; o portal interno depende de login, permissao, runtime interno e validacao de backend.

## 3.2. Tela Inicial, Resumos e Indicadores

Apos o login, o usuario podera cair em uma tela inicial do Geoportal Interno. Essa tela deve exibir cards ou resumos apenas dos modulos aos quais o usuario tem permissao.

Exemplos de resumo por modulo:

- Iluminacao Publica: chamados abertos, em triagem, encaminhados, em execucao, aguardando material, resolvidos, cancelados, pendentes ou atrasados.
- Alvaras, Viabilidade, Meio Ambiente, Limpeza de Lotes e outros modulos futuros: indicadores equivalentes, definidos conforme a regra de negocio de cada modulo.

Para administradores ou gestores gerais, o painel podera consolidar indicadores de todos os modulos permitidos. Para usuarios operacionais, o painel deve mostrar somente o modulo ou os modulos permitidos, sem expor dados ou acoes fora de sua funcao.

Dashboard, resumos, estatisticas e endpoints agregados sao evolucao futura. Eles nao fazem parte da shell inicial em `/interno/` nem da proxima integracao minima, e nao devem ser criados sem contrato, permissao, revisao de seguranca e validacao de menor privilegio.

## 3.3. Mapas Operacionais Internos

Alguns modulos exigirao mapa operacional interno. Iluminacao Publica e um caso essencial: o mapa futuro deve exibir postes e solicitacoes por status, com cores por fase, e permitir que o clique em poste ou solicitacao abra detalhe operacional conforme permissao.

No modulo de Iluminacao, a tela futura pode oferecer botao para tracar rota pelo Google Maps ate o poste, facilitando a equipe de manutencao. Essa funcionalidade deve usar dados permitidos ao usuario interno e nao deve expor dados pessoais indevidos.

O mapa interno nao deve depender de dados publicos sensiveis sem revisao. Se exigir endpoint novo, camada interna, GeoServer interno ou view controlada, isso deve ser planejado em etapa propria, com contrato, permissao, GRANTs minimos, testes e revisao de seguranca.

O mapa operacional nao faz parte da primeira tela minima ja implementada. A ordem recomendada e validar primeiro estrutura de portal, login/sessao, listagem e detalhe antes de evoluir para mapa interno.

## 4. Separacao publico x interno

| Area | Geoportal publico | Ambiente interno |
|---|---|---|
| Acesso | Aberto | Login |
| Dados | Publicos | Operacionais/sensiveis |
| Edicao | Nao | Sim |
| Auditoria | Limitada | Obrigatoria |
| API | Publica controlada quando necessario | Autenticada |
| Usuarios | Cidadao | Servidores/setores |

## 5. Proposta inicial de schemas

Proposta inicial a validar antes da implementacao:

- `web_map`: dados/views publicados para mapa publico.
- `cadastro`: bases cadastrais e territoriais de referencia.
- `operacional`: dados operacionais compartilhados.
- `auth`: usuarios, perfis, permissoes e sessoes, se forem armazenados no PostGIS.
- `auditoria`: trilhas de auditoria e eventos.
- `mod_iluminacao`: modulo de iluminacao publica/manutencao de postes.
- `mod_alvaras`: modulo de alvaras.
- `mod_viabilidade`: modulo de viabilidade.
- `mod_meio_ambiente`: modulo de meio ambiente.
- `mod_limpeza_lotes`: modulo de limpeza de lotes.

Os nomes acima sao proposta inicial. Devem ser validados com a equipe tecnica, regras de seguranca, padrao de backup e plano de permissao antes de criar objetos em producao.

## 6. Estrategia de dados

- Tabelas autoritativas nao devem ser expostas diretamente quando forem sensiveis.
- Modulos internos devem gravar em schemas operacionais ou schemas por modulo.
- GeoServer deve publicar preferencialmente views publicas revisadas.
- API deve controlar gravacoes, validacoes e transicoes de status.
- Historico e auditoria devem ficar separados dos dados principais.
- Dados publicos devem ser derivados de views com campos selecionados.
- Dados operacionais devem exigir autenticacao, autorizacao e auditoria.

## 7. Autenticacao e permissoes

Visao inicial:

- Usuarios individuais, nunca compartilhados.
- Perfis por secretaria.
- Permissoes por modulo.
- Permissoes por acao:
  - visualizar;
  - criar;
  - editar;
  - alterar prioridade;
  - encaminhar;
  - finalizar;
  - excluir.
- Bloqueio/desativacao de usuarios desligados.
- Politica de senha.
- Avaliacao futura de 2FA para perfis sensiveis.

## 7.1. Contrato de sessao e permissoes para o portal interno

A primeira integracao real da shell `/interno/` com autenticacao deve ser somente verificacao de sessao existente, antes de listagem, dashboard, mapa ou qualquer acao operacional. O endpoint de referencia para essa etapa e `GET /api/internal/auth/me`, ja existente no backend interno.

Essa chamada deve permitir ao frontend descobrir apenas:

- se ha sessao valida;
- dados minimos do usuario autenticado;
- permissoes efetivas;
- modulos acessiveis;
- perfil ou papeis somente quando forem necessarios para a experiencia de uso.

O menu do portal interno deve ser derivado das permissoes e modulos retornados pelo backend. Esconder menu, botao ou tela no frontend melhora a experiencia, mas nao concede acesso e nao substitui `require_permission(...)` nem outras validacoes do backend.

A estrategia preferencial para navegador continua sendo sessao opaca no backend, transportada por cookie seguro, alinhada com os documentos de autenticacao interna: `HttpOnly`, `Secure` conforme ambiente e obrigatorio em producao, `SameSite` adequado, expiracao, logout/revogacao e token bruto nunca persistido no banco. O backend deve manter apenas hash ou representacao segura da sessao. O frontend nao deve guardar token em `localStorage` ou `sessionStorage`.

Registro historico do recorte inicial: enquanto a etapa era apenas `GET /api/internal/auth/me`, nao deveria haver `POST`, `PATCH`, login real novo, armazenamento de token, dashboard, mapa operacional, proxy interno, producao interna ou botao publico de login. As fases posteriores implementaram login, mutacoes controladas, logout e producao interna. A regra permanente continua: acoes mutaveis com cookie devem manter protecao CSRF ou mecanismo equivalente, incluindo o header interno mutavel ja adotado para rotas sensiveis.

Estados de sessao recomendados para o portal:

- `checking_session`: verificando sessao;
- `unauthenticated`: sem sessao valida;
- `authenticated`: sessao valida e permissoes carregadas;
- `forbidden`: autenticado, mas sem permissao para o modulo ou recurso;
- `expired`: sessao expirada ou invalida;
- `technical_error`: erro tecnico seguro, sem detalhes internos.

Tratamento recomendado de respostas:

- `200`: usar permissoes efetivas para montar menu e modulos.
- `401`: exibir estado de login necessario, sem revelar a causa.
- `403`: exibir acesso negado para recurso ou modulo.
- `429`: informar excesso temporario de tentativas, se aplicavel.
- `503`: informar indisponibilidade temporaria sem SQL, stack trace, host, role ou segredo.
- Erro de rede: informar falha temporaria de conexao com o servico interno.

Contrato real atual para a primeira integracao da shell, sem dados reais nesta documentacao:

```json
{
  "authenticated": true,
  "usuario_id": 1,
  "permissoes": [
    "iluminacao.solicitacoes.ler"
  ]
}
```

Campos como `usuario.nome`, `usuario.login`, `sessao.expira_em` e `modulos` podem ser avaliados futuramente, mas nao devem ser esperados pela shell enquanto nao fizerem parte do endpoint real.

Exemplo conceitual de resposta futura para orientar evolucoes do frontend:

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

Mapeamentos conceituais:

- `iluminacao.solicitacoes.ler` permite exibir o modulo Iluminacao Publica.
- Permissao administrativa como `admin.usuarios.ler` pode permitir exibir Administracao do Sistema, sempre respeitando o backend.
- Permissoes futuras de dashboard ou indicadores podem permitir cards de resumo sem conceder acoes operacionais.

Validacao operacional registrada: a shell `/interno/` passou a consultar somente `GET /api/internal/auth/me` no commit `a6849dd`, usando o contrato real `authenticated`, `usuario_id` e `permissoes`. Em desenvolvimento local, sem proxy/backend interno ativo no Vite, a rota retornou `404`, comportamento esperado para esse ambiente. No backend interno de homologacao em `127.0.0.1:8002`, o mesmo endpoint sem sessao retornou `401 Unauthorized`, confirmando que a rota existe e permanece protegida. Marco posterior de 2026-06-12: a producao interna foi ativada em `127.0.0.1:8003` via Apache `/api/internal/`, preservando `8002` para homologacao interna e rollback temporario.

## 8. Auditoria

Modulos internos devem registrar:

- usuario;
- data/hora;
- acao;
- registro afetado;
- valores anteriores e novos quando aplicavel;
- IP/origem quando possivel;
- status anterior e novo;
- anexos;
- observacoes.

A auditoria deve ser pensada desde o desenho do modulo, nao adicionada depois.

## 9. Modulos candidatos

- **Iluminacao Publica / Manutencao de Postes**: solicitacoes, protocolos, status, ordens de servico e mapa de ocorrencias.
- **Alvaras**: consulta territorial, analise, documentos, status e emissao/encaminhamento.
- **Viabilidade**: analise de localizacao, zoneamento, infraestrutura e restricoes.
- **Meio Ambiente**: licenciamento, areas sensiveis, empreendimentos e acompanhamento.
- **Limpeza de Lotes**: solicitacoes, notificacoes, vistorias, prazos e historico.
- **Outros servicos futuros**: novos fluxos municipais baseados em mapa, protocolo e auditoria.

## 10. Modulo piloto recomendado: Iluminacao Publica

Iluminacao Publica / Manutencao de Postes e o melhor modulo piloto porque:

- ja existe camada de postes;
- ja existe popup;
- ja existe botao de solicitacao via Google Forms;
- ja existe busca por poste;
- ja existe relacao espacial clara com o mapa;
- pode evoluir para protocolo, status, ordem de servico e painel.

Escopo inicial recomendado:

- solicitacao publica;
- protocolo;
- status;
- painel interno;
- mapa de solicitacoes;
- auditoria;
- views publicas de status sem dados sensiveis.

O modulo piloto deve validar a arquitetura antes de expandir para alvaras, viabilidade, meio ambiente e limpeza de lotes.

## 11. Fluxo geral futuro

1. Cidadao solicita servico no Geoportal publico.
2. API valida e grava solicitacao.
3. Sistema gera protocolo.
4. Setor interno recebe em painel autenticado.
5. Servidor atualiza status.
6. Historico e auditado.
7. Cidadao consulta andamento quando aplicavel.
8. Geoportal exibe dados agregados ou status publico controlado, quando permitido.

## 11.1. Riscos e Controles do Portal Interno

- Nao confiar no frontend como autoridade de permissao.
- Nao expor modulo interno no Geoportal publico antes de autenticacao, autorizacao, proxy e producao interna estarem planejados.
- Nao exibir dados pessoais em dashboard ou mapa sem necessidade operacional.
- Nao misturar dados publicos e internos.
- Nao criar endpoints de estatisticas ou mapa sem contrato, permissao, auditoria e revisao de seguranca.
- Preservar o Geoportal publico: mapa, camadas, busca, popups, rotas, medicao, geolocalizacao, impressao, mobile e barra publica.
- Manter evolucao incremental, revisavel e reversivel.

## 12. Homologacao e publicacao

- Nada deve ir direto para producao.
- Usar ambiente de homologacao ou estrategia segura de testes.
- Testar banco, API, permissoes e front-end separadamente.
- Fazer backup antes de alteracao estrutural.
- Definir rollback antes da publicacao.
- Registrar versao publicada.
- Validar permissoes com usuarios reais de cada setor antes de liberar.

## 13. Relacao com documentos existentes

Este documento deve ser lido junto com:

- `docs/GEOPORTAL-MATURITY-CHECKLIST.md`;
- `docs/SECURITY-HARDENING-PLAN.md`;
- `docs/LAYER-INVENTORY.md`;
- `docs/DATABASE-INVENTORY.md`;
- `docs/FRONTEND-ARCHITECTURE.md`;
- `docs/TESTING-PLAN.md`.

## 14. Criterios para iniciar implementacao

A implementacao so deve comecar quando:

- [ ] modulo piloto estiver detalhado;
- [ ] schema do modulo estiver desenhado;
- [ ] permissoes estiverem definidas;
- [ ] auditoria estiver planejada;
- [ ] API minima estiver desenhada;
- [ ] estrategia de homologacao estiver definida;
- [ ] backups/rollback estiverem confirmados;
- [ ] dados publicos e internos estiverem separados;
- [ ] inventario de camadas e banco tiver sido revisado;
- [ ] criterios de seguranca tiverem sido aprovados.

## 15. Proximos documentos recomendados

- `docs/MODULE-ILUMINACAO-PUBLICA.md`
- `docs/API-ARCHITECTURE.md`
- `docs/POSTGIS-SCHEMA-PLAN.md`
- `docs/AUTH-PERMISSIONS-PLAN.md`
