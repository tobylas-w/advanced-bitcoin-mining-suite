const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Windows 11 Deployment Script
 * Creates an automated installer for Windows 11 computers
 */
class WindowsDeployment {
    constructor(config = {}) {
        this.config = {
            serverUrl: config.serverUrl || 'http://localhost:3000',
            installPath: config.installPath || 'C:\\Program Files\\BitcoinMiner',
            startMenu: true,
            desktopShortcut: true,
            autoStart: false,
            ...config
        };
    }

    /**
     * Generate Windows installer script
     */
    generateInstaller() {
        const installerScript = `@echo off
echo ========================================
echo    Bitcoin Mining Client Installer
echo    Windows 11 Compatible
echo ========================================
echo.

:: Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo This installer requires administrator privileges.
    echo Please run as administrator and try again.
    pause
    exit /b 1
)

:: Create installation directory
echo Creating installation directory...
if not exist "${this.config.installPath}" (
    mkdir "${this.config.installPath}"
)

:: Download Node.js if not present
echo Checking for Node.js...
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo Node.js not found. Downloading and installing...
    powershell -Command "& {Invoke-WebRequest -Uri 'https://nodejs.org/dist/v18.19.0/node-v18.19.0-x64.msi' -OutFile '$env:TEMP\\nodejs.msi'}"
    msiexec /i "$env:TEMP\\nodejs.msi" /quiet /norestart
    echo Waiting for Node.js installation...
    timeout /t 30 /nobreak >nul
    del "$env:TEMP\\nodejs.msi"
)

:: Create client files
echo Installing mining client...
echo const CrossPlatformClient = require('./CrossPlatformClient');
echo const config = {
echo     serverUrl: '${this.config.serverUrl}',
echo     platform: 'windows'
echo };
echo const client = new CrossPlatformClient(config);
echo client.connect().then(() => {
echo     console.log('Connected to mining server');
echo }).catch(console.error);
echo process.on('SIGINT', () => client.disconnect());
 > "${this.config.installPath}\\client.js"

:: Create package.json
echo Creating package configuration...
echo {
echo   "name": "bitcoin-mining-client",
echo   "version": "2.0.0",
echo   "main": "client.js",
echo   "dependencies": {
echo     "axios": "^1.6.0",
echo     "systeminformation": "^5.21.15"
echo   }
echo } > "${this.config.installPath}\\package.json"

:: Install dependencies
echo Installing dependencies...
cd /d "${this.config.installPath}"
npm install --production --silent

:: Create batch file to start client
echo Creating startup script...
echo @echo off
echo echo Starting Bitcoin Mining Client...
echo cd /d "${this.config.installPath}"
echo node client.js
echo pause > "${this.config.installPath}\\start-miner.bat"

:: Create Windows service (optional)
if "${this.config.autoStart}"=="true" (
    echo Creating Windows service...
    sc create "BitcoinMiner" binPath= "${this.config.installPath}\\start-miner.bat" start= auto
)

:: Create desktop shortcut
if "${this.config.desktopShortcut}"=="true" (
    echo Creating desktop shortcut...
    powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%USERPROFILE%\\Desktop\\Bitcoin Miner.lnk'); $Shortcut.TargetPath = '${this.config.installPath}\\start-miner.bat'; $Shortcut.Save()"
)

:: Create start menu entry
if "${this.config.startMenu}"=="true" (
    echo Creating start menu entry...
    if not exist "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\BitcoinMiner" (
        mkdir "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\BitcoinMiner"
    )
    powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\BitcoinMiner\\Bitcoin Miner.lnk'); $Shortcut.TargetPath = '${this.config.installPath}\\start-miner.bat'; $Shortcut.Save()"
)

:: Configure Windows Defender exclusion
echo Configuring Windows Defender exclusion...
powershell -Command "Add-MpPreference -ExclusionPath '${this.config.installPath}'" 2>nul

:: Set power plan to High Performance
echo Setting power plan to High Performance...
powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c

echo.
echo ========================================
echo    Installation Complete!
echo ========================================
echo.
echo The Bitcoin mining client has been installed to:
echo ${this.config.installPath}
echo.
echo You can start mining by running:
echo ${this.config.installPath}\\start-miner.bat
echo.
echo Or use the desktop shortcut: "Bitcoin Miner"
echo.
echo Server URL: ${this.config.serverUrl}
echo.

pause`;

        return installerScript;
    }

