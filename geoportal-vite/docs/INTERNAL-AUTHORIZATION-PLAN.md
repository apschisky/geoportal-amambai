# Plano de Autenticacao e Autorizacao Interna

Este documento registra a arquitetura funcional de autorizacao do Geoportal Interno e o desenho conceitual dos endpoints internos protegidos do modulo de Iluminacao Publica. Ele nao cria codigo, migrations, endpoints, usuarios reais, perfis reais, permissoes reais, senhas, tokens ou configuracoes de ambiente.

O modelo conceitual transversal de dados de autenticacao/autorizacao esta em `docs/INTERNAL-AUTH-DATA-MODEL.md`.

A decisao tecnica de autenticacao interna e autorizacao deve ser alinhada com `docs/INTERNAL-AUTH-TECHNICAL-DECISIONS.md` antes de implementar endpoints.

O plano tecnico das futuras migrations de `mod_auth` esta em `docs/INTERNAL-AUTH-MIGRATIONS-PLAN.md`.

O plano de threat model, controles e validacao para a implementacao segura da autenticacao backend esta em `docs/INTERNAL-AUTH-SECURITY-IMPLEMENTATION-PLAN.md`.

Registro documental: a migration `0008_create_mod_auth_perfis_permissoes.sql` foi aplicada e validada em homologacao e no banco ativo de producao para estruturar perfis, permissoes e vinculos. Dados ficticios de validacao foram removidos em homologacao, todas as tabelas `mod_auth` permaneceram vazias apos a criacao em producao e nenhum usuario, perfil, permissao, vinculo, seed, endpoint ou login funcional foi criado.

Registro documental: a migration `0009_create_mod_auth_sessoes_login_auditoria.sql` foi aplicada e validada em homologacao e no banco ativo de producao para estruturar sessoes e auditoria de login. Dados ficticios de validacao foram removidos em homologacao, todas as tabelas `mod_auth` permaneceram vazias apos a criacao em producao e nenhum login funcional, endpoint, token real, sessao real, auditoria real ou seed foi criado. A base estrutural inicial do schema `mod_auth` esta concluida; a proxima etapa deve planejar e implementar autenticacao backend com testes, sem criar acesso interno publico sem autenticacao.

Registro arquitetural atual: a autenticacao interna, a sessao opaca por cookie HttpOnly e o logout ja foram validados em homologacao. A proxima fase segura nao e tela/frontend. A proxima fase deve ser autorizacao funcional por usuarios, perfis, permissoes, modulos e acoes, com validacao no backend antes de qualquer endpoint de negocio ou tela administrativa.

Registro de implementacao da base tecnica: foram implementados repository de permissoes efetivas do usuario, service `has_permission(usuario_id, permissao)`, dependency FastAPI `require_permission("permissao")` e endpoint tecnico `GET /api/internal/auth/me`. Esta etapa nao cria perfis reais, permissoes reais, vinculos reais, usuarios reais, roles, GRANTs, migrations, seeds, endpoints administrativos reais ou tela interna.

Registro operacional de validacao do `/api/internal/auth/me`: o commit `03efa10` Implementa base de autorizacao interna foi aplicado no servidor e validado com pytest completo: 311 passed. A validacao ocorreu em processo isolado de homologacao com `DATABASE_URL` temporaria usando `geoportal_api_homolog`, `GEOPORTAL_INTERNAL_ROUTES_ENABLED`, `GEOPORTAL_INTERNAL_SESSION_SECRET`, `GEOPORTAL_INTERNAL_SESSION_COOKIE_SECURE=false` para TestClient/local e `TEST_INTERNAL_PASSWORD`; todas as variaveis temporarias foram limpas ao final. O primeiro teste falhou por falta de `SELECT` em `mod_auth.usuario_perfis`, confirmando a necessidade de ampliar a matriz runtime apenas para leitura das tabelas de autorizacao. Em homologacao, foram concedidos somente `GRANT SELECT` para `geoportal_api_homolog` em `mod_auth.usuario_perfis`, `mod_auth.perfis`, `mod_auth.perfil_permissoes` e `mod_auth.permissoes`; a validacao confirmou `SELECT=true` e `INSERT=false`, `UPDATE=false`, `DELETE=false` em cada tabela.

Resultado sanitizado final do `/me`: `login_status=200`, `login_set_cookie=True`, `cookie_jar_tem_sessao=True`, `me_status=200`, `me_authenticated=True`, `me_usuario_id=7`, `me_permissoes=[]`, `me_tem_token=False`, `me_tem_cookie=False`, `me_tem_senha_hash=False`, `me_tem_token_hash=False`, `me_tem_session_secret=False`, `me_tem_database_url=False`. `permissoes=[]` e esperado porque ainda nao foi criado nem atribuido perfil/permissao real ao `admin.homologacao`. Producao, NSSM e `.env` versionado nao foram alterados.

Plano de bootstrap controlado: a proxima etapa sera criar em homologacao o perfil inicial `Administrador Interno do Geoportal` e permissoes administrativas por script administrativo idempotente, com `--dry-run`, testes automatizados e validacao de ambiente, nao por SQL manual solto. O script deve usar bind parameters, nao apagar registros, nao duplicar perfis/permissoes/vinculos, criar permissoes e perfil quando ausentes, associar permissoes ao perfil quando ainda nao associadas, atribuir o perfil ao usuario informado quando ainda nao atribuido, exigir parametros explicitos como `--login`, nao depender de login hardcoded e nao imprimir senha, token, hash, `session_secret` ou `DATABASE_URL`.

Permissoes administrativas iniciais propostas: `admin.usuarios.ler`, `admin.usuarios.criar`, `admin.usuarios.bloquear`, `admin.usuarios.redefinir_senha`, `admin.usuarios.atribuir_perfis`, `admin.perfis.ler`, `admin.perfis.gerenciar`, `admin.permissoes.ler`, `admin.permissoes.gerenciar` e `internal.auth.me`. Em homologacao, o perfil sera atribuido ao `admin.homologacao`. Esse administrador funcional nao e superuser de banco e nao deve receber permissoes PostgreSQL especiais por ser administrador da aplicacao.

Implementacao local do bootstrap: foram criados `geoportal-backend/scripts/admin/bootstrap_internal_admin_profile.py`, `geoportal-backend/app/repositories/auth_admin_profile_repository.py` e testes automatizados dedicados. O script exige `--login`, aceita `--dry-run`, nao aceita senha por argumento, nao usa login hardcoded, nao executa `DELETE` e usa SQL parametrizado. Nesta etapa, nao foi executado contra banco real e nao criou perfil/permissao/vinculo real.

Validacao operacional do bootstrap em homologacao: o commit `5a4d2bf` Adiciona bootstrap de perfil administrativo foi aplicado no servidor e validado com pytest completo: 327 passed. Houve backup de roles e backup custom do banco de homologacao antes da operacao. O dry-run passou com a mensagem "Dry-run validado. Nenhum perfil, permissao ou vinculo foi alterado."; a execucao real passou com "Bootstrap do perfil administrativo interno concluido com sucesso.". Foram criados/validados o perfil `administrador-interno-geoportal`, 10 permissoes administrativas ativas, 10 vinculos perfil-permissao e o vinculo global `admin.homologacao` -> `administrador-interno-geoportal` com `modulo NULL`.

A role operacional `geoportal_auth_admin_homolog` recebeu permissoes temporarias de `SELECT`/`INSERT` nas tabelas de autorizacao e `USAGE`/`SELECT` nas sequences `perfis_id_seq` e `permissoes_id_seq`; apos a operacao, `INSERT` e permissoes de sequence foram revogadas. O estado final validado manteve apenas `SELECT` nas tabelas de autorizacao, sem `INSERT`, `UPDATE` ou `DELETE`. O `/api/internal/auth/me` retornou 10 permissoes esperadas para `admin.homologacao` e nao retornou token, cookie, `senha_hash`, `token_hash`, `session_secret` ou `DATABASE_URL`. Producao, NSSM, `.env` versionado e frontend nao foram alterados.

