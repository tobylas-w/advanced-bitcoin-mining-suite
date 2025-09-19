#!/usr/bin/env node

const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { body, validationResult, param } = require('express-validator');
const helmet = require('helmet');
const cors = require('cors');
const MiningManager = require('./mining-manager');
const BackupManager = require('./backup-manager');
const AlertManager = require('./alert-manager');
const ClientManager = require('./client-manager');
const NetworkManager = require('./network-manager');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3000;
const miningManager = new MiningManager();
const backupManager = new BackupManager();
const alertManager = new AlertManager();
const clientManager = new ClientManager();
const networkManager = new NetworkManager();

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

// Serve the master dashboard
app.get('/master', (req, res) => {
    res.sendFile(path.join(__dirname, 'master-dashboard.html'));
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

// Enhanced Remote Client Management Endpoints
app.post('/api/remote-client', (req, res) => {
    try {
        const clientData = req.body;
        const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
        
        // Register or update client using new client manager
        const client = clientManager.registerClient(clientData, clientIP);
        
        // Also update the old mining manager for backward compatibility
        const existingClient = miningManager.remoteClients.find(c => c.hostname === clientData.hostname);
        if (existingClient) {
            miningManager.updateRemoteClient(clientData.hostname, clientData);
        } else {
            miningManager.addRemoteClient(clientData);
        }
        
        logger.info('Remote client data received', {
            hostname: clientData.hostname,
            status: clientData.status,
            hashrate: clientData.hashrate,
            ip: clientIP,
            clientId: client.id
        });
        
        res.json({
            success: true,
            message: 'Client data received successfully',
            client: {
                id: client.id,
                config: client.config
            }
        });
    } catch (error) {
        logger.error('Error processing remote client data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process client data',
            error: error.message
        });
    }
});

app.get('/api/remote-clients', (req, res) => {
    try {
        const filter = {
            group: req.query.group,
            status: req.query.status,
            health: req.query.health
        };
        
        // Get clients from new client manager
        const clients = clientManager.getClients(filter);
        const stats = clientManager.getClientStats();
        
        // Also get clients from old mining manager for backward compatibility
        const oldClients = miningManager.getRemoteClients();
        
        res.json({
            success: true,
            clients: clients,
            stats: stats,
            // Backward compatibility
            totalClients: clients.length,
            activeClients: clients.filter(c => c.status === 'online').length
        });
    } catch (error) {
        logger.error('Error getting remote clients:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get clients',
            error: error.message
        });
    }
});

app.get('/api/remote-clients/:clientId', (req, res) => {
    try {
        const client = clientManager.getClient(req.params.clientId);
        if (!client) {
            return res.status(404).json({
                success: false,
                message: 'Client not found'
            });
        }
        
        res.json({
            success: true,
            client: client
        });
    } catch (error) {
        logger.error('Error getting client:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get client',
            error: error.message
        });
    }
});

app.put('/api/remote-clients/:clientId', (req, res) => {
    try {
        const client = clientManager.updateClient(req.params.clientId, req.body);
        if (!client) {
            return res.status(404).json({
                success: false,
                message: 'Client not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Client updated successfully',
            client: client
        });
    } catch (error) {
        logger.error('Error updating client:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update client',
            error: error.message
        });
    }
});

app.delete('/api/remote-clients/:clientId', (req, res) => {
    try {
        const success = clientManager.removeClient(req.params.clientId);
        if (!success) {
            return res.status(404).json({
                success: false,
                message: 'Client not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Client removed successfully'
        });
    } catch (error) {
        logger.error('Error removing client:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove client',
            error: error.message
        });
    }
});

// Client Configuration Management
app.get('/api/remote-clients/:clientId/config', (req, res) => {
    try {
        const client = clientManager.getClient(req.params.clientId);
        if (!client) {
            return res.status(404).json({
                success: false,
                message: 'Client not found'
            });
        }
        
        res.json({
            success: true,
            config: client.config
        });
    } catch (error) {
        logger.error('Error getting client config:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get client config',
            error: error.message
        });
    }
});

app.put('/api/remote-clients/:clientId/config', (req, res) => {
    try {
        const success = clientManager.updateClientConfig(req.params.clientId, req.body);
        if (!success) {
            return res.status(404).json({
                success: false,
                message: 'Client not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Client configuration updated successfully'
        });
    } catch (error) {
        logger.error('Error updating client config:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update client config',
            error: error.message
        });
    }
});

// Client Actions
app.post('/api/remote-clients/:clientId/restart', (req, res) => {
    try {
        const success = clientManager.restartClient(req.params.clientId);
        if (!success) {
            return res.status(404).json({
                success: false,
                message: 'Client not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Client restart initiated'
        });
    } catch (error) {
        logger.error('Error restarting client:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to restart client',
            error: error.message
        });
    }
});

