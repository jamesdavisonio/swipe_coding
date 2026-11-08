# The kanban notifier's Windows logon task (docs/features/notifier.md, criterion 115).
#   npm run notifier:install     registers the task 'kanban-notifier' and starts it now
#   npm run notifier:uninstall   stops and removes it
# The task runs `npm run notifier` (node --watch) from this repository, in a hidden window, at
# James's logon, restarting on failure and with no run-time limit.
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('install', 'uninstall')]
    [string]$Command
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

if ($Command -eq 'install') {
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -WindowStyle Hidden -Command "npm run notifier"' -WorkingDirectory $root
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName 'kanban-notifier' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Kanban decision notifier (npm run notifier)' -Force | Out-Null
    Start-ScheduledTask -TaskName 'kanban-notifier'
    Write-Output "kanban-notifier installed and started from $root"
}
else {
    if (Get-ScheduledTask -TaskName 'kanban-notifier' -ErrorAction SilentlyContinue) {
        Stop-ScheduledTask -TaskName 'kanban-notifier'
        Unregister-ScheduledTask -TaskName 'kanban-notifier' -Confirm:$false
        Write-Output 'kanban-notifier stopped and removed'
    }
    else {
        Write-Output 'kanban-notifier is not installed'
    }
}
