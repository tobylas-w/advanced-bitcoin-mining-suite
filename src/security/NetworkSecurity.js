const net = require('net');
const dns = require('dns');
const EventEmitter = require('events');

/**
 * Network Security Manager
 * Handles IP filtering, DDoS protection, and network monitoring
 */
class NetworkSecurity extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            maxConnectionsPerIP: config.maxConnectionsPerIP || 10,
            connectionTimeout: config.connectionTimeout || 30000,
            ddosThreshold: config.ddosThreshold || 100, // requests per minute
            enableGeoBlocking: config.enableGeoBlocking || false,
            trustedNetworks: config.trustedNetworks || [],
            blockedCountries: config.blockedCountries || [],
            ...config
        };
        
        this.connections = new Map(); // Track active connections
        this.requestCounts = new Map(); // Track requests per IP
        this.blockedIPs = new Set();
        this.suspiciousIPs = new Map();
        
        this.startMonitoring();
    }

    /**
     * Check if IP is allowed to connect
     */
    async isIPAllowed(ip, userAgent = '') {
        // Check if IP is blocked
        if (this.blockedIPs.has(ip)) {
            this.logSecurityEvent('blocked_ip_access', { ip, userAgent });
            return false;
        }

        // Check connection limits
        const connectionCount = this.getConnectionCount(ip);
        if (connectionCount >= this.config.maxConnectionsPerIP) {
            this.logSecurityEvent('connection_limit_exceeded', { ip, connections: connectionCount });
            return false;
        }

        // Check for DDoS patterns
        if (await this.detectDDoS(ip)) {
            this.blockIP(ip, 'DDoS attack detected');
            return false;
        }

        // Check for suspicious patterns
        if (await this.detectSuspiciousActivity(ip, userAgent)) {
            this.flagSuspiciousIP(ip, 'Suspicious activity detected');
            return false;
        }

        return true;
    }

    /**
     * Track new connection
     */
    trackConnection(ip, socket) {
        if (!this.connections.has(ip)) {
            this.connections.set(ip, []);
        }

        const connections = this.connections.get(ip);
        connections.push({
            socket: socket,
            connectedAt: new Date(),
            lastActivity: new Date()
        });

        // Set up connection cleanup
        socket.on('close', () => {
            this.removeConnection(ip, socket);
        });

        socket.on('timeout', () => {
            this.removeConnection(ip, socket);
            socket.destroy();
        });

        socket.setTimeout(this.config.connectionTimeout);
    }

    /**
     * Remove connection tracking
     */
    removeConnection(ip, socket) {
        const connections = this.connections.get(ip);
        if (connections) {
            const index = connections.findIndex(conn => conn.socket === socket);
            if (index !== -1) {
                connections.splice(index, 1);
                if (connections.length === 0) {
                    this.connections.delete(ip);
                }
            }
        }
    }

    /**
     * Get connection count for IP
     */
    getConnectionCount(ip) {
        const connections = this.connections.get(ip);
        return connections ? connections.length : 0;
    }

    /**
     * Detect DDoS attacks
     */
    async detectDDoS(ip) {
        const now = Date.now();
        const minuteAgo = now - 60000;

        if (!this.requestCounts.has(ip)) {
            this.requestCounts.set(ip, []);
        }

        const requests = this.requestCounts.get(ip);
        
        // Remove old requests
        const recentRequests = requests.filter(timestamp => timestamp > minuteAgo);
        this.requestCounts.set(ip, recentRequests);

        // Check if threshold exceeded
        if (recentRequests.length > this.config.ddosThreshold) {
            return true;
        }

        // Add current request
        recentRequests.push(now);
        return false;
    }

    /**
     * Detect suspicious network activity
     */
    async detectSuspiciousActivity(ip, userAgent) {
        // Check for common attack patterns in user agent
        const suspiciousPatterns = [
            'sqlmap', 'nmap', 'nikto', 'curl', 'wget', 'python-requests',
            'bot', 'crawler', 'scanner', 'hack', 'exploit'
        ];

        const lowerUserAgent = userAgent.toLowerCase();
        if (suspiciousPatterns.some(pattern => lowerUserAgent.includes(pattern))) {
            return true;
        }

        // Check for unusual connection patterns
        const connections = this.connections.get(ip) || [];
        if (connections.length > 5) {
            const recentConnections = connections.filter(conn => 
                Date.now() - conn.connectedAt.getTime() < 60000
            );
            if (recentConnections.length > 5) {
                return true;
            }
        }

        return false;
    }

    /**
     * Block IP address
     */
    blockIP(ip, reason) {
        this.blockedIPs.add(ip);
        this.logSecurityEvent('ip_blocked', { ip, reason });
        
        // Disconnect all connections from this IP
        const connections = this.connections.get(ip);
        if (connections) {
            connections.forEach(conn => {
                conn.socket.destroy();
            });
            this.connections.delete(ip);
        }

        this.emit('ipBlocked', { ip, reason });
    }

    /**
     * Flag suspicious IP
     */
    flagSuspiciousIP(ip, reason) {
        this.suspiciousIPs.set(ip, {
            reason: reason,
            flaggedAt: new Date(),
            count: (this.suspiciousIPs.get(ip)?.count || 0) + 1
        });

        this.logSecurityEvent('suspicious_ip_flagged', { ip, reason });
        this.emit('suspiciousIP', { ip, reason });
    }

    /**
     * Get IP geolocation (if enabled)
     */
    async getIPLocation(ip) {
        if (!this.config.enableGeoBlocking) {
            return null;
        }

        try {
            // This would integrate with a geolocation service
            // For now, return a mock response
            return {
                country: 'US',
                countryCode: 'US',
                region: 'CA',
                city: 'San Francisco',
                isp: 'Example ISP'
            };
        } catch (error) {
            console.warn('Failed to get IP location:', error.message);
            return null;
        }
    }

    /**
     * Check if country is blocked
     */
    async isCountryBlocked(ip) {
        if (!this.config.enableGeoBlocking || this.config.blockedCountries.length === 0) {
            return false;
        }

        const location = await this.getIPLocation(ip);
        if (location && this.config.blockedCountries.includes(location.countryCode)) {
            return true;
        }

        return false;
    }

    /**
     * Validate IP address format
     */
    isValidIP(ip) {
        // IPv4 validation
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        
        // IPv6 validation (basic)
        const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        
        return ipv4Regex.test(ip) || ipv6Regex.test(ip);
    }

    /**
     * Check if IP is in trusted network
     */
    isTrustedIP(ip) {
        return this.config.trustedNetworks.some(network => {
            if (network.includes('/')) {
                // CIDR notation
                return this.isIPInCIDR(ip, network);
            } else {
                // Single IP
                return ip === network;
            }
        });
    }

    /**
     * Check if IP is in CIDR range
     */
    isIPInCIDR(ip, cidr) {
        try {
            const [network, prefixLength] = cidr.split('/');
            const ipNum = this.ipToNumber(ip);
            const networkNum = this.ipToNumber(network);
            const mask = (0xffffffff << (32 - parseInt(prefixLength))) >>> 0;
            
            return (ipNum & mask) === (networkNum & mask);
        } catch (error) {
            return false;
        }
    }

    /**
     * Convert IP to number
     */
    ipToNumber(ip) {
        return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
    }

    /**
     * Log security events
     */
    logSecurityEvent(type, data) {
        const event = {
            type: type,
            timestamp: new Date().toISOString(),
            data: data,
            severity: this.getEventSeverity(type)
        };

        this.emit('securityEvent', event);
        console.log(`🔒 Network Security: ${type}`, data);
    }

    /**
     * Get event severity
     */
    getEventSeverity(type) {
        const severityMap = {
            'blocked_ip_access': 'warning',
            'connection_limit_exceeded': 'warning',
            'ddos_detected': 'critical',
            'suspicious_ip_flagged': 'warning',
            'ip_blocked': 'high'
        };

        return severityMap[type] || 'info';
    }

    /**
     * Start network monitoring
     */
    startMonitoring() {
        // Cleanup old data every minute
        setInterval(() => {
            this.cleanup();
        }, 60000);

        // Log statistics every 5 minutes
        setInterval(() => {
            this.logStatistics();
        }, 300000);

        console.log('🌐 Network security monitoring started');
    }

    /**
     * Cleanup old data
     */
    cleanup() {
        const now = Date.now();
        const minuteAgo = now - 60000;

        // Cleanup old request counts
        for (const [ip, requests] of this.requestCounts) {
            const recentRequests = requests.filter(timestamp => timestamp > minuteAgo);
            if (recentRequests.length === 0) {
                this.requestCounts.delete(ip);
            } else {
                this.requestCounts.set(ip, recentRequests);
            }
        }

        // Cleanup old suspicious IPs (after 1 hour)
        const hourAgo = now - 3600000;
        for (const [ip, data] of this.suspiciousIPs) {
            if (data.flaggedAt.getTime() < hourAgo) {
                this.suspiciousIPs.delete(ip);
            }
        }
    }

    /**
     * Log network statistics
     */
    logStatistics() {
        const stats = {
            activeConnections: this.connections.size,
            blockedIPs: this.blockedIPs.size,
            suspiciousIPs: this.suspiciousIPs.size,
            totalRequests: Array.from(this.requestCounts.values())
                .reduce((sum, requests) => sum + requests.length, 0)
        };

        console.log('📊 Network Statistics:', stats);
        this.emit('statistics', stats);
    }

    /**
     * Get network security status
     */
    getSecurityStatus() {
        return {
            activeConnections: this.connections.size,
            blockedIPs: Array.from(this.blockedIPs),
            suspiciousIPs: Array.from(this.suspiciousIPs.entries()).map(([ip, data]) => ({
                ip: ip,
                reason: data.reason,
                count: data.count,
                flaggedAt: data.flaggedAt
            })),
            config: {
                maxConnectionsPerIP: this.config.maxConnectionsPerIP,
                ddosThreshold: this.config.ddosThreshold,
                enableGeoBlocking: this.config.enableGeoBlocking,
                trustedNetworks: this.config.trustedNetworks
            }
        };
    }

    /**
     * Unblock IP address
     */
    unblockIP(ip) {
        this.blockedIPs.delete(ip);
        this.logSecurityEvent('ip_unblocked', { ip });
        this.emit('ipUnblocked', { ip });
    }

    /**
     * Add trusted network
     */
    addTrustedNetwork(network) {
        if (!this.config.trustedNetworks.includes(network)) {
            this.config.trustedNetworks.push(network);
            this.logSecurityEvent('trusted_network_added', { network });
        }
    }

    /**
     * Remove trusted network
     */
    removeTrustedNetwork(network) {
        const index = this.config.trustedNetworks.indexOf(network);
        if (index !== -1) {
            this.config.trustedNetworks.splice(index, 1);
            this.logSecurityEvent('trusted_network_removed', { network });
        }
    }
}

module.exports = NetworkSecurity;
