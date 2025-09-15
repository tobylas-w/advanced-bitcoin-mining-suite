const WebSocket = require('ws');
const EventEmitter = require('events');
const os = require('os');

class CentralMiningManager extends EventEmitter {
    constructor(server) {
        super();
        this.server = server;
        this.connectedClients = new Map();
        this.miningStats = {
            totalHashrate: 0,
            totalShares: { accepted: 0, rejected: 0, total: 0 },
            activeClients: 0,
            totalEarnings: 0
        };
        this.wss = null;
        this.setupWebSocketServer();
    }

    /**
     * Setup WebSocket server for client communication
     */
    setupWebSocketServer() {
        this.wss = new WebSocket.Server({ 
            server: this.server,
            path: '/ws'
        });

        this.wss.on('connection', (ws, req) => {
            console.log('🔗 New client connected');
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    this.handleClientMessage(ws, message);
                } catch (error) {
                    console.error('❌ Invalid message from client:', error.message);
                }
            });

            ws.on('close', () => {
                this.handleClientDisconnect(ws);
            });

            ws.on('error', (error) => {
                console.error('❌ Client WebSocket error:', error.message);
            });
        });

        console.log('🌐 WebSocket server started for client connections');
    }

    /**
     * Handle messages from mining clients
     */
    handleClientMessage(ws, message) {
        const clientId = this.getClientId(ws);
        
        switch (message.type) {
            case 'register':
                this.registerClient(ws, message.data);
                break;
            case 'statusUpdate':
                this.updateClientStatus(clientId, message.data);
                break;
            case 'shareFound':
                this.processShare(clientId, message.data);
                break;
            case 'miningStarted':
                this.handleMiningStarted(clientId, message.data);
                break;
            case 'miningStopped':
                this.handleMiningStopped(clientId, message.data);
                break;
            case 'heartbeat':
                this.handleHeartbeat(clientId);
                break;
            default:
                console.log('❓ Unknown message type:', message.type);
        }
    }

    /**
     * Register a new mining client
     */
    registerClient(ws, clientData) {
        const clientId = this.generateClientId();
        
        const client = {
            id: clientId,
            ws: ws,
            hostname: clientData.hostname,
            platform: clientData.platform,
            cpu: clientData.cpu,
            memory: clientData.memory,
            gpu: clientData.gpu,
            isMining: false,
            stats: {
                hashrate: 0,
                shares: { accepted: 0, rejected: 0, total: 0 },
                uptime: 0,
                temperature: { cpu: 0, gpu: [] },
                lastShareTime: null
            },
            connectedAt: new Date(),
            lastHeartbeat: new Date()
        };

        this.connectedClients.set(clientId, client);
        
        // Send registration confirmation
        this.sendToClient(clientId, {
            type: 'registrationConfirmed',
            data: { clientId: clientId, serverTime: new Date().toISOString() }
        });

        console.log(`📋 Client registered: ${clientData.hostname} (${clientId})`);
        this.emit('clientRegistered', client);
        this.updateGlobalStats();
    }

    /**
     * Update client status
     */
    updateClientStatus(clientId, statusData) {
        const client = this.connectedClients.get(clientId);
        if (!client) return;

        client.stats = statusData.stats;
        client.isMining = statusData.isMining;
        client.lastHeartbeat = new Date();

        this.emit('clientStatusUpdated', client);
        this.updateGlobalStats();
    }

    /**
     * Process share from client
     */
    processShare(clientId, shareData) {
        const client = this.connectedClients.get(clientId);
        if (!client) return;

        if (shareData.accepted) {
            client.stats.shares.accepted++;
            this.miningStats.totalShares.accepted++;
        } else {
            client.stats.shares.rejected++;
            this.miningStats.totalShares.rejected++;
        }

        client.stats.shares.total++;
        this.miningStats.totalShares.total++;

        console.log(`💰 Share from ${client.hostname}: ${shareData.accepted ? 'Accepted' : 'Rejected'}`);
        this.emit('shareProcessed', { client, shareData });
        this.updateGlobalStats();
    }

    /**
     * Handle mining started on client
     */
    handleMiningStarted(clientId, data) {
        const client = this.connectedClients.get(clientId);
        if (!client) return;

        client.isMining = true;
        console.log(`⚡ Mining started on ${client.hostname}`);
        this.emit('miningStarted', client);
        this.updateGlobalStats();
    }

    /**
     * Handle mining stopped on client
     */
    handleMiningStopped(clientId, data) {
        const client = this.connectedClients.get(clientId);
        if (!client) return;

        client.isMining = false;
        console.log(`⏹️ Mining stopped on ${client.hostname}`);
        this.emit('miningStopped', client);
        this.updateGlobalStats();
    }

    /**
     * Handle client heartbeat
     */
    handleHeartbeat(clientId) {
        const client = this.connectedClients.get(clientId);
        if (client) {
            client.lastHeartbeat = new Date();
        }
    }

    /**
     * Handle client disconnect
     */
    handleClientDisconnect(ws) {
        const clientId = this.getClientId(ws);
        const client = this.connectedClients.get(clientId);
        
        if (client) {
            console.log(`🔌 Client disconnected: ${client.hostname}`);
            this.connectedClients.delete(clientId);
            this.emit('clientDisconnected', client);
            this.updateGlobalStats();
        }
    }

    /**
     * Send command to all clients
     */
    broadcastToClients(command) {
        const message = JSON.stringify(command);
        
        this.connectedClients.forEach((client) => {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(message);
            }
        });
        
        console.log(`📢 Broadcasted command to ${this.connectedClients.size} clients:`, command.type);
    }

    /**
     * Send command to specific client
     */
    sendToClient(clientId, command) {
        const client = this.connectedClients.get(clientId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(command));
        }
    }

    /**
     * Start mining on all clients
     */
    startMiningOnAllClients(settings = {}) {
        const command = {
            type: 'startMining',
            data: {
                intensity: settings.intensity || 5,
                cpuMining: settings.cpuMining !== false,
                gpuMining: settings.gpuMining !== false,
                timestamp: new Date().toISOString()
            }
        };
        
        this.broadcastToClients(command);
        console.log('🚀 Started mining on all clients');
    }

    /**
     * Stop mining on all clients
     */
    stopMiningOnAllClients() {
        const command = {
            type: 'stopMining',
            data: {
                timestamp: new Date().toISOString()
            }
        };
        
        this.broadcastToClients(command);
        console.log('⏹️ Stopped mining on all clients');
    }

    /**
     * Update settings on all clients
     */
    updateSettingsOnAllClients(settings) {
        const command = {
            type: 'updateSettings',
            data: {
                ...settings,
                timestamp: new Date().toISOString()
            }
        };
        
        this.broadcastToClients(command);
        console.log('⚙️ Updated settings on all clients');
    }

    /**
     * Get status of all clients
     */
    getClientStatuses() {
        const command = {
            type: 'requestStatus',
            data: {
                timestamp: new Date().toISOString()
            }
        };
        
        this.broadcastToClients(command);
    }

    /**
     * Update global mining statistics
     */
    updateGlobalStats() {
        let totalHashrate = 0;
        let activeClients = 0;

        this.connectedClients.forEach((client) => {
            totalHashrate += client.stats.hashrate;
            if (client.isMining) {
                activeClients++;
            }
        });

        this.miningStats.totalHashrate = totalHashrate;
        this.miningStats.activeClients = activeClients;
        
        this.emit('statsUpdated', this.miningStats);
    }

    /**
     * Get client information
     */
    getClientInfo(clientId) {
        return this.connectedClients.get(clientId);
    }

    /**
     * Get all connected clients
     */
    getAllClients() {
        return Array.from(this.connectedClients.values());
    }

    /**
     * Get mining statistics
     */
    getMiningStats() {
        return {
            ...this.miningStats,
            connectedClients: this.connectedClients.size,
            clients: this.getAllClients().map(client => ({
                id: client.id,
                hostname: client.hostname,
                platform: client.platform,
                isMining: client.isMining,
                hashrate: client.stats.hashrate,
                shares: client.stats.shares,
                uptime: client.stats.uptime,
                temperature: client.stats.temperature,
                connectedAt: client.connectedAt,
                lastHeartbeat: client.lastHeartbeat
            }))
        };
    }

    /**
     * Generate unique client ID
     */
    generateClientId() {
        return 'client_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    /**
     * Get client ID from WebSocket
     */
    getClientId(ws) {
        for (const [clientId, client] of this.connectedClients) {
            if (client.ws === ws) {
                return clientId;
            }
        }
        return null;
    }

    /**
     * Clean up disconnected clients
     */
    cleanupDisconnectedClients() {
        const now = new Date();
        const timeout = 60000; // 1 minute

        this.connectedClients.forEach((client, clientId) => {
            if (now - client.lastHeartbeat > timeout) {
                console.log(`🧹 Cleaning up disconnected client: ${client.hostname}`);
                this.connectedClients.delete(clientId);
                this.emit('clientDisconnected', client);
            }
        });

        this.updateGlobalStats();
    }

    /**
     * Start cleanup timer
     */
    startCleanupTimer() {
        setInterval(() => {
            this.cleanupDisconnectedClients();
        }, 30000); // Check every 30 seconds
    }
}

module.exports = CentralMiningManager;


