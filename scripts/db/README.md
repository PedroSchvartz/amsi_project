# Backup e restore do banco de produção

Produção = **Railway** (PostgreSQL **18.x**). Estes dois scripts são o **único** jeito
autorizado de mexer no banco de produção.

> **Política:** nada muda no banco de produção a não ser por meio destes scripts,
> **testados e aprovados antes no banco local**. Nada de `psql`/pgAdmin ad-hoc na produção.

## Pré-requisitos (uma vez)

1. **Railway CLI** logado e linkado na produção (rodar na raiz do repo):
   ```powershell
   railway link --project AMSI_Project   # e selecionar o environment 'production'
   railway status                        # deve mostrar Project: AMSI_Project / Environment: production
   ```
2. **Cliente PostgreSQL 18** (o PG17 local não serve — produção é 18.x). Os binários ficam
   **fora do repo** em `C:\Codigos\AMSI_backups\pgsql18\bin` (pg_dump.exe, pg_restore.exe +
   DLLs). Se não existirem, baixe o ZIP oficial EDB `postgresql-18.x-windows-x64-binaries`,
   extraia a pasta `pgsql\bin` para lá — ou aponte `AMSI_PG18_BIN` para onde estiver.

Variáveis de ambiente opcionais:
- `AMSI_BACKUP_DIR` — pasta dos backups (padrão `C:\Codigos\AMSI_backups`).
- `AMSI_PG18_BIN` — pasta do cliente PG18 (padrão `C:\Codigos\AMSI_backups\pgsql18\bin`).

## `baixar_backup_prod.ps1` — baixa backup da produção

```powershell
.\baixar_backup_prod.ps1
```

Gera `amsi_prod_<AAAAMMDD>.dump` na pasta de backups. Rodou de novo no mesmo dia? Não
sobrescreve: vira `amsi_prod_<AAAAMMDD>_1.dump`, `_2.dump`, … É **somente-leitura**: não
altera a produção.

## `subir_backup_prod.ps1` — sobe um dump selecionado para a produção

**Sempre** faz um backup de segurança da produção **antes** de restaurar (e aborta se esse
backup falhar). O restore usa `--clean --if-exists`: a produção passa a refletir o dump.

```powershell
# 1) PRIMEIRO valide no banco LOCAL (não toca na produção, não faz backup de prod):
.\subir_backup_prod.ps1 -Dump C:\Codigos\AMSI_backups\estado_novo.dump `
    -DatabaseUrl 'postgresql://postgres:SENHA@localhost:5432/ANSI_Project'

# 2) Só depois de aprovado, suba para a PRODUÇÃO (pede confirmação digitando o nome do projeto):
.\subir_backup_prod.ps1 -Dump C:\Codigos\AMSI_backups\estado_novo.dump
```

O backup de segurança sai como `amsi_prod_pre-restore_<AAAAMMDD>.dump` (com o mesmo sufixo
crescente anti-sobrescrita). Em caso de problema, restaure-o para voltar ao estado anterior.

`-Force` pula a confirmação (necessário em execução não-interativa; use com cuidado).

## Segurança

- A `DATABASE_URL` da produção **nunca** é impressa nem gravada: só existe no processo-filho
  que o `railway run` injeta.
- Backups ficam **fora do repo** (`C:\Codigos\AMSI_backups`) — dado de produção não entra no
  git. `*.dump` está no `.gitignore` por garantia.
