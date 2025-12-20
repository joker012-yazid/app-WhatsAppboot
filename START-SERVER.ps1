# Simple script to start API server - USER FRIENDLY VERSION

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  STARTING API SERVER" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if port 4000 is already in use
$portCheck = netstat -ano | findstr ":4000"
if ($portCheck) {
    Write-Host "[WARNING] Port 4000 sudah digunakan!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Menghentikan proses yang menggunakan port 4000..." -ForegroundColor Yellow
    
    # Extract PID and kill
    $pids = @()
    foreach ($line in $portCheck) {
        if ($line -match '\s+(\d+)$') {
            $pid = $matches[1]
            if ($pid -notin $pids) {
                $pids += $pid
            }
        }
    }
    
    foreach ($pid in $pids) {
        try {
            taskkill /PID $pid /F 2>&1 | Out-Null
            Write-Host "[OK] Proses $pid dihentikan" -ForegroundColor Green
        } catch {
            Write-Host "[WARNING] Tidak bisa menghentikan proses $pid" -ForegroundColor Yellow
        }
    }
    
    Start-Sleep -Seconds 1
    Write-Host ""
}

# Find root directory
$scriptPath = $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptPath

# Verify we're in the right place
if (-not (Test-Path (Join-Path $rootDir "apps\api"))) {
    Write-Host "[ERROR] Script harus dijalankan dari root project directory" -ForegroundColor Red
    Write-Host "Current: $rootDir" -ForegroundColor Yellow
    exit 1
}

$apiDir = Join-Path $rootDir "apps\api"

Write-Host "Starting API server..." -ForegroundColor Yellow
Write-Host "Server akan running di: http://localhost:4000" -ForegroundColor Cyan
Write-Host ""
Write-Host "PENTING:" -ForegroundColor Yellow
Write-Host "  - Biarkan terminal ini TERBUKA" -ForegroundColor White
Write-Host "  - JANGAN tekan Ctrl+C kecuali ingin STOP server" -ForegroundColor White
Write-Host "  - Server akan terus running sampai Anda tekan Ctrl+C" -ForegroundColor White
Write-Host ""
Write-Host "Untuk STOP server, tekan: Ctrl+C" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Change to API directory and start
Set-Location $apiDir
npm run dev

