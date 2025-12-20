# Script to start both API and Web servers using monorepo script

Write-Host ""
Write-Host "=== Starting Monorepo (API + Web) ===" -ForegroundColor Cyan
Write-Host ""

$rootDir = Get-Location

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "[ERROR] package.json tidak ditemukan" -ForegroundColor Red
    Write-Host "Pastikan Anda berada di root project directory" -ForegroundColor Yellow
    Write-Host "Current directory: $rootDir" -ForegroundColor Gray
    exit 1
}

# Check if dev:monorepo script exists
$packageJson = Get-Content "package.json" | ConvertFrom-Json
if (-not $packageJson.scripts.'dev:monorepo') {
    Write-Host "[ERROR] Script 'dev:monorepo' tidak ditemukan di package.json" -ForegroundColor Red
    exit 1
}

Write-Host "Starting both API and Web servers..." -ForegroundColor Yellow
Write-Host ""
Write-Host "API Server akan running di: http://localhost:4000" -ForegroundColor Cyan
Write-Host "Web App akan running di: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Untuk stop, tekan Ctrl+C" -ForegroundColor Gray
Write-Host ""

# Start monorepo
npm run dev:monorepo

