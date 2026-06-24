# Plano de Migrations do Schema `mod_auth`

Este documento detalha tecnicamente as futuras migrations de autenticacao/autorizacao interna do Geoportal. Ele nao cria SQL, nao cria migrations, nao altera codigo, nao cria endpoints e nao cadastra usuarios reais.

O plano de threat model, controles e validacao para a implementacao segura da autenticacao backend esta em `docs/INTERNAL-AUTH-SECURITY-IMPLEMENTATION-PLAN.md`.

## 1. Objetivo

Planejar migrations pequenas, revisaveis e reversiveis para o schema transversal `mod_auth`, usado pela autenticacao/autorizacao dos futuros modulos internos do Geoportal.

Migrations planejadas:

- `0006_create_mod_auth_schema.sql`
- `0007_create_mod_auth_usuarios.sql`
- `0008_create_mod_auth_perfis_permissoes.sql`
- `0009_create_mod_auth_sessoes_login_auditoria.sql`
- `0010_make_auth_user_email_optional.sql`

Essas migrations nao devem alterar `mod_iluminacao`, `plano` ou `web_map`.

## 2. Migration `0006_create_mod_auth_schema.sql`

Status: aplicada e validada em homologacao e no banco ativo de producao.

Registro seguro da aplicacao:

- backup manual foi criado antes da aplicacao em homologacao;
- backup manual foi validado como legivel em homologacao;
- a migration `0006` foi aplicada em homologacao;
- o schema `mod_auth` foi criado em homologacao;
- o comentario do schema foi validado em homologacao;
- foi confirmado que nenhuma tabela foi criada em `mod_auth` em homologacao;
- backup manual foi criado antes da aplicacao em producao;
- backup manual foi validado como legivel em producao;
- a migration `0006` foi aplicada no banco ativo de producao;
- o schema `mod_auth` foi criado em producao;
- o comentario do schema foi validado em producao;
- foi confirmado que nenhuma tabela foi criada em `mod_auth` em producao.

Responsabilidade:

- Criar o schema `mod_auth`.
- Adicionar comentario no schema explicando seu uso transversal para autenticacao/autorizacao interna.
- Nao criar tabelas nesta migration.
- Nao alterar outros schemas.

Rollback correspondente:

- Remover apenas `mod_auth` se estiver vazio.
- Nao dropar `mod_iluminacao`, `plano`, `web_map` ou qualquer outro schema.

## 3. Migration `0007_create_mod_auth_usuarios.sql`

Status: aplicada e validada em homologacao e no banco ativo de producao.

Registro seguro da validacao em homologacao:

- backup manual foi criado antes da aplicacao;
- backup manual foi validado como legivel;
- a migration `0007` foi aplicada em homologacao;
- a tabela `mod_auth.usuarios` foi criada;
- os indices `usuarios_pkey`, `ux_mod_auth_usuarios_email_lower`, `ux_mod_auth_usuarios_login_lower`, `ix_mod_auth_usuarios_ativo` e `ix_mod_auth_usuarios_bloqueado_ate` foram validados;
- insert ficticio valido funcionou;
- duplicidade de email normalizado foi bloqueada;
- duplicidade de login normalizado foi bloqueada;
- email invalido foi bloqueado por `CHECK`;
- o usuario ficticio foi removido;
- a tabela `mod_auth.usuarios` ficou vazia apos a limpeza.

Registro seguro da aplicacao em producao:

- backup manual do banco ativo foi criado antes da aplicacao;
- backup manual foi validado como legivel;
- a migration `0007` foi aplicada no banco ativo;
- a tabela `mod_auth.usuarios` foi criada;
- os indices `usuarios_pkey`, `ux_mod_auth_usuarios_email_lower`, `ux_mod_auth_usuarios_login_lower`, `ix_mod_auth_usuarios_ativo` e `ix_mod_auth_usuarios_bloqueado_ate` foram validados;
- a tabela `mod_auth.usuarios` permaneceu vazia apos a criacao;
- a API publica continuou saudavel;
- `/api/public/iluminacao/health` continuou OK;
- nenhum usuario real foi criado;
- nenhuma seed foi criada;
- nenhum endpoint foi criado;
- nenhum login funcional foi implementado.

