# Arquitetura da API/FastAPI do Geoportal de Amambai

Este documento define a arquitetura futura da API/FastAPI para conectar o Geoportal publico, modulos internos, PostGIS operacional, autenticacao, permissoes e auditoria.

## 1. Objetivo

Planejar uma API segura, revisavel e gradual para os modulos internos do Geoportal/SIG Municipal, sem implementar codigo nesta etapa.

A API deve servir como camada controlada entre front-ends, paineis internos e banco PostGIS, evitando acesso direto a tabelas operacionais.

## 2. Papel da API na arquitetura

A API deve atuar como:

- camada de regras de negocio;
- barreira entre front-end publico/interno e banco;
- ponto unico de gravacao operacional;
- camada de validacao de entrada;
- camada de auditoria;
- protecao contra acesso direto a tabelas operacionais;
- integracao entre PostGIS, ambiente interno e Geoportal publico.

## 3. Separacao entre API publica e API interna

| Tipo | Acesso | Exemplos | Seguranca |
|---|---|---|---|
| Publica | Sem login ou com protecao leve | Criar solicitacao, consultar protocolo | Validacao, rate limit, dados minimos |
| Interna | Login obrigatorio | Listar solicitacoes, alterar status, anexar arquivos | Autenticacao, permissao, auditoria |

Endpoints publicos devem expor apenas o necessario. Endpoints internos devem exigir autenticacao, autorizacao e registro de auditoria.

## 4. Modulo piloto: Iluminacao Publica

Endpoints conceituais publicos:

- `POST /api/public/iluminacao/solicitacoes`
- `GET /api/public/iluminacao/protocolo/{protocolo}`

Endpoints conceituais internos:

- `GET /api/internal/iluminacao/solicitacoes`
- `GET /api/internal/iluminacao/solicitacoes/{id}`
- `PATCH /api/internal/iluminacao/solicitacoes/{id}/status`
- `POST /api/internal/iluminacao/solicitacoes/{id}/observacoes`
- `POST /api/internal/iluminacao/solicitacoes/{id}/anexos`
- `PATCH /api/internal/iluminacao/solicitacoes/{id}/finalizar`
- `PATCH /api/internal/iluminacao/solicitacoes/{id}/cancelar`

Estes endpoints sao apenas desenho conceitual. Nenhum codigo deve ser criado antes da validacao de schema, autenticacao, permissoes, auditoria e anexos.

## 5. Estrutura sugerida do projeto FastAPI

Organizacao conceitual:

```text
app/
  main.py
  core/
  repositories/
  db/
  auth/
  modules/
    iluminacao/
    alvaras/
    viabilidade/
    meio_ambiente/
    limpeza_lotes/
  shared/
  audit/
```

Finalidade:

- `main.py`: inicializacao da aplicacao e registro de rotas.
- `core/`: configuracoes, variaveis de ambiente, seguranca e inicializacao.
- `repositories/`: persistencia com SQLAlchemy Core e SQL textual controlado.
- `db/`: conexao, pool, transacoes e utilitarios de banco.
- `auth/`: login, tokens/sessoes, usuarios e permissoes.
- `modules/`: regras, rotas e schemas por modulo.
- `shared/`: utilitarios compartilhados, validadores e modelos comuns.
- `audit/`: registro e consulta de eventos de auditoria.

## 6. Banco de dados e conexao

- Usar usuario proprio da API.
- Guardar credenciais em variaveis de ambiente.
- Nunca hardcode de usuario, senha, host ou token.
- Usar pool de conexao.
- API com permissao minima.
- Separar leitura publica, escrita operacional e administracao.
- Evitar superuser em servicos.
- Registrar erros tecnicos em log interno, sem expor detalhes ao usuario.

A API usa `DATABASE_URL` por variavel de ambiente ou arquivo local nao versionado. O front-end nao conhece credenciais do banco. A API sera publicada separadamente do build `dist`; futuramente, o Apache podera encaminhar `/api` para o servico FastAPI.

A API deve conectar ao banco usando usuario restrito por modulo e ambiente. O endpoint publico de solicitacoes deve ter apenas permissao minima para inserir e retornar os dados necessarios.

A arquitetura de banco da API foi validada em homologacao com usuario restrito, sem superuser e sem acesso direto a schemas nao necessarios.

Endpoints nao devem conter SQL direto. A persistencia deve ficar em repositories usando SQLAlchemy Core, bind parameters e transacoes controladas.

Existe script manual para validar o repository contra homologacao sem acoplar o endpoint publico a persistencia real.

A persistencia de solicitacoes e controlada por configuracao (`PERSIST_SOLICITACOES`). O service decide entre modo simulado e repository; o endpoint nao contem SQL.

