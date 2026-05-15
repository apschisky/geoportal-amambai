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
- [ ] Nenhum segredo no codigo.
- [ ] Credenciais por variaveis de ambiente.
- [ ] Documentacao controlada da API.
- [ ] Inventario de endpoints.

## 9. Protecao contra abuso em endpoints publicos

- [ ] Aplicar rate limit por IP no futuro, com limite de chamadas por periodo.
- [ ] Proteger contra multiplos chamados para o mesmo poste em curto intervalo.
- [ ] Proteger chamados manuais proximos usando PostGIS no futuro.
- [ ] Avaliar CAPTCHA, Turnstile ou reCAPTCHA se houver abuso automatizado.
- [ ] Nao logar dados pessoais desnecessariamente.
- [ ] Evitar armazenar IP puro sem politica de retencao/LGPD.
- [ ] Proteger consulta publica por protocolo contra enumeracao.

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
