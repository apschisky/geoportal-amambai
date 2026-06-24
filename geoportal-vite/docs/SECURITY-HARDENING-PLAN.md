# Plano de Endurecimento de Segurança do Geoportal de Amambai

Este plano orienta a evolucao segura do Geoportal publico ate a implantacao de modulos internos, API, login, usuarios, permissoes, anexos, protocolos e dados operacionais.

## 1. Objetivo

Definir criterios e acoes de endurecimento para reduzir riscos antes de ampliar o Geoportal para servicos internos. O objetivo e manter o mapa publico estavel e separar claramente o que pode ser publico do que deve ser protegido por API, autenticacao, autorizacao, auditoria e regras operacionais.

Antes de avançar em autenticação interna, consulte `docs/INTERNAL-AUTH-TECHNICAL-DECISIONS.md` para as decisões técnicas iniciais de hash, sessão, transporte e autorização.

## 1.1 Etapa 0 — Segurança administrativa antes do CRUD

Antes de abrir qualquer tela administrativa, endpoint de criação/alteração de usuário, perfil ou permissão, o projeto deve completar uma etapa preventiva de segurança chamada Etapa 0.

Estado atual registrado:
- O projeto já possui controles iniciais de autenticação interna com rotas internas sob feature flag, cookie HttpOnly/Secure/SameSite para navegador, revogação lógica de sessão no logout, respostas 401/403 genéricas e autorização por permissão em endpoints internos.
- O estado atual não deve ser interpretado como “painel administrativo aberto” nem como “CRUD administrativo pronto”.

Primeiro reforço concluído localmente antes do CRUD administrativo:
- Rate limit de login por IP e por IP+login, com resposta genérica e sanitizada.
- Tratamento seguro do IP real atrás do Apache/proxy, sem confiança cega em `X-Forwarded-For` ou `X-Real-IP`.
- Testes automatizados para tentativas excessivas, spoofing de headers e preservação do login normal.

Itens ainda pendentes antes do primeiro CRUD administrativo:
- Validação controlada do reforço no servidor/homologação e dos headers efetivamente produzidos pelo Apache.
- Ampliação dos testes de acesso negado, bloqueio de conta e revogação de sessão conforme os próximos endpoints administrativos forem desenhados.
- Regras explícitas de anti-elevação, proteção contra remover o último administrador e auditoria administrativa.
- Política de permissões administrativas separada da autorização de negócio, sem bypass por login hardcoded.
- Proteção de infraestrutura contra abuso volumétrico (DDoS/abuso de login); o FastAPI sozinho não resolve ataques de camada 3/4/7 em escala.

Conclusão operacional:
- A Etapa 0 é requisito documental e operacional antes do CRUD administrativo.
- Enquanto ela não estiver concluída e validada em homologação, o projeto deve manter os fluxos administrativos fechados, sem tela administrativa pública e sem criação/alteração de usuários reais em produção.

Atualização documental 2026-06-24 (commits `152c177` e `f3d8ff3`): o primeiro reforço da Etapa 0 foi implementado localmente e enviado ao GitHub. O marco registra:
- resolução segura de IP real por meio do helper `geoportal-backend/app/core/client_ip.py`;
- aceitação conservadora de `X-Forwarded-For` e `X-Real-IP` apenas de peer confiável e com valor único válido;
- rate limit do login interno por IP, por login/origem e por IP+login usando a auditoria existente em `mod_auth.login_auditoria`;
- resposta `429 Too many authentication attempts` sanitizada, sem revelar existência de usuário nem contador;
- preservação dos motivos de auditoria `rate_limit`, `rate_limit_ip` e `rate_limit_ip_login`;
- suporte a `RATE_LIMIT_ENABLED=false` como desligamento explícito do rate limit, sem interromper a autenticação comum.

Pendências de validação antes do CRUD administrativo:
- confirmar no ambiente real se o Apache encaminha `X-Forwarded-For` e `X-Real-IP` como esperado;
- confirmar se o backend enxerga IP real ou apenas `127.0.0.1` no runtime interno;
- validar em homologação/servidor se o `429` aparece corretamente sem expor usuário;
- validar que o login normal continua operacional e que a auditoria registra motivos de rate limit sem impacto indevido em usuários legítimos.

