# Plano de implantacao da API no servidor PostgreSQL/PostGIS

Este documento registra o plano tecnico conceitual para implantar a API FastAPI de Iluminacao Publica no mesmo servidor onde roda o PostgreSQL/PostGIS. Ele nao executa deploy, nao altera codigo e nao registra host real, IP real, porta interna real, usuario real, senha, caminho local real ou `DATABASE_URL` real.

## 1. Decisao arquitetural

- A API nao deve rodar em computador de desenvolvimento.
- A API deve ser implantada no servidor PostgreSQL/PostGIS como servico controlado.
- A API deve usar variaveis reais fora do Git.
- A API deve ser exposta de forma controlada por Apache/proxy reverso/HTTPS.
- O CORS deve ser restrito a origem oficial do Geoportal, sem wildcard.
- Nesta fase experimental, a API publica fica exposta pelo dominio tecnico do GeoServer em `https://geoserver.amambai.ms.gov.br/api/`.
- O front-end oficial em `https://geoportal.amambai.ms.gov.br` acessa a API por CORS restrito e validado.
- Expor a API tambem em `https://geoportal.amambai.ms.gov.br/api/` fica como evolucao futura de infraestrutura.

## 2. Separacao de schemas

- `plano`: dados tecnicos/editaveis do SIG.
- `web_map`: dados publicados para GeoServer/Geoportal.
- `mod_iluminacao`: dados operacionais da API de Iluminacao Publica e futuro modulo interno.

A API de Iluminacao deve gravar e consultar dados operacionais apenas em `mod_iluminacao`.

A API nao deve gravar em:

- `plano`;
- `web_map`.

## 3. Ambientes

### Homologacao

- Usar banco de homologacao.
- Usar schema `mod_iluminacao`.
- Validar deploy da API no servidor.
- Validar persistencia, consulta publica por protocolo, bloqueio `409 Conflict`, rate limit e rollback.

Registro de implantacao: a API foi implantada no servidor PostgreSQL/PostGIS em homologacao como servico Windows controlado. O servico de homologacao foi iniciado com sucesso e escuta internamente em `127.0.0.1:8000`. A exposicao controlada de `/api/` ocorre via Apache HTTPS. A configuracao permanece com `APP_ENV=homologacao` e `PERSIST_SOLICITACOES=false`.

Validacoes realizadas no servidor de homologacao:

- testes automatizados executados com sucesso;
- `/api/health` retornou `200 OK`;
- `/api/public/iluminacao/health` retornou `200 OK`;
- `/api/version` retornou ambiente de homologacao;
- script de solicitacao simulada passou;
- script de consulta inexistente retornou `404` seguro;
- API conectou ao banco de homologacao com usuario restrito;
- backup do arquivo SSL ativo do Apache foi feito antes da alteracao;
- Apache validou sintaxe com `Syntax OK`;
- proxy reverso `/api/` foi configurado para encaminhar ao servico local da API;
- Apache foi reiniciado com sucesso;
- servicos Apache e API permaneceram em execucao;
- `GET /api/health` via HTTPS retornou status ok;
- `GET /api/public/iluminacao/health` via HTTPS retornou status ok;
- `GET /api/version` via HTTPS retornou ambiente de homologacao;
- `POST /api/public/iluminacao/solicitacoes` via HTTPS funcionou com `PERSIST_SOLICITACOES=false`;
- `POST /api/public/iluminacao/consulta` via HTTPS retornou `404` seguro para protocolo inexistente;
- GeoServer continuou acessivel;
- Geoportal publico continuou abrindo e consumindo camadas do GeoServer;
- CORS foi validado para a origem oficial do Geoportal;
- antes do ajuste, origem nao permitida retornava `400 Disallowed CORS origin`;
- `ALLOWED_ORIGINS` real foi ajustado fora do Git e o servico de homologacao foi reiniciado;
- apos o ajuste, a origem oficial passou a ser permitida;
- a investigacao mostrou que os dominios do Geoportal e do GeoServer usam infraestruturas distintas, sem registrar IPs reais;
- a API experimental seguira temporariamente em `https://geoserver.amambai.ms.gov.br/api/`;
- `https://geoportal.amambai.ms.gov.br/api/` fica como opcao futura, dependente de proxy no servidor do front-end ou revisao de DNS/VirtualHost;
- o front-end publicado do Geoportal foi testado com o botao experimental da API habilitado apenas em build controlado;
- a chamada HTTPS para a API no dominio tecnico do GeoServer funcionou com CORS restrito para a origem oficial;
- o envio simulado retornou sucesso no modal do Geoportal;
- com `PERSIST_SOLICITACOES=false`, a API nao gravou novo registro real;
- a conferencia posterior no banco confirmou ausencia de novo registro real;
- `PERSIST_SOLICITACOES` foi ativado temporariamente em homologacao fora do Git para validacao completa;
- o servico de homologacao foi reiniciado e o healthcheck permaneceu ok;
- o front-end publicado enviou solicitacao real via HTTPS para a API;
- a API gravou registros no banco de homologacao;
- a consulta publica por protocolo funcionou sobre os registros de homologacao;
- o bloqueio `409 Conflict` para duplicidade ativa por poste foi validado com mensagem amigavel;
- o rate limit foi acionado durante testes intensivos, validando protecao contra excesso de requisicoes;
- a conferencia no banco confirmou os registros criados em homologacao;
- o usuario restrito da API nao conseguiu executar `DELETE`, confirmando permissao minima;
- a limpeza dos registros de teste exigiu usuario administrativo do banco;
- `PERSIST_SOLICITACOES` foi restaurado para `false` apos a validacao;
- as flags usadas no build de teste foram restauradas para `false` apos a validacao e nao devem ser commitadas como `true`;
- atencao operacional: a chave correta de configuracao do endpoint e `apiUrl`; grafia incorreta pode gerar chamada para `/undefined`;
- origens devem permanecer restritas, sem wildcard;
- `PERSIST_SOLICITACOES=false` permanece como padrao seguro nesta fase;
- a ativacao publica permanente do botao da API ainda depende de revisao operacional e aprovacao gradual.

