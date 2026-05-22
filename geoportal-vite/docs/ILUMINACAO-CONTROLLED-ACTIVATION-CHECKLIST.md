# Checklist de ativacao controlada da API de Iluminacao Publica

Este documento registra o roteiro seguro para implantacao controlada da API de Iluminacao Publica em servidor, ativacao gradual do front-end e rollback. Ele nao contem host real, IP interno, usuario, senha, caminho local, `DATABASE_URL` real ou credenciais.

## 1. Estado atual validado

Ja foram validados em ambiente controlado:

- API implantada no servidor PostgreSQL/PostGIS como servico Windows de homologacao;
- servico de homologacao escutando internamente em `127.0.0.1:8000`;
- proxy reverso Apache HTTPS para `/api/` configurado e validado;
- CORS validado para a origem oficial do Geoportal, com `ALLOWED_ORIGINS` real fora do Git;
- API publica experimental definida temporariamente em `https://geoserver.amambai.ms.gov.br/api/`;
- front-end publicado testado em build controlado chamando a API via HTTPS com `PERSIST_SOLICITACOES=false`;
- envio simulado exibiu sucesso no modal do Geoportal sem gravacao real no banco;
- persistencia ligada temporariamente em homologacao e validada de ponta a ponta;
- API gravou registros no banco de homologacao e a consulta publica por protocolo funcionou;
- bloqueio `409 Conflict` por solicitacao ativa no mesmo poste validado em fluxo real;
- rate limit acionado em testes intensivos;
- usuario restrito da API validado sem permissao de `DELETE`;
- limpeza de registros de teste realizada com usuario administrativo;
- producao local preparada com backup validado, schema/tabela/sequences no banco ativo, usuario restrito, servico `GeoportalAPIProducao` e `PERSIST_SOLICITACOES=false`;
- producao local validada em `127.0.0.1:8001` com `POST` simulado sem gravacao real;
- pre-producao validada com Apache publico `/api/` apontando para `GeoportalAPIProducao` em `127.0.0.1:8001`, ainda com `PERSIST_SOLICITACOES=false`;
- `/api/version` via HTTPS retornou ambiente `producao`;
- CORS restrito revalidado com origem oficial permitida e origem invalida bloqueada;
- Geoportal publico, GeoServer e camadas permaneceram funcionando;
- ativacao real controlada em producao realizada com `PERSIST_SOLICITACOES=true` fora do Git;
- envio real por poste e por ponto manual funcionou no front-end publicado;
- consulta publica dos protocolos gerados funcionou;
- duplicidade ativa por poste retornou mensagem amigavel;
- botao Tracar rota e botao do Google Forms continuaram funcionando;
- proxima fase recomendada: modulo interno de gestao, triagem, acompanhamento e encerramento;
- healthchecks e scripts de validacao executados no servidor;
- criacao publica de solicitacao;
- protocolo real por sequence;
- persistencia em homologacao;
- consulta publica por protocolo;
- bloqueio `409 Conflict` para nova solicitacao em poste com solicitacao ativa;
- tratamento amigavel do `409` no front-end;
- front-end experimental por feature flag;
- Google Forms mantido como fallback.

## 2. Padrao seguro obrigatorio

Antes e depois de testes pontuais, os defaults seguros devem permanecer:

- `enabled=false`;
- `submitEnabled=false`;
- `consultaEnabled=false`;
- `PERSIST_SOLICITACOES=false`.

## 3. Pre-requisitos antes de ativar em ambiente real

