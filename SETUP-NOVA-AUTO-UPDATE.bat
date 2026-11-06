@echo off
setlocal
title NOVA One-Time Auto-Update Setup

echo This one-time setup adds automatic updates to your existing NOVA.
echo It does not replace your data, memory, Groq key, or bridge token.
echo Close the old NOVA and bridge terminal windows before continuing.
echo The setup downloads trusted code from the NOVA GitHub branch.
echo.
choice /C YN /M "Continue"
if errorlevel 2 exit /b 0
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is missing. Install Node.js and try again.
  pause
  exit /b 1
)
set "NOVA_ONE_TIME_SCRIPT=%~f0"
powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; $t=[IO.File]::ReadAllText($env:NOVA_ONE_TIME_SCRIPT); $p=$t -split '(?m)^# NOVA_POWERSHELL_PAYLOAD\r?$',2; if($p.Count -ne 2){throw 'Invalid setup file'}; Invoke-Expression $p[1]"
if errorlevel 1 (
  echo Setup did not finish. Your data was not intentionally removed.
  echo Show the error message for help. Do not share any key or token.
  pause
  exit /b 1
)
echo.
echo Setup complete. Now open your existing NOVA desktop shortcut or START-NOVA.bat.
pause
exit /b 0
# NOVA_POWERSHELL_PAYLOAD
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$headers = @{ 'User-Agent' = 'NOVA-One-Time-Setup/1.0'; 'Accept' = 'application/vnd.github+json' }
$api = 'https://api.github.com/repos/munjirul000-coder/genz-hub'
$temp = Join-Path ([IO.Path]::GetTempPath()) ('nova-setup-' + [Guid]::NewGuid().ToString('N'))
try {
    Write-Host 'Downloading the updater setup. Please wait...'
    $revision = (Invoke-RestMethod -Uri "$api/commits/arena%2F549dbb1e-genz-hub" -Headers $headers -TimeoutSec 30).sha
    if ($revision -notmatch '^[a-f0-9]{40}$') { throw 'Invalid update version.' }
    [IO.Directory]::CreateDirectory($temp) | Out-Null
    $files = @('START-NOVA.bat', 'desktop/nova-updater.js', 'desktop/nova-launch.bat', 'desktop/STOP-AUTO-UPDATE.bat', 'desktop/START-AUTO-UPDATE.bat', 'desktop/install-updater.js')
    foreach ($file in $files) {
        $item = Invoke-RestMethod -Uri "$api/contents/$($file)?ref=$revision" -Headers $headers -TimeoutSec 30
        if ($item.encoding -ne 'base64' -or -not $item.content -or $item.size -gt 1048576) { throw 'Unexpected setup file.' }
        $destination = Join-Path $temp ($file -replace '/', '\')
        [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination)) | Out-Null
        [IO.File]::WriteAllBytes($destination, [Convert]::FromBase64String(($item.content -replace '\s', '')))
    }
    & node (Join-Path $temp 'desktop\install-updater.js')
    if ($LASTEXITCODE -ne 0) { throw 'Installer stopped. See the message above.' }
} catch {
    Write-Host ('NOVA setup error: ' + $_.Exception.Message)
    exit 1
} finally {
    if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue }
}