Matriz de controles deste reforço:

| Controle | Estado atual | Evidência/limite |
|---|---|---|
| Resolução segura do IP do cliente | Implementado localmente | `app/core/client_ip.py`; usa o peer imediato como fallback |
| Confiança em proxy | Implementado localmente | Default restrito a `127.0.0.1` e `::1`; configuração externa permanece pendente de validação |
| `X-Forwarded-For` | Implementado localmente | Aceito somente de peer confiável e com exatamente um IP válido; cadeia múltipla é rejeitada |
| `X-Real-IP` | Implementado localmente | Aceito somente de peer confiável e com valor único válido |
| Rate limit por login/origem | Implementado localmente | 5 falhas em 15 minutos |
| Rate limit por IP | Implementado localmente | 20 falhas em 15 minutos |
| Rate limit por IP+login | Implementado localmente | 5 falhas em 15 minutos |
| Resposta para excesso | Implementado localmente | `429` genérico, sem usuário, contador ou escopo bloqueado |
| Privacidade do IP | Implementado localmente | HMAC-SHA256 truncado; IP bruto não é persistido por esse fluxo |
| Persistência entre workers/processos | Implementado localmente | Contagem em `mod_auth.login_auditoria`, sem migration nova |
| Validação dos headers reais do Apache | Pendente | Exige pull e validação controlada em servidor/homologação |
| Defesa contra DDoS volumétrico | Fora do escopo da aplicação | Depende de Apache, firewall, WAF/CDN, provedor ou VPN |

## 2. Principios de seguranca

- [ ] Seguranca em camadas: servidor, proxy, GeoServer, banco, API e front-end.
- [ ] Menor privilegio para usuarios, servicos e contas de banco.
- [ ] Separacao clara entre ambiente publico e ambiente interno.
- [ ] Nenhum segredo, token, senha ou chave privada no front-end.
- [ ] Dados sensiveis sempre protegidos por API, view controlada ou permissao.
- [ ] Validacao de entrada sempre no servidor.
- [ ] Auditoria obrigatoria em modulos internos.
- [ ] Backup, restore e rollback planejados antes de publicar fluxos operacionais.

## 3. Camada servidor Windows

- [ ] Sistema operacional atualizado.
- [ ] Antivirús/antimalware ativo e monitorado.
- [ ] Firewall ativo.
- [ ] Apenas portas necessarias abertas.
- [ ] Acesso remoto restrito por usuario, IP ou VPN quando possivel.
- [ ] Usuarios administrativos controlados e revisados.
- [ ] Logs do Windows monitorados.
- [ ] Politica de senhas fortes.
- [ ] Backup externo ou offline para cenarios de falha grave.

## 4. Apache/Tomcat

