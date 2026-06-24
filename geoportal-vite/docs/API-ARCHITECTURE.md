# Arquitetura da API/FastAPI do Geoportal de Amambai

Este documento define a arquitetura futura da API/FastAPI para conectar o Geoportal publico, modulos internos, PostGIS operacional, autenticacao, permissoes e auditoria.

## 1. Objetivo

Planejar uma API segura, revisavel e gradual para os modulos internos do Geoportal/SIG Municipal, sem implementar codigo nesta etapa.

A API deve servir como camada controlada entre front-ends, paineis internos e banco PostGIS, evitando acesso direto a tabelas operacionais.

A revisao defensiva da API publica atual esta em `docs/PUBLIC-API-SECURITY-REVIEW.md` e deve ser considerada antes da exposicao de endpoints internos.

## 2. Papel da API na arquitetura

### 2.1 Etapa 0 — pré-requisito para administração interna

A API interna pode expor leitura protegida e operações operacionais controladas, mas qualquer CRUD administrativo de usuários, perfis e permissões deve ser tratado como etapa posterior, com controles de segurança, auditoria e validação explícita. O estado atual de autenticação e autorização é suficiente para proteger o acesso interno inicial, mas ainda não habilita uma camada administrativa aberta.

Primeiro reforço já implementado localmente:
- rate limit de login por IP e por IP+login;
- tratamento seguro do IP real atrás do Apache/proxy;
- testes automatizados de spoofing de headers e excesso de tentativas.

Os controles mínimos que ainda devem ser fechados antes do primeiro CRUD administrativo são:
- validação operacional do reforço no servidor/homologação e dos headers efetivamente encaminhados pelo Apache;
- testes adicionais para bloqueio, revogação e acesso negado no futuro fluxo administrativo;
- anti-elevação, proteção contra remoção do último administrador e auditoria administrativa;
- separação forte entre permissões administrativas e permissões de negócio.

Enquanto a Etapa 0 não estiver concluída e validada em homologação, a API interna deve permanecer sem tela administrativa aberta e sem endpoints mutáveis de administração.

Reforço recente da Etapa 0 (commits `152c177` e `f3d8ff3`): o login interno passou a ter resolução segura de IP real, rate limit por IP e por IP+login, proteção contra spoofing de `X-Forwarded-For`/`X-Real-IP` e resposta `429` sanitizada. Esse reforço reduz abuso de login e melhora a base da API interna, mas não substitui a defesa de infraestrutura nem a validação operacional em servidor/homologação para confirmar como o Apache/proxy encaminha os headers reais.

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
| Interna | Login obrigatorio | Listar solicitacoes, alterar status, alterar prioridade, registrar observacoes, anexar arquivos futuramente | Autenticacao, permissao, auditoria |

Endpoints publicos devem permanecer em `/api/public/...` e expor apenas o necessario. Endpoints internos devem ficar em `/api/internal/...`, exigir autenticacao, autorizacao no backend e registro de auditoria, sem reutilizar endpoints publicos. Endpoints publicos nunca devem retornar observacoes internas nem historico administrativo completo.

## 4. Modulo piloto: Iluminacao Publica

Endpoints conceituais publicos:

- `POST /api/public/iluminacao/solicitacoes`
- `POST /api/public/iluminacao/consulta`

Endpoints conceituais internos:

- `GET /api/internal/iluminacao/solicitacoes`
- `GET /api/internal/iluminacao/solicitacoes/{id}`
- `PATCH /api/internal/iluminacao/solicitacoes/{id}/status`
- `PATCH /api/internal/iluminacao/solicitacoes/{id}/prioridade`
- `POST /api/internal/iluminacao/solicitacoes/{id}/observacoes`
- `GET /api/internal/iluminacao/solicitacoes/{id}/historico`
- `GET /api/internal/iluminacao/estatisticas`

Estes endpoints sao apenas desenho conceitual. Nenhum codigo deve ser criado antes da validacao de schema, autenticacao, permissoes, auditoria, testes automatizados e revisao de seguranca.

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

