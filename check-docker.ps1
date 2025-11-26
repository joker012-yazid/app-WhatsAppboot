# Script to check Docker installation

Write-Host ""
Write-Host "=== Docker Installation Checker ===" -ForegroundColor Cyan
Write-Host ""

$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue

if ($dockerCmd) {
    Write-Host "[OK] Docker sudah terinstall!" -ForegroundColor Green
    docker --version
    Write-Host ""
    
    try {
        $null = docker info 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Docker Desktop sedang running" -ForegroundColor Green
            Write-Host ""
            Write-Host "Sekarang Anda bisa menjalankan:" -ForegroundColor Yellow
            Write-Host "  docker compose up -d postgres redis" -ForegroundColor White
        } else {
            Write-Host "[WARNING] Docker terinstall tapi belum running" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Langkah selanjutnya:" -ForegroundColor Yellow
            Write-Host "1. Buka Docker Desktop dari Start Menu" -ForegroundColor White
            Write-Host "2. Tunggu sampai icon muncul di system tray" -ForegroundColor White
            Write-Host "3. Setelah running, jalankan: docker compose up -d postgres redis" -ForegroundColor White
        }
    } catch {
        Write-Host "[WARNING] Docker terinstall tapi belum running" -ForegroundColor Yellow
        Write-Host "Buka Docker Desktop dari Start Menu" -ForegroundColor White
    }
} else {
    Write-Host "[ERROR] Docker belum terinstall" -ForegroundColor Red
    Write-Host ""
    Write-Host "=== CARA INSTALL DOCKER DESKTOP ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Langkah 1: Download Docker Desktop" -ForegroundColor Yellow
    Write-Host "  URL: https://www.docker.com/products/docker-desktop" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Langkah 2: Install" -ForegroundColor Yellow
    Write-Host "  - Double-click installer" -ForegroundColor Gray
    Write-Host "  - Ikuti wizard installation" -ForegroundColor Gray
    Write-Host "  - Centang Use WSL 2 jika diminta" -ForegroundColor Gray
    Write-Host "  - RESTART komputer setelah install" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Langkah 3: Start Docker Desktop" -ForegroundColor Yellow
    Write-Host "  - Buka dari Start Menu" -ForegroundColor Gray
    Write-Host "  - Tunggu sampai icon muncul di system tray" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Langkah 4: Verifikasi" -ForegroundColor Yellow
    Write-Host "  - Jalankan: .\check-docker.ps1" -ForegroundColor Gray
    Write-Host "  - Atau: docker --version" -ForegroundColor Gray
    Write-Host ""
    
    $response = Read-Host "Buka halaman download di browser? (Y/N)"
    if ($response -eq 'Y' -or $response -eq 'y') {
        Start-Process "https://www.docker.com/products/docker-desktop"
        Write-Host ""
        Write-Host "[OK] Browser dibuka. Setelah install dan restart," -ForegroundColor Green
        Write-Host "     jalankan script ini lagi untuk verifikasi." -ForegroundColor Green
    }
}

Write-Host ""
