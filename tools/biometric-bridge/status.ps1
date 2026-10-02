param(
  [string]$InstanceName = "default",
  [string]$InstallRoot = ""
)

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

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
  $info = Get-ScheduledTaskInfo -TaskName $TaskName
  [PSCustomObject]@{
    Instance = $SafeInstanceName
    Task = $TaskName
    State = $task.State
    LastRunTime = $info.LastRunTime
    LastTaskResult = $info.LastTaskResult
    NextRunTime = $info.NextRunTime
  } | Format-List
} else {
  Write-Host "Scheduled task is not installed for instance $SafeInstanceName." -ForegroundColor Yellow
}

$health = Join-Path $InstallRoot "data\health.json"
if (Test-Path $health) {
  Write-Host "Health:" -ForegroundColor Cyan
  Get-Content $health -Raw | ConvertFrom-Json | Format-List
} else {
  Write-Host "No health file yet." -ForegroundColor Yellow
}

$log = Join-Path $InstallRoot "data\logs\bridge.jsonl"
if (Test-Path $log) {
  Write-Host "Recent bridge events:" -ForegroundColor Cyan
  Get-Content $log -Tail 20
}
