# Roadmap de Agentes e Skills para o Geoportal Amambai

## Papéis recomendados

- **ChatGPT**: agente arquiteto e consultor de escopo, planejamento e definição de prompts.
- **GitHub Copilot**: executor de documentação, scripts auxiliares e ajustes simples de baixo risco.
- **Codex Medium**: implementação controlada de alterações localizadas de baixo/médio risco.
- **Codex High**: alterações críticas de autenticação, autorização, banco, migrations, endpoints internos e deploy.

## Matriz de decisão

| Tipo de tarefa | Ferramenta recomendada |
|---|---|
| Documentação | GitHub Copilot |
| Planejamento e prompts | ChatGPT |
| Scripts auxiliares | GitHub Copilot |
| Teste unitário simples | GitHub Copilot / Codex Medium |
| Refatoração de baixo/médio risco | Codex Medium |
| Autenticação e segurança crítica | Codex High |
| Migration | Codex High |
| Endpoint interno | Codex High |
| Deploy/proxy/Apache | ChatGPT + execução manual |

## Roadmap de futuras skills/harnesses

- Skill de revisão de migration.
- Skill de revisão de API pública.
- Skill de validação de deploy.
- Skill de revisão de segurança de autenticação.
- Skill de documentação pós-validação.
- Skill de criação de scripts PowerShell seguros.

## Convenções para prompts

Ao criar prompts para este repositório, sempre delimitar:

- escopo permitido;
- arquivos proibidos;
- confirmação de que não foi criado endpoint, migration ou dado sensível;
- exigência de executar `git status`, `git diff` e `pytest` quando estiver implementando mudança.

## Regras para evitar automação perigosa

- Nunca automatizar `push` sem revisão manual.
- Nunca automatizar migration em produção.
- Nunca automatizar restart de produção sem confirmação humana.
- Nunca imprimir secrets.
- Nunca commitar `.env`.
- Nunca expor dados sensíveis em documentação ou scripts.

## Como usar este roadmap

1. Identifique o tipo de tarefa.
2. Escolha a ferramenta adequada na matriz.
3. Defina o escopo e os arquivos permitidos.
4. Execute revisões manuais para mudanças de alto risco.
5. Registre as decisões e resultados em documentação.
