@echo off
setlocal
cd /d "%~dp0"
title NOVA AI Workspace

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20+ install korun: https://nodejs.org
  echo Install er por ei file abar double-click korun.
  pause
  exit /b 1
)

rem First installation only: the updater needs fflate, which is in package-lock.json.
node -e "require.resolve('fflate')" >nul 2>nul
if errorlevel 1 (
  echo Prothom setup: dependencies install hocche...
  call npm install --omit=dev
  if errorlevel 1 (
    echo Install failed. Internet connection check kore abar chalun.
    pause
    exit /b 1
  )
)

rem Fixed bootstrap: the updater and the rest of the application can update themselves.
node desktop\nova-updater.js
if errorlevel 1 (
  echo NOVA safely start kora jay ni. Upore error dekhun.
  pause
  exit /b 1
)
