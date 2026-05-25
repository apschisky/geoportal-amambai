# Geoportal Backend

Prova de conceito local e segura da futura API do Geoportal de Amambai, iniciando pelo modulo de Iluminacao Publica / Manutencao de Postes.

Esta etapa nao conecta banco de dados, nao implementa autenticacao real, nao usa dados de producao e nao integra com o Geoportal publico em producao.

## Como preparar o ambiente

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt -r requirements-dev.txt
```

## Como rodar localmente

```powershell
uvicorn app.main:app --reload
```

## Como executar testes

```powershell
pytest
```

## Configuracao de banco

A conexao com PostgreSQL/PostGIS usa `DATABASE_URL` em arquivo `.env` local ou variavel de ambiente.

O arquivo `.env` real nao deve ser versionado. Use `.env.example` apenas como referencia com placeholders:

```text
DATABASE_URL=postgresql+psycopg://<USER>:<PASSWORD>@<HOST>:<PORT>/<DATABASE>
PERSIST_SOLICITACOES=false
```

Credenciais de banco nunca devem ir para o front-end, Vite ou `dist`. A API roda separada do build do front-end.

`PERSIST_SOLICITACOES` controla a persistencia real:

- `false`: mantem o endpoint em modo simulado, sem gravar no banco, com protocolo fixo de POC/testes.
- `true`: usa o repository e `DATABASE_URL` para gravar em `mod_iluminacao.solicitacoes`, com protocolo gerado pela sequence `mod_iluminacao.solicitacoes_protocolo_seq`.

A sequence do banco evita duplicidade em cenarios concorrentes. Em homologacao/producao, ative apenas apos banco, usuario restrito e testes validados.

A persistencia real com protocolo por sequence ja foi validada em homologacao. Mantenha `PERSIST_SOLICITACOES=false` por padrao e ative `true` somente em ambiente controlado.

Se houver falha temporaria de banco em modo persistente, o endpoint publico retorna `503` com mensagem segura. Detalhes tecnicos, SQL, stack trace e credenciais nao sao expostos ao cidadao.

O retorno `503` seguro para indisponibilidade temporaria de banco foi validado manualmente em ambiente controlado, sem registrar detalhes sensiveis.

O endpoint publico possui rate limit inicial em memoria. O padrao e 5 solicitacoes por IP em 10 minutos; em producao futura, avaliar solucao persistente ou distribuida, como reverse proxy, Redis, WAF ou API gateway.

O retorno `429` do rate limit foi validado manualmente em ambiente controlado. O padrao planejado e 5 solicitacoes por IP em 10 minutos.

O envio real controlado pelo front-end do Geoportal tambem foi validado em homologacao com ativacao temporaria por flags e `PERSIST_SOLICITACOES=true`. A API retornou `201 Created`, o front-end exibiu sucesso com protocolo/status e a gravacao foi confirmada em `mod_iluminacao.solicitacoes`, sem registrar dados reais na documentacao. Apos validacoes, mantenha `enabled=false`, `submitEnabled=false` e `PERSIST_SOLICITACOES=false` por padrao; limpe registros de teste e mantenha o Google Forms como fallback.

O endpoint publico `POST /api/public/iluminacao/consulta` foi criado para consulta por protocolo, com protocolo e dado complementar minimo de confirmacao. Nesta etapa, a confirmacao usa os ultimos 4 digitos do contato informado. A resposta e limitada a protocolo, status, status publico, datas publicas e mensagem segura, sem expor dados pessoais, contato, observacoes internas, detalhes administrativos, id interno, geometria, logs, SQL ou dados tecnicos de banco. O endpoint possui testes automatizados e foi validado manualmente em ambiente controlado, mantendo resposta generica para protocolo inexistente ou confirmacao invalida.

Antes de qualquer ativacao publica da API de Iluminacao, siga o checklist `geoportal-vite/docs/ILUMINACAO-CONTROLLED-ACTIVATION-CHECKLIST.md`. O padrao seguro deve manter `enabled=false`, `submitEnabled=false`, `consultaEnabled=false` e `PERSIST_SOLICITACOES=false`, com Google Forms como fallback.

O plano de implantacao em servidor esta em `geoportal-vite/docs/API-SERVER-DEPLOYMENT-PLAN.md`. A decisao arquitetural e implantar a API no servidor PostgreSQL/PostGIS como servico controlado, com variaveis reais fora do Git, usuario restrito de banco e uso operacional do schema `mod_iluminacao`, sem gravar em `plano` ou `web_map`.

Registro de homologacao: a API foi implantada no servidor PostgreSQL/PostGIS como servico Windows controlado, escutando apenas em `127.0.0.1:8000`. Os testes automatizados, healthchecks, solicitacao simulada e consulta inexistente com `404` seguro foram validados no servidor. `PERSIST_SOLICITACOES=false` permanece como padrao seguro; a exposicao controlada ocorre via Apache HTTPS em `/api/`.

Registro de proxy/HTTPS: o Apache HTTPS foi configurado para encaminhar `/api/` ao servico local da API em `127.0.0.1:8000`. Healthcheck, health de Iluminacao, versao, criacao simulada com `PERSIST_SOLICITACOES=false` e consulta inexistente com `404` seguro foram validados via HTTPS. GeoServer e Geoportal publico permaneceram funcionando. CORS foi validado para a origem oficial do Geoportal, com `ALLOWED_ORIGINS` real fora do Git e sem wildcard. A API experimental seguira temporariamente em `https://geoserver.amambai.ms.gov.br/api/`, acessada pelo front-end oficial em `https://geoportal.amambai.ms.gov.br` por CORS restrito. A opcao `https://geoportal.amambai.ms.gov.br/api/` fica para evolucao futura de infraestrutura. A ativacao publica permanente do botao da API ainda depende de revisao operacional e aprovacao gradual; Google Forms permanece fallback.

