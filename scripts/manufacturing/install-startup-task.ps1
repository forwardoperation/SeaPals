# Run once after calibrating both printers. This does not start printing now.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$manufacturingRepo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$manufacturingConfig = Join-Path $manufacturingRepo '.private/manufacturing/printers.json'
$manufacturingSettings = Get-Content -LiteralPath $manufacturingConfig -Raw | ConvertFrom-Json
if ($manufacturingSettings.calibrationConfirmed -ne $true) { throw 'Calibrate both printers and confirm printers.json before installing the startup task.' }
if (-not (Test-Path -LiteralPath (Join-Path $manufacturingRepo '.private/manufacturing/agent.env'))) { throw 'The local device credential is missing.' }
$manufacturingUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$manufacturingAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}"' -f (Join-Path $PSScriptRoot 'run-agent.ps1')) -WorkingDirectory $manufacturingRepo
$manufacturingTrigger = New-ScheduledTaskTrigger -AtLogOn -User $manufacturingUser
$manufacturingPrincipal = New-ScheduledTaskPrincipal -UserId $manufacturingUser -LogonType Interactive -RunLevel Limited
$manufacturingTaskSettings = New-ScheduledTaskSettingsSet -Hidden -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'SeaRealm Manufacturing Agent' -Action $manufacturingAction -Trigger $manufacturingTrigger -Principal $manufacturingPrincipal -Settings $manufacturingTaskSettings -Description 'Print paid SeaRealm orders using the calibrated local Epson and Canon profiles.' | Out-Null
Write-Output 'Registered the manufacturing agent for your next Windows sign-in. It has not been started.'
