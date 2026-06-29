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
- Hardening explícito do Apache/proxy para IP real por cliente, se essa granularidade for necessária, seguido de nova validação controlada dos headers efetivamente produzidos.
- Ampliação dos testes de acesso negado, bloqueio de conta e revogação de sessão conforme os próximos endpoints administrativos forem desenhados.
- Regras explícitas de anti-elevação, proteção contra remover o último administrador e auditoria administrativa.
- Política de permissões administrativas separada da autorização de negócio, sem bypass por login hardcoded.
- Proteção de infraestrutura contra abuso volumétrico (DDoS/abuso de login); o FastAPI sozinho não resolve ataques de camada 3/4/7 em escala.

Nota de divergencia documental 2026-06-26: este bloco inicial ainda usa a expressao ampla "antes do primeiro CRUD administrativo" e listas de pendencias historicas. Desde entao, partes da Etapa 0 foram implementadas e validadas, incluindo auditoria administrativa, anti-autoelevacao, protecao do ultimo administrador e a desativacao logica de vinculos usuario/perfil em homologacao e producao interna. A divergencia e terminologica/historica: ela nao libera uma tela administrativa ampla nem CRUD completo de usuarios/perfis/permissoes; apenas registra que endpoints administrativos pontuais ja passaram por ciclos controlados documentados abaixo.
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

Validação controlada em produção interna concluída após os commits `152c177`, `f3d8ff3` e `bf7b4df`:
- servidor atualizado por `git pull --ff-only`, em `main`, com `origin/main` alinhado e working tree limpo;
- suíte backend completa no servidor: `695 passed`, `3 warnings` conhecidos de depreciação do `HTTP_422_UNPROCESSABLE_ENTITY`;
- runtime interno confirmado com `APP_ENV=producao`, `API_DEBUG=false`, `PERSIST_SOLICITACOES=true`, `RATE_LIMIT_ENABLED=true`, rotas internas ativas e cookie Secure ativo; `DATABASE_URL` apenas confirmada como definida, sem exposição de valor;
- `TRUSTED_PROXY_HOSTS` não estava definida no loader, portanto o backend usou o default seguro `127.0.0.1,::1`;
- login normal de `admin.producao`, `/auth/me` autenticado e logout foram validados sem registrar credencial, token ou cookie;
- probe com login fictício retornou `401,401,401,401,401,429`, confirmando o contrato sanitizado sem revelar existência de usuário, contador ou escopo bloqueado.

Limite confirmado nesta validação: a busca somente leitura na configuração ativa do Apache não encontrou configuração explícita de `X-Forwarded-For`, `X-Real-IP`, `ProxyAddHeaders`, `RemoteIPHeader` ou `RemoteIPTrustedProxy`. Assim, o rate limit está funcional e publicado, mas a identificação granular do IP real de cada cliente não deve ser considerada validada. O fallback conservador continua seguro; eventual separação por IP real exige hardening futuro do proxy e nova validação.

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
| Validação funcional em produção interna | Concluída | Login normal, logout e sequência `401,401,401,401,401,429` confirmados |
| Identificação do IP real por cliente | Não confirmada | Apache ativo sem configuração explícita dos headers pesquisados; fallback permanece no peer imediato |
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

## Proximo bloco da Etapa 0 - seguranca administrativa

O proximo bloco obrigatorio e **Seguranca administrativa - auditoria, anti-autoelevacao e protecao do ultimo administrador**. Este bloco nao representa uma tela administrativa nova, um CRUD aberto ou a liberacao visual da gestao de usuarios, perfis e permissoes. Ele deve endurecer a superficie administrativa existente antes de qualquer ampliacao.

Controles planejados:

- auditoria administrativa propria, separada de `mod_auth.login_auditoria`;
- bloqueio de concessao, pelo ator, de perfil ou permissao critica a si mesmo;
- restricao de alteracoes nos proprios perfis e vinculos administrativos;
- protecao transacional contra desativar, bloquear, excluir logicamente ou retirar a capacidade do ultimo administrador efetivo;
- permissoes administrativas granulares, sem bypass por login hardcoded;
- registro auditavel de tentativas negadas, inclusive autoelevacao e remocao do ultimo administrador.

