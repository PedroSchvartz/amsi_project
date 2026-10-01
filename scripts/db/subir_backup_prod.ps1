<#
.SYNOPSIS
  Sobe (restaura) um arquivo .dump SELECIONADO para o banco de PRODUCAO (Railway). Antes de
  tocar na producao, SEMPRE baixa um backup de seguranca dela (rede para rollback).

.DESCRIPTION
  O restore em producao usa 'pg_restore --clean --if-exists': a producao passa a refletir o
  dump (objetos sao derrubados e recriados). O backup de seguranca (pre-restore) e gerado e
  verificado ANTES; se ele falhar, o script aborta sem tocar na producao. A DATABASE_URL
  nunca e impressa nem gravada (ver _lib.ps1).

  Politica: so mexa na producao por meio deste script DEPOIS de valida-lo no banco LOCAL
  (use -DatabaseUrl apontando para o local — ver abaixo).

.PARAMETER Dump
  Caminho do arquivo .dump a restaurar (obrigatorio).

.PARAMETER DatabaseUrl
  (Opcional) MODO TESTE. Se informado, restaura NESTE alvo (ex.: o banco LOCAL) em vez da
  producao, e NAO faz backup de producao. Serve para validar o restore no local antes de
  confiar o script a producao. Sem este parametro, o alvo e a PRODUCAO.

.PARAMETER Force
  Pula a confirmacao interativa (use com cuidado; necessario em execucao nao-interativa).

.EXAMPLE
  # Validar no banco LOCAL primeiro (nao toca na producao):
  .\subir_backup_prod.ps1 -Dump C:\Codigos\AMSI_backups\estado_novo.dump `
      -DatabaseUrl 'postgresql://postgres:SENHA@localhost:5432/ANSI_Project'

.EXAMPLE
  # Subir para a PRODUCAO (pede confirmacao; faz backup de seguranca antes):
  .\subir_backup_prod.ps1 -Dump C:\Codigos\AMSI_backups\estado_novo.dump
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Dump,
    [string]$DatabaseUrl,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_lib.ps1')

if (-not (Test-Path -LiteralPath $Dump)) { throw "Arquivo .dump nao encontrado: $Dump" }
$Dump = (Resolve-Path -LiteralPath $Dump).Path
if (-not (Test-DumpLegivel -Arquivo $Dump)) {
    throw "O arquivo nao e um dump custom-format valido (pg_restore --list falhou): $Dump"
}
$pgRestore = Get-Pg18Tool 'pg_restore'

# ───────────────────────── MODO TESTE (alvo informado; nao e a producao) ─────────────────
if ($DatabaseUrl) {
    Write-Host "MODO TESTE: restaurando no alvo informado (NAO e a producao)." -ForegroundColor Yellow
    if (-not $Force) {
        $ok = Read-Host "Restaurar '$Dump' no alvo informado (--clean substitui objetos)? [s/N]"
        if ($ok -notmatch '^[sS]') { Write-Host 'Cancelado.'; return }
    }
    & $pgRestore --clean --if-exists --no-owner --no-privileges -d $DatabaseUrl $Dump
    if ($LASTEXITCODE -ne 0) { throw "pg_restore falhou (exit $LASTEXITCODE)." }
    Write-Host 'OK. Restore concluido no alvo de teste.' -ForegroundColor Green
    return
}

# ───────────────────────────────────── MODO PRODUCAO ─────────────────────────────────────
Assert-RailwayProducao

# Passo 1/2 — backup de seguranca da producao (obrigatorio; falhou => aborta).
$dir       = Get-BackupDir
$hoje      = Get-Date -Format 'yyyyMMdd'
$seguranca = Resolve-NomeLivre -Dir $dir -Base "amsi_prod_pre-restore_$hoje" -Ext '.dump'
Write-Host 'Passo 1/2 - backup de seguranca da PRODUCAO:' -ForegroundColor Cyan
Write-Host "  $seguranca"
Invoke-PgDumpProducao -OutFile $seguranca -Fase 'backup de seguranca (pg_dump)'
if (-not (Test-DumpLegivel -Arquivo $seguranca)) {
    throw "Backup de seguranca ilegivel; ABORTADO antes de tocar na producao: $seguranca"
}
Write-Host "Backup de seguranca OK: $seguranca" -ForegroundColor Green

# Confirmacao destrutiva.
Write-Host ''
Write-Host 'ATENCAO: isto vai SUBSTITUIR o banco de PRODUCAO pelo conteudo de:' -ForegroundColor Red
Write-Host "  $Dump" -ForegroundColor Red
Write-Host "Rollback possivel a partir do backup de seguranca acima." -ForegroundColor DarkGray
if (-not $Force) {
    $resp = Read-Host "Para confirmar, digite o nome do projeto ($script:PROJETO_ESPERADO)"
    if ($resp -ne $script:PROJETO_ESPERADO) { Write-Host 'Cancelado (confirmacao nao conferiu).'; return }
}

# Passo 2/2 — restore na producao via `railway run` (DATABASE_URL injetada no filho).
$bat = Join-Path $env:TEMP ("amsi_restore_{0}.bat" -f ([guid]::NewGuid().ToString('N')))
@"
@echo off
"$pgRestore" --clean --if-exists --no-owner --no-privileges -d "%DATABASE_URL%" "$Dump"
"@ | Set-Content -LiteralPath $bat -Encoding ascii
try {
    Write-Host 'Passo 2/2 - restaurando na PRODUCAO...' -ForegroundColor Cyan
    $code = Invoke-RailwayBat -Bat $bat -Fase 'restaurando na producao (pg_restore)'
    if ($code -ne 0) {
        throw "pg_restore falhou (exit $code). A producao pode estar inconsistente; restaure o backup de seguranca: $seguranca"
    }
} finally {
    Remove-Item -LiteralPath $bat -Force -ErrorAction SilentlyContinue
}
Write-Host "OK. Producao restaurada a partir de: $Dump" -ForegroundColor Green
Write-Host "Backup de seguranca (rollback): $seguranca" -ForegroundColor DarkGray