- [ ] HTTPS obrigatorio.
- [ ] Headers de seguranca revisados.
- [ ] Adicionar cabeçalhos de seguranca no Apache/proxy: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` e `Strict-Transport-Security` quando HTTPS estiver consolidado.
 - [x] Adicionar cabeçalhos de seguranca no Apache/proxy (parcial): aplicados e validados no `VirtualHost *:443` de `geoserver.amambai.ms.gov.br`:
	 - `Header always set X-Content-Type-Options "nosniff"`
	 - `Header always set Referrer-Policy "strict-origin-when-cross-origin"`
	 - `Header always set Permissions-Policy "geolocation=(), microphone=(), camera=()"`
	 - Validação: backup do `httpd-ssl.conf`, `httpd.exe -t` -> `Syntax OK`, Apache reiniciado e endpoints validados. CORS e serviços permaneceram funcionais.
	 - Observação: `X-Content-Type-Options` apareceu como `nosniff,nosniff` em `/geoserver` (possível duplicidade com GeoServer/Tomcat) — registrar para ajuste fino.
	 - Itens pendentes por cautela: `X-Frame-Options`, `Strict-Transport-Security` (HSTS) e `Content-Security-Policy`.
 - [ ] Avaliar ocultacao ou substituicao do header `Server` no proxy para evitar expor `uvicorn`.
 - [x] Ajustar mensagem publica de sucesso em producao para evitar texto de ambiente de teste. Status: implementado e validado em testes automatizados, homologação, produção local e URL pública.
 - [x] Criar tratamento global de erro de validacao para evitar ecoar input bruto em respostas `422`. Status: implementado e validado em testes automatizados, homologação, produção local e URL pública.
- [ ] Proxy reverso revisado.
- [ ] Versoes ocultadas quando possivel.
- [ ] Metodos HTTP desnecessarios limitados.
- [ ] Logs de acesso monitorados.
- [ ] Logs de erro monitorados.
- [ ] Timeouts configurados.
- [ ] Protecao contra exposicao de diretorios.
- [ ] Publicacao do front-end feita apenas a partir de build de producao.

## 5. GeoServer

- [ ] Usuario admin protegido.
- [ ] Senha forte e nao compartilhada.
- [ ] Servicos nao usados desativados ou restritos.
- [ ] Permissoes revisadas por workspace/layer.
- [ ] Dados sensiveis nao publicados diretamente.
- [ ] Dados sensiveis publicados apenas por views controladas, quando necessario.
- [ ] WFS restrito quando nao for necessario.
- [ ] GetFeatureInfo revisado para camadas publicas.
- [ ] Campos expostos revisados camada por camada.
- [ ] Logs do GeoServer monitorados.
- [ ] Backup do `data_dir` do GeoServer.

## 6. PostgreSQL/PostGIS

- [ ] Usuarios separados por finalidade.
- [ ] GeoServer usando usuario somente leitura sempre que possivel.
- [ ] Schemas separados, por exemplo: `web_map`, `operacional`, `auditoria`, `auth` e schemas por modulo.
- [ ] Permissoes minimas por schema, tabela e view.
- [ ] Acesso externo restrito por IP.
- [ ] `pg_hba.conf` revisado.
- [ ] Senhas fortes.
- [ ] Backup automatizado.
- [ ] Restore testado periodicamente.
- [ ] Logs de conexao e erro monitorados.
- [ ] Dados sensiveis fora de schemas publicos.

## 7. Front-end publico

- [ ] `escapeHtml` usado em dados vindos do GeoServer antes de inserir em HTML.
- [ ] Tokens, chaves e credenciais ausentes do front-end.
- [ ] Endpoints internos nao expostos no front-end publico.
- [ ] Integracao inicial com API publica de Iluminacao feita em paralelo ao Google Forms.
- [ ] Botao atual do Google Forms mantido ativo durante validacao.
- [ ] Botao de teste da API controlado por feature flag ou configuracao do front-end.
- [ ] Envio real do botao de teste mantido desligado por padrao com `submitEnabled=false` ate validacao em ambiente controlado.
- [x] Envio real controlado pelo front-end validado em homologacao com flags ativadas temporariamente, persistencia ativa, retorno `201 Created` e modal publico de sucesso.
- [x] Front-end publicado testado em build controlado chamando a API HTTPS no dominio tecnico do GeoServer, com CORS restrito funcionando e `PERSIST_SOLICITACOES=false` sem gravacao real.
- [x] Fluxo completo com persistencia ligada validado em homologacao: gravacao, consulta publica por protocolo, bloqueio `409`, rate limit e limpeza controlada.
- [x] Estrutura local de producao preparada com backup validado, schema/tabela/sequences, usuario restrito, servico `GeoportalAPIProducao` e `PERSIST_SOLICITACOES=false`.
- [x] Producao local validada em `127.0.0.1:8001` com healthcheck e `POST` simulado sem gravacao real.
- [x] Pre-producao validada com Apache publico `/api/` apontando para `GeoportalAPIProducao` em `127.0.0.1:8001`, ainda com `PERSIST_SOLICITACOES=false`.
- [x] `/api/version` via HTTPS retornando ambiente `producao`, CORS restrito revalidado e Geoportal/GeoServer sem impacto.
- [x] Ativacao real controlada em producao realizada com `PERSIST_SOLICITACOES=true` fora do Git.
- [x] Envios reais por poste e por ponto manual validados no front-end publicado.
- [x] Consulta publica dos protocolos gerados e bloqueio de duplicidade ativa por poste validados.
- [x] Botao Tracar rota, Google Forms, Geoportal publico, GeoServer e camadas permaneceram funcionando.
- [ ] Desenvolver modulo interno de gestao, triagem, acompanhamento e encerramento das solicitacoes, seguindo `docs/ILUMINACAO-INTERNAL-MODULE-PLAN.md` e `docs/INTERNAL-AUTHORIZATION-PLAN.md`.
- [x] Criar e aplicar migrations de historico/auditoria e observacoes internas conforme `docs/ILUMINACAO-INTERNAL-DATA-MODEL.md`.
- [ ] Restaurar `enabled=false`, `submitEnabled=false` e `PERSIST_SOLICITACOES=false` como padrao seguro apos testes e limpar registros de validacao.
- [ ] Garantir que flags temporarias de teste nao sejam commitadas como `true`.
- [ ] Conferir grafia da chave `apiUrl` antes de publicar build experimental, evitando chamadas para `/undefined`.
- [ ] Google Forms mantido como fallback ate estabilidade comprovada.
- [ ] Links externos com `rel="noopener noreferrer"`.
- [ ] Popups sem dados sensiveis.
- [ ] Camadas publicas revisadas.
- [ ] Mensagens de erro sem detalhes tecnicos sensiveis.
- [ ] Build de producao publicado via `dist`.
- [ ] `npm.cmd test` executado antes de publicar.
- [ ] `npm.cmd run build` executado antes de publicar.

## 8. Futuras APIs/FastAPI

- [ ] Autenticacao definida.
- [ ] Autorizacao por papel/permissao.
- [ ] Endpoints internos protegidos por backend, nao apenas por front-end.
- [ ] Validacao de entrada com schemas.
- [ ] Rate limit para endpoints sensiveis.
- [ ] Logs de auditoria.
- [x] CORS restrito validado para a origem oficial do Geoportal, sem wildcard.
- [ ] Endpoints publicos separados dos internos.
- [ ] Paginacao em listagens.
- [ ] Protecao contra enumeracao de IDs.
- [ ] Tratamento seguro de erros.
- [x] Resposta segura de erro validada no endpoint de Iluminacao, sem detalhes internos, SQL, host, porta, credenciais ou stack trace.
- [ ] Nenhum segredo no codigo.
- [ ] Credenciais por variaveis de ambiente.
- [ ] Credenciais de banco apenas em variavel de ambiente ou arquivo local nao versionado.
- [ ] Nunca usar `DATABASE_URL` em variavel `VITE_`.
- [ ] API sem usuario superuser do PostgreSQL.
- [x] API com usuario restrito por modulo/ambiente.
- [ ] Permissoes minimas por modulo.
- [ ] Sem acesso direto a schemas `plano`/`web_map`, salvo necessidade futura muito bem justificada.
- [ ] Implantar API de Iluminacao no servidor PostgreSQL/PostGIS como servico controlado, seguindo `docs/API-SERVER-DEPLOYMENT-PLAN.md`.
- [x] Registrar implantacao de homologacao da API como servico Windows controlado, com escuta local em `127.0.0.1:8000` e exposicao controlada via Apache HTTPS em `/api/`.
- [x] Configurar e validar proxy reverso Apache HTTPS para `/api/`, encaminhando ao servico local em `127.0.0.1:8000`.
- [x] Validar CORS para a origem oficial do Geoportal antes de ativar o front-end publico.
- [x] Registrar uso temporario da API publica experimental em `https://geoserver.amambai.ms.gov.br/api/`.
- [ ] Avaliar futuramente `https://geoportal.amambai.ms.gov.br/api/` com proxy no servidor do front-end ou revisao de DNS/VirtualHost.
- [ ] Manter `ALLOWED_ORIGINS` real fora do Git e sem wildcard.
- [x] Testar ativacao publica controlada do botao da API no front-end publicado com envio simulado.
- [ ] Avaliar ativacao publica permanente somente apos revisao operacional.
- [ ] Garantir que a API grave dados operacionais apenas em `mod_iluminacao`, sem gravar em `plano` ou `web_map`.
- [x] Manter persistencia desativada por padrao.
- [x] Ativar persistencia apenas em ambiente controlado com usuario restrito e `DATABASE_URL` segura.
- [x] Padrao de usuario restrito da API validado em homologacao, sem superuser e sem acesso direto a schemas nao necessarios.
- [x] Usuario restrito da API sem permissao de `DELETE`; limpeza de testes exige usuario administrativo.
- [x] Usuario restrito de producao validado sem `UPDATE` e sem `DELETE`.
- [ ] Investigar estabilidade de rede, firewall e antivirus entre API e PostgreSQL antes de uso continuo.
- [x] Deteccao leve de duplicidade suspeita implementada e validada antes de rate limit.
- [x] Rate limit inicial em memoria implementado e validado em desenvolvimento/homologacao.
- [x] Rate limit acionado durante testes intensivos do fluxo publicado em homologacao.
- [ ] Rate limit definitivo para producao ainda pendente, com avaliacao de proxy, Redis, WAF ou API gateway.
- [ ] Documentacao controlada da API.
- [ ] Inventario de endpoints.
- [x] Implementar bloqueio de nova solicitacao `poste_mapa` quando ja houver solicitacao ativa para o mesmo `poste_id`, retornando `409 Conflict` seguro e sem expor dados de outra pessoa.
- [ ] Seguir `docs/INTERNAL-AUTHORIZATION-PLAN.md` antes de implementar `/api/internal/...`.

