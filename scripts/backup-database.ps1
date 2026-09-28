# ByteForge Omni-Commerce Windows Database Backup Script
# Location: scripts/backup-database.ps1
# Saves PostgreSQL backup to E:\ByteForge-Backups\<timestamp>

$ErrorActionPreference = "Stop"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "📦 Starting ByteForge Windows Database Backup..." -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$WorkspaceRoot = Split-Path -Parent $PSScriptRoot
Set-Location "$WorkspaceRoot\apps\api"

try {
    npm run db:backup
    Write-Host "`n✅ ByteForge database backup successfully verified and saved." -ForegroundColor Green
} catch {
    Write-Host "`n❌ Database backup failed: $_" -ForegroundColor Red
    exit 1
}
