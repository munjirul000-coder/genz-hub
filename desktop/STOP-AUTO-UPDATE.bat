@echo off
setlocal
cd /d "%~dp0\.."
if not exist data\nova-updater mkdir data\nova-updater
>data\nova-updater\disabled echo paused
 echo Automatic NOVA updates are paused. Your data is unchanged.
pause