## 9. Protecao contra abuso em endpoints publicos

- [ ] Aplicar rate limit por IP no futuro, com limite de chamadas por periodo.
- [x] Proteger contra multiplos chamados para o mesmo poste: bloquear nova solicitacao quando o mesmo `poste_id` ja tiver status ativo (`aberta`, `em_triagem`, `encaminhada`, `em_execucao` ou `aguardando_material`).
- [ ] Permitir nova solicitacao para o mesmo poste apenas quando o chamado anterior estiver em status final (`concluida`, `cancelada`, `nao_atendida` ou `encerrada`, se existir futuramente).
- [x] Garantir que o bloqueio por duplicidade ativa retorne mensagem publica segura, sem protocolo de outra pessoa, dados pessoais, contato, descricao ou detalhes administrativos.
- [x] Validar manualmente o `409 Conflict` para nova solicitacao em poste com solicitacao ativa, mantendo Google Forms como fallback.
- [ ] Proteger chamados manuais proximos usando PostGIS no futuro.
- [ ] Avaliar CAPTCHA, Turnstile ou reCAPTCHA se houver abuso automatizado.
- [ ] Nao logar dados pessoais desnecessariamente.
- [ ] Evitar armazenar IP puro sem politica de retencao/LGPD.
- [ ] Proteger consulta publica por protocolo contra enumeracao.
- [ ] Limitar consulta publica por protocolo a protocolo, status, datas publicas e mensagens seguras, sem dados pessoais, contato, observacoes internas ou detalhes administrativos.
- [x] Criar backend da consulta publica como `POST /api/public/iluminacao/consulta`, com protocolo e confirmacao minima, evitando protocolo em URL.
- [x] Validar manualmente consulta publica por protocolo em ambiente controlado, com resposta publica filtrada e `404` generico para protocolo inexistente ou confirmacao invalida.
- [x] Preparar consulta publica por protocolo no front-end atras de `consultaEnabled=false`, com link discreto no modal experimental e sem menu global de consultas.
- [ ] Ativar consulta publica por protocolo no front-end somente apos validacao controlada.
- [ ] Usar resposta generica para protocolo inexistente ou confirmacao invalida, sem diferenciar claramente os casos.
- [ ] Validar formato `IP-YYYY-NNNNNN`, normalizar protocolo, aplicar rate limit e avaliar captcha/protecao adicional se necessario.
- [ ] Seguir `docs/ILUMINACAO-CONTROLLED-ACTIVATION-CHECKLIST.md` antes de qualquer ativacao publica da API de Iluminacao.
- [ ] Revisar periodicamente a API publica conforme `docs/PUBLIC-API-SECURITY-REVIEW.md`.

