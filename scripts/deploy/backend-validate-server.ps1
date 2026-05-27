<#
.SYNOPSIS
Valida o estado do backend no servidor sem executar deploy.
.PARAMETER BasePath
Caminho base do repositório. Default: C:\apps\geoportal-api\backend\geoportal-amambai
.PARAMETER RunTests
Roda testes do backend no servidor.
.PARAMETER TestPath
Caminho opcional para teste específico.
.PARAMETER CheckHomologacao
Verifica healthchecks de homologação.
.PARAMETER CheckProducaoLocal
Verifica healthchecks de produção local.
.PARAMETER CheckProducaoPublica
Verifica healthchecks de produção pública.
#>

param(
    [string]$BasePath = 'C:\apps\geoportal-api\backend\geoportal-amambai',
    [switch]$RunTests,
    [string]$TestPath,
    [switch]$CheckHomologacao,
    [switch]$CheckProducaoLocal,
    [switch]$CheckProducaoPublica
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path $BasePath)) {
    throw "BasePath não encontrado: $BasePath"
}

Push-Location $BasePath
try {
    Write-Host "BasePath: $BasePath" -ForegroundColor Cyan

    Write-Host '### git status' -ForegroundColor Cyan
    git status

    Write-Host '`n### git --no-pager log -1 --oneline' -ForegroundColor Cyan
    git --no-pager log -1 --oneline

    if ($RunTests) {
        $backendPath = Join-Path $BasePath 'geoportal-backend'
        if (-not (Test-Path $backendPath)) {
            throw "Diretório geoportal-backend não encontrado em: $backendPath"
        }

        Push-Location $backendPath
        try {
            $activateScript = Join-Path $backendPath '.venv\Scripts\Activate.ps1'
            if (Test-Path $activateScript) {
                Write-Host 'Ativando ambiente virtual...' -ForegroundColor Cyan
                . $activateScript
            }
            else {
                Write-Host 'Ambiente virtual não encontrado. Continuando sem ativar .venv.' -ForegroundColor Yellow
            }

            if ($TestPath) {
                Write-Host "Executando pytest em: $TestPath" -ForegroundColor Cyan
                $exitCode = & pytest $TestPath
                if ($exitCode -ne 0) {
                    Write-Host 'Falha no pytest específico.' -ForegroundColor Red
                    exit $exitCode
                }
            }

            Write-Host 'Executando pytest completo...' -ForegroundColor Cyan
            $exitCode = & pytest
            if ($exitCode -ne 0) {
                Write-Host 'Falha no pytest completo.' -ForegroundColor Red
                exit $exitCode
            }

            Write-Host 'pytest do servidor concluído com sucesso.' -ForegroundColor Green
        }
        finally {
            Pop-Location
        }
    }

function Invoke-HealthCheck {
    param(
        [string]$Url
    )
    try {
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec 15 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "OK: $Url" -ForegroundColor Green
            return $true
        }
        Write-Host "Falha: $Url retornou $($response.StatusCode)" -ForegroundColor Red
        return $false
    }
    catch {
        Write-Host "Erro: $Url -> $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

$allChecksPassed = $true

if ($CheckHomologacao) {
    Write-Host '`n### Verificação de homologação' -ForegroundColor Cyan
    $allChecksPassed = Invoke-HealthCheck -Url 'http://127.0.0.1:8000/api/health' -and $allChecksPassed
    $allChecksPassed = Invoke-HealthCheck -Url 'http://127.0.0.1:8000/api/public/iluminacao/health' -and $allChecksPassed
    $allChecksPassed = Invoke-HealthCheck -Url 'http://127.0.0.1:8000/api/version' -and $allChecksPassed
}

if ($CheckProducaoLocal) {
    Write-Host '`n### Verificação de produção local' -ForegroundColor Cyan
    $allChecksPassed = Invoke-HealthCheck -Url 'http://127.0.0.1:8001/api/health' -and $allChecksPassed
    $allChecksPassed = Invoke-HealthCheck -Url 'http://127.0.0.1:8001/api/public/iluminacao/health' -and $allChecksPassed
    $allChecksPassed = Invoke-HealthCheck -Url 'http://127.0.0.1:8001/api/version' -and $allChecksPassed
}

if ($CheckProducaoPublica) {
    Write-Host '`n### Verificação de produção pública' -ForegroundColor Cyan
    $allChecksPassed = Invoke-HealthCheck -Url 'https://geoserver.amambai.ms.gov.br/api/health' -and $allChecksPassed
    $allChecksPassed = Invoke-HealthCheck -Url 'https://geoserver.amambai.ms.gov.br/api/public/iluminacao/health' -and $allChecksPassed
    $allChecksPassed = Invoke-HealthCheck -Url 'https://geoserver.amambai.ms.gov.br/api/version' -and $allChecksPassed
}

if (-not $allChecksPassed) {
    Write-Host '`nUma ou mais validações falharam.' -ForegroundColor Red
    exit 1
}

Write-Host '`nTodas as validações configuradas passaram.' -ForegroundColor Green
exit 0
}
finally {
    Pop-Location
}
