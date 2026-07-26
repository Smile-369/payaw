$ErrorActionPreference = "Stop"

if (-not (Test-Path ".\package.json")) {
  throw "Run this script from the PAYAW repository root (the folder containing package.json)."
}

# These are accidental full-project copies placed inside the real source folder.
$badPaths = @(
  ".\src\src",
  ".\src\supabase",
  ".\src\scripts",
  ".\src\tests",
  ".\src\dist"
)

foreach ($path in $badPaths) {
  if (Test-Path $path) {
    Write-Host "Removing accidental nested path: $path"
    Remove-Item -Recurse -Force $path
  }
}

# Remove project-root files accidentally copied into src, without touching real source files.
$badFiles = @(
  ".\src\package.json",
  ".\src\package-lock.json",
  ".\src\pnpm-lock.yaml",
  ".\src\tsconfig.json",
  ".\src\tsconfig.test.json",
  ".\src\vite.config.ts",
  ".\src\index.html"
)

foreach ($path in $badFiles) {
  if (Test-Path $path) {
    Write-Host "Removing accidental nested file: $path"
    Remove-Item -Force $path
  }
}

Write-Host "Nested project cleanup complete."
Write-Host "Confirm these files exist:"
Write-Host "  src\netcode\GmNetcodePanel.ts"
Write-Host "  src\ui\ms21.css"
Write-Host "Now run: pnpm run build"
