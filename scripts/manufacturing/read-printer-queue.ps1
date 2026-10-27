param(
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$PrinterName,
  [string]$DocumentPath,
  [string]$SinceUtc
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
# Read-only. Never changes a queue, printer, service, or event-log setting.
$printer = @(Get-Printer -ErrorAction Stop | Where-Object { $_.Name -ceq $PrinterName })
if ($printer.Count -ne 1) { throw 'The configured printer was not found exactly once.' }
$jobs = @(Get-PrintJob -PrinterObject $printer[0] -ErrorAction Stop | ForEach-Object {
  [ordered]@{
    id = [uint32]$_.ID
    status = [uint32]$_.JobStatus
    size = [uint64]$_.Size
    totalPages = [uint32]$_.TotalPages
    pagesPrinted = [uint32]$_.PagesPrinted
    matchesDocument = [bool]($DocumentPath -and [string]::Equals($_.DocumentName, $DocumentPath, [StringComparison]::OrdinalIgnoreCase))
  }
})
$failures = @()
if ($DocumentPath -and $SinceUtc) {
  $since = [DateTimeOffset]::Parse($SinceUtc, [Globalization.CultureInfo]::InvariantCulture).UtcDateTime
  try {
    $events = @(Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-PrintService/Admin'; Id = 372; StartTime = $since } -MaxEvents 200 -ErrorAction Stop)
  } catch {
    if ($_.FullyQualifiedErrorId -like 'NoMatchingEventsFound*') { $events = @() } else { throw }
  }
  foreach ($event in $events) {
    [xml]$xml = $event.ToXml()
    $data = $xml.Event.UserData.PrintOnProcFailedEd
    # Event 372 has no job ID. Only match our exact PDF path AND printer;
    # generic or foreign document failures must not be attributed to this page.
    if ([string]::Equals([string]$data.Param1, $DocumentPath, [StringComparison]::OrdinalIgnoreCase) -and
        [string]::Equals([string]$data.Param3, $PrinterName, [StringComparison]::OrdinalIgnoreCase)) {
      $failures += [ordered]@{
        recordId = [long]$event.RecordId
        timeCreated = $event.TimeCreated.ToUniversalTime().ToString('o')
        errorCode = [string]$data.Param10
      }
    }
  }
}
# Do not expose document names, owners, or unrelated event messages.
[ordered]@{
  printerName = [string]$printer[0].Name
  printerStatus = [uint32]$printer[0].PrinterStatus
  jobCount = [uint32]$printer[0].JobCount
  jobs = $jobs
  failures = $failures
} | ConvertTo-Json -Depth 5 -Compress
