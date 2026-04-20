Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$sharedPythonConfigPath = Join-Path $PSScriptRoot "shared-python.path"

$services = @(
  @{
    Name = "auth_service"
    Path = Join-Path $root "services\auth_service"
    UseSharedPython = $false
  },
  @{
    Name = "vehicle_service"
    Path = Join-Path $root "services\vehicle_service"
    UseSharedPython = $true
  },
  @{
    Name = "vin_service"
    Path = Join-Path $root "services\vin_service"
    UseSharedPython = $true
  },
  @{
    Name = "valuation_service"
    Path = Join-Path $root "services\valuation_service"
    UseSharedPython = $true
  }
)

function Get-SharedPythonPath {
  if ($env:CARSPECS_SHARED_PYTHON) {
    $envPath = $env:CARSPECS_SHARED_PYTHON.Trim()
    if (Test-Path $envPath) {
      return (Resolve-Path $envPath).Path
    }
  }

  if (Test-Path $sharedPythonConfigPath) {
    $configuredPath = (Get-Content $sharedPythonConfigPath -Raw).Trim()
    if ($configuredPath) {
      $candidatePath = $configuredPath

      if (-not [System.IO.Path]::IsPathRooted($candidatePath)) {
        $candidatePath = Join-Path $root $candidatePath
      }

      if (Test-Path $candidatePath) {
        return (Resolve-Path $candidatePath).Path
      }
    }
  }

  return $null
}

function Get-ServicePythonPath {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$Service,
    [string]$SharedPythonPath
  )

  $localPython = Join-Path $Service.Path ".venv\Scripts\python.exe"
  if (Test-Path $localPython) {
    return $localPython
  }

  if ($Service.UseSharedPython -and $SharedPythonPath) {
    return $SharedPythonPath
  }

  return $null
}

$sharedPythonPath = Get-SharedPythonPath

if (-not $sharedPythonPath) {
  Write-Host "Shared Python for vehicle/vin/valuation services is not configured." -ForegroundColor Yellow
  Write-Host "Create scripts\shared-python.path with the full path to your common python.exe" -ForegroundColor Yellow
  Write-Host "or set CARSPECS_SHARED_PYTHON before running this script." -ForegroundColor Yellow
  Write-Host ""
}

foreach ($service in $services) {
  $pythonPath = Get-ServicePythonPath -Service $service -SharedPythonPath $sharedPythonPath
  $requirementsPath = Join-Path $service.Path "requirements.txt"

  Write-Host ""
  Write-Host "Preparing $($service.Name)..." -ForegroundColor Cyan

  if (-not $pythonPath) {
    Write-Host "  Skipped: python interpreter was not found for this service." -ForegroundColor Yellow
    continue
  }

  Write-Host "  Using Python: $pythonPath" -ForegroundColor DarkCyan
  Write-Host "  Upgrading pip..." -ForegroundColor DarkCyan
  & $pythonPath -m pip install --upgrade pip

  Write-Host "  Installing requirements..." -ForegroundColor DarkCyan
  & $pythonPath -m pip install -r $requirementsPath
}

Write-Host ""
Write-Host "Dependency setup finished." -ForegroundColor Green
Write-Host "Now run .\scripts\start-services.cmd" -ForegroundColor Green
