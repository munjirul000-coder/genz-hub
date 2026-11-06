'use strict';
// Static Windows worker. It creates a visible tray control before receiving a
// capture request. No user text, credentials, paths, or model output are used.
const SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
function Emit($o) { [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress)); [Console]::Out.Flush() }
$icon = $null; $menu = $null; $symbol = $null; $iconHandle = [IntPtr]::Zero; $art = $null; $parent = $null; $running = $true
try {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public static class NovaDpi { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); [DllImport("user32.dll")] public static extern bool DestroyIcon(System.IntPtr h); }'
  [void][NovaDpi]::SetProcessDPIAware()
  [System.Windows.Forms.Application]::EnableVisualStyles()
  $parent = [System.Diagnostics.Process]::GetProcessById(__PARENT_PID__)
  $art = [System.Drawing.Bitmap]::new(32, 32)
  $g = [System.Drawing.Graphics]::FromImage($art)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.FillEllipse([System.Drawing.Brushes]::DarkOrange, 0, 0, 31, 31)
  $g.FillRectangle([System.Drawing.Brushes]::White, 6, 8, 20, 14)
  $g.FillRectangle([System.Drawing.Brushes]::DarkOrange, 8, 10, 16, 10)
  $g.FillRectangle([System.Drawing.Brushes]::White, 14, 22, 4, 3)
  $g.FillRectangle([System.Drawing.Brushes]::White, 10, 25, 12, 2)
  $g.Dispose()
  $iconHandle = $art.GetHicon(); $symbol = [System.Drawing.Icon]::FromHandle($iconHandle)
  $icon = New-Object System.Windows.Forms.NotifyIcon
  $icon.Icon = $symbol; $icon.Text = 'NOVA screen access ON - right click to stop'
  $menu = New-Object System.Windows.Forms.ContextMenuStrip
  $stop = $menu.Items.Add('Stop NOVA screen access')
  $stop.Add_Click({ $script:running = $false })
  $icon.ContextMenuStrip = $menu; $icon.Visible = $true
  $inputStream = [Console]::OpenStandardInput(); $buffer = New-Object byte[] 4096; $pending = ''
  $next = $inputStream.ReadAsync($buffer, 0, $buffer.Length)
  Emit @{ type = 'ready' }
  while ($running) {
    [System.Windows.Forms.Application]::DoEvents()
    try { if ($parent.HasExited) { break } } catch { break }
    if (-not $next.IsCompleted) { Start-Sleep -Milliseconds 75; continue }
    $count = $next.GetAwaiter().GetResult()
    if ($count -le 0) { break }
    $pending += [System.Text.Encoding]::ASCII.GetString($buffer, 0, $count)
    if ($pending.Length -gt 8192) { break }
    while ($running -and ($index = $pending.IndexOf([char]10)) -ge 0) {
      $line = $pending.Substring(0, $index).Trim(); $pending = $pending.Substring($index + 1)
      $command = $line | ConvertFrom-Json
      if ($command.type -eq 'stop') { $running = $false; break }
      if ($command.type -ne 'capture' -or [string]$command.id -notmatch '^[a-f0-9]{32}$') { $running = $false; break }
      $source = $null; $resized = $null; $draw = $null; $resizeDraw = $null; $memory = $null; $encoderParams = $null
      try {
        $icon.Text = 'NOVA capturing screen now'
        [System.Windows.Forms.Application]::DoEvents()
        if (-not $running) { break }
        $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        if ($bounds.Width -le 0 -or $bounds.Height -le 0 -or $bounds.Width -gt 16384 -or $bounds.Height -gt 16384 -or ([long]$bounds.Width * [long]$bounds.Height) -gt 40000000) { throw 'Screen unavailable' }
        $source = [System.Drawing.Bitmap]::new($bounds.Width, $bounds.Height)
        $draw = [System.Drawing.Graphics]::FromImage($source)
        $draw.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
        $scale = [Math]::Min(1.0, [Math]::Min(1024.0 / $bounds.Width, 768.0 / $bounds.Height))
        $width = [Math]::Max(1, [int][Math]::Round($bounds.Width * $scale)); $height = [Math]::Max(1, [int][Math]::Round($bounds.Height * $scale))
        $resized = [System.Drawing.Bitmap]::new($width, $height)
        $resizeDraw = [System.Drawing.Graphics]::FromImage($resized)
        $resizeDraw.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $resizeDraw.DrawImage($source, 0, 0, $width, $height)
        $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
        if ($null -eq $codec) { throw 'JPEG unavailable' }
        $encoderParams = [System.Drawing.Imaging.EncoderParameters]::new(1)
        $encoderParams.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality, [long]65)
        $memory = [System.IO.MemoryStream]::new(); $resized.Save($memory, $codec, $encoderParams)
        if ($memory.Length -lt 4 -or $memory.Length -gt 600000) { throw 'Frame unavailable' }
        [System.Windows.Forms.Application]::DoEvents()
        if (-not $running) { break }
        Emit @{ type = 'frame'; id = [string]$command.id; image = [Convert]::ToBase64String($memory.ToArray()) }
      } catch { Emit @{ type = 'capture-error'; id = [string]$command.id } }
      finally {
        if ($null -ne $memory) { $memory.Dispose() }; if ($null -ne $encoderParams) { $encoderParams.Dispose() }
        if ($null -ne $resizeDraw) { $resizeDraw.Dispose() }; if ($null -ne $resized) { $resized.Dispose() }
        if ($null -ne $draw) { $draw.Dispose() }; if ($null -ne $source) { $source.Dispose() }
        $icon.Text = 'NOVA screen access ON - right click to stop'
      }
    }
    if ($running) { $next = $inputStream.ReadAsync($buffer, 0, $buffer.Length) }
  }
} catch { Emit @{ type = 'error' } }
finally {
  if ($null -ne $icon) { $icon.Visible = $false; $icon.Dispose() }; if ($null -ne $menu) { $menu.Dispose() }
  if ($null -ne $symbol) { $symbol.Dispose() }; if ($iconHandle -ne [IntPtr]::Zero) { [void][NovaDpi]::DestroyIcon($iconHandle) }; if ($null -ne $art) { $art.Dispose() }; if ($null -ne $parent) { $parent.Dispose() }
  Emit @{ type = 'stopped' }
}
`;
function nativeScreenArgs(pid = process.pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) throw new Error('Invalid parent process.');
  return ['-NoProfile', '-NonInteractive', '-STA', '-WindowStyle', 'Hidden', '-EncodedCommand', Buffer.from(SCRIPT.replace('__PARENT_PID__', String(pid)), 'utf16le').toString('base64')];
}
module.exports = { nativeScreenArgs };
