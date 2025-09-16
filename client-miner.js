#!/usr/bin/env node

const { spawn } = require('child_process');
const EventEmitter = require('events');
const os = require('os');
const http = require('http');

/**
 * Client Bitcoin Mining System
 * Designed to run on office/client computers
 * Reports back to central server
 */
class ClientMiner extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.isRunning = false;
        this.cpuMiner = null;
        this.gpuMiner = null;
        this.serverUrl = config.serverUrl || 'http://localhost:3000';
        this.clientId = config.clientId || this.generateClientId();
        
        this.stats = {
            clientId: this.clientId,
            hostname: os.hostname(),
            platform: os.platform(),
            cpuCores: os.cpus().length,
            totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024), // GB
            cpuHashrate: 0,
            gpuHashrate: 0,
            totalHashrate: 0,
            cpuShares: { accepted: 0, rejected: 0, total: 0 },
            gpuShares: { accepted: 0, rejected: 0, total: 0 },
            totalShares: { accepted: 0, rejected: 0, total: 0 },
            uptime: 0,
            earnings: { daily: 0, hourly: 0, total: 0 },
            powerConsumption: 0,
            temperature: { cpu: 0, gpu: 0 },
            lastShareTime: null,
            gpuDetected: false,
            gpuType: 'Unknown',
            lastReportTime: new Date(),
            status: 'stopped'
        };
        
        this.startTime = null;
        this.walletAddress = config.walletAddress || 'bc1qgef2v0taxcae8wfmf868ydg92qp36guv68ddh4';
        this.workerName = config.workerName || `${os.hostname()}-client`;
        
        // Detect hardware
        this.detectHardware();
        
        // Register with server
        this.registerWithServer();
        
        // Start periodic reporting
        this.startReporting();
    }

    generateClientId() {
        return `${os.hostname()}-${os.platform()}-${Date.now()}`;
    }

    detectHardware() {
        console.log(`🔍 Detecting hardware on ${os.hostname()}...`);
        
        // Check for GPU
        const { exec } = require('child_process');
        
        // Check for AMD GPU
        exec('lspci | grep -i "radeon\\|amd"', (error, stdout) => {
            if (stdout.includes('Radeon') || stdout.includes('AMD')) {
                console.log('🎮 AMD Radeon GPU detected!');
                this.stats.gpuDetected = true;
                this.stats.gpuType = 'AMD Radeon';
            }
        });
        
        // Check for NVIDIA GPU
        exec('nvidia-smi', (error, stdout) => {
            if (!error) {
                console.log('🎮 NVIDIA GPU detected!');
                this.stats.gpuDetected = true;
                this.stats.gpuType = 'NVIDIA';
            }
        });
        
        // Windows GPU detection
        if (os.platform() === 'win32') {
            exec('wmic path win32_VideoController get name', (error, stdout) => {
                if (stdout.includes('NVIDIA') || stdout.includes('AMD') || stdout.includes('Radeon')) {
                    console.log('🎮 GPU detected via Windows!');
                    this.stats.gpuDetected = true;
                    this.stats.gpuType = 'Windows GPU';
                }
            });
        }
        
        console.log(`💻 CPU Cores: ${this.stats.cpuCores}`);
        console.log(`🧠 Memory: ${this.stats.totalMemory}GB`);
        console.log(`🎮 GPU Detected: ${this.stats.gpuDetected ? 'Yes' : 'No'}`);
        if (this.stats.gpuDetected) {
            console.log(`🎮 GPU Type: ${this.stats.gpuType}`);
        }
    }

    async registerWithServer() {
        try {
            console.log(`📡 Registering with server: ${this.serverUrl}`);
            
            const data = JSON.stringify({
                clientId: this.clientId,
                hostname: this.stats.hostname,
                platform: this.stats.platform,
                cpuCores: this.stats.cpuCores,
                totalMemory: this.stats.totalMemory,
                gpuDetected: this.stats.gpuDetected,
                gpuType: this.stats.gpuType,
                status: 'registered'
            });

            const options = {
                hostname: this.serverUrl.replace('http://', '').replace('https://', '').split(':')[0],
                port: this.serverUrl.includes(':3000') ? 3000 : 80,
                path: '/api/clients/register',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length
                }
            };

            const req = http.request(options, (res) => {
                console.log(`✅ Successfully registered with server (Status: ${res.statusCode})`);
            });

            req.on('error', (error) => {
                console.log(`⚠️ Could not register with server: ${error.message}`);
                console.log('📝 Running in standalone mode');
            });

            req.write(data);
            req.end();
            
        } catch (error) {
            console.log(`⚠️ Registration failed: ${error.message}`);
            console.log('📝 Running in standalone mode');
        }
    }

    async startMining(options = {}) {
        try {
            console.log('🚀 Starting Client Bitcoin Mining...');
            console.log(`💰 Wallet: ${this.walletAddress}`);
            console.log(`👷 Worker: ${this.workerName}`);
            console.log(`🖥️ Client: ${this.stats.hostname}`);
            
            this.isRunning = true;
            this.startTime = Date.now();
            this.stats.status = 'mining';
            
            // Start CPU mining
            await this.startCPUMining();
            
            // Start GPU mining if available
            if (this.stats.gpuDetected) {
                await this.startGPUMining();
            }
            
            // Start monitoring
            this.startMonitoring();
            
            this.emit('miningStarted', this.stats);
            console.log('✅ Client mining started successfully!');
            
            // Report to server
            this.reportToServer();
            
        } catch (error) {
            console.error('❌ Error starting client mining:', error);
            this.emit('error', error);
        }
    }

    async startCPUMining() {
        console.log('💻 Starting CPU mining...');
        
        // Use 75% of available CPU cores
        const cpuThreads = Math.max(1, Math.floor(this.stats.cpuCores * 0.75));
        
        // Determine miner executable based on platform
        let minerExecutable = './minerd';
        if (os.platform() === 'win32') {
            minerExecutable = 'minerd.exe';
        }
        
        this.cpuMiner = spawn(minerExecutable, [
            '--algo=sha256d',
            '--url=stratum+tcp://btc.ss.poolin.com:443',
            `--user=${this.walletAddress}`,
            `--pass=${this.workerName}-cpu`,
            `--threads=${cpuThreads}`,
            '--retries=10',
            '--timeout=60',
            '--scantime=5'
        ]);

        this.cpuMiner.stdout.on('data', (data) => {
            this.parseCPUMinerOutput(data.toString());
        });

        this.cpuMiner.stderr.on('data', (data) => {
            this.parseCPUMinerOutput(data.toString());
        });

        this.cpuMiner.on('close', (code) => {
            console.log(`💻 CPU miner exited with code ${code}`);
            if (this.isRunning) {
                console.log('🔄 Restarting CPU miner...');
                setTimeout(() => this.startCPUMining(), 5000);
            }
        });

        console.log(`💻 CPU mining started with ${cpuThreads} threads`);
    }

    async startGPUMining() {
        if (!this.stats.gpuDetected) {
            console.log('⚠️ No GPU detected, skipping GPU mining');
            return;
        }

        console.log('🎮 Starting GPU mining...');
        
        // For now, we'll use CPU miner with different settings to simulate GPU
        // In a real implementation, you'd use GPU-specific miners like:
        // - sgminer (AMD)
        // - cudaminer (NVIDIA)
        // - ccminer (NVIDIA)
        
        const gpuThreads = this.stats.gpuDetected ? 2 : 0;
        
        if (gpuThreads > 0) {
            let minerExecutable = './minerd';
            if (os.platform() === 'win32') {
                minerExecutable = 'minerd.exe';
            }
            
            this.gpuMiner = spawn(minerExecutable, [
                '--algo=sha256d',
                '--url=stratum+tcp://btc.ss.poolin.com:443',
                `--user=${this.walletAddress}`,
                `--pass=${this.workerName}-gpu`,
                `--threads=${gpuThreads}`,
                '--retries=10',
                '--timeout=60',
                '--scantime=5'
            ]);

            this.gpuMiner.stdout.on('data', (data) => {
                this.parseGPUMinerOutput(data.toString());
            });

            this.gpuMiner.stderr.on('data', (data) => {
                this.parseGPUMinerOutput(data.toString());
            });

            this.gpuMiner.on('close', (code) => {
                console.log(`🎮 GPU miner exited with code ${code}`);
                if (this.isRunning && this.stats.gpuDetected) {
                    console.log('🔄 Restarting GPU miner...');
                    setTimeout(() => this.startGPUMining(), 5000);
                }
            });

            console.log(`🎮 GPU mining started with ${gpuThreads} threads`);
        }
    }

    parseCPUMinerOutput(output) {
        const lines = output.split('\n');
        lines.forEach(line => {
            if (line.includes('khash/s')) {
                const match = line.match(/(\d+\.?\d*)\s*khash\/s/i);
                if (match) {
                    this.stats.cpuHashrate = parseFloat(match[1]) * 1000; // Convert to H/s
                    this.updateTotalHashrate();
                }
            }
            
            if (line.includes('accepted:')) {
                const match = line.match(/accepted:\s*(\d+)\/(\d+)/);
                if (match) {
                    this.stats.cpuShares.accepted = parseInt(match[1]);
                    this.stats.cpuShares.total = parseInt(match[2]);
                    this.stats.cpuShares.rejected = this.stats.cpuShares.total - this.stats.cpuShares.accepted;
                    this.updateTotalShares();
                }
            }
        });
    }

    parseGPUMinerOutput(output) {
        const lines = output.split('\n');
        lines.forEach(line => {
            if (line.includes('khash/s')) {
                const match = line.match(/(\d+\.?\d*)\s*khash\/s/i);
                if (match) {
                    this.stats.gpuHashrate = parseFloat(match[1]) * 1000; // Convert to H/s
                    this.updateTotalHashrate();
                }
            }
            
            if (line.includes('accepted:')) {
                const match = line.match(/accepted:\s*(\d+)\/(\d+)/);
                if (match) {
                    this.stats.gpuShares.accepted = parseInt(match[1]);
                    this.stats.gpuShares.total = parseInt(match[2]);
                    this.stats.gpuShares.rejected = this.stats.gpuShares.total - this.stats.gpuShares.accepted;
                    this.updateTotalShares();
                }
            }
        });
    }

    updateTotalHashrate() {
        this.stats.totalHashrate = this.stats.cpuHashrate + this.stats.gpuHashrate;
        this.emit('hashrateUpdate', this.stats.totalHashrate);
        console.log(`📊 ${this.stats.hostname} Hashrate: ${Math.round(this.stats.totalHashrate / 1000000)} MH/s (CPU: ${Math.round(this.stats.cpuHashrate / 1000000)} MH/s, GPU: ${Math.round(this.stats.gpuHashrate / 1000000)} MH/s)`);
        
        // Report to server
        this.reportToServer();
    }

    updateTotalShares() {
        this.stats.totalShares.accepted = this.stats.cpuShares.accepted + this.stats.gpuShares.accepted;
        this.stats.totalShares.rejected = this.stats.cpuShares.rejected + this.stats.gpuShares.rejected;
        this.stats.totalShares.total = this.stats.totalShares.accepted + this.stats.totalShares.rejected;
        this.stats.lastShareTime = new Date();
        this.emit('shareFound', this.stats.totalShares);
        
        // Report to server
        this.reportToServer();
    }

    startMonitoring() {
        // Update stats every 30 seconds
        this.monitoringInterval = setInterval(() => {
            this.updateStats();
        }, 30000);
    }

    startReporting() {
        // Report to server every 60 seconds
        this.reportingInterval = setInterval(() => {
            this.reportToServer();
        }, 60000);
    }

    updateStats() {
        if (this.startTime) {
            this.stats.uptime = Date.now() - this.startTime;
        }

        // Calculate earnings based on total hashrate
        const bitcoinPrice = 115000; // USD
        const networkDifficulty = 95.5; // Trillion
        const blockReward = 6.25; // BTC
        
        // Simplified earnings calculation
        const dailyBTC = (this.stats.totalHashrate / 1000000000000) * 0.0001;
        this.stats.earnings.daily = dailyBTC * bitcoinPrice;
        this.stats.earnings.hourly = this.stats.earnings.daily / 24;
        this.stats.earnings.total += this.stats.earnings.hourly / 60; // Accumulate

        this.emit('statsUpdated', this.stats);
    }

    reportToServer() {
        try {
            const data = JSON.stringify({
                clientId: this.clientId,
                ...this.stats,
                lastReportTime: new Date()
            });

            const options = {
                hostname: this.serverUrl.replace('http://', '').replace('https://', '').split(':')[0],
                port: this.serverUrl.includes(':3000') ? 3000 : 80,
                path: '/api/clients/stats',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length
                }
            };

            const req = http.request(options, (res) => {
                // Server received our stats
            });

            req.on('error', (error) => {
                // Server not available, continue mining anyway
            });

            req.write(data);
            req.end();
            
        } catch (error) {
            // Continue mining even if server reporting fails
        }
    }

    async stopMining() {
        try {
            console.log('⏹️ Stopping client mining...');
            this.isRunning = false;
            this.stats.status = 'stopped';

            if (this.cpuMiner) {
                this.cpuMiner.kill('SIGTERM');
                this.cpuMiner = null;
            }

            if (this.gpuMiner) {
                this.gpuMiner.kill('SIGTERM');
                this.gpuMiner = null;
            }

            if (this.monitoringInterval) {
                clearInterval(this.monitoringInterval);
            }

            if (this.reportingInterval) {
                clearInterval(this.reportingInterval);
            }

            this.emit('miningStopped', this.stats);
            console.log('✅ Client mining stopped successfully');
            
            // Report final status
            this.reportToServer();
            
        } catch (error) {
            console.error('❌ Error stopping client mining:', error);
            this.emit('error', error);
        }
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            stats: this.stats,
            wallet: this.walletAddress,
            worker: this.workerName,
            serverUrl: this.serverUrl
        };
    }
}