- [ ] API implantada no servidor correto, nao em computador de desenvolvimento.
- [ ] Plano `docs/API-SERVER-DEPLOYMENT-PLAN.md` revisado.
- [x] Servico da API configurado como servico Windows controlado em homologacao.
- [x] HTTPS e proxy reverso `/api/` configurados e validados em homologacao.
- [x] CORS restrito a origem oficial do Geoportal, sem wildcard.
- [x] Decisao temporaria de usar `https://geoserver.amambai.ms.gov.br/api/` para a API experimental.
- [ ] Evolucao futura `https://geoportal.amambai.ms.gov.br/api/` avaliada por proxy no servidor do front-end ou revisao de DNS/VirtualHost.
- [x] Usuario restrito do banco validado.
- [x] Permissoes minimas no banco validadas, incluindo negacao de `DELETE`.
- [ ] Migrations aplicadas no banco correto.
- [ ] Sequence de protocolo validada.
- [ ] Backup do banco realizado antes da ativacao.
- [x] Backup manual do banco ativo realizado e validado antes da criacao do schema de producao.
- [x] Schema, tabela e sequences do modulo criados no banco ativo.
- [x] Servico Windows `GeoportalAPIProducao` criado e iniciado em producao local.
- [x] Separacao local validada: homologacao em `127.0.0.1:8000` e producao em `127.0.0.1:8001`.
- [x] `POST` simulado em producao validado sem gravacao no banco ativo.
- [x] Apache publico `/api/` apontado para o servico de producao local em pre-producao, com `PERSIST_SOLICITACOES=false`.
- [x] `/api/version` via HTTPS retornando ambiente `producao`.
- [x] CORS restrito revalidado em pre-producao.
- [x] Geoportal publico, GeoServer e camadas validados sem impacto.
- [x] Gravacao real em producao ativada de forma controlada com `PERSIST_SOLICITACOES=true` fora do Git.
- [x] Envio real por poste validado no front-end publicado.
- [x] Envio real por ponto manual validado no front-end publicado.
- [x] Consulta publica dos protocolos gerados validada.
- [x] Bloqueio de duplicidade ativa por poste validado com mensagem amigavel.
- [x] Botao Tracar rota, Google Forms, Geoportal publico, GeoServer e camadas validados apos ativacao real.
- [ ] Logs sem dados sensiveis.
- [x] Rate limit ativo e validado em testes intensivos.
- [ ] Mensagens publicas sem stack trace, SQL, host ou porta.
- [ ] Google Forms funcionando como fallback.
- [x] Ativacao controlada do botao da API validada no front-end publicado com envio simulado.
- [x] Persistencia em homologacao validada de ponta a ponta com `PERSIST_SOLICITACOES=true` temporario.
- [x] Limpeza de registros de teste realizada com usuario administrativo.
- [ ] Ativacao publica permanente do botao da API aprovada apos nova revisao operacional.
- [ ] Conferir antes de cada build se `apiUrl` esta grafado corretamente e se as flags temporarias voltaram para `false`.

## 4. Plano conceitual de deploy no servidor

O deploy tecnico deve seguir `docs/API-SERVER-DEPLOYMENT-PLAN.md`.

1. Copiar o backend para o servidor de aplicacao.
2. Configurar ambiente Python e ambiente virtual.
3. Configurar variaveis de ambiente reais fora do Git.
4. Configurar a API como servico controlado.
5. Configurar proxy reverso e HTTPS.
6. Testar healthcheck.
7. Testar endpoint de criacao com persistencia desligada.
8. Testar persistencia em homologacao.
9. Avaliar ativacao publica somente apos os testes anteriores.

Nao registrar comandos com caminhos reais, credenciais, host real, IP interno ou `DATABASE_URL` real.

## 5. Plano de ativacao gradual

- **Fase A:** API no servidor com persistencia desligada.
- **Status:** fase iniciada em homologacao; API local em `127.0.0.1:8000`, exposicao controlada via Apache HTTPS em `https://geoserver.amambai.ms.gov.br/api/`, CORS validado para a origem oficial e `PERSIST_SOLICITACOES=false`.
- **Fase B:** API no servidor com persistencia ligada em homologacao.
- **Status:** validada de ponta a ponta com `PERSIST_SOLICITACOES=true` temporario, registros confirmados no banco de homologacao, consulta publica funcionando, bloqueio `409` e rate limit validados, limpeza feita por usuario administrativo e `PERSIST_SOLICITACOES=false` restaurado.
- **Fase C0:** producao local preparada sem gravacao publica.
- **Status:** banco ativo recebeu estrutura `mod_iluminacao`, usuario restrito foi validado sem `UPDATE`/`DELETE`, servico `GeoportalAPIProducao` roda em `127.0.0.1:8001`, `PERSIST_SOLICITACOES=false` e `POST` simulado nao gravou no banco.
- **Fase C1:** pre-producao com Apache publico `/api/` apontando para `GeoportalAPIProducao`.
- **Status:** validada via HTTPS com ambiente `producao`, health ok, protocolo simulado no front-end publicado, banco ativo sem solicitacoes, CORS restrito revalidado e Geoportal/GeoServer sem impacto.
- **Fase C2:** ativacao real controlada em producao.
- **Status:** `PERSIST_SOLICITACOES=true` ativado fora do Git, `GeoportalAPIProducao` reiniciado, envios reais por poste e ponto manual funcionando, consulta publica dos protocolos gerados funcionando, bloqueio de duplicidade ativa validado e Google Forms mantido como fallback.
- **Fase C:** front-end com botao experimental visivel apenas para teste controlado.
- **Fase D:** consulta de protocolo ativada apenas para teste controlado.
- **Fase E:** estabilizar transicao e manter Google Forms como fallback ate decisao administrativa.
- **Fase F:** modulo interno de gestao, triagem, acompanhamento e encerramento das solicitacoes, conforme `docs/ILUMINACAO-INTERNAL-MODULE-PLAN.md`.

