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

O login e o identificador obrigatorio de autenticacao interna. E-mail e apenas dado opcional. O script nao deve ser executado contra banco real sem revisao operacional e nao deve registrar senha, hash, token, segredo ou `DATABASE_URL` no Git.

### Decisão de usuários técnicos para bootstrap

**Contexto**: Tentativa realizada de usar `api_iluminacao_homolog` (usuário técnico restrito a `mod_iluminacao`) para executar `create_internal_user.py`. A conexão funcionou, mas acesso a `mod_auth` foi negado, confirmando restrição correta.

**Decisão**: Não ampliar `api_iluminacao_homolog` para acessar `mod_auth`. Usuários técnicos de módulos específicos devem permanecer restritos aos seus schemas.

**Próximo passo**: Para bootstrap inicial de usuários internos em homologação, será criada em etapa operacional futura uma role técnica específica (sugestão: `geoportal_auth_admin_homolog`) com permissões mínimas em `mod_auth`. Consulte `geoportal-backend/db/security/README.md` para detalhes e contexto de escalabilidade.

Nenhuma role real será criada nesta etapa.
