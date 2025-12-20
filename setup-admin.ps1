# Script to setup admin user and seed database

Write-Host ""
Write-Host "=== Setting Up Admin User ===" -ForegroundColor Cyan
Write-Host ""

$apiDir = "apps\api"

if (-not (Test-Path $apiDir)) {
    Write-Host "[ERROR] Directory $apiDir tidak ditemukan" -ForegroundColor Red
    Write-Host "Pastikan Anda berada di root project directory" -ForegroundColor Yellow
    exit 1
}

Write-Host "Menjalankan seed script..." -ForegroundColor Yellow
Write-Host ""

Set-Location $apiDir

try {
    npm run seed
    Write-Host ""
    Write-Host "[OK] Admin user berhasil dibuat!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Login credentials:" -ForegroundColor Cyan
    Write-Host "  Email: admin@example.com" -ForegroundColor White
    Write-Host "  Password: admin123" -ForegroundColor White
    Write-Host ""
    Write-Host "Silakan login di: http://localhost:3000/login" -ForegroundColor Yellow
} catch {
    Write-Host ""
    Write-Host "[ERROR] Gagal membuat admin user" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Pastikan:" -ForegroundColor Yellow
    Write-Host "  1. Database sudah running (Docker)" -ForegroundColor White
    Write-Host "  2. Prisma migration sudah dijalankan" -ForegroundColor White
    Write-Host "  3. Environment variables sudah di-set" -ForegroundColor White
}

Set-Location ..

Write-Host ""

