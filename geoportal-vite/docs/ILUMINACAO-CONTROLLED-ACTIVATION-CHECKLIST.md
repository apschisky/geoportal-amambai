# Checklist de ativacao controlada da API de Iluminacao Publica

Este documento registra o roteiro seguro para implantacao controlada da API de Iluminacao Publica em servidor, ativacao gradual do front-end e rollback. Ele nao contem host real, IP interno, usuario, senha, caminho local, `DATABASE_URL` real ou credenciais.

## 1. Estado atual validado

Ja foram validados em ambiente controlado:

- API implantada no servidor PostgreSQL/PostGIS como servico Windows de homologacao;
- servico de homologacao escutando internamente em `127.0.0.1:8000`;
- proxy reverso Apache HTTPS para `/api/` configurado e validado;
- CORS validado para a origem oficial do Geoportal, com `ALLOWED_ORIGINS` real fora do Git;
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
- [ ] Usuario restrito do banco validado.
- [ ] Permissoes minimas no banco.
- [ ] Migrations aplicadas no banco correto.
- [ ] Sequence de protocolo validada.
- [ ] Backup do banco realizado antes da ativacao.
- [ ] Logs sem dados sensiveis.
- [ ] Rate limit ativo.
- [ ] Mensagens publicas sem stack trace, SQL, host ou porta.
- [ ] Google Forms funcionando como fallback.
- [ ] Ativacao publica do botao da API validada de forma controlada no front-end publicado.

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
- **Status:** fase iniciada em homologacao; API local em `127.0.0.1:8000`, exposicao controlada via Apache HTTPS em `/api/`, CORS validado para a origem oficial e `PERSIST_SOLICITACOES=false`.
- **Fase B:** API no servidor com persistencia ligada em homologacao.
- **Fase C:** front-end com botao experimental visivel apenas para teste controlado.
- **Fase D:** consulta de protocolo ativada apenas para teste controlado.
- **Fase E:** avaliar substituicao do Google Forms somente apos estabilidade comprovada.

Proxima fase tecnica: testar a ativacao publica controlada no front-end publicado, mantendo flags seguras por padrao e sem substituicao imediata do Google Forms.

## 6. Plano de rollback

Em caso de falha, abuso, instabilidade ou comportamento inesperado:

- desligar `enabled`;
- desligar `submitEnabled`;
- desligar `consultaEnabled`;
- voltar `PERSIST_SOLICITACOES=false`;
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
- banco usando usuario privilegiado indevido;
- ausencia de backup;
- ausencia de plano de rollback;
- ausencia de logs;
- rate limit nao validado;
- instabilidade de rede, firewall ou antivirus nao investigada;
- Google Forms indisponivel como fallback.

## 8. Etapa posterior: painel interno

O painel interno e o login devem ser etapa posterior, apos estabilizar a API publica. Essa etapa deve exigir:

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
