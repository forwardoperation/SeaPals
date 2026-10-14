[CmdletBinding()]
param(
    [ValidateRange(1, 10)]
    [int]$BatchSize = 10
)
$ErrorActionPreference = 'Stop'
$manufacturingRepo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$manufacturingPrivate = Join-Path $manufacturingRepo '.private/manufacturing'
Set-Location -LiteralPath $manufacturingRepo
$manufacturingNode = (Get-Command node.exe -ErrorAction Stop).Source
$manufacturingSyncArgs = @("--env-file=$(Join-Path $manufacturingPrivate 'sync.env')", (Join-Path $PSScriptRoot 'sync-figma.mjs'), '--publish', '--if-changed', '--batch-size', [string]$BatchSize)
$manufacturingOverrides = Join-Path $manufacturingPrivate 'figma-overrides.json'
if (Test-Path -LiteralPath $manufacturingOverrides) { $manufacturingSyncArgs += @('--overrides', $manufacturingOverrides) }
& $manufacturingNode @manufacturingSyncArgs
exit $LASTEXITCODE
