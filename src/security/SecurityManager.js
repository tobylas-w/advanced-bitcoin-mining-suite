const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('rate-limiter-flexible');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

/**
 * Advanced Security Manager for Bitcoin Mining System
 * Handles authentication, encryption, rate limiting, and security monitoring
 */
class SecurityManager extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            secretKey: config.secretKey || this.generateSecretKey(),
            jwtExpiry: config.jwtExpiry || '24h',
            maxLoginAttempts: config.maxLoginAttempts || 5,
            lockoutTime: config.lockoutTime || 15 * 60 * 1000, // 15 minutes
            encryptionKey: config.encryptionKey || this.generateEncryptionKey(),
            enable2FA: config.enable2FA || false,
            requireHTTPS: config.requireHTTPS || false,
            ...config
        };
        
        this.rateLimiters = this.initializeRateLimiters();
        this.failedAttempts = new Map();
        this.activeSessions = new Map();
        this.securityLog = [];
        
        // Security policies
        this.policies = {
            password: {
                minLength: 12,
                requireUppercase: true,
                requireLowercase: true,
                requireNumbers: true,
                requireSpecialChars: true,
                maxAge: 90 * 24 * 60 * 60 * 1000 // 90 days
            },
            network: {
                allowedIPs: [],
                blockedIPs: [],
                geoBlocking: false,
                vpnDetection: false
            },
            mining: {
                maxHashrate: 1000000, // Prevent unrealistic hashrates
                maxConnections: 100,
                suspiciousActivityThreshold: 10
            }
        };
        
        this.loadSecurityConfig();
    }

    /**
     * Initialize rate limiters for different endpoints
     */
    initializeRateLimiters() {
        return {
            login: new rateLimit.RateLimiterMemory({
                keyPrefix: 'login',
                points: 5, // 5 attempts
                duration: 900, // per 15 minutes
                blockDuration: 900 // block for 15 minutes
            }),
            api: new rateLimit.RateLimiterMemory({
                keyPrefix: 'api',
                points: 100, // 100 requests
                duration: 60, // per minute
                blockDuration: 60
            }),
            mining: new rateLimit.RateLimiterMemory({
                keyPrefix: 'mining',
                points: 10, // 10 mining commands
                duration: 60, // per minute
                blockDuration: 300 // block for 5 minutes
            }),
            wallet: new rateLimit.RateLimiterMemory({
                keyPrefix: 'wallet',
                points: 3, // 3 wallet operations
                duration: 300, // per 5 minutes
                blockDuration: 1800 // block for 30 minutes
            })
        };
    }

    /**
     * Generate secure secret key
     */
    generateSecretKey() {
        return crypto.randomBytes(64).toString('hex');
    }

    /**
     * Generate encryption key for sensitive data
     */
    generateEncryptionKey() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Hash password securely
     */
    async hashPassword(password) {
        const saltRounds = 12;
        return await bcrypt.hash(password, saltRounds);
    }

    /**
     * Verify password
     */
    async verifyPassword(password, hash) {
        return await bcrypt.compare(password, hash);
    }

    /**
     * Validate password strength
     */
    validatePassword(password) {
        const policy = this.policies.password;
        const errors = [];

        if (password.length < policy.minLength) {
            errors.push(`Password must be at least ${policy.minLength} characters long`);
        }

        if (policy.requireUppercase && !/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        if (policy.requireLowercase && !/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }

        if (policy.requireNumbers && !/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Generate JWT token
     */
    generateToken(payload) {
        return jwt.sign(payload, this.config.secretKey, {
            expiresIn: this.config.jwtExpiry,
            issuer: 'bitcoin-mining-suite',
            audience: 'mining-clients'
        });
    }

    /**
     * Verify JWT token
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, this.config.secretKey, {
                issuer: 'bitcoin-mining-suite',
                audience: 'mining-clients'
            });
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }

    /**
     * Rate limiting middleware
     */
    async checkRateLimit(key, limiterType, req) {
        const limiter = this.rateLimiters[limiterType];
        if (!limiter) return true;

        try {
            const clientIP = req.clientIP || req.ip || req.connection.remoteAddress;
            const rateLimitKey = `${key}:${clientIP}`;
            
            await limiter.consume(rateLimitKey);
            return true;
        } catch (rejRes) {
            this.logSecurityEvent('rate_limit_exceeded', {
                type: limiterType,
                ip: req.clientIP || req.ip,
                userAgent: req.get('User-Agent'),
                endpoint: req.path
            });
            return false;
        }
    }

    /**
     * Check for suspicious activity
     */
    detectSuspiciousActivity(req, user = null) {
        const suspicious = [];
        const clientIP = req.clientIP || req.ip || req.connection.remoteAddress;
        
        // Check for failed login attempts
        const failedAttempts = this.failedAttempts.get(clientIP) || 0;
        if (failedAttempts > this.policies.mining.suspiciousActivityThreshold) {
            suspicious.push('Multiple failed login attempts');
        }

        // Check user agent
        const userAgent = req.get('User-Agent');
        if (!userAgent || userAgent.length < 10) {
            suspicious.push('Suspicious user agent');
        }

        // Check for common attack patterns
        const path = req.path.toLowerCase();
        const suspiciousPaths = ['admin', 'config', 'debug', 'test', 'api/v1'];
        if (suspiciousPaths.some(sp => path.includes(sp))) {
            suspicious.push('Suspicious endpoint access');
        }

        // Check for SQL injection patterns
        const query = JSON.stringify(req.query).toLowerCase();
        const sqlPatterns = ['union', 'select', 'drop', 'insert', 'update', 'delete', '--', '/*'];
        if (sqlPatterns.some(pattern => query.includes(pattern))) {
            suspicious.push('Potential SQL injection attempt');
        }

        // Check for XSS patterns
        const xssPatterns = ['<script', 'javascript:', 'onload=', 'onerror='];
        if (xssPatterns.some(pattern => query.includes(pattern))) {
            suspicious.push('Potential XSS attempt');
        }

        if (suspicious.length > 0) {
            this.logSecurityEvent('suspicious_activity', {
                ip: clientIP,
                userAgent: userAgent,
                suspicious: suspicious,
                endpoint: req.path,
                user: user
            });
        }

        return suspicious;
    }

    /**
     * Encrypt sensitive data
     */
    encryptData(data) {
        const algorithm = 'aes-256-gcm';
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher(algorithm, this.config.encryptionKey);
        
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return {
            encrypted: encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex')
        };
    }

    /**
     * Decrypt sensitive data
     */
    decryptData(encryptedData) {
        const algorithm = 'aes-256-gcm';
        const decipher = crypto.createDecipher(algorithm, this.config.encryptionKey);
        
        decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
        
        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return JSON.parse(decrypted);
    }

    /**
     * Secure wallet address storage
     */
    secureWalletAddress(address) {
        // Only store a hash of the wallet address for security
        const hash = crypto.createHash('sha256').update(address).digest('hex');
        return {
            hash: hash,
            encrypted: this.encryptData({ address: address })
        };
    }

    /**
     * Verify wallet address integrity
     */
    verifyWalletAddress(storedHash, address) {
        const computedHash = crypto.createHash('sha256').update(address).digest('hex');
        return storedHash === computedHash;
    }

    /**
     * Generate secure session ID
     */
    generateSessionId() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Create secure session
     */
    createSession(userId, userAgent, ip) {
        const sessionId = this.generateSessionId();
        const token = this.generateToken({
            userId: userId,
            sessionId: sessionId,
            ip: ip,
            userAgent: userAgent
        });

        const session = {
            id: sessionId,
            userId: userId,
            token: token,
            ip: ip,
            userAgent: userAgent,
            createdAt: new Date(),
            lastActivity: new Date(),
            isActive: true
        };

        this.activeSessions.set(sessionId, session);
        return session;
    }

    /**
     * Validate session
     */
    validateSession(sessionId, ip, userAgent) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return false;

        // Check if session is expired (24 hours)
        const now = new Date();
        const sessionAge = now - session.createdAt;
        if (sessionAge > 24 * 60 * 60 * 1000) {
            this.activeSessions.delete(sessionId);
            return false;
        }

        // Check IP and user agent consistency
        if (session.ip !== ip || session.userAgent !== userAgent) {
            this.logSecurityEvent('session_hijack_attempt', {
                sessionId: sessionId,
                expectedIP: session.ip,
                actualIP: ip,
                expectedUA: session.userAgent,
                actualUA: userAgent
            });
            return false;
        }

        // Update last activity
        session.lastActivity = now;
        return true;
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

        this.securityLog.push(event);
        
        // Keep only last 1000 events
        if (this.securityLog.length > 1000) {
            this.securityLog = this.securityLog.slice(-1000);
        }

        // Emit event for real-time monitoring
        this.emit('securityEvent', event);

        // Save to file for audit trail
        this.saveSecurityLog();
    }

    /**
     * Get event severity level
     */
    getEventSeverity(type) {
        const severityMap = {
            'login_success': 'info',
            'login_failed': 'warning',
            'rate_limit_exceeded': 'warning',
            'suspicious_activity': 'warning',
            'session_hijack_attempt': 'critical',
            'unauthorized_access': 'critical',
            'wallet_access': 'high',
            'mining_started': 'info',
            'mining_stopped': 'info',
            'config_changed': 'high'
        };

        return severityMap[type] || 'info';
    }

    /**
     * Save security log to file
     */
    saveSecurityLog() {
        const logDir = path.join(__dirname, '../../logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        const logFile = path.join(logDir, 'security.log');
        const logEntry = JSON.stringify(this.securityLog[this.securityLog.length - 1]) + '\n';
        
        fs.appendFileSync(logFile, logEntry);
    }

    /**
     * Get security status
     */
    getSecurityStatus() {
        return {
            activeSessions: this.activeSessions.size,
            failedAttempts: this.failedAttempts.size,
            recentEvents: this.securityLog.slice(-10),
            policies: this.policies,
            rateLimits: Object.keys(this.rateLimiters).map(key => ({
                type: key,
                points: this.rateLimiters[key].points,
                duration: this.rateLimiters[key].duration
            }))
        };
    }

    /**
     * Block IP address
     */
    blockIP(ip, reason, duration = 24 * 60 * 60 * 1000) {
        this.policies.network.blockedIPs.push({
            ip: ip,
            reason: reason,
            blockedAt: new Date(),
            expiresAt: new Date(Date.now() + duration)
        });

        this.logSecurityEvent('ip_blocked', {
            ip: ip,
            reason: reason,
            duration: duration
        });
    }

    /**
     * Check if IP is blocked
     */
    isIPBlocked(ip) {
        const now = new Date();
        return this.policies.network.blockedIPs.some(block => {
            if (block.ip === ip && block.expiresAt > now) {
                return true;
            }
            return false;
        });
    }

    /**
     * Load security configuration
     */
    loadSecurityConfig() {
        const configPath = path.join(__dirname, '../../config/security.json');
        if (fs.existsSync(configPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                this.policies = { ...this.policies, ...config.policies };
                this.config = { ...this.config, ...config.config };
            } catch (error) {
                console.warn('Failed to load security config:', error.message);
            }
        }
    }

    /**
     * Save security configuration
     */
    saveSecurityConfig() {
        const configDir = path.join(__dirname, '../../config');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        const configPath = path.join(configDir, 'security.json');
        const config = {
            policies: this.policies,
            config: {
                jwtExpiry: this.config.jwtExpiry,
                maxLoginAttempts: this.config.maxLoginAttempts,
                lockoutTime: this.config.lockoutTime,
                enable2FA: this.config.enable2FA,
                requireHTTPS: this.config.requireHTTPS
            }
        };

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }

    /**
     * Cleanup expired sessions and failed attempts
     */
    cleanup() {
        const now = new Date();
        
        // Cleanup expired sessions
        for (const [sessionId, session] of this.activeSessions) {
            const sessionAge = now - session.createdAt;
            if (sessionAge > 24 * 60 * 60 * 1000) {
                this.activeSessions.delete(sessionId);
            }
        }

        // Cleanup expired failed attempts
        for (const [ip, attempts] of this.failedAttempts) {
            if (attempts.expiresAt < now) {
                this.failedAttempts.delete(ip);
            }
        }

        // Cleanup expired IP blocks
        this.policies.network.blockedIPs = this.policies.network.blockedIPs.filter(
            block => block.expiresAt > now
        );
    }

    /**
     * Start security monitoring
     */
    startMonitoring() {
        // Cleanup every hour
        setInterval(() => {
            this.cleanup();
        }, 60 * 60 * 1000);

        console.log('🔒 Security monitoring started');
    }
}

module.exports = SecurityManager;
