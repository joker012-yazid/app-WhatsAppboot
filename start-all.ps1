# Script to start both API and Web servers

Write-Host ""
Write-Host "=== Starting All Services ===" -ForegroundColor Cyan
Write-Host ""

$rootDir = Get-Location
$apiDir = Join-Path $rootDir "apps\api"
$webDir = Join-Path $rootDir "apps\web"

# Check directories
if (-not (Test-Path $apiDir)) {
    Write-Host "[ERROR] Directory apps/api tidak ditemukan" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $webDir)) {
    Write-Host "[ERROR] Directory apps/web tidak ditemukan" -ForegroundColor Red
    exit 1
}

Write-Host "Starting services..." -ForegroundColor Yellow
Write-Host ""
Write-Host "1. API Server (port 4000)" -ForegroundColor Cyan
Write-Host "2. Web App (port 3000)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Catatan: Script ini akan start API server di foreground" -ForegroundColor Yellow
Write-Host "Untuk start web app, buka terminal baru dan jalankan:" -ForegroundColor Yellow
Write-Host "  cd apps/web" -ForegroundColor Gray
Write-Host "  npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "Atau gunakan: .\quick-start.ps1 untuk start web app" -ForegroundColor Gray
Write-Host ""

# Start API server
Set-Location $apiDir
Write-Host "Starting API server..." -ForegroundColor Green
npm run dev