A implantacao planejada da API de Iluminacao e no mesmo servidor do PostgreSQL/PostGIS, como servico controlado, nunca no computador de desenvolvimento. O plano tecnico esta em `docs/API-SERVER-DEPLOYMENT-PLAN.md`.

A primeira implantacao de homologacao no servidor foi registrada: API como servico Windows controlado, escutando apenas em `127.0.0.1:8000`, com `PERSIST_SOLICITACOES=false`. A exposicao controlada ocorre via Apache HTTPS em `/api/`.

O proxy reverso Apache HTTPS para `/api/` foi configurado e validado em homologacao, encaminhando para a API local em `127.0.0.1:8000`. Healthchecks, versao, criacao simulada e consulta inexistente com `404` seguro foram validados via HTTPS. GeoServer e Geoportal publico nao foram afetados. CORS foi validado para a origem oficial do Geoportal; a configuracao real de `ALLOWED_ORIGINS` fica fora do Git, sem wildcard. Nesta fase, a API experimental seguira em `https://geoserver.amambai.ms.gov.br/api/`, enquanto o front-end oficial permanece em `https://geoportal.amambai.ms.gov.br`. A ativacao publica permanente do botao da API ainda depende de revisao operacional e aprovacao gradual.

A alternativa `https://geoportal.amambai.ms.gov.br/api/` fica registrada como evolucao futura de infraestrutura. Ela depende de proxy no servidor do front-end ou revisao de DNS/VirtualHost, ja que a investigacao indicou dominios em infraestruturas distintas, sem registrar IPs reais nesta documentacao.

O front-end publicado em `https://geoportal.amambai.ms.gov.br` foi testado em build controlado com o botao experimental da API habilitado temporariamente. A chamada HTTPS para `https://geoserver.amambai.ms.gov.br/api/` funcionou com CORS restrito para a origem oficial, e o envio simulado retornou sucesso no modal do Geoportal. Como `PERSIST_SOLICITACOES=false` estava ativo, nao houve gravacao real; a conferencia posterior no banco confirmou ausencia de novo registro. As flags temporarias devem voltar para `false` apos testes e nao devem ser commitadas como `true`. A chave correta de configuracao do endpoint e `apiUrl`; grafia incorreta pode causar chamada para `/undefined`.

A validacao completa de persistencia em homologacao tambem foi executada de ponta a ponta: `PERSIST_SOLICITACOES` foi ativado temporariamente fora do Git, o servico de homologacao foi reiniciado, o healthcheck permaneceu ok, o front-end publicado enviou solicitacao real via HTTPS, a API gravou registros no banco de homologacao e a consulta publica por protocolo funcionou. O bloqueio `409 Conflict` para duplicidade ativa por poste retornou mensagem amigavel, o rate limit foi acionado em testes intensivos e o usuario restrito da API nao conseguiu executar `DELETE`, confirmando permissao minima. A limpeza dos registros de teste exigiu usuario administrativo do banco. Ao final, `PERSIST_SOLICITACOES=false` foi restaurado, e as flags do front-end devem permanecer `false` no repositorio.

A estrutura local de producao da API foi preparada sem ativacao publica de gravacao. Antes da criacao do schema no banco ativo, foi feito backup manual e validado como legivel. O banco ativo recebeu o schema `mod_iluminacao`, a tabela `mod_iluminacao.solicitacoes` e as sequences `mod_iluminacao.solicitacoes_id_seq` e `mod_iluminacao.solicitacoes_protocolo_seq`. Um usuario restrito de producao foi criado e teve login real validado, com `CONNECT`, `USAGE`, `SELECT`/`INSERT` e `USAGE`/`SELECT` nas sequences, mas sem `UPDATE` e sem `DELETE`. O ambiente real de producao fica fora do Git, `PERSIST_SOLICITACOES=false` permanece ativo, o servico Windows `GeoportalAPIProducao` foi criado e iniciado em `127.0.0.1:8001`, enquanto homologacao permanece em `127.0.0.1:8000`. O healthcheck de producao passou e um `POST` simulado retornou sucesso sem gravar no banco ativo, que permaneceu sem solicitacoes reais criadas pela API.