    /**
     * Generate uninstaller script
     */
    generateUninstaller() {
        const uninstallerScript = `@echo off
echo ========================================
echo    Bitcoin Mining Client Uninstaller
echo ========================================
echo.

:: Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo This uninstaller requires administrator privileges.
    echo Please run as administrator and try again.
    pause
    exit /b 1
)

:: Stop mining client if running
echo Stopping mining client...
taskkill /f /im node.exe /fi "WINDOWTITLE eq Bitcoin*" 2>nul

:: Remove Windows service
echo Removing Windows service...
sc delete "BitcoinMiner" 2>nul

:: Remove installation directory
echo Removing installation files...
if exist "${this.config.installPath}" (
    rmdir /s /q "${this.config.installPath}"
)

:: Remove desktop shortcut
echo Removing desktop shortcut...
del "%USERPROFILE%\\Desktop\\Bitcoin Miner.lnk" 2>nul

:: Remove start menu entry
echo Removing start menu entry...
rmdir /s /q "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\BitcoinMiner" 2>nul

:: Remove Windows Defender exclusion
echo Removing Windows Defender exclusion...
powershell -Command "Remove-MpPreference -ExclusionPath '${this.config.installPath}'" 2>nul

echo.
echo ========================================
echo    Uninstallation Complete!
echo ========================================
echo.
echo The Bitcoin mining client has been removed.
echo.

pause`;

        return uninstallerScript;
    }

