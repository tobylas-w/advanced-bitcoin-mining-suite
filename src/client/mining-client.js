const WebSocket = require('ws');
const axios = require('axios');
const SystemMonitor = require('../utils/SystemMonitor');
const EventEmitter = require('events');

class OfficeMiningClient extends EventEmitter {
    constructor(config) {
        super();
        this.config = {
            centralServer: 'http://your-host-computer:3000', // Your main computer
            reconnectInterval: 5000,
            heartbeatInterval: 30000,
            ...config
        };
        
        this.isConnected = false;
        this.isMining = false;
        this.systemMonitor = new SystemMonitor();
        this.miningStats = {
            hashrate: 0,
            shares: { accepted: 0, rejected: 0, total: 0 },
            uptime: 0,
            temperature: { cpu: 0, gpu: [] },
            lastShareTime: null
        };
        
        this.startTime = null;
        this.miningThreads = [];
        this.ws = null;
    }

    /**
     * Start the mining client
     */
    async start() {
        try {
            console.log('🚀 Starting Bitcoin Mining Client...');
            console.log(`🌐 Connecting to: ${this.config.centralServer}`);
            
            // Connect to central server
            await this.connectToCentralServer();
            
            // Start system monitoring
            this.startSystemMonitoring();
            
            // Register this client
            await this.registerClient();
            
            console.log('✅ Mining client started successfully');
            console.log('💻 Waiting for mining commands from central server...');
            
        } catch (error) {
            console.error('❌ Failed to start mining client:', error.message);
            this.scheduleReconnect();
        }
    }

    /**
     * Connect to central server via WebSocket
     */
    async connectToCentralServer() {
        return new Promise((resolve, reject) => {
            const wsUrl = this.config.centralServer.replace('http', 'ws') + '/ws';
            this.ws = new WebSocket(wsUrl);
            
            this.ws.on('open', () => {
                console.log('🔗 Connected to central server');
                this.isConnected = true;
                this.startHeartbeat();
                resolve();
            });
            
            this.ws.on('message', (data) => {
                this.handleCentralCommand(JSON.parse(data));
            });
            
            this.ws.on('close', () => {
                console.log('🔌 Disconnected from central server');
                this.isConnected = false;
                this.scheduleReconnect();
            });
            
            this.ws.on('error', (error) => {
                console.error('❌ WebSocket error:', error.message);
                reject(error);
            });
        });
    }

    /**
     * Register this client with central server
     */
    async registerClient() {
        try {
            const systemInfo = await this.systemMonitor.getSystemInfo();
            const clientInfo = {
                type: 'register',
                data: {
                    hostname: require('os').hostname(),
                    platform: require('os').platform(),
                    cpu: systemInfo.cpu,
                    memory: systemInfo.memory,
                    gpu: systemInfo.gpu,
                    timestamp: new Date().toISOString()
                }
            };
            
            this.sendToCentral(clientInfo);
            console.log('📋 Registered with central server');
            
        } catch (error) {
            console.error('❌ Failed to register client:', error.message);
        }
    }

    /**
     * Handle commands from central server
     */
    handleCentralCommand(command) {
        console.log('📨 Received command:', command.type);
        
        switch (command.type) {
            case 'startMining':
                this.startMining(command.data);
                break;
            case 'stopMining':
                this.stopMining();
                break;
            case 'updateSettings':
                this.updateSettings(command.data);
                break;
            case 'requestStatus':
                this.sendStatus();
                break;
            case 'heartbeat':
                // Respond to heartbeat
                break;
            default:
                console.log('❓ Unknown command:', command.type);
        }
    }

    /**
     * Start mining on this client
     */
    async startMining(settings = {}) {
        if (this.isMining) {
            console.log('⚠️ Mining already running');
            return;
        }
        
        try {
            console.log('⚡ Starting Bitcoin mining...');
            
            // Initialize mining
            this.isMining = true;
            this.startTime = Date.now();
            this.miningStats = {
                hashrate: 0,
                shares: { accepted: 0, rejected: 0, total: 0 },
                uptime: 0,
                temperature: { cpu: 0, gpu: [] },
                lastShareTime: null
            };
            
            // Start mining threads
            await this.startMiningThreads(settings);
            
            // Send confirmation
            this.sendToCentral({
                type: 'miningStarted',
                data: { hostname: require('os').hostname() }
            });
            
            console.log('✅ Mining started successfully');
            
        } catch (error) {
            console.error('❌ Failed to start mining:', error.message);
            this.isMining = false;
        }
    }

    /**
     * Stop mining on this client
     */
    async stopMining() {
        if (!this.isMining) {
            console.log('⚠️ Mining not running');
            return;
        }
        
        try {
            console.log('⏹️ Stopping Bitcoin mining...');
            
            // Stop mining threads
            this.stopMiningThreads();
            
            this.isMining = false;
            
            // Send confirmation
            this.sendToCentral({
                type: 'miningStopped',
                data: { hostname: require('os').hostname() }
            });
            
            console.log('✅ Mining stopped successfully');
            
        } catch (error) {
            console.error('❌ Failed to stop mining:', error.message);
        }
    }

    /**
     * Start mining threads
     */
    async startMiningThreads(settings) {
        const threadCount = this.getOptimalThreadCount(settings);
        
        for (let i = 0; i < threadCount; i++) {
            const thread = {
                id: i,
                type: settings.cpuMining ? 'cpu' : 'gpu',
                hashrate: 0,
                shares: 0,
                running: true
            };
            
            this.miningThreads.push(thread);
            this.startMiningThread(thread, settings.intensity || 5);
        }
        
        console.log(`⚡ Started ${threadCount} mining threads`);
    }

