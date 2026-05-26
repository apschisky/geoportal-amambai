# Modelo de Dados de Autenticacao e Autorizacao Interna

Este documento define o modelo conceitual de autenticacao e autorizacao para o Geoportal Interno. Ele nao cria codigo, migrations, endpoints, telas, usuarios reais, senhas, tokens ou configuracoes de ambiente.

O detalhamento tecnico das futuras migrations do schema `mod_auth` esta em `docs/INTERNAL-AUTH-MIGRATIONS-PLAN.md`.
As escolhas de hash, sessao, transporte de token e autorizacao devem seguir as decisoes iniciais documentadas em `docs/INTERNAL-AUTH-TECHNICAL-DECISIONS.md`.
O serviço interno de hash/verificação de senha com Argon2id já foi implementado e validado, o serviço interno de sessão opaca/token também foi implementado e validado, o repository interno de sessões foi criado para operar somente com `token_hash`, o repository interno de usuários foi criado para busca autenticável por login/e-mail e o service interno de autenticação/sessão foi criado em `geoportal-backend/app/services/auth_service.py` sem endpoint. A busca de sessão ativa filtra revogação, expiração e estado do usuário, e a revogação usa `revogado_em`, sem `DELETE`. Ainda não há endpoint interno exposto, usuário real, sessão real criada por endpoint, token real, cookie, CSRF, JWT ou middleware.
O plano de threat model, controles e validacao para a implementacao segura da autenticacao backend esta em `docs/INTERNAL-AUTH-SECURITY-IMPLEMENTATION-PLAN.md`.

Registro documental: a migration `0006_create_mod_auth_schema.sql` foi criada e aplicada em homologacao e no banco ativo de producao apos backup manual validado. O schema `mod_auth` foi criado com comentario validado, e nenhuma tabela foi criada nesta etapa. O rollback correspondente permanece disponivel para ambiente controlado.

Registro documental: a migration `0007_create_mod_auth_usuarios.sql` foi aplicada e validada em homologacao e no banco ativo de producao apos backup manual validado. A tabela `mod_auth.usuarios` foi criada, indices e constraints foram validados com dados ficticios em homologacao, os dados ficticios foram removidos e a tabela ficou vazia apos a limpeza. Em producao, os indices foram validados, a tabela permaneceu vazia apos a criacao e nenhum usuario real, seed, endpoint ou login funcional foi criado.

Registro documental: a migration `0008_create_mod_auth_perfis_permissoes.sql` foi aplicada e validada em homologacao e no banco ativo de producao apos backup manual validado. As tabelas de perfis, permissoes e vinculos foram criadas, indices e FKs restritivas foram validados, constraints e vinculos foram testados com dados ficticios em homologacao, os dados ficticios foram removidos e todas as tabelas `mod_auth` ficaram vazias apos a limpeza. Em producao, todas as tabelas `mod_auth` permaneceram vazias apos a criacao, a API publica continuou saudavel, `/api/health` e `/api/public/iluminacao/health` continuaram OK, `/api/version` continuou retornando ambiente `producao` e nenhum usuario, perfil, permissao, vinculo, seed, endpoint ou login funcional foi criado.

Registro documental: a migration `0009_create_mod_auth_sessoes_login_auditoria.sql` foi aplicada e validada em homologacao e no banco ativo de producao apos backup manual validado. As tabelas `mod_auth.sessoes` e `mod_auth.login_auditoria` foram criadas, indices e FKs restritivas foram validados, constraints foram testadas com dados ficticios em homologacao, os dados ficticios foram removidos e todas as tabelas `mod_auth` ficaram vazias apos a limpeza. Em producao, todas as tabelas `mod_auth` permaneceram vazias apos a criacao, a API publica continuou saudavel, `/api/health` e `/api/public/iluminacao/health` continuaram OK, `/api/version` continuou retornando ambiente `producao` e nenhum login funcional, endpoint, usuario real, token real, sessao real, auditoria real ou seed foi criado. A base estrutural inicial do schema `mod_auth` esta concluida; a proxima etapa deve planejar e implementar autenticacao backend com testes, sem criar acesso interno publico sem autenticacao.

## 1. Objetivo