Na validacao de pre-producao, o Apache publico `/api/` foi apontado para `GeoportalAPIProducao` em `127.0.0.1:8001`, apos backup do arquivo ativo, validacao `Syntax OK` e reinicio bem-sucedido. `/api/version` via HTTPS retornou ambiente `producao`, o health publico de Iluminacao retornou ok, `POST` via HTTPS e pelo front-end publicado retornou protocolo simulado, e o banco ativo continuou sem solicitacoes porque `PERSIST_SOLICITACOES=false` permaneceu ativo. CORS restrito foi revalidado com origem oficial permitida e origem invalida bloqueada com `400`. Geoportal publico, GeoServer e camadas continuaram funcionando.

A ativacao real controlada em producao foi realizada com `PERSIST_SOLICITACOES=true` ativado no ambiente real fora do Git e reinicio do `GeoportalAPIProducao`. O front-end publicado enviou solicitacao real por poste e por ponto manual, a consulta publica dos protocolos gerados funcionou e o bloqueio de duplicidade ativa por poste retornou mensagem amigavel. O botao Tracar rota, o botao de solicitacao via Google Forms, o Geoportal publico, o GeoServer e as camadas permaneceram funcionando. Google Forms permanece como fallback durante o periodo de transicao. A proxima evolucao recomendada e o modulo interno para triagem, acompanhamento e encerramento das solicitacoes.

Separacao de schemas: `plano` concentra dados tecnicos/editaveis do SIG, `web_map` concentra dados publicados para GeoServer/Geoportal, e `mod_iluminacao` concentra dados operacionais da API e do futuro modulo interno. A API de Iluminacao nao deve gravar em `plano` nem em `web_map`.

A API deve conectar ao banco usando usuario restrito por modulo e ambiente. O endpoint publico de solicitacoes deve ter apenas permissao minima para inserir e retornar os dados necessarios.

A arquitetura de banco da API foi validada em homologacao com usuario restrito, sem superuser e sem acesso direto a schemas nao necessarios.

Separacao de runtimes para producao interna: a API publica de producao permanece no servico `GeoportalAPIProducao` em `127.0.0.1:8001`. A API interna de producao/piloto usa servico proprio `GeoportalAPIInternaProducao` em `127.0.0.1:8003`, com `IsInternalRuntime=true`, banco `amambaiGis` e GRANTs minimos. Nao reutilizar `GeoportalAPIInternaHomologacao` em `127.0.0.1:8002` para producao real; esse runtime permanece para homologacao interna. Desde o marco operacional de 2026-06-12, o Apache `/api/internal/` aponta para `8003`, com rollback documentado para `8002` se houver necessidade temporaria.

Endpoints nao devem conter SQL direto. A persistencia deve ficar em repositories usando SQLAlchemy Core, bind parameters e transacoes controladas.

Existe script manual para validar o repository contra homologacao sem acoplar o endpoint publico a persistencia real.

A persistencia de solicitacoes e controlada por configuracao (`PERSIST_SOLICITACOES`). O service decide entre modo simulado e repository; o endpoint nao contem SQL.

A geracao de protocolo deve ser segura contra concorrencia, usando sequence do PostgreSQL em vez de `COUNT(*)` ou logica no front-end.

A sequence de protocolo foi validada em homologacao; quando `PERSIST_SOLICITACOES=true`, a geracao real consome `mod_iluminacao.solicitacoes_protocolo_seq` para montar protocolos no formato `IP-YYYY-NNNNNN`.

O fluxo endpoint -> service -> protocol_service -> repository -> banco foi validado em homologacao com persistencia ativa e protocolo real por sequence.

