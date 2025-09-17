#!/usr/bin/env node

/**
 * Standalone Bitcoin Mining Client
 * Operates independently without requiring a host server
 * Continues mining and earning Bitcoin even when host is offline
 */

const { spawn } = require('child_process');
const EventEmitter = require('events');
const os = require('os');
const fs = require('fs');
const path = require('path');
const http = require('http');

class StandaloneClientMiner extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            walletAddress: config.walletAddress || 'bc1qz2zqqgdz7whfmmkpcthn5gkv4ew4dfjs6fyeat',
            workerName: config.workerName || `${os.hostname()}-standalone`,
            poolUrl: config.poolUrl || 'stratum+tcp://btc.ss.poolin.com:443',
            threads: config.threads || Math.max(1, Math.floor(os.cpus().length * 0.8)),
            serverUrl: config.serverUrl || 'http://localhost:3000',
            standaloneMode: true,
            autoStart: true,
            ...config
        };
        
        this.isRunning = false;
        this.cpuMiner = null;
        this.localServer = null;
        this.stats = {
            clientId: this.generateClientId(),
            hostname: os.hostname(),
            platform: {
                os: os.platform(),
                arch: os.arch(),
                release: os.release(),
                hostname: os.hostname(),
                cpuCores: os.cpus().length,
                totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024),
                freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024),
                uptime: os.uptime(),
                nodeVersion: process.version,
                cpuModel: os.cpus()[0]?.model || 'Unknown'
            },
            hashrate: 0,
            shares: { accepted: 0, rejected: 0, total: 0 },
            uptime: 0,
            earnings: { daily: 0, hourly: 0, total: 0 },
            powerConsumption: 0,
            temperature: { cpu: 0 },
            lastShareTime: null,
            lastReportTime: new Date(),
            status: 'stopped',
            startTime: null,
            walletBalance: 0,
            pendingPayout: 0,
            payoutThreshold: 0.001, // 0.001 BTC threshold
            poolStats: {
                connected: false,
                latency: 0,
                difficulty: 0,
                blockHeight: 0
            }
        };
        
        this.startTime = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 30000; // 30 seconds
        
        // Initialize
        this.initialize();
    }

    generateClientId() {
        return `${os.hostname()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    async initialize() {
        console.log('🚀 Initializing Standalone Bitcoin Miner...');
        console.log(`💻 Hostname: ${this.stats.hostname}`);
        console.log(`💰 Wallet: ${this.config.walletAddress}`);
        console.log(`🏊 Pool: ${this.config.poolUrl}`);
        console.log(`🧵 Threads: ${this.config.threads}`);
        
        // Start local web server for monitoring
        this.startLocalServer();
        
        // Start mining if auto-start is enabled
        if (this.config.autoStart) {
            setTimeout(() => {
                this.startMining();
            }, 2000);
        }
        
        // Start periodic tasks
        this.startPeriodicTasks();
        
        console.log('✅ Standalone miner initialized');
    }

    startLocalServer() {
        const express = require('express');
        const app = express();
        
        app.use(express.json());
        app.use(express.static('public'));
        
        // Serve a simple dashboard
        app.get('/', (req, res) => {
            res.send(this.generateDashboardHTML());
        });
        
        // API endpoints
        app.get('/api/status', (req, res) => {
            res.json({
                success: true,
                standalone: true,
                stats: this.stats,
                config: this.config
            });
        });
        
        app.post('/api/start', (req, res) => {
            this.startMining();
            res.json({ success: true, message: 'Mining started' });
        });
        
        app.post('/api/stop', (req, res) => {
            this.stopMining();
            res.json({ success: true, message: 'Mining stopped' });
        });
        
        app.get('/api/wallet', async (req, res) => {
            try {
                const walletInfo = await this.getWalletInfo();
                res.json({ success: true, wallet: walletInfo });
            } catch (error) {
                res.json({ success: false, error: error.message });
            }
        });
        
        this.localServer = app.listen(3001, '0.0.0.0', () => {
            console.log('📊 Local dashboard: http://localhost:3001');
            console.log('🌐 Network dashboard: http://' + this.getNetworkIP() + ':3001');
        });
    }

    startMining() {
        if (this.isRunning) {
            console.log('⚠️ Mining already running');
            return;
        }

        console.log('🚀 Starting standalone Bitcoin mining...');
        console.log(`💰 Wallet: ${this.config.walletAddress}`);
        console.log(`🏊 Pool: ${this.config.poolUrl}`);
        console.log(`🧵 Threads: ${this.config.threads}`);
        
        this.isRunning = true;
        this.startTime = Date.now();
        this.stats.startTime = new Date();
        this.stats.status = 'running';
        
        // Start CPUMiner
        this.cpuMiner = spawn('./minerd', [
            '--algo=sha256d',
            `--url=${this.config.poolUrl}`,
            `--user=${this.config.walletAddress}`,
            `--pass=${this.config.workerName}`,
            `--threads=${this.config.threads}`,
            '--retries=10',
            '--timeout=60',
            '--scantime=5'
        ], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        this.cpuMiner.stdout.on('data', (data) => {
            this.parseMinerOutput(data.toString());
        });

        this.cpuMiner.stderr.on('data', (data) => {
            this.parseMinerOutput(data.toString());
        });

        this.cpuMiner.on('exit', (code) => {
            console.log(`💻 CPUMiner exited with code ${code}`);
            this.isRunning = false;
            this.stats.status = 'stopped';
            
            // Auto-restart if not manually stopped
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                console.log(`🔄 Auto-restarting miner (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
                this.reconnectAttempts++;
                setTimeout(() => {
                    this.startMining();
                }, this.reconnectDelay);
            } else {
                console.log('❌ Max reconnection attempts reached');
            }
        });

        this.cpuMiner.on('error', (error) => {
            console.error('❌ CPUMiner error:', error.message);
            this.isRunning = false;
            this.stats.status = 'error';
        });

        console.log(`💻 Started with ${this.config.threads} CPU threads`);
        this.emit('miningStarted', { hashrate: 0, threads: this.config.threads });
    }

    stopMining() {
        console.log('⏹️ Stopping standalone Bitcoin mining...');
        this.isRunning = false;
        this.stats.status = 'stopped';
        this.reconnectAttempts = 0; // Reset reconnection attempts
        
        if (this.cpuMiner) {
            this.cpuMiner.kill('SIGTERM');
            this.cpuMiner = null;
        }
        
        console.log('✅ Mining stopped successfully');
        this.emit('miningStopped');
    }

    parseMinerOutput(output) {
        const lines = output.split('\n');
        
        lines.forEach(line => {
            if (line.includes('hashrate')) {
                const hashrateMatch = line.match(/(\d+(?:\.\d+)?)\s*(?:MH\/s|KH\/s|H\/s)/);
                if (hashrateMatch) {
                    let hashrate = parseFloat(hashrateMatch[1]);
                    if (line.includes('KH/s')) hashrate *= 1000;
                    else if (line.includes('MH/s')) hashrate *= 1000000;
                    
                    this.stats.hashrate = hashrate;
                    this.stats.poolStats.connected = true;
                    this.stats.poolStats.latency = Math.floor(Math.random() * 100) + 20; // Mock latency
                }
            }
            
            if (line.includes('accepted')) {
                const acceptedMatch = line.match(/accepted:\s*(\d+)/);
                if (acceptedMatch) {
                    this.stats.shares.accepted = parseInt(acceptedMatch[1]);
                }
            }
            
            if (line.includes('rejected')) {
                const rejectedMatch = line.match(/rejected:\s*(\d+)/);
                if (rejectedMatch) {
                    this.stats.shares.rejected = parseInt(rejectedMatch[1]);
                }
            }
            
            if (line.includes('total')) {
                const totalMatch = line.match(/total:\s*(\d+)/);
                if (totalMatch) {
                    this.stats.shares.total = parseInt(totalMatch[1]);
                }
            }
            
            if (line.includes('block')) {
                const blockMatch = line.match(/block\s+(\d+)/);
                if (blockMatch) {
                    this.stats.poolStats.blockHeight = parseInt(blockMatch[1]);
                }
            }
        });
        
        // Update earnings based on hashrate
        this.updateEarnings();
        
        // Update uptime
        if (this.startTime) {
            this.stats.uptime = Date.now() - this.startTime;
        }
        
        // Emit update
        this.emit('statsUpdate', this.stats);
    }

    updateEarnings() {
        // Simplified earnings calculation based on current Bitcoin price and hashrate
        const bitcoinPrice = 115000; // USD - would be fetched from API in production
        const networkDifficulty = 95.5; // Would be fetched from API
        const blockReward = 6.25; // BTC per block
        
        // Calculate daily earnings (simplified)
        const dailyHashrate = this.stats.hashrate * 86400; // hashes per day
        const dailyEarnings = (dailyHashrate / (networkDifficulty * Math.pow(2, 32))) * blockReward * 144; // blocks per day
        
        this.stats.earnings.daily = dailyEarnings;
        this.stats.earnings.hourly = dailyEarnings / 24;
        this.stats.earnings.total += this.stats.earnings.hourly / 3600; // Add to total every second
        
        // Update pending payout
        this.stats.pendingPayout = this.stats.earnings.total;
        
        // Check if payout threshold reached
        if (this.stats.pendingPayout >= this.stats.payoutThreshold) {
            console.log(`💰 Payout threshold reached! ${this.stats.pendingPayout.toFixed(8)} BTC pending`);
        }
    }

    async getWalletInfo() {
        // In a real implementation, this would query the blockchain
        // For now, return mock data
        return {
            address: this.config.walletAddress,
            balance: this.stats.walletBalance,
            pending: this.stats.pendingPayout,
            transactions: [],
            lastUpdated: new Date().toISOString()
        };
    }

    startPeriodicTasks() {
        // Update system stats every 30 seconds
        setInterval(() => {
            this.updateSystemStats();
        }, 30000);
        
        // Try to connect to host server every 5 minutes (optional)
        setInterval(() => {
            this.tryConnectToHost();
        }, 300000);
        
        // Save stats to file every 10 minutes
        setInterval(() => {
            this.saveStats();
        }, 600000);
    }

    updateSystemStats() {
        this.stats.platform.freeMemory = Math.round(os.freemem() / 1024 / 1024 / 1024);
        this.stats.platform.uptime = os.uptime();
        
        // Mock temperature and power consumption
        this.stats.temperature.cpu = 45 + Math.random() * 25;
        this.stats.powerConsumption = Math.round(this.config.threads * 25 + Math.random() * 50);
    }

    async tryConnectToHost() {
        // Optional: Try to connect to host server for centralized monitoring
        try {
            const response = await fetch(`${this.config.serverUrl}/api/clients/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: this.stats.clientId,
                    hostname: this.stats.hostname,
                    platform: this.stats.platform,
                    hashrate: this.stats.hashrate,
                    shares: this.stats.shares,
                    status: this.stats.status,
                    standalone: true
                })
            });
            
            if (response.ok) {
                console.log('📡 Connected to host server');
                this.reconnectAttempts = 0; // Reset on successful connection
            }
        } catch (error) {
            // Host server not available - continue standalone operation
        }
    }

    saveStats() {
        const statsFile = path.join(process.cwd(), 'mining-stats.json');
        fs.writeFileSync(statsFile, JSON.stringify({
            ...this.stats,
            lastSaved: new Date().toISOString()
        }, null, 2));
    }

    getNetworkIP() {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
        return 'localhost';
    }

    generateDashboardHTML() {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Standalone Bitcoin Miner - ${this.stats.hostname}</title>
    <style>
        body { font-family: Arial, sans-serif; background: #1a1a2e; color: white; margin: 0; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; text-align: center; }
        .stat-value { font-size: 2rem; font-weight: bold; color: #00d4ff; margin-bottom: 10px; }
        .stat-label { color: #aaa; margin-bottom: 10px; }
        .stat-detail { color: #666; font-size: 0.9rem; }
        .controls { text-align: center; margin: 30px 0; }
        .btn { padding: 10px 20px; margin: 0 10px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; }
        .btn-primary { background: #00d4ff; color: white; }
        .btn-danger { background: #ff4757; color: white; }
        .status { padding: 10px; border-radius: 5px; margin: 20px 0; }
        .status.running { background: rgba(76, 175, 80, 0.2); border: 1px solid #4caf50; }
        .status.stopped { background: rgba(244, 67, 54, 0.2); border: 1px solid #f44336; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Standalone Bitcoin Miner</h1>
            <h2>${this.stats.hostname}</h2>
            <div class="status ${this.stats.status}">
                Status: ${this.stats.status.toUpperCase()} | 
                Uptime: ${this.formatUptime(this.stats.uptime)} | 
                Threads: ${this.config.threads}
            </div>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${this.formatHashrate(this.stats.hashrate)}</div>
                <div class="stat-label">Hashrate</div>
                <div class="stat-detail">CPU Mining Active</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-value">${this.stats.shares.accepted}/${this.stats.shares.total}</div>
                <div class="stat-label">Shares</div>
                <div class="stat-detail">Accept Rate: ${this.getAcceptRate()}%</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-value">${this.stats.earnings.daily.toFixed(8)} BTC</div>
                <div class="stat-label">Daily Earnings</div>
                <div class="stat-detail">$${(this.stats.earnings.daily * 115000).toFixed(2)} USD</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-value">${this.stats.pendingPayout.toFixed(8)} BTC</div>
                <div class="stat-label">Pending Payout</div>
                <div class="stat-detail">Threshold: ${this.stats.payoutThreshold} BTC</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-value">${this.stats.temperature.cpu.toFixed(1)}°C</div>
                <div class="stat-label">CPU Temperature</div>
                <div class="stat-detail">Power: ${this.stats.powerConsumption}W</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-value">${this.stats.poolStats.connected ? 'Connected' : 'Disconnected'}</div>
                <div class="stat-label">Pool Status</div>
                <div class="stat-detail">Latency: ${this.stats.poolStats.latency}ms</div>
            </div>
        </div>
        
        <div class="controls">
            <button class="btn btn-primary" onclick="startMining()">🚀 Start Mining</button>
            <button class="btn btn-danger" onclick="stopMining()">⏹️ Stop Mining</button>
            <button class="btn btn-primary" onclick="location.reload()">🔄 Refresh</button>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #666;">
            <p><strong>Wallet:</strong> ${this.config.walletAddress}</p>
            <p><strong>Pool:</strong> ${this.config.poolUrl}</p>
            <p><strong>Standalone Mode:</strong> This miner operates independently and continues earning Bitcoin even when the host server is offline.</p>
        </div>
    </div>
    
    <script>
        function startMining() {
            fetch('/api/start', { method: 'POST' })
                .then(() => location.reload())
                .catch(err => alert('Error: ' + err.message));
        }
        
        function stopMining() {
            fetch('/api/stop', { method: 'POST' })
                .then(() => location.reload())
                .catch(err => alert('Error: ' + err.message));
        }
        
        function formatHashrate(hashrate) {
            if (hashrate >= 1000000) return (hashrate / 1000000).toFixed(2) + ' MH/s';
            if (hashrate >= 1000) return (hashrate / 1000).toFixed(2) + ' KH/s';
            return hashrate.toFixed(2) + ' H/s';
        }
        
        function formatUptime(milliseconds) {
            const seconds = Math.floor(milliseconds / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            
            if (days > 0) return days + 'd ' + (hours % 24) + 'h ' + (minutes % 60) + 'm';
            if (hours > 0) return hours + 'h ' + (minutes % 60) + 'm';
            return minutes + 'm ' + (seconds % 60) + 's';
        }
        
        function getAcceptRate() {
            const total = ${this.stats.shares.total};
            const accepted = ${this.stats.shares.accepted};
            return total > 0 ? ((accepted / total) * 100).toFixed(1) : '0.0';
        }
        
        // Auto-refresh every 30 seconds
        setTimeout(() => location.reload(), 30000);
    </script>
</body>
</html>`;
    }

    formatHashrate(hashrate) {
        if (hashrate >= 1000000) {
            return `${(hashrate / 1000000).toFixed(2)} MH/s`;
        } else if (hashrate >= 1000) {
            return `${(hashrate / 1000).toFixed(2)} KH/s`;
        } else {
            return `${hashrate.toFixed(2)} H/s`;
        }
    }

    formatUptime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else {
            return `${minutes}m ${seconds % 60}s`;
        }
    }

    getAcceptRate() {
        const total = this.stats.shares.total;
        const accepted = this.stats.shares.accepted;
        return total > 0 ? ((accepted / total) * 100).toFixed(1) : '0.0';
    }
}

// Run standalone miner if called directly
if (require.main === module) {
    const miner = new StandaloneClientMiner();
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down standalone miner...');
        miner.stopMining();
        if (miner.localServer) {
            miner.localServer.close();
        }
        process.exit(0);
    });
}

module.exports = StandaloneClientMiner;
