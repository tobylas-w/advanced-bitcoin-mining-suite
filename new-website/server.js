#!/usr/bin/env node

const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { body, validationResult, param } = require('express-validator');
const helmet = require('helmet');
const cors = require('cors');
const MiningManager = require('./mining-manager');
const BackupManager = require('./backup-manager');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3000;
const miningManager = new MiningManager();
const backupManager = new BackupManager();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for development
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', `http://${miningManager.serverIP}:3000`],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting - Relaxed for development
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs (increased for dev)
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 200, // Limit each IP to 200 API requests per minute (increased for dev)
    message: {
        success: false,
        message: 'Too many API requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const strictLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // Limit each IP to 20 requests per 5 minutes for sensitive operations (increased)
    message: {
        success: false,
        message: 'Too many sensitive requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiting - DISABLED FOR DEVELOPMENT
// app.use(generalLimiter);
// app.use('/api/', apiLimiter);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(__dirname));

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Server Error', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method
    });
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API Routes
app.get('/api/status', (req, res) => {
    try {
        const stats = miningManager.getStats();
        res.json({
            success: true,
            data: {
                isRunning: stats.isRunning,
                hashrate: stats.hashrate + ' MH/s',
                shares: stats.shares,
                uptime: stats.uptime,
                temperature: stats.temperature + '°C',
                power: stats.power + 'W'
            }
        });
    } catch (error) {
        console.error('Error in /api/status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get mining status',
            error: error.message
        });
    }
});

app.post('/api/start-mining', (req, res) => {
    try {
        const result = miningManager.startMining();
        res.json(result);
    } catch (error) {
        logger.error('Error starting mining:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start mining',
            error: error.message
        });
    }
});

app.post('/api/stop-mining', (req, res) => {
    try {
        const result = miningManager.stopMining();
        res.json(result);
    } catch (error) {
        logger.error('Error stopping mining:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to stop mining',
            error: error.message
        });
    }
});

app.post('/api/start-gpu-mining', async (req, res) => {
    try {
        const result = await miningManager.startGPUMining();
        res.json(result);
    } catch (error) {
        console.error('Error starting GPU mining:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start GPU mining',
            error: error.message
        });
    }
});

app.post('/api/stop-gpu-mining', (req, res) => {
    try {
        const result = miningManager.stopGPUMining();
        res.json(result);
    } catch (error) {
        console.error('Error stopping GPU mining:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to stop GPU mining',
            error: error.message
        });
    }
});

app.get('/api/mining-stats', (req, res) => {
    try {
        const stats = miningManager.getStats();
        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        console.error('Error getting mining stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get mining stats',
            error: error.message
        });
    }
});

app.get('/api/hashrate-history', (req, res) => {
    res.json({
        success: true,
        history: miningManager.hashrateHistory
    });
});

app.get('/api/earnings', (req, res) => {
    const stats = miningManager.getStats();
    res.json({
        success: true,
        earnings: stats.earnings || {
            btc: { hourly: 0, daily: 0, weekly: 0, monthly: 0 },
            usd: { hourly: 0, daily: 0, weekly: 0, monthly: 0 },
            thb: { hourly: 0, daily: 0, weekly: 0, monthly: 0 }
        },
        btcPrice: miningManager.btcPrice || 95000,
        thbRate: miningManager.thbRate || 35.5
    });
});

app.get('/api/system-stats', (req, res) => {
    const stats = miningManager.getStats();
    res.json({
        success: true,
        stats: {
            cpuUsage: stats.cpuUsage || 0,
            gpuUsage: stats.gpuUsage || 0,
            temperature: stats.temperature || 0,
            gpuTemperature: stats.gpuTemperature || 0,
            power: stats.power || 0
        }
    });
});

// Intensity control endpoints
app.get('/api/intensity', (req, res) => {
    const intensity = miningManager.getIntensity();
    res.json({
        success: true,
        intensity: intensity
    });
});

app.post('/api/intensity', (req, res) => {
    try {
        const { cpu, gpu, overall } = req.body;
        const intensity = miningManager.setIntensity(cpu, gpu, overall);
        res.json({
            success: true,
            message: 'Intensity settings updated',
            intensity: intensity
        });
    } catch (error) {
        logger.error('Error setting intensity settings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to set intensity settings',
            error: error.message
        });
    }
});

// Remote client endpoints
app.post('/api/remote-client', (req, res) => {
    const clientData = req.body;
    
    // Add client IP from request
    clientData.ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    
    // Update or add remote client
    const existingClient = miningManager.remoteClients.find(c => c.id === clientData.id);
    if (existingClient) {
        miningManager.updateRemoteClient(clientData.id, clientData);
    } else {
        miningManager.addRemoteClient(clientData);
    }
    
    res.json({ success: true, message: 'Client data received' });
});

app.get('/api/remote-clients', (req, res) => {
    const clients = miningManager.getRemoteClients();
    res.json({
        success: true,
        clients: clients,
        totalClients: clients.length,
        activeClients: clients.filter(c => c.status === 'mining').length
    });
});