Endpoint tecnico de permissao: `GET /api/internal/auth/permission-smoke` foi implementado para validar `require_permission("internal.auth.me")` em rota real antes de endpoints administrativos. Ele fica sob a mesma feature flag interna, exige sessao autenticada e permissao `internal.auth.me`, nao exige `X-Geoportal-Internal-Request` por ser GET tecnico de consulta e retorna payload minimo (`authorized`, `permission`, `usuario_id`). As respostas sao padronizadas para futuro frontend: 401 generico sem sessao, 403 generico sem permissao e 200 quando autorizado. O endpoint nao retorna token, cookie, senha, `senha_hash`, `token_hash`, `session_secret`, `DATABASE_URL`, SQL, role ou GRANT, nao usa login hardcoded e nao e endpoint administrativo real.

Validacao operacional do endpoint tecnico de permissao em homologacao: o commit `251cf65` Adiciona smoke de permissao interna foi aplicado no servidor e validado com pytest completo: 335 passed. A validacao ocorreu em processo isolado de homologacao com variaveis temporarias (`DATABASE_URL` para `geoportal_api_homolog`, `GEOPORTAL_INTERNAL_ROUTES_ENABLED=true`, `GEOPORTAL_INTERNAL_SESSION_SECRET` temporario, `GEOPORTAL_INTERNAL_SESSION_COOKIE_SECURE=false` para TestClient, `TEST_INTERNAL_PASSWORD` temporario); todas as variaveis foram limpas ao final.

Resultado sanitizado da validacao do permission-smoke:
- Sem sessao: `sem_sessao_status=401`, `sem_sessao_body={'detail': 'Not authenticated'}`.
- Com admin.homologacao autenticado e com permissao internal.auth.me: `login_status=200`, `login_set_cookie=True`, `cookie_jar_tem_sessao=True`, `permission_status=200`, `permission_authorized=True`, `permission_code=internal.auth.me`, `permission_usuario_id=7`.
- A resposta do endpoint nao retornou: token, cookie, `senha_hash`, `token_hash`, `session_secret`, `DATABASE_URL`, SQL, role ou GRANT.
- Variaveis temporarias foram limpas apos o teste.
- Producao, NSSM, `.env` versionado e frontend nao foram alterados.

Primeiro endpoint administrativo real: `GET /api/internal/admin/users` foi implementado somente para leitura e protegido por `require_permission("admin.usuarios.ler")`. Ele retorna lista sanitizada de usuarios internos com `id`, `login`, `nome`, `email`, `ativo`, `bloqueado` booleano e `criado_em`. O endpoint nao retorna senha, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, dados de sessao, auditoria, SQL, role, GRANT ou `bloqueado_ate`; nao exige header mutavel por ser GET de consulta; e nao cria endpoint de escrita, criacao, bloqueio/desbloqueio, reset de senha ou atribuicao de perfil. Ele e base tecnica futura para tela administrativa, mas nenhuma tela foi criada.

Endpoint administrativo de detalhe somente leitura: `GET /api/internal/admin/users/{usuario_id}` foi implementado para consultar um usuario interno por `id`, sob `GEOPORTAL_INTERNAL_ROUTES_ENABLED` e protegido por `require_permission("admin.usuarios.ler")`. Ele usa bind parameter, consulta apenas `mod_auth.usuarios` e retorna somente `usuario` com `id`, `login`, `nome`, `email`, `ativo`, `bloqueado` booleano e `criado_em`. Sem sessao retorna 401 generico, sem permissao retorna 403 generico e usuario inexistente retorna 404 generico. Por ser GET de consulta, nao exige `X-Geoportal-Internal-Request`. O endpoint nao retorna senha, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, dados de sessao, auditoria, SQL, role, GRANT, `bloqueado_ate`, `atualizado_em` ou `ultimo_login_em`; tambem nao cria endpoint mutavel, usuario, bloqueio/desbloqueio, reset de senha ou atribuicao de perfil. Ele amplia a base tecnica futura da tela administrativa, mas nenhuma tela foi criada.

Validacao operacional de GET /api/internal/admin/users em homologacao: o commit `119390e` Adiciona listagem interna de usuarios foi aplicado no servidor e validado com pytest completo: 347 passed. A validacao ocorreu em processo isolado de homologacao com variaveis temporarias; todas foram limpas ao final. Sem sessao, o endpoint retornou 401 com `{'detail': 'Not authenticated'}`. Com admin.homologacao autenticado (que possui a permissao admin.usuarios.ler), o endpoint retornou 200 com lista sanitizada de usuarios. Resultado sanitizado: `login_status=200`, `login_set_cookie=True`, `cookie_jar_tem_sessao=True`, `users_status=200`, `users_tem_lista=True`, `users_total=1`, `users_tem_admin_homologacao=True`. Campos retornados em cada usuario: `id`, `login`, `nome`, `email`, `ativo`, `bloqueado`, `criado_em`. A resposta nao expôs senha, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, SQL, role, GRANT, dados de sessao, auditoria ou `bloqueado_ate`. Variaveis temporarias foram limpas apos o teste. Producao, NSSM, `.env` versionado e frontend nao foram alterados. Nenhum endpoint mutavel foi criado nesta etapa.

Validacao operacional de GET /api/internal/admin/users/{usuario_id} em homologacao: o commit `ea4e457` Adiciona detalhe interno de usuario foi aplicado no servidor e validado com pytest completo: 358 passed. A validacao ocorreu em processo isolado de homologacao com variaveis temporarias; todas foram limpas ao final. Sem sessao, o endpoint retornou 401 com `{'detail': 'Not authenticated'}`. Com admin.homologacao autenticado (que possui a permissao admin.usuarios.ler), o endpoint retornou 200 para o usuario_id=7 (admin.homologacao) com objeto `usuario` sanitizado contendo `id`, `login`, `nome`, `email`, `ativo`, `bloqueado`, `criado_em`. Usuario inexistente retornou 404 generico `{'detail': 'Not found'}`. A resposta nao expôs senha, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, SQL, role, GRANT, dados de sessao, auditoria, `bloqueado_ate`, `atualizado_em` ou `ultimo_login_em`. Variaveis temporarias foram limpas apos o teste. Producao, NSSM, `.env` versionado e frontend nao foram alterados. Nenhum endpoint mutavel foi criado nesta etapa.

Contrato planejado para o primeiro endpoint administrativo mutavel: `POST /api/internal/admin/users` deve ser implementado somente em etapa separada com Codex High. Ele deve ficar sob `GEOPORTAL_INTERNAL_ROUTES_ENABLED`, exigir sessao autenticada, `require_permission("admin.usuarios.criar")`, header `X-Geoportal-Internal-Request: 1` e a protecao CSRF/equivalente das rotas mutaveis internas. O endpoint cria somente usuario basico: nao atribui perfil, nao bloqueia/desbloqueia, nao redefine senha de usuario existente, nao cria permissoes, nao cria sessao, nao envia e-mail e nao cria tela. Payload planejado: `login` obrigatorio, `nome` obrigatorio, `email` opcional e `senha_inicial` obrigatoria. Campos proibidos no payload inicial: `id`, `ativo`, `bloqueado`, `bloqueado_ate`, `senha_hash`, `perfil`, `perfis`, `permissoes`, `role`, `token`, `session_secret`, `DATABASE_URL`, campos de auditoria e campos de sessao. Validacoes: aplicar `strip` no login, exigir login e nome nao vazios, garantir login unico case-insensitive, validar e-mail se informado e respeitar unicidade existente, exigir `senha_inicial` conforme politica de senha existente, rejeitar campos extras quando o padrao Pydantic permitir, nao usar login hardcoded e nao aceitar perfil/permissao nesse endpoint. Persistencia: inserir em `mod_auth.usuarios`, gerar `senha_hash` Argon2id com utilitario existente, criar com `ativo=true`, `desativado_em=NULL`, `bloqueado_ate=NULL`, `atualizado_em=NULL` ou conforme padrao existente, sem criar sessao, perfil, vinculo `usuario_perfis`, auditoria de login ou apagar registros. Resposta 201 planejada: `usuario.id`, `usuario.login`, `usuario.nome`, `usuario.email`, `usuario.ativo`, `usuario.bloqueado`, `usuario.criado_em`; proibido retornar senha, `senha_inicial`, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, SQL, role, GRANT, sessao, auditoria, `bloqueado_ate`, `atualizado_em` ou `ultimo_login_em`. Erros planejados: 401 `Not authenticated`, 403 `Forbidden`, 409 `Conflict` para login/e-mail duplicado e 422 para payload invalido, com respostas genericas e sanitizadas, sem tabela, SQL ou constraint. Esta etapa e apenas documental: nao cria endpoint, usuario real, perfil, permissao, role, GRANT, migration, schema, producao, NSSM, `.env`, frontend ou tela.

