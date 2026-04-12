# Run this in YOUR Windows terminal (double-click or: pwsh -File scripts/gh-auth-login.ps1)
# GitHub CLI must be installed: winget install GitHub.cli
# A browser window opens to finish login — I cannot complete that step for you from Cursor.

$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Error "GitHub CLI (gh) not found. Install: winget install GitHub.cli then open a new terminal."
  exit 1
}

Write-Host "Starting GitHub login (HTTPS, browser)..." -ForegroundColor Cyan
gh auth login -h github.com -p https -w

Write-Host "`nStatus:" -ForegroundColor Cyan
gh auth status

Write-Host "`nNext: cd to repo root and run: pnpm secrets:github" -ForegroundColor Green