Administrador efetivo, para essa salvaguarda, e o usuario ativo, nao deletado logicamente e com vinculos ativos que lhe deem capacidade real de administrar usuarios, perfis ou permissoes. A verificacao futura deve ocorrer na mesma transacao da alteracao, com bloqueio apropriado para impedir que operacoes concorrentes removam simultaneamente os ultimos administradores.

O rate limit interno ja validado protege a entrada da autenticacao, mas nao substitui esses controles de autorizacao e integridade administrativa.

Atualizacao local do commit `9f6ec75 Implementa auditoria e salvaguardas administrativas`:

- auditoria administrativa propria implementada em repository separado de `mod_auth.login_auditoria`;
- migration versionada `0011_create_mod_auth_admin_auditoria.sql` e rollback correspondente criados; migration aplicada e validada em homologacao e producao;
- eventos de sucesso permanecem atomicos com a mutacao;
- eventos negados sao persistidos antes da resposta `403`, com commit comprovado por fake engine transacional;
- autoatribuicao de perfil administrativo critico, reset administrativo da propria senha e auto-bloqueio sao negados;
- bloqueio do ultimo administrador efetivo e impedido sob `pg_advisory_xact_lock`;
- identificacao do ator e feita por `usuario_id`, sem excecao por login;
- testes locais: `219 passed` no conjunto focado e `716 passed`, com `3 warnings` conhecidos, na suite backend completa.

Este marco foi implementado localmente, testado localmente, enviado ao GitHub e validado de forma controlada na API interna de homologacao em 2026-06-25. A migration `0011` foi aplicada somente no banco `amambaiGis_homologacao`, depois do backup manual `C:\apps\geoportal-api\backups\manual\pre_admin_auditoria_0011_amambaiGis_homologacao_20260625_072037.sql`, com 248.973.816 bytes.

A validacao confirmou `mod_auth.admin_auditoria` com 13 colunas, 6 indices, 12 constraints e contagem inicial zero. A role `geoportal_api_homolog` recebeu somente `USAGE` no schema, `INSERT` e `SELECT` na tabela e `USAGE` na sequence; `UPDATE` e `DELETE` permaneceram ausentes.

O fluxo funcional registrou tres eventos: criacao e bloqueio do usuario ficticio `zz_admin_audit_probe_20260625075205` (`id=11`) com resultado `sucesso`, e tentativa de auto-bloqueio do ator autenticado (`id=7`) com resultado `negada`, evento `admin.security.denied_self_change` e motivo interno `self_block`. A resposta externa foi sanitizada como `403 {&#34;detail&#34;:&#34;Forbidden&#34;}`. A verificacao de privacidade encontrou zero ocorrencias dos termos `token`, `cookie`, `hash`, `session_secret`, `database_url` e `senha_inicial` nos campos auditados.

Validacao controlada em producao em 2026-06-25: a migration `0011` foi aplicada no banco `amambaiGis` apos o backup manual `C:\apps\geoportal-api\backups\manual\pre_admin_auditoria_0011_amambaiGis_20260625_083025.sql`, com 249.028.015 bytes. A estrutura foi confirmada com 13 colunas, 6 indices, 12 constraints e contagem inicial zero.

A role `geoportal_api_interna_prod` recebeu somente `USAGE` no schema `mod_auth`, `INSERT, SELECT` em `mod_auth.admin_auditoria` e `USAGE` na sequence. Permanecem ausentes `UPDATE` e `DELETE` na tabela e `SELECT` na sequence, preservando o modelo append-only. Esses GRANTs minimos devem permanecer enquanto a auditoria administrativa estiver ativa.

O teste autenticado usou exclusivamente HTTPS por causa de `GEOPORTAL_INTERNAL_SESSION_COOKIE_SECURE=true`. Foram auditados `admin.user.create` e `admin.user.disable` para o usuario ficticio `zz_admin_audit_prod_probe_20260625084805` (`id=3`) e `admin.security.denied_self_change` para o ator (`id=1`), com resultado `negada` e motivo interno `self_block`. A negativa externa retornou `403 Forbidden` sanitizado, a verificacao de privacidade encontrou zero termos sensiveis e o logout foi confirmado. O usuario ficticio permanece bloqueado como evidencia controlada.

## Marco local - desativacao administrativa de vinculos usuario/perfil

O commit `9173259` implementou localmente o complemento de hardening administrativo para desativar vinculos usuario/perfil sem `DELETE`, com permissao especifica `admin.usuarios.remover_perfis`, header mutavel, justificativa obrigatoria, auditoria administrativa e salvaguardas contra auto-rebaixamento e remocao do ultimo administrador efetivo.