Primeiro endpoint administrativo mutavel implementado: `POST /api/internal/admin/users` cria somente usuario interno basico e e protegido por `require_permission("admin.usuarios.criar")`, sessao autenticada e header `X-Geoportal-Internal-Request: 1`. O endpoint aceita apenas `login`, `nome`, `email` opcional e `senha_inicial`, rejeita campos extras e retorna 201 com objeto `usuario` sanitizado (`id`, `login`, `nome`, `email`, `ativo`, `bloqueado`, `criado_em`). A senha inicial nunca e retornada; o backend gera `senha_hash` Argon2id e persiste em `mod_auth.usuarios`. Conflitos de login/e-mail retornam 409 generico; payload invalido retorna 422. A implementacao nao atribui perfil, nao cria vinculo `usuario_perfis`, nao cria sessao, nao escreve em `login_auditoria`, nao envia e-mail, nao cria endpoint de bloqueio/desbloqueio/reset/perfis, nao altera schema, nao cria migration, nao altera producao, NSSM, `.env`, frontend ou tela.

Politica de senha inicial para criacao administrativa: a validacao fica centralizada no backend antes do Argon2id. A senha e obrigatoria, apos `strip` deve ter minimo de 6 e maximo de 128 caracteres, pelo menos uma letra e um numero, nao pode ser igual ao login ou ao nome, e bloqueia lista curta de senhas comuns. A validacao nao retorna nem registra a senha e o endpoint retorna 422 generico para senha fraca, sem expor `senha_inicial` ou o valor recebido.

Validacao operacional de criacao interna de usuario em homologacao: o commit `99f2987` Reforca politica de senha interna foi aplicado no servidor e validado com pytest completo: 403 passed. Antes da operacao, houve backup de roles e backup custom do banco de homologacao. A role `geoportal_api_homolog` recebeu o minimo para criacao pelo endpoint: `INSERT` em `mod_auth.usuarios` e `USAGE`/`SELECT` em `mod_auth.usuarios_id_seq`; a validacao final confirmou leitura/insercao/update tecnico existentes em `mod_auth.usuarios`, `DELETE=false` e sequence com `USAGE`/`SELECT`. O POST foi validado em processo isolado com variaveis temporarias limpas ao final. Resultado sanitizado: 401 sem sessao; 403 sem `X-Geoportal-Internal-Request: 1`; 422 para senha invalida/fraca; 201 para criacao valida de `teste.criacao` (`id=8`, `email=NULL`, `ativo=true`, `bloqueado=false`, `criado_em` presente); 409 para duplicidade; 200 no detalhe do usuario criado; e 200 no login do usuario criado. O novo usuario nao recebeu perfil automaticamente e `/api/internal/auth/me` retornou `permissoes=[]`. A resposta nao retornou senha real, `senha_inicial`, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, SQL, role, GRANT, sessao, auditoria ou `bloqueado_ate`. Producao, NSSM, `.env` versionado e frontend nao foram alterados.

Contrato planejado para atribuicao de perfil a usuario: `POST /api/internal/admin/users/{usuario_id}/profiles` deve ser implementado em etapa separada, sob `GEOPORTAL_INTERNAL_ROUTES_ENABLED`, com sessao autenticada, `require_permission("admin.usuarios.atribuir_perfis")` e header `X-Geoportal-Internal-Request: 1`. O primeiro ciclo atribui apenas um perfil por requisicao. Payload permitido: `perfil_id` obrigatorio e `modulo` opcional/nulo. Campos proibidos: `usuario_id` no corpo, `perfil_chave`, `permissoes`, `login`, senha, `senha_hash`, token, role, GRANT, `session_secret`, `DATABASE_URL`, auditoria e sessao. Comportamento planejado: 201 Created quando criar vinculo ativo, 200 OK quando vinculo ativo ja existir sem duplicar, 401 sem sessao, 403 sem permissao, 403 `Invalid internal request` sem header mutavel, 404 generico se usuario ou perfil nao existir e 422 para payload invalido. A primeira versao nao deve reativar vinculo inativo automaticamente, remover perfil, criar perfil, criar permissao, alterar senha, criar sessao, enviar e-mail, implementar batch ou alterar producao. Resposta planejada em envelope: `vinculo.usuario_id`, `vinculo.perfil_id`, `vinculo.modulo`, `vinculo.ativo`. A atribuicao de perfil e separada da criacao de usuario; a tela futura podera exibir perfis em checkboxes e chamar esse endpoint uma vez por perfil marcado. Endpoint batch/lista fica para fase futura, quando houver necessidade e auditoria definida. A validacao em homologacao deve usar `teste.criacao`: antes da atribuicao, `/me` retorna `permissoes=[]`; depois, deve retornar as permissoes do perfil atribuido.

Endpoint de atribuicao de perfil implementado: `POST /api/internal/admin/users/{usuario_id}/profiles` cria ou garante um vinculo ativo em `mod_auth.usuario_perfis` para um unico perfil por requisicao. A rota fica sob `GEOPORTAL_INTERNAL_ROUTES_ENABLED`, exige sessao autenticada, `require_permission("admin.usuarios.atribuir_perfis")` e `X-Geoportal-Internal-Request: 1`. O payload aceito permanece restrito a `perfil_id` positivo e `modulo` opcional/nulo, com rejeicao de campos extras e resposta 422 generica para payload invalido. O repository valida usuario existente e perfil ativo, usa bind parameters, nao interpola valores na SQL, retorna 201 para vinculo novo, 200 para vinculo ativo existente sem duplicar, 404 generico para usuario/perfil ausente e 409 generico para vinculo inativo nao reativado automaticamente. A resposta retorna somente envelope `vinculo` com `usuario_id`, `perfil_id`, `modulo` e `ativo`, sem token, cookie, senha, `senha_hash`, `session_secret`, `DATABASE_URL`, SQL, role, GRANT, sessao ou auditoria. A implementacao nao cria perfil/permissao/usuario real, nao remove perfil, nao cria batch, nao cria sessao, nao escreve auditoria, nao altera schema, nao cria migration, nao altera producao, NSSM, `.env`, frontend ou tela.

Validacao operacional da atribuicao de perfil em homologacao: o commit `092b5bb` Adiciona atribuicao interna de perfil foi aplicado no servidor e validado com pytest completo: 426 passed. A role `geoportal_api_homolog` recebeu o minimo necessario para a validacao, `INSERT` em `mod_auth.usuario_perfis`; a matriz final confirmou `usuario_perfis_select=t`, `usuario_perfis_insert=t`, `usuario_perfis_update=f`, `usuario_perfis_delete=f`, `usuarios_select=t`, `perfis_select=t`, `permissoes_select=t` e `perfil_permissoes_select=t`. Antes da atribuicao, `teste.criacao` (`id=8`) autenticava e `/api/internal/auth/me` retornava `permissoes=[]`. Foram validados: 401 sem sessao; 403 sem `X-Geoportal-Internal-Request: 1`; 201 para atribuicao valida do `perfil_id=3` com `modulo=None`; 200 para repeticao idempotente; 404 para perfil inexistente; 422 para payload invalido. Depois da atribuicao, `/me` para `teste.criacao` retornou 10 permissoes: `admin.perfis.gerenciar`, `admin.perfis.ler`, `admin.permissoes.gerenciar`, `admin.permissoes.ler`, `admin.usuarios.atribuir_perfis`, `admin.usuarios.bloquear`, `admin.usuarios.criar`, `admin.usuarios.ler`, `admin.usuarios.redefinir_senha` e `internal.auth.me`. A flag `response_tem_senha=True` ocorreu apenas porque a permissao tecnica `admin.usuarios.redefinir_senha` contem a palavra `senha`; nenhuma senha real, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, SQL, role, GRANT, sessao ou auditoria foi exposta. Variaveis temporarias foram limpas. Producao, NSSM, `.env` versionado e frontend nao foram alterados.

