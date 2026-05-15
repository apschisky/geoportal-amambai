# Plano de Migracao SQL do Geoportal de Amambai

Este documento define o padrao para criacao futura de scripts SQL versionados, seguros e reversiveis para modulos internos do Geoportal de Amambai.

## 1. Objetivo

Orientar a criacao futura de migrations SQL para schemas, tabelas, views, indices, permissoes, dados iniciais e rollback, sem executar alteracoes no banco nesta etapa.

O objetivo e evitar mudancas manuais em producao, reduzir risco de perda de dados e garantir que cada alteracao seja testada, revisada e reversivel quando possivel.

## 2. Principios

- Nunca alterar producao diretamente sem script revisado.
- Testar primeiro em homologacao.
- Fazer backup antes.
- Ter rollback planejado.
- Versionar scripts.
- Separar criacao, alteracao, carga inicial, permissoes e rollback.
- Aplicar menor privilegio.
- Validar apos execucao.
- Registrar versao aplicada.
- Nao incluir senhas, credenciais ou dados sensiveis nos scripts.

## 3. Ambientes

### Desenvolvimento local

Ambiente usado para prototipar scripts e validar sintaxe, sem dados reais sensiveis.

### Homologacao

Ambiente controlado para testar migrations com estrutura semelhante a producao. Toda migration deve passar por homologacao antes de ser considerada para producao.

### Producao

Ambiente publico/oficial. Deve receber apenas scripts revisados, testados, com backup confirmado e rollback planejado.

## 4. Estrutura sugerida de pastas

Estrutura conceitual:

```text
db/
  migrations/
    0001_create_mod_iluminacao_schema.sql
    0002_create_iluminacao_solicitacoes.sql
    0003_create_mod_iluminacao_indexes.sql
    0004_create_mod_iluminacao_views.sql
    0005_create_mod_iluminacao_permissions.sql
  rollbacks/
    0001_rollback_mod_iluminacao_schema.sql
  seeds/
    0001_seed_iluminacao_status.sql
    0002_seed_iluminacao_tipo_problema.sql
```

Os nomes finais podem mudar. O importante e manter ordem, finalidade clara e rastreabilidade.

A estrutura inicial de pastas para scripts futuros foi criada em `geoportal-backend/db/`.

## 5. Convencao de nomes

Padrao sugerido:

```text
NNNN_acao_modulo_objeto.sql
```

Exemplos:

- `0001_create_mod_iluminacao_schema.sql`
- `0002_create_iluminacao_solicitacoes.sql`
- `0003_create_mod_iluminacao_indexes.sql`
- `0004_create_mod_iluminacao_views.sql`
- `0005_create_mod_iluminacao_permissions.sql`
- `0006_alter_mod_iluminacao_solicitacoes_add_prioridade.sql`

Regras:

- numero sequencial;
- acao clara;
- modulo identificado;
- objeto identificado;
- extensao `.sql`.

## 6. Ordem de execucao

Sequencia recomendada:

1. Backup.
2. Criacao de schema.
3. Criacao de tabelas.
4. Constraints.
5. Indices.
6. Tabelas de dominio/seeds.
7. Views.
8. Permissoes.
9. Validacao.
10. Registro da versao aplicada.

## 7. Backup antes da migracao

Antes de qualquer alteracao estrutural:

- [ ] Fazer backup do banco.
- [ ] Fazer backup do GeoServer `data_dir` se afetar publicacao.
- [ ] Fazer backup dos scripts usados.
- [ ] Registrar data/hora.
- [ ] Registrar ambiente.
- [ ] Validar existencia do arquivo antes de executar alteracao.
- [ ] Confirmar que ha procedimento de restauracao.

## 8. Rollback

- Cada migration relevante deve ter rollback.
- Rollback deve ser testado em homologacao.
- Rollback nao deve apagar dados sem decisao explicita.
- Preferir desativar/reverter permissoes antes de dropar objetos em producao.
- Documentar limitacoes do rollback.
- Quando rollback completo nao for seguro, documentar plano de contencao.

## 9. Validacao pos-migracao