A geracao de protocolo deve ser segura contra concorrencia, usando sequence do PostgreSQL em vez de `COUNT(*)` ou logica no front-end.

A sequence de protocolo foi validada em homologacao; quando `PERSIST_SOLICITACOES=true`, a geracao real consome `mod_iluminacao.solicitacoes_protocolo_seq` para montar protocolos no formato `IP-YYYY-NNNNNN`.

O fluxo endpoint -> service -> protocol_service -> repository -> banco foi validado em homologacao com persistencia ativa e protocolo real por sequence.

A deteccao leve de duplicidade suspeita e avaliada na camada repository/banco. A regra inicial marca possiveis repeticoes para triagem interna, sem bloquear a solicitacao; protecoes mais fortes e rate limit ficam para etapa posterior.

A camada repository/banco validou em homologacao a marcacao de `duplicidade_suspeita` para solicitacoes semelhantes, mantendo a gravacao normal.

O rate limit inicial fica na API e usa memoria local para desenvolvimento/homologacao. Em producao, a estrategia deve ser revista para proxy reverso, Redis, WAF ou API gateway.

O rate limit atua antes da chamada ao service; requisicoes bloqueadas nao acionam a camada de persistencia.

## 7. Validacao de entrada

A API deve validar:

- schemas de entrada;
- campos obrigatorios;
- sanitizacao de texto;
- limites de tamanho;
- coordenadas;
- protocolo;
- anexos;
- tipos permitidos;
- valores enumerados;
- campos inesperados.

Entradas invalidas devem ser rejeitadas com mensagens simples e seguras.

## 8. Autenticacao e autorizacao

- Login obrigatorio para ambiente interno.
- Token ou sessao segura.
- Perfis por secretaria/modulo.
- Permissoes por acao.
- Endpoints internos sempre protegidos.
- Bloqueio/desativacao de usuarios desligados.
- Avaliacao futura de 2FA para perfis sensiveis.

Permissoes devem considerar acoes como visualizar, criar, editar, encaminhar, finalizar, anexar e excluir/cancelar.

## 9. Auditoria

Toda operacao interna relevante deve registrar:

- usuario;
- acao;
- data/hora;
- IP/origem;
- recurso alterado;
- status anterior e novo;
- resumo da alteracao;
- anexo enviado, quando houver.

Auditoria deve ser obrigatoria para mudancas de status, observacoes, anexos, finalizacao, cancelamento e alteracoes administrativas.

## 10. Tratamento de erros

- Erros tecnicos nao devem aparecer para o cidadao.
- Erros tecnicos de banco devem ser convertidos em respostas seguras, como `503` temporario.
- Logs internos devem guardar detalhes suficientes para diagnostico.
- Respostas publicas devem ser simples.
- Usar codigos HTTP adequados.
- Evitar vazamento de stack trace.
- Evitar vazamento de SQL.
- Evitar vazamento de caminho de arquivo.
- Evitar vazamento de credenciais ou configuracoes internas.

## 11. Rate limit e protecao contra abuso

- Limitar criacao de solicitacoes publicas.
- Proteger consulta de protocolo.
- Evitar enumeracao de protocolos.
- Registrar tentativas suspeitas.
- Considerar CAPTCHA ou desafio leve se houver abuso.
- Bloquear anexos perigosos.
- Monitorar volume anormal por IP/origem.

## 12. CORS e origem permitida

- CORS restrito aos dominios oficiais.
- Nao usar wildcard em producao.
- Separar configuracao de desenvolvimento e producao.
- Permitir apenas metodos e headers necessarios.
- Revisar CORS antes de publicar endpoints internos.

## 13. Anexos

- Definir tipos permitidos.
- Definir tamanho maximo.
- Usar armazenamento controlado.
- Registrar hash.
- Considerar varredura antivirus.
- Proteger acesso por permissao.
- Nao expor caminho fisico.
- Nao servir anexo interno publicamente sem autorizacao.
- Registrar metadados no banco.

## 14. Integracao com Geoportal publico

