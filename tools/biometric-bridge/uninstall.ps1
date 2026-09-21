param(
  [switch]$KeepData,
  [string]$InstanceName = "default",
  [string]$InstallRoot = ""
)

$ErrorActionPreference = "Stop"

$InstanceName = $InstanceName.Trim()
if ([string]::IsNullOrWhiteSpace($InstanceName)) { throw "InstanceName cannot be empty." }
$SafeInstanceName = $InstanceName -replace '[^A-Za-z0-9._-]', '-'
if ($SafeInstanceName.Length -gt 48) { throw "InstanceName must be 48 characters or fewer." }

if ([string]::IsNullOrWhiteSpace($InstallRoot)) {
  $InstallRoot = if ($SafeInstanceName -eq "default") {
    "$env:ProgramData\Ilmgaah\BiometricBridge"
  } else {
    "$env:ProgramData\Ilmgaah\BiometricBridge\$SafeInstanceName"
  }
}
$TaskName = if ($SafeInstanceName -eq "default") {
  "Ilmgaah Biometric Bridge"
} else {
  "Ilmgaah Biometric Bridge - $SafeInstanceName"
}

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
Write-Host "Ilmgaah Biometric Bridge instance $SafeInstanceName uninstalled." -ForegroundColor Green
