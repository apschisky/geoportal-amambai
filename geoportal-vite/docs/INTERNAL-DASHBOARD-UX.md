# UX e Implantacao Segura do Painel Interno do Geoportal

Este documento define o fluxo de uso, telas conceituais e estrategia de implantacao segura do ambiente interno do Geoportal/SIG Municipal, sem interromper o Geoportal publico existente.

## 1. Objetivo

Planejar a experiencia do futuro painel interno dos modulos municipais, com foco inicial no modulo de Iluminacao Publica / Manutencao de Postes.

O objetivo e garantir que novas funcionalidades internas sejam criadas de forma paralela, segura e reversivel, sem quebrar mapa, camadas, busca, popups, rotas, medicao, geolocalizacao, impressao, mobile ou barra publica do Geoportal atual.

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
- Decisao inicial: o mapa operacional e essencial desde o inicio.

### Detalhe da solicitacao

- Protocolo.
- `poste_id`.
- Localizacao.
- Tipo de problema.
- Descricao.
- Status.
- Historico.
- Anexos.
- Acoes permitidas conforme perfil.

### Alteracao de status

- Status novo.
- Observacao obrigatoria em certas transicoes.
- Confirmacao antes de finalizar/cancelar.
- Auditoria obrigatoria.

### Anexos

- Upload controlado.
- Foto antes/depois.
- Restricao de tipo/tamanho.
- Visualizacao apenas para perfis autorizados.

### Indicadores

- Solicitacoes por status.
- Solicitacoes por tipo.
- Reincidencia por poste.
- Solicitacoes por regiao.
- Atrasadas, com alerta inicial para mais de 15 dias paradas.
- Finalizadas no periodo.
- Periodo de analise mais usado: semanal.

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
