# Scripts de Banco do Backend

Esta pasta guardara scripts futuros de banco do backend do Geoportal de Amambai.

Os scripts devem ser usados primeiro em homologacao. Producao somente depois de backup, revisao tecnica e validacao do resultado esperado.

Regras desta pasta:

- nao armazenar credenciais;
- nao armazenar dumps ou backups;
- nao versionar dados reais;
- nao incluir dados pessoais de cidadaos;
- migrations devem ter rollback correspondente quando possivel;
- scripts devem seguir o plano em `geoportal-vite/docs/SQL-MIGRATION-PLAN.md`.

O modulo de autenticacao interna usa `mod_auth`. O modulo piloto Iluminacao Publica usa `mod_iluminacao`.

`HOMOLOGATION-RUNBOOK.md` contem o roteiro seguro com placeholders para futura execucao em homologacao.

`security/` contem templates seguros de permissoes e roles com placeholders.

Ainda nao ha SQL executavel nesta etapa.