## 10. Usuarios, login e permissoes

- [ ] Usuarios individuais, nunca compartilhados.
- [ ] Modelo transversal de autenticacao/autorizacao em `mod_auth`, seguindo `docs/INTERNAL-AUTH-DATA-MODEL.md`.
- [ ] Migrations futuras de `mod_auth` planejadas conforme `docs/INTERNAL-AUTH-MIGRATIONS-PLAN.md`, sem usuarios, senhas, hashes ou tokens reais.
- [ ] Revisao defensiva da API publica concluida conforme `docs/PUBLIC-API-SECURITY-REVIEW.md` antes dos endpoints internos.
- [ ] Implementacao da autenticacao backend deve seguir `docs/INTERNAL-AUTH-SECURITY-IMPLEMENTATION-PLAN.md` antes de qualquer endpoint interno publicado.
- [ ] Perfis por secretaria e modulo: `admin`, `gestor_modulo`, `atendente_triagem`, `equipe_execucao` e `leitura`, ou equivalentes validados.
- [ ] Permissoes por acao: visualizar solicitacoes, visualizar detalhe, alterar status, alterar prioridade, registrar observacao, visualizar historico, visualizar estatisticas e administrar usuarios.
- [ ] Auditoria de login.
- [ ] Auditoria de alteracao de dados.
- [ ] Bloqueio ou desativacao de usuarios desligados.
- [ ] Politica de senha.
- [ ] Avaliacao futura de 2FA para perfis sensiveis.
- [ ] Sessoes ou tokens com expiracao.
- [ ] Senhas armazenadas somente como hash adequado.
- [ ] Senhas, tokens e `DATABASE_URL` ausentes de logs.
- [ ] Bloqueio, atraso ou protecao equivalente contra tentativas excessivas de login.
- [ ] Testes automatizados para acesso autorizado e negado.