A deteccao leve de duplicidade suspeita e avaliada na camada repository/banco. A regra inicial marca possiveis repeticoes para triagem interna, sem bloquear a solicitacao; protecoes mais fortes e rate limit ficam para etapa posterior.

A camada repository/banco validou em homologacao a marcacao de `duplicidade_suspeita` para solicitacoes semelhantes, mantendo a gravacao normal.

Regra implementada: para `localizacao_tipo = poste_mapa`, se ja existir solicitacao ativa para o mesmo `poste_id`, a API nao cria nova solicitacao e retorna `409 Conflict`. Esta regra substitui a abordagem inicial de apenas marcar `duplicidade_suspeita` nos casos de mesmo poste ativo. Devem ser considerados ativos os status `aberta`, `em_triagem`, `encaminhada`, `em_execucao` e `aguardando_material`; status `concluida`, `cancelada`, `nao_atendida` e `encerrada`, se existir futuramente, permitem nova solicitacao.

O bloqueio inicial vale apenas para solicitacoes com `poste_id`. Solicitacoes `ponto_manual` continuam permitidas nesta etapa; bloqueio espacial por proximidade para pontos manuais deve ser desenhado em fase futura. A resposta publica do bloqueio usa mensagem segura: "Ja existe uma solicitacao aberta para este poste. A equipe responsavel ja foi notificada." A resposta nao retorna protocolo de outra pessoa, dados pessoais, contato, descricao ou detalhes administrativos.

O bloqueio `409 Conflict` por poste ativo foi validado manualmente em ambiente controlado: uma primeira solicitacao criou registro e nova solicitacao para o mesmo poste ativo foi bloqueada, sem expor protocolo de terceiro, contato, nome, descricao ou detalhes administrativos.

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
- Expiracao de sessao ou token.
- Senha armazenada somente como hash adequado.
- Senha nunca armazenada em texto puro.
- Senha e token nunca registrados em log.
- Perfis por secretaria/modulo.
- Permissoes por acao.
- Endpoints internos sempre protegidos.
- Bloqueio/desativacao de usuarios desligados.
- Bloqueio, atraso ou protecao equivalente para tentativas excessivas de login.
- Avaliacao futura de 2FA para perfis sensiveis.

Permissoes devem considerar acoes como visualizar solicitacoes, visualizar detalhe, alterar status, alterar prioridade, registrar observacao, visualizar historico, visualizar estatisticas e administrar usuarios.

O desenho detalhado de perfis (`admin`, `gestor_modulo`, `atendente_triagem`, `equipe_execucao` e `leitura`) e matriz de permissoes esta em `docs/INTERNAL-AUTHORIZATION-PLAN.md`.

O modelo de dados transversal recomendado para usuarios, perfis, permissoes, sessoes e auditoria de login esta em `docs/INTERNAL-AUTH-DATA-MODEL.md`.

O plano tecnico das futuras migrations `0006` a `0009` do schema `mod_auth` esta em `docs/INTERNAL-AUTH-MIGRATIONS-PLAN.md`.

O plano de implementacao segura da autenticacao backend, incluindo threat model, controles e testes obrigatorios, esta em `docs/INTERNAL-AUTH-SECURITY-IMPLEMENTATION-PLAN.md`.

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

Auditoria deve ser obrigatoria para mudancas de status, prioridade, observacoes, anexos, finalizacao, cancelamento e alteracoes administrativas.

