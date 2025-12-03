# Script to kill process using a specific port

param(
    [Parameter(Mandatory=$false)]
    [int]$Port = 4000
)

Write-Host ""
Write-Host "=== Killing Process on Port ${Port} ===" -ForegroundColor Cyan
Write-Host ""

# Find process using the port
$portStr = ":$Port"
$connections = netstat -ano | findstr $portStr
if (-not $connections) {
    Write-Host "[INFO] No process found using port ${Port}" -ForegroundColor Yellow
    Write-Host "Port ${Port} is available!" -ForegroundColor Green
    exit 0
}

Write-Host "Found processes using port ${Port}:" -ForegroundColor Yellow
Write-Host $connections -ForegroundColor Gray
Write-Host ""

# Extract PIDs
$pids = @()
foreach ($line in $connections) {
    if ($line -match '\s+(\d+)$') {
        $pid = $matches[1]
        if ($pid -notin $pids) {
            $pids += $pid
        }
    }
}

if ($pids.Count -eq 0) {
    Write-Host "[ERROR] Could not extract process IDs" -ForegroundColor Red
    exit 1
}

# Show process info
Write-Host "Processes to kill:" -ForegroundColor Yellow
foreach ($pid in $pids) {
    try {
        $process = Get-Process -Id $pid -ErrorAction Stop
        Write-Host "  PID: $pid - $($process.ProcessName)" -ForegroundColor White
    } catch {
        Write-Host "  PID: $pid (not found or already terminated)" -ForegroundColor Yellow
    }
}

Write-Host ""

# Kill processes directly (no confirmation for automation)
Write-Host "Killing processes..." -ForegroundColor Yellow
$killed = $false
foreach ($pid in $pids) {
    try {
        $process = Get-Process -Id $pid -ErrorAction Stop
        Stop-Process -Id $pid -Force
        Write-Host "[OK] Killed process $pid ($($process.ProcessName))" -ForegroundColor Green
        $killed = $true
    } catch {
        # Try using taskkill as fallback
        try {
            taskkill /PID $pid /F 2>&1 | Out-Null
            Write-Host "[OK] Killed process $pid using taskkill" -ForegroundColor Green
            $killed = $true
        } catch {
            Write-Host "[WARNING] Could not kill process $pid" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
if ($killed) {
    Write-Host "[OK] Done! Port ${Port} is now available." -ForegroundColor Green
    Write-Host "You can now start the API server with: .\start-api.ps1" -ForegroundColor Cyan
} else {
    Write-Host "[WARNING] Could not kill all processes. Try running as Administrator." -ForegroundColor Yellow
}
Write-Host ""

