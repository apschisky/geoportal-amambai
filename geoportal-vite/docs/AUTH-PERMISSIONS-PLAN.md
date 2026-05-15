# Plano de Autenticacao e Permissoes do Geoportal de Amambai

Este documento define a estrategia futura de login, usuarios, perfis, permissoes e auditoria para os modulos internos do Geoportal/SIG Municipal.

## 1. Objetivo

Planejar uma base segura de autenticacao e autorizacao para modulos internos, sem implementar codigo nesta etapa.

O objetivo e garantir que usuarios internos, API, banco e GeoServer tenham papeis separados, permissoes minimas e auditoria obrigatoria antes da implantacao de fluxos operacionais.

## 2. Principios de seguranca

- Menor privilegio.
- Usuarios individuais.
- Nenhuma conta compartilhada.
- Permissoes por modulo e acao.
- Segregacao entre publico e interno.
- Auditoria obrigatoria.
- Bloqueio de usuarios desligados.
- Revisao periodica de acessos.
- Avaliacao futura de 2FA para perfis sensiveis.
- Permissoes sempre verificadas no servidor.

## 3. Separacao de acesso

| Area | Acesso | Usuarios | Exemplo |
|---|---|---|---|
| Geoportal publico | Aberto | Cidadao | Consultar mapa, solicitar servico |
| API publica | Sem login ou protecao leve | Cidadao | Criar solicitacao, consultar protocolo |
| Ambiente interno | Login obrigatorio | Servidores | Triagem, atualizacao de status |
| Administracao | Login + permissao elevada | Administradores | Usuarios, permissoes, configuracoes |

## 4. Tipos de usuarios

- **Cidadao/usuario publico**: acessa mapa, cria solicitacoes e consulta protocolo quando aplicavel.
- **Servidor municipal**: acessa ambiente interno conforme setor e perfil.
- **Atendente/triagem**: recebe, classifica e encaminha solicitacoes.
- **Equipe de campo**: executa atendimento, registra fotos, observacoes e conclusao.
- **Gestor de modulo**: acompanha indicadores, resolve excecoes e gerencia tabelas de dominio do modulo.
- **Administrador do sistema**: gerencia usuarios, perfis, configuracoes e permissoes.
- **Usuario tecnico/API**: conta de servico usada pela API, nunca por pessoa.
- **Usuario GeoServer**: conta de servico para leitura de views/camadas publicas.
- **Usuario de banco**: roles tecnicas para permissoes no PostgreSQL/PostGIS.

Usuarios humanos e usuarios de servico devem ser separados.

## 5. Perfis iniciais para o modulo de Iluminacao Publica

- Publico/cidadao.
- Atendente iluminacao.
- Equipe campo iluminacao.
- Gestor iluminacao.
- Administrador sistema.
- Auditor/consulta.

Validacao operacional inicial: Atendente/Triagem e Equipe de Campo podem ser a mesma pessoa na primeira versao. Equipe de campo, gestor e administrador concentram as principais acoes operacionais.

## 6. Matriz inicial de permissoes

| Acao | Publico | Atendente | Campo | Gestor | Admin | Auditor |
|---|---|---|---|---|---|---|
| Criar solicitacao publica | Sim | Sim | Nao | Sim | Sim | Nao |
| Consultar protocolo publico | Sim | Sim | Sim | Sim | Sim | Sim |
| Listar solicitacoes internas | Nao | Sim se acumulado com campo | Sim | Sim | Sim | Sim |
| Ver dados pessoais | Nao | Nao | Nao | Sim | Sim | Nao ou restrito |
| Alterar status | Nao | Sim se acumulado com campo | Sim | Sim | Sim | Nao |
| Finalizar atendimento | Nao | Nao ou acumulado com campo | Sim | Sim | Sim | Nao |
| Cancelar/indeferir | Nao | Nao | Nao | Sim | Sim | Nao |
| Anexar foto/documento | Nao na primeira versao | Nao ou acumulado com campo | Sim | Sim | Sim | Nao |
| Editar tabelas de dominio | Nao | Nao | Nao | Sim | Sim | Nao |
| Gerenciar usuarios | Nao | Nao | Nao | Nao | Sim | Nao |
| Consultar auditoria | Nao | Nao | Nao | Sim | Sim | Sim |

Esta matriz e inicial e deve ser ajustada com o setor responsavel. A primeira versao pode unir papel de triagem e campo para simplificar operacao.

## 7. Modelo futuro de autorizacao

O modelo futuro deve relacionar usuario, modulo e permissao/acao. Um usuario podera acessar um ou mais modulos, sempre com permissoes especificas por modulo.

Exemplos conceituais:

- usuario com acesso apenas ao modulo de Iluminacao Publica, com permissao para listar e alterar status;
- usuario com acesso a Iluminacao Publica e Limpeza de Lotes, com permissoes diferentes em cada modulo;
- Prefeito/Gestor Geral com acesso estrategico de consulta e indicadores em todos ou varios modulos, sem permissao operacional desnecessaria;
- administrador do sistema com gestao de usuarios, modulos e permissoes.

O administrador do sistema podera definir quais modulos e niveis de permissao cada usuario possui. Permissoes operacionais devem seguir menor privilegio.

