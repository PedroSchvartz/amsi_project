# _lib.ps1 — funcoes comuns dos scripts de backup/restore do banco de PRODUCAO (Railway).
#
# Regra de ouro de seguranca: a DATABASE_URL de producao NUNCA e impressa, logada nem
# materializada neste processo. Ela so existe dentro do processo-filho que o `railway run`
# injeta (ver Invoke-PgDumpProducao / o restore em subir_backup_prod.ps1).

Set-StrictMode -Version Latest

$script:PROJETO_ESPERADO = 'AMSI_Project'
# Raiz do repo (onde o Railway esta linkado): este arquivo vive em scripts\db\.
$script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Get-BackupDir {
    $dir = if ($env:AMSI_BACKUP_DIR) { $env:AMSI_BACKUP_DIR } else { 'C:\Codigos\AMSI_backups' }
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    return $dir
}

function Get-Pg18Tool {
    # Caminho para pg_dump/pg_restore/psql versao >= 18 (producao roda PostgreSQL 18.x).
    param([Parameter(Mandatory)][ValidateSet('pg_dump', 'pg_restore', 'psql')][string]$Nome)
    $bin = if ($env:AMSI_PG18_BIN) { $env:AMSI_PG18_BIN } else { 'C:\Codigos\AMSI_backups\pgsql18\bin' }
    $exe = Join-Path $bin "$Nome.exe"
    if (-not (Test-Path -LiteralPath $exe)) {
        throw @"
Nao encontrei '$Nome' (PostgreSQL 18) em:
  $exe
A producao roda PostgreSQL 18.x, entao o cliente precisa ser >= 18 (o PG17 local nao serve).
Baixe o ZIP oficial EDB 'postgresql-18.x-windows-x64-binaries', extraia a pasta 'pgsql\bin'
para '$bin' (ou aponte `$env:AMSI_PG18_BIN para onde ela estiver).
"@
    }
    $ver = (& $exe --version) | Out-String
    if ($ver -notmatch '\b(1[89]|[2-9]\d)\.') {
        throw "Versao de '$Nome' incompativel (precisa >= 18): $($ver.Trim())"
    }
    return $exe
}

function Assert-RailwayProducao {
    # Garante que o Railway esta apontando para o projeto/environment de producao do AMSI.
    Push-Location $script:RepoRoot
    try {
        $status = railway status | Out-String
    } finally {
        Pop-Location
    }
    $proj = if ($status -match '(?m)^Project:\s*(.+?)\s*$') { $Matches[1] } else { '(nenhum)' }
    $envi = if ($status -match '(?m)^Environment:\s*(.+?)\s*$') { $Matches[1] } else { '(nenhum)' }
    if ($proj -ne $script:PROJETO_ESPERADO -or $envi -ne 'production') {
        throw @"
O Railway NAO esta apontando para a producao do AMSI.
  Project esperado:     $script:PROJETO_ESPERADO   | atual: $proj
  Environment esperado: production                 | atual: $envi
Rode na raiz do repo:  railway link --project $script:PROJETO_ESPERADO
e selecione o environment 'production'.
"@
    }
    Write-Host "Railway OK: projeto '$proj', environment '$envi'." -ForegroundColor DarkGray
}

function Resolve-NomeLivre {
    # Retorna um caminho em $Dir que ainda nao existe: "$Base$Ext"; se ocupado, "${Base}_1$Ext",
    # "${Base}_2$Ext"... Nunca sobrescreve um arquivo existente.
    param(
        [Parameter(Mandatory)][string]$Dir,
        [Parameter(Mandatory)][string]$Base,
        [Parameter(Mandatory)][string]$Ext   # ex.: '.dump'
    )
    $alvo = Join-Path $Dir ($Base + $Ext)
    if (-not (Test-Path -LiteralPath $alvo)) { return $alvo }
    $i = 1
    while ($true) {
        $alvo = Join-Path $Dir ("${Base}_$i$Ext")
        if (-not (Test-Path -LiteralPath $alvo)) { return $alvo }
        $i++
    }
}

function Format-IndicadorFrame {
    # Monta UMA linha do indicador de atividade: spinner + barra INDETERMINADA (um bloco que
    # vai-e-volta) + fase + tempo decorrido. Largura total fixa, para a troca em `\r` nao
    # deixar restos. Pura (sem efeito colateral) para poder ser testada isoladamente.
    param(
        [Parameter(Mandatory)][string]$Fase,
        [Parameter(Mandatory)][int]$Quadro,
        [Parameter(Mandatory)][int]$Segundos,
        [int]$Largura = 20
    )
    $spin  = '|', '/', '-', '\'
    $campo = $Largura - 3                 # espaco livre para o bloco '===' percorrer
    $ciclo = 2 * $campo
    $pos   = $Quadro % $ciclo
    if ($pos -gt $campo) { $pos = $ciclo - $pos }   # reflete: ida e volta
    $barra = (' ' * $pos) + '===' + (' ' * ($campo - $pos))
    return ("  {0} {1,-30} [{2}] {3,3}s" -f $spin[$Quadro % 4], $Fase, $barra, $Segundos)
}

function Invoke-RailwayBat {
    # Executa `railway run -- cmd /c <bat>` a partir da raiz do repo (contexto do link do
    # Railway), num background job, enquanto mostra um indicador de atividade na MESMA linha
    # (spinner + barra indeterminada + fase + tempo). Em terminal nao-interativo (saida
    # redirecionada) NAO anima: imprime a fase uma vez, para nao encher o log de `\r`.
    # A DATABASE_URL continua so no processo-filho (railway a injeta); nunca e impressa.
    # Retorna o exit code do `railway run`.
    param(
        [Parameter(Mandatory)][string]$Bat,
        [Parameter(Mandatory)][string]$Fase
    )
    $job = Start-Job -ScriptBlock {
        param($repo, $bat)
        Set-Location -LiteralPath $repo
        $log = & railway run -- cmd /c $bat 2>&1 | Out-String
        [pscustomobject]@{ Code = $LASTEXITCODE; Log = $log }
    } -ArgumentList $script:RepoRoot, $Bat

    $interativo = -not [Console]::IsOutputRedirected
    if (-not $interativo) { Write-Host "  $Fase..." -ForegroundColor Cyan }

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $q  = 0
    if ($interativo) { try { [Console]::CursorVisible = $false } catch {} }
    try {
        while ($job.State -eq 'Running') {
            if ($interativo) {
                $linha = Format-IndicadorFrame -Fase $Fase -Quadro $q -Segundos ([int]$sw.Elapsed.TotalSeconds)
                [Console]::Write("`r$linha")
            }
            Start-Sleep -Milliseconds 120
            $q++
        }
    } finally {
        $sw.Stop()
        if ($interativo) {
            [Console]::Write("`r" + (' ' * 72) + "`r")   # limpa a linha do indicador
            try { [Console]::CursorVisible = $true } catch {}
        }
    }

    $res  = Receive-Job $job
    Remove-Job $job -Force -ErrorAction SilentlyContinue
    $code = if ($null -ne $res) { [int]$res.Code } else { 1 }
    if ($code -ne 0 -and $res -and $res.Log) {
        Write-Host ($res.Log.Trim()) -ForegroundColor DarkYellow   # contexto do erro do filho
    }
    return $code
}

