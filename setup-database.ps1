# PowerShell script to setup and start PostgreSQL and Redis using Docker
# Make sure Docker Desktop is installed and running

Write-Host "Checking Docker installation..." -ForegroundColor Cyan

# Check if Docker is available
try {
    $dockerVersion = docker --version 2>&1
    Write-Host "Docker found: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "Docker not found. Please install Docker Desktop from https://www.docker.com/products/docker-desktop" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: You can install PostgreSQL and Redis manually:" -ForegroundColor Yellow
    Write-Host "  - PostgreSQL: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    Write-Host "  - Redis: https://github.com/microsoftarchive/redis/releases" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Checking Docker daemon status..." -ForegroundColor Cyan

# Check if Docker daemon is running
$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Docker Desktop is not running!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please start Docker Desktop:" -ForegroundColor Yellow
    Write-Host "  1. Open Docker Desktop application" -ForegroundColor White
    Write-Host "  2. Wait for it to fully start (whale icon in system tray)" -ForegroundColor White
    Write-Host "  3. Run this script again" -ForegroundColor White
    Write-Host ""
    Write-Host "Or start Docker Desktop from command line:" -ForegroundColor Yellow
    Write-Host "  Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Waiting for Docker Desktop to start..." -ForegroundColor Yellow
    Write-Host "Checking Docker daemon status every 3 seconds (max 30 attempts)..." -ForegroundColor Gray
    
    $maxWaitAttempts = 30
    $waitAttempt = 0
    $dockerReady = $false
    
    while ($waitAttempt -lt $maxWaitAttempts -and -not $dockerReady) {
        Start-Sleep -Seconds 3
        $waitAttempt++
        $checkInfo = docker info 2>&1
        if ($LASTEXITCODE -eq 0) {
            $dockerReady = $true
            Write-Host "Docker Desktop is now running!" -ForegroundColor Green
        } else {
            Write-Host "." -NoNewline
        }
    }
    
    if (-not $dockerReady) {
        Write-Host ""
        Write-Host ""
        Write-Host "Docker Desktop did not start in time. Please start it manually and try again." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Docker daemon is running" -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting PostgreSQL and Redis containers..." -ForegroundColor Cyan

# Start PostgreSQL and Redis
docker compose up -d postgres redis

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "PostgreSQL and Redis started successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Waiting for PostgreSQL to be ready..." -ForegroundColor Cyan
    Write-Host "This may take up to 2 minutes on first run..." -ForegroundColor Gray
    
    # Wait for PostgreSQL to be ready using docker compose exec (more reliable)
    $maxAttempts = 60
    $attempt = 0
    $ready = $false
    
    while ($attempt -lt $maxAttempts -and -not $ready) {
        Start-Sleep -Seconds 2
        $attempt++
        
        # Use docker compose exec - works with service name, not container name
        $result = docker compose exec -T postgres pg_isready -U postgres 2>&1
        $exitCode = $LASTEXITCODE
        
        if ($exitCode -eq 0) {
            # Check if result contains "accepting connections"
            if ($result -match "accepting connections" -or $result -match "accepting") {
                $ready = $true
                Write-Host ""
                Write-Host "PostgreSQL is ready!" -ForegroundColor Green
                break
            }
        }
        
        # Show progress every 10 attempts
        if ($attempt % 10 -eq 0) {
            Write-Host ""
            Write-Host "Still waiting... ($attempt/$maxAttempts attempts)" -ForegroundColor Gray
        } else {
            Write-Host "." -NoNewline
        }
    }
    
    if ($ready) {
        Write-Host ""
        Write-Host ""
        Write-Host "Database setup complete!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "  1. Run migrations:" -ForegroundColor White
        Write-Host "     npm run prisma:migrate -w apps/api" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  2. Generate Prisma client (if needed):" -ForegroundColor White
        Write-Host "     npm run prisma:generate -w apps/api" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  3. Seed admin user:" -ForegroundColor White
        Write-Host "     npm run seed -w apps/api" -ForegroundColor Cyan
        Write-Host "     Or: .\setup-admin.ps1" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host ""
        Write-Host "PostgreSQL did not become ready in time." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Checking container status..." -ForegroundColor Cyan
        docker compose ps
        Write-Host ""
        Write-Host "Checking PostgreSQL logs..." -ForegroundColor Cyan
        docker compose logs --tail=20 postgres
        Write-Host ""
        Write-Host "Troubleshooting:" -ForegroundColor Yellow
        Write-Host "  - Check if container is running: docker compose ps" -ForegroundColor White
        Write-Host "  - Check logs: docker compose logs postgres" -ForegroundColor White
        Write-Host "  - Try manual check: docker compose exec postgres pg_isready -U postgres" -ForegroundColor White
        Write-Host ""
        Write-Host "Note: First-time startup can take longer. You can continue anyway and check later." -ForegroundColor Gray
    }
} else {
    Write-Host ""
    Write-Host "Failed to start containers. Check Docker Desktop is running." -ForegroundColor Red
    exit 1
}