Proxima fase tecnica: desenvolver modulo interno de gestao/triagem/acompanhamento/encerramento, mantendo Google Forms como fallback durante o periodo de transicao e seguindo o plano inicial documentado em `docs/ILUMINACAO-INTERNAL-MODULE-PLAN.md`.

## 6. Plano de rollback

Em caso de falha, abuso, instabilidade ou comportamento inesperado:

- desligar `enabled`;
- desligar `submitEnabled`;
- desligar `consultaEnabled`;
- voltar `PERSIST_SOLICITACOES=false`;
- restaurar flags temporarias do front-end para `false`;
- manter ou reverter o Apache publico conforme decisao operacional, sempre preservando `PERSIST_SOLICITACOES=false` enquanto a gravacao real nao for autorizada;
- manter Google Forms como canal principal;
- preservar logs para diagnostico;
- limpar registros de teste, se necessario;
- nao apagar protocolos reais sem decisao administrativa.

## 7. Criterios que bloqueiam ativacao publica

Nao ativar publicamente se houver qualquer uma das condicoes abaixo:

- API fora do servidor correto;
- plano de deploy no servidor nao revisado;
- CORS aberto demais;
- uso de wildcard em CORS;
- `ALLOWED_ORIGINS` real versionado no Git;
- flags experimentais commitadas como `true`;
- chave `apiUrl` ausente ou grafada incorretamente, gerando chamadas para `/undefined`;
- tentativa de expor `https://geoportal.amambai.ms.gov.br/api/` sem proxy, DNS/VirtualHost e testes controlados;
- banco usando usuario privilegiado indevido;
- usuario restrito de producao com `UPDATE` ou `DELETE`;
- `PERSIST_SOLICITACOES=true` em producao sem plano de monitoramento, rollback e autorizacao;
- Apache publico apontado para producao sem backup, validacao de sintaxe e rollback;
- ausencia de backup;
- ausencia de plano de rollback;
- ausencia de logs;
- rate limit nao validado;
- instabilidade de rede, firewall ou antivirus nao investigada;
- Google Forms indisponivel como fallback.

## 8. Etapa posterior: painel interno

O painel interno e o login devem ser etapa posterior, apos estabilizar a API publica. Essa etapa deve exigir:

- plano inicial do modulo interno em `docs/ILUMINACAO-INTERNAL-MODULE-PLAN.md`;
- autenticacao;
- autorizacao por perfil;
- endpoints internos separados;
- auditoria;
- gestao de status;
- historico;
- logs administrativos;
- controle por equipe ou secretaria.

## 9. Relacao com menu Consultas

Nesta etapa, a consulta publica por protocolo fica dentro do fluxo de Iluminacao Publica. Um menu global "Consultas" deve ser etapa futura, quando houver mais servicos com protocolo.

## 10. Seguranca e LGPD

- Nao expor contato completo.
- Nao expor nome.
- Nao expor observacoes internas.
- Retornar resposta publica minima.
- Usar confirmacao pelos ultimos 4 digitos do contato.
- Proteger contra enumeracao de protocolos.
- Aplicar rate limit.
- Manter mensagens publicas simples e seguras.
