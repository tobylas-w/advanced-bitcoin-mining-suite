#!/usr/bin/env node

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { spawn, exec } = require('child_process');
const EventEmitter = require('events');
const os = require('os');
const path = require('path');
const PlatformDetector = require('./src/utils/PlatformDetector');

/**
 * Bitcoin Mining Server
 * Professional-grade mining management system
 */
class BitcoinMiningServer extends EventEmitter {
    constructor() {
        super();
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: { origin: "*", methods: ["GET", "POST"] }
        });
        
        this.port = process.env.PORT || 3000;
        this.host = '0.0.0.0';
        
        // Initialize platform detector
        this.platformDetector = new PlatformDetector();
        
        // Mining configuration
        this.config = {
            walletAddress: 'bc1qz2zqqgdz7whfmmkpcthn5gkv4ew4dfjs6fyeat',
            workerName: `${this.platformDetector.platform}-miner`,
            pool: {
                name: 'Antpool',
                url: 'stratum+tcp://btc.ss.poolin.com:443',
                fee: 2.0,
                reliability: 99.9
            },
            bitcoinPrice: 115000,
            networkDifficulty: 95.5
        };
        
        // System state
        this.state = {
            isRunning: false,
            clients: new Map(),
            totalHashrate: 0,
            totalShares: { accepted: 0, rejected: 0, total: 0 },
            earnings: { daily: 0, monthly: 0, yearly: 0 },
            uptime: 0,
            startTime: null,
            platform: this.platformDetector.getSystemInfo()
        };
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketHandlers();
        this.startMonitoring();
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static('.'));
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
            res.header('Access-Control-Allow-Headers', 'Content-Type');
            next();
        });
    }

    setupRoutes() {
        // Main dashboard
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'mining-dashboard.html'));
        });

        // API endpoints
        this.app.get('/api/status', (req, res) => {
            res.json({
                success: true,
                system: this.state,
                config: this.config,
                clients: Array.from(this.state.clients.values()),
                lastUpdated: new Date().toISOString()
            });
        });

        this.app.get('/api/clients', (req, res) => {
            res.json(Array.from(this.state.clients.values()));
        });

        this.app.post('/api/clients/register', (req, res) => {
            const clientData = req.body;
            const clientId = clientData.clientId || this.generateClientId();
            
            this.state.clients.set(clientId, {
                ...clientData,
                clientId,
                registeredAt: new Date(),
                lastSeen: new Date(),
                status: 'online',
                hashrate: 0,
                shares: { accepted: 0, rejected: 0, total: 0 }
            });
            
            console.log(`✅ Client registered: ${clientData.hostname} (${clientId})`);
            res.json({ success: true, clientId });
        });

        this.app.post('/api/clients/stats', (req, res) => {
            const clientData = req.body;
            const clientId = clientData.clientId;
            
            if (this.state.clients.has(clientId)) {
                const client = this.state.clients.get(clientId);
                Object.assign(client, clientData);
                client.lastSeen = new Date();
                this.updateTotalStats();
                
                // Broadcast to all connected clients
                this.io.emit('clientStatsUpdate', client);
            }
            
            res.json({ success: true });
        });

        this.app.post('/api/start-mining', (req, res) => {
            this.startLocalMining();
            res.json({ success: true, message: 'Local mining started' });
        });

        this.app.post('/api/stop-mining', (req, res) => {
            this.stopLocalMining();
            res.json({ success: true, message: 'Local mining stopped' });
        });

        this.app.get('/api/earnings', (req, res) => {
            const earnings = this.calculateEarnings();
            res.json({
                success: true,
                earnings,
                hashrate: this.state.totalHashrate,
                bitcoinPrice: this.config.bitcoinPrice,
                lastUpdated: new Date().toISOString()
            });
        });
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`📡 Client connected: ${socket.id}`);
            
            // Send current state to new client
            socket.emit('systemStatus', {
                system: this.state,
                config: this.config
            });
            socket.emit('clientList', Array.from(this.state.clients.values()));
            
            // Handle client registration with enhanced platform info
            socket.on('registerClient', (clientInfo) => {
                const enhancedClientInfo = {
                    ...clientInfo,
                    clientId: socket.id,
                    connectedAt: Date.now(),
                    lastSeen: Date.now(),
                    platform: {
                        os: clientInfo.platform?.os || 'unknown',
                        arch: clientInfo.platform?.arch || 'unknown',
                        release: clientInfo.platform?.release || '',
                        hostname: clientInfo.platform?.hostname || 'unknown',
                        cpuCores: clientInfo.platform?.cpuCores || 0,
                        totalMemory: clientInfo.platform?.totalMemory || 0,
                        nodeVersion: clientInfo.platform?.nodeVersion || 'unknown',
                        uptime: clientInfo.platform?.uptime || 0
                    },
                    status: 'online'
                };
                
                this.state.clients.set(socket.id, enhancedClientInfo);
                this.broadcastSystemUpdate();
                
                console.log(`📱 Client registered: ${enhancedClientInfo.platform.hostname} (${enhancedClientInfo.platform.os} ${enhancedClientInfo.platform.arch})`);
            });
            
            // Handle client updates
            socket.on('clientUpdate', (update) => {
                const client = this.state.clients.get(socket.id);
                if (client) {
                    Object.assign(client, update, { 
                        lastSeen: Date.now(),
                        status: 'online'
                    });
                    this.broadcastSystemUpdate();
                }
            });
            
            socket.on('disconnect', () => {
                console.log(`📡 Client disconnected: ${socket.id}`);
                const client = this.state.clients.get(socket.id);
                if (client) {
                    client.status = 'offline';
                    client.lastSeen = Date.now();
                }
                this.broadcastSystemUpdate();
            });
        });
    }

    generateClientId() {
        return `${os.hostname()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    broadcastSystemUpdate() {
        this.io.emit('systemUpdate', this.state);
        this.io.emit('clientList', Array.from(this.state.clients.values()));
    }

    startLocalMining() {
        if (this.state.isRunning) {
            console.log('⚠️ Mining already running');
            return;
        }

        console.log('🚀 Starting Bitcoin Mining...');
        console.log(`💰 Wallet: ${this.config.walletAddress}`);
        console.log(`🏊 Pool: ${this.config.pool.name}`);
        
        this.state.isRunning = true;
        this.state.startTime = Date.now();
        
        // Start CPUMiner with platform-specific configuration
        const minerConfig = this.platformDetector.getMinerCommand(
            this.config.walletAddress,
            this.config.pool.url,
            this.platformDetector.getOptimalThreads()
        );
        
        this.cpuMiner = spawn(minerConfig.command, minerConfig.args, minerConfig.options);

        this.cpuMiner.stdout.on('data', (data) => {
            this.parseMinerOutput(data.toString());
        });

        this.cpuMiner.stderr.on('data', (data) => {
            this.parseMinerOutput(data.toString());
        });

        this.cpuMiner.on('close', (code) => {
            console.log(`💻 CPUMiner exited with code ${code}`);
            if (this.state.isRunning) {
                console.log('🔄 Restarting CPUMiner...');
                setTimeout(() => this.startLocalMining(), 5000);
            }
        });

        console.log(`💻 Started with ${this.platformDetector.getOptimalThreads()} CPU threads`);
        this.io.emit('miningStarted', { hashrate: 0, threads: this.platformDetector.getOptimalThreads() });
    }

    stopLocalMining() {
        console.log('⏹️ Stopping Bitcoin Mining...');
        this.state.isRunning = false;
        
        if (this.cpuMiner) {
            this.cpuMiner.kill('SIGTERM');
            this.cpuMiner = null;
        }
        
        this.io.emit('miningStopped');
        console.log('✅ Mining stopped successfully');
    }

    parseMinerOutput(output) {
        const lines = output.split('\n');
        lines.forEach(line => {
            // Parse hashrate
            const hashrateMatch = line.match(/(\d+\.?\d*)\s*khash\/s/i);
            if (hashrateMatch) {
                const hashrate = parseFloat(hashrateMatch[1]) * 1000; // Convert to H/s
                this.state.totalHashrate = hashrate;
                this.io.emit('hashrateUpdate', hashrate);
                console.log(`📊 Hashrate: ${Math.round(hashrate / 1000000)} MH/s`);
            }
            
            // Parse shares
            const sharesMatch = line.match(/accepted:\s*(\d+)\/(\d+)/);
            if (sharesMatch) {
                const accepted = parseInt(sharesMatch[1]);
                const total = parseInt(sharesMatch[2]);
                const rejected = total - accepted;
                
                this.state.totalShares.accepted = accepted;
                this.state.totalShares.rejected = rejected;
                this.state.totalShares.total = total;
                
                this.io.emit('shareFound', { accepted, rejected, total });
                console.log(`✅ Share: ${accepted}/${total} accepted`);
            }
        });
    }

    updateTotalStats() {
        let totalHashrate = 0;
        let totalAccepted = 0;
        let totalRejected = 0;
        
        this.state.clients.forEach(client => {
            totalHashrate += client.hashrate || 0;
            totalAccepted += client.shares?.accepted || 0;
            totalRejected += client.shares?.rejected || 0;
        });
        
        this.state.totalHashrate = totalHashrate;
        this.state.totalShares.accepted = totalAccepted;
        this.state.totalShares.rejected = totalRejected;
        this.state.totalShares.total = totalAccepted + totalRejected;
    }

    calculateEarnings() {
        const hashrate = this.state.totalHashrate;
        const bitcoinPrice = this.config.bitcoinPrice;
        
        // Simplified but realistic calculation
        const dailyBTC = (hashrate / 1000000000000) * 0.0001; // Rough estimate
        const dailyUSD = dailyBTC * bitcoinPrice;
        
        return {
            dailyBTC: dailyBTC,
            dailyUSD: dailyUSD,
            monthlyBTC: dailyBTC * 30,
            monthlyUSD: dailyUSD * 30,
            yearlyBTC: dailyBTC * 365,
            yearlyUSD: dailyUSD * 365,
            hashrate: hashrate,
            bitcoinPrice: bitcoinPrice
        };
    }

    startMonitoring() {
        // Update uptime every minute
        setInterval(() => {
            if (this.state.startTime) {
                this.state.uptime = Date.now() - this.state.startTime;
            }
            
            // Update earnings
            const earnings = this.calculateEarnings();
            this.state.earnings = earnings;
            
            // Broadcast updates
            this.io.emit('systemUpdate', {
                uptime: this.state.uptime,
                totalHashrate: this.state.totalHashrate,
                totalShares: this.state.totalShares,
                earnings: earnings
            });
            
        }, 60000); // Every minute
        
        // Clean up inactive clients every 5 minutes
        setInterval(() => {
            const now = Date.now();
            this.state.clients.forEach((client, clientId) => {
                if (now - client.lastSeen.getTime() > 300000) { // 5 minutes
                    client.status = 'offline';
                    console.log(`⚠️ Client ${client.hostname} marked as offline`);
                }
            });
        }, 300000); // Every 5 minutes
    }

    start() {
        this.server.listen(this.port, this.host, () => {
            console.log('\n🚀 Bitcoin Mining Server');
            console.log('═'.repeat(40));
            console.log(`📊 Dashboard: http://localhost:${this.port}`);
            console.log(`🌐 Network: http://${this.getNetworkIP()}:${this.port}`);
            console.log(`💻 Platform: ${this.state.platform.os} ${this.state.platform.arch} (${this.state.platform.release})`);
            console.log(`🧠 CPU Cores: ${this.state.platform.cpuCores}`);
            console.log(`💾 Memory: ${this.state.platform.totalMemory}GB`);
            console.log(`💰 Wallet: ${this.config.walletAddress}`);
            console.log('\n🎯 Ready for Bitcoin Mining!');
            
            // Auto-start mining if not running
            setTimeout(() => {
                if (!this.state.isRunning) {
                    console.log('🚀 Auto-starting mining...');
                    this.startLocalMining();
                }
            }, 2000);
        });
    }

    getNetworkIP() {
        const networkInterfaces = os.networkInterfaces();
        for (const interfaceName of Object.keys(networkInterfaces)) {
            for (const netInterface of networkInterfaces[interfaceName]) {
                if (netInterface.family === 'IPv4' && !netInterface.internal) {
                    return netInterface.address;
                }
            }
        }
        return 'localhost';
    }
}

// Start the mining server
const miningServer = new BitcoinMiningServer();
miningServer.start();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Bitcoin Mining Server...');
    miningServer.stopLocalMining();
    process.exit(0);
});

module.exports = BitcoinMiningServer;
