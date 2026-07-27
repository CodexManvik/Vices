# VICES — start everything (Windows)
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\start.ps1 [-BackendOnly]
#
# Launches the backend API (which auto-spawns the local LLM engine) and the
# Tauri desktop app. Ctrl+C in this window stops the frontend; the backend
# window closes separately.

param(
    [switch]$BackendOnly
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path "$Root\.venv\Scripts\python.exe")) {
    Write-Host "No virtual environment found. Run scripts\install.ps1 first." -ForegroundColor Red
    exit 1
}

$gguf = Get-ChildItem "$Root\models\llm\*.gguf" -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch "mmproj" }
if (-not $gguf) {
    Write-Host "WARNING: no .gguf model found in models\llm\ — chat will not work until you add one." -ForegroundColor Yellow
    Write-Host "         See models\README.md for recommendations." -ForegroundColor Yellow
}

Write-Host "Starting VICES backend (http://localhost:8000)..." -ForegroundColor Cyan
$backend = Start-Process -FilePath "$Root\.venv\Scripts\python.exe" `
    -ArgumentList "$Root\backend\server.py" `
    -WorkingDirectory "$Root\backend" `
    -PassThru

if ($BackendOnly) {
    Write-Host "Backend running (PID $($backend.Id)). Press Ctrl+C to exit this script (backend keeps running)."
    Wait-Process -Id $backend.Id
    exit 0
}

Write-Host "Starting desktop app..." -ForegroundColor Cyan
try {
    Push-Location "$Root\frontend_app"
    pnpm tauri dev
} finally {
    Pop-Location
    if ($backend -and -not $backend.HasExited) {
        Write-Host "Stopping backend (PID $($backend.Id))..."
        Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
    }
}
