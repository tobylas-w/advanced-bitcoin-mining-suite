const crypto = require('crypto');
const EventEmitter = require('events');

/**
 * Wallet Security Manager
 * Handles secure storage, validation, and protection of wallet addresses
 */
class WalletSecurity extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            encryptionKey: config.encryptionKey || this.generateEncryptionKey(),
            maxWalletChanges: config.maxWalletChanges || 3, // per day
            requireConfirmation: config.requireConfirmation || true,
            enableWhitelist: config.enableWhitelist || false,
            ...config
        };
        
        this.walletHistory = new Map(); // Track wallet changes
        this.suspiciousActivities = [];
        this.whitelistedAddresses = new Set();
        this.encryptedWallets = new Map();
        
        this.loadWhitelist();
    }

    /**
     * Generate encryption key
     */
    generateEncryptionKey() {
        return crypto.randomBytes(32);
    }

    /**
     * Encrypt wallet address
     */
    encryptWalletAddress(address, userId = 'default') {
        try {
            // Simple encryption using crypto hash for now
            const encrypted = crypto.createHash('sha256').update(address + this.config.encryptionKey).digest('hex');
            
            const encryptedData = {
                encrypted: encrypted,
                userId: userId,
                encryptedAt: new Date().toISOString(),
                hash: crypto.createHash('md5').update(address).digest('hex')
            };
            
            this.encryptedWallets.set(userId, encryptedData);
            this.logSecurityEvent('wallet_encrypted', { userId, address: this.maskAddress(address) });
            
            return encryptedData;
        } catch (error) {
            this.logSecurityEvent('wallet_encryption_failed', { userId, error: error.message });
            throw new Error('Failed to encrypt wallet address');
        }
    }

    /**
     * Decrypt wallet address
     */
    decryptWalletAddress(userId = 'default') {
        try {
            const encryptedData = this.encryptedWallets.get(userId);
            if (!encryptedData) {
                throw new Error('No encrypted wallet found');
            }
            
            // For this simplified version, we can't decrypt - just return the hash
            this.logSecurityEvent('wallet_decrypted', { userId, address: '***encrypted***' });
            return encryptedData.hash;
        } catch (error) {
            this.logSecurityEvent('wallet_decryption_failed', { userId, error: error.message });
            throw new Error('Failed to decrypt wallet address');
        }
    }

    /**
     * Validate Bitcoin address format and security
     */
    validateWalletAddress(address) {
        const validation = {
            isValid: false,
            type: 'unknown',
            securityScore: 0,
            warnings: [],
            recommendations: []
        };

        try {
            // Basic format validation
            if (!this.isValidBitcoinAddress(address)) {
                validation.warnings.push('Invalid Bitcoin address format');
                return validation;
            }

            validation.isValid = true;
            validation.type = this.getAddressType(address);
            validation.securityScore = this.calculateSecurityScore(address);

            // Security checks
            if (this.isTestnetAddress(address)) {
                validation.warnings.push('This appears to be a testnet address');
                validation.recommendations.push('Use a mainnet address for production mining');
            }

            if (this.isWeakAddress(address)) {
                validation.warnings.push('Address may be vulnerable to certain attacks');
                validation.securityScore -= 20;
            }

            // Recommendations based on address type
            if (validation.type === 'legacy') {
                validation.recommendations.push('Consider using SegWit or Bech32 for lower fees');
            } else if (validation.type === 'segwit') {
                validation.recommendations.push('Good choice for balance between compatibility and efficiency');
            } else if (validation.type === 'bech32') {
                validation.recommendations.push('Excellent choice for maximum efficiency and lower fees');
            }

            // Check against known malicious addresses
            if (this.isKnownMaliciousAddress(address)) {
                validation.warnings.push('This address is flagged as potentially malicious');
                validation.securityScore = 0;
                validation.isValid = false;
            }

        } catch (error) {
            validation.warnings.push('Address validation failed: ' + error.message);
        }

        return validation;
    }

    /**
     * Check if address is valid Bitcoin address
     */
    isValidBitcoinAddress(address) {
        if (!address || typeof address !== 'string') {
            return false;
        }

        // Legacy address (starts with 1)
        const legacyRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
        
        // SegWit address (starts with 3)
        const segwitRegex = /^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/;
        
        // Bech32 address (starts with bc1)
        const bech32Regex = /^bc1[a-z0-9]{39,59}$/;

        return legacyRegex.test(address) || 
               segwitRegex.test(address) || 
               bech32Regex.test(address);
    }

    /**
     * Get address type
     */
    getAddressType(address) {
        if (address.startsWith('1')) return 'legacy';
        if (address.startsWith('3')) return 'segwit';
        if (address.startsWith('bc1')) return 'bech32';
        return 'unknown';
    }

    /**
     * Calculate security score (0-100)
     */
    calculateSecurityScore(address) {
        let score = 50; // Base score

        // Address type scoring
        const type = this.getAddressType(address);
        if (type === 'bech32') score += 30;
        else if (type === 'segwit') score += 20;
        else if (type === 'legacy') score += 10;

        // Length validation
        if (address.length >= 26 && address.length <= 35) score += 10;
        else score -= 10;

        // Character diversity
        const uniqueChars = new Set(address.toLowerCase()).size;
        if (uniqueChars > 20) score += 10;

        return Math.min(100, Math.max(0, score));
    }

    /**
     * Check if address is testnet
     */
    isTestnetAddress(address) {
        // Testnet addresses start with 'm', 'n', '2', or 'tb1'
        return /^[mn2]|^tb1/.test(address);
    }

    /**
     * Check for weak addresses
     */
    isWeakAddress(address) {
        // Check for sequential characters
        if (/(.)\1{3,}/.test(address)) return true;
        
        // Check for simple patterns
        if (/^[1]{26,34}$/.test(address)) return true;
        if (/^[3]{26,34}$/.test(address)) return true;
        
        return false;
    }

    /**
     * Check against known malicious addresses
     */
    isKnownMaliciousAddress(address) {
        // This would integrate with threat intelligence feeds
        // For now, return false
        return false;
    }

    /**
     * Mask address for logging (show first 4 and last 4 characters)
     */
    maskAddress(address) {
        if (address.length <= 8) return '***';
        return address.substring(0, 4) + '***' + address.substring(address.length - 4);
    }

    /**
     * Track wallet changes
     */
    trackWalletChange(oldAddress, newAddress, userId = 'default') {
        const now = new Date();
        const today = now.toDateString();

        if (!this.walletHistory.has(userId)) {
            this.walletHistory.set(userId, []);
        }

        const history = this.walletHistory.get(userId);
        const todayChanges = history.filter(change => 
            new Date(change.timestamp).toDateString() === today
        );

        // Check if exceeding daily limit
        if (todayChanges.length >= this.config.maxWalletChanges) {
            this.logSecurityEvent('wallet_change_limit_exceeded', {
                userId,
                oldAddress: this.maskAddress(oldAddress),
                newAddress: this.maskAddress(newAddress),
                dailyChanges: todayChanges.length
            });
            throw new Error('Daily wallet change limit exceeded');
        }

        const change = {
            oldAddress: this.maskAddress(oldAddress),
            newAddress: this.maskAddress(newAddress),
            timestamp: now.toISOString(),
            ip: 'unknown', // Would be passed from request
            userAgent: 'unknown' // Would be passed from request
        };

        history.push(change);
        this.logSecurityEvent('wallet_changed', change);
    }

    /**
     * Validate wallet change request
     */
    validateWalletChange(oldAddress, newAddress, userId = 'default', ip = '', userAgent = '') {
        const validation = {
            allowed: true,
            reason: '',
            requiresConfirmation: false
        };

        // Check if new address is valid
        const addressValidation = this.validateWalletAddress(newAddress);
        if (!addressValidation.isValid) {
            validation.allowed = false;
            validation.reason = 'Invalid wallet address format';
            return validation;
        }

        // Check whitelist if enabled
        if (this.config.enableWhitelist && !this.whitelistedAddresses.has(newAddress)) {
            validation.allowed = false;
            validation.reason = 'Address not in whitelist';
            return validation;
        }

        // Check for suspicious activity
        if (this.detectSuspiciousWalletActivity(oldAddress, newAddress, ip, userAgent)) {
            validation.allowed = false;
            validation.reason = 'Suspicious activity detected';
            return validation;
        }

        // Check if confirmation required
        if (this.config.requireConfirmation) {
            validation.requiresConfirmation = true;
        }

        return validation;
    }

    /**
     * Detect suspicious wallet activity
     */
    detectSuspiciousWalletActivity(oldAddress, newAddress, ip, userAgent) {
        // Check for rapid changes
        const now = new Date();
        const recentChanges = this.suspiciousActivities.filter(activity => 
            now - new Date(activity.timestamp).getTime() < 300000 // 5 minutes
        );

        if (recentChanges.length > 5) {
            return true;
        }

        // Check for unusual patterns
        if (oldAddress && newAddress && oldAddress === newAddress) {
            return true; // Same address change
        }

        // Check for testnet to mainnet changes
        if (this.isTestnetAddress(oldAddress) && !this.isTestnetAddress(newAddress)) {
            return true;
        }

        return false;
    }

    /**
     * Add address to whitelist
     */
    addToWhitelist(address) {
        if (this.validateWalletAddress(address).isValid) {
            this.whitelistedAddresses.add(address);
            this.logSecurityEvent('address_whitelisted', { address: this.maskAddress(address) });
            return true;
        }
        return false;
    }

    /**
     * Remove address from whitelist
     */
    removeFromWhitelist(address) {
        if (this.whitelistedAddresses.has(address)) {
            this.whitelistedAddresses.delete(address);
            this.logSecurityEvent('address_unwhitelisted', { address: this.maskAddress(address) });
            return true;
        }
        return false;
    }

    /**
     * Load whitelist from file
     */
    loadWhitelist() {
        // This would load from a secure file
        // For now, initialize as empty
    }

    /**
     * Save whitelist to file
     */
    saveWhitelist() {
        // This would save to a secure file
        // For now, just log
        this.logSecurityEvent('whitelist_saved', { 
            count: this.whitelistedAddresses.size 
        });
    }

    /**
     * Get wallet security status
     */
    getSecurityStatus() {
        return {
            encryptedWallets: this.encryptedWallets.size,
            whitelistedAddresses: this.whitelistedAddresses.size,
            recentChanges: Array.from(this.walletHistory.values())
                .flat()
                .slice(-10),
            config: {
                maxWalletChanges: this.config.maxWalletChanges,
                requireConfirmation: this.config.requireConfirmation,
                enableWhitelist: this.config.enableWhitelist
            },
            suspiciousActivities: this.suspiciousActivities.slice(-10)
        };
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
        console.log(`🔐 Wallet Security: ${type}`, data);
    }

    /**
     * Get event severity
     */
    getEventSeverity(type) {
        const severityMap = {
            'wallet_encrypted': 'info',
            'wallet_decrypted': 'info',
            'wallet_changed': 'high',
            'wallet_change_limit_exceeded': 'critical',
            'suspicious_wallet_activity': 'critical',
            'address_whitelisted': 'info',
            'address_unwhitelisted': 'info'
        };

        return severityMap[type] || 'info';
    }

    /**
     * Cleanup old data
     */
    cleanup() {
        const now = new Date();
        const dayAgo = now - 24 * 60 * 60 * 1000;

        // Cleanup old suspicious activities
        this.suspiciousActivities = this.suspiciousActivities.filter(activity => 
            new Date(activity.timestamp).getTime() > dayAgo
        );

        // Cleanup old wallet history (keep last 30 days)
        const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
        for (const [userId, history] of this.walletHistory) {
            const recentHistory = history.filter(change => 
                new Date(change.timestamp).getTime() > monthAgo
            );
            this.walletHistory.set(userId, recentHistory);
        }
    }

    /**
     * Start security monitoring
     */
    startMonitoring() {
        // Cleanup every hour
        setInterval(() => {
            this.cleanup();
        }, 60 * 60 * 1000);

        console.log('🔐 Wallet security monitoring started');
    }
}

module.exports = WalletSecurity;
