@echo off
setlocal
cd /d "%~dp0\.."
if exist data\nova-updater\disabled del data\nova-updater\disabled
 echo Automatic NOVA updates are enabled. Restart NOVA to check.
pause