Endpoint de listagem de perfis implementado: `GET /api/internal/admin/profiles` lista perfis internos ativos para base futura da tela de atribuicao por checkboxes. A rota fica sob `GEOPORTAL_INTERNAL_ROUTES_ENABLED`, exige sessao autenticada e `require_permission("admin.perfis.ler")`, e nao exige `X-Geoportal-Internal-Request` por ser GET somente leitura. O repository consulta somente `mod_auth.perfis`, filtra `ativo=true`, ordena por `nome`, `chave` e `id`, e retorna apenas `id`, `chave`, `nome`, `ativo` e `criado_em`. A primeira versao nao lista permissoes detalhadas de cada perfil, nao consulta usuarios/sessoes/auditoria, nao cria/edita/remove perfil, nao cria permissao, usuario ou vinculo, nao cria endpoint mutavel, nao altera schema, nao cria migration, nao altera producao, NSSM, `.env`, frontend ou tela. Respostas esperadas: 200 com lista sanitizada, 401 sem sessao, 403 sem `admin.perfis.ler` e 404 quando a feature flag interna estiver fechada.

Validacao operacional de GET /api/internal/admin/profiles em homologacao: o commit `93d96f4` Adiciona listagem interna de perfis foi aplicado no servidor e validado com pytest completo: 439 passed. A validacao ocorreu em processo isolado de homologacao com variaveis temporarias; todas foram limpas ao final. Sem sessao, o endpoint retornou 401 com `{'detail': 'Not authenticated'}`. Com admin.homologacao autenticado e com `admin.perfis.ler`, o endpoint retornou 200. Resultado sanitizado: `profiles_status=200`, `profiles_tem_lista=True`, `profiles_total=1`, `profiles_tem_admin_interno=True`. Campos retornados: `id`, `chave`, `nome`, `ativo`, `criado_em`. A resposta nao expôs senha, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, SQL, role, GRANT, sessao, auditoria, permissoes, `perfil_permissoes` ou usuarios. Producao, NSSM, `.env` versionado e frontend nao foram alterados. Nenhum endpoint mutavel, usuario, perfil, permissao, vinculo, role ou GRANT foi criado nesta validacao.

Proximas etapas recomendadas: validar a listagem de perfis em homologacao; planejar bloqueio/desbloqueio de usuario; planejar reset de senha via endpoint; depois criar o primeiro endpoint interno de negocio do modulo Iluminacao; tela interna continua etapa posterior.

## Plano: Bloqueio e Desbloqueio de Usuário Interno

Resumo: documentar o contrato técnico e as regras de segurança antes de implementar os endpoints mutáveis de bloqueio e desbloqueio de usuário interno. Esta etapa é exclusivamente documental e não altera código, testes, migrations, schema, ambiente ou produção.

Endpoints planejados

- `POST /api/internal/admin/users/{usuario_id}/block` — bloquear usuário interno.
- `POST /api/internal/admin/users/{usuario_id}/unblock` — desbloquear usuário interno.

Proteções obrigatórias (ambos)

- Requer sessão autenticada (dependência interna existente).
- Requer `require_permission("admin.usuarios.bloquear")`.
- Requer header `X-Geoportal-Internal-Request: 1` (proteção para rotas mutáveis).
- Requer feature flag `GEOPORTAL_INTERNAL_ROUTES_ENABLED` ativa.

Comportamento planejado — Bloquear

- Respostas: `200 OK` quando o bloqueio for aplicado com sucesso.
- `200 OK` idempotente se o usuário já estiver bloqueado.
- `401` sem sessão autenticada; `403` sem permissão; `403` se header mutável ausente; `404` se `usuario_id` não existir; `422` para `usuario_id` inválido.
- Impedir novos logins do usuário bloqueado (login falhará com 401 genérico).
- Revogar sessões ativas do usuário bloqueado: atualizar `mod_auth.sessoes.revogado_em = now()` para as sessões ativas do `usuario_id` — revogação lógica, sem `DELETE` físico.
- Não apagar o usuário; não alterar senha; não alterar perfis; não remover permissões; não criar sessão; não enviar e-mail.

Comportamento planejado — Desbloquear

- Respostas: `200 OK` quando o desbloqueio for aplicado com sucesso.
- `200 OK` idempotente se o usuário já estiver desbloqueado.
- `401` sem sessão; `403` sem permissão; `403` sem header mutável; `404` se usuário não existir; `422` para `usuario_id` inválido.
- Permitir novos logins se a senha estiver válida e o usuário estiver `ativo` (ou seja, remover bloqueio lógico). Não criar sessão automaticamente.
- Não alterar senha; não alterar perfis; não recriar permissões; não enviar e-mail.

Campos de banco planejados

- Usar somente colunas existentes em `mod_auth.usuarios` e `mod_auth.sessoes`.
- Para persistência do bloqueio, usar a semântica já existente baseada em `mod_auth.usuarios.bloqueado_ate`.
- A API deve retornar apenas o booleano derivado `bloqueado=true|false`; **não** retornar `bloqueado_ate` na resposta.
- O bloqueio deve revogar sessões ativas em `mod_auth.sessoes` atualizando `revogado_em = now()` — revogação lógica sem `DELETE` físico.
- O desbloqueio deve limpar `bloqueado_ate` conforme o padrão existente; desbloqueio não cria sessão automaticamente.
- NÃO criar migration nesta etapa e NÃO alterar schema.

Resposta sanitizada (envelope)

Exemplo de resposta (bloqueado = true):

{
	"usuario": {
		"id": 8,
		"login": "teste.criacao",
		"nome": "Usuario Teste Criacao",
		"email": null,
		"ativo": true,
		"bloqueado": true,
		"criado_em": "..."
	}
}

Para desbloqueio, mesmo envelope com `"bloqueado": false`.

Campos permitidos na resposta (somente estes):

- `id`, `login`, `nome`, `email`, `ativo`, `bloqueado`, `criado_em`.

Campos absolutamente proibidos na resposta (não expor):

- `senha`, `senha_hash`, `token`, `token_hash`, `cookie`, `session_secret`, `DATABASE_URL`, `SQL`, `role`, `GRANT`, `sessao`, `auditoria`, `bloqueado_ate`, `atualizado_em`, `ultimo_login_em` e quaisquer segredos ou identificadores sensíveis.

Observações de segurança e operacionais

- Bloqueio deve revogar sessões ativas usando `revogado_em` para tornar sessões existentes inválidas imediatamente.
- Não usar `DELETE` em `mod_auth.sessoes` nem excluir usuário.
- Desbloqueio NÃO deve criar sessão automaticamente — o usuário deve autenticar (login) normalmente.
- Nenhuma alteração de perfis, permissões ou senha deve ocorrer como efeito colateral destes endpoints.
- Não enviar e-mails automáticos nesta etapa documental.

Restrições de escopo desta etapa documental

- Não implementar o código do endpoint (apenas documentação nesta etapa).
- Não alterar Python, testes, migrations, schema, scripts PowerShell, `.env` versionado, produção, NSSM ou frontend.
- Não criar usuários, perfis, permissões, vínculos, roles PostgreSQL ou GRANTs.
- Não incluir dados sensíveis em qualquer arquivo de documentação.

Próximos passos operacionais (após esta documentação)

1. Implementar endpoints mutáveis com Codex High seguindo este contrato técnico.
2. Validar em homologação usando o usuário `teste.criacao`:
	 - confirmar que usuário bloqueado não consegue login;
	 - confirmar que sessões ativas foram revogadas (`revogado_em` preenchido);
	 - confirmar que desbloqueio permite login novamente quando senha válida;
3. Após validação em homologação, planejar reset de senha via endpoint separado; mantê-lo também como etapa separada.

Resumo técnico e impactos

- Arquivos alterados nesta etapa: apenas documentação Markdown.
- Código alterado: nenhum.
- Testes alterados: nenhum.
- Migrations criadas: nenhuma.
- Schema alterado: nenhum.
- Endpoint criado: nenhum (documentação apenas).
- Endpoint mutável criado: nenhum.
- Usuário/perfil/permissão/vínculo real criado: nenhum.
- Role/GRANT criado: nenhum.
- Impacto no schema: nenhum.
- Impacto operacional: baixa — documentação e plano de testes; implementação posterior exigirá revisões de role e GRANT em homologação controlada.
- Confirmação: nenhum dado sensível foi incluído neste documento.

## Implementacao: Bloqueio e Desbloqueio de Usuario Interno

Os endpoints `POST /api/internal/admin/users/{usuario_id}/block` e `POST /api/internal/admin/users/{usuario_id}/unblock` foram implementados no backend como rotas administrativas mutaveis explicitas. Ambos ficam sob `GEOPORTAL_INTERNAL_ROUTES_ENABLED`, exigem sessao autenticada, `require_permission("admin.usuarios.bloquear")` e header `X-Geoportal-Internal-Request: 1`.

