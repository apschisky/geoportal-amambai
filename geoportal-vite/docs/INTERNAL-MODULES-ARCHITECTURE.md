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
- Paineis por modulo.
- Gestao de solicitacoes.
- Atualizacao de status.
- Anexos.
- Historico.
- Relatorios.
- Trilhas de auditoria.

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
  - encaminhar;
  - finalizar;
  - excluir.
- Bloqueio/desativacao de usuarios desligados.
- Politica de senha.
- Avaliacao futura de 2FA para perfis sensiveis.

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
