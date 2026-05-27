<#
.SYNOPSIS
Busca padrões sensíveis em código e documentação para revisão humana.
#>

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
Push-Location $repoRoot
try {
    $patterns = @(
        'DATABASE_URL=',
        'password=',
        'senha real',
        'token real',
        'secret real',
        'IP-2026',
        '5599',
        '9999',
        'BEGIN PRIVATE KEY',
        'API_KEY',
        'SECRET_KEY'
    )

    $allowedExtensions = @('.py', '.ps1', '.md', '.sql', '.js', '.ts', '.tsx', '.json', '.yaml', '.yml', '.toml')
    $excludePathsRegex = '\.git\\|\\.venv\\|\\venv\\|\\node_modules\\|\\dist\\|\\build\\|\\__pycache__\\|\\.pytest_cache\\|\\.mypy_cache\\|\\coverage\\|\\htmlcov\\'
    $scriptToExclude = (Join-Path $repoRoot 'scripts\dev\backend-security-check.ps1')

    $files = Get-ChildItem -Path $repoRoot -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object {
            $path = $_.FullName
            -not ($path -match $excludePathsRegex) -and
            ($allowedExtensions -contains $_.Extension.ToLower()) -and
            ($path -ne $scriptToExclude)
        }

    Write-Host 'Executando varredura de padrões sensíveis...' -ForegroundColor Cyan
    $found = $false

    if (-not $files) {
        Write-Host 'Nenhum arquivo compatível encontrado para varredura.' -ForegroundColor Yellow
    }
    else {
        foreach ($pattern in $patterns) {
            $matches = Select-String -Path $files.FullName -Pattern $pattern -SimpleMatch -ErrorAction SilentlyContinue
            if ($matches) {
                $found = $true
                Write-Host "`nPadrão encontrado: $pattern" -ForegroundColor Yellow
                $matches | ForEach-Object {
                    Write-Host "  $($_.Path):$($_.LineNumber): $($_.Line.Trim())"
                }
            }
        }
    }

    if (-not $found) {
        Write-Host 'Nenhum padrão sensível encontrado pelo scanner. Avalie manualmente o contexto.' -ForegroundColor Green
    }
    else {
        Write-Host '`nAtenção: os resultados acima precisam de revisão humana. Nem todos os matches são necessariamente sensíveis.' -ForegroundColor Yellow
    }
}
finally {
    Pop-Location
}

exit 0
