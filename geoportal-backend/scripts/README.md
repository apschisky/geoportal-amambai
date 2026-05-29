# Scripts Manuais

Scripts desta pasta sao manuais e nao executam automaticamente.

Regras:

- exigem `.env` local quando acessam banco;
- nao devem conter credenciais;
- nao devem ser usados em producao sem revisao;
- podem criar dados de teste em homologacao;
- dados de teste devem ser limpos apos validacao.

## Usuario interno

`admin/create_internal_user.py` e um script administrativo manual preparatorio para criacao futura de usuario interno. Ele exige `--login` e `--nome`, aceita `--email` opcional, le a senha somente via `getpass`, nao aceita `--password` e preserva `--dry-run` sem conectar ao banco e sem persistir usuario.

`admin/reset_internal_user_password.py` e um script administrativo manual para redefinir a senha de usuario interno existente por `--login`. Ele le e confirma a nova senha somente via `getpass`, nao aceita `--password`, nao recebe hash por argumento e preserva `--dry-run` sem conectar ao banco e sem persistir alteracao. Fora de `--dry-run`, ele atualiza somente `senha_hash` e `atualizado_em` do usuario encontrado pelo login, usando bind parameters no repository administrativo.

O login e o identificador obrigatorio de autenticacao interna. E-mail e apenas dado opcional. Os scripts nao devem ser executados contra banco real sem revisao operacional e nao devem registrar senha, hash, token, segredo ou `DATABASE_URL` no Git. O reset de senha e ferramenta operacional controlada; nao cria endpoint, nao cria usuario, nao cria migration, nao altera schema e nao deve ser usado em producao sem etapa operacional revisada.

## Bootstrap futuro de perfis e permissoes

`admin/bootstrap_internal_admin_profile.py` e a ferramenta administrativa planejada para fazer o bootstrap idempotente do perfil inicial `Administrador Interno do Geoportal` e das permissoes administrativas iniciais. O script possui `--dry-run`, testes automatizados e validacao de entrada; nao deve ser substituido por SQL manual solto.

Caracteristicas obrigatorias do futuro script:

- Exigir parametros explicitos, como `--login`.
- Usar bind parameters em todas as operacoes SQL.
- Nao apagar registros.
- Nao duplicar perfis, permissoes ou vinculos.
- Criar permissoes se nao existirem.
- Criar perfil se nao existir.
- Associar permissoes ao perfil se ainda nao associadas.
- Atribuir perfil ao usuario informado se ainda nao atribuido.
- Nao depender de login hardcoded.
- Nao imprimir senha, token, hash, `session_secret` ou `DATABASE_URL`.
- Ter testes automatizados antes de qualquer execucao real.

Permissoes iniciais propostas: `admin.usuarios.ler`, `admin.usuarios.criar`, `admin.usuarios.bloquear`, `admin.usuarios.redefinir_senha`, `admin.usuarios.atribuir_perfis`, `admin.perfis.ler`, `admin.perfis.gerenciar`, `admin.permissoes.ler`, `admin.permissoes.gerenciar` e `internal.auth.me`. Em homologacao, a atribuicao inicial prevista e ao usuario `admin.homologacao`.

Nesta etapa, o script foi criado e testado localmente, mas nao foi executado contra banco real e nao criou perfil, permissao, usuario ou vinculo real. Producao nao deve receber dados automaticamente da homologacao. O que migra entre ambientes e codigo versionado, migrations estruturais quando existirem, scripts administrativos validados e roteiro operacional; nao migram senhas, sessoes, tokens, dados de teste ou usuarios ficticios.

### Decisão de usuários técnicos para bootstrap

**Contexto**: Tentativa realizada de usar `api_iluminacao_homolog` (usuário técnico restrito a `mod_iluminacao`) para executar `create_internal_user.py`. A conexão funcionou, mas acesso a `mod_auth` foi negado, confirmando restrição correta.

**Decisão**: Não ampliar `api_iluminacao_homolog` para acessar `mod_auth`. Usuários técnicos de módulos específicos devem permanecer restritos aos seus schemas.

**Status de conclusão**: A role técnica `geoportal_auth_admin_homolog` foi criada em homologação com permissões mínimas em `mod_auth` para permitir bootstrap de usuários internos. O primeiro usuário administrativo `admin.homologacao` foi criado com sucesso via este script. Consulte `geoportal-backend/db/security/README.md` para detalhes de execução, validações e contexto de escalabilidade.

**Validação operacional de reset de senha**: O script `admin/reset_internal_user_password.py` foi executado em homologação com sucesso para redefinir a senha do usuário `admin.homologacao`:
- Role `geoportal_auth_admin_homolog` recebeu GRANT UPDATE temporário em `mod_auth.usuarios` para permitir atualização de `senha_hash` e `atualizado_em`.
- Reset executado interativamente com `getpass` (sem imprimir senha ou hash em logs).
- Apos reset, REVOKE UPDATE foi executado, restringindo a role novamente apenas para SELECT e INSERT.
- Validação: SELECT true, INSERT true, UPDATE false, DELETE false.
- Nenhuma alteração em schema, migration ou produção.
- Script preserva `--dry-run` mode para testes sem persistência.
