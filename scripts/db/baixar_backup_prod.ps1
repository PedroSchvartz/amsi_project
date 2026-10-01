<#
.SYNOPSIS
  Baixa um backup (dump custom-format) do banco de PRODUCAO (Railway) para a pasta de
  backups, com a DATA DO DIA no nome. Nunca sobrescreve: se o nome ja existe, acrescenta
  um sufixo numerico crescente (_1, _2, ...).

.DESCRIPTION
  Somente-leitura: pg_dump NAO altera a producao. A DATABASE_URL nunca e impressa nem
  gravada (ver _lib.ps1). Destino padrao: C:\Codigos\AMSI_backups (fora do repo); mude com
  a variavel de ambiente AMSI_BACKUP_DIR. O cliente PostgreSQL 18 e localizado por
  AMSI_PG18_BIN (padrao C:\Codigos\AMSI_backups\pgsql18\bin).

.EXAMPLE
  .\baixar_backup_prod.ps1
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_lib.ps1')

Assert-RailwayProducao

$dir   = Get-BackupDir
$hoje  = Get-Date -Format 'yyyyMMdd'
$saida = Resolve-NomeLivre -Dir $dir -Base "amsi_prod_$hoje" -Ext '.dump'

Write-Host "Baixando backup da PRODUCAO para:" -ForegroundColor Cyan
Write-Host "  $saida"
Invoke-PgDumpProducao -OutFile $saida

if (-not (Test-DumpLegivel -Arquivo $saida)) {
    throw "O dump gerado nao pode ser lido pelo pg_restore: $saida"
}

$tam = '{0:N0} KB' -f ((Get-Item -LiteralPath $saida).Length / 1KB)
Write-Host "OK. Backup gerado ($tam):" -ForegroundColor Green
Write-Host "  $saida"
