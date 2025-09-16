const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const os = require('os');
const cluster = require('cluster');
require('dotenv').config();

const BitcoinMiner = require('./core/BitcoinMiner');
const RealBitcoinMiner = require('./mining/RealBitcoinMiner');
const RealEarningsCalculator = require('./utils/RealEarningsCalculator');
const bitcoinConfig = require('./config/bitcoin');
const ProfitabilityCalculator = require('./utils/ProfitabilityCalculator');
const SystemMonitor = require('./utils/SystemMonitor');
const CentralMiningManager = require('./server/central-manager');
const SecurityManager = require('./security/SecurityManager');
const NetworkSecurity = require('./security/NetworkSecurity');
const WalletSecurity = require('./security/WalletSecurity');
const WalletConfig = require('./config/wallet');
const MaximumProfitOptimizer = require('./profit/MaximumProfitOptimizer');
const ProfitTracker = require('./profit/ProfitTracker');
const DatabaseManager = require('./database/DatabaseManager');

class MiningServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            },
            transports: ['websocket', 'polling'],
            pingTimeout: 60000,
            pingInterval: 25000
        });
        
        // DISABLED: Simulation miner - only use real mining
        // this.miner = new BitcoinMiner(bitcoinConfig);
        this.realMiner = new RealBitcoinMiner({
            wallet: { address: 'bc1qgef2v0taxcae8wfmf868ydg92qp36guv68ddh4' },
            worker: { name: 'fedora-miner' }
        });
        this.profitabilityCalc = new ProfitabilityCalculator();
        this.systemMonitor = new SystemMonitor();
        this.centralManager = new CentralMiningManager(this.server);
        
        // Initialize security systems
        this.securityManager = new SecurityManager();
        this.networkSecurity = new NetworkSecurity();
        this.walletSecurity = new WalletSecurity();
        this.walletConfig = new WalletConfig();
        
        // DISABLED: Fake profit optimization - only show real earnings
        // this.profitOptimizer = new MaximumProfitOptimizer();
        // this.profitTracker = new ProfitTracker();
        this.realEarningsCalculator = new RealEarningsCalculator();
        this.databaseManager = new DatabaseManager();
        
        // Performance monitoring
        this.performanceStats = {
            requests: 0,
            activeConnections: 0,
            memoryUsage: 0,
            uptime: Date.now()
        };
        
        this.setupSecurity();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketHandlers();
        this.setupMiningEvents();
        this.setupPerformanceMonitoring();
        
        this.port = process.env.PORT || 3000;
        this.host = process.env.HOST || '0.0.0.0'; // Listen on all interfaces for Fedora
    }

    setupSecurity() {
        // Start security monitoring
        this.securityManager.startMonitoring();
        this.networkSecurity.startMonitoring();
        this.walletSecurity.startMonitoring();

        // Set up security event handlers
        this.securityManager.on('securityEvent', (event) => {
            console.log(`🔒 Security Event: ${event.type}`, event.data);
        });

        this.networkSecurity.on('securityEvent', (event) => {
            console.log(`🌐 Network Security: ${event.type}`, event.data);
        });

        this.walletSecurity.on('securityEvent', (event) => {
            console.log(`🔐 Wallet Security: ${event.type}`, event.data);
        });

        // DISABLED: Fake profit optimization event handlers
        // this.profitOptimizer.on('optimizationComplete', (data) => {
        //     console.log('💰 Profit optimization complete:', data);
        //     this.io.emit('profitUpdate', data);
        // });

        // this.profitOptimizer.on('realTimeProfitUpdate', (data) => {
        //     this.io.emit('realTimeProfitUpdate', data);
        // });

        // this.profitOptimizer.on('aggressiveModeEnabled', () => {
        //     console.log('🚀 AGGRESSIVE PROFIT MODE ENABLED!');
        //     this.io.emit('aggressiveModeEnabled');
        // });

        // // Profit tracker event handlers
        // this.profitTracker.on('profitUpdate', (data) => {
        //     this.io.emit('profitTrackerUpdate', data);
        // });

        // this.profitTracker.on('profitAdded', (data) => {
        //     console.log('💰 Profit added:', data);
        //     this.io.emit('profitAdded', data);
        // });

        // Add request IP extraction middleware
        this.app.use((req, res, next) => {
            // Extract IP from various sources without overriding the getter
            const clientIP = req.ip || 
                           req.connection.remoteAddress || 
                           req.socket.remoteAddress ||
                           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                           req.headers['x-forwarded-for'] ||
                           req.headers['x-real-ip'] ||
                           '127.0.0.1';
            
            // Store in a custom property instead of overriding req.ip
            req.clientIP = clientIP;
            next();
        });

        console.log('🔒 Security systems initialized');
    }

    setupMiddleware() {
        // Enhanced security for Fedora Linux
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "wss:", "ws:"]
                }
            },
            crossOriginEmbedderPolicy: false
        }));
        
        // CORS configuration for cross-platform access
        this.app.use(cors({
            origin: function(origin, callback) {
                // Allow requests from localhost, LAN, and common development ports
                const allowedOrigins = [
                    'http://localhost:3000',
                    'http://127.0.0.1:3000',
                    'http://0.0.0.0:3000',
                    /^http:\/\/192\.168\.\d+\.\d+:3000$/,
                    /^http:\/\/10\.\d+\.\d+\.\d+:3000$/,
                    /^http:\/\/172\.\d+\.\d+\.\d+:3000$/
                ];
                
                if (!origin || allowedOrigins.some(allowed => 
                    typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
                )) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'));
                }
            },
            credentials: true
        }));
        
        // Performance optimizations
        this.app.use(compression({
            level: 6,
            threshold: 1024,
            filter: (req, res) => {
                if (req.headers['x-no-compression']) {
                    return false;
                }
                return compression.filter(req, res);
            }
        }));
        
        // Logging for Fedora Linux
        this.app.use(morgan('combined', {
            skip: (req, res) => req.url.startsWith('/socket.io/')
        }));
        
        // Enhanced JSON parsing with size limits
        this.app.use(express.json({ 
            limit: '10mb',
            verify: (req, res, buf) => {
                try {
                    JSON.parse(buf);
                } catch (e) {
                    throw new Error('Invalid JSON');
                }
            }
        }));
        
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
                // Static file serving with caching
                this.app.use(express.static(path.join(__dirname, 'dashboard'), {
                    maxAge: '1d',
                    etag: true,
                    lastModified: true
                }));
        
        // Serve installer files
        this.app.use('/installer', express.static(path.join(__dirname, '../public/installer'), {
            maxAge: '1h'
        }));
        
        // API routes
        this.app.use('/api', this.createApiRoutes());
        
        // Request counting for performance monitoring
        this.app.use((req, res, next) => {
            this.performanceStats.requests++;
            next();
        });
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
        
        // Start mining endpoint
        router.post('/startMining', async (req, res) => {
            try {
                await this.miner.startMining(req.body.userConsent);
                res.json({ success: true, message: 'Mining started' });
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        });
        
        // Stop mining endpoint
        router.post('/stopMining', async (req, res) => {
            try {
                await this.miner.stopMining();
                res.json({ success: true, message: 'Mining stopped' });
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
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
        
        // Client registration endpoint
        router.post('/register-client', (req, res) => {
            try {
                console.log('📋 Client registration request:', req.body);
                res.json({ success: true, message: 'Client registered' });
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        });
        
        // Client unregistration endpoint
        router.post('/unregister-client', (req, res) => {
            try {
                console.log('🗑️ Client unregistration request:', req.body);
                res.json({ success: true, message: 'Client unregistered' });
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        });
        
        // Install client endpoint
        router.post('/install-client', (req, res) => {
            try {
                console.log('📦 Client installation request:', req.body);
                res.json({ success: true, message: 'Client installation initiated' });
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        });
        
        // Office network status
        router.get('/office-network', (req, res) => {
            try {
                const networkStats = this.centralManager.getMiningStats();
                res.json(networkStats);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Wallet configuration endpoints
        router.post('/wallet/configure', async (req, res) => {
            try {
                // Check rate limit
                const rateLimitOk = await this.securityManager.checkRateLimit('wallet', 'wallet', req);
                if (!rateLimitOk) {
                    return res.status(429).json({ error: 'Too many wallet operations' });
                }

                // Validate wallet address
                const { wallet, worker, pool } = req.body;
                const validation = this.walletSecurity.validateWalletAddress(wallet.address);
                
                if (!validation.isValid) {
                    return res.status(400).json({ 
                        error: 'Invalid wallet address',
                        details: validation.warnings 
                    });
                }

                // Set wallet configuration
                const success = this.walletConfig.setWalletAddress(wallet.address, worker.name);
                if (success) {
                    // Encrypt and store wallet securely
                    this.walletSecurity.encryptWalletAddress(wallet.address);
                    
                    res.json({ 
                        success: true, 
                        message: 'Wallet configured successfully',
                        validation: validation,
                        wallet: this.walletConfig.getWalletStatus()
                    });
                } else {
                    res.status(400).json({ error: 'Failed to configure wallet' });
                }
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Get wallet status
        router.get('/wallet/status', (req, res) => {
            try {
                const status = this.walletConfig.getWalletStatus();
                const securityStatus = this.walletSecurity.getSecurityStatus();
                
                res.json({
                    wallet: status,
                    security: securityStatus
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Security status endpoint
        router.get('/security/status', (req, res) => {
            try {
                const securityStatus = this.securityManager.getSecurityStatus();
                const networkStatus = this.networkSecurity.getSecurityStatus();
                const walletStatus = this.walletSecurity.getSecurityStatus();
                
                res.json({
                    authentication: securityStatus,
                    network: networkStatus,
                    wallet: walletStatus
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // DISABLED: Fake profit optimization endpoints
        // router.get('/profit/status', (req, res) => {
        //     try {
        //         const profitStatus = this.profitOptimizer.getCurrentProfitStatus();
        //         res.json(profitStatus);
        //     } catch (error) {
        //         res.status(500).json({ error: error.message });
        //     }
        // });

        // router.post('/profit/enable-aggressive', (req, res) => {
        //     try {
        //         this.profitOptimizer.enableAggressiveMode();
        //         res.json({ 
        //             success: true, 
        //             message: 'Aggressive profit mode enabled!',
        //             status: this.profitOptimizer.getCurrentProfitStatus()
        //         });
        //     } catch (error) {
        //         res.status(500).json({ error: error.message });
        //     }
        // });

        // router.post('/profit/optimize', (req, res) => {
        //     try {
        //         this.profitOptimizer.optimizeForMaximumProfit();
        //         res.json({ 
        //             success: true, 
        //             message: 'Profit optimization completed!',
        //             status: this.profitOptimizer.getCurrentProfitStatus()
        //         });
        //     } catch (error) {
        //         res.status(500).json({ error: error.message });
        //     }
        // });

        // router.get('/profit/report', (req, res) => {
        //     try {
        //         const report = this.profitOptimizer.getProfitReport();
        //         res.json(report);
        //     } catch (error) {
        //         res.status(500).json({ error: error.message });
        //     }
        // });

        // // Profit tracking endpoints
        // router.get('/profit/tracker/status', (req, res) => {
        //     try {
        //         const status = this.profitTracker.getCurrentStatus();
        //         res.json(status);
        //     } catch (error) {
        //         res.status(500).json({ error: error.message });
        //     }
        // });

        // router.get('/profit/tracker/report', (req, res) => {
        //     try {
        //         const report = this.profitTracker.getProfitReport();
        //         res.json(report);
        //     } catch (error) {
        //         res.status(500).json({ error: error.message });
        //     }
        // });

        // router.post('/profit/tracker/add', (req, res) => {
        //     try {
        //         const { amount, description } = req.body;
        //         if (!amount || isNaN(amount)) {
        //             return res.status(400).json({ error: 'Invalid amount' });
        //         }
                
        //         this.profitTracker.addProfitEntry(parseFloat(amount), description);
        //         res.json({ 
        //             success: true, 
        //             message: 'Profit entry added successfully',
        //             status: this.profitTracker.getCurrentStatus()
        //         });
        //     } catch (error) {
        //         res.status(500).json({ error: error.message });
        //     }
        // });

        // Real earnings calculation endpoint
        router.get('/real-earnings', (req, res) => {
            try {
                const miningStatus = this.realMiner.getStatus();
                const hashrate = miningStatus.stats.hashrate || 0;
                const realEarnings = this.realEarningsCalculator.calculateRealEarnings(hashrate);
                
                res.json({
                    success: true,
                    mining: {
                        isRunning: miningStatus.isRunning,
                        hashrate: hashrate,
                        pool: miningStatus.pool
                    },
                    earnings: realEarnings,
                    lastUpdated: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Real Bitcoin mining endpoints
        router.post('/start-real-mining', async (req, res) => {
            try {
                if (!req.body.userConsent) {
                    return res.status(400).json({ error: 'User consent required for real mining' });
                }
                
                await this.realMiner.startMining(req.body);
                res.json({ 
                    success: true, 
                    message: 'Real Bitcoin mining started successfully!',
                    status: this.realMiner.getStatus(),
                    pool: this.realMiner.currentPool
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        router.post('/stop-real-mining', async (req, res) => {
            try {
                await this.realMiner.stopMining();
                res.json({ 
                    success: true, 
                    message: 'Real Bitcoin mining stopped successfully',
                    status: this.realMiner.getStatus()
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        router.get('/real-mining-status', (req, res) => {
            try {
                const status = this.realMiner.getStatus();
                res.json(status);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        router.get('/mining-pools', (req, res) => {
            try {
                const pools = this.realMiner.getPools();
                res.json(pools);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        router.post('/switch-pool', async (req, res) => {
            try {
                const { poolName } = req.body;
                await this.realMiner.switchPool(poolName);
                res.json({ 
                    success: true, 
                    message: `Switched to pool: ${poolName}`,
                    currentPool: this.realMiner.currentPool
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Start mining on all clients
        router.post('/start-all-mining', (req, res) => {
            try {
                this.centralManager.startMiningOnAllClients(req.body);
                res.json({ success: true, message: 'Started mining on all clients' });
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        });
        
        // Stop mining on all clients
        router.post('/stop-all-mining', (req, res) => {
            try {
                this.centralManager.stopMiningOnAllClients();
                res.json({ success: true, message: 'Stopped mining on all clients' });
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
                mining: this.miner.isRunning,
                connectedClients: this.centralManager.getAllClients().length
            });
        });
        
        // Office network dashboard
        this.app.get('/office', (req, res) => {
            res.sendFile(path.join(__dirname, '../dashboard/index.html'));
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

            // Profit optimization events
            socket.on('enableAggressiveMode', () => {
                console.log('🚀 Client requested aggressive profit mode');
                this.profitOptimizer.enableAggressiveMode();
            });

            socket.on('optimizeNow', () => {
                console.log('⚡ Client requested immediate optimization');
                this.profitOptimizer.optimizeForMaximumProfit();
            });

            socket.on('getProfitStatus', () => {
                const status = this.profitOptimizer.getCurrentProfitStatus();
                socket.emit('profitStatusUpdate', status);
            });

            // Real mining socket events
            socket.on('startRealMining', async (data) => {
                try {
                    if (!data.userConsent) {
                        socket.emit('error', { message: 'User consent required for real mining' });
                        return;
                    }
                    
                    await this.realMiner.startMining(data);
                    socket.emit('realMiningStarted', this.realMiner.getStatus());
                } catch (error) {
                    socket.emit('error', error);
                }
            });

            socket.on('stopRealMining', async () => {
                try {
                    await this.realMiner.stopMining();
                    socket.emit('realMiningStopped', this.realMiner.getStatus());
                } catch (error) {
                    socket.emit('error', error);
                }
            });

            socket.on('getRealMiningStatus', () => {
                const status = this.realMiner.getStatus();
                socket.emit('realMiningStatusUpdate', status);
            });

            socket.on('switchMiningPool', async (data) => {
                try {
                    await this.realMiner.switchPool(data.poolName);
                    socket.emit('poolSwitched', { 
                        pool: this.realMiner.currentPool,
                        status: this.realMiner.getStatus()
                    });
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
        // DISABLED: Simulation mining events - only use real mining
        // this.miner.on('miningStarted', (stats) => {
        //     this.io.emit('miningStarted', stats);
        // });
        
        // this.miner.on('miningStopped', (stats) => {
        //     this.io.emit('miningStopped', stats);
        // });
        
        // this.miner.on('statsUpdated', (stats) => {
        //     this.io.emit('miningStats', stats);
        // });
        
        // this.miner.on('shareAccepted', (data) => {
        //     this.io.emit('shareAccepted', data);
        // });
        
        // this.miner.on('shareRejected', (data) => {
        //     this.io.emit('shareRejected', data);
        // });
        
        // this.miner.on('error', (error) => {
        //     this.io.emit('error', error);
        // });

        // Real Bitcoin miner event handlers
        this.realMiner.on('miningStarted', (stats) => {
            console.log('🚀 Real Bitcoin mining started!');
            this.io.emit('realMiningStarted', stats);
        });

        this.realMiner.on('miningStopped', (stats) => {
            console.log('⏹️ Real Bitcoin mining stopped');
            this.io.emit('realMiningStopped', stats);
        });

        this.realMiner.on('statsUpdated', (stats) => {
            this.io.emit('realMiningStats', stats);
        });

        this.realMiner.on('shareFound', (data) => {
            console.log(`✅ Real share found: ${data.accepted}/${data.total}`);
            this.io.emit('realShareFound', data);
        });

        this.realMiner.on('hashrateUpdate', (hashrate) => {
            console.log(`📊 Real hashrate: ${hashrate} H/s`);
            this.io.emit('realHashrateUpdate', hashrate);
        });

        this.realMiner.on('poolConnected', (data) => {
            console.log(`🔗 Connected to real pool: ${data.pool.name}`);
            this.io.emit('realPoolConnected', data);
        });

        this.realMiner.on('error', (error) => {
            console.error('❌ Real mining error:', error);
            this.io.emit('realMiningError', error);
        });
        
        // Forward central manager events
        this.centralManager.on('clientRegistered', (client) => {
            this.io.emit('clientRegistered', client);
        });
        
        this.centralManager.on('clientDisconnected', (client) => {
            this.io.emit('clientDisconnected', client);
        });
        
        this.centralManager.on('statsUpdated', (stats) => {
            this.io.emit('officeNetworkStats', stats);
        });
    }

    setupPerformanceMonitoring() {
        // Monitor server performance
        setInterval(() => {
            const memUsage = process.memoryUsage();
            this.performanceStats.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB
            this.performanceStats.uptime = Date.now() - this.performanceStats.uptime;
            
            // Log performance stats every 5 minutes
            if (this.performanceStats.requests % 1000 === 0) {
                console.log(`📊 Server Performance: ${Math.round(this.performanceStats.memoryUsage)}MB RAM, ${this.performanceStats.requests} requests, ${this.performanceStats.activeConnections} connections`);
            }
        }, 300000); // Every 5 minutes
    }

    start() {
        // Enhanced server startup for Fedora Linux
        this.server.listen(this.port, this.host, () => {
            const networkInterfaces = os.networkInterfaces();
            const localIPs = [];
            
            Object.keys(networkInterfaces).forEach(interfaceName => {
                networkInterfaces[interfaceName].forEach(netInterface => {
                    if (netInterface.family === 'IPv4' && !netInterface.internal) {
                        localIPs.push(netInterface.address);
                    }
                });
            });
            
            console.log('\n🚀 Advanced Bitcoin Mining Server Started');
            console.log('═'.repeat(60));
            console.log(`🌐 Server running on port ${this.port}`);
            console.log(`📊 Dashboard: http://localhost:${this.port}`);
            console.log(`🏢 Office installer: http://localhost:${this.port}/installer`);
            
            if (localIPs.length > 0) {
                console.log('\n🌍 Network Access:');
                localIPs.forEach(ip => {
                    console.log(`   http://${ip}:${this.port}`);
                });
            }
            
            console.log('\n💻 Platform Information:');
            console.log(`   OS: ${os.type()} ${os.release()}`);
            console.log(`   Architecture: ${os.arch()}`);
            console.log(`   CPU Cores: ${os.cpus().length}`);
            console.log(`   Total Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`);
            
            console.log('\n💰 Ready to mine Bitcoin for extra income!');
            console.log('🌐 Office network ready for client connections');
            console.log('═'.repeat(60));
        });
        
        // Enhanced error handling
        this.server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`❌ Port ${this.port} is already in use. Try a different port.`);
                console.log(`💡 You can set a different port with: PORT=3001 npm start`);
            } else {
                console.error('❌ Server error:', error);
            }
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

// Enhanced server startup with cluster support for Fedora Linux
if (cluster.isMaster) {
    const numCPUs = os.cpus().length;
    const numWorkers = Math.min(numCPUs, 4); // Limit to 4 workers for stability
    
    console.log(`🚀 Starting Bitcoin Mining Server with ${numWorkers} workers on ${numCPUs} CPU cores`);
    
    // Fork workers
    for (let i = 0; i < numWorkers; i++) {
        cluster.fork();
    }
    
    cluster.on('exit', (worker, code, signal) => {
        console.log(`⚠️  Worker ${worker.process.pid} died. Restarting...`);
        cluster.fork();
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('\n🛑 Master received SIGTERM. Shutting down workers...');
        for (const id in cluster.workers) {
            cluster.workers[id].kill();
        }
    });
    
} else {
    // Worker process
    const miningServer = new MiningServer();
    global.miningServer = miningServer;
    miningServer.start();
}

module.exports = MiningServer;


