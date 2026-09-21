param(
  [Parameter(Mandatory=$true)]
  [string]$ConfigPath,
  [string]$InstallRoot = "$env:ProgramData\Ilmgaah\BiometricBridge"
)

$ErrorActionPreference = "Stop"
$TaskName = "Ilmgaah Biometric Bridge"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Run PowerShell as Administrator to install the Ilmgaah Biometric Bridge."
}

$SourceRoot = $PSScriptRoot
foreach ($required in @("node.exe", "bridge.cjs")) {
  if (-not (Test-Path (Join-Path $SourceRoot $required))) {
    throw "Missing $required in the bridge package."
  }
}

$ResolvedConfig = (Resolve-Path $ConfigPath).Path
$Config = Get-Content $ResolvedConfig -Raw | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace($Config.baseUrl) -or $Config.baseUrl -match "YOUR-ILMGAAH|example") {
  throw "Set baseUrl in the bridge config before installation."
}
if ([string]::IsNullOrWhiteSpace($Config.ingestToken) -or $Config.ingestToken -match "REPLACE") {
  throw "Set the Ilmgaah device ingest token before installation."
}
if (-not (Test-Path $Config.watchFolder)) {
  throw "The configured biometric export folder does not exist: $($Config.watchFolder)"
}

New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $InstallRoot "data") | Out-Null
Copy-Item (Join-Path $SourceRoot "node.exe") (Join-Path $InstallRoot "node.exe") -Force
Copy-Item (Join-Path $SourceRoot "bridge.cjs") (Join-Path $InstallRoot "bridge.cjs") -Force
Copy-Item $ResolvedConfig (Join-Path $InstallRoot "config.json") -Force
foreach ($optional in @("status.ps1", "uninstall.ps1", "README.md", "SHA256SUMS.txt")) {
  $source = Join-Path $SourceRoot $optional
  if (Test-Path $source) { Copy-Item $source (Join-Path $InstallRoot $optional) -Force }
}

# Restrict the installation, token-bearing config, queue and logs to SYSTEM + local Administrators.
& icacls.exe $InstallRoot /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" /T /C | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Unable to apply secure filesystem permissions." }

$Node = Join-Path $InstallRoot "node.exe"
$Bridge = Join-Path $InstallRoot "bridge.cjs"
$InstalledConfig = Join-Path $InstallRoot "config.json"
& $Node $Bridge --config $InstalledConfig --validate
if ($LASTEXITCODE -ne 0) { throw "Bridge configuration validation failed." }

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$arguments = ('"{0}" --config "{1}"' -f $Bridge, $InstalledConfig)
$action = New-ScheduledTaskAction -Execute $Node -Argument $arguments -WorkingDirectory $InstallRoot
$trigger = New-ScheduledTaskTrigger -AtStartup
$taskPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $taskPrincipal -Settings $settings -Description "Watches biometric attendance exports and securely sends normalized punches to Ilmgaah." | Out-Null
Start-ScheduledTask -TaskName $TaskName

Write-Host "Ilmgaah Biometric Bridge installed." -ForegroundColor Green
Write-Host "Task: $TaskName"
Write-Host "Install root: $InstallRoot"
Write-Host "No inbound firewall port is required. The bridge only makes outbound HTTPS requests."
