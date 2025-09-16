/**
 * Enterprise Security and Encryption System
 * Advanced security features for commercial deployment
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

class EnterpriseSecurity {
    constructor() {
        this.encryptionKey = this.generateEncryptionKey();
        this.hmacKey = this.generateHMACKey();
        this.securityConfig = this.loadSecurityConfig();
        this.sessionTokens = new Map();
        this.auditLog = [];
    }

    generateEncryptionKey() {
        // Generate a secure 256-bit key
        return crypto.randomBytes(32);
    }

    generateHMACKey() {
        // Generate HMAC key for message authentication
        return crypto.randomBytes(32);
    }

    loadSecurityConfig() {
        return {
            encryptionAlgorithm: 'aes-256-gcm',
            hmacAlgorithm: 'sha256',
            keyRotationInterval: 86400000, // 24 hours
            sessionTimeout: 3600000, // 1 hour
            maxFailedAttempts: 3,
            lockoutDuration: 900000, // 15 minutes
            auditLogRetention: 604800000, // 7 days
            enableTwoFactor: false,
            enableGeoBlocking: false,
            allowedIPs: [],
            blockedIPs: [],
            enableRateLimiting: true,
            rateLimitWindow: 60000, // 1 minute
            rateLimitMax: 100 // requests per window
        };
    }

    // Encryption/Decryption
    encrypt(data, key = null) {
        try {
            const encryptionKey = key || this.encryptionKey;
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipher(this.securityConfig.encryptionAlgorithm, encryptionKey);
            cipher.setAAD(Buffer.from('bitcoin-mining-system'));
            
            let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag();
            
            return {
                encrypted,
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex'),
                algorithm: this.securityConfig.encryptionAlgorithm
            };
        } catch (error) {
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }

    decrypt(encryptedData, key = null) {
        try {
            const decryptionKey = key || this.encryptionKey;
            const decipher = crypto.createDecipher(
                encryptedData.algorithm,
                decryptionKey
            );
            
            decipher.setAAD(Buffer.from('bitcoin-mining-system'));
            decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
            
            let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return JSON.parse(decrypted);
        } catch (error) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }

    // HMAC for message authentication
    createHMAC(data) {
        const hmac = crypto.createHmac(this.securityConfig.hmacAlgorithm, this.hmacKey);
        hmac.update(JSON.stringify(data));
        return hmac.digest('hex');
    }

    verifyHMAC(data, hmac) {
        const expectedHMAC = this.createHMAC(data);
        return crypto.timingSafeEqual(
            Buffer.from(hmac, 'hex'),
            Buffer.from(expectedHMAC, 'hex')
        );
    }

    // Authentication and Authorization
    generateSessionToken(userId, ipAddress) {
        const tokenData = {
            userId,
            ipAddress,
            timestamp: Date.now(),
            sessionId: crypto.randomUUID()
        };
        
        const token = this.encrypt(tokenData);
        const tokenString = Buffer.from(JSON.stringify(token)).toString('base64');
        
        this.sessionTokens.set(tokenString, {
            ...tokenData,
            lastActivity: Date.now(),
            failedAttempts: 0
        });
        
        this.logSecurityEvent('SESSION_CREATED', { userId, ipAddress, sessionId: tokenData.sessionId });
        
        return tokenString;
    }

    validateSessionToken(token, ipAddress) {
        try {
            const tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
            const decryptedData = this.decrypt(tokenData);
            
            const session = this.sessionTokens.get(token);
            if (!session) {
                this.logSecurityEvent('SESSION_NOT_FOUND', { token: token.substring(0, 10) + '...', ipAddress });
                return false;
            }
            
            // Check IP address
            if (session.ipAddress !== ipAddress) {
                this.logSecurityEvent('SESSION_IP_MISMATCH', { 
                    expected: session.ipAddress, 
                    actual: ipAddress,
                    sessionId: session.sessionId 
                });
                return false;
            }
            
            // Check session timeout
            if (Date.now() - session.lastActivity > this.securityConfig.sessionTimeout) {
                this.sessionTokens.delete(token);
                this.logSecurityEvent('SESSION_EXPIRED', { sessionId: session.sessionId });
                return false;
            }
            
            // Update last activity
            session.lastActivity = Date.now();
            this.sessionTokens.set(token, session);
            
            return true;
        } catch (error) {
            this.logSecurityEvent('SESSION_VALIDATION_ERROR', { error: error.message, ipAddress });
            return false;
        }
    }

    // Rate Limiting
    rateLimitCheck(ipAddress, endpoint) {
        const key = `${ipAddress}:${endpoint}`;
        const now = Date.now();
        const windowStart = now - this.securityConfig.rateLimitWindow;
        
        // Clean old entries
        for (const [sessionKey, session] of this.sessionTokens.entries()) {
            if (session.lastActivity < windowStart) {
                this.sessionTokens.delete(sessionKey);
            }
        }
        
        // Count requests in current window
        const requestCount = Array.from(this.sessionTokens.values())
            .filter(session => session.lastActivity >= windowStart)
            .length;
        
        if (requestCount > this.securityConfig.rateLimitMax) {
            this.logSecurityEvent('RATE_LIMIT_EXCEEDED', { ipAddress, endpoint, requestCount });
            return false;
        }
        
        return true;
    }

    // IP Filtering
    isIPAllowed(ipAddress) {
        // Check blocked IPs first
        if (this.securityConfig.blockedIPs.includes(ipAddress)) {
            this.logSecurityEvent('IP_BLOCKED', { ipAddress });
            return false;
        }
        
        // Check allowed IPs if configured
        if (this.securityConfig.allowedIPs.length > 0) {
            if (!this.securityConfig.allowedIPs.includes(ipAddress)) {
                this.logSecurityEvent('IP_NOT_ALLOWED', { ipAddress });
                return false;
            }
        }
        
        return true;
    }

    // Security Event Logging
    logSecurityEvent(eventType, data) {
        const event = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            type: eventType,
            data: data,
            severity: this.getEventSeverity(eventType),
            source: 'EnterpriseSecurity'
        };
        
        this.auditLog.push(event);
        
        // Keep only recent events
        const cutoff = Date.now() - this.securityConfig.auditLogRetention;
        this.auditLog = this.auditLog.filter(event => 
            new Date(event.timestamp).getTime() > cutoff
        );
        
        // Log to console based on severity
        const logMessage = `🔒 ${eventType}: ${JSON.stringify(data)}`;
        switch (event.severity) {
            case 'critical':
                console.error(`🚨 CRITICAL ${logMessage}`);
                break;
            case 'warning':
                console.warn(`⚠️ WARNING ${logMessage}`);
                break;
            case 'info':
                console.log(`ℹ️ INFO ${logMessage}`);
                break;
        }
    }

    getEventSeverity(eventType) {
        const criticalEvents = [
            'AUTHENTICATION_FAILED',
            'SESSION_HIJACK_ATTEMPT',
            'RATE_LIMIT_EXCEEDED',
            'IP_BLOCKED',
            'ENCRYPTION_ERROR'
        ];
        
        const warningEvents = [
            'SESSION_EXPIRED',
            'IP_NOT_ALLOWED',
            'INVALID_TOKEN',
            'SUSPICIOUS_ACTIVITY'
        ];
        
        if (criticalEvents.includes(eventType)) return 'critical';
        if (warningEvents.includes(eventType)) return 'warning';
        return 'info';
    }

    // Key Rotation
    rotateKeys() {
        console.log('🔄 Rotating encryption keys...');
        
        const oldKey = this.encryptionKey;
        this.encryptionKey = this.generateEncryptionKey();
        this.hmacKey = this.generateHMACKey();
        
        this.logSecurityEvent('KEYS_ROTATED', { 
            oldKeyId: oldKey.toString('hex').substring(0, 16) + '...',
            newKeyId: this.encryptionKey.toString('hex').substring(0, 16) + '...'
        });
        
        // Schedule next rotation
        setTimeout(() => this.rotateKeys(), this.securityConfig.keyRotationInterval);
    }

    // Secure Configuration Storage
    encryptConfig(config) {
        const encrypted = this.encrypt(config);
        const hmac = this.createHMAC(encrypted);
        
        return {
            ...encrypted,
            hmac
        };
    }

    decryptConfig(encryptedConfig) {
        // Verify HMAC first
        const { hmac, ...configData } = encryptedConfig;
        if (!this.verifyHMAC(configData, hmac)) {
            throw new Error('Configuration HMAC verification failed');
        }
        
        return this.decrypt(configData);
    }

    // Secure File Operations
    writeSecureFile(filePath, data) {
        try {
            const encrypted = this.encrypt(data);
            const hmac = this.createHMAC(encrypted);
            
            const secureData = {
                ...encrypted,
                hmac,
                timestamp: Date.now()
            };
            
            fs.writeFileSync(filePath, JSON.stringify(secureData, null, 2));
            
            // Set restrictive permissions
            fs.chmodSync(filePath, 0o600);
            
            this.logSecurityEvent('SECURE_FILE_WRITTEN', { filePath });
        } catch (error) {
            this.logSecurityEvent('SECURE_FILE_ERROR', { filePath, error: error.message });
            throw error;
        }
    }

    readSecureFile(filePath) {
        try {
            const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return this.decryptConfig(fileData);
        } catch (error) {
            this.logSecurityEvent('SECURE_FILE_READ_ERROR', { filePath, error: error.message });
            throw error;
        }
    }

    // Security Audit and Reporting
    getSecurityReport() {
        const now = Date.now();
        const last24Hours = now - 86400000;
        const last7Days = now - 604800000;
        
        const recentEvents = this.auditLog.filter(event => 
            new Date(event.timestamp).getTime() > last24Hours
        );
        
        const weeklyEvents = this.auditLog.filter(event => 
            new Date(event.timestamp).getTime() > last7Days
        );
        
        return {
            summary: {
                totalEvents: this.auditLog.length,
                events24h: recentEvents.length,
                events7d: weeklyEvents.length,
                activeSessions: this.sessionTokens.size,
                lastKeyRotation: new Date(now - this.securityConfig.keyRotationInterval).toISOString()
            },
            recentEvents: recentEvents.slice(-20),
            eventTypes: this.getEventTypeStats(weeklyEvents),
            securityScore: this.calculateSecurityScore(),
            recommendations: this.getSecurityRecommendations()
        };
    }

    getEventTypeStats(events) {
        const stats = {};
        events.forEach(event => {
            stats[event.type] = (stats[event.type] || 0) + 1;
        });
        return stats;
    }

    calculateSecurityScore() {
        const recentEvents = this.auditLog.filter(event => 
            Date.now() - new Date(event.timestamp).getTime() < 86400000
        );
        
        const criticalEvents = recentEvents.filter(event => event.severity === 'critical').length;
        const warningEvents = recentEvents.filter(event => event.severity === 'warning').length;
        
        let score = 100;
        score -= criticalEvents * 20;
        score -= warningEvents * 5;
        
        return Math.max(0, Math.min(100, score));
    }

    getSecurityRecommendations() {
        const recommendations = [];
        
        if (this.securityConfig.enableTwoFactor === false) {
            recommendations.push('Enable two-factor authentication for enhanced security');
        }
        
        if (this.securityConfig.allowedIPs.length === 0) {
            recommendations.push('Configure IP whitelist for restricted access');
        }
        
        if (this.securityConfig.sessionTimeout > 3600000) {
            recommendations.push('Consider reducing session timeout for better security');
        }
        
        return recommendations;
    }

    // Cleanup and Maintenance
    cleanup() {
        // Clean expired sessions
        const now = Date.now();
        for (const [token, session] of this.sessionTokens.entries()) {
            if (now - session.lastActivity > this.securityConfig.sessionTimeout) {
                this.sessionTokens.delete(token);
            }
        }
        
        // Clean old audit log entries
        const cutoff = Date.now() - this.securityConfig.auditLogRetention;
        this.auditLog = this.auditLog.filter(event => 
            new Date(event.timestamp).getTime() > cutoff
        );
    }

    // Initialize Security System
    initialize() {
        console.log('🔐 Initializing enterprise security...');
        
        // Start key rotation
        setTimeout(() => this.rotateKeys(), this.securityConfig.keyRotationInterval);
        
        // Start cleanup routine
        setInterval(() => this.cleanup(), 300000); // Every 5 minutes
        
        console.log('✅ Enterprise security initialized');
    }
}

module.exports = EnterpriseSecurity;