app.post('/api/remote-clients/:clientId/update', (req, res) => {
    try {
        const success = clientManager.updateClient(req.params.clientId);
        if (!success) {
            return res.status(404).json({
                success: false,
                message: 'Client not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Client update initiated'
        });
    } catch (error) {
        logger.error('Error updating client:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update client',
            error: error.message
        });
    }
});

// Client Groups Management
app.get('/api/client-groups', (req, res) => {
    try {
        const groups = Array.from(clientManager.clientGroups.values());
        res.json({
            success: true,
            groups: groups
        });
    } catch (error) {
        logger.error('Error getting client groups:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get client groups',
            error: error.message
        });
    }
});

app.post('/api/client-groups', (req, res) => {
    try {
        const { name, description } = req.body;
        const group = clientManager.createGroup(name, description);
        
        res.json({
            success: true,
            message: 'Client group created successfully',
            group: group
        });
    } catch (error) {
        logger.error('Error creating client group:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create client group',
            error: error.message
        });
    }
});

app.post('/api/remote-clients/:clientId/group', (req, res) => {
    try {
        const { groupName } = req.body;
        const success = clientManager.addClientToGroup(req.params.clientId, groupName);
        
        if (!success) {
            return res.status(404).json({
                success: false,
                message: 'Client or group not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Client added to group successfully'
        });
    } catch (error) {
        logger.error('Error adding client to group:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add client to group',
            error: error.message
        });
    }
});

app.get('/api/installer-info', (req, res) => {
    const info = miningManager.getClientInstallerInfo();
    const networkConfig = networkManager.getClientNetworkConfig();
    
    res.json({
        success: true,
        installer: {
            ...info,
            network: networkConfig
        }
    });
});

// Network Management Endpoints
app.get('/api/network/status', (req, res) => {
    try {
        const status = networkManager.getNetworkStatus();
        res.json({
            success: true,
            status: status
        });
    } catch (error) {
        logger.error('Error getting network status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get network status',
            error: error.message
        });
    }
});

app.get('/api/network/diagnostics', (req, res) => {
    try {
        const script = networkManager.generateNetworkDiagnosticScript();
        res.json({
            success: true,
            script: script
        });
    } catch (error) {
        logger.error('Error generating network diagnostics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate network diagnostics',
            error: error.message
        });
    }
});

app.post('/api/network/configure-firewall', (req, res) => {
    try {
        networkManager.configureFirewall();
        res.json({
            success: true,
            message: 'Firewall configuration initiated'
        });
    } catch (error) {
        logger.error('Error configuring firewall:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to configure firewall',
            error: error.message
        });
    }
});

app.post('/api/network/troubleshoot/:clientIP', (req, res) => {
    try {
        const diagnostics = networkManager.troubleshootClientConnection(req.params.clientIP);
        res.json({
            success: true,
            diagnostics: diagnostics
        });
    } catch (error) {
        logger.error('Error troubleshooting client connection:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to troubleshoot client connection',
            error: error.message
        });
    }
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
        
        // Auto-start mining after server is ready
        setTimeout(() => {
            console.log(`\n⛏️  Auto-starting mining...`);
            try {
                miningManager.startMining();
                console.log(`✅ Mining started automatically`);
            } catch (err) {
                console.log(`⚠️  Auto-start mining failed: ${err.message}`);
            }
        }, 2000); // Wait 2 seconds for server to be fully ready
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

    // Terminal command execution endpoint
    app.post('/api/terminal/execute', async (req, res) => {
        try {
            const { command } = req.body;
            
            if (!command || typeof command !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'Command is required and must be a string'
                });
            }

            // Security: Block dangerous commands
            const dangerousCommands = ['rm -rf', 'sudo rm', 'mkfs', 'fdisk', 'dd if=', 'shutdown', 'reboot', 'halt', 'poweroff', 'init 0', 'init 6'];
            const isDangerous = dangerousCommands.some(dangerous => command.toLowerCase().includes(dangerous.toLowerCase()));
            
            if (isDangerous) {
                return res.status(403).json({
                    success: false,
                    message: 'Command blocked for security reasons',
                    output: 'This command is not allowed for security purposes.'
                });
            }

            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);

            // Execute command with timeout
            const { stdout, stderr } = await execAsync(command, { 
                timeout: 10000, // 10 second timeout
                maxBuffer: 1024 * 1024 // 1MB buffer
            });

            res.json({
                success: true,
                output: stdout || stderr || 'Command executed successfully',
                command: command
            });

        } catch (error) {
            logger.error('Terminal command execution failed:', error);
            res.status(500).json({
                success: false,
                message: 'Command execution failed',
                output: error.message || 'Unknown error occurred',
                command: req.body.command
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

// Profitability monitoring endpoints
app.get('/api/profitability', async (req, res) => {
    try {
        const { cpuHashrate = 100, gpuHashrate = 1000 } = req.query;
        const results = await miningManager.profitabilityManager.findMostProfitableAlgorithm(
            parseFloat(cpuHashrate), 
            parseFloat(gpuHashrate)
        );
        
        res.json({
            success: true,
            algorithms: results,
            currentAlgorithm: miningManager.currentAlgorithm,
            lastUpdate: miningManager.profitabilityManager.lastUpdate
        });
    } catch (error) {
        logger.error('Error getting profitability data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get profitability data',
            error: error.message
        });
    }
});

app.post('/api/switch-algorithm', async (req, res) => {
    try {
        const { algorithm } = req.body;
        if (!algorithm) {
            return res.status(400).json({
                success: false,
                message: 'Algorithm is required'
            });
        }
        
        await miningManager.switchAlgorithm(algorithm);
        res.json({
            success: true,
            message: `Switched to ${algorithm} algorithm`,
            currentAlgorithm: miningManager.currentAlgorithm
        });
    } catch (error) {
        logger.error('Error switching algorithm:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to switch algorithm',
            error: error.message
        });
    }
});

// Auto-scaling endpoints
app.get('/api/auto-scaling/config', (req, res) => {
    try {
        const config = miningManager.autoScalingManager.getConfig();
        res.json({
            success: true,
            config: config
        });
    } catch (error) {
        logger.error('Error getting auto-scaling config:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get auto-scaling config',
            error: error.message
        });
    }
});