O bloqueio usa somente `mod_auth.usuarios.bloqueado_ate`, configurando timestamp futuro suficiente para bloqueio administrativo, e revoga sessoes ativas do mesmo usuario com `UPDATE mod_auth.sessoes SET revogado_em = now() WHERE usuario_id = :usuario_id AND revogado_em IS NULL`. A revogacao e logica, sem `DELETE` fisico. O desbloqueio limpa `bloqueado_ate` e nao cria sessao automaticamente.

As respostas retornam o mesmo envelope sanitizado dos endpoints de usuario: `usuario.id`, `usuario.login`, `usuario.nome`, `usuario.email`, `usuario.ativo`, `usuario.bloqueado` e `usuario.criado_em`. A API nao retorna `bloqueado_ate`, senha, `senha_hash`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, SQL, role, GRANT, sessao, auditoria, `atualizado_em` ou `ultimo_login_em`.

Esta implementacao nao altera senha, perfis ou permissoes, nao escreve em `login_auditoria`, nao envia e-mail, nao cria endpoint de remocao de perfil, nao cria migration, nao altera schema, nao cria usuario/perfil/permissao/vinculo real, nao cria role/GRANT, nao altera producao, NSSM, `.env`, frontend ou tela. A etapa posterior de reset administrativo foi implementada separadamente.

## Validacao Operacional: Bloqueio e Desbloqueio

O commit `88ff004` Adiciona bloqueio interno de usuarios foi aplicado no servidor e validado com pytest completo: 462 passed. A validacao ocorreu em processo isolado de homologacao usando o usuario de teste `teste.criacao` (`id=8`) criado em etapa anterior. Backup de roles foi realizado antes da operacao. Nenhuma alteracao foi feita em producao, NSSM, `.env` versionado, schema ou migration.

Matriz de privilegios confirmada (role `geoportal_api_homolog`):
- `usuarios_select=t`, `usuarios_insert=t`, `usuarios_update=t`, `usuarios_delete=f`.
- `sessoes_select=t`, `sessoes_insert=t`, `sessoes_update=t`, `sessoes_delete=f`.
- Nenhum novo GRANT foi necessario para a validacao.

Cenarios validados:
- Sem sessao: `block_sem_sessao_status=401`, `block_sem_sessao_body={'detail': 'Not authenticated'}`.
- Sem header mutavel: `block_sem_header_status=403`, `block_sem_header_body={'detail': 'Invalid internal request'}`.
- Bloqueio (201/200): `block_status=200`, usuario retornou sanitizado com `bloqueado=true`. Repeticao retornou 200 idempotente.
- Sessao ativa revogada durante bloqueio: `teste_me_durante_bloqueio_status=401` (sessao revogada em `mod_auth.sessoes` com `revogado_em = now()`).
- Novo login bloqueado: `teste_login_bloqueado_status=401`.
- Usuario inexistente: `block_not_found_status=404`.
- Desbloqueio (200): `unblock_status=200`, usuario retornou sanitizado com `bloqueado=false`. Repeticao retornou 200 idempotente.
- Login apos desbloqueio: `teste_login_depois_status=200`, sessao criada, `/me` retornou `permissoes` restauradas.

Campos retornados (sanitizado):
- Envelope: `usuario` com `id`, `login`, `nome`, `email`, `ativo`, `bloqueado`, `criado_em`.
- Nao retornou: `senha`, `senha_hash`, `token_hash`, `bloqueado_ate`, `atualizado_em`, `ultimo_login_em`, `session_secret`, `DATABASE_URL`, SQL, role, GRANT, sessao, auditoria ou qualquer segredo.

Resultado final:
- Bloqueio e desbloqueio funcionaram conforme especificado.
- Sessoes ativas foram revogadas logicamente sem DELETE fisico.
- Novo login bloqueado foi negado.
- Desbloqueio permitiu re-autenticacao normal.
- Nenhum dado sensivel foi exposto.
- Variaveis temporarias foram limpas.
- Producao, NSSM, `.env` versionado e frontend nao foram alterados.

## Planejamento: Reset Administrativo de Senha de Usuario Interno

Endpoint planejado: `POST /api/internal/admin/users/{usuario_id}/reset-password`

Protecoes obrigatorias: feature flag `GEOPORTAL_INTERNAL_ROUTES_ENABLED`, sessao autenticada, `require_permission("admin.usuarios.redefinir_senha")`, header `X-Geoportal-Internal-Request: 1`.

Payload planejado: `nova_senha` (obrigatorio), `confirmar_nova_senha` (obrigatorio). Nao aceitar senha por query string ou path parameter. Campos proibidos: `senha_hash`, `token`, `token_hash`, `cookie`, `session_secret`, `DATABASE_URL`, `role`, `GRANT`, `perfil`, `perfis`, `permissoes`, `ativo`, `bloqueado`, `bloqueado_ate`, campos de auditoria e campos de sessao.

Comportamento planejado: 200 OK quando redefinida; 401 sem sessao; 403 sem permissao; 403 sem header mutavel; 404 usuario inexistente; 422 payload invalido ou senhas divergem. Gerar novo hash Argon2id, atualizar somente `mod_auth.usuarios.senha_hash` e `mod_auth.usuarios.atualizado_em`, revogar sessoes ativas atualizando `mod_auth.sessoes.revogado_em = now()` (sem DELETE fisico), nao desbloquear usuario, nao alterar perfil/permissoes/ativo, nao criar sessao, nao enviar e-mail, nao escrever auditoria de login.

Resposta sanitizada (200): envelope `usuario` com `id`, `login`, `nome`, `email`, `ativo`, `bloqueado`, `criado_em` apenas. Proibido: `senha`, `nova_senha`, `confirmar_nova_senha`, `senha_hash`, `token`, `token_hash`, `cookie`, `session_secret`, `DATABASE_URL`, SQL, `role`, `GRANT`, sessao, auditoria, `bloqueado_ate`, `atualizado_em`, `ultimo_login_em`.

Regras de seguranca: nao aceitar senha por query string ou path; nao logar senha; nao documentar senha real; usar politica de senha ja existente (6-128 caracteres, letra+numero, nao igual a login/nome, bloqueada se comum); usar bind parameters em SQL; manter feature flag fail-closed; nao criar migration/schema.

Proximos passos operacionais (apos esta documentacao): 1. Implementar endpoint com Codex High seguindo este contrato tecnico. 2. Validar em homologacao usando `teste.criacao`: confirmar que senha antiga deixa de funcionar (401); confirmar que senha nova funciona (200); confirmar que sessoes antigas sao revogadas (401); confirmar que usuario bloqueado continua bloqueado apos reset. 3. Apos validacao, planejar o primeiro endpoint interno de negocio do modulo Iluminacao; manter como etapa separada.

Resumo tecnico e impactos: Arquivos alterados nesta etapa: apenas documentacao Markdown. Codigo alterado: nenhum. Testes alterados: nenhum. Migrations criadas: nenhuma. Schema alterado: nenhum. Endpoint criado: nenhum. Endpoint mutavel criado: nenhum. Usuario/perfil/permissao/vinculo real criado: nenhum. Role/GRANT criado: nenhum. Impacto operacional: baixa. Confirmacao: nenhum dado sensivel foi incluido neste documento.

## Implementacao: Reset Administrativo de Senha de Usuario Interno

O endpoint `POST /api/internal/admin/users/{usuario_id}/reset-password` foi implementado como rota administrativa mutavel explicita. Ele fica sob `GEOPORTAL_INTERNAL_ROUTES_ENABLED`, exige sessao autenticada, `require_permission("admin.usuarios.redefinir_senha")` e header `X-Geoportal-Internal-Request: 1`.

O payload aceita somente `nova_senha` e `confirmar_nova_senha`, rejeitando campos extras. Divergencia entre os campos, payload invalido ou senha fora da politica centralizada retornam 422 generico, sem expor o valor recebido. A politica reutilizada e a mesma da criacao administrativa: 6 a 128 caracteres apos `strip`, pelo menos uma letra e um numero, nao igual a login/nome e bloqueio de senhas comuns.

O service busca o usuario por `id` para aplicar a politica com login/nome, gera novo hash Argon2id e chama repository parametrizado. O repository atualiza somente `mod_auth.usuarios.senha_hash` e `mod_auth.usuarios.atualizado_em`, revogando sessoes ativas com `UPDATE mod_auth.sessoes SET revogado_em = now() WHERE usuario_id = :usuario_id AND revogado_em IS NULL`. Nao ha `DELETE` fisico.

