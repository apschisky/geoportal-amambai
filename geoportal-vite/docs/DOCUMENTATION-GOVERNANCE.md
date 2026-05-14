# Governanca da Documentacao do Geoportal de Amambai

Este documento define regras para manter a documentacao tecnica e estrategica atualizada durante a evolucao do Geoportal de Amambai.

## 1. Objetivo

Garantir que a documentacao acompanhe as mudancas do projeto, evitando divergencia entre codigo, banco, seguranca, API, fluxos operacionais, testes, publicacao e estrategia futura.

## 2. Principio central

Nenhuma evolucao relevante deve deixar a documentacao desatualizada.

Quando uma mudanca alterar comportamento, arquitetura, seguranca, dados, API, UX, infraestrutura ou processo de publicacao, o documento correspondente deve ser revisado na mesma etapa ou em uma etapa documental imediatamente seguinte.

## 3. Quando atualizar documentacao

Atualizar documentacao quando houver:

- alteracao de arquitetura;
- alteracao de fluxo de usuario;
- alteracao de seguranca;
- nova camada ou mudanca em camada existente;
- alteracao de popup, busca, rotas ou UX;
- alteracao em testes;
- alteracao em banco/schema;
- alteracao em API/endpoints;
- alteracao em autenticacao/permissoes;
- mudanca de infraestrutura, subdominio, proxy ou publicacao;
- mudanca em estrategia de homologacao/producao;
- mudanca em fallback, rollback ou processo de publicacao;
- nova decisao estrategica sobre modulos internos.

## 4. Documento responsavel por assunto

| Assunto | Documento principal |
|---|---|
| Arquitetura front-end | `FRONTEND-ARCHITECTURE.md` |
| Testes | `TESTING-PLAN.md` |
| Maturidade | `GEOPORTAL-MATURITY-CHECKLIST.md` |
| Seguranca | `SECURITY-HARDENING-PLAN.md` |
| Camadas publicadas | `LAYER-INVENTORY.md` |
| Banco de dados | `DATABASE-INVENTORY.md` |
| Modulos internos | `INTERNAL-MODULES-ARCHITECTURE.md` |
| Iluminacao publica | `MODULE-ILUMINACAO-PUBLICA.md` |
| Validacao operacional de iluminacao | `ILUMINACAO-VALIDATION-CHECKLIST.md` |
| Requisitos minimos de iluminacao | `ILUMINACAO-REQUIREMENTS.md` |
| Schema PostGIS | `POSTGIS-SCHEMA-PLAN.md` |
| API | `API-ARCHITECTURE.md` |
| Permissoes | `AUTH-PERMISSIONS-PLAN.md` |
| Endpoints de iluminacao | `API-ENDPOINTS-ILUMINACAO.md` |
| Migracoes SQL | `SQL-MIGRATION-PLAN.md` |
| Painel interno/UX | `INTERNAL-DASHBOARD-UX.md` |

## 5. Regra para prompts futuros

Prompts ao Codex devem incluir uma etapa para:

- verificar impacto documental;
- atualizar documentacao quando necessario;
- informar explicitamente se nenhum documento precisou ser alterado.

Essa regra vale para mudancas funcionais, alteracoes de banco, API, seguranca, testes, UX, publicacao, infraestrutura e novos modulos.

## 6. Regra para commits

- Commits funcionais devem incluir documentacao quando houver impacto.
- Documentacao pura pode ter commit separado.
- Nao misturar mudancas grandes de codigo com documentacao extensa sem necessidade.
- Sempre revisar `git diff` antes do commit.
- Preferir commits pequenos, com escopo claro e mensagem objetiva.
- Nao versionar senhas, credenciais, backups sensiveis ou arquivos temporarios com dados internos.

## 7. Checklist antes de fechar uma tarefa

- [ ] Codigo verificado, se aplicavel.
- [ ] Testes executados, se aplicavel.
- [ ] Build executado, se aplicavel.
- [ ] Documentacao revisada.
- [ ] Riscos registrados.
- [ ] Checklist manual atualizado.
- [ ] `git status` revisado.
- [ ] Commit feito quando a etapa estiver pronta para versionamento.

## 8. Relacao com producao

O Geoportal publico esta online. A documentacao deve ajudar a evitar quebra de servico e orientar evolucao segura.

Diretrizes:

- mudancas estruturais devem preservar fallback, rollback e homologacao;
- qualquer integracao com API/backend deve ser planejada antes de afetar o fluxo publico;
- o Geoportal publico nao deve depender de modulo interno ainda instavel;
- documentar decisoes que afetem publicacao, infraestrutura, seguranca ou dados;
- registrar riscos conhecidos antes de publicar mudancas relevantes.
