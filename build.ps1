<#
.SYNOPSIS
    Mesa do Bem — Build & Push para o Docker Hub
.EXAMPLE
    .\build.ps1 1.2.0
    .\build.ps1          # solicita a versão interativamente
#>
param(
    [Parameter(Position = 0)]
    [string]$Version
)

$ErrorActionPreference = "Stop"
$HUB   = "vydhal"
$ROOT  = $PSScriptRoot

# ─── Banner ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ╔═══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║      Mesa do Bem — Build & Push       ║" -ForegroundColor Cyan
Write-Host "  ╚═══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ─── Versão ─────────────────────────────────────────────────────────────────
if (-not $Version) {
    $Version = Read-Host "  Versão (ex: 1.0.0)"
    if (-not $Version) {
        Write-Host "  Versão obrigatória. Saindo." -ForegroundColor Red
        exit 1
    }
}
Write-Host "  Versão: $Version" -ForegroundColor Yellow
Write-Host ""

# ─── Menu ────────────────────────────────────────────────────────────────────
Write-Host "  O que deseja publicar?" -ForegroundColor Yellow
Write-Host ""
Write-Host "    [1] Apenas Frontend"
Write-Host "    [2] Apenas Backend"
Write-Host "    [3] Apenas Face Service"
Write-Host "    [4] Frontend + Backend"
Write-Host "    [5] Tudo  (Frontend + Backend + Face Service)"
Write-Host ""
$opcao = Read-Host "  Escolha [1-5]"
Write-Host ""

# ─── Função de Build + Push ──────────────────────────────────────────────────
function Invoke-BuildPush {
    param(
        [string]$ServiceName,
        [string]$ContextPath,
        [string]$Label
    )

    $tag       = "${HUB}/${ServiceName}:${Version}"
    $tagLatest = "${HUB}/${ServiceName}:latest"

    Write-Host "  ┌─ $Label ──────────────────────────────────────────" -ForegroundColor Cyan
    Write-Host "  │  Construindo imagem..." -ForegroundColor White

    docker build -t $tag -t $tagLatest $ContextPath
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  └─ FALHOU no build de $Label" -ForegroundColor Red
        exit 1
    }

    Write-Host "  │  Publicando $tag ..." -ForegroundColor White
    docker push $tag
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  └─ FALHOU no push de $Label" -ForegroundColor Red
        exit 1
    }

    docker push $tagLatest
    Write-Host "  └─ OK: $tag" -ForegroundColor Green
    Write-Host ""

    return $tag
}

# ─── Execução ────────────────────────────────────────────────────────────────
$publicadas = @()

switch ($opcao) {
    "1" {
        $publicadas += Invoke-BuildPush "mesa-do-bem-frontend"     "$ROOT\frontend"      "Frontend"
    }
    "2" {
        $publicadas += Invoke-BuildPush "mesa-do-bem-backend"      "$ROOT\backend"       "Backend"
    }
    "3" {
        $publicadas += Invoke-BuildPush "mesa-do-bem-face-service" "$ROOT\face-service"  "Face Service"
    }
    "4" {
        $publicadas += Invoke-BuildPush "mesa-do-bem-frontend"     "$ROOT\frontend"      "Frontend"
        $publicadas += Invoke-BuildPush "mesa-do-bem-backend"      "$ROOT\backend"       "Backend"
    }
    "5" {
        $publicadas += Invoke-BuildPush "mesa-do-bem-frontend"     "$ROOT\frontend"      "Frontend"
        $publicadas += Invoke-BuildPush "mesa-do-bem-backend"      "$ROOT\backend"       "Backend"
        $publicadas += Invoke-BuildPush "mesa-do-bem-face-service" "$ROOT\face-service"  "Face Service"
        Write-Host "  Nota: banco de dados usa postgres:16-alpine (imagem oficial)." -ForegroundColor DarkGray
        Write-Host ""
    }
    default {
        Write-Host "  Opção inválida. Saindo." -ForegroundColor Red
        exit 1
    }
}

# ─── Atualizar stack.yml ─────────────────────────────────────────────────────
$stackPath = "$ROOT\stack.yml"
if (Test-Path $stackPath) {
    Write-Host ""
    $resp = Read-Host "  Atualizar versões no stack.yml para $Version? (s/n)"
    if ($resp -eq "s" -or $resp -eq "S") {
        $conteudo = Get-Content $stackPath -Raw -Encoding UTF8
        $conteudo = $conteudo -replace "vydhal/mesa-do-bem-frontend:[^\s`"']+",    "vydhal/mesa-do-bem-frontend:$Version"
        $conteudo = $conteudo -replace "vydhal/mesa-do-bem-backend:[^\s`"']+",     "vydhal/mesa-do-bem-backend:$Version"
        $conteudo = $conteudo -replace "vydhal/mesa-do-bem-face-service:[^\s`"']+","vydhal/mesa-do-bem-face-service:$Version"
        Set-Content $stackPath $conteudo -Encoding UTF8 -NoNewline
        Write-Host "  stack.yml atualizado para v$Version" -ForegroundColor Green
    }
}

# ─── Resumo ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ╔═══════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║        Publicação concluída!          ║" -ForegroundColor Green
Write-Host "  ╚═══════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Imagens publicadas no Docker Hub:" -ForegroundColor Green
foreach ($img in $publicadas) {
    Write-Host "    • $img" -ForegroundColor White
    Write-Host "    • ${img.Split(':')[0]}:latest" -ForegroundColor DarkGray
}
Write-Host ""
Write-Host "  Próximos passos:" -ForegroundColor Yellow
Write-Host "    1. Acesse o Portainer em https://cozinha.simplisoft.com.br"
Write-Host "    2. Stacks → Mesa do Bem → atualizar com stack.yml"
Write-Host "    3. Confirme as variáveis em .env.production"
Write-Host ""
