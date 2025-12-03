#Requires -Version 5.1
<#
.SYNOPSIS
    Comprehensive health check script for WhatsApp Bot POS SuperApp
.DESCRIPTION
    Script ini akan check semua komponen system:
    1. Docker installation dan services
    2. Database connectivity (PostgreSQL)
    3. Cache service (Redis)
    4. API server status dan endpoints
    5. Web app status
    6. File permissions dan directories
.NOTES
    Author: Auto-generated
    Version: 1.0.0
#>

param(
    [switch]$Detailed,      # Show detailed information
    [switch]$Fix,           # Attempt to fix common issues
    [switch]$Json           # Output in JSON format
)

# Colors for output
function Write-ColorOutput($ForegroundColor) {
    if ($Json) { return }
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

# Health check results
$healthStatus = @{
    timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    overall = "healthy"
    checks = @{}
}

function Add-HealthCheck {
    param($name, $status, $message, $details = $null)
    $healthStatus.checks[$name] = @{
        status = $status
        message = $message
        details = $details
    }
    if ($status -eq "failed") {
        $healthStatus.overall = "unhealthy"
    } elseif ($status -eq "warning" -and $healthStatus.overall -eq "healthy") {
        $healthStatus.overall = "degraded"
    }
}

# Banner
if (-not $Json) {
    Clear-Host
    Write-Info ""
    Write-Info "╔══════════════════════════════════════════════════════════════╗"
    Write-Info "║                                                              ║"
    Write-Info "║            System Health Check - WhatsApp Bot POS            ║"
    Write-Info "║                                                              ║"
    Write-Info "╚══════════════════════════════════════════════════════════════╝"
    Write-Info ""
}

# Check 1: Docker Installation
Write-Step "1. Checking Docker Installation..."
$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if ($dockerCmd) {
    try {
        $dockerVersion = docker --version 2>&1
        $null = docker info 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "   ✓ Docker is installed and running"
            Add-HealthCheck "docker" "passed" "Docker is running" @{ version = $dockerVersion }
        } else {
            Write-Warning "   ⚠ Docker installed but not running"
            Add-HealthCheck "docker" "warning" "Docker installed but not running"
            if ($Fix) {
                Write-Info "   → To fix: Start Docker Desktop"
            }
        }
    } catch {
        Write-Error "   ✗ Docker not responding"
        Add-HealthCheck "docker" "failed" "Docker not responding"
    }
} else {
    Write-Error "   ✗ Docker not installed"
    Add-HealthCheck "docker" "failed" "Docker not installed"
    if ($Fix) {
        Write-Info "   → To fix: Run .\install-docker.ps1 or download from docker.com"
    }
}

# Check 2: PostgreSQL Container
Write-Step ""
Write-Step "2. Checking PostgreSQL..."
try {
    $postgresContainer = docker ps --filter "name=postgres" --format "{{.Names}}" 2>&1
    if ($postgresContainer -match "postgres") {
        $postgresStatus = docker inspect --format='{{.State.Status}}' $(docker ps -qf "name=postgres") 2>&1
        if ($postgresStatus -eq "running") {
            Write-Success "   ✓ PostgreSQL container is running"
            
            # Test connection
            try {
                $pgTest = docker exec $(docker ps -qf "name=postgres") pg_isready -U postgres 2>&1
                if ($pgTest -match "accepting connections") {
                    Write-Success "   ✓ PostgreSQL accepting connections"
                    Add-HealthCheck "postgresql" "passed" "PostgreSQL is running and accepting connections"
                } else {
                    Write-Warning "   ⚠ PostgreSQL not ready"
                    Add-HealthCheck "postgresql" "warning" "PostgreSQL container running but not accepting connections"
                }
            } catch {
                Write-Warning "   ⚠ Could not test PostgreSQL connection"
                Add-HealthCheck "postgresql" "warning" "Could not verify connection"
            }
        } else {
            Write-Warning "   ⚠ PostgreSQL container exists but not running"
            Add-HealthCheck "postgresql" "warning" "Container exists but not running"
            if ($Fix) {
                Write-Info "   → Attempting to start..."
                docker start $(docker ps -aqf "name=postgres")
            }
        }
    } else {
        Write-Error "   ✗ PostgreSQL container not found"
        Add-HealthCheck "postgresql" "failed" "Container not found"
        if ($Fix) {
            Write-Info "   → To fix: docker compose up -d postgres"
        }
    }
} catch {
    Write-Error "   ✗ Could not check PostgreSQL"
    Add-HealthCheck "postgresql" "failed" "Could not check container status"
}

