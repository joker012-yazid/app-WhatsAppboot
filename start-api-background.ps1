# Script to start API server in background (new window)

Write-Host ""
Write-Host "=== Starting API Server in Background ===" -ForegroundColor Cyan
Write-Host ""

# Find root directory
$scriptPath = $MyInvocation.MyCommand.Path
$rootDir = $null

if ($scriptPath) {
    $rootDir = Split-Path -Parent $scriptPath
} else {
    $currentDir = Get-Location
    $rootDir = $currentDir
    
    $maxDepth = 10
    $depth = 0
    while ($depth -lt $maxDepth) {
        if ((Test-Path (Join-Path $rootDir "apps\api")) -and (Test-Path (Join-Path $rootDir "apps\web"))) {
            break
        }
        $parent = Split-Path -Parent $rootDir
        if ($parent -eq $rootDir) {
            break
        }
        $rootDir = $parent
        $depth++
    }
}

if (-not $rootDir -or -not (Test-Path (Join-Path $rootDir "apps\api"))) {
    Write-Host "[ERROR] Tidak dapat menemukan root project directory" -ForegroundColor Red
    exit 1
}

$apiDir = Join-Path $rootDir "apps\api"

Write-Host "Starting API server in new window..." -ForegroundColor Yellow
Write-Host "API server akan running di: http://localhost:4000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Window baru akan terbuka untuk API server" -ForegroundColor Gray
Write-Host "Untuk stop server, tutup window tersebut atau tekan Ctrl+C di window tersebut" -ForegroundColor Gray
Write-Host ""

# Start in new PowerShell window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$apiDir'; Write-Host '=== API Server ===' -ForegroundColor Cyan; Write-Host 'Running di: http://localhost:4000' -ForegroundColor Green; Write-Host 'Tekan Ctrl+C untuk stop' -ForegroundColor Yellow; Write-Host ''; npm run dev"

Write-Host "[OK] API server sedang starting di window baru..." -ForegroundColor Green
Write-Host ""
Write-Host "Tunggu beberapa detik sampai server ready" -ForegroundColor Yellow
Write-Host "Check status dengan: .\check-services.ps1" -ForegroundColor Gray
Write-Host ""