O uso operacional exige bootstrap controlado da permissao, GRANT minimo de `UPDATE (ativo)` em `mod_auth.usuario_perfis`, ausencia de `DELETE`, validacao em homologacao e producao em ciclo separado. Esses ciclos foram concluidos em 2026-06-26. A UI administrativa continua fora deste marco.

## Marco de homologacao - desativacao administrativa de vinculos

A desativacao administrativa de vinculos usuario/perfil foi validada em homologacao no commit `d91240a`. O controle reforca menor privilegio e trilha de auditoria: permissao especifica `admin.usuarios.remover_perfis`, `X-Geoportal-Internal-Request: 1`, negativa sanitizada de auto-rebaixamento, auditoria `admin.security.denied_self_demotion` e sucesso auditado `admin.user.remove_profile`.

A validacao confirmou ausencia de `DELETE` em `mod_auth.usuario_perfis`. O privilegio final correto para homologacao combina `INSERT` ja necessario para atribuicao de perfil existente com `UPDATE(ativo)` para a nova desativacao logica; table `UPDATE` amplo permanece falso.

## Marco de producao interna - desativacao administrativa de vinculos

Em 2026-06-26, a desativacao administrativa de vinculos usuario/perfil foi validada com sucesso em `InternaProducao`, no servico `GeoportalAPIInternaProducao`, porta `8003`, banco `amambaiGis`, runtime `geoportal_api_interna_prod`, `APP_ENV=producao` e `GEOPORTAL_INTERNAL_SESSION_COOKIE_SECURE=true`. O servidor estava alinhado com GitHub no commit `48ae092 Documenta homologacao da desativacao administrativa de perfis`, sobre a implementacao base `9173259 Implementa desativacao administrativa de perfis de usuarios`.

Antes da operacao foi registrado backup manual de producao em `C:\apps\geoportal-api\backups\manual\pre_desativacao_perfis_admin_amambaiGis_20260626_092442.sql`, com 249.202.757 bytes. O inventario previo confirmou que a permissao `admin.usuarios.remover_perfis` ainda nao existia em producao, nenhum perfil a possuia, os perfis reais `administrador-interno-geoportal` (`id=1`) e `manutencao-iluminacao` (`id=2`) estavam ativos, e os usuarios reais `admin.producao` (`id=1`) e `manutencao.producao` (`id=2`) estavam ativos.

O bootstrap real foi executado com `bootstrap_internal_admin_profile.py --login admin.producao`, depois de confirmar as sequences `mod_auth.perfis_id_seq` e `mod_auth.permissoes_id_seq`. GRANTs temporarios foram usados somente para bootstrap e depois revogados. A permissao criada em producao recebeu `id=19`, `modulo='admin'`, `chave='usuarios.remover_perfis'`, descricao `Remover perfis de usuarios internos por desativacao logica.`, ficou ativa e foi vinculada somente ao perfil `administrador-interno-geoportal`. O perfil `manutencao-iluminacao` nao recebeu essa permissao.

O GRANT final minimo validado para `geoportal_api_interna_prod` preserva menor privilegio: em `mod_auth.usuario_perfis`, `SELECT=t`, `INSERT=t`, table `UPDATE=f`, `UPDATE(ativo)=t` e `DELETE=f`; em `mod_auth.permissoes`, `INSERT=f` e `UPDATE=f`; em `mod_auth.perfil_permissoes`, `INSERT=f` e `UPDATE=f`. O `INSERT` em `mod_auth.usuario_perfis` permanece necessario para o endpoint ja existente de atribuicao de perfil; a nova desativacao logica acrescenta somente `UPDATE(ativo)` e preserva a ausencia de `DELETE`.

O harness `InternaProducao -Validate` passou antes e depois da validacao. Foi necessario restart controlado de `GeoportalAPIInternaProducao` para carregar o endpoint novo; apos o restart, `/api/health` permaneceu OK, `/api/version` retornou `environment=producao` e `/api/internal/auth/me` retornou `401` sem sessao. O OpenAPI local em `127.0.0.1:8003` confirmou `GET,POST /api/internal/admin/users/{usuario_id}/profiles` e `POST /api/internal/admin/users/{usuario_id}/profiles/{perfil_id}/deactivate`.

