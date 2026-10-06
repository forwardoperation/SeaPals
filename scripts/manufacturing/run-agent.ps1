$ErrorActionPreference = 'Stop'
$manufacturingRepo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$manufacturingPrivate = Join-Path $manufacturingRepo '.private/manufacturing'
Set-Location -LiteralPath $manufacturingRepo
$manufacturingNode = (Get-Command node.exe -ErrorAction Stop).Source
& $manufacturingNode "--env-file=$(Join-Path $manufacturingPrivate 'agent.env')" (Join-Path $PSScriptRoot 'agent.mjs') --config (Join-Path $manufacturingPrivate 'printers.json')
exit $LASTEXITCODE
