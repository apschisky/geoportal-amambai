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

Use o harness abaixo quando a necessidade operacional for apenas reiniciar e validar um servico da API. Ele nao faz deploy, `git pull`, migrations, alteracao de banco, alteracao de `.env`, instalacao de dependencias, ativacao de rotas internas ou alteracao de Apache/proxy. O reinicio so ocorre quando `-Restart` e informado explicitamente. Em producao, `-Restart` exige confirmacao interativa ou `-Force`.

```powershell
.\scripts\deploy\backend-restart-validate-service.ps1 -Environment Homologacao -Validate
.\scripts\deploy\backend-restart-validate-service.ps1 -Environment Homologacao -Restart -Validate
.\scripts\deploy\backend-restart-validate-service.ps1 -Environment Producao -Validate -CheckPublicProxy
.\scripts\deploy\backend-restart-validate-service.ps1 -Environment Producao -Restart -Validate -CheckPublicProxy
.\scripts\deploy\backend-restart-validate-service.ps1 -Environment Producao -Restart -Validate -CheckPublicProxy -Force
```

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
