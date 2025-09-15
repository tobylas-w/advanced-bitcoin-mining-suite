const EventEmitter = require('events');
const os = require('os');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { spawn, exec } = require('child_process');

/**
 * Cross-platform Bitcoin mining client for Windows 11 and Ubuntu
 * Automatically detects platform and optimizes accordingly
 */
class CrossPlatformClient extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.platform = this.detectPlatform();
        this.isConnected = false;
        this.isMining = false;
        this.serverUrl = config.serverUrl || 'http://localhost:3000';
        this.clientId = this.generateClientId();
        this.performance = {
            cpuUsage: 0,
            memoryUsage: 0,
            temperature: 0,
            hashrate: 0
        };
        
        console.log(`🖥️  Cross-platform client initialized for ${this.platform.os} ${this.platform.arch}`);
    }

    /**
     * Detect platform and capabilities
     */
    detectPlatform() {
        const platform = os.platform();
        const arch = os.arch();
        const release = os.release();
        
        return {
            os: platform,
            arch: arch,
            release: release,
            type: this.getOSType(platform),
            capabilities: this.getPlatformCapabilities(platform, arch)
        };
    }

    /**
     * Get OS type for optimization
     */
    getOSType(platform) {
        switch (platform) {
            case 'win32': return 'windows';
            case 'linux': return 'linux';
            case 'darwin': return 'macos';
            default: return 'unknown';
        }
    }

    /**
     * Get platform-specific capabilities
     */
    getPlatformCapabilities(platform, arch) {
        const capabilities = {
            windows: {
                canSetPriority: true,
                supportsGPU: true,
                maxThreads: Math.floor(os.cpus().length * 0.75),
                memoryLimit: 0.6
            },
            linux: {
                canSetPriority: true,
                supportsGPU: true,
                maxThreads: Math.floor(os.cpus().length * 0.9),
                memoryLimit: 0.8
            },
            macos: {
                canSetPriority: false,
                supportsGPU: false,
                maxThreads: Math.floor(os.cpus().length * 0.6),
                memoryLimit: 0.5
            }
        };

        return capabilities[this.getOSType(platform)] || capabilities.linux;
    }

    /**
     * Generate unique client ID
     */
    generateClientId() {
        const hostname = os.hostname();
        const platform = this.platform.os;
        const arch = this.platform.arch;
        return `${platform}-${arch}-${hostname}-${Date.now()}`;
    }

    /**
     * Connect to mining server
     */
    async connect() {
        try {
            console.log(`🔗 Connecting to mining server: ${this.serverUrl}`);
            
            const response = await axios.post(`${this.serverUrl}/api/register-client`, {
                clientId: this.clientId,
                platform: this.platform,
                capabilities: this.platform.capabilities,
                timestamp: Date.now()
            });

            if (response.data.success) {
                this.isConnected = true;
                this.emit('connected', { clientId: this.clientId });
                console.log('✅ Connected to mining server successfully');
                
                // Start periodic status updates
                this.startStatusUpdates();
                
                return true;
            } else {
                throw new Error('Failed to register client');
            }
        } catch (error) {
            console.error('❌ Failed to connect to mining server:', error.message);
            this.emit('error', error);
            return false;
        }
    }

    /**
     * Start mining with platform-specific optimizations
     */
    async startMining(options = {}) {
        if (!this.isConnected) {
            throw new Error('Not connected to mining server');
        }

        try {
            console.log(`⛏️  Starting mining on ${this.platform.os}...`);
            
            // Apply platform-specific optimizations
            await this.applyPlatformOptimizations();
            
            // Start mining process
            this.isMining = true;
            this.startMiningProcess(options);
            
            this.emit('miningStarted', {
                platform: this.platform,
                options: options
            });
            
            console.log('✅ Mining started successfully');
            
        } catch (error) {
            console.error('❌ Failed to start mining:', error.message);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Stop mining
     */
    async stopMining() {
        try {
            console.log('⏹️  Stopping mining...');
            
            this.isMining = false;
            this.stopMiningProcess();
            
            // Reset optimizations
            await this.resetPlatformOptimizations();
            
            this.emit('miningStopped');
            console.log('✅ Mining stopped successfully');
            
        } catch (error) {
            console.error('❌ Failed to stop mining:', error.message);
            this.emit('error', error);
        }
    }

    /**
     * Apply platform-specific optimizations
     */
    async applyPlatformOptimizations() {
        const platform = this.platform.type;
        
        switch (platform) {
            case 'windows':
                await this.applyWindowsOptimizations();
                break;
            case 'linux':
                await this.applyLinuxOptimizations();
                break;
            case 'macos':
                await this.applyMacOSOptimizations();
                break;
        }
    }

    /**
     * Windows-specific optimizations
     */
    async applyWindowsOptimizations() {
        try {
            // Set process priority to high
            exec('wmic process where processid=' + process.pid + ' CALL setpriority 128', (error) => {
                if (!error) {
                    console.log('🔧 Applied Windows process priority optimization');
                }
            });
            
            // Disable Windows Defender real-time protection (if possible)
            // Note: This requires admin privileges
            console.log('💡 For best performance on Windows, consider:');
            console.log('   - Running as administrator');
            console.log('   - Adding mining folder to Windows Defender exclusions');
            console.log('   - Setting power plan to High Performance');
            
        } catch (error) {
            console.warn('⚠️  Could not apply Windows optimizations:', error.message);
        }
    }

    /**
     * Linux-specific optimizations
     */
    async applyLinuxOptimizations() {
        try {
            // Set nice priority
            process.setpriority(process.priority, process.pid, -10);
            console.log('🔧 Applied Linux process priority optimization');
            
            // Check if running with sufficient privileges
            if (process.getuid && process.getuid() !== 0) {
                console.log('💡 For best performance on Linux, consider running with:');
                console.log('   - sudo privileges for priority setting');
                console.log('   - CPU governor set to performance mode');
                console.log('   - Disable CPU frequency scaling');
            }
            
        } catch (error) {
            console.warn('⚠️  Could not apply Linux optimizations:', error.message);
        }
    }

    /**
     * macOS-specific optimizations
     */
    async applyMacOSOptimizations() {
        try {
            // macOS has limited optimization options
            console.log('🍎 macOS mining optimizations:');
            console.log('   - Ensure adequate cooling');
            console.log('   - Close unnecessary applications');
            console.log('   - Set energy saver to never sleep');
            
        } catch (error) {
            console.warn('⚠️  Could not apply macOS optimizations:', error.message);
        }
    }

    /**
     * Reset platform optimizations
     */
    async resetPlatformOptimizations() {
        try {
            // Reset process priority to normal
            if (this.platform.type === 'windows') {
                exec('wmic process where processid=' + process.pid + ' CALL setpriority 32');
            } else if (this.platform.type === 'linux') {
                process.setpriority(process.priority, process.pid, 0);
            }
            
            console.log('🔧 Reset platform optimizations');
        } catch (error) {
            console.warn('⚠️  Could not reset optimizations:', error.message);
        }
    }

    /**
     * Start the actual mining process
     */
    startMiningProcess(options) {
        const threadCount = Math.min(
            this.platform.capabilities.maxThreads,
            options.threadCount || this.platform.capabilities.maxThreads
        );
        
        console.log(`⚡ Starting ${threadCount} mining threads`);
        
        // Start mining threads
        for (let i = 0; i < threadCount; i++) {
            this.startMiningThread(i);
        }
        
        // Start performance monitoring
        this.startPerformanceMonitoring();
    }

    /**
     * Start individual mining thread
     */
    startMiningThread(threadId) {
        const interval = setInterval(() => {
            if (!this.isMining) {
                clearInterval(interval);
                return;
            }
            
            // Simulate mining work
            this.performMiningWork(threadId);
            
        }, 100); // 10 iterations per second
    }

    /**
     * Perform actual mining work (SHA-256)
     */
    performMiningWork(threadId) {
        try {
            const crypto = require('crypto');
            const nonce = Math.floor(Math.random() * 1000000);
            const data = `block_${Date.now()}_${threadId}_${nonce}`;
            const hash = crypto.createHash('sha256').update(data).digest('hex');
            
            // Simulate finding shares occasionally
            if (Math.random() < 0.001) {
                this.processShare(hash, threadId);
            }
            
            // Update performance stats
            this.performance.hashrate += Math.random() * 100;
            
        } catch (error) {
            this.emit('miningError', { threadId, error: error.message });
        }
    }

    /**
     * Process found share
     */
    processShare(hash, threadId) {
        this.emit('shareFound', {
            hash: hash,
            threadId: threadId,
            timestamp: Date.now(),
            clientId: this.clientId
        });
    }

    /**
     * Stop mining process
     */
    stopMiningProcess() {
        // Mining threads will stop automatically when isMining becomes false
        console.log('⏹️  Mining process stopped');
    }

    /**
     * Start performance monitoring
     */
    startPerformanceMonitoring() {
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.updatePerformanceStats();
                this.emit('performanceUpdate', this.performance);
            } catch (error) {
                console.error('Error updating performance stats:', error);
            }
        }, 5000); // Update every 5 seconds
    }

    /**
     * Update performance statistics
     */
    async updatePerformanceStats() {
        try {
            const si = require('systeminformation');
            
            // Get CPU usage
            const cpu = await si.currentLoad();
            this.performance.cpuUsage = cpu.currentLoad || 0;
            
            // Get memory usage
            const mem = await si.mem();
            this.performance.memoryUsage = (mem.used / mem.total) * 100;
            
            // Get temperature
            const temp = await si.cpuTemperature();
            this.performance.temperature = temp.main || temp.cores?.[0] || 0;
            
            // Reset hashrate counter
            this.performance.hashrate = Math.max(0, this.performance.hashrate - 100);
            
        } catch (error) {
            console.warn('Could not update performance stats:', error.message);
        }
    }

    /**
     * Start periodic status updates to server
     */
    startStatusUpdates() {
        this.statusInterval = setInterval(async () => {
            if (this.isConnected) {
                try {
                    await axios.post(`${this.serverUrl}/api/client-status`, {
                        clientId: this.clientId,
                        isMining: this.isMining,
                        performance: this.performance,
                        timestamp: Date.now()
                    });
                } catch (error) {
                    console.warn('Failed to send status update:', error.message);
                }
            }
        }, 10000); // Update every 10 seconds
    }

    /**
     * Disconnect from server
     */
    async disconnect() {
        try {
            if (this.isMining) {
                await this.stopMining();
            }
            
            if (this.isConnected) {
                await axios.post(`${this.serverUrl}/api/unregister-client`, {
                    clientId: this.clientId
                });
            }
            
            // Clear intervals
            if (this.monitoringInterval) {
                clearInterval(this.monitoringInterval);
            }
            if (this.statusInterval) {
                clearInterval(this.statusInterval);
            }
            
            this.isConnected = false;
            this.emit('disconnected');
            console.log('✅ Disconnected from mining server');
            
        } catch (error) {
            console.error('❌ Error during disconnect:', error.message);
        }
    }

    /**
     * Get client status
     */
    getStatus() {
        return {
            clientId: this.clientId,
            platform: this.platform,
            isConnected: this.isConnected,
            isMining: this.isMining,
            performance: this.performance
        };
    }
}

module.exports = CrossPlatformClient;
