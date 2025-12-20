# Script to start web app and open login page

Write-Host ""
Write-Host "=== Starting Web App ===" -ForegroundColor Cyan
Write-Host ""

$webDir = "apps\web"

if (-not (Test-Path $webDir)) {
    Write-Host "[ERROR] Directory $webDir tidak ditemukan" -ForegroundColor Red
    Write-Host "Pastikan Anda berada di root project directory" -ForegroundColor Yellow
    exit 1
}

Write-Host "Starting web app di background..." -ForegroundColor Yellow
Write-Host "Web app akan running di: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""

# Start web app in background
$job = Start-Job -ScriptBlock {
    Set-Location $using:webDir
    npm run dev
}

Write-Host "[OK] Web app sedang starting..." -ForegroundColor Green
Write-Host ""
Write-Host "Tunggu beberapa detik, kemudian:" -ForegroundColor Yellow
Write-Host "1. Buka browser" -ForegroundColor White
Write-Host "2. Akses: http://localhost:3000/login" -ForegroundColor Cyan
Write-Host ""
Write-Host "Atau jalankan: .\open-login.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "Untuk stop web app, jalankan: Stop-Job -Id $($job.Id)" -ForegroundColor Gray
Write-Host ""