Para o modulo interno de Iluminacao Publica, o modelo conceitual das tabelas de historico/auditoria e observacoes internas esta em `docs/ILUMINACAO-INTERNAL-DATA-MODEL.md`. A consulta publica nao deve retornar historico administrativo completo nem observacoes internas. Alteracao de status e alteracao de prioridade devem gravar historico; criacao de observacao deve gravar observacao interna e evento resumido no historico.

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
- `ALLOWED_ORIGINS` real deve ficar fora do Git.
- A origem oficial do Geoportal foi validada em homologacao para acesso aos endpoints publicados via Apache HTTPS.
- O arranjo temporario usa API em `https://geoserver.amambai.ms.gov.br/api/` e front-end em `https://geoportal.amambai.ms.gov.br`, com CORS restrito.
- A rota `https://geoportal.amambai.ms.gov.br/api/` deve ser avaliada futuramente para reduzir dependencia de CORS.
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
- O front-end trata `409 Conflict` por solicitacao ativa no mesmo poste com modal amigavel, mantendo o Google Forms como fallback durante validacao.
- A consulta publica por protocolo foi preparada no front-end por `consultaEnabled=false`, com link discreto no modal de solicitacao pela API; nao ha menu global de consultas nesta etapa.
- O modal de sucesso permite copiar somente o protocolo, e o modal de consulta formata o protocolo no padrao `IP-YYYY-NNNNNN` para reduzir erro de digitacao.
- Apos validacoes, `enabled=false`, `submitEnabled=false` e `PERSIST_SOLICITACOES=false` devem permanecer como padrao seguro; registros de teste devem ser limpos.
- A validacao completa com persistencia ligada em homologacao confirmou gravacao, consulta publica por protocolo, bloqueio `409`, rate limit e permissao minima sem `DELETE` para o usuario restrito da API.
- A producao local foi preparada com schema, tabela, sequences, usuario restrito, servico `GeoportalAPIProducao`, `PERSIST_SOLICITACOES=false` e `POST` simulado sem gravacao no banco ativo.
- A pre-producao foi validada com Apache publico `/api/` apontando para `GeoportalAPIProducao`, ainda sem gravacao real porque `PERSIST_SOLICITACOES=false` permanece ativo.
- A ativacao real controlada em producao foi realizada com `PERSIST_SOLICITACOES=true` fora do Git, validando envio por poste, envio por ponto manual, consulta publica e bloqueio de duplicidade ativa.
- Proxima fase recomendada: modulo interno de gestao, triagem, acompanhamento e encerramento, conforme plano inicial em `docs/ILUMINACAO-INTERNAL-MODULE-PLAN.md`.
- Limpeza de registros de teste deve ser feita apenas com usuario administrativo apropriado.
- Flags temporarias usadas em build de teste publicado devem ser restauradas para `false` antes de commit.
- A configuracao do endpoint de envio deve usar a chave `apiUrl`; erro de grafia pode direcionar a chamada para `/undefined`.
- O Google Forms permanece como fallback enquanto a API estiver em validacao.
- A substituicao definitiva do Forms so deve ocorrer apos testes em homologacao/producao, estabilidade de rede, logs, monitoramento e plano de rollback validados.

## 14.1 Consulta publica de protocolo

A consulta publica de protocolo foi criada no backend e deve permitir ao cidadao acompanhar o andamento sem expor dados sensiveis. A consulta foi validada manualmente em ambiente controlado; o front-end foi preparado por feature flag, desligado por padrao.

Desenho recomendado:

- Endpoint: `POST /api/public/iluminacao/consulta`.
- Preferir `POST` em vez de `GET` para permitir dado complementar de confirmacao, reduzir exposicao do protocolo em URL e reduzir risco de enumeracao.
- Payload: `protocolo` e `contato_confirmacao`, com confirmacao inicial pelos ultimos 4 digitos do contato informado.
- A API nao deve retornar nem comparar publicamente telefone completo.
- Resposta publica limitada a protocolo, status, data de abertura, ultima atualizacao e mensagem publica segura.
- Dados pessoais, contato completo, observacoes internas, detalhes administrativos, id interno, geometria, logs, SQL e dados tecnicos do banco nao devem ser expostos.
- Protocolos inexistentes e confirmacao invalida devem receber resposta generica, sem diferenciar claramente os casos.
- A consulta deve validar formato `IP-YYYY-NNNNNN`, normalizar protocolo, aplicar rate limit e registrar logs seguros sem dados pessoais.
- Captcha ou protecao adicional deve ser avaliado se houver risco de abuso.
- Validacao manual confirmou protocolo correto com confirmacao correta, `404` generico para protocolo inexistente ou confirmacao invalida, `422` para formato invalido e ausencia de dados sensiveis na resposta.
- No front-end, o link "Ja possui protocolo? Consultar andamento" aparece apenas quando o fluxo experimental esta ativo e `consultaEnabled=true`.
- O campo de protocolo no modal de consulta aceita digitacao com ou sem hifens e normaliza para `IP-YYYY-NNNNNN` antes do envio.

