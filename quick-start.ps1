# Quick Start Script - Start web app and open login page

Write-Host ""
Write-Host "=== Quick Start Web App ===" -ForegroundColor Cyan
Write-Host ""

$rootDir = Get-Location
$webDir = Join-Path $rootDir "apps\web"

# Check if we're in the right directory
if (-not (Test-Path $webDir)) {
    Write-Host "[ERROR] Directory apps/web tidak ditemukan" -ForegroundColor Red
    Write-Host "Pastikan Anda berada di root project directory" -ForegroundColor Yellow
    Write-Host "Current directory: $rootDir" -ForegroundColor Gray
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

