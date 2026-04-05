# Deploy dist/ + package.json to Azure App Service via Kudu VFS, then npm install on Linux (wwwroot).
# Requires: Azure CLI logged in (az login), pnpm build already run.
param(
  [string]$ResourceGroup = "buddyai-app_group",
  [string]$AppName = "buddyai-app"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$distRoot = Join-Path $root "dist"
$pkg = Join-Path $root "package.json"

if (-not (Test-Path (Join-Path $distRoot "server\node-build.mjs"))) {
  Write-Error "Run pnpm build first (missing dist/server/node-build.mjs)"
}
if (-not (Test-Path $pkg)) {
  Write-Error "package.json not found"
}

$env:PATH = "$env:PATH;C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin"
$defaultHost = az webapp show -g $ResourceGroup -n $AppName --query defaultHostName -o tsv
if (-not $defaultHost) { Write-Error "Could not read App Service default hostname" }
$parts = $defaultHost -split "\.", 2
$scmHost = "$($parts[0]).scm.$($parts[1])"
$baseUrl = "https://$scmHost/api/vfs/site/wwwroot"
Write-Host "SCM host: $scmHost"

$token = az account get-access-token --resource "https://management.azure.com" --query accessToken -o tsv
if (-not $token) { Write-Error "az login required" }

function Put-VfsFile {
  param([string]$RelativePath, [string]$LocalPath)
  $enc = [System.Net.WebUtility]::UrlEncode($RelativePath).Replace("+", "%20")
  $url = "$baseUrl/$RelativePath".Replace("\", "/")
  $mime = "application/octet-stream"
  if ($LocalPath -match "\.mjs`$") { $mime = "application/javascript" }
  elseif ($LocalPath -match "\.json`$") { $mime = "application/json" }
  elseif ($LocalPath -match "\.html`$") { $mime = "text/html" }
  elseif ($LocalPath -match "\.css`$") { $mime = "text/css" }
  elseif ($LocalPath -match "\.svg`$") { $mime = "image/svg+xml" }
  elseif ($LocalPath -match "\.ico`$") { $mime = "image/x-icon" }
  $h = @{
    Authorization            = "Bearer $token"
    "If-Match"               = "*"
    "Content-Type"           = $mime
  }
  Invoke-RestMethod -Method Put -Uri $url -Headers $h -InFile $LocalPath | Out-Null
}

Write-Host "Uploading package.json..."
Put-VfsFile -RelativePath "package.json" -LocalPath $pkg

$files = Get-ChildItem -Path $distRoot -Recurse -File
Write-Host "Uploading $($files.Count) files under dist/..."
foreach ($f in $files) {
  $rel = "dist/" + ($f.FullName.Substring($distRoot.Length + 1).Replace("\", "/"))
  Put-VfsFile -RelativePath $rel -LocalPath $f.FullName
  Write-Host "  $rel"
}

Write-Host "Running npm install --omit=dev on App Service (may take 1-2 min)..."
$cmdUrl = "https://$scmHost/api/command"
$body = '{"command":"npm install --omit=dev --legacy-peer-deps","dir":"/home/site/wwwroot"}'
try {
  Invoke-RestMethod -Method Post -Uri $cmdUrl -Headers @{
    Authorization  = "Bearer $token"
    "Content-Type" = "application/json"
  } -Body $body -TimeoutSec 300 | Out-Null
} catch {
  Write-Warning "npm install API returned: $($_.Exception.Message) (install may still be running on server)"
}

Write-Host "Restarting app..."
az webapp restart -g $ResourceGroup -n $AppName | Out-Null
Write-Host "Done. Smoke test: LIVE_URL=https://<your-domain> pnpm smoke:live"