Registro de teste do front-end publicado: o Geoportal publicado foi testado em build controlado com o botao experimental da API habilitado temporariamente. A chamada HTTPS para a API no dominio tecnico do GeoServer funcionou com CORS restrito para a origem oficial e o envio simulado retornou sucesso no modal. Como `PERSIST_SOLICITACOES=false` estava ativo, nao houve gravacao real; a conferencia posterior no banco confirmou ausencia de novo registro. As flags temporarias devem voltar para `false` apos testes e nao devem ser commitadas como `true`. A chave correta para o endpoint de envio e `apiUrl`; erro de grafia pode gerar chamada para `/undefined`.

Registro de persistencia em homologacao: o fluxo completo foi validado com `PERSIST_SOLICITACOES=true` ativado temporariamente fora do Git. O servico de homologacao foi reiniciado, o healthcheck permaneceu ok, o front-end publicado enviou solicitacao real via HTTPS, a API gravou registros no banco de homologacao e a consulta publica por protocolo funcionou. O bloqueio `409 Conflict` por duplicidade ativa no mesmo poste retornou mensagem amigavel, o rate limit foi acionado em testes intensivos e o usuario restrito da API nao conseguiu executar `DELETE`. A limpeza dos registros de teste exigiu usuario administrativo. Ao final, `PERSIST_SOLICITACOES=false` foi restaurado; `enabled=false`, `submitEnabled=false` e `consultaEnabled=false` devem permanecer no repositorio. Google Forms permanece fallback.

Registro de preparacao e pre-producao: o banco ativo recebeu a estrutura `mod_iluminacao` apos backup manual validado como legivel. Foram criadas a tabela `mod_iluminacao.solicitacoes` e as sequences `mod_iluminacao.solicitacoes_id_seq` e `mod_iluminacao.solicitacoes_protocolo_seq`. Um usuario restrito de producao foi criado e validado sem registrar senha ou `DATABASE_URL` real; ele possui permissoes minimas para conexao, uso do schema, leitura/insercao na tabela e uso/leitura das sequences, sem `UPDATE` e sem `DELETE`. O arquivo real de ambiente de producao foi criado fora do Git, com `PERSIST_SOLICITACOES=false`. O servico Windows `GeoportalAPIProducao` foi criado e iniciado em `127.0.0.1:8001`, separado da homologacao em `127.0.0.1:8000`. O healthcheck de producao passou, o `POST` simulado retornou sucesso e nao gravou no banco ativo, que permaneceu sem solicitacoes reais criadas pela API. Em pre-producao, apos backup do arquivo ativo do Apache, validacao `Syntax OK` e reinicio bem-sucedido, o Apache publico `/api/` passou a apontar para `GeoportalAPIProducao`. `/api/version` via HTTPS retornou ambiente `producao`, o health publico de Iluminacao retornou ok, `POST` via HTTPS e pelo front-end publicado retornou protocolo simulado, CORS restrito permitiu a origem oficial e bloqueou origem invalida com `400`, e Geoportal publico, GeoServer e camadas continuaram funcionando. Naquele momento, a API ainda nao estava com gravacao real ativa no banco de producao. Google Forms permaneceu fallback.

