param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$PrinterName
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.Printing
Add-Type -AssemblyName ReachFramework

# GetPrintCapabilities reports PageImageableArea in 1/96-inch units from the
# physical page's top-left. Only an in-memory ticket is normalized; there is no
# Commit, UserPrintTicket assignment, print job, or printer preference write.
# https://learn.microsoft.com/dotnet/api/system.printing.printcapabilities.pageimageablearea
$server = New-Object System.Printing.LocalPrintServer
$queue = $null
try {
  $queue = $server.GetPrintQueue($PrinterName)
  if ($queue.Name -cne $PrinterName) { throw 'The imageable-area query returned a different printer.' }
  $baseTicket = $queue.UserPrintTicket
  if ($null -eq $baseTicket) { throw 'The current user printer ticket is unavailable.' }
  if ($baseTicket.PageOrientation -ne [System.Printing.PageOrientation]::Portrait) {
    throw 'The printer default must use portrait orientation.'
  }
  $delta = $baseTicket.Clone()
  $delta.PageMediaSize = New-Object System.Printing.PageMediaSize([System.Printing.PageMediaSizeName]::NorthAmericaLetter)
  $delta.PageOrientation = [System.Printing.PageOrientation]::Portrait
  $delta.OutputColor = [System.Printing.OutputColor]::Color
  $delta.Duplexing = [System.Printing.Duplexing]::OneSided
  # Query the normalized clone directly. Some GDI drivers strip the explicit
  # OneSided field when merging tickets; Sumatra applies simplex through GDI.
  $ticket = $delta
  $capabilities = $queue.GetPrintCapabilities($ticket)
  $area = $capabilities.PageImageableArea
  if ($null -eq $area -or $null -eq $ticket.PageResolution) {
    throw 'The printer did not report its imageable area and resolution.'
  }
  [pscustomobject]@{
    printerName = $queue.Name
    mediaSize = [string]$ticket.PageMediaSize.PageMediaSizeName
    orientation = [string]$ticket.PageOrientation
    color = [string]$ticket.OutputColor
    duplex = [string]$ticket.Duplexing
    resolutionX = $ticket.PageResolution.X
    resolutionY = $ticket.PageResolution.Y
    area = [pscustomobject]@{
      unit = 'dip96'
      pageWidth = $capabilities.OrientedPageMediaWidth
      pageHeight = $capabilities.OrientedPageMediaHeight
      originX = $area.OriginWidth
      originY = $area.OriginHeight
      width = $area.ExtentWidth
      height = $area.ExtentHeight
    }
  } | ConvertTo-Json -Depth 3 -Compress
} finally {
  if ($null -ne $queue) { $queue.Dispose() }
  $server.Dispose()
}