function Invoke-PgDumpProducao {
    # Dump custom-format da PRODUCAO para $OutFile, via `railway run` (DATABASE_URL injetada
    # no filho). Somente-leitura: nao altera a producao.
    param(
        [Parameter(Mandatory)][string]$OutFile,
        [string]$Fase = 'baixando backup da producao'
    )
    $pgDump = Get-Pg18Tool 'pg_dump'
    # Script-filho temporario: referencia %DATABASE_URL% (expandida pelo cmd no processo-filho,
    # onde o railway a injeta). O segredo nunca entra neste processo nem no .bat.
    $bat = Join-Path $env:TEMP ("amsi_dump_{0}.bat" -f ([guid]::NewGuid().ToString('N')))
    @"
@echo off
"$pgDump" "%DATABASE_URL%" -Fc --no-owner --no-privileges -f "$OutFile"
"@ | Set-Content -LiteralPath $bat -Encoding ascii
    try {
        $code = Invoke-RailwayBat -Bat $bat -Fase $Fase
        if ($code -ne 0) { throw "pg_dump falhou (exit $code)." }
    } finally {
        Remove-Item -LiteralPath $bat -Force -ErrorAction SilentlyContinue
    }
}

function Test-DumpLegivel {
    # Sanity check: o arquivo e um dump custom-format legivel pelo pg_restore?
    param([Parameter(Mandatory)][string]$Arquivo)
    $pgRestore = Get-Pg18Tool 'pg_restore'
    & $pgRestore --list $Arquivo > $null 2>&1
    return ($LASTEXITCODE -eq 0)
}