### Producao

- Usar banco ativo somente apos validacao controlada.
- Usar schema `mod_iluminacao`.
- Ativar somente apos backup, migrations, usuario restrito e validacao controlada.
- Manter Google Forms como fallback ate estabilidade comprovada.

Registro de preparacao da producao local:

- backup manual do banco ativo foi feito antes da criacao do schema `mod_iluminacao`;
- backup foi validado como legivel;
- banco ativo recebeu o schema `mod_iluminacao`;
- tabela `mod_iluminacao.solicitacoes` foi criada;
- sequences `mod_iluminacao.solicitacoes_id_seq` e `mod_iluminacao.solicitacoes_protocolo_seq` foram criadas;
- usuario restrito de producao foi criado e teve login validado, sem registrar senha ou string de conexao;
- permissoes minimas foram validadas: `CONNECT`, `USAGE` no schema, `SELECT`/`INSERT` na tabela e `USAGE`/`SELECT` nas sequences;
- permissoes de `UPDATE` e `DELETE` foram negadas ao usuario restrito;
- arquivo real de ambiente de producao foi criado fora do Git;
- producao permanece com `PERSIST_SOLICITACOES=false`;
- script de execucao de producao foi criado sem registrar caminhos sensiveis;
- servico Windows `GeoportalAPIProducao` foi criado e iniciado;
- homologacao permanece em `127.0.0.1:8000`;
- producao local roda em `127.0.0.1:8001`;
- healthcheck de producao passou;
- `POST` simulado em producao retornou sucesso e nao gravou no banco;
- banco ativo permaneceu sem solicitacoes reais criadas pela API;
- Apache ainda nao foi alterado para apontar `/api/` para producao;
- o proxy publico `/api/` nao deve ser apontado para producao antes de validacao e autorizacao final;
- Google Forms permanece como fallback.

## 4. Usuarios e permissoes de banco

A API nunca deve usar superuser.

A API deve usar usuario restrito, com permissoes minimas:

- `CONNECT` no banco;
- `USAGE` no schema `mod_iluminacao`;
- `INSERT` em `mod_iluminacao.solicitacoes`;
- `SELECT` minimo para consulta publica por protocolo e verificacao de duplicidade ativa;
- `USAGE`/`SELECT` na sequence de protocolo;
- sem `DELETE`;
- sem `CREATE`;
- sem acesso amplo a `plano`;
- sem acesso amplo a `web_map`.

## 5. Etapas futuras de deploy

1. Preparar pasta do backend no servidor.
2. Criar ambiente Python e ambiente virtual.
3. Instalar dependencias.
4. Configurar `.env` real fora do Git.
5. Testar a API localmente no servidor.
6. Transformar a API em servico Windows controlado.
7. Testar healthcheck.
8. Testar endpoints com persistencia desligada.
9. Testar homologacao com persistencia ligada.
10. Manter CORS restrito a origem oficial do Geoportal, com `ALLOWED_ORIGINS` real fora do Git.
11. Manter a API experimental em `https://geoserver.amambai.ms.gov.br/api/` ate decisao de infraestrutura.
12. Testar front-end experimental em build controlado, com flags temporarias e restauradas para `false` apos o teste.
13. Preparar producao local com `PERSIST_SOLICITACOES=false`, servico separado e sem apontar o Apache publico para producao.
14. Somente depois avaliar ativacao publica gradual.

## 6. Evolucao futura de dominio

A opcao `https://geoportal.amambai.ms.gov.br/api/` reduziria a dependencia de CORS por manter front-end e API sob o mesmo dominio publico. Essa opcao nao sera adotada nesta fase porque depende de ajuste de infraestrutura fora da API, como proxy no servidor do front-end ou revisao de DNS/VirtualHost.

Enquanto essa evolucao nao for planejada e validada, o arranjo aceito e:

- front-end oficial: `https://geoportal.amambai.ms.gov.br`;
- API publica experimental: `https://geoserver.amambai.ms.gov.br/api/`;
- CORS restrito permitindo apenas origens oficiais necessarias;
- sem wildcard;
- Google Forms mantido como fallback.

## 7. Relacao com login e painel interno

Login e painel interno devem vir depois da estabilizacao da API publica no servidor.

Essa etapa posterior exigira:

- autenticacao;
- autorizacao por perfil;
- endpoints internos separados;
- auditoria;
- gestao de status;
- historico;
- logs administrativos;
- controle por equipe ou secretaria.

## 8. Seguranca operacional

- Segredos e variaveis reais devem ficar fora do Git.
- Mensagens publicas nao devem expor stack trace, SQL, host, porta, caminho local ou credenciais.
- Logs devem evitar dados pessoais desnecessarios.
- Rate limit deve permanecer ativo nos endpoints publicos.
- A consulta publica deve continuar retornando somente dados publicos minimos.
- A confirmacao da consulta deve usar dado complementar minimo, como os ultimos 4 digitos do contato.
- Protecao contra enumeracao deve ser mantida.