app.get('/api/installer-info', (req, res) => {
    const info = miningManager.getClientInstallerInfo();
    res.json({
        success: true,
        installer: info
    });
});

app.get('/api/installer-script', (req, res) => {
    const info = miningManager.getClientInstallerInfo();
    res.setHeader('Content-Type', 'text/plain');
    res.send(info.installScript);
});

// Port management and error handling
const HOST = '0.0.0.0';

function startServer(port = PORT) {
    const server = app.listen(port, HOST, () => {
        logger.info('Bitcoin Mining Dashboard Server Started', { port, host: HOST });
        console.log(`\n🚀 Bitcoin Mining Dashboard Server Started`);
        console.log(`📊 Dashboard: http://localhost:${port}`);
        console.log(`🌐 Network Access: http://${miningManager.serverIP}:${port}`);
        console.log(`\n📡 Remote Client Support:`);
        console.log(`   • Client Registration: http://${miningManager.serverIP}:${port}/api/remote-client`);
        console.log(`   • Installer Script: http://${miningManager.serverIP}:${port}/api/installer-script`);
        console.log(`   • Client List: http://${miningManager.serverIP}:${port}/api/remote-clients`);
        console.log(`\n💰 Mining Pool: stratum+tcp://btc.ss.poolin.com:443`);
        console.log(`🏦 Wallet: bc1qz2zqqgdz7whfmmkpcthn5gkv4ew4dfjs6fyeat`);
        console.log(`\n💻 Ready for remote office mining clients!`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`⚠️  Port ${port} is in use, trying port ${port + 1}...`);
            setTimeout(() => startServer(port + 1), 1000);
        } else {
            console.error('❌ Server error:', err);
            process.exit(1);
        }
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down server gracefully...');
        server.close(() => {
            console.log('✅ Server closed');
            process.exit(0);
        });
    });

    process.on('SIGTERM', () => {
        console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
        server.close(() => {
            console.log('✅ Server closed');
            process.exit(0);
        });
    });

    return server;
}

// Pool management endpoints
app.get('/api/pools', (req, res) => {
    try {
        const pools = miningManager.miningPools.map((pool, index) => ({
            ...pool,
            active: index === miningManager.currentPoolIndex,
            failures: index === miningManager.currentPoolIndex ? miningManager.poolFailures : 0
        }));
        res.json({
            success: true,
            pools: pools,
            currentPool: miningManager.getCurrentPool().name
        });
    } catch (error) {
        logger.error('Error getting pools:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get pool information',
            error: error.message
        });
    }
});

app.post('/api/pools/switch/:poolIndex', 
    strictLimiter,
    [
        param('poolIndex').isInt({ min: 0, max: 10 }).withMessage('Pool index must be a valid integer')
    ],
    (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input data',
                errors: errors.array()
            });
        }

        const poolIndex = parseInt(req.params.poolIndex);
        if (poolIndex < 0 || poolIndex >= miningManager.miningPools.length) {
            return res.status(400).json({
                success: false,
                message: 'Invalid pool index'
            });
        }
        
        miningManager.currentPoolIndex = poolIndex;
        miningManager.poolFailures = 0;
        miningManager.lastPoolSwitchTime = Date.now();
        
        // Restart mining if currently running
        if (miningManager.isRunning) {
            miningManager.stopMining();
            setTimeout(() => {
                miningManager.startMining();
            }, 2000);
        }
        
        res.json({
            success: true,
            message: `Switched to ${miningManager.getCurrentPool().name}`,
            currentPool: miningManager.getCurrentPool().name
        });
    } catch (error) {
        logger.error('Error switching pools:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to switch pools',
            error: error.message
        });
    }
});

// Backup management endpoints
app.get('/api/backups', (req, res) => {
    try {
        const result = backupManager.listBackups();
        res.json(result);
    } catch (error) {
        logger.error('Error listing backups:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to list backups',
            error: error.message
        });
    }
});

app.post('/api/backups/create', strictLimiter, async (req, res) => {
    try {
        const result = await backupManager.createBackup();
        res.json(result);
    } catch (error) {
        logger.error('Error creating backup:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create backup',
            error: error.message
        });
    }
});

app.post('/api/backups/restore/:backupName', 
    strictLimiter,
    [
        param('backupName').matches(/^backup-[\w\-\.]+$/).withMessage('Invalid backup name format')
    ],
    async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input data',
                errors: errors.array()
            });
        }

        const backupName = req.params.backupName;
        const result = await backupManager.restoreBackup(backupName);
        res.json(result);
    } catch (error) {
        logger.error('Error restoring backup:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to restore backup',
            error: error.message
        });
    }
});

app.get('/api/backups/stats', (req, res) => {
    try {
        const result = backupManager.getBackupStats();
        res.json(result);
    } catch (error) {
        logger.error('Error getting backup stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get backup stats',
            error: error.message
        });
    }
});

// 404 handler (must be last)
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        path: req.path
    });
});

// Start the server
startServer();