Tabela futura: `mod_auth.usuarios`.

Campos conceituais/tecnicos:

- `id bigserial primary key`
- `nome varchar(180) not null`
- `email varchar(180) null`
- `login varchar(80) not null`
- `senha_hash varchar(255) not null`
- `ativo boolean not null default true`
- `bloqueado_ate timestamptz null`
- `ultimo_login_em timestamptz null`
- `criado_em timestamptz not null default now()`
- `atualizado_em timestamptz null`
- `desativado_em timestamptz null`

Constraints:

- `email` unico, preferencialmente por `lower(email)`, apenas quando informado.
- `login` unico, preferencialmente por `lower(login)`.
- `nome` nao vazio.
- `email` opcional; quando informado, nao vazio.
- `login` nao vazio.
- `senha_hash` nao vazio.
- `atualizado_em >= criado_em` quando informado.
- `desativado_em >= criado_em` quando informado.
- `bloqueado_ate` pode ser futuro ou passado, pois e campo de controle operacional.

Indices:

- Email normalizado.
- Login normalizado.
- `ativo`.
- `bloqueado_ate`.

Seguranca:

- `senha_hash` nunca deve conter senha pura.
- Migrations nao devem cadastrar usuarios reais.
- Migrations nao devem incluir senhas reais.
- Migrations nao devem incluir hashes reais.
- Logs nao devem registrar senha nem hash de senha.

Rollback correspondente:

- Remover `mod_auth.usuarios` somente se nao houver dependencias.

## 4. Migration `0008_create_mod_auth_perfis_permissoes.sql`

Status: aplicada e validada em homologacao e no banco ativo de producao.

Registro seguro da validacao em homologacao:

- backup manual de homologacao foi criado antes da aplicacao;
- backup manual foi validado como legivel;
- a migration `0008` foi aplicada em homologacao;
- as tabelas `mod_auth.perfis`, `mod_auth.permissoes`, `mod_auth.usuario_perfis` e `mod_auth.perfil_permissoes` foram criadas;
- indices foram validados;
- FKs restritivas foram validadas com `ON UPDATE RESTRICT` e `ON DELETE RESTRICT`;
- inserts ficticios funcionaram;
- vinculo usuario/perfil/modulo funcionou;
- vinculo perfil/permissao funcionou;
- duplicidade de perfil foi bloqueada;
- duplicidade de permissao por modulo/chave foi bloqueada;
- duplicidade de usuario/perfil/modulo foi bloqueada;
- duplicidade de perfil/permissao foi bloqueada;
- dados ficticios foram removidos;
- todas as tabelas `mod_auth` ficaram vazias apos a limpeza.

Registro seguro da aplicacao em producao:

- backup manual do banco ativo foi criado antes da aplicacao;
- backup manual foi validado como legivel;
- a migration `0008` foi aplicada no banco ativo;
- as tabelas `mod_auth.perfis`, `mod_auth.permissoes`, `mod_auth.usuario_perfis` e `mod_auth.perfil_permissoes` foram criadas;
- indices foram validados;
- FKs restritivas foram validadas com `ON UPDATE RESTRICT` e `ON DELETE RESTRICT`;
- todas as tabelas `mod_auth` permaneceram vazias apos a criacao: `mod_auth.usuarios`, `mod_auth.perfis`, `mod_auth.permissoes`, `mod_auth.usuario_perfis` e `mod_auth.perfil_permissoes`;
- a API publica continuou saudavel;
- `/api/health` continuou OK;
- `/api/public/iluminacao/health` continuou OK;
- `/api/version` continuou retornando ambiente `producao`;
- nenhum usuario real, perfil real, permissao real, vinculo real, seed, endpoint ou login funcional foi criado.

Tabelas criadas pela migration:

- `mod_auth.perfis`
- `mod_auth.permissoes`
- `mod_auth.usuario_perfis`
- `mod_auth.perfil_permissoes`

### `mod_auth.perfis`

