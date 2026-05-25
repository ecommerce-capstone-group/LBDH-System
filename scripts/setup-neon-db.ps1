# Apply schema + seed to the database in DATABASE_URL (e.g. Neon).
# Works from normal Windows PowerShell (no pnpm "Use pnpm instead" error).
#
# Usage:
#   $env:DATABASE_URL = "postgresql://..."
#   .\scripts\setup-neon-db.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

if (-not $env:DATABASE_URL) {
  if (Test-Path (Join-Path $root ".env")) {
    Get-Content (Join-Path $root ".env") | ForEach-Object {
      if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        Set-Item -Path "env:$($matches[1].Trim())" -Value $matches[2].Trim()
      }
    }
  }
}

if (-not $env:DATABASE_URL) {
  Write-Host "Set DATABASE_URL first (Neon connection string)." -ForegroundColor Red
  Write-Host '  $env:DATABASE_URL = "postgresql://..."'
  exit 1
}

$drizzleDir = Get-ChildItem (Join-Path $root "node_modules\.pnpm") -Filter "drizzle-kit@*" -Directory |
  Select-Object -First 1
$tsxDir = Get-ChildItem (Join-Path $root "node_modules\.pnpm") -Filter "tsx@*" -Directory |
  Select-Object -First 1

if (-not $drizzleDir -or -not $tsxDir) {
  Write-Host "Run 'pnpm install' from the project folder first (in a terminal where pnpm works)." -ForegroundColor Red
  exit 1
}

$drizzleBin = Join-Path $drizzleDir.FullName "node_modules\drizzle-kit\bin.cjs"
$tsxCli = Join-Path $tsxDir.FullName "node_modules\tsx\dist\cli.mjs"

Write-Host "Pushing schema to Neon..."
Push-Location (Join-Path $root "lib\db")
node $drizzleBin push --config ./drizzle.config.ts
if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
Pop-Location

Write-Host "Seeding HR data..."
Set-Location $root
node $tsxCli .\scripts\src\seed-hr.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Done. Your Neon database has tables and demo employees." -ForegroundColor Green
