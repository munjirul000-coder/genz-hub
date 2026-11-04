@echo off
setlocal
cd /d "%~dp0"
title NOVA Windows Bridge

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20+ install korun: https://nodejs.org
  pause
  exit /b 1
)

if not exist nova-bridge.token (
  echo nova-bridge.token pawa jay ni.
  echo NOVA -^> Desktop control -^> Generate token -^> Save token file
  echo tarpor file ti ei folder-e rakhun: %CD%\nova-bridge.token
  pause
  exit /b 1
)

set "SERVER=http://localhost:3000"
set /p "SERVER=Server URL [http://localhost:3000]: "
if "%SERVER%"=="" set "SERVER=http://localhost:3000"

echo Bridge connect hocche: %SERVER%
echo Ei window open thakle desktop control cholbe. Bondho korte Ctrl+C.
node nova-agent.js --server "%SERVER%" --token-file nova-bridge.token
pause
