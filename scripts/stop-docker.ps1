Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Stopping CarSpecs stack..." -ForegroundColor Yellow
docker compose down