# Check 3: Redis Container
Write-Step ""
Write-Step "3. Checking Redis..."
try {
    $redisContainer = docker ps --filter "name=redis" --format "{{.Names}}" 2>&1
    if ($redisContainer -match "redis") {
        $redisStatus = docker inspect --format='{{.State.Status}}' $(docker ps -qf "name=redis") 2>&1
        if ($redisStatus -eq "running") {
            Write-Success "   ✓ Redis container is running"
            
            # Test connection
            try {
                $redisTest = docker exec $(docker ps -qf "name=redis") redis-cli ping 2>&1
                if ($redisTest -match "PONG") {
                    Write-Success "   ✓ Redis responding to ping"
                    Add-HealthCheck "redis" "passed" "Redis is running and responding"
                } else {
                    Write-Warning "   ⚠ Redis not responding"
                    Add-HealthCheck "redis" "warning" "Redis container running but not responding to ping"
                }
            } catch {
                Write-Warning "   ⚠ Could not test Redis connection"
                Add-HealthCheck "redis" "warning" "Could not verify connection"
            }
        } else {
            Write-Warning "   ⚠ Redis container exists but not running"
            Add-HealthCheck "redis" "warning" "Container exists but not running"
            if ($Fix) {
                Write-Info "   → Attempting to start..."
                docker start $(docker ps -aqf "name=redis")
            }
        }
    } else {
        Write-Error "   ✗ Redis container not found"
        Add-HealthCheck "redis" "failed" "Container not found"
        if ($Fix) {
            Write-Info "   → To fix: docker compose up -d redis"
        }
    }
} catch {
    Write-Error "   ✗ Could not check Redis"
    Add-HealthCheck "redis" "failed" "Could not check container status"
}

# Check 4: API Server
Write-Step ""
Write-Step "4. Checking API Server (port 4000)..."
try {
    $apiHealth = Invoke-WebRequest -Uri "http://localhost:4000/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    $apiData = $apiHealth.Content | ConvertFrom-Json
    Write-Success "   ✓ API server is running"
    Write-Success "   ✓ Health endpoint responding"
    Add-HealthCheck "api_server" "passed" "API server is healthy" $apiData
    
    if ($Detailed) {
        Write-Info "   Timestamp: $($apiData.timestamp)"
        Write-Info "   Status: $($apiData.status)"
    }
    
    # Test API endpoints
    Write-Info "   Testing API endpoints..."
    try {
        # Test auth endpoint (should return 401 or proper response)
        $authTest = Invoke-WebRequest -Uri "http://localhost:4000/api/auth/me" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        Write-Info "   → /api/auth/me: Accessible"
    } catch {
        if ($_.Exception.Response.StatusCode -eq 401) {
            Write-Success "   ✓ Auth endpoint responding (401 expected without token)"
        } else {
            Write-Warning "   ⚠ Auth endpoint issue: $($_.Exception.Message)"
        }
    }
    
} catch {
    Write-Error "   ✗ API server not responding"
    Add-HealthCheck "api_server" "failed" "API server not responding"
    if ($Fix) {
        Write-Info "   → To fix: cd apps/api && npm run dev"
    }
}

# Check 5: Web App
Write-Step ""
Write-Step "5. Checking Web App (port 3000)..."
try {
    $webCheck = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    Write-Success "   ✓ Web app is running"
    Add-HealthCheck "web_app" "passed" "Web app is accessible"
    
    # Check if login page is accessible
    try {
        $loginCheck = Invoke-WebRequest -Uri "http://localhost:3000/login" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        Write-Success "   ✓ Login page accessible"
    } catch {
        Write-Warning "   ⚠ Login page might not be accessible"
    }
    
} catch {
    Write-Error "   ✗ Web app not responding"
    Add-HealthCheck "web_app" "failed" "Web app not responding"
    if ($Fix) {
        Write-Info "   → To fix: cd apps/web && npm run dev"
    }
}

# Check 6: File System & Directories
Write-Step ""
Write-Step "6. Checking File System..."
$requiredDirs = @(
    "uploads",
    "whatsapp-sessions",
    "apps/backups",
    "public"
)

