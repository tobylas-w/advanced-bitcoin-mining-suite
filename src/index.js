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
const bitcoinConfig = require('./config/bitcoin');
const ProfitabilityCalculator = require('./utils/ProfitabilityCalculator');
const SystemMonitor = require('./utils/SystemMonitor');
const CentralMiningManager = require('./server/central-manager');
const SecurityManager = require('./security/SecurityManager');
const NetworkSecurity = require('./security/NetworkSecurity');
const WalletSecurity = require('./security/WalletSecurity');
const WalletConfig = require('./config/wallet');

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
        
        this.miner = new BitcoinMiner(bitcoinConfig);
        this.profitabilityCalc = new ProfitabilityCalculator();
        this.systemMonitor = new SystemMonitor();
        this.centralManager = new CentralMiningManager(this.server);
        
        // Initialize security systems
        this.securityManager = new SecurityManager();
        this.networkSecurity = new NetworkSecurity();
        this.walletSecurity = new WalletSecurity();
        this.walletConfig = new WalletConfig();
        
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


