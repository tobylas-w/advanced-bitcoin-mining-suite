#!/usr/bin/env node

/**
 * Universal Bitcoin Mining Installer
 * Works on macOS, Windows, and Linux
 */

const PlatformDetector = require('./src/utils/PlatformDetector');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class UniversalInstaller {
    constructor() {
        this.platformDetector = new PlatformDetector();
        this.platform = this.platformDetector.platform;
    }

    async install() {
        console.log('\n🚀 Universal Bitcoin Mining Installer');
        console.log('═'.repeat(50));
        console.log(`📱 Platform: ${this.platform.toUpperCase()}`);
        console.log(`🏗️ Architecture: ${this.platformDetector.architecture}`);
        
        try {
            // Step 1: Check system requirements
            console.log('\n📋 Step 1: Checking system requirements...');
            await this.checkSystemRequirements();
            
            // Step 2: Install dependencies
            console.log('\n📦 Step 2: Installing dependencies...');
            await this.installDependencies();
            
            // Step 3: Build CPUMiner
            console.log('\n🔨 Step 3: Building CPUMiner...');
            await this.buildCPUMiner();
            
            // Step 4: Install Node.js dependencies
            console.log('\n📚 Step 4: Installing Node.js dependencies...');
            await this.installNodeDependencies();
            
            // Step 5: Create service scripts
            console.log('\n⚙️ Step 5: Creating service scripts...');
            await this.createServiceScripts();
            
            // Step 6: Create configuration
            console.log('\n⚙️ Step 6: Setting up configuration...');
            await this.createConfiguration();
            
            console.log('\n✅ Installation completed successfully!');
            console.log('\n🎯 Next steps:');
            console.log('1. Configure your wallet address in config/wallet.js');
            console.log('2. Start mining: node bitcoin-mining-server.js');
            console.log('3. Open dashboard: http://localhost:3000');
            console.log('\n' + this.platformDetector.getInstallationGuide());
            
        } catch (error) {
            console.error('\n❌ Installation failed:', error.message);
            console.log('\n🔧 Troubleshooting:');
            this.showTroubleshooting();
            process.exit(1);
        }
    }

    async checkSystemRequirements() {
        const systemInfo = this.platformDetector.getSystemInfo();
        
        console.log(`💻 OS: ${systemInfo.os} ${systemInfo.release}`);
        console.log(`🧠 CPU Cores: ${systemInfo.cpuCores}`);
        console.log(`💾 Memory: ${systemInfo.totalMemory}GB`);
        console.log(`📦 Node.js: ${systemInfo.nodeVersion}`);
        
        // Check Node.js version
        const nodeVersion = parseInt(process.version.slice(1).split('.')[0]);
        if (nodeVersion < 14) {
            throw new Error('Node.js version 14 or higher is required');
        }
        
        // Check available memory
        if (systemInfo.totalMemory < 2) {
            console.warn('⚠️ Warning: Less than 2GB RAM detected. Mining performance may be limited.');
        }
        
        console.log('✅ System requirements check passed');
    }

    async installDependencies() {
        try {
            await this.platformDetector.installDependencies();
        } catch (error) {
            console.log('\n🔧 Manual dependency installation required:');
            console.log(this.getManualInstallationInstructions());
            throw error;
        }
    }

    async buildCPUMiner() {
        try {
            await this.platformDetector.buildMiner();
        } catch (error) {
            console.log('\n🔧 Manual CPUMiner build required:');
            console.log(this.getManualBuildInstructions());
            throw error;
        }
    }

    async installNodeDependencies() {
        return new Promise((resolve, reject) => {
            console.log('📚 Installing Node.js packages...');
            
            exec('npm install', (error, stdout, stderr) => {
                if (error) {
                    console.error('❌ Failed to install Node.js dependencies');
                    reject(error);
                } else {
                    console.log('✅ Node.js dependencies installed');
                    resolve();
                }
            });
        });
    }

    async createServiceScripts() {
        // Create platform-specific start script
        const scriptPath = await this.platformDetector.createServiceScript();
        console.log(`✅ Created service script: ${scriptPath}`);
        
        // Create stop script
        await this.createStopScript();
        
        // Create uninstall script
        await this.createUninstallScript();
    }

    async createStopScript() {
        const stopScript = this.getStopScript();
        const scriptPath = path.join(process.cwd(), 
            this.platform === 'windows' ? 'stop-mining.bat' : 'stop-mining.sh'
        );
        
        fs.writeFileSync(scriptPath, stopScript);
        
        if (this.platform !== 'windows') {
            fs.chmodSync(scriptPath, '755');
        }
        
        console.log(`✅ Created stop script: ${scriptPath}`);
    }

    async createUninstallScript() {
        const uninstallScript = this.getUninstallScript();
        const scriptPath = path.join(process.cwd(), 
            this.platform === 'windows' ? 'uninstall.bat' : 'uninstall.sh'
        );
        
        fs.writeFileSync(scriptPath, uninstallScript);
        
        if (this.platform !== 'windows') {
            fs.chmodSync(scriptPath, '755');
        }
        
        console.log(`✅ Created uninstall script: ${scriptPath}`);
    }

    getStopScript() {
        switch (this.platform) {
            case 'windows':
                return `@echo off
echo Stopping Bitcoin Mining...
taskkill /f /im node.exe 2>nul
taskkill /f /im minerd.exe 2>nul
echo Mining stopped.
pause
`;
            default:
                return `#!/bin/bash
echo "Stopping Bitcoin Mining..."
pkill -f "node.*bitcoin-mining-server.js" 2>/dev/null
pkill -f "minerd" 2>/dev/null
echo "Mining stopped."
`;
        }
    }

    getUninstallScript() {
        switch (this.platform) {
            case 'windows':
                return `@echo off
echo Uninstalling Bitcoin Mining System...
taskkill /f /im node.exe 2>nul
taskkill /f /im minerd.exe 2>nul
del minerd.exe 2>nul
rmdir /s /q node_modules 2>nul
del start-mining.bat 2>nul
del stop-mining.bat 2>nul
del uninstall.bat 2>nul
echo Uninstallation complete.
pause
`;
            default:
                return `#!/bin/bash
echo "Uninstalling Bitcoin Mining System..."
pkill -f "node.*bitcoin-mining-server.js" 2>/dev/null
pkill -f "minerd" 2>/dev/null
rm -f minerd
rm -rf node_modules
rm -f start-mining.sh
rm -f stop-mining.sh
rm -f uninstall.sh
rm -rf cpuminer
echo "Uninstallation complete."
`;
        }
    }

    async createConfiguration() {
        // Create default configuration if it doesn't exist
        const configDir = path.join(process.cwd(), 'config');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        
        const walletConfigPath = path.join(configDir, 'wallet.js');
        if (!fs.existsSync(walletConfigPath)) {
            const defaultWalletConfig = `module.exports = {
    // Replace with your actual Bitcoin wallet address
    address: 'bc1qz2zqqgdz7whfmmkpcthn5gkv4ew4dfjs6fyeat',
    
    // Worker name for pool identification
    workerName: '${this.platform}-miner',
    
    // Pool configuration
    pools: [
        {
            name: 'Antpool',
            url: 'stratum+tcp://btc.ss.poolin.com:443',
            fee: 2.5,
            reliability: 99.9
        },
        {
            name: 'F2Pool',
            url: 'stratum+tcp://btc.f2pool.com:3333',
            fee: 2.5,
            reliability: 99.8
        },
        {
            name: 'ViaBTC',
            url: 'stratum+tcp://btc.viabtc.com:3333',
            fee: 4.0,
            reliability: 99.7
        }
    ]
};`;
            
            fs.writeFileSync(walletConfigPath, defaultWalletConfig);
            console.log('✅ Created default wallet configuration');
        }
        
        const bitcoinConfigPath = path.join(configDir, 'bitcoin.js');
        if (!fs.existsSync(bitcoinConfigPath)) {
            const defaultBitcoinConfig = `module.exports = {
    // Bitcoin network configuration
    network: 'mainnet',
    
    // Mining parameters
    mining: {
        algorithm: 'sha256d',
        threads: ${this.platformDetector.getOptimalThreads()},
        retries: 10,
        timeout: 60,
        scantime: 5
    },
    
    // Performance settings
    performance: {
        aggressiveMode: false,
        maxCpuUsage: 80,
        temperatureThreshold: 85
    },
    
    // Monitoring settings
    monitoring: {
        updateInterval: 5000,
        logLevel: 'info',
        enableWebSocket: true
    }
};`;
            
            fs.writeFileSync(bitcoinConfigPath, defaultBitcoinConfig);
            console.log('✅ Created default Bitcoin configuration');
        }
    }

    getManualInstallationInstructions() {
        const instructions = {
            macos: `
🍎 macOS Manual Installation:

1. Install Homebrew:
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

2. Install dependencies:
   brew install autoconf automake libtool curl openssl gcc make git

3. Clone and build CPUMiner:
   git clone https://github.com/pooler/cpuminer.git
   cd cpuminer
   ./autogen.sh
   ./configure
   make
   cp minerd ../
`,
            linux: `
🐧 Linux Manual Installation:

1. Install dependencies (Fedora/RHEL):
   sudo dnf install autoconf automake libtool curl-devel openssl-devel gcc make git

2. Install dependencies (Ubuntu/Debian):
   sudo apt install autoconf automake libtool libcurl4-openssl-dev libssl-dev gcc make git

3. Clone and build CPUMiner:
   git clone https://github.com/pooler/cpuminer.git
   cd cpuminer
   ./autogen.sh
   ./configure
   make
   cp minerd ../
`,
            windows: `
🪟 Windows Manual Installation:

1. Install Chocolatey:
   Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

2. Install dependencies:
   choco install mingw-w64 autotools curl openssl git

3. Use Git Bash or WSL for building CPUMiner:
   git clone https://github.com/pooler/cpuminer.git
   cd cpuminer
   ./autogen.sh
   ./configure
   make
   cp minerd.exe ../
`
        };
        
        return instructions[this.platform] || instructions.linux;
    }

    getManualBuildInstructions() {
        return `
🔨 Manual CPUMiner Build:

1. Clone the repository:
   git clone https://github.com/pooler/cpuminer.git

2. Enter the directory:
   cd cpuminer

3. Run autogen:
   ./autogen.sh

4. Configure:
   ./configure

5. Build:
   make

6. Copy binary:
   cp minerd${this.platform === 'windows' ? '.exe' : ''} ../
`;
    }

    showTroubleshooting() {
        console.log(`
🔧 Troubleshooting Guide:

1. Permission Issues:
   - macOS/Linux: Use 'sudo' for system-wide installations
   - Windows: Run as Administrator

2. Dependency Issues:
   - Ensure package manager is updated
   - Check internet connection
   - Verify package names for your OS version

3. Build Issues:
   - Ensure all dependencies are installed
   - Check compiler availability (gcc/clang)
   - Verify Git is installed

4. Node.js Issues:
   - Update Node.js to version 14 or higher
   - Clear npm cache: npm cache clean --force
   - Delete node_modules and run npm install again

5. Platform-Specific Issues:
${this.platformDetector.getInstallationGuide()}

For more help, check the documentation or create an issue on GitHub.
`);
    }
}

// Run installer if called directly
if (require.main === module) {
    const installer = new UniversalInstaller();
    installer.install().catch(error => {
        console.error('Installation failed:', error);
        process.exit(1);
    });
}

module.exports = UniversalInstaller;
