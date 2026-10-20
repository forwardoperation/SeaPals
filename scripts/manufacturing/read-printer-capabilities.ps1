param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$PrinterName
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# This reads a normalized, in-memory DEVMODE. It never changes saved defaults
# and never calls StartDoc or StartPage.
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class ManufacturingPrinterCapabilities {
  [DllImport("winspool.drv", EntryPoint="OpenPrinterW", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
  [DllImport("winspool.drv", SetLastError=true)]
  static extern bool ClosePrinter(IntPtr handle);
  [DllImport("winspool.drv", EntryPoint="DocumentPropertiesW", CharSet=CharSet.Unicode)]
  static extern int DocumentProperties(IntPtr hwnd, IntPtr printer, string name, IntPtr output, IntPtr input, int mode);
  [DllImport("gdi32.dll", EntryPoint="CreateDCW", CharSet=CharSet.Unicode)]
  static extern IntPtr CreateDC(string driver, string device, string output, IntPtr devMode);
  [DllImport("gdi32.dll")]
  static extern bool DeleteDC(IntPtr dc);
  [DllImport("gdi32.dll")]
  static extern int GetDeviceCaps(IntPtr dc, int index);

  public static object Read(string name) {
    IntPtr printer = IntPtr.Zero, mode = IntPtr.Zero, dc = IntPtr.Zero;
    try {
      if (!OpenPrinter(name, out printer, IntPtr.Zero))
        throw new InvalidOperationException("Could not read printer defaults.");
      int size = DocumentProperties(IntPtr.Zero, printer, name, IntPtr.Zero, IntPtr.Zero, 0);
      if (size < 220)
        throw new InvalidOperationException("Invalid printer DEVMODE size.");
      mode = Marshal.AllocHGlobal(size);
      const int DM_OUT_BUFFER = 2, DM_IN_BUFFER = 8;
      if (DocumentProperties(IntPtr.Zero, printer, name, mode, IntPtr.Zero, DM_OUT_BUFFER) != 1)
        throw new InvalidOperationException("Could not read printer DEVMODE.");

      // Sumatra keeps the driver's saved orientation. Reject a landscape
      // default before normalization can hide it from the capability check.
      if ((Marshal.ReadInt32(mode, 72) & 0x1) == 0 || Marshal.ReadInt16(mode, 76) != 1)
        throw new InvalidOperationException("The printer default must use portrait orientation.");
      // DEVMODEW offsets: fields 72, orientation 76, paper size 78,
      // color 92, duplex 94. Match the Letter/portrait/color/simplex route.
      int fields = Marshal.ReadInt32(mode, 72) | 0x1 | 0x2 | 0x800 | 0x1000;
      Marshal.WriteInt32(mode, 72, fields);
      Marshal.WriteInt16(mode, 76, 1);
      Marshal.WriteInt16(mode, 78, 1);
      Marshal.WriteInt16(mode, 92, 2);
      Marshal.WriteInt16(mode, 94, 1);
      if (DocumentProperties(IntPtr.Zero, printer, name, mode, mode, DM_IN_BUFFER | DM_OUT_BUFFER) != 1)
        throw new InvalidOperationException("Could not normalize printer DEVMODE.");
      dc = CreateDC(null, name, null, mode);
      if (dc == IntPtr.Zero)
        throw new InvalidOperationException("Could not read printer capabilities.");
      return new {
        paperSize = Marshal.ReadInt16(mode, 78),
        orientation = Marshal.ReadInt16(mode, 76),
        rasterDpiX = GetDeviceCaps(dc, 88),
        rasterDpiY = GetDeviceCaps(dc, 90),
        physicalWidth = GetDeviceCaps(dc, 110),
        physicalHeight = GetDeviceCaps(dc, 111),
        offsetX = GetDeviceCaps(dc, 112),
        offsetY = GetDeviceCaps(dc, 113),
        printableWidth = GetDeviceCaps(dc, 8),
        printableHeight = GetDeviceCaps(dc, 10)
      };
    } finally {
      if (dc != IntPtr.Zero) DeleteDC(dc);
      if (mode != IntPtr.Zero) Marshal.FreeHGlobal(mode);
      if (printer != IntPtr.Zero) ClosePrinter(printer);
    }
  }
}
"@

[ManufacturingPrinterCapabilities]::Read($PrinterName) | ConvertTo-Json -Compress