    /**
     * Start individual mining thread
     */
    startMiningThread(thread, intensity) {
        const miningInterval = setInterval(() => {
            if (!thread.running || !this.isMining) {
                clearInterval(miningInterval);
                return;
            }
            
            // Simulate Bitcoin mining work
            const nonce = Math.floor(Math.random() * 1000000);
            const data = `block_data_${Date.now()}_${nonce}`;
            const crypto = require('crypto');
            const hash = crypto.createHash('sha256').update(data).digest('hex');
            
            // Simulate finding shares
            const shareProbability = (intensity / 10) * 0.001; // 0.1% chance per iteration
            if (Math.random() < shareProbability) {
                this.processShare(hash, thread);
            }
            
            // Update thread hashrate (simulated)
            thread.hashrate = Math.random() * 1000 + 500;
            
        }, 100); // Run every 100ms
    }

    /**
     * Process found share
     */
    processShare(hash, thread) {
        const isAccepted = Math.random() > 0.05; // 95% acceptance rate
        
        this.miningStats.shares.total++;
        thread.shares++;
        
        if (isAccepted) {
            this.miningStats.shares.accepted++;
            this.emit('shareAccepted', { hash, thread: thread.id, hostname: require('os').hostname() });
        } else {
            this.miningStats.shares.rejected++;
            this.emit('shareRejected', { hash, thread: thread.id, hostname: require('os').hostname() });
        }
        
        this.miningStats.lastShareTime = Date.now();
        
        // Send share to central server
        this.sendToCentral({
            type: 'shareFound',
            data: {
                hash: hash.substring(0, 16),
                accepted: isAccepted,
                thread: thread.id,
                hostname: require('os').hostname(),
                timestamp: Date.now()
            }
        });
    }

    /**
     * Stop mining threads
     */
    stopMiningThreads() {
        this.miningThreads.forEach(thread => {
            thread.running = false;
        });
        this.miningThreads = [];
    }

    /**
     * Get optimal thread count
     */
    getOptimalThreadCount(settings) {
        const cpuCount = require('os').cpus().length;
        return Math.max(1, Math.floor(cpuCount * 0.8)); // Use 80% of cores
    }

    /**
     * Update mining settings
     */
    updateSettings(newSettings) {
        console.log('⚙️ Updating mining settings:', newSettings);
        // In a real implementation, you'd update the mining parameters
    }

    /**
     * Send status to central server
     */
    sendStatus() {
        const status = {
            type: 'statusUpdate',
            data: {
                hostname: require('os').hostname(),
                isMining: this.isMining,
                stats: this.miningStats,
                systemInfo: this.systemMonitor.getSystemInfo(),
                timestamp: new Date().toISOString()
            }
        };
        
        this.sendToCentral(status);
    }

    /**
     * Start system monitoring
     */
    startSystemMonitoring() {
        setInterval(async () => {
            try {
                await this.updateMiningStats();
                this.sendStatus();
            } catch (error) {
                console.error('❌ System monitoring error:', error.message);
            }
        }, 10000); // Update every 10 seconds
    }

    /**
     * Update mining statistics
     */
    async updateMiningStats() {
        if (!this.isMining) return;
        
        try {
            // Update uptime
            this.miningStats.uptime = this.startTime ? Date.now() - this.startTime : 0;
            
            // Calculate total hashrate
            this.miningStats.hashrate = this.miningThreads.reduce((total, thread) => {
                return total + thread.hashrate;
            }, 0);
            
            // Update system information
            const systemInfo = await this.systemMonitor.getSystemInfo();
            this.miningStats.temperature = {
                cpu: systemInfo.cpu.temperature,
                gpu: systemInfo.gpu.controllers.map(gpu => ({
                    name: gpu.name,
                    temperature: gpu.temperatureGpu
                }))
            };
            
        } catch (error) {
            console.error('❌ Failed to update mining stats:', error.message);
        }
    }

    /**
     * Send data to central server
     */
    sendToCentral(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    /**
     * Start heartbeat to keep connection alive
     */
    startHeartbeat() {
        setInterval(() => {
            if (this.isConnected) {
                this.sendToCentral({ type: 'heartbeat' });
            }
        }, this.config.heartbeatInterval);
    }

    /**
     * Schedule reconnection
     */
    scheduleReconnect() {
        if (!this.isConnected) {
            setTimeout(() => {
                console.log('🔄 Attempting to reconnect...');
                this.connectToCentralServer().catch(() => {
                    this.scheduleReconnect();
                });
            }, this.config.reconnectInterval);
        }
    }

    /**
     * Stop the mining client
     */
    async stop() {
        console.log('🛑 Stopping mining client...');
        
        if (this.isMining) {
            await this.stopMining();
        }
        
        if (this.ws) {
            this.ws.close();
        }
        
        console.log('✅ Mining client stopped');
    }
}

// Start client if run directly
if (require.main === module) {
    const client = new OfficeMiningClient();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down gracefully...');
        await client.stop();
        process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
        console.log('\n🛑 Shutting down gracefully...');
        await client.stop();
        process.exit(0);
    });
    
    // Start the client
    client.start().catch(console.error);
}

module.exports = OfficeMiningClient;




