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

if not exist node_modules (
  echo First run: dependencies install hocche...
  call npm install --omit=dev
  if errorlevel 1 (
    echo npm install failed. Internet connection check korun.
    pause
    exit /b 1
  )
)

echo NOVA start hocche: http://localhost:3000/nova
echo Ei window open thakle NOVA cholbe. Bondho korte Ctrl+C.
start "" /b cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3000/nova"
call npm run nova
pause
