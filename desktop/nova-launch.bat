@echo off
setlocal
cd /d "%~dp0\.."

rem Reinstall when the lockfile changes, even if an old node_modules exists.
node -e "try {const f=require('fs'),c=require('crypto');const h=c.createHash('sha256').update(f.readFileSync('package-lock.json')).digest('hex');require.resolve('fflate');require.resolve('express');require.resolve('better-sqlite3');process.exit(f.readFileSync('node_modules/.nova-lock-sha256','utf8')===h?0:1)} catch(e) {process.exit(1)}" >nul 2>nul
if errorlevel 1 (
  echo Dependencies install/update hocche...
  call npm install --omit=dev
  if errorlevel 1 (
    echo npm install failed. Internet connection check korun.
    pause
    exit /b 1
  )
  node -e "const f=require('fs'),c=require('crypto');f.writeFileSync('node_modules/.nova-lock-sha256',c.createHash('sha256').update(f.readFileSync('package-lock.json')).digest('hex'))"
)

echo NOVA start hocche: http://localhost:3000/nova
echo Ei window open thakle NOVA cholbe. Bondho korte Ctrl+C.
start "" /b cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3000/nova"
call npm run nova
pause
