<#
.SYNOPSIS
  Finds or removes local-only files before uploading this project to GitHub.

.DESCRIPTION
  By default this script performs a dry run. It prints the files and folders
  that should not be committed, but it does not delete anything.

  Run with -Execute to remove the default cleanup targets.
  Add -RemoveBackups if you want to remove the project backup snapshots.
  Add -RemoveScaffoldExamples if you want to remove the starter example files.
  Add -CleanGitIndex if these files were already added to Git.

.EXAMPLE
  .\cleanupForGithub.ps1

.EXAMPLE
  .\cleanupForGithub.ps1 -Execute

.EXAMPLE
  .\cleanupForGithub.ps1 -Execute -CleanGitIndex -RemoveBackups -RemoveScaffoldExamples
#>

[CmdletBinding()]
param(
  [switch]$Execute,
  [switch]$RemoveBackups,
  [switch]$RemoveScaffoldExamples,
  [switch]$CleanGitIndex
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRootFull = [System.IO.Path]::GetFullPath($ProjectRoot).TrimEnd(
  [System.IO.Path]::DirectorySeparatorChar,
  [System.IO.Path]::AltDirectorySeparatorChar
)

function Resolve-ProjectChildPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RelativePath
  )

  $fullPath = [System.IO.Path]::GetFullPath((Join-Path -Path $ProjectRootFull -ChildPath $RelativePath))
  $projectPrefix = $ProjectRootFull + [System.IO.Path]::DirectorySeparatorChar

  if ($fullPath -ne $ProjectRootFull -and -not $fullPath.StartsWith($projectPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to touch a path outside the project folder: $RelativePath"
  }

  return $fullPath
}

$cleanupTargets = New-Object System.Collections.Generic.List[object]

function Add-CleanupTarget {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RelativePath,

    [Parameter(Mandatory = $true)]
    [string]$Reason
  )

  $fullPath = Resolve-ProjectChildPath -RelativePath $RelativePath

  if (Test-Path -LiteralPath $fullPath) {
    $item = Get-Item -LiteralPath $fullPath -Force
    $cleanupTargets.Add([PSCustomObject]@{
      RelativePath = $RelativePath
      FullPath = $item.FullName
      Kind = if ($item.PSIsContainer) { "Folder" } else { "File" }
      Reason = $Reason
    })
  }
}

$defaultFolders = @(
  @{ Path = "node_modules"; Reason = "Installed packages. Recreate with pnpm install." },
  @{ Path = ".pnpm-store"; Reason = "Local pnpm package cache. Not project source." },
  @{ Path = ".vinext"; Reason = "Local Vinext preview/cache folder." },
  @{ Path = ".wrangler"; Reason = "Local Cloudflare preview state, including local D1/R2 test data." },
  @{ Path = "dist"; Reason = "Generated build output." },
  @{ Path = ".next"; Reason = "Generated Next/Vinext cache." },
  @{ Path = "out"; Reason = "Generated static export output." },
  @{ Path = "coverage"; Reason = "Generated test coverage output." },
  @{ Path = "outputs"; Reason = "Generated/local output folder." },
  @{ Path = "work"; Reason = "Generated/local work folder." },
  @{ Path = ".vercel"; Reason = "Local deployment metadata for another host." }
)

$defaultFiles = @(
  @{ Path = ".local-preview.log"; Reason = "Local preview log." },
  @{ Path = ".local-preview.err.log"; Reason = "Local preview error log." },
  @{ Path = ".codex-dev-server.log"; Reason = "Local development server log." },
  @{ Path = ".codex-dev-server.err.log"; Reason = "Local development server error log." },
  @{ Path = "tsconfig.tsbuildinfo"; Reason = "TypeScript incremental build cache." },
  @{ Path = "next-env.d.ts"; Reason = "Generated framework type file." },
  @{ Path = "package-lock.json"; Reason = "npm lockfile. This project uses pnpm-lock.yaml instead." },
  @{ Path = ".pnp.cjs"; Reason = "Yarn Plug'n'Play generated file." },
  @{ Path = ".pnp.loader.mjs"; Reason = "Yarn Plug'n'Play generated file." },
  @{ Path = ".DS_Store"; Reason = "macOS folder metadata." },
  @{ Path = "Thumbs.db"; Reason = "Windows folder metadata." }
)

