@echo off
setlocal
cd /d "%~dp0"
title NOVA Auto-Update Setup

echo This adds automatic updates to your existing NOVA folder.
echo Your data, memory, Groq key and bridge token will not be replaced.
echo First close the old NOVA and Windows bridge terminal windows.
echo.
choice /C YN /M "Continue"
if errorlevel 2 exit /b 0
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is missing. Open NOVA normally after installing Node.js.
  pause
  exit /b 1
)
node desktop\install-updater.js
if errorlevel 1 (
  echo Setup did not finish. Do not delete anything; show the error message.
  pause
  exit /b 1
)
echo.
echo Setup complete. Now double-click your existing START-NOVA.bat or desktop shortcut.
pause