Com `admin.producao` via HTTPS, o login retornou `200`, `/auth/me` confirmou `ADMIN_USER_ID=1`, `LOGIN=admin.producao` e a permissao `admin.usuarios.remover_perfis`, e a listagem de vinculos do proprio admin retornou `perfil_id=1`, `chave=administrador-interno-geoportal`, `ativo=true`. A tentativa de auto-rebaixamento `POST /api/internal/admin/users/1/profiles/1/deactivate`, com `X-Geoportal-Internal-Request: 1` e justificativa, retornou `403` com body vazio no PowerShell; endpoint e SQL confirmaram que o vinculo permaneceu ativo. A auditoria registrou `id=4`, `acao=admin.security.denied_self_demotion`, `entidade_tipo=usuario_perfil`, `entidade_id=1:1:global`, `resultado=negada`, `motivo=self_demotion`, `criado_em=2026-06-26 09:43:17.510917-04`.

O teste positivo controlado criou o usuario ficticio `zz_profile_deactivate_prod_20260626094758` (`id=4`) e atribuiu o perfil nao critico `manutencao-iluminacao` (`perfil_id=2`) com `ASSIGN_STATUS=201`. A desativacao `POST /api/internal/admin/users/4/profiles/2/deactivate` retornou `DEACTIVATE_STATUS=200`, com resposta `ativo=false`; SQL e raw JSON de `GET /api/internal/admin/users/4/profiles` confirmaram `"ativo": false`. A auditoria de sucesso registrou `id=7`, `acao=admin.user.remove_profile`, `entidade_tipo=usuario_perfil`, `entidade_id=4:2:global`, `resultado=sucesso`, `criado_em=2026-06-26 09:48:52.745974-04`. A segunda tentativa retornou `409`.

O usuario ficticio foi bloqueado ao final (`BLOCK_STATUS=200`, `bloqueado=true`), com banco confirmando `bloqueado_ate=2126-06-02 09:49:52.1409-04`; o vinculo `manutencao-iluminacao` permaneceu `ativo=f`. O usuario real `manutencao.producao` nao foi alterado. Login sem campo `login`, com senha ficticia, retornou `422`, confirmando que autenticacao incompleta nao foi aceita. O raw JSON do vinculo inativo retornou `"ativo": false`, sem problema de contrato na listagem de vinculos inativos. O logout retornou `200` nos fluxos autenticados.

Resultado: producao interna validada com sucesso e funcionalidade operacional no backend/API. A UI administrativa para este CRUD complementar, se existir como etapa futura, deve ser planejada separadamente. Proximo passo recomendado: monitoramento assistido e documentacao de fechamento do marco.

## Marco de publicacao - tela administrativa MVP de usuarios internos

O commit publicado no GitHub `be3d2e7 Adiciona tela administrativa de usuarios internos`, posterior ao marco `acda7c0 Documenta validacao em producao da desativacao administrativa de perfis`, publicou o MVP frontend da administracao interna de usuarios em `https://geoserver.amambai.ms.gov.br/interno/`.

O marco nao criou backend, migration, banco, script, `.env`, Apache, NSSM ou configuracao de servico, e nao exigiu restart da API. A mudanca ficou limitada aos arquivos frontend `geoportal-vite/src/internal-iluminacao-shell.js`, `geoportal-vite/src/internal-iluminacao-shell.css` e `geoportal-vite/src/internal-iluminacao-shell.test.js`. A publicacao ocorreu por build local, compactacao `.rar`, envio ao servidor e extracao nas pastas estaticas corretas, sem build no servidor.

As validacoes locais anteriores ao commit registradas para este marco foram: 78 testes aprovados em `npm.cmd test -- internal-iluminacao-shell.test.js`, build Vite aprovado, scanner de mojibake do JS aprovado e `git diff --check` sem erros, apenas com avisos LF/CRLF esperados no Windows.

A validacao visual com `admin.producao` confirmou login OK, menu `Administração do Sistema` habilitado, tela `Administração` funcional, busca/lista de usuarios internos visivel, usuarios reais aparecendo, textos principais sem mojibake e layout administrativo ajustado.

