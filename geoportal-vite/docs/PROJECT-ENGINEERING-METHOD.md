# Metodologia de Engenharia do Geoportal Amambai

## Visão geral

Este documento define a metodologia de engenharia do Geoportal Amambai, focada em mudanças pequenas, seguras e rastreáveis. A ideia é garantir que cada evolução seja documentada, testada e validada antes de avançar para homologação e produção.

## Princípios

- Produção sempre protegida.
- Alterações pequenas e rastreáveis.
- Documentação junto com implementação.
- Testes antes de commit.
- Homologação antes de produção.
- Segurança por padrão.
- Menor privilégio para usuários, serviços e contas.
- Sem dados sensíveis no repositório.
- Rollback planejado.
- Cada etapa com critério de aceite.

## Fases do ciclo de desenvolvimento

1. Planejamento técnico
2. Implementação local
3. Testes locais
4. Revisão de segurança
5. Commit
6. Pull no servidor
7. Testes no servidor
8. Homologação
9. Produção
10. Documentação pós-validação

## Regras para mudanças

- Mudanças funcionais devem ser pequenas e específicas.
- Migrations devem ser separadas de endpoints e de mudanças de negócio.
- Endpoints internos nunca devem existir antes de autenticação e middleware.
- Rotas internas de teste podem ser criadas isoladamente, mas só devem ser incluídas no app principal com uma feature flag desligada por padrão.
- Frontend público deve permanecer isolado do backend interno.
- A API pública deve ser preservada em todas as fases.

## Critérios de conclusão de etapa

Uma etapa está concluída quando:

- `git status` está limpo ou com alterações esperadas.
- Testes relevantes estão passando.
- Healthchecks estão OK.
- Documentação foi atualizada.
- Não há dados sensíveis adicionados.
- Commit e push foram realizados quando aplicável.

## Classificação de risco

- Baixo: documentação, scripts auxiliares sem efeito destrutivo.
- Médio: refatoração de código sem alteração de regra de negócio significativa.
- Alto: autenticação, autorização, banco, migrations, segurança e deploy.

## Ferramenta recomendada por risco

- Documentação e scripts auxiliares: GitHub Copilot.
- Alterações localizadas de baixo/médio risco: Codex Medium.
- Auth, segurança, banco, migrations, endpoints internos e deploy crítico: Codex High.

## Decidir se uma etapa pode ir para produção

Para enviar uma etapa para produção, confirme:

- a mudança está bem documentada;
- os testes locais e de servidor passaram;
- os healthchecks dos ambientes relevantes passaram;
- a revisão de segurança foi realizada;
- não há dependências não validadas;
- a implantação segue o processo de homologação.

## Como registrar validações

- Registre validações em docs existentes e em checkpoints de deploy.
- Documente ambiente, testes executados e resultados de healthchecks.
- Mantenha histórico de decisões e observações em arquivos de documentação.
- Consulte `docs/API-SERVER-DEPLOYMENT-PLAN.md` para validações de implantação.
- Consulte `docs/SECURITY-HARDENING-PLAN.md` para validações de segurança.
- Referencie `docs/SECURE-DEVELOPMENT-HARNESS.md` para padrões de validação e repetibilidade.
- Para reinicio operacional controlado da API, use `scripts/deploy/backend-restart-validate-service.ps1`; ele nao faz deploy, `git pull`, migrations ou alteracao de banco, e producao exige confirmacao ou `-Force`.