Registro de ativacao real controlada em producao: `PERSIST_SOLICITACOES=true` foi ativado no ambiente real fora do Git e `GeoportalAPIProducao` foi reiniciado. O front-end publicado enviou solicitacao real por poste e por ponto manual. A consulta publica dos protocolos gerados funcionou, e o bloqueio de duplicidade ativa por poste retornou mensagem amigavel. O botao Tracar rota, o botao de solicitacao via Google Forms, o Geoportal publico, o GeoServer e as camadas permaneceram funcionando. Google Forms permanece como fallback durante o periodo de transicao. A proxima evolucao recomendada e o modulo interno para triagem, acompanhamento e encerramento das solicitacoes, com plano inicial em `geoportal-vite/docs/ILUMINACAO-INTERNAL-MODULE-PLAN.md`.

O desenho conceitual das futuras tabelas internas de historico/auditoria e observacoes esta em `geoportal-vite/docs/ILUMINACAO-INTERNAL-DATA-MODEL.md`.

A migration `0004_create_iluminacao_solicitacoes_historico.sql` foi criada para a tabela interna de historico/auditoria, com rollback correspondente. Sua aplicacao deve ocorrer somente com backup, validacao e autorizacao operacional.

A migration `0005_create_iluminacao_solicitacoes_observacoes.sql` foi criada para a tabela interna de observacoes operacionais, com rollback correspondente. Observacoes internas nao devem aparecer na consulta publica, e a visibilidade `publica_futura` e apenas reserva conceitual, sem exposicao automatica ao cidadao.

As migrations internas `0004` e `0005` foram aplicadas e validadas em homologacao, apos backup manual validado. As tabelas internas foram criadas, FKs restritivas foram testadas, inserts controlados funcionaram e os registros de teste foram removidos, deixando as tabelas internas vazias.

As migrations internas `0004` e `0005` tambem foram aplicadas no banco ativo de producao apos backup manual validado como legivel. Antes da aplicacao, o banco ativo possuia apenas `mod_iluminacao.solicitacoes` entre as tabelas internas. Apos a aplicacao, `mod_iluminacao.solicitacoes_historico` e `mod_iluminacao.solicitacoes_observacoes` foram criadas, os indices foram validados e as FKs restritivas para `mod_iluminacao.solicitacoes(id)` foram confirmadas com `ON UPDATE RESTRICT` e `ON DELETE RESTRICT`. A API publica continuou saudavel, `/api/version` continuou retornando ambiente `producao` e as tabelas internas permaneceram vazias apos a criacao. Ainda nao ha endpoints internos nem tela interna usando essas tabelas; a proxima etapa e desenhar endpoints internos protegidos para status, historico e observacoes.

O desenho conceitual dos endpoints internos protegidos esta em `geoportal-vite/docs/INTERNAL-AUTHORIZATION-PLAN.md`. Endpoints internos ainda nao foram implementados e devem exigir autenticacao, autorizacao no backend e auditoria antes de qualquer publicacao.

O modelo conceitual transversal de autenticacao/autorizacao para futuros modulos internos esta em `geoportal-vite/docs/INTERNAL-AUTH-DATA-MODEL.md`.

O plano tecnico das futuras migrations do schema `mod_auth` esta em `geoportal-vite/docs/INTERNAL-AUTH-MIGRATIONS-PLAN.md`. As migrations de tabelas, sessoes, perfis e permissoes ainda nao foram criadas.

Registro atual: a migration `0006_create_mod_auth_schema.sql` foi aplicada em homologacao e no banco ativo de producao apos backup manual validado. O schema `mod_auth` foi criado com comentario validado, e nenhuma tabela foi criada nesta etapa. O rollback `0006_drop_mod_auth_schema.sql` permanece disponivel para ambiente controlado.

Proxima etapa de banco planejada: migration `0007_create_mod_auth_usuarios.sql`.

## Endpoints disponiveis

- `GET /api/health`
- `GET /api/version`
- `GET /api/public/iluminacao/health`
- `POST /api/public/iluminacao/solicitacoes`
- `POST /api/public/iluminacao/consulta`

Nao ha endpoints internos implementados nesta etapa.

### Exemplo de solicitacao publica simulada com poste no mapa

```json
{
  "localizacao_tipo": "poste_mapa",
  "poste_id": "POSTE-001",
  "coordenada": {
    "latitude": -23.105,
    "longitude": -55.225
  },
  "tipo_problema": "lampada_apagada",
  "descricao": "Lampada apagada durante a noite.",
  "ponto_referencia": "Proximo a praca central.",
  "observacoes_localizacao": null,
  "nome_solicitante": "Solicitante de teste",
  "contato_solicitante": "contato de teste"
}
```

### Exemplo de solicitacao publica simulada com ponto manual

```json
{
  "localizacao_tipo": "ponto_manual",
  "poste_id": null,
  "coordenada": {
    "latitude": -23.106,
    "longitude": -55.226
  },
  "tipo_problema": "poste_danificado",
  "descricao": "Poste nao encontrado no mapa.",
  "observacoes_localizacao": "Pin marcado manualmente no local do poste.",
  "nome_solicitante": "Solicitante de teste",
  "contato_solicitante": "contato de teste"
}
```

