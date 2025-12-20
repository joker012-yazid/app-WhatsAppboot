# Script to start API server

Write-Host ""
Write-Host "=== Starting API Server ===" -ForegroundColor Cyan
Write-Host ""

# Find root directory
$scriptPath = $MyInvocation.MyCommand.Path
$rootDir = $null

if ($scriptPath) {
    # Script is being executed directly, get its directory
    $rootDir = Split-Path -Parent $scriptPath
} else {
    # Fallback: try to find root directory by looking for apps/api and apps/web
    $currentDir = Get-Location
    $rootDir = $currentDir
    
    # Go up directories until we find root (has apps/api and apps/web)
    $maxDepth = 10
    $depth = 0
    while ($depth -lt $maxDepth) {
        if ((Test-Path (Join-Path $rootDir "apps\api")) -and (Test-Path (Join-Path $rootDir "apps\web"))) {
            break
        }
        $parent = Split-Path -Parent $rootDir
        if ($parent -eq $rootDir) {
            # Reached root of filesystem
            break
        }
        $rootDir = $parent
        $depth++
    }
}

# Verify we found the root directory
if (-not $rootDir -or -not (Test-Path (Join-Path $rootDir "apps\api"))) {
    Write-Host "[ERROR] Tidak dapat menemukan root project directory" -ForegroundColor Red
    Write-Host "Pastikan Anda berada di dalam project directory" -ForegroundColor Yellow
    Write-Host "Current directory: $(Get-Location)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Cara menjalankan script:" -ForegroundColor Yellow
    Write-Host "  1. Pindah ke root directory: cd 'C:\Users\Jokeryazid\Documents\My projek\new whatsappbot\app-WhatsAppboot'" -ForegroundColor White
    Write-Host "  2. Jalankan: .\start-api.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "Atau jalankan langsung dengan npm:" -ForegroundColor Yellow
    Write-Host "  cd apps\api" -ForegroundColor White
    Write-Host "  npm run dev" -ForegroundColor White
    exit 1
}

Set-Location $rootDir
$apiDir = "apps\api"

if (-not (Test-Path $apiDir)) {
    Write-Host "[ERROR] Directory $apiDir tidak ditemukan" -ForegroundColor Red
    Write-Host "Root directory: $rootDir" -ForegroundColor Gray
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

