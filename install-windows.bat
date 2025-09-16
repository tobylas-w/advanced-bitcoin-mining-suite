@echo off
setlocal enabledelayedexpansion

REM Windows Bitcoin Mining Installer
REM Compatible with Windows 10/11

echo.
echo 🪟 Windows Bitcoin Mining Installer
echo ═══════════════════════════════════
echo.

REM Check if running as Administrator
net session >nul 2>&1
if %errorLevel% == 0 (
    echo ✅ Running as Administrator
) else (
    echo ❌ This script requires Administrator privileges
    echo Please right-click and "Run as Administrator"
    pause
    exit /b 1
)

REM Get system information
echo 📱 System Information:
echo • OS: %OS%
echo • Architecture: %PROCESSOR_ARCHITECTURE%
echo • Computer: %COMPUTERNAME%
echo • User: %USERNAME%
echo.

REM Check for Chocolatey
echo 📦 Checking for Chocolatey...
choco --version >nul 2>&1
if %errorLevel% == 0 (
    echo ✅ Chocolatey already installed
) else (
    echo 📦 Installing Chocolatey...
    powershell -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
    if %errorLevel% neq 0 (
        echo ❌ Failed to install Chocolatey
        pause
        exit /b 1
    )
    echo ✅ Chocolatey installed successfully
)

REM Install dependencies
echo.
echo 📦 Installing dependencies...
choco install -y git nodejs mingw-w64 autotools curl openssl
if %errorLevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)
echo ✅ Dependencies installed

REM Refresh environment variables
call refreshenv

REM Install Node.js dependencies
echo.
echo 📚 Installing Node.js dependencies...
npm install
if %errorLevel% neq 0 (
    echo ❌ Failed to install Node.js dependencies
    pause
    exit /b 1
)
echo ✅ Node.js dependencies installed

REM Clone and build CPUMiner
echo.
echo 🔨 Building CPUMiner...
if not exist "cpuminer" (
    echo 📥 Cloning CPUMiner repository...
    git clone https://github.com/pooler/cpuminer.git
    if %errorLevel% neq 0 (
        echo ❌ Failed to clone CPUMiner
        pause
        exit /b 1
    )
)

cd cpuminer

REM Check if we have MSYS2/MinGW
where mingw32-make >nul 2>&1
if %errorLevel% == 0 (
    echo ✅ MinGW found, building with MinGW...
    
    REM Set up environment for MinGW
    set PATH=C:\tools\mingw64\bin;%PATH%
    set CC=gcc
    set CXX=g++
    
    REM Run autogen
    echo 🔧 Running autogen...
    sh autogen.sh
    if %errorLevel% neq 0 (
        echo ❌ Autogen failed
        cd ..
        pause
        exit /b 1
    )
    
    REM Configure
    echo 🔧 Configuring build...
    ./configure
    if %errorLevel% neq 0 (
        echo ❌ Configure failed
        cd ..
        pause
        exit /b 1
    )
    
    REM Build
    echo 🔨 Building...
    mingw32-make -j%NUMBER_OF_PROCESSORS%
    if %errorLevel% neq 0 (
        echo ❌ Build failed
        cd ..
        pause
        exit /b 1
    )
    
    REM Copy binary
    copy minerd.exe ..\
    cd ..
    echo ✅ CPUMiner built successfully
    
) else (
    echo ⚠️ MinGW not found, using pre-built binary...
    cd ..
    
    REM Download pre-built binary (fallback)
    echo 📥 Downloading pre-built CPUMiner...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/pooler/cpuminer/releases/latest/download/cpuminer-windows.zip' -OutFile 'cpuminer-windows.zip'"
    
    if exist "cpuminer-windows.zip" (
        powershell -Command "Expand-Archive -Path 'cpuminer-windows.zip' -DestinationPath '.' -Force"
        del cpuminer-windows.zip
        echo ✅ Pre-built CPUMiner downloaded
    ) else (
        echo ❌ Failed to download pre-built binary
        pause
        exit /b 1
    )
)

REM Create configuration directory
if not exist "config" mkdir config

REM Create default wallet configuration
if not exist "config\wallet.js" (
    echo 📝 Creating wallet configuration...
    (
        echo module.exports = {
        echo     // Replace with your actual Bitcoin wallet address
        echo     address: 'bc1qz2zqqgdz7whfmmkpcthn5gkv4ew4dfjs6fyeat',
        echo     
        echo     // Worker name for pool identification
        echo     workerName: 'windows-miner',
        echo     
        echo     // Pool configuration
        echo     pools: [
        echo         {
        echo             name: 'Antpool',
        echo             url: 'stratum+tcp://btc.ss.poolin.com:443',
        echo             fee: 2.5,
        echo             reliability: 99.9
        echo         }
        echo     ]
        echo };^> config\wallet.js
    )
    echo ✅ Wallet configuration created
)

