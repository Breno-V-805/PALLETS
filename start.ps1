# PALLETS V3 Enterprise Launcher
Write-Host "Starting PALLETS V3 Enterprise Server on http://localhost:3001 ..." -ForegroundColor Cyan
Write-Host "Keep this window open while using the app (use Ctrl+Shift+C or Right-Click to copy tokens)." -ForegroundColor Yellow
Set-Location $PSScriptRoot
node server.js

