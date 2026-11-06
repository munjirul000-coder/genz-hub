'use strict';
// Static Windows PowerShell worker. No user text, shell commands, URLs or keys
// are interpolated into the script. A tray icon is created before mic access.
const SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
function Emit($object) { [Console]::Out.WriteLine(($object | ConvertTo-Json -Compress)); [Console]::Out.Flush() }
$icon = $null; $micIcon = $null; $bitmap = $null; $engine = $null; $speaker = $null; $menu = $null
$running = $true; $waiting = $false; $reason = 'UNAVAILABLE'
try {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  Add-Type -AssemblyName System.Speech
  [System.Windows.Forms.Application]::EnableVisualStyles()
  $icon = New-Object System.Windows.Forms.NotifyIcon
  # A distinct red microphone icon, not the separate NOVA server tray icon.
  $bitmap = [System.Drawing.Bitmap]::new(32, 32)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.FillEllipse([System.Drawing.Brushes]::Firebrick, 0, 0, 31, 31)
  $graphics.FillEllipse([System.Drawing.Brushes]::White, 12, 6, 8, 12)
  $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::White, 2)
  $graphics.DrawArc($pen, 9, 9, 14, 13, 0, 180)
  $graphics.DrawLine($pen, 16, 22, 16, 26); $graphics.DrawLine($pen, 12, 26, 20, 26)
  $pen.Dispose(); $graphics.Dispose()
  $micIcon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
  $icon.Icon = $micIcon
  $icon.Text = 'NOVA background voice starting'
  $menu = New-Object System.Windows.Forms.ContextMenuStrip
  $stop = $menu.Items.Add('Stop NOVA background voice')
  $stop.Add_Click({ $script:running = $false })
  $icon.ContextMenuStrip = $menu; $icon.Visible = $true
  $recognizer = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers() | Where-Object { $_.Culture.Name -ieq '__LANGUAGE__' } | Select-Object -First 1
  if ($null -eq $recognizer) { $reason = 'NO_RECOGNIZER'; throw 'No matching Windows recognizer' }
  $speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $base = '__LANGUAGE__'.Split('-')[0]
  $voice = $speaker.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.TwoLetterISOLanguageName -ieq $base } | Select-Object -First 1
  if ($null -eq $voice) { $reason = 'NO_VOICE'; throw 'No matching Windows voice' }
  $speaker.SelectVoice($voice.VoiceInfo.Name)
  $engine = [System.Speech.Recognition.SpeechRecognitionEngine]::new($recognizer)
  $engine.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
  $reason = 'MIC_FAILED'; $engine.SetInputToDefaultAudioDevice(); $reason = 'UNAVAILABLE'
  $icon.Text = 'NOVA background microphone ON - right click to stop'
  Emit @{ type = 'ready'; language = '__LANGUAGE__' }
  # Read raw ASCII JSON on a background stream task. Console.In.ReadLineAsync
  # can block synchronously in Windows PowerShell's synchronized TextReader.
  $inputStream = [Console]::OpenStandardInput()
  $inputBuffer = New-Object byte[] 8192
  $inputText = ''; $pendingSpeech = $null
  $next = $inputStream.ReadAsync($inputBuffer, 0, $inputBuffer.Length)
  function PollInput {
    if (-not $script:next.IsCompleted) { return }
    $count = $script:next.GetAwaiter().GetResult()
    if ($count -le 0) { $script:running = $false; return }
    $script:inputText += [System.Text.Encoding]::ASCII.GetString($script:inputBuffer, 0, $count)
    if ($script:inputText.Length -gt 16000) { $script:running = $false; return }
    while (($index = $script:inputText.IndexOf([char]10)) -ge 0) {
      $line = $script:inputText.Substring(0, $index).Trim()
      $script:inputText = $script:inputText.Substring($index + 1)
      try {
        $command = $line | ConvertFrom-Json
        if ($command.type -eq 'stop') { $script:running = $false }
        elseif ($command.type -eq 'say' -and $script:waiting -and $null -eq $script:pendingSpeech) {
          $script:pendingSpeech = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([string]$command.text64))
        }
      } catch { $script:running = $false }
    }
    $script:next = $script:inputStream.ReadAsync($script:inputBuffer, 0, $script:inputBuffer.Length)
  }
  while ($running) {
    [System.Windows.Forms.Application]::DoEvents()
    PollInput
    if (-not $running) { break }
    if ($null -ne $pendingSpeech -and $waiting) {
      $icon.Text = 'NOVA speaking - mic enabled'
      $prompt = $speaker.SpeakAsync([string]$pendingSpeech); $pendingSpeech = $null
      while ($running -and -not $prompt.IsCompleted) {
        [System.Windows.Forms.Application]::DoEvents(); PollInput
        Start-Sleep -Milliseconds 75
      }
      if (-not $running) { $speaker.SpeakAsyncCancelAll(); break }
      $waiting = $false; $icon.Text = 'NOVA background microphone ON - right click to stop'
      Emit @{ type = 'turn-ready' }
    }
    if (-not $running) { break }
    if ($waiting) { Start-Sleep -Milliseconds 75; continue }
    $result = $engine.Recognize([TimeSpan]::FromSeconds(1.5))
    if ($null -eq $result -or $result.Confidence -lt 0.55) { continue }
    $heard = [string]$result.Text
    if ($heard -notmatch '^\s*(?:(?:hey|হেই|আচ্ছা)\s+)?(?:nova|নোভা|নভা)(?=$|[\s,।.!?:-])') { continue }
    $waiting = $true; $icon.Text = 'NOVA thinking - mic enabled'
    Emit @{ type = 'heard'; text = $heard; confidence = [double]$result.Confidence }
  }
} catch { Emit @{ type = 'error'; code = $reason } }
finally {
  if ($null -ne $engine) { $engine.Dispose() }
  if ($null -ne $speaker) { $speaker.SpeakAsyncCancelAll(); $speaker.Dispose() }
  if ($null -ne $icon) { $icon.Visible = $false; $icon.Dispose() }
  if ($null -ne $menu) { $menu.Dispose() }
  if ($null -ne $micIcon) { $micIcon.Dispose() }
  if ($null -ne $bitmap) { $bitmap.Dispose() }
  Emit @{ type = 'stopped' }
}
`;
function nativeVoiceArgs(language) {
  if (!['en-US', 'bn-BD'].includes(language)) throw new Error('Unsupported language.');
  const script = SCRIPT.replaceAll('__LANGUAGE__', language);
  return ['-NoProfile', '-NonInteractive', '-STA', '-WindowStyle', 'Hidden', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')];
}
module.exports = { nativeVoiceArgs };