REM Create Bitcoin configuration
if not exist "config\bitcoin.js" (
    echo 📝 Creating Bitcoin configuration...
    (
        echo module.exports = {
        echo     // Bitcoin network configuration
        echo     network: 'mainnet',
        echo     
        echo     // Mining parameters
        echo     mining: {
        echo         algorithm: 'sha256d',
        echo         threads: 4,
        echo         retries: 10,
        echo         timeout: 60,
        echo         scantime: 5
        echo     },
        echo     
        echo     // Performance settings
        echo     performance: {
        echo         aggressiveMode: false,
        echo         maxCpuUsage: 80,
        echo         temperatureThreshold: 85
        echo     }
        echo };^> config\bitcoin.js
    )
    echo ✅ Bitcoin configuration created
)

REM Create start script
echo 📝 Creating start script...
(
    echo @echo off
    echo echo 🚀 Starting Bitcoin Mining...
    echo node bitcoin-mining-server.js
    echo pause
) > start-mining.bat

REM Create stop script
echo 📝 Creating stop script...
(
    echo @echo off
    echo echo ⏹️ Stopping Bitcoin Mining...
    echo taskkill /f /im node.exe 2^>nul
    echo taskkill /f /im minerd.exe 2^>nul
    echo echo ✅ Mining stopped
    echo pause
) > stop-mining.bat

REM Create Windows Service installer
echo 📝 Creating Windows Service installer...
(
    echo @echo off
    echo echo 🔧 Installing Bitcoin Mining as Windows Service...
    echo.
    echo REM Install node-windows if not present
    echo npm install -g node-windows
    echo.
    echo REM Create service installation script
    echo node install-service.js
    echo.
    echo echo ✅ Service installed successfully
    echo echo 💡 Use Services.msc to manage the service
    echo pause
) > install-service.bat

REM Create service installation script
echo 📝 Creating service installation script...
(
    echo const Service = require('node-windows').Service;
    echo.
    echo // Create a new service object
    echo const svc = new Service({
    echo   name:'Bitcoin Mining',
    echo   description: 'Bitcoin Mining Service',
    echo   script: require('path').join(__dirname, 'bitcoin-mining-server.js')
    echo });
    echo.
    echo // Listen for the "install" event, which indicates the
    echo // process is available as a service.
    echo svc.on('install',function(){
    echo   svc.start();
    echo });
    echo.
    echo svc.install();
) > install-service.js

REM Create uninstall script
echo 📝 Creating uninstall script...
(
    echo @echo off
    echo echo 🗑️ Uninstalling Bitcoin Mining System...
    echo.
    echo REM Stop mining processes
    echo taskkill /f /im node.exe 2^>nul
    echo taskkill /f /im minerd.exe 2^>nul
    echo.
    echo REM Remove files
    echo del minerd.exe 2^>nul
    echo del start-mining.bat 2^>nul
    echo del stop-mining.bat 2^>nul
    echo del install-service.bat 2^>nul
    echo del install-service.js 2^>nul
    echo del uninstall.bat 2^>nul
    echo rmdir /s /q node_modules 2^>nul
    echo rmdir /s /q cpuminer 2^>nul
    echo rmdir /s /q config 2^>nul
    echo.
    echo echo ✅ Uninstallation complete
    echo pause
) > uninstall.bat

REM Create desktop shortcut
echo 📝 Creating desktop shortcut...
set DESKTOP=%USERPROFILE%\Desktop
set CURRENT_DIR=%CD%

powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%DESKTOP%\Bitcoin Mining.lnk'); $Shortcut.TargetPath = '%CURRENT_DIR%\start-mining.bat'; $Shortcut.WorkingDirectory = '%CURRENT_DIR%'; $Shortcut.IconLocation = 'shell32.dll,1'; $Shortcut.Description = 'Start Bitcoin Mining'; $Shortcut.Save()"

echo.
echo 🎉 Installation completed successfully!
echo.
echo 🎯 Next steps:
echo 1. Configure your wallet address in config\wallet.js
echo 2. Start mining: start-mining.bat
echo 3. Open dashboard: http://localhost:3000
echo 4. Install as service: install-service.bat
echo.
echo 📱 System Information:
echo • OS: %OS%
echo • Architecture: %PROCESSOR_ARCHITECTURE%
echo • CPU Cores: %NUMBER_OF_PROCESSORS%
echo.
echo ✅ Ready to mine Bitcoin!
echo.
echo 💡 Tips:
echo • Run as Administrator for best performance
echo • Check Windows Defender exclusions for mining folder
echo • Monitor CPU temperature during mining
echo • Use Task Manager to monitor performance
echo.
pause