app.post('/api/auto-scaling/config', (req, res) => {
    try {
        const { electricityCost } = req.body;
        if (electricityCost !== undefined) {
            miningManager.autoScalingManager.updateElectricityCost(electricityCost);
        }
        
        res.json({
            success: true,
            message: 'Auto-scaling config updated',
            config: miningManager.autoScalingManager.getConfig()
        });
    } catch (error) {
        logger.error('Error updating auto-scaling config:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update auto-scaling config',
            error: error.message
        });
    }
});

app.get('/api/auto-scaling/stats', (req, res) => {
    try {
        const stats = miningManager.autoScalingManager.getScalingStats();
        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        logger.error('Error getting auto-scaling stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get auto-scaling stats',
            error: error.message
        });
    }
});

app.post('/api/auto-scaling/trigger', async (req, res) => {
    try {
        const scalingDecision = await miningManager.checkAutoScaling();
        res.json({
            success: true,
            message: scalingDecision ? 'Auto-scaling applied' : 'No scaling needed',
            scalingDecision: scalingDecision
        });
    } catch (error) {
        logger.error('Error triggering auto-scaling:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to trigger auto-scaling',
            error: error.message
        });
    }
});

// Alert system endpoints
app.get('/api/alerts', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const alerts = alertManager.getAlerts(limit);
        const stats = alertManager.getAlertStats();
        
        res.json({
            success: true,
            alerts,
            stats
        });
    } catch (error) {
        logger.error('Error getting alerts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get alerts',
            error: error.message
        });
    }
});

app.post('/api/alerts/test', (req, res) => {
    try {
        const { type = 'test', severity = 'info', message = 'Test alert' } = req.body;
        
        alertManager.sendAlert(type, severity, message, { test: true })
            .then(alert => {
                res.json({
                    success: true,
                    message: 'Test alert sent successfully',
                    alert
                });
            })
            .catch(error => {
                logger.error('Error sending test alert:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to send test alert',
                    error: error.message
                });
            });
    } catch (error) {
        logger.error('Error sending test alert:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send test alert',
            error: error.message
        });
    }
});

app.delete('/api/alerts', (req, res) => {
    try {
        alertManager.clearAlerts();
        res.json({
            success: true,
            message: 'All alerts cleared successfully'
        });
    } catch (error) {
        logger.error('Error clearing alerts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to clear alerts',
            error: error.message
        });
    }
});

// Advanced monitoring endpoints
app.get('/api/monitoring/metrics', (req, res) => {
    try {
        const metrics = miningManager.getAdvancedMetrics();
        res.json({
            success: true,
            metrics: metrics
        });
    } catch (error) {
        logger.error('Error getting monitoring metrics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get monitoring metrics',
            error: error.message
        });
    }
});

app.get('/api/monitoring/alerts', (req, res) => {
    try {
        const alerts = miningManager.getSystemAlerts();
        res.json({
            success: true,
            alerts: alerts
        });
    } catch (error) {
        logger.error('Error getting system alerts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get system alerts',
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
