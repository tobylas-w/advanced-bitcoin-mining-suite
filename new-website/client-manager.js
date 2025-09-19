const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');

class ClientManager {
    constructor() {
        this.clients = new Map();
        this.clientConfigs = new Map();
        this.clientGroups = new Map();
        this.clientHistory = [];
        this.storageFile = path.join(__dirname, 'data', 'clients.json');
        this.configFile = path.join(__dirname, 'data', 'client-configs.json');
        this.groupsFile = path.join(__dirname, 'data', 'client-groups.json');
        
        // Ensure data directory exists
        this.ensureDataDirectory();
        
        // Load persisted data
        this.loadClients();
        this.loadConfigs();
        this.loadGroups();
        
        // Start cleanup timer
        this.startCleanupTimer();
        
        logger.info('Client Manager initialized', { 
            clients: this.clients.size,
            groups: this.clientGroups.size 
        });
    }

    ensureDataDirectory() {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    // Client Registration and Management
    registerClient(clientData, clientIP) {
        const clientId = this.generateClientId(clientData);
        const now = Date.now();
        
        const client = {
            id: clientId,
            hostname: clientData.hostname || `client-${Date.now()}`,
            name: clientData.name || clientData.hostname || `Client ${this.clients.size + 1}`,
            ip: clientIP,
            mac: clientData.mac || null,
            os: clientData.os || 'Unknown',
            cpu: clientData.cpu || 'Unknown',
            gpu: clientData.gpu || null,
            memory: clientData.memory || 0,
            status: 'online',
            hashrate: clientData.hashrate || 0,
            uptime: clientData.uptime || 0,
            shares: clientData.shares || { accepted: 0, rejected: 0 },
            temperature: clientData.temperature || 0,
            gpuTemperature: clientData.gpuTemperature || 0,
            power: clientData.power || 0,
            cpuUsage: clientData.cpuUsage || 0,
            gpuUsage: clientData.gpuUsage || 0,
            lastSeen: now,
            firstSeen: now,
            totalUptime: 0,
            totalHashrate: 0,
            totalShares: { accepted: 0, rejected: 0 },
            group: clientData.group || 'default',
            tags: clientData.tags || [],
            version: clientData.version || '1.0.0',
            capabilities: clientData.capabilities || [],
            config: this.getDefaultConfig(),
            health: {
                status: 'healthy',
                lastCheck: now,
                issues: [],
                score: 100
            }
        };

        // Check if client already exists
        const existingClient = this.clients.get(clientId);
        if (existingClient) {
            // Update existing client
            client.firstSeen = existingClient.firstSeen;
            client.totalUptime = existingClient.totalUptime;
            client.totalHashrate = existingClient.totalHashrate;
            client.totalShares = existingClient.totalShares;
            client.config = existingClient.config;
            client.group = existingClient.group;
            client.tags = existingClient.tags;
        }

        this.clients.set(clientId, client);
        this.updateClientHealth(clientId);
        this.saveClients();
        
        logger.info('Client registered', { 
            clientId, 
            hostname: client.hostname, 
            ip: clientIP,
            group: client.group 
        });
        
        return client;
    }

    updateClient(clientId, updateData) {
        const client = this.clients.get(clientId);
        if (!client) {
            logger.warn('Attempted to update non-existent client', { clientId });
            return null;
        }

        // Update client data
        Object.assign(client, updateData);
        client.lastSeen = Date.now();
        
        // Update totals
        if (updateData.hashrate) {
            client.totalHashrate = (client.totalHashrate + updateData.hashrate) / 2;
        }
        if (updateData.shares) {
            client.totalShares.accepted += updateData.shares.accepted || 0;
            client.totalShares.rejected += updateData.shares.rejected || 0;
        }
        
        this.updateClientHealth(clientId);
        this.saveClients();
        
        return client;
    }

    generateClientId(clientData) {
        // Generate consistent ID based on hostname and MAC address
        const identifier = `${clientData.hostname || 'unknown'}-${clientData.mac || 'unknown'}`;
        return crypto.createHash('md5').update(identifier).digest('hex').substring(0, 12);
    }

    // Client Health Monitoring
    updateClientHealth(clientId) {
        const client = this.clients.get(clientId);
        if (!client) return;

        const now = Date.now();
        const timeSinceLastSeen = now - client.lastSeen;
        const issues = [];
        let score = 100;

        // Check connection health
        if (timeSinceLastSeen > 5 * 60 * 1000) { // 5 minutes
            issues.push('No communication for 5+ minutes');
            score -= 30;
        }

        // Check temperature
        if (client.temperature > 85) {
            issues.push(`High temperature: ${client.temperature}°C`);
            score -= 20;
        }

        // Check power consumption
        if (client.power > 300) {
            issues.push(`High power consumption: ${client.power}W`);
            score -= 15;
        }

        // Check hashrate efficiency
        if (client.hashrate > 0 && client.power > 0) {
            const efficiency = client.hashrate / client.power;
            if (efficiency < 0.001) {
                issues.push('Low mining efficiency');
                score -= 10;
            }
        }

        // Check share rejection rate
        const totalShares = client.shares.accepted + client.shares.rejected;
        if (totalShares > 0) {
            const rejectionRate = client.shares.rejected / totalShares;
            if (rejectionRate > 0.1) { // 10% rejection rate
                issues.push(`High share rejection rate: ${(rejectionRate * 100).toFixed(1)}%`);
                score -= 15;
            }
        }

        // Update health status
        client.health = {
            status: score > 80 ? 'healthy' : score > 50 ? 'warning' : 'critical',
            lastCheck: now,
            issues,
            score: Math.max(0, score)
        };

        // Update client status based on health
        if (client.health.status === 'critical') {
            client.status = 'offline';
        } else if (timeSinceLastSeen > 2 * 60 * 1000) { // 2 minutes
            client.status = 'idle';
        } else {
            client.status = 'online';
        }
    }

    // Client Configuration Management
    getDefaultConfig() {
        return {
            mining: {
                enabled: true,
                intensity: 80,
                algorithm: 'auto',
                pool: 'default'
            },
            monitoring: {
                reportInterval: 30,
                healthCheckInterval: 60,
                maxTemperature: 85,
                maxPower: 300
            },
            updates: {
                autoUpdate: false,
                updateChannel: 'stable'
            }
        };
    }

    updateClientConfig(clientId, config) {
        const client = this.clients.get(clientId);
        if (!client) return false;

        client.config = { ...client.config, ...config };
        this.saveClients();
        
        logger.info('Client config updated', { clientId, config });
        return true;
    }

    // Client Grouping
    createGroup(groupName, description = '') {
        const group = {
            name: groupName,
            description,
            created: Date.now(),
            clients: [],
            config: this.getDefaultConfig()
        };
        
        this.clientGroups.set(groupName, group);
        this.saveGroups();
        
        logger.info('Client group created', { groupName });
        return group;
    }

    addClientToGroup(clientId, groupName) {
        const client = this.clients.get(clientId);
        const group = this.clientGroups.get(groupName);
        
        if (!client || !group) return false;
        
        client.group = groupName;
        if (!group.clients.includes(clientId)) {
            group.clients.push(clientId);
        }
        
        this.saveClients();
        this.saveGroups();
        
        logger.info('Client added to group', { clientId, groupName });
        return true;
    }

    // Client Discovery and Management
    getClients(filter = {}) {
        const clients = Array.from(this.clients.values());
        
        // Apply filters
        if (filter.group) {
            return clients.filter(c => c.group === filter.group);
        }
        if (filter.status) {
            return clients.filter(c => c.status === filter.status);
        }
        if (filter.health) {
            return clients.filter(c => c.health.status === filter.health);
        }
        
        return clients;
    }

    getClient(clientId) {
        return this.clients.get(clientId);
    }

    getClientStats() {
        const clients = Array.from(this.clients.values());
        const now = Date.now();
        
        return {
            total: clients.length,
            online: clients.filter(c => c.status === 'online').length,
            offline: clients.filter(c => c.status === 'offline').length,
            idle: clients.filter(c => c.status === 'idle').length,
            healthy: clients.filter(c => c.health.status === 'healthy').length,
            warning: clients.filter(c => c.health.status === 'warning').length,
            critical: clients.filter(c => c.health.status === 'critical').length,
            totalHashrate: clients.reduce((sum, c) => sum + c.hashrate, 0),
            totalPower: clients.reduce((sum, c) => sum + c.power, 0),
            totalShares: clients.reduce((sum, c) => sum + c.shares.accepted, 0),
            groups: this.clientGroups.size,
            lastUpdate: now
        };
    }

    // Cleanup and Maintenance
    startCleanupTimer() {
        setInterval(() => {
            this.cleanupStaleClients();
            this.updateAllClientHealth();
        }, 60000); // Run every minute
    }

    cleanupStaleClients() {
        const now = Date.now();
        const staleThreshold = 10 * 60 * 1000; // 10 minutes
        
        for (const [clientId, client] of this.clients) {
            if (now - client.lastSeen > staleThreshold) {
                client.status = 'offline';
                client.health.status = 'critical';
                client.health.issues.push('Client offline for 10+ minutes');
            }
        }
        
        this.saveClients();
    }

    updateAllClientHealth() {
        for (const clientId of this.clients.keys()) {
            this.updateClientHealth(clientId);
        }
    }

    // Persistence
    saveClients() {
        try {
            const data = {
                clients: Array.from(this.clients.entries()),
                lastSaved: Date.now()
            };
            fs.writeFileSync(this.storageFile, JSON.stringify(data, null, 2));
        } catch (error) {
            logger.error('Failed to save clients', { error: error.message });
        }
    }

    loadClients() {
        try {
            if (fs.existsSync(this.storageFile)) {
                const data = JSON.parse(fs.readFileSync(this.storageFile, 'utf8'));
                this.clients = new Map(data.clients || []);
                logger.info('Clients loaded from storage', { count: this.clients.size });
            }
        } catch (error) {
            logger.error('Failed to load clients', { error: error.message });
        }
    }

    saveConfigs() {
        try {
            const data = {
                configs: Array.from(this.clientConfigs.entries()),
                lastSaved: Date.now()
            };
            fs.writeFileSync(this.configFile, JSON.stringify(data, null, 2));
        } catch (error) {
            logger.error('Failed to save client configs', { error: error.message });
        }
    }

    loadConfigs() {
        try {
            if (fs.existsSync(this.configFile)) {
                const data = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
                this.clientConfigs = new Map(data.configs || []);
            }
        } catch (error) {
            logger.error('Failed to load client configs', { error: error.message });
        }
    }

    saveGroups() {
        try {
            const data = {
                groups: Array.from(this.clientGroups.entries()),
                lastSaved: Date.now()
            };
            fs.writeFileSync(this.groupsFile, JSON.stringify(data, null, 2));
        } catch (error) {
            logger.error('Failed to save client groups', { error: error.message });
        }
    }

    loadGroups() {
        try {
            if (fs.existsSync(this.groupsFile)) {
                const data = JSON.parse(fs.readFileSync(this.groupsFile, 'utf8'));
                this.clientGroups = new Map(data.groups || []);
            }
        } catch (error) {
            logger.error('Failed to load client groups', { error: error.message });
        }
    }

    // Client Actions
    restartClient(clientId) {
        const client = this.clients.get(clientId);
        if (!client) return false;
        
        // This would trigger a restart command to the client
        logger.info('Client restart requested', { clientId });
        return true;
    }

    updateClient(clientId) {
        const client = this.clients.get(clientId);
        if (!client) return false;
        
        // This would trigger an update command to the client
        logger.info('Client update requested', { clientId });
        return true;
    }

    removeClient(clientId) {
        const client = this.clients.get(clientId);
        if (!client) return false;
        
        // Remove from groups
        for (const group of this.clientGroups.values()) {
            const index = group.clients.indexOf(clientId);
            if (index > -1) {
                group.clients.splice(index, 1);
            }
        }
        
        this.clients.delete(clientId);
        this.saveClients();
        this.saveGroups();
        
        logger.info('Client removed', { clientId });
        return true;
    }
}

module.exports = ClientManager;
