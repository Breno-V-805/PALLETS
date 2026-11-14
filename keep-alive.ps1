# PALLETS V3 // Render Keep-Alive Heartbeat Script
# Pings https://pallets-plpk.onrender.com/api/health every 12 minutes
# to prevent the free-tier service from sleeping after 15 minutes of inactivity.

param(
  [string]$Url = "https://pallets-plpk.onrender.com/api/health",
  [int]$IntervalMinutes = 12
)

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " PALLETS V3 // Render Service Keep-Alive Heartbeat" -ForegroundColor Cyan
Write-Host " Target URL : $Url" -ForegroundColor Gray
Write-Host " Interval   : Every $IntervalMinutes minutes (Render sleeps at 15 min)" -ForegroundColor Gray
Write-Host " Press Ctrl+C at any time to stop." -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Cyan

$intervalSec = $IntervalMinutes * 60
$count = 0

while ($true) {
  $count++
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $response = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 45
    $sw.Stop()
    $latencyMs = [math]::Round($sw.Elapsed.TotalMilliseconds)
    Write-Host "[$timestamp] (#$count) PING SUCCESS -> Status: 200 OK | Latency: ${latencyMs}ms | Uptime: $($response.uptimeSec)s" -ForegroundColor Green
  } catch {
    Write-Warning "[$timestamp] (#$count) PING FAILED -> $($_.Exception.Message)"
  }
  
  Write-Host "Next ping in $IntervalMinutes minutes..." -ForegroundColor DarkGray
  Start-Sleep -Seconds $intervalSec
}
