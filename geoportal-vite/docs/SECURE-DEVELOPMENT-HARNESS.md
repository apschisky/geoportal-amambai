# Harness de Desenvolvimento Seguro do Geoportal Amambai

## O que é um harness?

Um harness é um conjunto padronizado de comandos e etapas que permite repetir validações de forma confiável, sem depender da memória.

## Harness local

Use o harness local para confirmar o estado do repositório e do backend antes de qualquer commit.

- `git status`
- `git --no-pager diff --stat`
- `git diff --name-only`
- `git --no-pager log -1 --oneline`
- Ativar o ambiente virtual do backend
- Rodar `pytest` específico para a área alterada
- Rodar `pytest` completo quando necessário
- Buscar padrões sensíveis em código e documentação
- Os scripts preservam o diretório original ao finalizar.

> O scanner de segurança ignora dependências e artefatos comuns como `.git`, `.venv`, `venv`, `node_modules`, `dist`, `build`, `__pycache__`, `.pytest_cache`, `.mypy_cache`, `coverage` e `htmlcov`.
> Os resultados do security check exigem revisão humana; nem todos os matches são necessariamente sensíveis.

### Comandos PowerShell padrão

```powershell
.\scripts\dev\git-safe-status.ps1
.\scripts\dev\backend-test-local.ps1
.\scripts\dev\backend-security-check.ps1
```

> Nota: os caminhos no exemplo acima assumem a raiz do repositório. Ajuste conforme necessário.

## Harness de servidor

Use o harness do servidor para validar alterações após pull ou antes de homologação.

- `git status`
- `git --no-pager log -1 --oneline`
- Testes `pytest` específicos no servidor
- Testes `pytest` completos no servidor
- Restart manual de homologação com validação posterior
- Healthchecks de homologação
- Restart manual de produção com validação posterior
- Healthchecks públicos de produção

### Comandos PowerShell padrão

```powershell
.\scripts\deploy\backend-validate-server.ps1 -RunTests -CheckHomologacao -CheckProducaoLocal -CheckProducaoPublica
```

> O deploy e os restarts devem ser manuais e controlados. O script apenas auxilia na validação.

### Restart e validacao controlada de servico

Validação controlada executada para o reforço da Etapa 0: o harness confirmou `GeoportalAPIInternaProducao` em `127.0.0.1:8003`, health/version corretos e `401` em `/auth/me` sem sessão; o restart controlado também foi concluído. A configuração sanitizada confirmou `RATE_LIMIT_ENABLED=true`. Em chamada autenticada separada, login normal, `/auth/me` e logout funcionaram; o probe de excesso retornou `401,401,401,401,401,429`.

Limite do harness nesta validação: ele não comprova sozinho a origem real do IP. A inspeção somente leitura do Apache ativo não encontrou configuração explícita de `X-Forwarded-For` ou `X-Real-IP`. Qualquer hardening futuro desses headers deve ocorrer em ciclo próprio, com backup, validação de sintaxe, rollback e nova checagem de spoofing. Esses passos não autorizam alteração automática do Apache.

Use o harness abaixo quando a necessidade operacional for apenas reiniciar e validar um servico da API. Ele nao faz deploy, `git pull`, migrations, alteracao de banco, alteracao de `.env`, instalacao de dependencias, ativacao de rotas internas ou alteracao de Apache/proxy. O reinicio so ocorre quando `-Restart` e informado explicitamente. Em producao, `-Restart` exige confirmacao interativa ou `-Force`.

```powershell
.\scripts\deploy\backend-restart-validate-service.ps1 -Environment Homologacao -Validate
.\scripts\deploy\backend-restart-validate-service.ps1 -Environment Homologacao -Restart -Validate
.\scripts\deploy\backend-restart-validate-service.ps1 -Environment InternaProducao -Validate
.\scripts\deploy\backend-restart-validate-service.ps1 -Environment InternaProducao -Restart -Validate
.\scripts\deploy\backend-restart-validate-service.ps1 -Environment Producao -Validate -CheckPublicProxy
.\scripts\deploy\backend-restart-validate-service.ps1 -Environment Producao -Restart -Validate -CheckPublicProxy
.\scripts\deploy\backend-restart-validate-service.ps1 -Environment Producao -Restart -Validate -CheckPublicProxy -Force
```