DELETE real deve ser evitado para usuarios comuns. Exclusoes devem preferir cancelamento, inativacao, arquivamento ou soft delete com auditoria. Acoes sensiveis devem ser auditadas.

## 8. Permissoes por acao

Acoes padronizadas:

- `visualizar`;
- `criar`;
- `editar`;
- `encaminhar`;
- `alterar_status`;
- `finalizar`;
- `cancelar`;
- `indeferir`;
- `anexar`;
- `excluir`;
- `administrar`;
- `auditar`.

Exclusao fisica deve ser evitada. Preferir cancelamento logico, desativacao ou status equivalente, preservando historico e auditoria.

## 9. Autenticacao

Opcoes e criterios conceituais:

- Login com e-mail/usuario e senha.
- Senha com hash forte.
- Token ou sessao segura.
- Expiracao de sessao.
- Renovacao controlada.
- Logout.
- Bloqueio por tentativas suspeitas.
- HTTPS obrigatorio.

A implementacao final ainda deve ser definida. Este documento registra criterios minimos, nao uma escolha tecnica fechada.

## 10. Autorizacao na API

- Endpoints internos sempre exigem autenticacao.
- Cada endpoint verifica permissao especifica.
- Permissoes devem ser checadas no servidor, nunca apenas no front-end.
- Front-end pode esconder botoes, mas API deve bloquear acoes indevidas.
- API deve registrar tentativas negadas quando relevante.
- Alteracoes de status e dados sensiveis exigem auditoria.

## 11. Relacao com PostGIS

- API usa usuario proprio de banco.
- Usuarios humanos nao acessam banco diretamente para operar modulos.
- GeoServer publico usa usuario somente leitura.
- Permissoes de banco e permissoes da aplicacao sao camadas complementares.
- Evitar superuser em servicos.
- Roles de banco devem seguir menor privilegio.
- Escrita operacional deve ser limitada ao schema do modulo.

## 12. Auditoria de acesso e acoes

Registrar:

- login bem-sucedido;
- falha de login;
- logout;
- alteracao de senha;
- criacao/desativacao de usuario;
- alteracao de perfil;
- tentativa de acao sem permissao;
- alteracao de status;
- anexos enviados;
- finalizacao/cancelamento.

Eventos de auditoria devem ser protegidos contra edicao por usuarios comuns.

## 13. Gestao de ciclo de vida de usuarios

- Criacao com perfil inicial.
- Alteracao de perfil.
- Bloqueio temporario.
- Desativacao de usuario desligado.
- Revisao periodica.
- Nao apagar historico de usuarios que ja fizeram acoes.
- Manter relacao entre usuario e auditoria.
- Registrar quem criou, alterou, bloqueou ou desativou usuario.

## 14. Dados pessoais e LGPD

- Coletar apenas o necessario.
- Limitar acesso a nome/contato do cidadao.
- Nao exibir dados pessoais no mapa publico.
- Nome e contato nao devem ser obrigatorios.
- Contato pode ser util quando o poste nao for localizado ou faltar informacao.
- Retencao inicial sugerida: manter dados pessoais ate a finalizacao do chamado, sujeita a validacao juridica/LGPD.
- Registrar finalidade.
- Controlar anexos.
- Restringir exportacoes.
- Evitar uso de dados pessoais em relatorios publicos.

## 15. Seguranca operacional

- Senhas fora do Git.
- Segredos em variaveis de ambiente.
- HTTPS obrigatorio.
- Logs protegidos.
- Backup.
- Monitoramento.
- Revisao de permissoes.
- Bloquear contas suspeitas.
- Avaliacao futura de 2FA.
- Separar desenvolvimento, homologacao e producao.

## 16. Escalonamento para outros modulos

O mesmo modelo deve ser reaproveitado para:

- Alvaras;
- Viabilidade;
- Meio Ambiente;
- Limpeza de Lotes;
- outros servicos.

Cada modulo pode ter perfis especificos, mas deve seguir o padrao comum de permissoes, auditoria, menor privilegio e separacao entre publico e interno.

## 17. Criterios antes de implementar

- [ ] Perfis aprovados.
- [ ] Matriz de permissoes aprovada.
- [ ] Politica de senha definida.
- [ ] Estrategia de sessao/token definida.
- [ ] Auditoria definida.
- [ ] Fluxo de criacao/desativacao de usuario definido.
- [ ] Papeis de banco definidos.
- [ ] Ambiente de homologacao definido.
- [ ] Regras de LGPD revisadas.
- [ ] Procedimento de recuperacao/bloqueio de conta definido.

## 18. Relacao com documentos existentes

Este documento complementa:

- `docs/API-ARCHITECTURE.md`;
- `docs/POSTGIS-SCHEMA-PLAN.md`;
- `docs/MODULE-ILUMINACAO-PUBLICA.md`;
- `docs/INTERNAL-MODULES-ARCHITECTURE.md`;
- `docs/SECURITY-HARDENING-PLAN.md`.

## 19. Proximos documentos recomendados

- futuro `docs/API-ENDPOINTS-ILUMINACAO.md`
- futuro `docs/SQL-MIGRATION-PLAN.md`
- futura prova de conceito FastAPI em homologacao
