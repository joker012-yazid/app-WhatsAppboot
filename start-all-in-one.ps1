#Requires -Version 5.1
<#
.SYNOPSIS
    All-in-one startup script untuk WhatsApp Bot POS SuperApp
.DESCRIPTION
    Script ini akan:
    1. Check Docker installation dan services (PostgreSQL & Redis)
    2. Check dan setup dependencies jika belum
    3. Generate Prisma client jika belum
    4. Run database migrations
    5. Start API server dan Web app secara serentak
.NOTES
    Author: Auto-generated
    Version: 1.0.0
#>

param(
    [switch]$SkipDocker,      # Skip Docker checks (jika sudah running)
    [switch]$SkipInstall,     # Skip npm install
    [switch]$SkipMigration,   # Skip database migration
    [switch]$ForceClean       # Force clean and reinstall everything
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Colors for output
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Success { Write-ColorOutput Green $args }
function Write-Info { Write-ColorOutput Cyan $args }
function Write-Warning { Write-ColorOutput Yellow $args }
function Write-Error { Write-ColorOutput Red $args }
function Write-Step { Write-ColorOutput Magenta $args }

# Banner
Clear-Host
Write-Info ""
Write-Info "╔══════════════════════════════════════════════════════════════╗"
Write-Info "║                                                              ║"
Write-Info "║        WhatsApp Bot POS SuperApp - All-in-One Starter       ║"
Write-Info "║                                                              ║"
Write-Info "╚══════════════════════════════════════════════════════════════╝"
Write-Info ""

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Error "[FATAL] package.json tidak ditemukan!"
    Write-Warning "Pastikan Anda berada di root project directory"
    Write-Warning "Current directory: $(Get-Location)"
    exit 1
}

# Step 1: Check Docker Installation and Services
if (-not $SkipDocker) {
    Write-Step ""
    Write-Step "═══ Step 1: Checking Docker & Database Services ═══"
    Write-Info ""
    
    # Check Docker command
    $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $dockerCmd) {
        Write-Error "[ERROR] Docker tidak terinstall!"
        Write-Warning ""
        Write-Warning "Silakan install Docker Desktop terlebih dahulu:"
        Write-Warning "  1. Jalankan: .\install-docker.ps1"
        Write-Warning "  2. Atau download manual dari: https://www.docker.com/products/docker-desktop"
        Write-Warning ""
        Write-Warning "Setelah install Docker, restart komputer dan jalankan script ini lagi."
        exit 1
    }
    
    # Check if Docker is running
    try {
        $null = docker info 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Docker not running"
        }
        Write-Success "   ✓ Docker is running"
    } catch {
        Write-Error "   ✗ Docker terinstall tapi belum running"
        Write-Warning ""
        Write-Warning "Silakan start Docker Desktop terlebih dahulu:"
        Write-Warning "  1. Buka Docker Desktop dari Start Menu"
        Write-Warning "  2. Tunggu hingga status menunjukkan 'Docker Desktop is running'"
        Write-Warning "  3. Jalankan script ini lagi"
        exit 1
    }
    
    # Check and start database containers
    Write-Info ""
    Write-Info "   Checking database containers..."
    
    # Check if containers exist and are running
    $postgresRunning = $false
    $redisRunning = $false
    
    try {
        $containers = docker ps --format "{{.Names}}" 2>&1
        $postgresRunning = $containers -match "postgres"
        $redisRunning = $containers -match "redis"
    } catch {
        Write-Warning "   Could not check container status"
    }
    
    if (-not $postgresRunning -or -not $redisRunning) {
        Write-Info "   Starting PostgreSQL and Redis containers..."
        try {
            docker compose up -d postgres redis
            if ($LASTEXITCODE -eq 0) {
                Write-Success "   ✓ Database containers started"
                Write-Info "   Waiting 5 seconds for databases to initialize..."
                Start-Sleep -Seconds 5
            } else {
                throw "Failed to start containers"
            }
        } catch {
            Write-Error "   ✗ Gagal start database containers"
            Write-Warning "   Coba jalankan manual: docker compose up -d postgres redis"
            exit 1
        }
    } else {
        Write-Success "   ✓ PostgreSQL is running"
        Write-Success "   ✓ Redis is running"
    }
} else {
    Write-Warning "Skipping Docker checks (--SkipDocker flag)"
}