## 11. Auditoria e rastreabilidade

Registrar, conforme o modulo:

- [ ] Quem criou.
- [ ] Quem alterou.
- [ ] Quando alterou.
- [ ] Dado anterior e novo, quando aplicavel.
- [ ] IP/origem quando possivel.
- [ ] Status do processo ou solicitacao.
- [ ] Anexos enviados.
- [ ] Fechamento ou finalizacao de atendimento.
- [ ] Historico de encaminhamentos.
- [ ] Alteracao de status sempre gravada em `mod_iluminacao.solicitacoes_historico`.
- [ ] Alteracao de prioridade sempre gravada em `mod_iluminacao.solicitacoes_historico`.
- [ ] Criacao de observacao gravada em `mod_iluminacao.solicitacoes_observacoes` e resumida no historico.
- [ ] Consulta publica sem observacoes internas e sem historico administrativo completo.

## 12. Backups, rollback e continuidade

- [ ] Backup do PostgreSQL.
- [ ] Backup do GeoServer `data_dir`.
- [ ] Backup do front-end publicado.
- [ ] Backup de configuracao Apache/Tomcat.
- [ ] Teste periodico de restauracao.
- [ ] Procedimento de rollback de versao do front-end.
- [ ] Documentacao dos caminhos, scripts e responsaveis.
- [ ] Retencao minima definida para backups.

### 12.1. Producao interna/piloto de Iluminacao

Para ampliar o MVP interno de Iluminacao para usuarios reais alem do piloto controlado em `amambaiGis`, seguir o runbook em `docs/API-SERVER-DEPLOYMENT-PLAN.md`, secao "Marco operacional da producao interna de Iluminacao - 2026-06-12".

Bloqueadores de seguranca para essa ativacao:

- [ ] backup validado de `amambaiGis` e rollback definido;
- [ ] inventario de schema e GRANTs de producao concluido;
- [ ] comparacao `amambaiGis_homologacao` x `amambaiGis` concluida sem lacunas inexplicadas;
- [x] `GeoportalAPIInternaProducao` criado e validado em `127.0.0.1:8003`, sem reutilizar `GeoportalAPIInternaHomologacao` como producao real;
- [x] portas internas `8002` e `8003` mantidas sem exposicao direta externa;
- [x] Apache `/api/internal/` apontando para `8003`, com rollback documentado para `8002`;
- [ ] cookie de sessao validado em HTTPS sem copiar valores (`HttpOnly`, `Secure`, `SameSite`);
- [x] perfis do piloto com menor privilegio validados, incluindo `manutencao-iluminacao` sem `admin.*` e sem `iluminacao.solicitacoes.atualizar_prioridade`;
- [x] mutacoes internas validadas com sessao, permissao e `X-Geoportal-Internal-Request: 1`, incluindo observacao interna, alteracao normal de status e alteracao de prioridade;
- [x] correcao administrativa de status validada por API direta em producao interna com permissao propria `iluminacao.solicitacoes.corrigir_status`, sem conceder a permissao ao perfil `manutencao-iluminacao`;
- [x] validacao negativa zero-write de `status-correcao` confirmou 403/422/404 esperados sem alterar `status`, `atualizado_em` ou `finalizado_em` do chamado teste/controlado;
- [x] tentativa de bootstrap da permissao com role runtime bloqueada por falta de privilegio em `mod_auth.permissoes`, confirmando menor privilegio; criacao/vinculo executados por procedimento operacional controlado com backup previo;
- [x] frontend administrativo de `status-correcao` foi implementado e validado em producao interna, restrito a `iluminacao.solicitacoes.corrigir_status`, separado do fluxo normal, com modal de confirmacao forte, justificativa obrigatoria, recarga de detalhe/historico e sem exposicao para `manutencao-iluminacao`;
- [ ] console, logs e documentacao sem senha, token, cookie, observacoes reais ou dados pessoais reais.

