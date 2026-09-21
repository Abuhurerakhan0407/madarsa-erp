param(
  [switch]$KeepData,
  [string]$InstallRoot = "$env:ProgramData\Ilmgaah\BiometricBridge"
)

$ErrorActionPreference = "Stop"
$TaskName = "Ilmgaah Biometric Bridge"
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Run PowerShell as Administrator to uninstall the Ilmgaah Biometric Bridge."
}

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

if ($KeepData -and (Test-Path (Join-Path $InstallRoot "data"))) {
  $backup = "$InstallRoot-data-$(Get-Date -Format yyyyMMdd-HHmmss)"
  Copy-Item (Join-Path $InstallRoot "data") $backup -Recurse -Force
  Write-Host "Bridge operational data preserved at $backup"
}

if (Test-Path $InstallRoot) { Remove-Item $InstallRoot -Recurse -Force }
Write-Host "Ilmgaah Biometric Bridge uninstalled." -ForegroundColor Green