## 15. Integracao com ambiente interno

- Painel interno consome endpoints internos.
- Cada acao deve respeitar permissao.
- Cada permissao deve ser validada no backend.
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
5. Documentacao e desenho de autenticacao/autorizacao interna.
6. Modelo de dados de autenticacao/autorizacao em `mod_auth`, ou decisao tecnica equivalente.
7. Migrations de seguranca/autenticacao, planejadas em `docs/INTERNAL-AUTH-MIGRATIONS-PLAN.md`.
8. Autenticacao no backend com testes.
9. Endpoints internos protegidos.
10. Tela interna minima.
11. Auditoria e revisao de seguranca antes de uso por equipe real.

Cada fase deve ter teste, revisao de permissao e possibilidade de rollback.

A primeira abordagem recomendada para homologacao e publicar API e painel interno por rotas, como `/api` e `/interno`, reduzindo complexidade inicial de DNS/certificado e risco de CORS. A separacao por subdominios pode ser adotada futuramente, caso haja necessidade operacional.

Antes de qualquer ativacao publica da API de Iluminacao, seguir `docs/ILUMINACAO-CONTROLLED-ACTIVATION-CHECKLIST.md`, mantendo flags e persistencia desligadas por padrao, Google Forms como fallback e rollback documentado.

## 18. Prova de conceito local

Foi iniciada uma prova de conceito local em `geoportal-backend/`, com FastAPI e endpoints de health check para validar a estrutura inicial da futura API.

Esta prova de conceito nao usa banco de dados, nao possui autenticacao real, nao contem dados sensiveis e nao tem impacto no Geoportal publico em producao.

A POC local tambem possui CORS controlado por configuracao e endpoint `GET /api/version` para identificacao basica do servico.

## 19. Criterios antes de implementar

- [ ] Schema validado.
- [ ] Autenticacao definida.
- [ ] Permissoes definidas.
- [ ] Endpoints desenhados.
- [ ] Autorizacao por perfil desenhada.
- [ ] Testes de acesso autorizado e negado planejados.
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
- `docs/ILUMINACAO-CONTROLLED-ACTIVATION-CHECKLIST.md`.
- `docs/API-SERVER-DEPLOYMENT-PLAN.md`.
- `docs/INTERNAL-AUTH-DATA-MODEL.md`.
- `docs/INTERNAL-AUTH-MIGRATIONS-PLAN.md`.

## 21. Proximos documentos recomendados

- `docs/AUTH-PERMISSIONS-PLAN.md`
- futuro `docs/API-ENDPOINTS-ILUMINACAO.md`
- futuro script SQL versionado
- futura prova de conceito FastAPI em homologacao

## Proximo bloco da arquitetura administrativa

Ordem planejada:

1. criar auditoria administrativa propria e append-only;
2. criar services independentes de validacao de autoelevacao e de preservacao do ultimo administrador efetivo;
3. inventariar e endurecer os endpoints administrativos read-only ja existentes antes de criar novos contratos;
4. somente depois ampliar endpoints mutaveis de usuarios, perfis e permissoes;
5. expor frontend administrativo apenas apos testes de autorizacao, concorrencia, auditoria e privacidade.

Os endpoints read-only devem omitir `senha_hash`, tokens, cookies, segredos, SQL, roles de banco e outros campos sensiveis. Endpoints mutaveis criticos devem exigir sessao, permissao especifica, header interno mutavel, payload estrito, auditoria e salvaguardas transacionais. A existencia parcial de endpoints administrativos no repositorio nao significa que a superficie esta pronta para CRUD visual amplo.
