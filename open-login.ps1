# Script to open login page in browser

Write-Host ""
Write-Host "=== Opening Login Page ===" -ForegroundColor Cyan
Write-Host ""

$loginUrl = "http://localhost:3000/login"

# Check if web app is running
try {
    $null = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    Write-Host "[OK] Web app is running" -ForegroundColor Green
    Write-Host ""
    Write-Host "Opening login page in browser..." -ForegroundColor Yellow
    Start-Process $loginUrl
    Write-Host ""
    Write-Host "[OK] Browser opened!" -ForegroundColor Green
    Write-Host "URL: $loginUrl" -ForegroundColor Cyan
} catch {
    Write-Host "[ERROR] Web app tidak running di port 3000" -ForegroundColor Red
    Write-Host ""
    Write-Host "Langkah untuk start web app:" -ForegroundColor Yellow
    Write-Host "1. Buka terminal baru" -ForegroundColor White
    Write-Host "2. Jalankan:" -ForegroundColor White
    Write-Host "   cd apps/web" -ForegroundColor Gray
    Write-Host "   npm run dev" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Setelah web app running, jalankan script ini lagi:" -ForegroundColor White
    Write-Host "   .\open-login.ps1" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Atau buka browser manual dan ketik: $loginUrl" -ForegroundColor Cyan
}

Write-Host ""