## 13. Monitoramento e resposta a incidentes

- [ ] Acompanhar logs de Apache.
- [ ] Acompanhar logs do Tomcat.
- [ ] Acompanhar logs do GeoServer.
- [ ] Acompanhar logs do PostgreSQL.
- [ ] Registrar tentativas suspeitas.
- [ ] Procedimento basico para invasao ou suspeita.
- [ ] Isolamento do servico afetado.
- [ ] Restauracao por backup.
- [ ] Troca de senhas e revisao de acessos apos incidente.
- [ ] Registro pos-incidente com causa, impacto e correcao.

## 14. Criterios minimos antes de iniciar modulos internos

Antes de iniciar modulos com login/API, deve existir:

- [ ] Plano de schemas.
- [ ] Plano de usuarios e permissoes.
- [ ] Plano de auditoria.
- [ ] Plano de autenticacao e autorizacao interna revisado.
- [ ] Plano de backup.
- [ ] Separacao clara entre publico e interno.
- [ ] Modulo piloto definido.
- [ ] Ambiente de homologacao ou estrategia segura de testes.
- [ ] Checklist de seguranca revisado.
- [ ] Inventario de camadas e dados sensiveis.
- [ ] Estrategia de publicacao e rollback.
- [ ] Substituicao definitiva do Google Forms aprovada somente apos testes em homologacao/producao, estabilidade de rede, logs, monitoramento e rollback validados.

## 15. Relacao com outros documentos

Este plano deve ser lido junto com:

- `docs/GEOPORTAL-MATURITY-CHECKLIST.md`
- `docs/FRONTEND-ARCHITECTURE.md`
- `docs/TESTING-PLAN.md`
- futuro `docs/INTERNAL-MODULES-ARCHITECTURE.md`
- futuro `docs/MODULE-ILUMINACAO-PUBLICA.md`
- futuro `docs/LAYER-INVENTORY.md`
- `docs/INTERNAL-AUTHORIZATION-PLAN.md`
- `docs/INTERNAL-AUTH-DATA-MODEL.md`
- `docs/INTERNAL-AUTH-MIGRATIONS-PLAN.md`

## 16. Nivel atual e caminho recomendado

Nivel atual estimado: **base publica em amadurecimento, ainda antes do nivel seguro para modulos internos com login/API**.

Pontos fortes atuais:

- [x] Geoportal publico online e funcional.
- [x] Front-end modular documentado.
- [x] Testes unitarios existentes.
- [x] Build estavel.
- [x] Estados criticos do front-end sendo centralizados.
- [x] Cuidados ja existentes com `escapeHtml`, links externos e separacao gradual de responsabilidades.

Etapas recomendadas para chegar a um nivel seguro:

1. Consolidar o Geoportal publico com checklist manual recorrente.
2. Criar inventario de camadas, campos expostos e sensibilidade dos dados.
3. Revisar permissoes do GeoServer e do PostgreSQL.
4. Separar schemas publicos, operacionais, autenticacao e auditoria.
5. Definir o modulo piloto interno, preferencialmente Iluminacao Publica / Manutencao de Postes.
6. Desenhar autenticacao, autorizacao, auditoria e backup antes de implementar API.
7. Criar ambiente de homologacao ou estrategia segura de testes.
8. Implementar API somente depois do desenho minimo de seguranca aprovado.
