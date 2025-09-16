const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');

/**
 * Database Manager for Bitcoin Mining Suite
 * Handles persistent storage of wallet data, earnings, and mining statistics
 */
class DatabaseManager extends EventEmitter {
    constructor() {
        super();
        this.db = null;
        this.dbPath = path.join(__dirname, '../../data/mining_data.db');
        this.initializeDatabase();
    }

    /**
     * Initialize database and create tables
     */
    initializeDatabase() {
        try {
            // Ensure data directory exists
            const dataDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            // Create database connection
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Database connection failed:', err.message);
                    this.emit('error', err);
                } else {
                    console.log('✅ Connected to SQLite database');
                    this.createTables();
                }
            });

            // Enable foreign keys
            this.db.run('PRAGMA foreign_keys = ON');
            
        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            this.emit('error', error);
        }
    }

    /**
     * Create database tables
     */
    createTables() {
        const tables = [
            // Wallet configuration table
            `CREATE TABLE IF NOT EXISTS wallets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                address TEXT UNIQUE NOT NULL,
                type TEXT NOT NULL,
                worker_name TEXT NOT NULL,
                pool_name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT 1
            )`,

            // Earnings tracking table
            `CREATE TABLE IF NOT EXISTS earnings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                wallet_id INTEGER,
                amount REAL NOT NULL,
                currency TEXT DEFAULT 'BTC',
                type TEXT DEFAULT 'mining',
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                session_id TEXT,
                FOREIGN KEY (wallet_id) REFERENCES wallets (id)
            )`,

            // Mining statistics table
            `CREATE TABLE IF NOT EXISTS mining_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                hashrate REAL NOT NULL,
                shares_accepted INTEGER DEFAULT 0,
                shares_rejected INTEGER DEFAULT 0,
                shares_total INTEGER DEFAULT 0,
                uptime_seconds INTEGER DEFAULT 0,
                cpu_usage REAL DEFAULT 0,
                gpu_usage REAL DEFAULT 0,
                temperature REAL DEFAULT 0,
                power_consumption REAL DEFAULT 0,
                network_latency REAL DEFAULT 0,
                session_id TEXT
            )`,

            // Client connections table
            `CREATE TABLE IF NOT EXISTS clients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id TEXT UNIQUE NOT NULL,
                hostname TEXT NOT NULL,
                platform TEXT NOT NULL,
                ip_address TEXT,
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT 1,
                mining_status TEXT DEFAULT 'stopped',
                hashrate REAL DEFAULT 0
            )`,

            // Security events table
            `CREATE TABLE IF NOT EXISTS security_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                severity TEXT NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                details TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Configuration table
            `CREATE TABLE IF NOT EXISTS config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT NOT NULL,
                type TEXT DEFAULT 'string',
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        tables.forEach((sql, index) => {
            this.db.run(sql, (err) => {
                if (err) {
                    console.error(`❌ Failed to create table ${index + 1}:`, err.message);
                } else {
                    console.log(`✅ Table ${index + 1} ready`);
                }
            });
        });

        // Create indexes for better performance
        this.createIndexes();
    }

    /**
     * Create database indexes
     */
    createIndexes() {
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_earnings_timestamp ON earnings(timestamp)',
            'CREATE INDEX IF NOT EXISTS idx_earnings_wallet_id ON earnings(wallet_id)',
            'CREATE INDEX IF NOT EXISTS idx_mining_stats_timestamp ON mining_stats(timestamp)',
            'CREATE INDEX IF NOT EXISTS idx_clients_last_seen ON clients(last_seen)',
            'CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp)'
        ];

        indexes.forEach(sql => {
            this.db.run(sql, (err) => {
                if (err) {
                    console.error('❌ Failed to create index:', err.message);
                }
            });
        });
    }

    /**
     * Save wallet configuration
     */
    saveWalletConfig(walletData) {
        return new Promise((resolve, reject) => {
            const { address, type, workerName, poolName } = walletData;
            
            const sql = `
                INSERT OR REPLACE INTO wallets (address, type, worker_name, pool_name, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;
            
            this.db.run(sql, [address, type, workerName, poolName], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, address });
                }
            });
        });
    }

    /**
     * Get wallet configuration
     */
    getWalletConfig() {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM wallets WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1';
            
            this.db.get(sql, [], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * Save earnings record
     */
    saveEarnings(earningsData) {
        return new Promise((resolve, reject) => {
            const { walletId, amount, currency = 'BTC', type = 'mining', sessionId } = earningsData;
            
            const sql = `
                INSERT INTO earnings (wallet_id, amount, currency, type, session_id)
                VALUES (?, ?, ?, ?, ?)
            `;
            
            this.db.run(sql, [walletId, amount, currency, type, sessionId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID });
                }
            });
        });
    }

    /**
     * Get earnings summary
     */
    getEarningsSummary(walletId = null) {
        return new Promise((resolve, reject) => {
            let sql = `
                SELECT 
                    SUM(amount) as total_earnings,
                    COUNT(*) as total_transactions,
                    MIN(timestamp) as first_earning,
                    MAX(timestamp) as last_earning
                FROM earnings
            `;
            
            const params = [];
            if (walletId) {
                sql += ' WHERE wallet_id = ?';
                params.push(walletId);
            }
            
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * Save mining statistics
     */
    saveMiningStats(statsData) {
        return new Promise((resolve, reject) => {
            const {
                hashrate, sharesAccepted, sharesRejected, sharesTotal,
                uptimeSeconds, cpuUsage, gpuUsage, temperature,
                powerConsumption, networkLatency, sessionId
            } = statsData;
            
            const sql = `
                INSERT INTO mining_stats (
                    hashrate, shares_accepted, shares_rejected, shares_total,
                    uptime_seconds, cpu_usage, gpu_usage, temperature,
                    power_consumption, network_latency, session_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            this.db.run(sql, [
                hashrate, sharesAccepted, sharesRejected, sharesTotal,
                uptimeSeconds, cpuUsage, gpuUsage, temperature,
                powerConsumption, networkLatency, sessionId
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID });
                }
            });
        });
    }

    /**
     * Get mining statistics history
     */
    getMiningStatsHistory(hours = 24) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM mining_stats 
                WHERE timestamp >= datetime('now', '-${hours} hours')
                ORDER BY timestamp DESC
            `;
            
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * Save client connection
     */
    saveClient(clientData) {
        return new Promise((resolve, reject) => {
            const { clientId, hostname, platform, ipAddress, miningStatus, hashrate } = clientData;
            
            const sql = `
                INSERT OR REPLACE INTO clients (
                    client_id, hostname, platform, ip_address, 
                    last_seen, is_active, mining_status, hashrate
                ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 1, ?, ?)
            `;
            
            this.db.run(sql, [clientId, hostname, platform, ipAddress, miningStatus, hashrate], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID });
                }
            });
        });
    }

    /**
     * Get active clients
     */
    getActiveClients() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM clients 
                WHERE is_active = 1 
                AND last_seen >= datetime('now', '-5 minutes')
                ORDER BY last_seen DESC
            `;
            
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * Save security event
     */
    saveSecurityEvent(eventData) {
        return new Promise((resolve, reject) => {
            const { eventType, severity, ipAddress, userAgent, details } = eventData;
            
            const sql = `
                INSERT INTO security_events (event_type, severity, ip_address, user_agent, details)
                VALUES (?, ?, ?, ?, ?)
            `;
            
            this.db.run(sql, [eventType, severity, ipAddress, userAgent, details], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID });
                }
            });
        });
    }

    /**
     * Save configuration setting
     */
    saveConfig(key, value, type = 'string') {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT OR REPLACE INTO config (key, value, type, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `;
            
            this.db.run(sql, [key, value, type], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID });
                }
            });
        });
    }

    /**
     * Get configuration setting
     */
    getConfig(key) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT value, type FROM config WHERE key = ?';
            
            this.db.get(sql, [key], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * Get database statistics
     */
    getDatabaseStats() {
        return new Promise((resolve, reject) => {
            const queries = [
                'SELECT COUNT(*) as count FROM wallets',
                'SELECT COUNT(*) as count FROM earnings',
                'SELECT COUNT(*) as count FROM mining_stats',
                'SELECT COUNT(*) as count FROM clients',
                'SELECT COUNT(*) as count FROM security_events'
            ];

            Promise.all(queries.map(sql => 
                new Promise((resolve, reject) => {
                    this.db.get(sql, [], (err, row) => {
                        if (err) reject(err);
                        else resolve(row.count);
                    });
                })
            )).then(counts => {
                resolve({
                    wallets: counts[0],
                    earnings: counts[1],
                    miningStats: counts[2],
                    clients: counts[3],
                    securityEvents: counts[4]
                });
            }).catch(reject);
        });
    }

    /**
     * Backup database
     */
    backupDatabase(backupPath = null) {
        if (!backupPath) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            backupPath = path.join(__dirname, `../../backups/mining_backup_${timestamp}.db`);
        }

        return new Promise((resolve, reject) => {
            // Ensure backup directory exists
            const backupDir = path.dirname(backupPath);
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }

            // Copy database file
            fs.copyFile(this.dbPath, backupPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(backupPath);
                }
            });
        });
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('❌ Error closing database:', err.message);
                } else {
                    console.log('✅ Database connection closed');
                }
            });
        }
    }
}

module.exports = DatabaseManager;
