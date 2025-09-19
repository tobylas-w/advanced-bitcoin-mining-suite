@echo off
echo ==========================================
echo   Bitcoin Mining Worker Installer
echo   Simple One-Click Installation
echo ==========================================
echo.
echo This will install Bitcoin mining software that:
echo • Mines Bitcoin automatically
echo • Reports to your main server
echo • Starts on boot
echo • Requires no manual management
echo.
pause

echo.
echo Installing Bitcoin Mining Worker...
echo This may take 5-10 minutes...
echo.

REM Download and run the installer
curl -o install.sh http://192.168.1.168:3000/INSTALL-MINING-WORKER.sh

REM Make it executable and run
bash install.sh

echo.
echo Installation complete!
pause
