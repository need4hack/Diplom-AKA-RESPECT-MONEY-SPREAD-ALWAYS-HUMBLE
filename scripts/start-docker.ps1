Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Starting CarSpecs stack via Docker Compose..." -ForegroundColor Cyan
docker compose up -d --build

Write-Host ""
Write-Host "Services are starting:" -ForegroundColor Green
Write-Host "  App:   http://localhost"
Write-Host "  Next:  http://localhost:3000"
Write-Host "  Auth:  http://localhost:8004"
Write-Host "  Veh:   http://localhost:8001"
Write-Host "  VIN:   http://localhost:8002"
Write-Host "  Val:   http://localhost:8003"
