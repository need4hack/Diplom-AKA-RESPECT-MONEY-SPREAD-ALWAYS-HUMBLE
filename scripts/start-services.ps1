Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$sharedPythonConfigPath = Join-Path $PSScriptRoot "shared-python.path"

$services = @(
  @{
    Name = "auth_service"
    Path = Join-Path $root "services\auth_service"
    Port = 8004
    UseSharedPython = $false
  },
  @{
    Name = "vehicle_service"
    Path = Join-Path $root "services\vehicle_service"
    Port = 8001
    UseSharedPython = $true
  },
  @{
    Name = "vin_service"
    Path = Join-Path $root "services\vin_service"
    Port = 8002
    UseSharedPython = $true
  },
  @{
    Name = "valuation_service"
    Path = Join-Path $root "services\valuation_service"
    Port = 8003
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

foreach ($service in $services) {
  $pythonPath = Get-ServicePythonPath -Service $service -SharedPythonPath $sharedPythonPath
  if (-not $pythonPath) {
    Write-Host "Skipped $($service.Name): Python interpreter was not configured." -ForegroundColor Yellow
    Write-Host "Auth expects services\auth_service\.venv\Scripts\python.exe." -ForegroundColor Yellow
    Write-Host "Other services expect a shared python from scripts\shared-python.path or CARSPECS_SHARED_PYTHON." -ForegroundColor Yellow
    continue
  }

  $command = @"
Set-Location '$($service.Path)'
Write-Host 'Starting $($service.Name) on port $($service.Port)...' -ForegroundColor Cyan
& '$pythonPath' manage.py runserver 0.0.0.0:$($service.Port)
"@

  Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-Command", $command
  ) -WorkingDirectory $service.Path | Out-Null
}

Write-Host ""
Write-Host "Attempted to open service windows:" -ForegroundColor Green
Write-Host "  auth_service      -> http://127.0.0.1:8004"
Write-Host "  vehicle_service   -> http://127.0.0.1:8001"
Write-Host "  vin_service       -> http://127.0.0.1:8002"
Write-Host "  valuation_service -> http://127.0.0.1:8003"
Write-Host ""
Write-Host "If vehicle/vin/valuation were skipped, create scripts\shared-python.path with the full path to your common python.exe." -ForegroundColor Yellow