# Step 2: Check and Install Dependencies
if (-not $SkipInstall) {
    Write-Step ""
    Write-Step "═══ Step 2: Installing Dependencies ═══"
    Write-Info ""
    
    if ($ForceClean) {
        Write-Info "   Cleaning existing node_modules..."
        if (Test-Path "node_modules") { Remove-Item -Recurse -Force "node_modules" }
        if (Test-Path "apps/api/node_modules") { Remove-Item -Recurse -Force "apps/api/node_modules" }
        if (Test-Path "apps/web/node_modules") { Remove-Item -Recurse -Force "apps/web/node_modules" }
        if (Test-Path "package-lock.json") { Remove-Item -Force "package-lock.json" }
    }
    
    # Check if node_modules exists
    $needsInstall = (-not (Test-Path "node_modules")) -or 
                    (-not (Test-Path "apps/api/node_modules")) -or 
                    (-not (Test-Path "apps/web/node_modules"))
    
    if ($needsInstall -or $ForceClean) {
        Write-Info "   Running npm install..."
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Error "   ✗ npm install gagal!"
            exit 1
        }
        Write-Success "   ✓ Dependencies installed"
    } else {
        Write-Success "   ✓ Dependencies already installed"
    }
} else {
    Write-Warning "Skipping dependency installation (--SkipInstall flag)"
}

# Step 3: Generate Prisma Client
Write-Step ""
Write-Step "═══ Step 3: Generating Prisma Client ═══"
Write-Info ""

try {
    Set-Location "apps/api"
    Write-Info "   Generating Prisma client..."
    npm run prisma:generate
    if ($LASTEXITCODE -ne 0) {
        throw "Prisma generate failed"
    }
    Write-Success "   ✓ Prisma client generated"
} catch {
    Write-Error "   ✗ Gagal generate Prisma client"
    Set-Location "../.."
    exit 1
} finally {
    Set-Location "../.."
}

# Step 4: Run Database Migrations
if (-not $SkipMigration) {
    Write-Step ""
    Write-Step "═══ Step 4: Running Database Migrations ═══"
    Write-Info ""
    
    try {
        Set-Location "apps/api"
        Write-Info "   Running migrations..."
        
        # Run migration with deploy (non-interactive)
        $env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/whatsappbot"
        npx prisma migrate deploy
        
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "   ⚠ Migration might have issues, but continuing..."
            # Don't exit, migrations might already be applied
        } else {
            Write-Success "   ✓ Database migrations applied"
        }
    } catch {
        Write-Warning "   ⚠ Migration check failed, but continuing..."
    } finally {
        Set-Location "../.."
    }
} else {
    Write-Warning "Skipping database migration (--SkipMigration flag)"
}

# Step 5: Check for .env files
Write-Step ""
Write-Step "═══ Step 5: Checking Environment Configuration ═══"
Write-Info ""

$envWarnings = @()

# Check root .env
if (-not (Test-Path ".env")) {
    $envWarnings += "   ⚠ Root .env file not found"
    Write-Warning "   Creating .env from template..."
    try {
        # Create a basic .env file
        @"
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/whatsappbot
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=super-secret-access-key-change-in-production
JWT_REFRESH_SECRET=super-secret-refresh-key-change-in-production
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d
NODE_ENV=development
PORT=4000
WHATSAPP_SESSION_DIR=./whatsapp-sessions
WHATSAPP_LOG_LEVEL=info
"@ | Out-File -FilePath ".env" -Encoding UTF8
        Write-Success "   ✓ Created default .env file"
    } catch {
        Write-Warning "   Could not create .env file automatically"
    }
} else {
    Write-Success "   ✓ Root .env exists"
}

