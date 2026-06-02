<#
.SYNOPSIS
Reinicia e valida servicos da Geoportal API sem executar deploy.
.PARAMETER Environment
Ambiente alvo. Valores permitidos: Homologacao, InternaHomologacao ou Producao.
.PARAMETER Restart
Quando informado, reinicia apenas o servico do ambiente selecionado.
.PARAMETER Validate
Quando informado, valida endpoints locais do ambiente selecionado.
.PARAMETER CheckPublicProxy
Quando informado, valida endpoints publicos. Permitido somente para Producao.
.PARAMETER Force
Confirma reinicio de Producao sem prompt interativo.
#>

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Homologacao', 'InternaHomologacao', 'Producao')]
    [string]$Environment,

    [switch]$Restart,
    [switch]$Validate,
    [switch]$CheckPublicProxy,
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-EnvironmentConfig {
    param(
        [string]$Name
    )

    if ($Name -eq 'Homologacao') {
        return [PSCustomObject]@{
            Name = 'Homologacao'
            ServiceName = 'GeoportalAPIHomologacao'
            LocalBaseUrl = 'http://127.0.0.1:8000'
            Port = 8000
            ExpectedEnvironment = 'homologacao'
            PublicBaseUrl = $null
            IsInternalRuntime = $false
        }
    }

    if ($Name -eq 'InternaHomologacao') {
        return [PSCustomObject]@{
            Name = 'InternaHomologacao'
            ServiceName = 'GeoportalAPIInternaHomologacao'
            LocalBaseUrl = 'http://127.0.0.1:8002'
            Port = 8002
            ExpectedEnvironment = 'homologacao'
            PublicBaseUrl = $null
            IsInternalRuntime = $true
        }
    }

    return [PSCustomObject]@{
        Name = 'Producao'
        ServiceName = 'GeoportalAPIProducao'
        LocalBaseUrl = 'http://127.0.0.1:8001'
        Port = 8001
        ExpectedEnvironment = 'producao'
        PublicBaseUrl = 'https://geoserver.amambai.ms.gov.br'
        IsInternalRuntime = $false
    }
}

function Confirm-ProductionRestart {
    param(
        [switch]$Force
    )

    if ($Force) {
        Write-Host 'Confirmacao de producao recebida via -Force.' -ForegroundColor Yellow
        return
    }

    Write-Host 'Voce esta prestes a reiniciar producao.' -ForegroundColor Yellow
    $confirmation = Read-Host 'Digite REINICIAR para confirmar'
    if ($confirmation -ne 'REINICIAR') {
        throw 'Reinicio de producao cancelado pelo operador.'
    }
}

function Test-ServicePort {
    param(
        [int]$Port
    )

    Write-Host "Validando porta local: $Port" -ForegroundColor Cyan
    $portMatches = netstat -ano | Select-String -Pattern ":$Port\s"
    if (-not $portMatches) {
        Write-Host "Falha: porta $Port nao encontrada no netstat." -ForegroundColor Red
        return $false
    }

    Write-Host "OK: porta $Port encontrada no netstat." -ForegroundColor Green
    return $true
}

function Restart-GeoportalService {
    param(
        [object]$Config
    )

    Write-Host "`n### Reinicio controlado do servico" -ForegroundColor Cyan
    Write-Host "Ambiente: $($Config.Name)"
    Write-Host "Servico: $($Config.ServiceName)"
    Write-Host "Porta: $($Config.Port)"

    Restart-Service -Name $Config.ServiceName -Force -ErrorAction Stop
    Start-Sleep -Seconds 8

    $service = Get-Service -Name $Config.ServiceName -ErrorAction Stop
    $service | Format-Table -AutoSize

    if ($service.Status -ne 'Running') {
        Write-Host "Falha: servico $($Config.ServiceName) nao esta Running." -ForegroundColor Red
        return $false
    }

    $portOk = Test-ServicePort -Port $Config.Port
    return $portOk
}