$secretFiles = @(
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.test",
  ".env.test.local",
  ".env.production",
  ".env.production.local",
  ".dev.vars",
  ".dev.vars.local"
)

foreach ($folder in $defaultFolders) {
  Add-CleanupTarget -RelativePath $folder.Path -Reason $folder.Reason
}

foreach ($file in $defaultFiles) {
  Add-CleanupTarget -RelativePath $file.Path -Reason $file.Reason
}

foreach ($file in $secretFiles) {
  Add-CleanupTarget -RelativePath $file -Reason "Local environment or secret values. Keep .env.example if you need a template."
}

Get-ChildItem -LiteralPath $ProjectRootFull -Force -File -ErrorAction SilentlyContinue |
  Where-Object {
    $_.Name -like "npm-debug.log*" -or
    $_.Name -like "yarn-debug.log*" -or
    $_.Name -like "yarn-error.log*" -or
    $_.Name -like ".pnpm-debug.log*" -or
    $_.Name -like "*.pem"
  } |
  ForEach-Object {
    $relativePath = [System.IO.Path]::GetRelativePath($ProjectRootFull, $_.FullName)
    Add-CleanupTarget -RelativePath $relativePath -Reason "Debug log or private key file that should not be uploaded."
  }

if ($RemoveBackups) {
  Add-CleanupTarget -RelativePath "backups" -Reason "Local project backup snapshots. Optional: keep only if you want this history in GitHub."
}

if ($RemoveScaffoldExamples) {
  Add-CleanupTarget -RelativePath "examples" -Reason "Starter example files that are not part of the SCOM MP Reference app."
}

$cleanupTargets = $cleanupTargets |
  Sort-Object FullPath -Unique

Write-Host ""
Write-Host "SCOM MP Reference GitHub cleanup"
Write-Host "Project folder: $ProjectRootFull"
Write-Host ""

if (-not $cleanupTargets -or $cleanupTargets.Count -eq 0) {
  Write-Host "No cleanup targets were found."
} else {
  $cleanupTargets |
    Select-Object Kind, RelativePath, Reason |
    Format-Table -AutoSize
}

Write-Host ""
Write-Host "Keep these project files/folders for GitHub:"
Write-Host "  app, components, db, docs, drizzle, lib, public, scripts, sql, tests, worker"
Write-Host "  build/sites-vite-plugin.ts, .openai/hosting.json"
Write-Host "  package.json, pnpm-lock.yaml, pnpm-workspace.yaml, tsconfig.json, vite.config.ts, README.md"
Write-Host ""
Write-Host "Optional cleanup targets:"
Write-Host "  backups  - remove with -RemoveBackups if you do not want backup snapshots in GitHub"
Write-Host "  examples - remove with -RemoveScaffoldExamples if you do not want starter examples in GitHub"
Write-Host ""

if (-not $Execute) {
  Write-Host "Dry run only. Nothing was deleted."
  Write-Host "To delete the listed default targets, run:"
  Write-Host "  .\cleanupForGithub.ps1 -Execute"
  Write-Host ""
  Write-Host "If these files were already added to Git, run:"
  Write-Host "  .\cleanupForGithub.ps1 -Execute -CleanGitIndex"
  exit 0
}

foreach ($target in $cleanupTargets) {
  Write-Host "Removing $($target.Kind.ToLower()): $($target.RelativePath)"
  Remove-Item -LiteralPath $target.FullPath -Force -Recurse
}

if ($CleanGitIndex -and $cleanupTargets.Count -gt 0) {
  Write-Host ""
  Write-Host "Removing cleanup targets from the Git index if they were already added..."

  foreach ($target in $cleanupTargets) {
    & git -C $ProjectRootFull rm --cached -r --ignore-unmatch -- $target.RelativePath | Out-Host
  }
}

Write-Host ""
Write-Host "Cleanup complete."
