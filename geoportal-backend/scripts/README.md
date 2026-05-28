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
