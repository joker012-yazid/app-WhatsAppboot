# Script to fix directory and run dev:monorepo

Write-Host ""
Write-Host "=== Fixing Directory and Starting Monorepo ===" -ForegroundColor Cyan
Write-Host ""

# Get root directory
$rootDir = "C:\Users\Jokeryazid\Documents\My projek\new whatsappbot\app-WhatsAppboot"

# Check if root directory exists
if (-not (Test-Path $rootDir)) {
    Write-Host "[ERROR] Root directory tidak ditemukan: $rootDir" -ForegroundColor Red
    exit 1
}

# Change to root directory
Write-Host "Changing to root directory..." -ForegroundColor Yellow
Set-Location $rootDir
Write-Host "Current directory: $(Get-Location)" -ForegroundColor Green

# Verify package.json exists
if (-not (Test-Path "package.json")) {
    Write-Host "[ERROR] package.json tidak ditemukan di root directory" -ForegroundColor Red
    exit 1
}

# Check if dev:monorepo script exists
$packageJson = Get-Content "package.json" | ConvertFrom-Json
if (-not $packageJson.scripts.'dev:monorepo') {
    Write-Host "[ERROR] Script 'dev:monorepo' tidak ditemukan di package.json" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Directory sudah benar!" -ForegroundColor Green
Write-Host "[OK] Script 'dev:monorepo' ditemukan!" -ForegroundColor Green
Write-Host ""
Write-Host "Starting monorepo (API + Web)..." -ForegroundColor Cyan
Write-Host ""
Write-Host "API Server: http://localhost:4000" -ForegroundColor Yellow
Write-Host "Web App: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Untuk stop, tekan Ctrl+C" -ForegroundColor Gray
Write-Host ""

# Start monorepo
npm run dev:monorepo

