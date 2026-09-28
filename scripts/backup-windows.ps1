<#
.SYNOPSIS
    ByteForge Omni-Commerce - Windows Automated PostgreSQL Backup Script
.DESCRIPTION
    Safely dumps the PostgreSQL database to E:\ByteForge-Backups.
    Designed for Windows Task Scheduler execution.
    Features:
    - Verifies destination directory exists (or creates it).
    - Checks pg_dump availability.
    - Creates timestamped, compressed .sql.gz or .sql dump.
    - Validates backup file size (>0 bytes) before marking successful.
    - Maintains an execution log in E:\ByteForge-Backups\backup.log.
    - Safe archival prerequisite: Records backup timestamp for 20-day order retention jobs.
#>

[CmdletBinding()]
param (
    [string]$BackupDir = "E:\ByteForge-Backups",
    [string]$DbHost = $env:DB_HOST,
    [string]$DbPort = $(if ($env:DB_PORT) { $env:DB_PORT } else { "5432" }),
    [string]$DbName = $(if ($env:DB_NAME) { $env:DB_NAME } else { "byteforge_omnicommerce" }),
    [string]$DbUser = $(if ($env:DB_USER) { $env:DB_USER } else { "postgres" })
)

$ErrorActionPreference = "Stop"

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$LogFile = Join-Path $BackupDir "backup.log"

function Write-BackupLog {
    param([string]$Message, [string]$Level = "INFO")
    $LogEntry = "[{0}] [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Level, $Message
    Write-Host $LogEntry
    if (Test-Path $BackupDir) {
        Add-Content -Path $LogFile -Value $LogEntry
    }
}

try {
    # 1. Ensure target directory exists
    if (-not (Test-Path $BackupDir)) {
        New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
        Write-BackupLog "Created backup directory: $BackupDir"
    }

    Write-BackupLog "Starting automated backup for database '$DbName' on $DbHost:$DbPort..."

    # 2. Check for pg_dump
    $PgDumpCmd = Get-Command "pg_dump" -ErrorAction SilentlyContinue
    if (-not $PgDumpCmd) {
        # Check standard Postgres paths on Windows if not in PATH
        $StdPaths = @(
            "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe",
            "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
            "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe"
        )
        foreach ($p in $StdPaths) {
            if (Test-Path $p) {
                $PgDumpCmd = $p
                break
            }
        }
    }

    if (-not $PgDumpCmd) {
        throw "pg_dump executable not found in PATH or standard Program Files locations. Please install PostgreSQL client tools or update PATH."
    }

    $OutputFile = Join-Path $BackupDir ("byteforge_backup_{0}.sql" -f $Timestamp)

    # 3. Execute pg_dump
    Write-BackupLog "Executing pg_dump using: $($PgDumpCmd.Source ?? $PgDumpCmd)"
    & $PgDumpCmd -h $DbHost -p $DbPort -U $DbUser -d $DbName -F c -b -v -f $OutputFile

    # 4. Verify file was created and is non-empty
    if (-not (Test-Path $OutputFile)) {
        throw "Backup output file was not created: $OutputFile"
    }

    $FileSize = (Get-Item $OutputFile).Length
    if ($FileSize -le 0) {
        Remove-Item $OutputFile -Force
        throw "Backup file is empty (0 bytes). Backup aborted and corrupt file deleted."
    }

    $SizeMB = [math]::Round($FileSize / 1MB, 2)
    Write-BackupLog "SUCCESS: Database backup completed successfully ($SizeMB MB). File: $OutputFile" "SUCCESS"

    # Write marker file with last verified backup timestamp for the retention policy
    $MarkerFile = Join-Path $BackupDir "last_verified_backup.txt"
    (Get-Date -Format "o") | Set-Content -Path $MarkerFile -Force

    exit 0
}
catch {
    Write-BackupLog "FAILED: $($_.Exception.Message)" "ERROR"
    exit 1
}