O reset nao desbloqueia usuario, nao altera `ativo`, perfis, permissoes ou vinculos, nao cria sessao, nao envia e-mail e nao escreve em `login_auditoria`. A resposta 200 usa envelope `usuario` com apenas `id`, `login`, `nome`, `email`, `ativo`, `bloqueado` e `criado_em`; nao retorna senha, `nova_senha`, `confirmar_nova_senha`, `senha_hash`, `bloqueado_ate`, `atualizado_em`, `ultimo_login_em`, token, cookie, `session_secret`, `DATABASE_URL`, SQL, role, GRANT, sessao ou auditoria.

Esta implementacao nao cria migration, nao altera schema, nao cria usuario/perfil/permissao/vinculo real, nao cria role/GRANT, nao altera producao, NSSM, `.env`, frontend ou tela. Proxima etapa operacional: validar em homologacao com `teste.criacao`, confirmando que senha antiga falha, senha nova autentica, sessoes antigas sao revogadas e usuario bloqueado continua bloqueado ate desbloqueio explicito.

## Validacao Operacional: Reset Administrativo de Senha

O commit `72e7d80` Adiciona reset administrativo de senha interna foi aplicado no servidor e validado com pytest completo: 488 passed. A validacao ocorreu em processo isolado de homologacao usando o usuario de teste `teste.criacao` (`id=8`) criado em etapa anterior. Backup foi realizado antes da operacao. Nenhuma alteracao foi feita em producao, NSSM, `.env` versionado, schema ou migration.

Matriz de privilegios confirmada (role `geoportal_api_homolog`):
- `usuarios_select=t`, `usuarios_insert=t`, `usuarios_update=t`, `usuarios_delete=f`.
- `sessoes_select=t`, `sessoes_insert=t`, `sessoes_update=t`, `sessoes_delete=f`.
- Nenhum novo GRANT foi necessario.

Cenarios validados:
- Sem sessao: `reset_sem_sessao_status=401`, `reset_sem_sessao_body={'detail': 'Not authenticated'}`.
- Sem header mutavel `X-Geoportal-Internal-Request: 1`: `reset_sem_header_status=403`, `reset_sem_header_body={'detail': 'Invalid internal request'}`.
- Senhas divergentes: `reset_divergente_status=422`, `reset_divergente_body={'detail': 'Invalid payload'}`.
- Senha fraca/invalida: `reset_senha_fraca_status=422`, `reset_senha_fraca_body={'detail': 'Invalid payload'}`.
- Usuario inexistente: `reset_not_found_status=404`, `reset_not_found_body={'detail': 'Not found'}`.
- Reset valido (200): `reset_status=200`, usuario retornou sanitizado com `bloqueado=false`, campos esperados presentes.
- Sessao antiga revogada: `teste_me_sessao_antiga_apos_reset_status=401`, sessao anterior invalida devido a `revogado_em` preenchido.
- Senha antiga passou a falhar: `teste_login_senha_antiga_status=401`, novo login com senha anterior retorna autenticacao negada.
- Senha nova passou a funcionar: `teste_login_senha_nova_status=200`, login com nova senha funciona, `teste_me_senha_nova_status=200`, usuario pode acessar `/me` com sessao nova.
- Usuario bloqueado continua bloqueado: bloqueio aplicado antes do reset; apos reset, usuario continua com `bloqueado=true` ate desbloqueio explicito.
- Desbloqueio final estabilizou ambiente: `unblock_final_status=200`, usuario desbloqueado permitindo login final com senha nova.

Campos retornados (sanitizado):
- Envelope: `usuario` com `id`, `login`, `nome`, `email`, `ativo`, `bloqueado`, `criado_em`.
- Nao retornou: `senha`, `nova_senha`, `confirmar_nova_senha`, `senha_hash`, `bloqueado_ate`, `atualizado_em`, `ultimo_login_em`, token, `token_hash`, cookie, `session_secret`, `DATABASE_URL`, SQL, role, GRANT, sessao, auditoria ou qualquer segredo.

Sessoes ativas foram revogadas:
- Durante o reset, `UPDATE mod_auth.sessoes SET revogado_em = now() WHERE usuario_id = :usuario_id AND revogado_em IS NULL` foi executado, sem `DELETE` fisico.
- Sessoes revogadas ficaram inacessiveis imediatamente (status 401 ao tentar usar).

Resultado final:
- Reset funcionou conforme especificado.
- Senha antiga deixou de funcionar imediatamente.
- Senha nova passou a funcionar apos reset.
- Sessoes ativas foram revogadas logicamente sem DELETE fisico.
- Usuario bloqueado continuou bloqueado (sem desbloquear automaticamente).
- Nenhum dado sensivel foi exposto em resposta ou log.
- Variaveis temporarias foram limpas.
- Producao, NSSM, `.env` versionado e frontend nao foram alterados.

Proximos passos: encerrar fase administrativa de autenticacao/autorizacao com documentacao consolidada; depois planejar primeiro endpoint interno de negocio do modulo Iluminacao; tela interna continua etapa posterior.

## 1. Separacao publico/interno

- Endpoints publicos continuam em `/api/public/...`.
- Endpoints internos devem ficar em `/api/internal/...`.
- Endpoints internos nao devem reutilizar endpoints publicos.
- Endpoints publicos nunca retornam observacoes internas.
- Endpoints publicos nunca retornam historico administrativo completo.
- Endpoints internos nao devem ser protegidos apenas por regras do front-end.
- Toda validacao de autenticacao e autorizacao deve ocorrer no backend.

## 2. Endpoints internos conceituais

Primeira versao conceitual para Iluminacao Publica:

- `GET /api/internal/iluminacao/solicitacoes`
- `GET /api/internal/iluminacao/solicitacoes/{id}`
- `PATCH /api/internal/iluminacao/solicitacoes/{id}/status`
- `POST /api/internal/iluminacao/solicitacoes/{id}/observacoes`
- `GET /api/internal/iluminacao/solicitacoes/{id}/historico`
- `GET /api/internal/iluminacao/estatisticas`

Nenhum endpoint interno deve ser implementado sem autenticacao. Nenhum endpoint interno deve ser publicado sem autorizacao por perfil e testes automatizados de acesso permitido e negado.

## 3. Autenticacao conceitual

- Login interno obrigatorio.
- Sessao opaca com expiracao; para navegador, transporte principal por cookie HttpOnly `geoportal_internal_session`.
- Renovacao controlada quando aplicavel.
- Usuario precisa estar ativo para acessar.
- Senha armazenada somente como hash com algoritmo adequado.
- Senha nunca armazenada em texto puro.
- Senha, token e segredo nunca registrados em log.
- Falhas de autenticacao devem retornar erro generico.
- Endpoints internos mutaveis devem exigir protecao CSRF/equivalente; a protecao inicial definida e o header `X-Geoportal-Internal-Request: 1`, alem de SameSite=Lax no cookie.
- Tentativas excessivas de login devem aplicar atraso, bloqueio temporario ou outra protecao equivalente.
- Politica de senha deve ser revisada antes do uso por equipe real.
- Integracao futura com provedor externo pode ser avaliada, mas a primeira versao nao deve depender disso para ser segura.

## 4. Perfis e permissoes

Modelo funcional:

- Usuario: pessoa autenticada em `mod_auth.usuarios`.
- Perfil: agrupamento funcional de permissoes.
- Permissao: capacidade granular nomeada por modulo e acao.
- Modulo: area funcional do Geoportal Interno, como `admin` ou `iluminacao`.
- Acao: operacao permitida, como ler, criar, bloquear, comentar ou atualizar status.

Um usuario pode ter um ou mais perfis. Um perfil agrupa uma ou mais permissoes. As permissoes efetivas do usuario devem ser derivadas dos seus perfis e vinculos em `mod_auth`, nunca de regra fixa no codigo por login.

Perfis sugeridos:

- `admin`
- `gestor_modulo`
- `atendente_triagem`
- `equipe_execucao`
- `leitura`

Permissoes conceituais granulares:

- `admin.usuarios.ler`
- `admin.usuarios.criar`
- `admin.usuarios.bloquear`
- `admin.usuarios.redefinir_senha`
- `admin.usuarios.atribuir_perfis`
- `admin.perfis.ler`
- `admin.perfis.gerenciar`
- `iluminacao.solicitacoes.ler`
- `iluminacao.solicitacoes.atualizar_status`
- `iluminacao.solicitacoes.comentar`
- `iluminacao.dashboard.ler`
- `iluminacao.relatorios.ler`