function Invoke-JsonEndpoint {
    param(
        [string]$Url
    )

    Write-Host "Validando endpoint: $Url" -ForegroundColor Cyan
    try {
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec 15 -UseBasicParsing
        if ($response.StatusCode -ne 200) {
            Write-Host "Falha: status HTTP $($response.StatusCode)" -ForegroundColor Red
            return $null
        }

        return $response.Content | ConvertFrom-Json
    }
    catch {
        Write-Host "Falha ao validar endpoint: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

function Test-HealthStatus {
    param(
        [string]$Url
    )

    $body = Invoke-JsonEndpoint -Url $Url
    if ($null -eq $body) {
        return $false
    }

    if ($body.status -ne 'ok') {
        Write-Host 'Falha: campo status diferente de ok.' -ForegroundColor Red
        return $false
    }

    Write-Host "OK: $Url" -ForegroundColor Green
    return $true
}

function Test-VersionEnvironment {
    param(
        [string]$Url,
        [string]$ExpectedEnvironment
    )

    $body = Invoke-JsonEndpoint -Url $Url
    if ($null -eq $body) {
        return $false
    }

    if ($body.environment -ne $ExpectedEnvironment) {
        Write-Host "Falha: environment diferente de $ExpectedEnvironment." -ForegroundColor Red
        return $false
    }

    Write-Host "OK: $Url environment=$ExpectedEnvironment" -ForegroundColor Green
    return $true
}

function Test-UnauthorizedEndpoint {
    param(
        [string]$Url
    )

    Write-Host "Validando endpoint sem sessao: $Url" -ForegroundColor Cyan
    try {
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec 15 -UseBasicParsing
        Write-Host "Falha: status HTTP $($response.StatusCode); esperado 401." -ForegroundColor Red
        return $false
    }
    catch {
        $statusCode = $null
        if ($null -ne $_.Exception.Response) {
            $statusCode = $_.Exception.Response.StatusCode.value__
        }

        if ($statusCode -eq 401) {
            Write-Host "OK: $Url retornou 401 sem sessao." -ForegroundColor Green
            return $true
        }

        if ($null -eq $statusCode) {
            Write-Host "Falha ao validar endpoint sem sessao: $($_.Exception.Message)" -ForegroundColor Red
            return $false
        }

        Write-Host "Falha: status HTTP $statusCode; esperado 401." -ForegroundColor Red
        return $false
    }
}

function Test-LocalEndpoints {
    param(
        [object]$Config
    )

    Write-Host "`n### Validacao local" -ForegroundColor Cyan
    Write-Host "Base local: $($Config.LocalBaseUrl)"
    Write-Host "Environment esperado: $($Config.ExpectedEnvironment)"

    $allOk = $true
    $allOk = (Test-HealthStatus -Url "$($Config.LocalBaseUrl)/api/health") -and $allOk
    $allOk = (Test-VersionEnvironment -Url "$($Config.LocalBaseUrl)/api/version" -ExpectedEnvironment $Config.ExpectedEnvironment) -and $allOk

    if ($Config.IsInternalRuntime) {
        $allOk = (Test-UnauthorizedEndpoint -Url "$($Config.LocalBaseUrl)/api/internal/auth/me") -and $allOk
    }
    else {
        $allOk = (Test-HealthStatus -Url "$($Config.LocalBaseUrl)/api/public/iluminacao/health") -and $allOk
    }

    return $allOk
}

function Test-PublicProxyEndpoints {
    param(
        [object]$Config
    )

    if ($Config.Name -ne 'Producao') {
        throw 'CheckPublicProxy e permitido somente para Producao.'
    }

    Write-Host "`n### Validacao publica via proxy" -ForegroundColor Cyan
    Write-Host "Base publica: $($Config.PublicBaseUrl)"

    $allOk = $true
    $allOk = (Test-HealthStatus -Url "$($Config.PublicBaseUrl)/api/health") -and $allOk
    $allOk = (Test-HealthStatus -Url "$($Config.PublicBaseUrl)/api/public/iluminacao/health") -and $allOk
    $allOk = (Test-VersionEnvironment -Url "$($Config.PublicBaseUrl)/api/version" -ExpectedEnvironment 'producao') -and $allOk

    return $allOk
}

$originalLocation = Get-Location
$config = Get-EnvironmentConfig -Name $Environment
$allChecksPassed = $true

Push-Location $originalLocation
try {
    Write-Host '### Geoportal API restart/validate harness' -ForegroundColor Cyan
    Write-Host "Ambiente: $($config.Name)"
    Write-Host "Servico: $($config.ServiceName)"
    Write-Host "Porta: $($config.Port)"
    Write-Host 'Escopo: sem deploy, sem git pull, sem migrations, sem banco, sem Apache/Tomcat.' -ForegroundColor Yellow

    if ($CheckPublicProxy -and $config.Name -ne 'Producao') {
        throw 'CheckPublicProxy e permitido somente para Producao.'
    }

    if ($Restart -and $config.Name -eq 'Producao') {
        Confirm-ProductionRestart -Force:$Force
    }

    if ($Restart) {
        $allChecksPassed = (Restart-GeoportalService -Config $config) -and $allChecksPassed
    }

    if ($Validate) {
        $allChecksPassed = (Test-LocalEndpoints -Config $config) -and $allChecksPassed
    }

    if ($CheckPublicProxy) {
        $allChecksPassed = (Test-PublicProxyEndpoints -Config $config) -and $allChecksPassed
    }

    if (-not $allChecksPassed) {
        Write-Host "`nResumo final: falha em uma ou mais etapas." -ForegroundColor Red
        exit 1
    }

    Write-Host "`nResumo final: etapas solicitadas concluidas com sucesso." -ForegroundColor Green
    exit 0
}
finally {
    Pop-Location
}
