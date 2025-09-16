/**
 * Platform Detection and Compatibility Layer
 * Handles OS detection and platform-specific configurations
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');

class PlatformDetector {
    constructor() {
        this.platform = this.detectPlatform();
        this.architecture = os.arch();
        this.config = this.getPlatformConfig();
    }

    detectPlatform() {
        const platform = os.platform();
        switch (platform) {
            case 'darwin':
                return 'macos';
            case 'win32':
                return 'windows';
            case 'linux':
                return 'linux';
            default:
                return 'unknown';
        }
    }

    getPlatformConfig() {
        const configs = {
            linux: {
                minerBinary: 'minerd',
                minerPath: './minerd',
                dependencies: [
                    'autoconf', 'automake', 'libtool', 'curl-devel', 
                    'openssl-devel', 'gcc', 'make', 'git'
                ],
                installCommand: 'sudo dnf install',
                buildCommand: './autogen.sh && ./configure && make',
                serviceManager: 'systemd',
                homeDir: process.env.HOME,
                tempDir: '/tmp',
                executable: true
            },
            macos: {
                minerBinary: 'minerd',
                minerPath: './minerd',
                dependencies: [
                    'autoconf', 'automake', 'libtool', 'curl', 
                    'openssl', 'gcc', 'make', 'git'
                ],
                installCommand: 'brew install',
                buildCommand: './autogen.sh && ./configure && make',
                serviceManager: 'launchd',
                homeDir: process.env.HOME,
                tempDir: '/tmp',
                executable: true,
                requiresHomebrew: true
            },
            windows: {
                minerBinary: 'minerd.exe',
                minerPath: '.\\minerd.exe',
                dependencies: [
                    'mingw-w64', 'autotools', 'curl', 'openssl'
                ],
                installCommand: 'choco install',
                buildCommand: 'autogen.sh && configure && make',
                serviceManager: 'services.msc',
                homeDir: process.env.USERPROFILE,
                tempDir: process.env.TEMP,
                executable: false,
                requiresChocolatey: true
            }
        };

        return configs[this.platform] || configs.linux;
    }

    async checkDependencies() {
        const missing = [];
        
        for (const dep of this.config.dependencies) {
            try {
                await this.checkDependency(dep);
            } catch (error) {
                missing.push(dep);
            }
        }

        return {
            installed: this.config.dependencies.length - missing.length,
            missing: missing,
            total: this.config.dependencies.length
        };
    }

    checkDependency(dependency) {
        return new Promise((resolve, reject) => {
            let command;
            
            switch (this.platform) {
                case 'macos':
                    command = `brew list ${dependency}`;
                    break;
                case 'linux':
                    command = `dnf list installed ${dependency}`;
                    break;
                case 'windows':
                    command = `choco list --local-only ${dependency}`;
                    break;
                default:
                    reject(new Error(`Unsupported platform: ${this.platform}`));
                    return;
            }

            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Dependency ${dependency} not found`));
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    async installDependencies() {
        const missing = (await this.checkDependencies()).missing;
        
        if (missing.length === 0) {
            console.log('✅ All dependencies are already installed');
            return true;
        }

        console.log(`📦 Installing missing dependencies: ${missing.join(', ')}`);
        
        const installCommand = `${this.config.installCommand} ${missing.join(' ')}`;
        
        return new Promise((resolve, reject) => {
            console.log(`🔧 Running: ${installCommand}`);
            
            exec(installCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error(`❌ Failed to install dependencies: ${error.message}`);
                    reject(error);
                } else {
                    console.log('✅ Dependencies installed successfully');
                    resolve(true);
                }
            });
        });
    }

    async buildMiner() {
        console.log(`🔨 Building CPUMiner for ${this.platform}...`);
        
        // Check if minerd already exists
        if (fs.existsSync(this.config.minerPath)) {
            console.log('✅ CPUMiner already built');
            return true;
        }

        // Clone CPUMiner if not exists
        if (!fs.existsSync('./cpuminer')) {
            console.log('📥 Cloning CPUMiner repository...');
            await this.cloneCPUMiner();
        }

        // Build CPUMiner
        return new Promise((resolve, reject) => {
            const commands = this.config.buildCommand.split(' && ');
            let currentCommand = 0;

            const runNextCommand = () => {
                if (currentCommand >= commands.length) {
                    // Copy built binary to project root
                    const sourcePath = path.join('./cpuminer', this.config.minerBinary);
                    const destPath = this.config.minerPath;
                    
                    if (fs.existsSync(sourcePath)) {
                        fs.copyFileSync(sourcePath, destPath);
                        fs.chmodSync(destPath, '755');
                        console.log('✅ CPUMiner built successfully');
                        resolve(true);
                    } else {
                        reject(new Error('CPUMiner binary not found after build'));
                    }
                    return;
                }

                const command = commands[currentCommand];
                console.log(`🔨 Running: ${command}`);
                
                exec(command, { cwd: './cpuminer' }, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`❌ Build command failed: ${error.message}`);
                        reject(error);
                    } else {
                        currentCommand++;
                        runNextCommand();
                    }
                });
            };

            runNextCommand();
        });
    }

    async cloneCPUMiner() {
        return new Promise((resolve, reject) => {
            exec('git clone https://github.com/pooler/cpuminer.git', (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    console.log('✅ CPUMiner repository cloned');
                    resolve();
                }
            });
        });
    }

    getMinerCommand(walletAddress, poolUrl, threads) {
        const baseCommand = this.config.minerPath;
        const params = [
            '--algo=sha256d',
            `--url=${poolUrl}`,
            `--user=${walletAddress}`,
            '--pass=x',
            `--threads=${threads}`,
            '--retries=10',
            '--timeout=60',
            '--scantime=5'
        ];

        return {
            command: baseCommand,
            args: params,
            options: {
                cwd: process.cwd(),
                stdio: ['pipe', 'pipe', 'pipe']
            }
        };
    }

    getOptimalThreads() {
        const cpuCores = os.cpus().length;
        
        // Conservative thread allocation for stability
        switch (this.platform) {
            case 'macos':
                return Math.max(1, Math.floor(cpuCores * 0.8)); // 80% of cores
            case 'windows':
                return Math.max(1, Math.floor(cpuCores * 0.7)); // 70% of cores
            case 'linux':
                return Math.max(1, Math.floor(cpuCores * 0.9)); // 90% of cores
            default:
                return Math.max(1, Math.floor(cpuCores * 0.5)); // 50% of cores
        }
    }

    async createServiceScript() {
        const scriptContent = this.getServiceScript();
        const scriptPath = this.getServiceScriptPath();
        
        fs.writeFileSync(scriptPath, scriptContent);
        
        if (this.config.executable) {
            fs.chmodSync(scriptPath, '755');
        }
        
        return scriptPath;
    }

    getServiceScript() {
        const currentDir = process.cwd();
        const nodePath = process.execPath;
        
        switch (this.platform) {
            case 'macos':
                return `#!/bin/bash
# Bitcoin Mining Service for macOS
cd "${currentDir}"
${nodePath} bitcoin-mining-server.js
`;
            case 'linux':
                return `#!/bin/bash
# Bitcoin Mining Service for Linux
cd "${currentDir}"
${nodePath} bitcoin-mining-server.js
`;
            case 'windows':
                return `@echo off
REM Bitcoin Mining Service for Windows
cd /d "${currentDir}"
"${nodePath}" bitcoin-mining-server.js
`;
            default:
                throw new Error(`Unsupported platform: ${this.platform}`);
        }
    }

    getServiceScriptPath() {
        const filename = this.platform === 'windows' ? 'start-mining.bat' : 'start-mining.sh';
        return path.join(process.cwd(), filename);
    }

    getInstallationGuide() {
        const guides = {
            macos: `
🍎 macOS Installation Guide:

1. Install Homebrew (if not installed):
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

2. Install dependencies:
   brew install autoconf automake libtool curl openssl gcc make git

3. Run the installer:
   chmod +x install-macos.sh && ./install-macos.sh

4. Start mining:
   node bitcoin-mining-server.js
`,
            linux: `
🐧 Linux Installation Guide:

1. Update package manager:
   sudo dnf update (Fedora/RHEL) or sudo apt update (Ubuntu/Debian)

2. Install dependencies:
   sudo dnf install autoconf automake libtool curl-devel openssl-devel gcc make git
   OR: sudo apt install autoconf automake libtool libcurl4-openssl-dev libssl-dev gcc make git

3. Run the installer:
   chmod +x install-linux.sh && ./install-linux.sh

4. Start mining:
   node bitcoin-mining-server.js
`,
            windows: `
🪟 Windows Installation Guide:

1. Install Chocolatey (if not installed):
   Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

2. Install dependencies:
   choco install mingw-w64 autotools curl openssl

3. Run the installer:
   .\\install-windows.bat

4. Start mining:
   node bitcoin-mining-server.js
`
        };

        return guides[this.platform] || guides.linux;
    }

    getSystemInfo() {
        return {
            platform: this.platform,
            architecture: this.architecture,
            os: os.platform(),
            release: os.release(),
            hostname: os.hostname(),
            cpuCores: os.cpus().length,
            totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024),
            freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024),
            uptime: os.uptime(),
            nodeVersion: process.version,
            config: this.config
        };
    }
}

module.exports = PlatformDetector;
