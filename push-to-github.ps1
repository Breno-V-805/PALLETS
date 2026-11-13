# PALLETS // Quick GitHub Push Helper
param(
  [Parameter(Mandatory=$false)]
  [string]$RemoteUrl
)

$gitExe = "C:\Program Files\Git\bin\git.exe"
if (-not (Test-Path $gitExe)) {
  $gitCmd = Get-Command git -ErrorAction SilentlyContinue
  if ($gitCmd) { $gitExe = $gitCmd.Source } else {
    Write-Error "Git not found. Install Git from https://git-scm.com/"
    exit 1
  }
}

if (-not $RemoteUrl) {
  $RemoteUrl = Read-Host "Enter your GitHub repository URL (e.g. https://github.com/your-username/pallets.git)"
}

if (-not $RemoteUrl) {
  Write-Warning "No repository URL provided. Aborting."
  exit 1
}

Write-Host "Setting remote origin to $RemoteUrl..." -ForegroundColor Cyan
& $gitExe remote remove origin 2>$null
& $gitExe remote add origin $RemoteUrl

Write-Host "Pushing 'main' branch to GitHub..." -ForegroundColor Cyan
& $gitExe push -u origin main

if ($LASTEXITCODE -eq 0) {
  Write-Host "`nSUCCESS! Your PALLETS platform is live on GitHub:`n$RemoteUrl" -ForegroundColor Green
} else {
  Write-Warning "`nPush failed. Check your GitHub authentication (token/login) and try again."
}
