# PowerShell script to help install Docker Desktop on Windows
# Run this script as Administrator for best results

Write-Host "=== Docker Desktop Installation Helper ===" -ForegroundColor Cyan
Write-Host ""

# Check if already installed
$dockerPath = Get-Command docker -ErrorAction SilentlyContinue
if ($dockerPath) {
    Write-Host "✓ Docker sudah terinstall!" -ForegroundColor Green
    docker --version
    Write-Host ""
    Write-Host "Jalankan: docker compose up -d postgres redis" -ForegroundColor Yellow
    exit 0
}

Write-Host "Docker Desktop belum terinstall." -ForegroundColor Yellow
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "⚠ Untuk hasil terbaik, jalankan script ini sebagai Administrator" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Cara Install Docker Desktop:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Download Docker Desktop:" -ForegroundColor White
Write-Host "   https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Atau buka browser dan kunjungi:" -ForegroundColor White
Write-Host "   https://www.docker.com/products/docker-desktop" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Install Docker Desktop:" -ForegroundColor White
Write-Host "   - Double-click installer yang sudah didownload" -ForegroundColor Gray
Write-Host "   - Ikuti wizard installation" -ForegroundColor Gray
Write-Host "   - Centang 'Use WSL 2 instead of Hyper-V' jika diminta" -ForegroundColor Gray
Write-Host "   - Restart komputer setelah install selesai" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Setelah restart, buka Docker Desktop dari Start Menu" -ForegroundColor White
Write-Host "   - Tunggu sampai Docker Desktop fully started (icon di system tray)" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Setelah Docker Desktop running, jalankan:" -ForegroundColor White
Write-Host "   docker compose up -d postgres redis" -ForegroundColor Yellow
Write-Host ""

# Ask if user wants to open download page
$response = Read-Host "Buka halaman download Docker Desktop di browser? (Y/N)"
if ($response -eq 'Y' -or $response -eq 'y') {
    Start-Process "https://www.docker.com/products/docker-desktop"
    Write-Host ""
    Write-Host "✓ Browser dibuka. Setelah install selesai, jalankan script ini lagi untuk verifikasi." -ForegroundColor Green
}