module.exports = ClientMiner;

// CLI usage
if (require.main === module) {
    const config = {
        serverUrl: process.env.SERVER_URL || 'http://localhost:3000',
        walletAddress: process.env.WALLET_ADDRESS || 'bc1qgef2v0taxcae8wfmf868ydg92qp36guv68ddh4',
        workerName: process.env.WORKER_NAME || `${os.hostname()}-client`
    };
    
    const miner = new ClientMiner(config);
    
    miner.on('miningStarted', (stats) => {
        console.log(`🚀 Client mining started on ${stats.hostname}!`);
        console.log(`📊 Initial hashrate: ${Math.round(stats.totalHashrate / 1000000)} MH/s`);
        console.log(`🎮 GPU Available: ${stats.gpuDetected ? 'Yes' : 'No'}`);
    });
    
    miner.on('hashrateUpdate', (hashrate) => {
        console.log(`📈 Hashrate update: ${Math.round(hashrate / 1000000)} MH/s`);
    });
    
    miner.on('shareFound', (shares) => {
        console.log(`✅ Share found: ${shares.accepted}/${shares.total} accepted`);
    });
    
    miner.on('error', (error) => {
        console.error('❌ Mining error:', error);
    });
    
    // Start mining
    miner.startMining();
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down client mining...');
        await miner.stopMining();
        process.exit(0);
    });
}
