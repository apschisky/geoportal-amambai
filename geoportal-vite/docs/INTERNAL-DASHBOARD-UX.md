# UX e Implantacao Segura do Painel Interno do Geoportal

Este documento define o fluxo de uso, telas conceituais e estrategia de implantacao segura do ambiente interno do Geoportal/SIG Municipal, sem interromper o Geoportal publico existente.

## 1. Objetivo

Planejar a experiencia do futuro painel interno dos modulos municipais, com foco inicial no modulo de Iluminacao Publica / Manutencao de Postes.

O objetivo e garantir que novas funcionalidades internas sejam criadas de forma paralela, segura e reversivel, sem quebrar mapa, camadas, busca, popups, rotas, medicao, geolocalizacao, impressao, mobile ou barra publica do Geoportal atual.

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