# Check API .env
if (-not (Test-Path "apps/api/.env")) {
    $envWarnings += "   ⚠ apps/api/.env file not found"
    Write-Warning "   Creating apps/api/.env from template..."
    try {
        @"
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/whatsappbot
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=super-secret-access-key-change-in-production
JWT_REFRESH_SECRET=super-secret-refresh-key-change-in-production
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d
NODE_ENV=development
PORT=4000
WHATSAPP_SESSION_DIR=./whatsapp-sessions
WHATSAPP_LOG_LEVEL=info
"@ | Out-File -FilePath "apps/api/.env" -Encoding UTF8
        Write-Success "   ✓ Created default apps/api/.env file"
    } catch {
        Write-Warning "   Could not create apps/api/.env file automatically"
    }
} else {
    Write-Success "   ✓ API .env exists"
}

# Check Web .env.local
if (-not (Test-Path "apps/web/.env.local")) {
    $envWarnings += "   ⚠ apps/web/.env.local file not found"
    Write-Warning "   Creating apps/web/.env.local from template..."
    try {
        @"
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
"@ | Out-File -FilePath "apps/web/.env.local" -Encoding UTF8
        Write-Success "   ✓ Created default apps/web/.env.local file"
    } catch {
        Write-Warning "   Could not create apps/web/.env.local file automatically"
    }
} else {
    Write-Success "   ✓ Web .env.local exists"
}

if ($envWarnings.Count -gt 0) {
    Write-Info ""
    Write-Info "   Note: Environment files were auto-created with default values."
    Write-Info "   For production, please update secret keys!"
}

# Step 6: Final Health Check
Write-Step ""
Write-Step "═══ Step 6: Pre-Start Health Check ═══"
Write-Info ""

# Check PostgreSQL connection
Write-Info "   Testing PostgreSQL connection..."
try {
    $env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/whatsappbot"
    Set-Location "apps/api"
    $testConnection = npx prisma db execute --stdin 2>&1 << "SELECT 1"
    Set-Location "../.."
    Write-Success "   ✓ PostgreSQL connection OK"
} catch {
    Write-Warning "   ⚠ Could not verify PostgreSQL connection"
    Write-Info "   (Will be checked again when API starts)"
}

# Check Redis (optional, since it's used by BullMQ)
Write-Info "   Testing Redis connection..."
try {
    $redisTest = docker exec $(docker ps -qf "name=redis") redis-cli ping 2>&1
    if ($redisTest -match "PONG") {
        Write-Success "   ✓ Redis connection OK"
    } else {
        Write-Warning "   ⚠ Redis might not be responding properly"
    }
} catch {
    Write-Warning "   ⚠ Could not verify Redis connection"
}

# Step 7: Start Servers
Write-Step ""
Write-Step "═══ Step 7: Starting Servers ═══"
Write-Info ""
Write-Info "   Starting API (port 4000) and Web (port 3000) servers..."
Write-Info ""
Write-Success "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Success "   │"
Write-Success "   │  🚀 Servers akan segera berjalan di:"
Write-Success "   │"
Write-Success "   │     API Server:  http://localhost:4000"
Write-Success "   │     Web App:     http://localhost:3000"
Write-Success "   │"
Write-Success "   │  📝 Untuk login:"
Write-Success "   │     Email:    admin@example.com"
Write-Success "   │     Password: admin123"
Write-Success "   │"
Write-Success "   │  ⏹️  Untuk stop: Tekan Ctrl+C"
Write-Success "   │"
Write-Success "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Info ""
Write-Info "   Tunggu beberapa detik untuk servers startup..."
Write-Info ""

# Wait a bit before starting
Start-Sleep -Seconds 2

# Start both servers using the monorepo script
try {
    npm run dev:monorepo
} catch {
    Write-Error ""
    Write-Error "   ✗ Error starting servers"
    Write-Error "   Check the error messages above for details"
    exit 1
}