    /**
     * Generate PowerShell deployment script
     */
    generatePowerShellScript() {
        const psScript = `# Bitcoin Mining Client - Windows 11 Deployment Script
# Requires PowerShell 5.1 or later

param(
    [string]$ServerUrl = "${this.config.serverUrl}",
    [string]$InstallPath = "${this.config.installPath}",
    [switch]$AutoStart,
    [switch]$DesktopShortcut,
    [switch]$StartMenu
)

# Check if running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "This script requires administrator privileges. Please run as administrator." -ForegroundColor Red
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Bitcoin Mining Client Installer" -ForegroundColor Cyan
Write-Host "   Windows 11 Compatible" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Create installation directory
Write-Host "Creating installation directory..." -ForegroundColor Yellow
if (-not (Test-Path $InstallPath)) {
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
}

# Check for Node.js
Write-Host "Checking for Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>$null
    if (-not $nodeVersion) {
        throw "Node.js not found"
    }
    Write-Host "Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "Node.js not found. Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    Write-Host "Or run this script with -InstallNode parameter to auto-install" -ForegroundColor Yellow
    exit 1
}

# Create client files
Write-Host "Creating client files..." -ForegroundColor Yellow

# Create client.js
$clientCode = @"
const CrossPlatformClient = require('./CrossPlatformClient');

const config = {
    serverUrl: '${this.config.serverUrl}',
    platform: 'windows'
};

const client = new CrossPlatformClient(config);

client.connect().then(() => {
    console.log('Connected to mining server');
    console.log('Client ID:', client.clientId);
}).catch(console.error);

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down...');
    client.disconnect().then(() => process.exit(0));
});

process.on('SIGTERM', () => {
    console.log('Shutting down...');
    client.disconnect().then(() => process.exit(0));
});
"@

Set-Content -Path "$InstallPath\\client.js" -Value $clientCode

# Create package.json
$packageJson = @{
    name = "bitcoin-mining-client"
    version = "2.0.0"
    main = "client.js"
    dependencies = @{
        axios = "^1.6.0"
        systeminformation = "^5.21.15"
    }
} | ConvertTo-Json -Depth 3

Set-Content -Path "$InstallPath\\package.json" -Value $packageJson

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
Set-Location $InstallPath
npm install --production --silent

# Create startup script
Write-Host "Creating startup script..." -ForegroundColor Yellow
$startupScript = @"
@echo off
echo Starting Bitcoin Mining Client...
cd /d "$InstallPath"
node client.js
pause
"@

Set-Content -Path "$InstallPath\\start-miner.bat" -Value $startupScript

# Create desktop shortcut
if ($DesktopShortcut) {
    Write-Host "Creating desktop shortcut..." -ForegroundColor Yellow
    $WshShell = New-Object -comObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\\Desktop\\Bitcoin Miner.lnk")
    $Shortcut.TargetPath = "$InstallPath\\start-miner.bat"
    $Shortcut.WorkingDirectory = $InstallPath
    $Shortcut.IconLocation = "shell32.dll,1"
    $Shortcut.Save()
}

# Create start menu entry
if ($StartMenu) {
    Write-Host "Creating start menu entry..." -ForegroundColor Yellow
    $startMenuPath = "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\BitcoinMiner"
    if (-not (Test-Path $startMenuPath)) {
        New-Item -ItemType Directory -Path $startMenuPath -Force | Out-Null
    }
    
    $WshShell = New-Object -comObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut("$startMenuPath\\Bitcoin Miner.lnk")
    $Shortcut.TargetPath = "$InstallPath\\start-miner.bat"
    $Shortcut.WorkingDirectory = $InstallPath
    $Shortcut.IconLocation = "shell32.dll,1"
    $Shortcut.Save()
}

# Configure Windows Defender exclusion
Write-Host "Configuring Windows Defender exclusion..." -ForegroundColor Yellow
try {
    Add-MpPreference -ExclusionPath $InstallPath -ErrorAction SilentlyContinue
    Write-Host "Windows Defender exclusion added" -ForegroundColor Green
} catch {
    Write-Host "Could not add Windows Defender exclusion (may require manual configuration)" -ForegroundColor Yellow
}

# Set power plan to High Performance
Write-Host "Setting power plan to High Performance..." -ForegroundColor Yellow
try {
    powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c
    Write-Host "Power plan set to High Performance" -ForegroundColor Green
} catch {
    Write-Host "Could not set power plan (may require manual configuration)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Installation Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "The Bitcoin mining client has been installed to:" -ForegroundColor Green
Write-Host $InstallPath -ForegroundColor White
Write-Host ""
Write-Host "You can start mining by running:" -ForegroundColor Green
Write-Host "$InstallPath\\start-miner.bat" -ForegroundColor White
Write-Host ""
Write-Host "Server URL: $ServerUrl" -ForegroundColor Green
Write-Host ""

# Test connection to server
Write-Host "Testing connection to mining server..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$ServerUrl/health" -TimeoutSec 10 -ErrorAction Stop
    Write-Host "Connection test successful!" -ForegroundColor Green
} catch {
    Write-Host "Could not connect to mining server at $ServerUrl" -ForegroundColor Yellow
    Write-Host "Please ensure the server is running and accessible" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")`;

        return psScript;
    }

    /**
     * Save installer files to disk
     */
    async saveInstallerFiles() {
        const installerDir = path.join(__dirname, '../../deploy/windows');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(installerDir)) {
            fs.mkdirSync(installerDir, { recursive: true });
        }

        // Save installer script
        fs.writeFileSync(
            path.join(installerDir, 'install.bat'),
            this.generateInstaller()
        );

        // Save uninstaller script
        fs.writeFileSync(
            path.join(installerDir, 'uninstall.bat'),
            this.generateUninstaller()
        );

        // Save PowerShell script
        fs.writeFileSync(
            path.join(installerDir, 'install.ps1'),
            this.generatePowerShellScript()
        );

        // Save CrossPlatformClient.js
        const clientPath = path.join(__dirname, '../client/CrossPlatformClient.js');
        if (fs.existsSync(clientPath)) {
            fs.copyFileSync(
                clientPath,
                path.join(installerDir, 'CrossPlatformClient.js')
            );
        }

        console.log(`✅ Windows installer files saved to: ${installerDir}`);
        console.log('📁 Files created:');
        console.log('   - install.bat (Batch installer)');
        console.log('   - uninstall.bat (Uninstaller)');
        console.log('   - install.ps1 (PowerShell installer)');
        console.log('   - CrossPlatformClient.js (Client code)');
    }
}

module.exports = WindowsDeployment;
