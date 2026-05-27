<#
.SYNOPSIS
Roda testes locais do backend de forma padronizada.
.PARAMETER TestPath
Caminho opcional para um arquivo ou teste específico, relativo à raiz de geoportal-backend.
.PARAMETER Full
Quando informado, roda o pytest completo após o teste específico.
#>

param(
    [string]$TestPath,
    [switch]$Full
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-RepoRoot {
    $root = git rev-parse --show-toplevel 2>$null
    if (-not $root) {
        throw 'Este script deve ser executado dentro de um repositório Git.'
    }
    return $root
}

$repoRoot = Get-RepoRoot
$backendPath = Join-Path $repoRoot 'geoportal-backend'
if (-not (Test-Path $backendPath)) {
    throw "Diretório backend não encontrado em: $backendPath"
}

$pythonExe = Join-Path $backendPath '.venv\Scripts\python.exe'
if (-not (Test-Path $pythonExe)) {
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pythonCommand) {
        throw 'Python não encontrado. Assegure que o ambiente virtual .venv exista ou que Python esteja disponível no PATH.'
    }
    $pythonExe = $pythonCommand.Source
}

Push-Location $backendPath
try {
    Write-Host "Usando Python: $pythonExe" -ForegroundColor Cyan

    if ($TestPath) {
        Write-Host "Executando pytest em: $TestPath" -ForegroundColor Cyan
        & $pythonExe -m pytest $TestPath
        $exitCode = $LASTEXITCODE
        if ($exitCode -ne 0) {
            Write-Host 'Falha no pytest específico.' -ForegroundColor Red
            exit $exitCode
        }

        Write-Host 'Teste específico concluído com sucesso.' -ForegroundColor Green

        if ($Full) {
            Write-Host 'Executando pytest completo...' -ForegroundColor Cyan
            & $pythonExe -m pytest
            $exitCode = $LASTEXITCODE
            if ($exitCode -ne 0) {
                Write-Host 'Falha no pytest completo.' -ForegroundColor Red
                exit $exitCode
            }
            Write-Host 'Teste específico e suite completa concluídos com sucesso.' -ForegroundColor Green
        }

        exit 0
    }

    Write-Host 'Executando pytest completo...' -ForegroundColor Cyan
    & $pythonExe -m pytest
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        Write-Host 'Falha no pytest completo.' -ForegroundColor Red
        exit $exitCode
    }

    Write-Host 'pytest completo concluído com sucesso.' -ForegroundColor Green
    exit 0
}
finally {
    Pop-Location
}
