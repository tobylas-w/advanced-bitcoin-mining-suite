const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const BitcoinMiner = require('../core/BitcoinMiner');
const bitcoinConfig = require('../config/bitcoin');
const ProfitabilityCalculator = require('../utils/ProfitabilityCalculator');
const SystemMonitor = require('../utils/SystemMonitor');

class MiningServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        this.miner = new BitcoinMiner(bitcoinConfig);
        this.profitabilityCalc = new ProfitabilityCalculator();
        this.systemMonitor = new SystemMonitor();
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketHandlers();
        this.setupMiningEvents();
        
        this.port = process.env.PORT || 3000;
    }

    setupMiddleware() {
        this.app.use(helmet({
            contentSecurityPolicy: false // Allow inline scripts for dashboard
        }));
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, '../dashboard')));
        
        // API routes
        this.app.use('/api', this.createApiRoutes());
    }

    createApiRoutes() {
        const router = express.Router();
        
        // System information endpoint
        router.get('/system-info', async (req, res) => {
            try {
                const systemInfo = await this.systemMonitor.getSystemInfo();
                res.json(systemInfo);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Bitcoin price endpoint
        router.get('/bitcoin-price', async (req, res) => {
            try {
                const priceData = await this.profitabilityCalc.getBitcoinPrice();
                res.json(priceData);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Mining profitability endpoint
        router.get('/profitability', async (req, res) => {
            try {
                const profitability = await this.profitabilityCalc.calculateProfitability();
                res.json(profitability);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Mining status endpoint
        router.get('/mining-status', (req, res) => {
            const status = this.miner.getStatus();
            res.json(status);
        });
        
        // Mining configuration endpoint
        router.post('/mining-config', (req, res) => {
            try {
                this.miner.updateConfig(req.body);
                res.json({ success: true, message: 'Configuration updated' });
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        });
        
        // Earnings history endpoint
        router.get('/earnings-history', (req, res) => {
            try {
                const history = this.profitabilityCalc.getEarningsHistory();
                res.json(history);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        return router;
    }

    setupRoutes() {
        // Serve dashboard
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../dashboard/index.html'));
        });
        
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                timestamp: new Date().toISOString(),
                mining: this.miner.isRunning
            });
        });
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`Client connected: ${socket.id}`);
            
            // Send current status to new client
            socket.emit('miningStats', this.miner.stats);
            
            // Handle mining start/stop
            socket.on('startMining', async (data) => {
                try {
                    if (!data.userConsent) {
                        socket.emit('error', { message: 'User consent required' });
                        return;
                    }
                    
                    await this.miner.startMining(data.userConsent);
                    socket.emit('miningStarted');
                    this.io.emit('miningStats', this.miner.stats);
                } catch (error) {
                    socket.emit('error', error);
                }
            });
            
            socket.on('stopMining', async () => {
                try {
                    await this.miner.stopMining();
                    socket.emit('miningStopped');
                    this.io.emit('miningStats', this.miner.stats);
                } catch (error) {
                    socket.emit('error', error);
                }
            });
            
            // Handle configuration updates
            socket.on('updateMiningSettings', (settings) => {
                try {
                    this.miner.updateConfig(settings);
                    socket.emit('settingsUpdated', settings);
                } catch (error) {
                    socket.emit('error', error);
                }
            });
            
            // Handle client disconnect
            socket.on('disconnect', () => {
                console.log(`Client disconnected: ${socket.id}`);
            });
        });
    }

    setupMiningEvents() {
        // Forward mining events to all connected clients
        this.miner.on('miningStarted', (stats) => {
            this.io.emit('miningStarted', stats);
        });
        
        this.miner.on('miningStopped', (stats) => {
            this.io.emit('miningStopped', stats);
        });
        
        this.miner.on('statsUpdated', (stats) => {
            this.io.emit('miningStats', stats);
        });
        
        this.miner.on('shareAccepted', (data) => {
            this.io.emit('shareAccepted', data);
        });
        
        this.miner.on('shareRejected', (data) => {
            this.io.emit('shareRejected', data);
        });
        
        this.miner.on('error', (error) => {
            this.io.emit('error', error);
        });
    }

    start() {
        this.server.listen(this.port, () => {
            console.log(`🚀 Bitcoin Mining Server running on port ${this.port}`);
            console.log(`📊 Dashboard available at http://localhost:${this.port}`);
            console.log(`💰 Ready to mine Bitcoin for extra income!`);
        });
    }

    stop() {
        this.server.close(() => {
            console.log('🛑 Mining server stopped');
        });
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    if (global.miningServer) {
        global.miningServer.stop();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down gracefully...');
    if (global.miningServer) {
        global.miningServer.stop();
    }
    process.exit(0);
});

// Start server
const miningServer = new MiningServer();
global.miningServer = miningServer;
miningServer.start();

module.exports = MiningServer;




