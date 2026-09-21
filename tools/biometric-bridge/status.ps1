param(
  [string]$InstallRoot = "$env:ProgramData\Ilmgaah\BiometricBridge"
)

$TaskName = "Ilmgaah Biometric Bridge"
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
  $info = Get-ScheduledTaskInfo -TaskName $TaskName
  [PSCustomObject]@{
    Task = $TaskName
    State = $task.State
    LastRunTime = $info.LastRunTime
    LastTaskResult = $info.LastTaskResult
    NextRunTime = $info.NextRunTime
  } | Format-List
} else {
  Write-Host "Scheduled task is not installed." -ForegroundColor Yellow
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
