<#
.SYNOPSIS
Mostra o estado seguro do Git sem alterar nada.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

try {
    $repoRoot = git rev-parse --show-toplevel 2>$null
    if (-not $repoRoot) {
        throw 'Este script deve ser executado em um repositório Git.'
    }

    Set-Location $repoRoot

    Write-Host '### git status' -ForegroundColor Cyan
    git status

    Write-Host "`n### git --no-pager diff --stat" -ForegroundColor Cyan
    git --no-pager diff --stat

    Write-Host "`n### git diff --name-only" -ForegroundColor Cyan
    git diff --name-only

    Write-Host "`n### git --no-pager log -1 --oneline" -ForegroundColor Cyan
    git --no-pager log -1 --oneline
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}