Campos:

- `id bigserial primary key`
- `chave varchar(80) not null`
- `nome varchar(120) not null`
- `descricao varchar(500) null`
- `ativo boolean not null default true`
- `criado_em timestamptz not null default now()`

Constraints e indices:

- `chave` unica.
- `chave` nao vazia.
- `nome` nao vazio.
- Indice por `ativo`.

### `mod_auth.permissoes`

Campos:

- `id bigserial primary key`
- `modulo varchar(80) not null`
- `chave varchar(120) not null`
- `descricao varchar(500) null`
- `ativo boolean not null default true`
- `criado_em timestamptz not null default now()`

Constraints e indices:

- Permissao unica por `modulo + chave`.
- `modulo` nao vazio.
- `chave` nao vazia.
- Indices por `modulo` e `ativo`.

### `mod_auth.usuario_perfis`

Campos:

- `usuario_id bigint not null`
- `perfil_id bigint not null`
- `modulo varchar(80) null`
- `ativo boolean not null default true`
- `criado_em timestamptz not null default now()`

Constraints e indices:

- FK restritiva para `mod_auth.usuarios(id)`.
- FK restritiva para `mod_auth.perfis(id)`.
- PK composta ou unique em `usuario_id + perfil_id + modulo`.
- Check para `modulo` nao vazio quando informado.
- Indices por `usuario_id`, `perfil_id`, `modulo` e `ativo`.

### `mod_auth.perfil_permissoes`

Campos:

- `perfil_id bigint not null`
- `permissao_id bigint not null`
- `criado_em timestamptz not null default now()`

Constraints e indices:

- FK restritiva para `mod_auth.perfis(id)`.
- FK restritiva para `mod_auth.permissoes(id)`.
- PK composta ou unique em `perfil_id + permissao_id`.
- Indices por `perfil_id` e `permissao_id`.

Observacao:

- Nao inserir perfis reais nesta migration.
- Seed inicial de perfis/permissoes deve ser decisao futura separada.

Rollback correspondente:

- Remover primeiro `mod_auth.perfil_permissoes`.
- Remover depois `mod_auth.usuario_perfis`.
- Remover depois `mod_auth.permissoes`.
- Remover por fim `mod_auth.perfis`.
- Nao remover `mod_auth.usuarios`.

## 5. Migration `0009_create_mod_auth_sessoes_login_auditoria.sql`

Status: aplicada e validada em homologacao e no banco ativo de producao.

Esta migration cria apenas tabelas estruturais de sessoes e auditoria de login. Ela nao cria login funcional, endpoints, usuarios, senhas, tokens reais, sessoes reais, auditorias reais, seeds, GRANTs, triggers ou funcoes.

Registro seguro da validacao em homologacao:

- backup manual de homologacao foi criado antes da aplicacao;
- backup manual foi validado como legivel;
- a migration `0009` foi aplicada em homologacao;
- as tabelas `mod_auth.sessoes` e `mod_auth.login_auditoria` foram criadas;
- indices foram validados;
- FKs restritivas foram validadas com `ON UPDATE RESTRICT` e `ON DELETE RESTRICT`;
- insert ficticio de usuario temporario funcionou;
- insert ficticio de sessao funcionou;
- insert ficticio de auditoria de login funcionou;
- consulta dos registros ficticios funcionou;
- duplicidade de `token_hash` foi bloqueada;
- sessao com expiracao invalida foi bloqueada;
- auditoria com login em branco foi bloqueada;
- dados ficticios foram removidos;
- todas as tabelas `mod_auth` ficaram vazias apos a limpeza;
- nenhum dado real, seed, endpoint ou login funcional foi criado.

Registro seguro da aplicacao em producao:

