# Run once after configuring private Figma/publishing credentials and mappings.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$manufacturingRepo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if (-not (Test-Path -LiteralPath (Join-Path $manufacturingRepo '.private/manufacturing/sync.env'))) { throw 'Create the private sync.env with FIGMA_ACCESS_TOKEN and STORE_ADMIN_TOKEN first.' }
$manufacturingUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$manufacturingAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}"' -f (Join-Path $PSScriptRoot 'run-sync.ps1')) -WorkingDirectory $manufacturingRepo
$manufacturingTrigger = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(2)) -RepetitionInterval (New-TimeSpan -Hours 1)
$manufacturingPrincipal = New-ScheduledTaskPrincipal -UserId $manufacturingUser -LogonType Interactive -RunLevel Limited
$manufacturingTaskSettings = New-ScheduledTaskSettingsSet -Hidden -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 55)
Register-ScheduledTask -TaskName 'SeaRealm Figma Print Artwork Sync' -Action $manufacturingAction -Trigger $manufacturingTrigger -Principal $manufacturingPrincipal -Settings $manufacturingTaskSettings -Description 'Publish changed, versioned Figma PNGs to private SeaRealm manufacturing storage.' | Out-Null
Write-Output 'Registered hourly private artwork sync while this Windows account is signed in.'
