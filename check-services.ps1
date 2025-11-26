# Script to check all services status

Write-Host ""
Write-Host "=== Checking Services Status ===" -ForegroundColor Cyan
Write-Host ""

# Check Docker
Write-Host "1. Checking Docker..." -ForegroundColor Yellow
$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if ($dockerCmd) {
    try {
        $null = docker info 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   [OK] Docker is running" -ForegroundColor Green
        } else {
            Write-Host "   [WARNING] Docker terinstall tapi belum running" -ForegroundColor Yellow
            Write-Host "   Jalankan: docker compose up -d postgres redis" -ForegroundColor Gray
        }
    } catch {
        Write-Host "   [WARNING] Docker belum running" -ForegroundColor Yellow
    }
} else {
    Write-Host "   [ERROR] Docker belum terinstall" -ForegroundColor Red
    Write-Host "   Install Docker Desktop terlebih dahulu" -ForegroundColor Gray
}

Write-Host ""

# Check API Server
Write-Host "2. Checking API Server (port 4000)..." -ForegroundColor Yellow
try {
    $apiCheck = Invoke-WebRequest -Uri "http://localhost:4000/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    Write-Host "   [OK] API server is running" -ForegroundColor Green
} catch {
    Write-Host "   [ERROR] API server tidak running" -ForegroundColor Red
    Write-Host "   Jalankan: .\start-api.ps1" -ForegroundColor Gray
    Write-Host "   Atau: cd apps/api && npm run dev" -ForegroundColor Gray
}

Write-Host ""

# Check Web App
Write-Host "3. Checking Web App (port 3000)..." -ForegroundColor Yellow
try {
    $webCheck = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    Write-Host "   [OK] Web app is running" -ForegroundColor Green
} catch {
    Write-Host "   [ERROR] Web app tidak running" -ForegroundColor Red
    Write-Host "   Jalankan: .\quick-start.ps1" -ForegroundColor Gray
    Write-Host "   Atau: cd apps/web && npm run dev" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Untuk start semua services:" -ForegroundColor Yellow
Write-Host "  1. Start database: docker compose up -d postgres redis" -ForegroundColor White
Write-Host "  2. Start API: .\start-api.ps1" -ForegroundColor White
Write-Host "  3. Start Web: .\quick-start.ps1" -ForegroundColor White
Write-Host ""