- backup manual do banco ativo foi criado antes da aplicacao;
- backup manual foi validado como legivel;
- a migration `0009` foi aplicada no banco ativo;
- as tabelas `mod_auth.sessoes` e `mod_auth.login_auditoria` foram criadas;
- indices foram validados;
- FKs restritivas `fk_mod_auth_sessoes_usuario` e `fk_mod_auth_login_auditoria_usuario` foram validadas com `ON UPDATE RESTRICT` e `ON DELETE RESTRICT`;
- todas as tabelas `mod_auth` permaneceram vazias apos a criacao: `mod_auth.usuarios`, `mod_auth.perfis`, `mod_auth.permissoes`, `mod_auth.usuario_perfis`, `mod_auth.perfil_permissoes`, `mod_auth.sessoes` e `mod_auth.login_auditoria`;
- a API publica continuou saudavel;
- `/api/health` continuou OK;
- `/api/public/iluminacao/health` continuou OK;
- `/api/version` continuou retornando ambiente `producao`;
- nenhum usuario real, sessao real, token real, auditoria real, seed, endpoint ou login funcional foi criado.

Com a aplicacao da `0009`, a base estrutural inicial do schema `mod_auth` esta concluida. A proxima etapa deve planejar e implementar autenticacao backend com testes, sem criar acesso interno publico sem autenticacao.

## 5.1 Migration `0010_make_auth_user_email_optional.sql`

Status: aplicada e validada em homologacao e no banco ativo de producao.

Esta migration altera `mod_auth.usuarios` para autenticacao interna por `login` obrigatorio e senha, com `email` opcional.

Alteracoes:

- `email` deixa de ser `NOT NULL`.
- Recriar `ux_mod_auth_usuarios_email_lower` como indice unico parcial com `WHERE email IS NOT NULL`.
- `ux_mod_auth_usuarios_login_lower` permanece como unicidade case-insensitive obrigatoria do login.
- Atualizar comentarios de `email` e `login` para documentar o login como identificador principal.

Ela nao cria usuario real, seed, endpoint, sessao, cookie, CSRF, JWT, GRANT, trigger ou funcao. Permissoes futuras devem se vincular a `usuario_id` e, quando necessario para referencia humana, ao `login`, nao ao e-mail.

Registro seguro da validacao em homologacao:

- backup manual de homologacao foi criado antes da aplicacao;
- backup manual foi validado como legivel;
- a migration `0010` foi aplicada em homologacao;
- `email` de `mod_auth.usuarios` foi alterado para `NULL`;
- `ux_mod_auth_usuarios_email_lower` foi recreado como indice unico parcial com `WHERE email IS NOT NULL`;
- `ux_mod_auth_usuarios_login_lower` permanece como indice unico obrigatorio;
- comentarios foram validados em homologacao;
- tabelas `mod_auth.usuarios`, `mod_auth.sessoes` e `mod_auth.login_auditoria` permaneceram vazias apos validacao;
- nenhum usuario real, seed, endpoint ou login funcional foi criado.

Registro seguro da aplicacao em producao:

- backup manual do banco ativo foi criado antes da aplicacao;
- backup manual foi validado como legivel;
- a migration `0010` foi aplicada no banco ativo;
- `email` de `mod_auth.usuarios` foi alterado para `NULL`;
- `ux_mod_auth_usuarios_email_lower` foi recreado como indice unico parcial com `WHERE email IS NOT NULL`;
- `ux_mod_auth_usuarios_login_lower` permanece como indice unico obrigatorio;
- comentarios foram validados em producao;
- tabelas `mod_auth.usuarios`, `mod_auth.sessoes` e `mod_auth.login_auditoria` permaneceram vazias apos a criacao;
- a API publica continuou saudavel;
- `/api/health`, `/api/public/iluminacao/health` e `/api/version` continuaram retornando status correto;
- nenhum usuario real, seed, endpoint, sessao, cookie ou login funcional foi criado.

Rollback correspondente:

- Restaurar `email` para `NOT NULL` em `mod_auth.usuarios`.
- Recriar `ux_mod_auth_usuarios_email_lower` como indice unico obrigatorio por `lower(email)`.
- Nao remover `mod_auth.usuarios`, `mod_auth.sessoes`, `mod_auth.login_auditoria` ou o schema `mod_auth`.

## 6. Rollbacks futuros