Checklist:

- [ ] Schemas criados.
- [ ] Tabelas criadas.
- [ ] Chaves primarias criadas.
- [ ] Constraints criadas.
- [ ] Indices criados.
- [ ] Views criadas.
- [ ] Permissoes aplicadas.
- [ ] Usuario da API validado.
- [ ] Usuario GeoServer somente leitura validado.
- [ ] Inserts de teste em homologacao.
- [ ] Consulta por protocolo.
- [ ] Consulta espacial.
- [ ] Logs sem erro.
- [ ] Rollback testado quando aplicavel.

## 10. Permissoes

Diretrizes:

- Nao usar superuser em aplicacao.
- Criar roles especificas.
- API com escrita apenas no schema do modulo.
- GeoServer lendo apenas views publicas.
- Usuarios humanos sem acesso direto operacional.
- Revisar grants em schema, table, sequence e view.
- Separar roles de leitura, escrita, administracao e publicacao.

## 11. Modulo piloto: Iluminacao Publica

Futuras migrations conceituais:

- criar schema `mod_iluminacao`;
- criar tabelas `solicitacoes`, `solicitacao_historico`, `solicitacao_anexos`, `status_solicitacao`, `tipo_problema`;
- criar indices;
- criar views publicas/controladas;
- criar permissoes;
- inserir status iniciais;
- inserir tipos de problema iniciais.

Nenhuma dessas migrations deve ser criada antes da validacao do schema, permissoes, SRID, status e tipos de problema.

Antes da primeira migration SQL, tambem devem estar definidos o modelo de permissoes e a relacao entre schemas operacionais, `web_map`/`plano` e views controladas.

A primeira migration planejada cria apenas o schema `mod_iluminacao`, sem tabelas, permissoes ou execucao em banco nesta etapa.

A migration 0002 planejada cria a tabela `mod_iluminacao.solicitacoes`, ainda sem execucao no banco nesta etapa.

O runbook de homologacao foi criado em `geoportal-backend/db/HOMOLOGATION-RUNBOOK.md`, sem dados sensiveis e usando apenas placeholders.

## 12. Cuidados com dados existentes

- Nao alterar camada publica de postes diretamente.
- Nao gravar dados operacionais em `web_map`.
- Solicitacoes devem referenciar o ID do poste.
- Dados pessoais devem ficar fora de views publicas.
- Historico deve ser preservado.
- Tabelas publicas devem continuar funcionando durante a migracao.
- Evitar locks longos em producao.

## 13. Registro de versao

Opcao futura de controle:

- `operacional.schema_migrations`

Ou controle via ferramenta futura de migrations.

Campos conceituais:

- `versao`;
- `arquivo`;
- `data_execucao`;
- `executado_por`;
- `ambiente`;
- `checksum`;
- `observacao`.

Esse controle nao deve ser implementado antes da decisao final sobre ferramenta e padrao de migrations.

## 14. Criterios antes do primeiro SQL

- [ ] Schema aprovado.
- [ ] Campos aprovados.
- [ ] Status aprovados.
- [ ] Tipos de problema aprovados.
- [ ] SRID definido.
- [ ] Permissoes definidas.
- [ ] Ambiente de homologacao preparado.
- [ ] Backup testado.
- [ ] Rollback planejado.
- [ ] Responsavel tecnico definido.
- [ ] Janela de manutencao definida, se necessario.

## 15. Relacao com documentos existentes

Este plano complementa:

- `docs/POSTGIS-SCHEMA-PLAN.md`;
- `docs/API-ENDPOINTS-ILUMINACAO.md`;
- `docs/AUTH-PERMISSIONS-PLAN.md`;
- `docs/SECURITY-HARDENING-PLAN.md`;
- `docs/DATABASE-INVENTORY.md`.

## 16. Proximos passos

- [ ] Validar com setor responsavel.
- [ ] Definir ambiente de homologacao.
- [ ] Definir SRID.
- [ ] Criar primeira migration apenas em homologacao.
- [ ] Testar rollback.
- [ ] Validar permissoes.
- [ ] So depois considerar producao.
