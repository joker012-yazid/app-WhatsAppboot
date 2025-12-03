# Wrapper script to start API server from apps/api directory
# This script can be run from anywhere and will start the API server

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  STARTING API SERVER" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if port 4000 is already in use
$portCheck = netstat -ano | findstr ":4000"
if ($portCheck) {
    Write-Host "[WARNING] Port 4000 sudah digunakan!" -ForegroundColor Yellow
    Write-Host "Menghentikan proses yang menggunakan port 4000..." -ForegroundColor Yellow
    
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

# Determine current directory
$currentDir = Get-Location

# Check if we're already in apps/api directory
if (Test-Path "package.json") {
    try {
        $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
        if ($packageJson.name -eq "@whatsappbot/api") {
            # We're already in apps/api directory
            Write-Host "Starting API server from current directory..." -ForegroundColor Yellow
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
            npm run dev
            exit 0
        }
    } catch {
        # Not a valid package.json, continue searching
    }
}

# Try to find apps/api directory
$apiDir = $null

# Check if we're in root directory
if (Test-Path "apps\api\package.json") {
    $apiDir = Join-Path $currentDir "apps\api"
} else {
    # Try to find root directory by going up
    $searchDir = $currentDir
    $maxDepth = 5
    $depth = 0
    
    while ($depth -lt $maxDepth) {
        $testPath = Join-Path $searchDir "apps\api\package.json"
        if (Test-Path $testPath) {
            $apiDir = Join-Path $searchDir "apps\api"
            break
        }
        $parent = Split-Path -Parent $searchDir
        if ($parent -eq $searchDir) {
            break
        }
        $searchDir = $parent
        $depth++
    }
}

if (-not $apiDir -or -not (Test-Path (Join-Path $apiDir "package.json"))) {
    Write-Host "[ERROR] Cannot find apps/api directory" -ForegroundColor Red
    Write-Host "Current directory: $currentDir" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please navigate to the project root or apps/api directory:" -ForegroundColor Yellow
    Write-Host "  cd 'C:\Users\Jokeryazid\Documents\My projek\new whatsappbot\app-WhatsAppboot'" -ForegroundColor Green
    Write-Host "  .\START-SERVER.ps1" -ForegroundColor Green
    Write-Host ""
    Write-Host "Or from apps/api:" -ForegroundColor Yellow
    Write-Host "  npm run dev" -ForegroundColor Green
    exit 1
}

# Change to API directory and start server
Set-Location $apiDir
Write-Host "Starting API server from: $apiDir" -ForegroundColor Yellow
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

npm run dev

