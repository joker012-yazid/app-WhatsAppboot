# Script to start API server

Write-Host ""
Write-Host "=== Starting API Server ===" -ForegroundColor Cyan
Write-Host ""

# Get script directory (root of project)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$apiDir = "apps\api"

if (-not (Test-Path $apiDir)) {
    Write-Host "[ERROR] Directory $apiDir tidak ditemukan" -ForegroundColor Red
    Write-Host "Pastikan script ini berada di root project directory" -ForegroundColor Yellow
    Write-Host "Current directory: $(Get-Location)" -ForegroundColor Gray
    exit 1
}

Write-Host "Starting API server..." -ForegroundColor Yellow
Write-Host "API server akan running di: http://localhost:4000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Untuk stop server, tekan Ctrl+C" -ForegroundColor Gray
Write-Host ""

Set-Location $apiDir

# Start API server (this will block)
npm run dev

