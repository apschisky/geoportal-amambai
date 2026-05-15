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

O modulo piloto sera Iluminacao Publica. O schema futuro previsto e `mod_iluminacao`.

Ainda nao ha SQL executavel nesta etapa.