`InternaProducao` corresponde a `GeoportalAPIInternaProducao`, validando a porta local `8003` e `http://127.0.0.1:8003/api/health`. O uso preferencial e do harness versionado acima, em vez de `Restart-Service` manual. `Producao` continua reservado a API publica em `127.0.0.1:8001`; para a API interna publicada em `/api/internal/`, use `-Environment InternaProducao`.

## Harness de segurança

O harness de segurança ajuda a verificar exposição indevida e configuração segura.

- Verificar exposição de arquivos sensíveis
- Verificar endpoints públicos atuais
- Verificar se `/docs`, `/redoc` e `/openapi.json` não estão expostos em produção
- Verificar headers de segurança no proxy e na API
- Verificar CORS restrito
- Verificar ausência de dados sensíveis em docs e código

### Comandos PowerShell padrão

```powershell
.\scripts\dev\backend-security-check.ps1
```

## Critérios de falha

Pare imediatamente se:

- um teste falhou;
- o `git status` estiver sujo de forma inesperada;
- um healthcheck falhou;
- um endpoint indevido estiver exposto;
- um dado sensível foi encontrado.

## Referência de scripts

- `scripts/dev/git-safe-status.ps1`
- `scripts/dev/backend-test-local.ps1`
- `scripts/dev/backend-security-check.ps1`
- `scripts/deploy/backend-validate-server.ps1`
- `scripts/deploy/backend-restart-validate-service.ps1`

## Observações de segurança

- Não criar scripts destrutivos.
- Não criar scripts que façam push automático.
- Não criar scripts que pivotem migrations automaticamente.
- Nao criar scripts que reiniciem servicos sem parametro explicito e confirmacao adequada.
- Não incluir dados sensíveis.
- Os resultados do `backend-security-check.ps1` devem ser avaliados manualmente antes de confiar integralmente.

## Validacao das salvaguardas administrativas

O bloco da Etapa 0 foi implementado no commit `9f6ec75` e validado primeiro na API interna de homologacao em 2026-06-25, usando usuario ficticio e backup manual previo. A validacao posterior em producao esta registrada abaixo.

O roteiro executado confirmou:

- auditoria administrativa registrada sem segredo ou payload sensivel;
- `403` para usuario sem permissao;
- negativa de autoelevacao;
- negativa de alteracao do proprio vinculo critico, conforme contrato;
- negativa de bloqueio, desativacao ou remocao do ultimo administrador efetivo;
- preservacao de pelo menos um administrador efetivo apos operacoes concorrentes;
- endpoints read-only sem `senha_hash` e demais campos sensiveis;
- header interno mutavel e justificativa nas acoes criticas;
- nenhum GRANT amplo permanente para a role de runtime.

O harness nao deve criar administradores reais, conceder permissao critica automaticamente nem contornar as salvaguardas para facilitar a validacao.

A migration `0011` foi aplicada manualmente em `amambaiGis_homologacao` depois do backup `pre_admin_auditoria_0011_amambaiGis_homologacao_20260625_072037.sql`. O harness nao aplicou migration: ele foi usado depois, com `backend-restart-validate-service.ps1 -Environment InternaHomologacao -Restart -Validate`, para validar `GeoportalAPIInternaHomologacao` na porta `8002`.

O harness confirmou health, version com ambiente de homologacao e `401` de `/api/internal/auth/me` sem sessao. O teste funcional posterior confirmou dois eventos de sucesso e uma negativa persistida, resposta externa `403 Forbidden` sanitizada, usuario ficticio bloqueado ao final e ausencia dos termos sensiveis pesquisados. Em producao, repetir o mesmo principio: migration manual apos backup, GRANT minimo e harness apenas para restart/validate.

### Validacao equivalente em producao

Em 2026-06-25, o mesmo fluxo foi concluido em `InternaProducao`. A migration foi aplicada manualmente somente depois do backup de producao; o harness continuou restrito ao restart/validate do servico `GeoportalAPIInternaProducao`, porta `8003`.

O teste autenticado usou HTTPS, e nao `http://127.0.0.1:8003`, porque o cookie interno de producao possui `Secure=true`. O harness confirmou health, version e protecao de `/auth/me`; a validacao funcional confirmou dois eventos de sucesso, uma negativa auditada, resposta `403 Forbidden` sanitizada, logout e ausencia dos termos sensiveis verificados. O usuario ficticio permanece bloqueado.

O harness final sem restart tambem passou. Os GRANTs minimos de auditoria devem permanecer e o harness nao deve ampliar privilegios nem aplicar migrations automaticamente.