As permissoes reais devem ser criadas em etapa operacional propria, sem seed publico com dado real, e devem seguir o padrao `modulo.recurso.acao`.

Administrador funcional do Geoportal Interno:

- Pode criar usuarios internos por fluxo administrativo proprio.
- Pode bloquear e desbloquear usuarios.
- Pode redefinir senha.
- Pode atribuir e remover perfis.
- Pode gerenciar permissoes por modulo.
- Nao deve ser superuser de banco.
- Nao deve depender de regra hardcoded por login.

Usuarios de modulo, como Iluminacao Publica:

- So devem acessar o modulo autorizado.
- Nao podem criar usuarios globais.
- Nao podem atribuir permissoes.
- Nao podem acessar administracao global.
- So podem executar as acoes permitidas pelo perfil do modulo.

Regra proibida:

- Nao usar condicao do tipo `if login == "admin.homologacao": libera tudo`.
- A autorizacao deve vir de perfis e permissoes em `mod_auth`, associadas ao usuario autenticado.

## 5. Matriz de permissoes sugerida

| Perfil | Permissoes |
|---|---|
| `admin` | Todas as permissoes, incluindo administracao futura de usuarios. |
| `gestor_modulo` | Visualizar solicitacoes e detalhe, alterar status, registrar observacao, visualizar historico e estatisticas. |
| `atendente_triagem` | Visualizar solicitacoes e detalhe, alterar status de triagem, registrar observacao e visualizar historico. |
| `equipe_execucao` | Visualizar solicitacoes encaminhadas ou em execucao, registrar observacao, alterar para `em_execucao`, `resolvida` ou `nao_localizado`, e visualizar historico limitado. |
| `leitura` | Visualizar solicitacoes, detalhe permitido e historico permitido, sem operacoes de escrita. |

A matriz final deve ser validada com a operacao antes de qualquer ativacao real.

## 6. Auditoria obrigatoria

- Alteracao de status deve gravar em `mod_iluminacao.solicitacoes_historico`.
- Nao deve existir alteracao de status sem historico.
- Criacao de observacao deve gravar em `mod_iluminacao.solicitacoes_observacoes`.
- Criacao de observacao tambem deve gravar evento resumido em `mod_iluminacao.solicitacoes_historico`.

## 7. Consolidação da Fase Administrativa

A **base de autenticação e autorização interna está consolidada, validada e pronta para escalar para módulos de negócio**.

### Status Final

**Endpoints administrativos** (9 no total):
- Autenticação: login, logout, /me, permission-smoke
- Usuários: listar, detalhe, criar, bloquear, desbloquear, reset de senha
- Perfis: listar, atribuir

**Permissões administrativas** (9 no total):
- `internal.auth.me`, `admin.usuarios.*` (5), `admin.perfis.*` (2), `admin.permissoes.*` (2)

**Garantias** (12 validadas em homologação):
- Sem login hardcoded
- Sem superuser de banco
- Permissões de aplicação
- Argon2id robusto
- Sessões revogadas logicamente
- Sanitização total
- Feature flag fail-closed
- Header X-Geoportal-Internal-Request: 1 em mutáveis
- API Pública saudável

**Documentação de referência**:
- [INTERNAL-AUTH-TECHNICAL-DECISIONS.md](INTERNAL-AUTH-TECHNICAL-DECISIONS.md): Decisões técnicas
- [INTERNAL-AUTH-SECURITY-IMPLEMENTATION-PLAN.md](INTERNAL-AUTH-SECURITY-IMPLEMENTATION-PLAN.md): Plano de segurança
- [INTERNAL-AUTH-ADMIN-PHASE-SUMMARY.md](INTERNAL-AUTH-ADMIN-PHASE-SUMMARY.md): Resumo executivo

### Próxima Fase: Módulo Iluminação Pública

Com a base administrativa validada, o próximo passo é implementar o **primeiro módulo interno de negócio**: Iluminação Pública.

**Fluxo planejado**:
1. Backend: endpoints GET (consulta) e POST (criação/comentário) validados em homologação
2. Autorização: permissões granulares por papel (gestor, atendente, execução, leitura)
3. Auditoria: histórico de status, observações e eventos
4. Frontend/Tela: depois dos endpoints backend validados
5. Produção: código deployado + bootstrap de perfis com confirmação humana

**Esta consolidação não altera**: código, testes, migrations, schema, usuários reais, produção, NSSM, .env ou frontend.
- Acoes internas devem registrar `usuario_id`, `usuario_nome` e `origem_acao = 'usuario_interno'` quando aplicavel.
- Acoes automaticas devem registrar `origem_acao = 'sistema'`.
- Ajustes administrativos devem registrar `origem_acao = 'ajuste_administrativo'`.
- Auditoria deve registrar data/hora e resumo seguro da acao.

## 7. Seguranca de dados

- Listagens devem minimizar dados pessoais.
- Detalhes internos podem exibir mais dados conforme perfil e necessidade operacional.
- Telefone ou contato nao deve aparecer em listagem ampla se nao for necessario.
- Observacoes internas nunca aparecem na consulta publica.
- Historico administrativo completo nunca aparece na consulta publica.
- Logs devem evitar dados pessoais.
- Logs nunca devem conter senha, token, `DATABASE_URL`, SQL sensivel ou credenciais.

## 8. Protecao operacional

- Endpoints internos devem ter rate limit ou protecao equivalente contra abuso.
- CORS deve permanecer restrito.
- HTTPS deve ser obrigatorio em producao.
- Cookie de sessao interno deve usar HttpOnly, Secure em producao, SameSite=Lax e Path `/api/internal`.
- Mensagens de erro nao devem revelar detalhes de seguranca.
- Falhas de autenticacao devem usar resposta generica.
- Tentativas excessivas de login devem gerar atraso, bloqueio temporario ou alerta operacional.
- Usuario inativo deve ser bloqueado.
- Permissoes devem ser revisadas periodicamente.

## 9. Estrategia de implementacao segura

1. Fase 1: documentacao de autenticacao e autorizacao.
2. Fase 2: modelo de dados de usuarios, perfis, permissoes e sessoes.
3. Fase 3: migrations de seguranca e autenticacao.
4. Fase 4: implementacao de autenticacao, sessao, cookie e logout no backend com testes.
5. Fase 5: implementar repository para buscar permissoes efetivas do usuario autenticado. Concluida.
6. Fase 6: implementar service `has_permission(usuario_id, permissao)`. Concluida.
7. Fase 7: implementar dependency FastAPI `require_permission("permissao")`. Concluida.
8. Fase 8: criar endpoint tecnico `/api/internal/auth/me` ou `/api/internal/auth/permissions`. Concluida com `/api/internal/auth/me`.
9. Fase 9: criar script/seed administrativo controlado para perfil inicial `Administrador Interno`, se necessario, sem dado sensivel no Git.
10. Fase 10: atribuir perfil administrativo ao `admin.homologacao` em homologacao e validar.
11. Fase 11: criar endpoints administrativos reais apenas depois da autorizacao base.
12. Fase 12: criar endpoints internos de negocio, com o primeiro modulo pratico previsto sendo Iluminacao Publica.
13. Fase 13: criar tela interna somente depois que backend autenticar e autorizar com seguranca.
14. Fase 14: auditoria e revisao de seguranca antes de uso por equipe real.

## 9.1 Escalabilidade multi-módulo

O Geoportal Interno é arquiteturado para ser escalável a múltiplos módulos, não apenas Iluminação Pública. A estratégia de autenticação e autorização reflete essa escalabilidade:

**Estrutura de schemas:**

- `mod_auth`: Schema transversal centralizado com usuários, perfis, permissões, sessões e auditoria de login.
- `mod_iluminacao`: Schema do módulo de Iluminação Pública com dados operacionais específicos.
- `mod_*`: Futuros schemas de outros módulos.

**Modelo de usuários:**

- Um usuário humano em `mod_auth.usuarios` representa uma pessoa.
- O mesmo usuário pode ter diferentes perfis em diferentes módulos.
- Exemplo: Um supervisor pode ser `admin` em Iluminação Pública, mas apenas `gestor_modulo` em futuro módulo de Drenagem.
- Permissões específicas por módulo são controladas via `mod_auth.usuario_perfis` (vinculo entre usuário, perfil e módulo) e `mod_auth.perfil_permissoes`.
- O primeiro modulo pratico previsto continua sendo Iluminacao Publica, mas endpoints de negocio so devem ser criados depois da autorizacao base (`require_permission`) existir e estar validada.

