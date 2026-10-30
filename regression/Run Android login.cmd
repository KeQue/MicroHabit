@echo off
cd /d "%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-android.ps1"
set "result=%ERRORLEVEL%"
echo.
echo Finished with exit code %result%.
pause
exit /b %result%