$dirIssues = @()
foreach ($dir in $requiredDirs) {
    if (-not (Test-Path $dir)) {
        Write-Warning "   ⚠ Directory missing: $dir"
        $dirIssues += $dir
        if ($Fix) {
            Write-Info "   → Creating directory: $dir"
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
    } else {
        Write-Success "   ✓ $dir exists"
    }
}

if ($dirIssues.Count -eq 0) {
    Add-HealthCheck "filesystem" "passed" "All required directories exist"
} else {
    Add-HealthCheck "filesystem" "warning" "Some directories missing" @{ missing = $dirIssues }
}

# Check 7: Environment Configuration
Write-Step ""
Write-Step "7. Checking Environment Configuration..."
$envFiles = @(
    ".env",
    "apps/api/.env",
    "apps/web/.env.local"
)

$envIssues = @()
foreach ($envFile in $envFiles) {
    if (-not (Test-Path $envFile)) {
        Write-Warning "   ⚠ Environment file missing: $envFile"
        $envIssues += $envFile
    } else {
        Write-Success "   ✓ $envFile exists"
    }
}

if ($envIssues.Count -eq 0) {
    Add-HealthCheck "environment" "passed" "All environment files exist"
} else {
    Add-HealthCheck "environment" "warning" "Some environment files missing" @{ missing = $envIssues }
    if ($Fix) {
        Write-Info "   → To fix: Run .\start-all-in-one.ps1 to auto-create env files"
    }
}

# Check 8: Node Modules
Write-Step ""
Write-Step "8. Checking Dependencies..."
$nodeModulesDirs = @(
    "node_modules",
    "apps/api/node_modules",
    "apps/web/node_modules"
)

$depsIssues = @()
foreach ($nmDir in $nodeModulesDirs) {
    if (-not (Test-Path $nmDir)) {
        Write-Warning "   ⚠ Dependencies missing: $nmDir"
        $depsIssues += $nmDir
    } else {
        Write-Success "   ✓ $nmDir exists"
    }
}

if ($depsIssues.Count -eq 0) {
    Add-HealthCheck "dependencies" "passed" "All dependencies installed"
} else {
    Add-HealthCheck "dependencies" "warning" "Some dependencies missing" @{ missing = $depsIssues }
    if ($Fix) {
        Write-Info "   → To fix: npm install"
    }
}

# Summary
Write-Step ""
Write-Step "════════════════════════════════════════════════════════════════"
Write-Step ""

if ($Json) {
    # Output JSON
    $healthStatus | ConvertTo-Json -Depth 10
} else {
    # Output summary
    $statusColor = switch ($healthStatus.overall) {
        "healthy" { "Green" }
        "degraded" { "Yellow" }
        "unhealthy" { "Red" }
        default { "Gray" }
    }
    
    Write-ColorOutput $statusColor "Overall Status: $($healthStatus.overall.ToUpper())"
    Write-Info ""
    
    # Count checks
    $passed = ($healthStatus.checks.Values | Where-Object { $_.status -eq "passed" }).Count
    $warning = ($healthStatus.checks.Values | Where-Object { $_.status -eq "warning" }).Count
    $failed = ($healthStatus.checks.Values | Where-Object { $_.status -eq "failed" }).Count
    
    Write-Info "Results:"
    Write-Success "  ✓ Passed:  $passed"
    if ($warning -gt 0) { Write-Warning "  ⚠ Warning: $warning" }
    if ($failed -gt 0) { Write-Error "  ✗ Failed:  $failed" }
    
    Write-Info ""
    
    if ($healthStatus.overall -ne "healthy") {
        Write-Warning "Issues detected! Run with --Fix flag to attempt automatic fixes:"
        Write-Info "  .\health-check.ps1 -Fix"
        Write-Info ""
        Write-Info "Or start everything with:"
        Write-Info "  .\start-all-in-one.ps1"
    } else {
        Write-Success "All systems operational! 🚀"
        Write-Info ""
        Write-Info "Access your application:"
        Write-Info "  API:     http://localhost:4000"
        Write-Info "  Web App: http://localhost:3000"
    }
    
    Write-Step ""
    Write-Step "════════════════════════════════════════════════════════════════"
}

# Exit with appropriate code
if ($healthStatus.overall -eq "unhealthy") {
    exit 1
} elseif ($healthStatus.overall -eq "degraded") {
    exit 2
} else {
    exit 0
}

