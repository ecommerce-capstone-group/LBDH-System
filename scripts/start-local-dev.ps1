# Start local HR stack (Postgres must be running; see .env at repo root).
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

if (Test-Path (Join-Path $root ".env")) {
  Get-Content (Join-Path $root ".env") | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
      Set-Item -Path "env:$($matches[1].Trim())" -Value $matches[2].Trim()
    }
  }
}

if (-not $env:DATABASE_URL) {
  throw "Missing DATABASE_URL in .env"
}
if (-not $env:PORT) { $env:PORT = "8080" }

Write-Host "Starting API on http://127.0.0.1:$env:PORT ..."
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "Set-Location '$root\artifacts\api-server'; `$env:DATABASE_URL='$env:DATABASE_URL'; `$env:PORT='$env:PORT'; node --enable-source-maps .\dist\index.mjs"
) -WindowStyle Normal

Start-Sleep -Seconds 2

Write-Host "Starting HR UI on http://localhost:5173 (proxies /api to $env:API_PROXY_TARGET) ..."
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "Set-Location '$root\artifacts\hr-system'; `$env:PORT='5173'; npx vite --config vite.config.ts --host 0.0.0.0"
) -WindowStyle Normal

Write-Host "Done. Open http://localhost:5173/ when Vite is ready."
