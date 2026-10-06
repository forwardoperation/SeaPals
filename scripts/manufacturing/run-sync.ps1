$ErrorActionPreference = 'Stop'
$manufacturingRepo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$manufacturingPrivate = Join-Path $manufacturingRepo '.private/manufacturing'
Set-Location -LiteralPath $manufacturingRepo
$manufacturingNode = (Get-Command node.exe -ErrorAction Stop).Source
$manufacturingSyncArgs = @("--env-file=$(Join-Path $manufacturingPrivate 'sync.env')", (Join-Path $PSScriptRoot 'sync-figma.mjs'), '--publish', '--if-changed')
$manufacturingOverrides = Join-Path $manufacturingPrivate 'figma-overrides.json'
if (Test-Path -LiteralPath $manufacturingOverrides) { $manufacturingSyncArgs += @('--overrides', $manufacturingOverrides) }
& $manufacturingNode @manufacturingSyncArgs
exit $LASTEXITCODE
