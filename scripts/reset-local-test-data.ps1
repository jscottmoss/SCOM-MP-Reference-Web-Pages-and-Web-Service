[CmdletBinding()]
param(
  [switch]$Apply,
  [switch]$IncludeUploadedFiles
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$WranglerState = Join-Path $ProjectRoot ".wrangler\state\v3"
$D1State = Join-Path $WranglerState "d1"
$R2State = Join-Path $WranglerState "r2"
$BackupRoot = Join-Path $ProjectRoot ".wrangler\reset-backups"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"

function Assert-InProject {
  param([string]$Path)

  $resolved = (Resolve-Path -LiteralPath $Path).Path

  if (-not $resolved.StartsWith($ProjectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to move a path outside this project: $resolved"
  }

  return $resolved
}

function Move-StateFolder {
  param(
    [string]$Source,
    [string]$Name
  )

  if (-not (Test-Path -LiteralPath $Source)) {
    Write-Host "$Name state was not found. Nothing to reset for $Name."
    return
  }

  $safeSource = Assert-InProject -Path $Source
  $destination = Join-Path $BackupRoot "$Name-$Stamp"

  Write-Host "Moving $Name state to:"
  Write-Host "  $destination"
  Move-Item -LiteralPath $safeSource -Destination $destination
}

Write-Host "SCOM MP Reference local test data reset"
Write-Host "Project: $ProjectRoot"
Write-Host ""
Write-Host "This resets local preview state only. It does not change a hosted or remote database."
Write-Host "Stop the local preview before applying the reset so the database files are not locked."
Write-Host ""

if (-not $Apply) {
  Write-Host "Dry run only. No files were moved."
  Write-Host ""
  Write-Host "To reset imported management pack database records:"
  Write-Host "  .\scripts\reset-local-test-data.ps1 -Apply"
  Write-Host ""
  Write-Host "To reset imported records and uploaded source files:"
  Write-Host "  .\scripts\reset-local-test-data.ps1 -Apply -IncludeUploadedFiles"
  Write-Host ""
  Write-Host "The reset keeps a backup under .wrangler\reset-backups."
  exit 0
}

New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null

Move-StateFolder -Source $D1State -Name "d1"

if ($IncludeUploadedFiles) {
  Move-StateFolder -Source $R2State -Name "r2"
} else {
  Write-Host ""
  Write-Host "Uploaded R2 files were left in place."
  Write-Host "Run with -IncludeUploadedFiles to reset uploaded source files too."
}

Write-Host ""
Write-Host "Reset complete. Start the local preview again and the app will create a fresh local database."
