const EventEmitter = require('events');

/**
 * Bitcoin Wallet Integration Configuration
 * Handles wallet connection, address validation, and earnings tracking
 */
class WalletConfig extends EventEmitter {
    constructor() {
        super();
        this.wallet = {
            address: '',
            type: '', // 'legacy', 'segwit', 'bech32'
            isValid: false,
            balance: 0,
            pending: 0,
            totalEarned: 0
        };
        
        this.pools = {
            default: {
                name: 'Default Pool',
                url: 'stratum+tcp://pool.bitcoin.com:3333',
                user: '', // Will be set to wallet address
                pass: '', // Worker name
                algo: 'sha256'
            },
            f2pool: {
                name: 'F2Pool',
                url: 'stratum+tcp://btc.f2pool.com:3333',
                user: '',
                pass: '',
                algo: 'sha256'
            },
            antpool: {
                name: 'Antpool',
                url: 'stratum+tcp://btc.ss.poolin.com:443',
                user: '',
                pass: '',
                algo: 'sha256'
            }
        };
        
        this.earnings = {
            currentSession: 0,
            today: 0,
            thisWeek: 0,
            thisMonth: 0,
            total: 0,
            lastUpdate: null
        };
    }

    /**
     * Set wallet address and validate it
     */
    setWalletAddress(address, workerName = 'worker') {
        this.wallet.address = address.trim();
        this.wallet.isValid = this.validateBitcoinAddress(this.wallet.address);
        this.wallet.type = this.getAddressType(this.wallet.address);
        
        // Update pool configurations with wallet address
        Object.keys(this.pools).forEach(poolKey => {
            this.pools[poolKey].user = this.wallet.address;
            this.pools[poolKey].pass = workerName;
        });
        
        this.emit('walletUpdated', {
            address: this.wallet.address,
            type: this.wallet.type,
            isValid: this.wallet.isValid
        });
        
        return this.wallet.isValid;
    }

    /**
     * Validate Bitcoin address format
     */
    validateBitcoinAddress(address) {
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
     * Determine Bitcoin address type
     */
    getAddressType(address) {
        if (!this.validateBitcoinAddress(address)) {
            return 'invalid';
        }

        if (address.startsWith('1')) {
            return 'legacy';
        } else if (address.startsWith('3')) {
            return 'segwit';
        } else if (address.startsWith('bc1')) {
            return 'bech32';
        }

        return 'unknown';
    }

    /**
     * Get recommended pool based on address type
     */
    getRecommendedPool() {
        const recommendations = {
            'legacy': 'default',
            'segwit': 'f2pool',
            'bech32': 'antpool'
        };

        const recommended = recommendations[this.wallet.type] || 'default';
        return {
            pool: this.pools[recommended],
            reason: `Optimized for ${this.wallet.type} addresses`
        };
    }

    /**
     * Update earnings tracking
     */
    updateEarnings(amount, type = 'mining') {
        const now = new Date();
        
        this.earnings.currentSession += amount;
        this.earnings.total += amount;
        this.earnings.lastUpdate = now;
        
        // Update time-based earnings
        this.updateTimeBasedEarnings(amount, now);
        
        this.emit('earningsUpdated', {
            amount,
            type,
            total: this.earnings.total,
            session: this.earnings.currentSession,
            timestamp: now
        });
    }

    /**
     * Update time-based earnings
     */
    updateTimeBasedEarnings(amount, date) {
        const today = new Date().toDateString();
        const weekStart = this.getWeekStart(date);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        
        // Reset daily earnings if new day
        if (this.earnings.lastUpdate && 
            this.earnings.lastUpdate.toDateString() !== today) {
            this.earnings.today = 0;
        }
        
        // Reset weekly earnings if new week
        if (this.earnings.lastUpdate && 
            this.getWeekStart(this.earnings.lastUpdate).getTime() !== weekStart.getTime()) {
            this.earnings.thisWeek = 0;
        }
        
        // Reset monthly earnings if new month
        if (this.earnings.lastUpdate && 
            this.earnings.lastUpdate.getMonth() !== date.getMonth()) {
            this.earnings.thisMonth = 0;
        }
        
        this.earnings.today += amount;
        this.earnings.thisWeek += amount;
        this.earnings.thisMonth += amount;
    }

    /**
     * Get start of week (Monday)
     */
    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        return new Date(d.setDate(diff));
    }

    /**
     * Get wallet configuration for mining
     */
    getMiningConfig() {
        if (!this.wallet.isValid) {
            throw new Error('Invalid wallet address');
        }

        const recommended = this.getRecommendedPool();
        
        return {
            wallet: {
                address: this.wallet.address,
                type: this.wallet.type,
                isValid: this.wallet.isValid
            },
            pool: recommended.pool,
            worker: {
                name: recommended.pool.pass,
                password: recommended.pool.pass
            },
            earnings: this.earnings
        };
    }

    /**
     * Get earnings summary
     */
    getEarningsSummary() {
        return {
            currentSession: this.earnings.currentSession,
            today: this.earnings.today,
            thisWeek: this.earnings.thisWeek,
            thisMonth: this.earnings.thisMonth,
            total: this.earnings.total,
            lastUpdate: this.earnings.lastUpdate,
            wallet: {
                address: this.wallet.address,
                type: this.wallet.type,
                isValid: this.wallet.isValid
            }
        };
    }

    /**
     * Reset earnings (for new session)
     */
    resetSessionEarnings() {
        this.earnings.currentSession = 0;
        this.emit('sessionReset');
    }

    /**
     * Get wallet status
     */
    getWalletStatus() {
        return {
            configured: this.wallet.isValid,
            address: this.wallet.address,
            type: this.wallet.type,
            balance: this.wallet.balance,
            pending: this.wallet.pending,
            totalEarned: this.earnings.total
        };
    }

    /**
     * Create wallet configuration for deployment
     */
    createDeploymentConfig() {
        return {
            wallet: {
                address: this.wallet.address,
                type: this.wallet.type
            },
            pool: this.getRecommendedPool().pool,
            mining: {
                algorithm: 'sha256',
                intensity: 'auto',
                threads: 'auto'
            }
        };
    }
}

module.exports = WalletConfig;