- Definir um modelo transversal de autenticacao e autorizacao para o Geoportal Interno.
- Atender todos os modulos internos futuros, nao apenas Iluminacao Publica.
- Evitar multiplos sistemas de login separados por modulo.
- Permitir que usuarios tenham perfis e permissoes diferentes conforme o modulo.

## 2. Schema conceitual

O schema futuro recomendado e `mod_auth`.

`mod_auth` deve ser transversal aos modulos internos. Ele deve concentrar usuarios, perfis, permissoes, sessoes e auditoria de login, enquanto schemas de modulo, como `mod_iluminacao`, continuam responsaveis pelos dados operacionais especificos.

## 3. Tabelas conceituais futuras

- `mod_auth.usuarios`
- `mod_auth.perfis`
- `mod_auth.permissoes`
- `mod_auth.usuario_perfis`
- `mod_auth.perfil_permissoes`
- `mod_auth.sessoes`
- `mod_auth.login_auditoria`

## 4. `mod_auth.usuarios`

Campos conceituais:

- `id`
- `nome`
- `email`
- `login`
- `senha_hash`
- `ativo`
- `bloqueado_ate`
- `ultimo_login_em`
- `criado_em`
- `atualizado_em`
- `desativado_em`

Regras:

- Senha nunca deve ser armazenada em texto puro.
- `email` e `login` devem ser unicos.
- Usuario desativado nao deve acessar endpoints internos.
- Tentativas excessivas de login devem aplicar bloqueio temporario, atraso ou protecao equivalente.
- Logs nunca devem registrar senha, hash de senha ou token.
- Repository interno criado em `geoportal-backend/app/repositories/auth_user_repository.py`, sem endpoint e sem login funcional.
- O repository pode ler `senha_hash` apenas em record interno para verificacao futura de senha no backend.
- `senha_hash` nao deve ser retornado por endpoint e nao deve ser registrado em log.
- A busca usa login ou e-mail normalizado de forma case-insensitive e nao cria sessao, auditoria ou usuario.
- O service interno de autenticacao/sessao usa esse record apenas no backend, retorna falha generica e nao expõe `senha_hash`.

## 5. `mod_auth.perfis`

Exemplos de perfis:

- `admin`
- `gestor_modulo`
- `atendente_triagem`
- `equipe_execucao`
- `leitura`

Regras:

- Perfis sao agrupadores de permissoes.
- Perfis podem ser reaproveitados entre modulos.
- O perfil `admin` deve ser restrito e revisado periodicamente.
- A matriz final de perfis deve ser validada com a operacao antes do uso real.

## 6. `mod_auth.permissoes`

Modelo recomendado:

- `id`
- `modulo`
- `chave`
- `descricao`
- `ativo`

Exemplos:

- `iluminacao.visualizar_solicitacoes`
- `iluminacao.alterar_status`
- `iluminacao.registrar_observacao`
- `iluminacao.visualizar_historico`
- `defesa_civil.visualizar_ocorrencias`
- `meio_ambiente.analisar_denuncias`
- `admin.gerenciar_usuarios`

Regras:

- Permissoes devem ser granulares por acao.
- Permissoes devem ser verificadas no backend.
- Permissoes inativas nao devem autorizar acesso.

## 7. `mod_auth.usuario_perfis`

Finalidade:

- Vincular usuarios a perfis.
- Permitir escopo por modulo quando necessario.

Campos conceituais:

- `usuario_id`
- `perfil_id`
- `modulo`
- `ativo`
- `criado_em`

Regras:

- Um usuario pode ter perfis diferentes por modulo.
- Um vinculo inativo nao deve conceder permissao.
- O campo `modulo` pode ser usado para limitar o perfil a um modulo especifico.

## 8. `mod_auth.perfil_permissoes`

Finalidade:

- Vincular perfis a permissoes.
- Permitir montar matriz de acesso por modulo.

Regras:

- Um perfil pode ter varias permissoes.
- Uma permissao pode ser usada por varios perfis.
- A resolucao final de acesso deve considerar usuario ativo, perfil ativo, permissao ativa e escopo de modulo.

## 9. `mod_auth.sessoes`

Finalidade:

- Registrar sessoes, tokens ativos ou identificadores seguros.
- Permitir expiracao e revogacao.

Campos conceituais:

- `id`
- `usuario_id`
- `token_hash` ou identificador seguro equivalente
- `criado_em`
- `expira_em`
- `revogado_em`
- `ip_hash`, se necessario futuramente
- `user_agent_hash`, se necessario futuramente

Regras:

- Nao armazenar token puro se houver alternativa segura.
- Expiracao de sessao ou token e obrigatoria.
- Sessoes devem poder ser revogadas.
- Repository interno criado em `geoportal-backend/app/repositories/auth_session_repository.py`, sem endpoint e sem login funcional.
- O repository insere e consulta `token_hash`; ele nao cria token bruto, nao retorna token bruto e nao retorna `senha_hash`.
- A consulta de sessao ativa filtra `revogado_em IS NULL`, `expira_em > now()` e usuario ativo, nao desativado e nao bloqueado no momento da consulta.
- Revogacao usa preenchimento de `revogado_em` por `UPDATE`; nao usa `DELETE`.
- Evitar IP bruto e user-agent bruto sem politica de retencao definida.
- Logs nao devem conter token, cookie de sessao ou identificador sensivel.

## 10. `mod_auth.login_auditoria`

Finalidade:

- Registrar tentativas de login.
- Apoiar deteccao de abuso e investigacao operacional segura.

Campos conceituais:

- `id`
- `usuario_id`, quando identificado
- `login_informado`
- `sucesso`
- `motivo_falha`
- `criado_em`
- `origem`

Regras:

- Nao registrar senha.
- `motivo_falha` deve ser generico.
- Evitar IP bruto se nao houver politica definida.
- Registro de auditoria nao deve expor token, senha, hash de senha ou detalhes internos sensiveis.

## 11. Seguranca

- Senhas devem usar hash forte e algoritmo adequado.
- Sessao ou token deve ter expiracao.
- Senha, token e `DATABASE_URL` nunca devem aparecer em logs.
- Falha de login deve retornar erro generico.
- Tentativas excessivas devem aplicar bloqueio temporario, atraso ou protecao equivalente.
- Contas inativas devem ser bloqueadas.
- Banco deve seguir menor privilegio.
- Endpoints internos devem validar autenticacao e autorizacao no backend.
- HTTPS deve ser obrigatorio em producao.
- CORS deve permanecer restrito.

## 12. Escopo por modulo

O modelo deve permitir que o mesmo usuario tenha permissoes diferentes por modulo.

Exemplo conceitual:

- `leitura` em Iluminacao Publica.
- `gestor_modulo` em Defesa Civil.
- Sem acesso em Fiscalizacao.

Essa separacao evita dar permissao ampla quando a necessidade operacional e limitada a um modulo.

## 13. Relacao com endpoints internos

- Endpoints em `/api/internal/...` devem consultar esse modelo ou uma camada equivalente de autorizacao.
- Permissoes devem ser verificadas no backend.
- Esconder botoes, menus ou telas no front-end nao e seguranca suficiente.
- Endpoints publicos em `/api/public/...` nao devem depender de login interno.
- Endpoints publicos nunca devem retornar observacoes internas, historico administrativo completo ou dados de autenticacao.

## 14. Roadmap

1. Documentar o modelo conceitual.
2. Criar migrations de `mod_auth` conforme `docs/INTERNAL-AUTH-MIGRATIONS-PLAN.md`.
3. Implementar autenticacao no backend.
4. Implementar autorizacao por dependencia, middleware ou mecanismo equivalente.
5. Testar acesso autorizado e negado.
6. Criar endpoints internos operacionais somente depois da autenticacao/autorizacao validada.

## 15. Fora do escopo desta etapa

- Implementar login.
- Criar migrations.
- Criar endpoints.
- Criar telas.
- Cadastrar usuarios reais.
- Definir senhas reais.
- Registrar tokens reais.

## 16. Criterios de aceite

- Documentacao clara.
- Modelo transversal aos modulos internos.
- Sem dados sensiveis.
- Sem codigo funcional.
- Sem migrations.
- Sem endpoints.
- Pronto para orientar a proxima fase de autenticacao/autorizacao interna.