Do ponto de vista de hardening, a tela apenas consome endpoints administrativos ja existentes, preservando cookies de sessao com `credentials: include`, header mutavel `X-Geoportal-Internal-Request: 1` em mutacoes, acoes condicionadas por permissoes administrativas e ausencia de `localStorage`, `sessionStorage` ou token armazenado. O MVP trabalha com RBAC por perfis; permissoes individuais por usuario e CRUD visual de perfis/permissoes continuam fora deste marco.

Ressalvas e proximos ciclos: planejar separadamente perfil Prefeito/gestor somente leitura, criacao/edicao de perfis e permissoes pela UI, mapa operacional da manutencao e ordenamentos/filtros avancados da lista de chamados. A recomendacao imediata e monitoramento assistido e registro de fechamento apos a primeira janela de uso real.

## Marco de homologacao - bootstraps RBAC dos perfis de autorizacao

O commit `bd50401 Garante auth me nos perfis de autorizacao` foi homologado em `amambaiGis_homologacao` para os perfis `gestor-consulta-global` e `administrador-modulo-iluminacao`, apos a correcao `52aa123 Garante permissao do dashboard no bootstrap admin` para `iluminacao.dashboard.ler`.

A execucao seguiu menor privilegio: backup previo, GRANTs temporarios apenas para bootstrap, revogacao imediata e validacao final de privilegios fechados. Os perfis criados ficaram ativos, sem `admin.*`; `administrador-modulo-iluminacao` recebeu `internal.auth.me`, dashboard, leitura, historico, observacoes, comentario, status, prioridade e correcao administrativa do modulo; `gestor-consulta-global` recebeu apenas leitura/consulta gerencial. `manutencao-iluminacao` permaneceu sem `iluminacao.dashboard.ler` e sem privilegios administrativos.

A validacao final confirmou `geoportal_api_homolog` sem `INSERT`/`UPDATE` em `mod_auth.perfis` e sem `INSERT`/`UPDATE`/`DELETE` em `mod_auth.perfil_permissoes`. Nao houve migration estrutural, endpoint, frontend, Apache, NSSM, `.env`, deploy ou restart de API.

Producao interna deve repetir apenas apos autorizacao explicita, com backup, inventario, GRANT temporario minimo, bootstrap admin se a permissao `iluminacao.dashboard.ler` estiver ausente, bootstrap dos perfis, revogacao, validacao SQL e documentacao final.

## Marco de producao interna - bootstraps RBAC dos perfis de autorizacao

Os bootstraps dos perfis `gestor-consulta-global` e `administrador-modulo-iluminacao` foram executados e validados em producao interna com o servidor no commit `a1abb6d Documenta homologacao dos perfis RBAC internos`, banco `amambaiGis` em `127.0.0.1:5434`, `APP_ENV=producao`, `DATABASE_USER=geoportal_api_interna_prod` e cookie interno Secure ativo.

A operacao seguiu menor privilegio: backup manual previo `C:\apps\geoportal-api\backups\manual\pre_bootstrap_perfis_autorizacao_amambaiGis_20260629_094941.sql` (`249145986` bytes), inventario previo, dry-run sem escrita, GRANT temporario minimo apenas para `INSERT` em `mod_auth.perfis` e `mod_auth.perfil_permissoes` e `USAGE, SELECT` na sequence de perfis, sem `UPDATE` e sem `DELETE`, execucao do bootstrap, revogacao imediata e validacao final dos privilegios fechados.

Foram criados os perfis `gestor-consulta-global` (`id=3`) e `administrador-modulo-iluminacao` (`id=4`), ambos ativos e sem `admin.*`. A matriz final manteve o perfil de gestor somente leitura, e o administrador do modulo restrito a permissoes de Iluminacao, incluindo prioridade e correcao administrativa do modulo, sem administracao global. `manutencao-iluminacao` e `administrador-interno-geoportal` ja existentes nao foram redefinidos por esse bootstrap.

Privilegios finais de `geoportal_api_interna_prod` permaneceram fechados: `perfis_insert=false`, `perfil_permissoes_insert=false`, `perfis_update=false`, `perfil_permissoes_update=false` e `perfil_permissoes_delete=false`. Nao houve migration estrutural, endpoint, frontend, Apache, NSSM, `.env`, deploy ou restart de API.

Proximo controle recomendado: atribuir usuarios reais a esses perfis apenas pela tela administrativa, com criterio operacional e validacao de login. Gestores nao devem ver acoes mutaveis nem Administracao do Sistema; administradores de modulo devem ver acoes do modulo, mas nao administracao global.
