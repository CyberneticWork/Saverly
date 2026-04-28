# ── 1. Start MySQL (XAMPP MariaDB) if not already running ────────────────────
$mysqlRunning = (cmd /c "netstat -ano | findstr :3306 | findstr LISTENING") -ne $null
if (-not $mysqlRunning) {
    Write-Host "Starting MySQL..." -ForegroundColor Yellow
    Remove-Item "C:\xampp\mysql\data\mysql.pid" -Force -ErrorAction SilentlyContinue
    Start-Process -FilePath "C:\xampp\mysql\bin\mysqld.exe" -ArgumentList "--defaults-file=C:\xampp\mysql\bin\my.ini" -WindowStyle Hidden
    Start-Sleep -Seconds 5
    Write-Host "MySQL started." -ForegroundColor Green
} else {
    Write-Host "MySQL already running." -ForegroundColor Green
}

# ── 2. Start backend API if not already running ───────────────────────────────
$backendRunning = (cmd /c "netstat -ano | findstr :5000 | findstr LISTENING") -ne $null
if (-not $backendRunning) {
    Write-Host "Starting backend API..." -ForegroundColor Yellow
    Start-Process -FilePath "node" -ArgumentList "src/index.js" -WorkingDirectory "d:\PrasadMobileApp\backend" -WindowStyle Hidden
    Start-Sleep -Seconds 3
    Write-Host "Backend API started." -ForegroundColor Green
} else {
    Write-Host "Backend API already running." -ForegroundColor Green
}

# ── 3. Start Expo mobile dev server ──────────────────────────────────────────
Write-Host "Starting Expo..." -ForegroundColor Yellow
Set-Location d:\PrasadMobileApp\mobile
$env:REACT_NATIVE_PACKAGER_HOSTNAME = "10.131.208.6"
$env:NODE_OPTIONS = "--max-old-space-size=6144"
$env:EXPO_MAX_WORKERS = "1"
node node_modules\expo\bin\cli start --host lan
