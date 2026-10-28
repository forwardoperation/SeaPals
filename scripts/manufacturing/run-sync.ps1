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
# Keep all decks, Conditions, packs, and their kit/accessory aliases in one release.
$manufacturingSyncArgs = @("--env-file=$(Join-Path $manufacturingPrivate 'sync.env')", (Join-Path $PSScriptRoot 'sync-figma.mjs'), '--products', 'coral-garden,blue-water,darkness-shroud,open-ocean-hunt,murky-water,stinging-fortress,disruption,starter-kit,accessory-set,conditions-deck,dice-pack,reef-point-tokens,reef-dive-pack,deep-dive-pack,oceanic-dive-pack', '--publish', '--if-changed', '--batch-size', [string]$BatchSize, '--concurrency', [string]$Concurrency)
$manufacturingOverrides = Join-Path $manufacturingPrivate 'figma-overrides.json'
if (Test-Path -LiteralPath $manufacturingOverrides) { $manufacturingSyncArgs += @('--overrides', $manufacturingOverrides) }
& $manufacturingNode @manufacturingSyncArgs
exit $LASTEXITCODE
