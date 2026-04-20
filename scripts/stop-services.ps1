Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ports = @(8001, 8002, 8003, 8004)

foreach ($port in $ports) {
  $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($connection in $connections) {
    try {
      Stop-Process -Id $connection.OwningProcess -Force -ErrorAction Stop
      Write-Host "Stopped process on port $port (PID $($connection.OwningProcess))." -ForegroundColor Yellow
    } catch {
      Write-Host "Could not stop process on port $port (PID $($connection.OwningProcess))." -ForegroundColor Red
    }
  }
}