**Separação de permissões:**

- Permissões no banco (roles PostgreSQL) devem ser mínimas e restritas a schemas específicos.
- Exemplos: `api_iluminacao_homolog` acessa apenas `mod_iluminacao`.
- Permissões de aplicação (lógica de negócio) são controladas em `mod_auth` via perfis e permissões de aplicação.
- Exemplo: Um usuário com permissão `visualizar_solicitacoes` no módulo de Iluminação Pública será verificado no backend antes de retornar dados.

**Role runtime de autenticacao em homologacao:**

- `geoportal_api_homolog` foi criada em homologacao como role runtime da API interna de autenticacao com permissoes minimas: `CONNECT`, `USAGE mod_auth`, `SELECT mod_auth.usuarios`, `SELECT/INSERT mod_auth.sessoes`. Validada com endpoint de login operacional.
- `geoportal_auth_admin_homolog` e apenas role de bootstrap administrativo e nao deve ser usada pelo endpoint de login.
- A matriz minima para login e validacao de sessao foi implementada e testada: `CONNECT`, `USAGE` em `mod_auth`, `SELECT` em `mod_auth.usuarios`, `SELECT`/`INSERT` em `mod_auth.sessoes`, `SELECT`/`INSERT` em `mod_auth.login_auditoria`, `USAGE`/`SELECT` nas sequences.
- A role nao deve ter `CREATE`, `DROP`, `ALTER`, `TRUNCATE`, `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION`, `BYPASSRLS`, acesso automatico a `plano`, `web_map` ou `mod_iluminacao`, nem deve reutilizar `postgres` como usuario runtime.
- A criacao real foi etapa operacional separada em homologacao, sem producao, com validacao de permissoes confirmada.
- O endpoint de login `POST /api/internal/auth/login` foi implementado sob feature flag `GEOPORTAL_INTERNAL_ROUTES_ENABLED`, testado e validado em homologacao com sucesso; retorna token opaco protegido temporariamente no corpo e seta cookie HttpOnly `geoportal_internal_session`; ainda sem JWT nesta etapa.

**Proteção CSRF e logout antes de endpoints mutáveis**:

Antes de expor endpoints internos que alteram dados (POST/PUT/DELETE para negócio), as seguintes etapas devem ser planejadas e implementadas:

1. **Estratégia CSRF/equivalente inicial**: Header customizado obrigatório `X-Geoportal-Internal-Request: 1` em rotas internas mutáveis protegidas; Origin/Referer permanece camada complementar futura configurável. Documentado em `geoportal-vite/docs/INTERNAL-AUTH-TECHNICAL-DECISIONS.md`.
2. **Transporte de sessão seguro**: Cookie HttpOnly + Secure em produção + SameSite=Lax + Path `/api/internal`.
3. **Logout implementado**: Endpoint `POST /api/internal/auth/logout` revoga sessão preenchendo `revogado_em` em `mod_auth.sessoes`, sem DELETE físico, e limpa o cookie.
4. **Testes de CSRF/equivalente**: Validar que requisições mutáveis internas sem header são bloqueadas.
5. **Testes de logout**: Validar que sessão revogada não autentica mais.
6. **Validação operacional**: Testar em homologação com usuários reais antes de liberar para produção.

**Critério de endpoint**:

- GET de consulta sem efeito colateral: Sem proteção CSRF obrigatória.
- POST/PUT/DELETE de negócio (criar/editar/deletar): Proteção CSRF obrigatória.
- SameSite não deve ser única defesa contra CSRF; usar combinação de técnicas.

**Validação intermediária com Bearer**:

A validação técnica inicial usou `Authorization: Bearer` com token no corpo. Esta abordagem permanece válida apenas para testes técnicos ou clientes não navegador. Para uso real em navegador, o fluxo principal passa a ser cookie HttpOnly.

**Validação operacional do transporte por cookie e logout**:

O commit `eaf5724` Implementa cookie e logout internos foi validado no servidor com pytest completo: 298 passed. A validação operacional ocorreu em processo isolado de homologação, usando variáveis temporárias (`DATABASE_URL` com `geoportal_api_homolog`, `GEOPORTAL_INTERNAL_ROUTES_ENABLED`, `GEOPORTAL_INTERNAL_SESSION_SECRET`, `GEOPORTAL_INTERNAL_SESSION_COOKIE_SECURE=false` para TestClient/local e `TEST_INTERNAL_PASSWORD`), todas limpas ao final. Não houve alteração de produção, NSSM, `.env` versionado, role, GRANT, migration ou schema.

Resultado sanitizado: login status 200 para `admin.homologacao` (`usuario_id=7`), cookie setado com HttpOnly, SameSite=Lax e Path `/api/internal`, smoke autenticado por cookie status 200, logout sem header status 403, logout com `X-Geoportal-Internal-Request: 1` status 200, cookie limpo e smoke após logout status 401. Contagens após teste: `mod_auth.usuarios=1`, `mod_auth.sessoes=2`, `mod_auth.login_auditoria=2`, `sessoes_revogadas=1`.

Próximos passos de autorização: decidir quando remover o token do corpo da resposta ou restringi-lo a ambiente técnico, planejar validação Origin/Referer como camada complementar, implementar endpoints internos de negócio somente após autorização por perfis/permissões, e não liberar tela interna para usuários reais antes de fechar autorização e frontend seguro.

Sequencia imediata recomendada apos a base tecnica de autorizacao:

1. Validar o endpoint tecnico `permission-smoke` em homologacao com usuario autorizado e, quando houver usuario sem permissao, confirmar o 403.
2. Criar endpoints administrativos reais de usuarios/perfis somente apos teste de permissao permitido/negado.
3. Criar o primeiro endpoint interno de negocio do modulo Iluminacao somente depois dos endpoints administrativos seguros.
4. Criar tela interna somente depois que backend, autorizacao e endpoints estiverem fechados.
5. Planejar producao separadamente: backup obrigatorio, `--dry-run` obrigatorio, confirmacao humana, criacao de usuario real de producao em etapa propria, sem copiar dados de homologacao.

Producao continua sem alteracao nesta etapa documental.

Nao havera copia cega dos dados de homologacao para producao. O que migra e codigo versionado, migrations estruturais quando existirem, scripts administrativos validados e roteiro operacional. Nao migram senhas, sessoes, tokens, dados de teste ou usuarios ficticios.

**Adição de novos módulos:**

1. Criar schema dedicado (ex: `mod_drenagem`).
2. Criar tabelas e estrutura específicas do módulo.
3. Criar roles PostgreSQL mínimas para acesso ao novo schema.
4. Adicionar novos perfis em `mod_auth.perfis` (ex: `gestor_drenagem`).
5. Adicionar novas permissões em `mod_auth.permissoes` com `modulo = 'drenagem'`.
6. Vincular usuários, perfis e permissões conforme necessário.
7. Implementar endpoints internos com validação de permissão por módulo.

**Benefícios:**

- Isolamento de dados por módulo.
- Controle de acesso centralizado em `mod_auth`.
- Facilita adição de novos módulos.
- Reduz duplicação de lógica de autenticação/autorização.
- Permite matriz de permissões complexa e flexível por usuário/módulo.

## 10. Criterios de aceite

- Nenhum endpoint interno publico.
- Autenticacao obrigatoria.
- Autorizacao por perfil.
- Validacao de permissao no backend.
- Testes automatizados cobrindo acesso autorizado e negado.
- Acoes internas gravam auditoria.
- Alteracao de status nunca ocorre sem historico.
- API publica permanece inalterada.
- Google Forms permanece fallback durante a transicao.
- Documentacao atualizada antes de ativacao.

## 11. Riscos prevenidos

- Exposicao de dados pessoais.
- Alteracao indevida de status.
- Acesso interno sem autorizacao.
- Ausencia de rastreabilidade.
- Endpoint administrativo publico por engano.
- Vazamento de token ou senha em log.
- Confusao entre API publica e API interna.
- Ampliacão inadvertida de permissões de usuários técnicos de módulos específicos.
- Falta de escalabilidade para múltiplos módulos.
- Duplicação de lógica de autenticação/autorização entre módulos.