- O Geoportal publico pode chamar endpoints publicos.
- Dados internos nao devem ser chamados diretamente pelo front-end publico.
- Visualizacoes publicas devem vir de views controladas ou endpoints publicos filtrados.
- Manter compatibilidade com GeoServer para camadas publicas.
- Fluxos publicos devem coletar apenas dados necessarios.
- A integracao inicial do front-end com a API de Iluminacao deve ser paralela ao Google Forms.
- O botao atual do Google Forms deve permanecer ativo durante a validacao da API.
- Um segundo botao de teste podera acionar futuramente o fluxo da API, controlado por feature flag ou configuracao do front-end.
- O botao de teste da API foi preparado com feature flag desativada por padrao e abre um modal/formulario local de teste; nesta etapa ele nao envia dados e nao chama a API.
- A selecao manual no formulario de teste usa marcador visual temporario e exige confirmacao do local antes de preencher o formulario.
- O modal de teste aplica obrigatoriedade dinamica: `poste_id` obrigatorio apenas em `poste_mapa` e `observacoes_localizacao` obrigatoria em `ponto_manual`.
- O front-end monta e valida localmente uma previa do payload em modo de teste antes de qualquer ativacao de envio real.
- O campo de contato do formulario local possui suporte inicial a Brasil e Paraguai, com mascara, validacao local e normalizacao para `contato_solicitante` na previa do payload.
- O envio real pelo front-end foi preparado atras da flag `submitEnabled`, desligada por padrao; com a flag desligada, o fluxo continua exibindo apenas a previa local do payload.
- O envio real controlado pelo front-end foi validado em homologacao com ativacao temporaria por flags e persistencia ativa; a API retornou `201 Created`, o front-end exibiu sucesso com protocolo/status e a gravacao foi confirmada sem registrar dados reais nesta documentacao.
- Apos validacoes, `enabled=false`, `submitEnabled=false` e `PERSIST_SOLICITACOES=false` devem permanecer como padrao seguro; registros de teste devem ser limpos.
- O Google Forms permanece como fallback enquanto a API estiver em validacao.
- A substituicao definitiva do Forms so deve ocorrer apos testes em homologacao/producao, estabilidade de rede, logs, monitoramento e plano de rollback validados.

## 14.1 Consulta publica de protocolo pendente

A consulta publica de protocolo deve permitir ao cidadao acompanhar o andamento sem expor dados sensiveis. A resposta futura deve limitar dados a protocolo, status, datas publicas e mensagens seguras. Dados pessoais, contato, observacoes internas e detalhes administrativos nao devem ser expostos.

## 15. Integracao com ambiente interno

- Painel interno consome endpoints internos.
- Cada acao deve respeitar permissao.
- Filtros por status, data, bairro, tipo e prioridade.
- Relatorios e indicadores via endpoints especificos.
- Operacoes de escrita devem gerar auditoria.
- Dados pessoais e anexos devem respeitar permissao.

## 16. Seguranca operacional

- Logs estruturados.
- Backup planejado.
- Rollback planejado.
- Versionamento de API.
- Variaveis de ambiente.
- Segredos fora do Git.
- Ambiente de homologacao.
- HTTPS obrigatorio.
- Reverse proxy com Apache.
- Revisao de dependencias.
- Separacao clara entre desenvolvimento, homologacao e producao.

## 17. Estrategia de implantacao

1. API minima em homologacao.
2. Conexao segura com PostGIS.
3. Endpoint publico de criacao.
4. Endpoint de consulta de protocolo.
5. Login interno.
6. Listagem interna.
7. Atualizacao de status.
8. Auditoria.
9. Anexos.
10. Publicacao controlada.

Cada fase deve ter teste, revisao de permissao e possibilidade de rollback.

A primeira abordagem recomendada para homologacao e publicar API e painel interno por rotas, como `/api` e `/interno`, reduzindo complexidade inicial de DNS/certificado e risco de CORS. A separacao por subdominios pode ser adotada futuramente, caso haja necessidade operacional.

## 18. Prova de conceito local

Foi iniciada uma prova de conceito local em `geoportal-backend/`, com FastAPI e endpoints de health check para validar a estrutura inicial da futura API.

Esta prova de conceito nao usa banco de dados, nao possui autenticacao real, nao contem dados sensiveis e nao tem impacto no Geoportal publico em producao.

A POC local tambem possui CORS controlado por configuracao e endpoint `GET /api/version` para identificacao basica do servico.

## 19. Criterios antes de implementar

- [ ] Schema validado.
- [ ] Autenticacao definida.
- [ ] Permissoes definidas.
- [ ] Endpoints desenhados.
- [ ] Politica de anexos definida.
- [ ] Estrategia de logs definida.
- [ ] Ambiente de homologacao pronto.
- [ ] Backup/rollback planejado.
- [ ] CORS planejado.
- [ ] Segredos definidos fora do codigo.

## 20. Relacao com documentos existentes

Este documento complementa:

- `docs/POSTGIS-SCHEMA-PLAN.md`;
- `docs/MODULE-ILUMINACAO-PUBLICA.md`;
- `docs/INTERNAL-MODULES-ARCHITECTURE.md`;
- `docs/SECURITY-HARDENING-PLAN.md`;
- `docs/DATABASE-INVENTORY.md`;
- `docs/LAYER-INVENTORY.md`.

## 21. Proximos documentos recomendados

- `docs/AUTH-PERMISSIONS-PLAN.md`
- futuro `docs/API-ENDPOINTS-ILUMINACAO.md`
- futuro script SQL versionado
- futura prova de conceito FastAPI em homologacao
