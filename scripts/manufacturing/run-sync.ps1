[CmdletBinding()]
param(
    [ValidateRange(1, 10)]
    [int]$BatchSize = 1,
    [ValidateRange(1, 3)]
    [int]$Concurrency = 2
)
$ErrorActionPreference = 'Stop'
$manufacturingRepo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$manufacturingPrivate = Join-Path $manufacturingRepo '.private/manufacturing'
Set-Location -LiteralPath $manufacturingRepo
$manufacturingNode = (Get-Command node.exe -ErrorAction Stop).Source
# Keep every available product in the active release, including Drop Off.
$manufacturingSyncArgs = @("--env-file=$(Join-Path $manufacturingPrivate 'sync.env')", (Join-Path $PSScriptRoot 'sync-figma.mjs'), '--products', 'blue-water,reef-dive-pack,deep-dive-pack,oceanic-dive-pack', '--publish', '--if-changed', '--batch-size', [string]$BatchSize, '--concurrency', [string]$Concurrency)
$manufacturingOverrides = Join-Path $manufacturingPrivate 'figma-overrides.json'
if (Test-Path -LiteralPath $manufacturingOverrides) { $manufacturingSyncArgs += @('--overrides', $manufacturingOverrides) }
& $manufacturingNode @manufacturingSyncArgs
exit $LASTEXITCODE