Quando o poste nao estiver no mapa, use `localizacao_tipo = "ponto_manual"` e envie a coordenada marcada no mapa com `observacoes_localizacao` ou `ponto_referencia`.

Na primeira versao, `nome_solicitante` e `contato_solicitante` sao obrigatorios porque nao havera login do cidadao e a equipe pode precisar confirmar a localizacao ou detalhes do chamado. Esses dados nao devem ser expostos em mapas ou views publicas.

Com `PERSIST_SOLICITACOES=false`, o endpoint `POST /api/public/iluminacao/solicitacoes` permanece simulado: ele valida o payload e retorna um protocolo ficticio, mas nao grava em banco de dados. Dados reais ainda nao devem ser enviados para esta prova de conceito.

Com `PERSIST_SOLICITACOES=true`, o service usa repository com SQLAlchemy Core para persistir a solicitacao e gerar protocolo pela sequence do banco. A coordenada recebida pela API em EPSG:4326 sera transformada pelo PostGIS para `geometry(Point, 32721)`.

Em modo persistente, o repository marca `duplicidade_suspeita` quando houver solicitacao ativa semelhante nas ultimas 24h para o mesmo poste. Nesta etapa, a solicitacao nao e bloqueada.

A marcacao `duplicidade_suspeita` foi validada em homologacao: a regra inicial apenas encaminha a situacao para triagem interna e nao bloqueia o cidadao.

Regra implementada: para `localizacao_tipo = poste_mapa`, se ja existir solicitacao ativa para o mesmo `poste_id`, o endpoint nao cria nova solicitacao e retorna `409 Conflict`. Status ativos: `aberta`, `em_triagem`, `encaminhada`, `em_execucao` e `aguardando_material`. Status que permitem nova solicitacao: `concluida`, `cancelada`, `nao_atendida` e `encerrada`, se existir futuramente. O escopo inicial nao bloqueia `ponto_manual`; bloqueio espacial por proximidade deve ser etapa futura.

A resposta desse caso usa mensagem publica segura: "Ja existe uma solicitacao aberta para este poste. A equipe responsavel ja foi notificada." A resposta nao retorna protocolo de outra pessoa, dados pessoais, contato, descricao ou detalhes administrativos. Essa regra substitui a abordagem inicial de apenas marcar `duplicidade_suspeita` para casos de mesmo poste ativo.

O bloqueio `409 Conflict` por solicitacao ativa no mesmo poste foi validado manualmente em ambiente controlado: a primeira solicitacao criou registro e a nova solicitacao para o mesmo poste ativo foi bloqueada com mensagem publica segura, sem expor protocolo de terceiro, nome, contato, descricao ou detalhes administrativos. O Google Forms permanece como fallback.

## Teste manual do repository

```powershell
python scripts/test_iluminacao_repository_manual.py
```

Esse teste manual requer `.env` local com `DATABASE_URL`. O endpoint publico nao e alterado por esse script. Ele pode criar registro de teste em homologacao; limpe os dados de teste apos a validacao.

Exemplo de resposta simulada:

```json
{
  "protocolo": "IP-2026-000001",
  "status": "aberta",
  "message": "Solicitacao registrada em ambiente de teste."
}
```

Os status tecnicos usam valores padronizados em minusculo e sem acento. Rotulos amigaveis podem ser tratados futuramente no front-end ou painel interno.

## CORS

As origens permitidas sao lidas da configuracao `ALLOWED_ORIGINS`, em lista separada por virgulas. Para esta POC local, o padrao permite `http://localhost:5195` e `http://127.0.0.1:5195`.

Nao usar `*` como origem permitida em producao.

Em homologacao, CORS foi validado para a origem oficial do Geoportal apos ajuste do ambiente real fora do Git e reinicio do servico. `ALLOWED_ORIGINS` real nao deve ser versionado, e as origens devem permanecer restritas.

Nesta fase, nao usar wildcard para compensar dominios diferentes. A solucao temporaria e manter a API em `https://geoserver.amambai.ms.gov.br/api/` e permitir somente a origem oficial necessaria. A rota `https://geoportal.amambai.ms.gov.br/api/` deve ser avaliada futuramente com proxy no servidor do front-end ou revisao de DNS/VirtualHost.

## Seguranca

- Nao criar `.env` com credenciais no Git.
- Nao incluir senha, token, IP interno, usuario de banco ou dados reais.
- Usar `.env.example` apenas como referencia segura.
- Esta prova de conceito e local/homologacao e nao deve ser apontada para producao.
