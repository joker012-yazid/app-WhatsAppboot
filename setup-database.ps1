# PowerShell script to setup and start PostgreSQL and Redis using Docker
# Make sure Docker Desktop is installed and running

Write-Host "Checking Docker installation..." -ForegroundColor Cyan

# Check if Docker is available
try {
    $dockerVersion = docker --version 2>&1
    Write-Host "✓ Docker found: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker not found. Please install Docker Desktop from https://www.docker.com/products/docker-desktop" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: You can install PostgreSQL and Redis manually:" -ForegroundColor Yellow
    Write-Host "  - PostgreSQL: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    Write-Host "  - Redis: https://github.com/microsoftarchive/redis/releases" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Starting PostgreSQL and Redis containers..." -ForegroundColor Cyan

# Start PostgreSQL and Redis
docker compose up -d postgres redis

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ PostgreSQL and Redis started successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Waiting for PostgreSQL to be ready..." -ForegroundColor Cyan
    
    # Wait for PostgreSQL to be ready
    $maxAttempts = 30
    $attempt = 0
    $ready = $false
    
    while ($attempt -lt $maxAttempts -and -not $ready) {
        Start-Sleep -Seconds 2
        $attempt++
        try {
            $result = docker exec whatsappbot-postgres-1 pg_isready -U postgres 2>&1
            if ($result -match "accepting connections") {
                $ready = $true
                Write-Host "✓ PostgreSQL is ready!" -ForegroundColor Green
            } else {
                Write-Host "." -NoNewline
            }
        } catch {
            Write-Host "." -NoNewline
        }
    }
    
    if ($ready) {
        Write-Host ""
        Write-Host ""
        Write-Host "Database setup complete! You can now run:" -ForegroundColor Green
        Write-Host "  cd apps/api" -ForegroundColor Yellow
        Write-Host "  npm run prisma:migrate" -ForegroundColor Yellow
        Write-Host "  npm run prisma:generate" -ForegroundColor Yellow
    } else {
        Write-Host ""
        Write-Host "⚠ PostgreSQL is taking longer than expected. Please check manually:" -ForegroundColor Yellow
        Write-Host "  docker compose ps" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "✗ Failed to start containers. Check Docker Desktop is running." -ForegroundColor Red
    exit 1
}

