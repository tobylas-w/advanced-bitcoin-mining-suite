@echo off
echo ========================================
echo   BITCOIN MINING DEPLOYMENT - WINDOWS
echo ========================================
echo.

REM Check for admin privileges
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Running with administrator privileges
) else (
    echo [ERROR] This script requires administrator privileges
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

echo [INFO] Installing Bitcoin Mining System...

REM Create installation directory
set INSTALL_DIR=C:\BitcoinMiner
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

REM Download and install Node.js if not present
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo [INFO] Installing Node.js...
    powershell -Command "& {Invoke-WebRequest -Uri 'https://nodejs.org/dist/v18.17.0/node-v18.17.0-x64.msi' -OutFile '%TEMP%\nodejs.msi'}"
    msiexec /i "%TEMP%\nodejs.msi" /quiet /norestart
    echo [OK] Node.js installed
) else (
    echo [OK] Node.js already installed
)

REM Download CPUMiner
echo [INFO] Downloading CPUMiner...
powershell -Command "& {Invoke-WebRequest -Uri 'https://github.com/pooler/cpuminer/releases/download/v2.5.1/cpuminer-2.5.1-windows.zip' -OutFile '%INSTALL_DIR%\cpuminer.zip'}"
powershell -Command "& {Expand-Archive -Path '%INSTALL_DIR%\cpuminer.zip' -DestinationPath '%INSTALL_DIR%' -Force}"

REM Copy mining system files
echo [INFO] Copying mining system files...
xcopy "%~dp0..\src" "%INSTALL_DIR%\src" /E /I /Y
copy "%~dp0..\package.json" "%INSTALL_DIR%\"
copy "%~dp0..\minerd" "%INSTALL_DIR%\"

REM Install dependencies
echo [INFO] Installing dependencies...
cd "%INSTALL_DIR%"
npm install --production

REM Create Windows service
echo [INFO] Creating Windows service...
sc create "BitcoinMiner" binPath="%INSTALL_DIR%\start-mining.bat" start=auto
sc description "BitcoinMiner" "Bitcoin Mining Service"

REM Create startup script
echo @echo off > "%INSTALL_DIR%\start-mining.bat"
echo cd /d "%INSTALL_DIR%" >> "%INSTALL_DIR%\start-mining.bat"
echo node client-miner.js >> "%INSTALL_DIR%\start-mining.bat"

REM Start service
echo [INFO] Starting Bitcoin mining service...
sc start "BitcoinMiner"

REM Add Windows Defender exclusion
echo [INFO] Adding Windows Defender exclusion...
powershell -Command "& {Add-MpPreference -ExclusionPath '%INSTALL_DIR%'}"

echo.
echo ========================================
echo   INSTALLATION COMPLETE!
echo ========================================
echo.
echo Bitcoin mining system installed to: %INSTALL_DIR%
echo Service Name: BitcoinMiner
echo Dashboard: http://localhost:3000
echo.
echo Your wallet: bc1qgef2v0taxcae8wfmf868ydg92qp36guv68ddh4
echo.
pause
