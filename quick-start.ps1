# Quick Start Script - Start web app and open login page

Write-Host ""
Write-Host "=== Quick Start Web App ===" -ForegroundColor Cyan
Write-Host ""

# Find root directory (where quick-start.ps1 is located or search for apps/web)
$scriptPath = $MyInvocation.MyCommand.Path
$rootDir = $null

if ($scriptPath) {
    # Script is being executed directly, get its directory
    $rootDir = Split-Path -Parent $scriptPath
} else {
    # Fallback: try to find root directory by looking for apps/web
    $currentDir = Get-Location
    $rootDir = $currentDir
    
    # Go up directories until we find root (has apps/web)
    $maxDepth = 10
    $depth = 0
    while ($depth -lt $maxDepth) {
        if (Test-Path (Join-Path $rootDir "apps\web")) {
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

$webDir = Join-Path $rootDir "apps\web"

# Check if we found the right directory
if (-not (Test-Path $webDir)) {
    Write-Host "[ERROR] Directory apps/web tidak ditemukan" -ForegroundColor Red
    Write-Host "Pastikan Anda berada di dalam project directory" -ForegroundColor Yellow
    Write-Host "Current directory: $(Get-Location)" -ForegroundColor Gray
    Write-Host "Searched up to: $rootDir" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Cara menjalankan script:" -ForegroundColor Yellow
    Write-Host "  1. Pindah ke root directory: cd 'C:\Users\Jokeryazid\Documents\My projek\new whatsappbot\app-WhatsAppboot'" -ForegroundColor White
    Write-Host "  2. Jalankan: .\quick-start.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "Atau dari apps/web:" -ForegroundColor Yellow
    Write-Host "  cd apps\web" -ForegroundColor White
    Write-Host "  npm run dev" -ForegroundColor White
    exit 1
}

# Check if web app is already running
try {
    $null = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    Write-Host "[OK] Web app sudah running!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Opening login page..." -ForegroundColor Yellow
    Start-Process "http://localhost:3000/login"
    Write-Host "[OK] Browser opened!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Login dengan:" -ForegroundColor Cyan
    Write-Host "  Email: admin@example.com" -ForegroundColor White
    Write-Host "  Password: admin123" -ForegroundColor White
    exit 0
} catch {
    Write-Host "[INFO] Web app belum running" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting web app..." -ForegroundColor Yellow
Write-Host ""

# Change to web directory and start
Set-Location $webDir

Write-Host "Running: npm run dev" -ForegroundColor Cyan
Write-Host "Web app akan running di: http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "Tunggu beberapa detik sampai web app ready..." -ForegroundColor Yellow
Write-Host "Kemudian buka browser dan akses: http://localhost:3000/login" -ForegroundColor Cyan
Write-Host ""
Write-Host "Untuk stop web app, tekan Ctrl+C" -ForegroundColor Gray
Write-Host ""

# Start web app (this will block)
npm run dev

