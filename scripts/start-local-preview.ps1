[CmdletBinding()]
param(
  [int]$Port = 3000,
  [switch]$LocalNetwork,
  [switch]$OpenBrowser,
  [string]$NodePath
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$VinextCli = Join-Path $ProjectRoot "node_modules\vinext\dist\cli.js"
$LogPath = Join-Path $ProjectRoot ".local-preview.log"
$ErrorLogPath = Join-Path $ProjectRoot ".local-preview.err.log"

function Find-NodeRuntime {
  param([string]$PreferredPath)

  if ($PreferredPath) {
    if (Test-Path $PreferredPath) {
      return (Resolve-Path $PreferredPath).Path
    }

    throw "The supplied Node path does not exist: $PreferredPath"
  }

  $pathNode = Get-Command node.exe -ErrorAction SilentlyContinue

  if ($pathNode) {
    return $pathNode.Source
  }

  $codexNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

  if (Test-Path $codexNode) {
    return $codexNode
  }

  return $null
}

function Test-PortInUse {
  param([int]$PortNumber)

  try {
    $listeners = @(Get-NetTCPConnection -LocalPort $PortNumber -State Listen -ErrorAction SilentlyContinue)
    return $listeners.Count -gt 0
  } catch {
    return $false
  }
}

function Get-NetworkUrls {
  param([int]$PortNumber)

  try {
    Get-NetIPAddress -AddressFamily IPv4 |
      Where-Object {
        $_.IPAddress -notmatch "^(127\.|169\.254\.)" -and
        $_.AddressState -eq "Preferred"
      } |
      Select-Object -ExpandProperty IPAddress -Unique |
      ForEach-Object { "http://$($_):$PortNumber/" }
  } catch {
    @()
  }
}

$NodeExe = Find-NodeRuntime -PreferredPath $NodePath

if (-not $NodeExe) {
  throw "Node.js was not found. Install Node.js 22.13.0 or later, or run from Codex after the bundled runtime is available."
}

if (-not (Test-Path $VinextCli)) {
  throw "Project dependencies are missing. Run npm install or pnpm install from $ProjectRoot, then start the preview again."
}

if (Test-PortInUse -PortNumber $Port) {
  Write-Host "Port $Port is already in use."
  Write-Host "Try http://localhost:$Port/ or start on another port with: .\scripts\start-local-preview.ps1 -Port 3001"
  return
}

$HostAddress = if ($LocalNetwork) { "0.0.0.0" } else { "127.0.0.1" }
$LocalUrl = "http://localhost:$Port/"
$ArgumentLine = "`"$VinextCli`" dev --host $HostAddress --port $Port"

Set-Location $ProjectRoot

$process = Start-Process `
  -FilePath $NodeExe `
  -ArgumentList $ArgumentLine `
  -WorkingDirectory $ProjectRoot `
  -RedirectStandardOutput $LogPath `
  -RedirectStandardError $ErrorLogPath `
  -WindowStyle Hidden `
  -PassThru

$deadline = (Get-Date).AddSeconds(45)
$ready = $false

while ((Get-Date) -lt $deadline) {
  if ($process.HasExited) {
    break
  }

  try {
    $response = Invoke-WebRequest -Uri $LocalUrl -UseBasicParsing -TimeoutSec 2

    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
      $ready = $true
      break
    }
  } catch {
    Start-Sleep -Seconds 1
  }
}

if (-not $ready) {
  Write-Host "The preview process started but did not become ready within 45 seconds."
  Write-Host "Process ID: $($process.Id)"
  Write-Host "Log: $LogPath"
  Write-Host "Error log: $ErrorLogPath"

  if (Test-Path $ErrorLogPath) {
    Write-Host ""
    Write-Host "Recent errors:"
    Get-Content $ErrorLogPath -Tail 20
  }

  exit 1
}

Write-Host "SCOM MP Reference preview is running."
Write-Host "Local URL: $LocalUrl"
Write-Host "Process ID: $($process.Id)"
Write-Host "Log: $LogPath"
Write-Host "Error log: $ErrorLogPath"

if ($LocalNetwork) {
  $networkUrls = @(Get-NetworkUrls -PortNumber $Port)

  if ($networkUrls.Count) {
    Write-Host "Local network URLs:"
    $networkUrls | ForEach-Object { Write-Host "  $_" }
  } else {
    Write-Host "Local network mode is enabled. Use this computer's IPv4 address with port $Port."
  }

  Write-Host "Windows Firewall may need to allow inbound access to this port."
}

if ($OpenBrowser) {
  Start-Process $LocalUrl
}
