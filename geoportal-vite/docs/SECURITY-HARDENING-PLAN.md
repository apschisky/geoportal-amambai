# Plano de Endurecimento de Segurança do Geoportal de Amambai

Este plano orienta a evolucao segura do Geoportal publico ate a implantacao de modulos internos, API, login, usuarios, permissoes, anexos, protocolos e dados operacionais.

## 1. Objetivo

Definir criterios e acoes de endurecimento para reduzir riscos antes de ampliar o Geoportal para servicos internos. O objetivo e manter o mapa publico estavel e separar claramente o que pode ser publico do que deve ser protegido por API, autenticacao, autorizacao, auditoria e regras operacionais.

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
- [ ] Restaurar `enabled=false`, `submitEnabled=false` e `PERSIST_SOLICITACOES=false` como padrao seguro apos testes e limpar registros de validacao.
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
- [ ] Validacao de entrada com schemas.
- [ ] Rate limit para endpoints sensiveis.
- [ ] Logs de auditoria.
- [ ] CORS restrito.
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
- [ ] API com usuario restrito por modulo/ambiente.
- [ ] Permissoes minimas por modulo.
- [ ] Sem acesso direto a schemas `plano`/`web_map`, salvo necessidade futura muito bem justificada.
- [ ] Manter persistencia desativada por padrao.
- [ ] Ativar persistencia apenas em ambiente controlado com usuario restrito e `DATABASE_URL` segura.
- [x] Padrao de usuario restrito da API validado em homologacao, sem superuser e sem acesso direto a schemas nao necessarios.
- [ ] Investigar estabilidade de rede, firewall e antivirus entre API e PostgreSQL antes de uso continuo.
- [x] Deteccao leve de duplicidade suspeita implementada e validada antes de rate limit.
- [x] Rate limit inicial em memoria implementado e validado em desenvolvimento/homologacao.
- [ ] Rate limit definitivo para producao ainda pendente, com avaliacao de proxy, Redis, WAF ou API gateway.
- [ ] Documentacao controlada da API.
- [ ] Inventario de endpoints.
- [x] Implementar bloqueio de nova solicitacao `poste_mapa` quando ja houver solicitacao ativa para o mesmo `poste_id`, retornando `409 Conflict` seguro e sem expor dados de outra pessoa.

## 9. Protecao contra abuso em endpoints publicos

- [ ] Aplicar rate limit por IP no futuro, com limite de chamadas por periodo.
- [x] Proteger contra multiplos chamados para o mesmo poste: bloquear nova solicitacao quando o mesmo `poste_id` ja tiver status ativo (`aberta`, `em_triagem`, `encaminhada`, `em_execucao` ou `aguardando_material`).
- [ ] Permitir nova solicitacao para o mesmo poste apenas quando o chamado anterior estiver em status final (`concluida`, `cancelada`, `nao_atendida` ou `encerrada`, se existir futuramente).
- [ ] Garantir que o bloqueio por duplicidade ativa retorne mensagem publica segura, sem protocolo de outra pessoa, dados pessoais, contato, descricao ou detalhes administrativos.
- [ ] Proteger chamados manuais proximos usando PostGIS no futuro.
- [ ] Avaliar CAPTCHA, Turnstile ou reCAPTCHA se houver abuso automatizado.
- [ ] Nao logar dados pessoais desnecessariamente.
- [ ] Evitar armazenar IP puro sem politica de retencao/LGPD.
- [ ] Proteger consulta publica por protocolo contra enumeracao.
- [ ] Limitar consulta publica por protocolo a protocolo, status, datas publicas e mensagens seguras, sem dados pessoais, contato, observacoes internas ou detalhes administrativos.
- [x] Criar backend da consulta publica como `POST /api/public/iluminacao/consulta`, com protocolo e confirmacao minima, evitando protocolo em URL.
- [x] Validar manualmente consulta publica por protocolo em ambiente controlado, com resposta publica filtrada e `404` generico para protocolo inexistente ou confirmacao invalida.
- [ ] Integrar consulta publica por protocolo ao front-end em etapa futura.
- [ ] Usar resposta generica para protocolo inexistente ou confirmacao invalida, sem diferenciar claramente os casos.
- [ ] Validar formato `IP-YYYY-NNNNNN`, normalizar protocolo, aplicar rate limit e avaliar captcha/protecao adicional se necessario.

## 10. Usuarios, login e permissoes

- [ ] Usuarios individuais, nunca compartilhados.
- [ ] Perfis por secretaria e modulo.
- [ ] Permissoes por acao: visualizar, criar, editar, finalizar e excluir.
- [ ] Auditoria de login.
- [ ] Auditoria de alteracao de dados.
- [ ] Bloqueio ou desativacao de usuarios desligados.
- [ ] Politica de senha.
- [ ] Avaliacao futura de 2FA para perfis sensiveis.

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

## 12. Backups, rollback e continuidade

- [ ] Backup do PostgreSQL.
- [ ] Backup do GeoServer `data_dir`.
- [ ] Backup do front-end publicado.
- [ ] Backup de configuracao Apache/Tomcat.
- [ ] Teste periodico de restauracao.
- [ ] Procedimento de rollback de versao do front-end.
- [ ] Documentacao dos caminhos, scripts e responsaveis.
- [ ] Retencao minima definida para backups.

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