- Cada migration deve ter rollback correspondente.
- Rollbacks devem ser cautelosos e revisados.
- Rollback `0009` deve remover apenas sessoes/auditoria.
- Rollback `0008` deve remover vinculos antes das tabelas principais.
- Rollback `0007` deve remover usuarios somente se nao houver dependencias.
- Rollback `0006` deve remover o schema apenas se estiver vazio.
- Nenhum rollback deve dropar outros schemas.

## 7. Seguranca

- Migrations nao devem incluir usuarios reais.
- Migrations nao devem incluir emails reais.
- Migrations nao devem incluir senhas reais.
- Migrations nao devem incluir hashes reais.
- Migrations nao devem incluir tokens reais.
- Migrations nao devem conceder permissoes amplas.
- `GRANTs` para usuario da API interna devem ser etapa separada.
- Menor privilegio deve ser aplicado.

## 8. Estrategia de aplicacao

1. Criar SQL.
2. Revisar SQL.
3. Commitar migrations e rollbacks.
4. Aplicar em homologacao com backup.
5. Validar estrutura.
6. Testar constraints com dados ficticios.
7. Limpar dados de teste.
8. Documentar resultado.
9. Aplicar em producao somente depois, com backup e janela controlada.

## 9. Criterios de aceite

- Documentacao tecnica clara.
- Sem codigo funcional.
- Sem migrations criadas nesta etapa.
- Sem endpoints criados.
- Sem dados sensiveis.
- Plano pronto para gerar migrations pequenas e revisaveis.

## 10. Migration 0011 de auditoria administrativa - criada, nao aplicada

O proximo bloco da Etapa 0 provavelmente exigira migration estrutural para uma tabela propria de auditoria administrativa, pois `mod_auth.login_auditoria` possui finalidade especifica de autenticacao e nao deve receber eventos de gestao de usuarios, perfis e permissoes.

Antes de numerar ou criar a migration, deve ser feito inventario do schema real e dos GRANTs atuais. A proposta deve prever:

- tabela append-only para os campos definidos em `INTERNAL-AUTH-DATA-MODEL.md`;
- constraints para `acao`, `resultado` e tamanhos maximos de textos sanitizados;
- indices por data, ator, acao, entidade e resultado somente quando justificados pelas consultas previstas;
- foreign key opcional ou estrategia de snapshot que preserve a auditoria mesmo apos desativacao ou exclusao logica do usuario;
- GRANT minimo de `INSERT` para a role de runtime e `SELECT` apenas para papel autorizado;
- ausencia de `UPDATE` e `DELETE` no fluxo normal;
- rollback cauteloso, proibido em producao se houver eventos reais sem backup e decisao explicita de retencao.

A protecao do ultimo administrador e as regras de anti-autoelevacao devem ser implementadas no service e repository transacional. Trigger de banco nao deve ser adotado automaticamente: sua necessidade deve ser avaliada somente se as garantias da aplicacao e do modelo de concorrencia forem insuficientes.

Classificacao atual: **migration estrutural criada e testada localmente, ainda nao aplicada em nenhum banco real**. Permissoes administrativas novas tambem exigirao seed, bootstrap ou migration operacional idempotente em ciclo separado, nunca SQL manual solto sem rastreabilidade.

Atualizacao local do commit `9f6ec75`: a migration foi criada como `0011_create_mod_auth_admin_auditoria.sql`, acompanhada de `0011_drop_mod_auth_admin_auditoria.sql`. Ela cria `mod_auth.admin_auditoria`, constraints de campos obrigatorios e resultado, alem de indices por data, ator, acao, entidade e resultado. Nao cria dados, seeds ou GRANTs e nao foi executada em homologacao ou producao.

Proximo passo operacional:

1. atualizar o servidor de homologacao com `git pull --ff-only`;
2. confirmar working tree limpo e commit esperado;
3. criar e validar backup manual do banco de homologacao;
4. aplicar somente a migration `0011`;
5. validar tabela, constraints, indices e privilegios;
6. conceder ao runtime apenas os privilegios minimos necessarios, se aplicavel;
7. executar testes e validar os endpoints administrativos existentes;
8. documentar o resultado antes de planejar producao.
