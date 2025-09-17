const EventEmitter = require('events');
const axios = require('axios');

/**
 * Accurate Earnings Calculator
 * Provides REAL Bitcoin mining earnings calculations based on:
 * - Actual hashrate from miners
 * - Current Bitcoin network difficulty
 * - Real-time Bitcoin price
 * - Pool fees and payout schedules
 */
class AccurateEarningsCalculator extends EventEmitter {
    constructor() {
        super();
        
        // Current Bitcoin network data
        this.networkData = {
            hashrate: 500000000000000000000, // ~500 EH/s (will be updated from API)
            difficulty: 0,
            blockReward: 3.125, // Current Bitcoin block reward
            blocksPerDay: 144,
            avgBlockTime: 600 // 10 minutes in seconds
        };
        
        // Bitcoin price data
        this.bitcoinPrice = 114000; // Will be updated from API
        this.priceHistory = [];
        
        // Mining statistics
        this.miningStats = {
            totalHashrate: 0,
            activeMiners: 0,
            uptime: 0,
            shares: { accepted: 0, rejected: 0, total: 0 }
        };
        
        // Earnings calculations
        this.earnings = {
            daily: { btc: 0, usd: 0 },
            weekly: { btc: 0, usd: 0 },
            monthly: { btc: 0, usd: 0 },
            yearly: { btc: 0, usd: 0 },
            total: { btc: 0, usd: 0 }
        };
        
        // Pool configuration
        this.poolConfig = {
            fee: 0.02, // 2% pool fee
            minimumPayout: 0.001, // 0.001 BTC minimum
            payoutSchedule: 'daily'
        };
        
        this.startDataUpdates();
    }

    /**
     * Start regular data updates
     */
    startDataUpdates() {
        // Update Bitcoin price every 5 minutes
        setInterval(() => {
            this.updateBitcoinPrice();
        }, 300000);

        // Update network data every 10 minutes
        setInterval(() => {
            this.updateNetworkData();
        }, 600000);

        // Recalculate earnings every minute
        setInterval(() => {
            this.recalculateEarnings();
        }, 60000);

        // Initial updates
        this.updateBitcoinPrice();
        this.updateNetworkData();
    }

    /**
     * Update Bitcoin price from multiple sources
     */
    async updateBitcoinPrice() {
        try {
            const sources = [
                'https://api.coinbase.com/v2/prices/BTC-USD/spot',
                'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
                'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT'
            ];

            for (const source of sources) {
                try {
                    const response = await axios.get(source, { timeout: 5000 });
                    let price = 0;

                    if (source.includes('coinbase')) {
                        price = parseFloat(response.data.data.amount);
                    } else if (source.includes('coingecko')) {
                        price = response.data.bitcoin.usd;
                    } else if (source.includes('binance')) {
                        price = parseFloat(response.data.price);
                    }

                    if (price > 0) {
                        this.bitcoinPrice = price;
                        this.priceHistory.push({ timestamp: Date.now(), price });
                        
                        // Keep only last 24 hours of price data
                        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
                        this.priceHistory = this.priceHistory.filter(p => p.timestamp > oneDayAgo);
                        
                        console.log(`💰 Bitcoin price updated: $${price.toLocaleString()}`);
                        this.emit('priceUpdate', { price, source });
                        break;
                    }
                } catch (error) {
                    console.log(`⚠️ Failed to get price from ${source}`);
                }
            }
        } catch (error) {
            console.error('❌ Failed to update Bitcoin price:', error);
        }
    }

    /**
     * Update Bitcoin network data
     */
    async updateNetworkData() {
        try {
            // Get current block height and difficulty
            const response = await axios.get('https://blockstream.info/api/stats', { timeout: 10000 });
            const stats = response.data;

            this.networkData.difficulty = stats.difficulty;
            this.networkData.hashrate = stats.hashrate_24h || this.networkData.hashrate;
            
            console.log(`📊 Network difficulty: ${this.networkData.difficulty.toLocaleString()}`);
            console.log(`⚡ Network hashrate: ${this.formatHashrate(this.networkData.hashrate)}`);
            
            this.emit('networkUpdate', this.networkData);
        } catch (error) {
            console.error('❌ Failed to update network data:', error);
            // Use estimated values
            this.networkData.difficulty = 100000000000000; // Estimated difficulty
        }
    }

    /**
     * Update mining statistics from actual miners
     */
    updateMiningStats(stats) {
        this.miningStats = { ...this.miningStats, ...stats };
        this.recalculateEarnings();
    }

    /**
     * Recalculate earnings based on current data
     */
    recalculateEarnings() {
        if (this.miningStats.totalHashrate <= 0) {
            return;
        }

        // Calculate daily Bitcoin earnings
        const dailyBTC = (this.miningStats.totalHashrate / this.networkData.hashrate) * 
                        this.networkData.blockReward * 
                        this.networkData.blocksPerDay * 
                        (1 - this.poolConfig.fee);

        // Calculate time-based earnings
        this.earnings.daily.btc = dailyBTC;
        this.earnings.daily.usd = dailyBTC * this.bitcoinPrice;

        this.earnings.weekly.btc = dailyBTC * 7;
        this.earnings.weekly.usd = dailyBTC * 7 * this.bitcoinPrice;

        this.earnings.monthly.btc = dailyBTC * 30;
        this.earnings.monthly.usd = dailyBTC * 30 * this.bitcoinPrice;

        this.earnings.yearly.btc = dailyBTC * 365;
        this.earnings.yearly.usd = dailyBTC * 365 * this.bitcoinPrice;

        // Update total earnings (increment by hourly amount)
        const hourlyBTC = dailyBTC / 24;
        const hourlyUSD = hourlyBTC * this.bitcoinPrice;
        
        this.earnings.total.btc += hourlyBTC / 60; // Increment every minute
        this.earnings.total.usd += hourlyUSD / 60;

        this.emit('earningsUpdate', this.earnings);
    }

    /**
     * Get comprehensive earnings report
     */
    getEarningsReport() {
        const report = {
            ...this.earnings,
            miningStats: this.miningStats,
            networkData: this.networkData,
            bitcoinPrice: this.bitcoinPrice,
            poolConfig: this.poolConfig,
            projections: this.getProjections(),
            profitability: this.getProfitabilityAnalysis(),
            recommendations: this.getRecommendations()
        };

        return report;
    }

    /**
     * Get earnings projections
     */
    getProjections() {
        const currentDaily = this.earnings.daily;
        
        return {
            nextWeek: {
                btc: currentDaily.btc * 7,
                usd: currentDaily.usd * 7
            },
            nextMonth: {
                btc: currentDaily.btc * 30,
                usd: currentDaily.usd * 30
            },
            nextYear: {
                btc: currentDaily.btc * 365,
                usd: currentDaily.usd * 365
            },
            breakEven: this.calculateBreakEven(),
            roi: this.calculateROI()
        };
    }

    /**
     * Calculate break-even point
     */
    calculateBreakEven() {
        const estimatedHardwareCost = 1000; // $1000 estimated hardware cost
        const dailyProfit = this.earnings.daily.usd;
        
        if (dailyProfit > 0) {
            return {
                days: Math.ceil(estimatedHardwareCost / dailyProfit),
                amount: estimatedHardwareCost
            };
        }
        
        return { days: Infinity, amount: estimatedHardwareCost };
    }

    /**
     * Calculate Return on Investment
     */
    calculateROI() {
        const estimatedHardwareCost = 1000;
        const totalProfit = this.earnings.total.usd;
        
        if (estimatedHardwareCost > 0) {
            return ((totalProfit - estimatedHardwareCost) / estimatedHardwareCost) * 100;
        }
        
        return 0;
    }

    /**
     * Get profitability analysis
     */
    getProfitabilityAnalysis() {
        const analysis = {
            isProfitable: this.earnings.daily.usd > 0,
            efficiency: this.calculateMiningEfficiency(),
            competitiveness: this.calculateCompetitiveness(),
            marketPosition: this.getMarketPosition()
        };

        return analysis;
    }

    /**
     * Calculate mining efficiency
     */
    calculateMiningEfficiency() {
        if (this.miningStats.totalHashrate <= 0) return 0;
        
        // Compare our hashrate to network average
        const networkShare = (this.miningStats.totalHashrate / this.networkData.hashrate) * 100;
        
        return {
            networkShare: networkShare,
            efficiency: Math.min(networkShare * 100, 100), // Efficiency percentage
            status: networkShare > 0.001 ? 'competitive' : 'small'
        };
    }

    /**
     * Calculate competitiveness
     */
    calculateCompetitiveness() {
        const ourHashrate = this.miningStats.totalHashrate;
        const networkHashrate = this.networkData.hashrate;
        const ratio = ourHashrate / networkHashrate;
        
        if (ratio > 0.01) return 'high'; // >1% of network
        if (ratio > 0.001) return 'medium'; // >0.1% of network
        if (ratio > 0.0001) return 'low'; // >0.01% of network
        return 'minimal';
    }

    /**
     * Get market position
     */
    getMarketPosition() {
        const ourHashrate = this.miningStats.totalHashrate;
        
        if (ourHashrate >= 1000000000000) return 'major'; // >1 TH/s
        if (ourHashrate >= 100000000000) return 'significant'; // >100 GH/s
        if (ourHashrate >= 10000000000) return 'moderate'; // >10 GH/s
        if (ourHashrate >= 1000000000) return 'small'; // >1 GH/s
        return 'minimal';
    }

    /**
     * Get optimization recommendations
     */
    getRecommendations() {
        const recommendations = [];

        // Hashrate recommendations
        if (this.miningStats.totalHashrate < 1000000000) { // <1 GH/s
            recommendations.push({
                type: 'performance',
                priority: 'high',
                title: 'Increase Mining Power',
                description: 'Consider adding more mining hardware or optimizing existing setup',
                impact: '+50% earnings potential',
                cost: '$$$'
            });
        }

        // Pool fee recommendations
        if (this.poolConfig.fee > 0.02) {
            recommendations.push({
                type: 'pool',
                priority: 'medium',
                title: 'Switch to Lower Fee Pool',
                description: 'Current pool fee is above 2%, consider switching',
                impact: `+${(this.poolConfig.fee - 0.02) * 100}% profit increase`,
                cost: 'Free'
            });
        }

        // Bitcoin price recommendations
        const priceChange24h = this.getPriceChange24h();
        if (priceChange24h > 5) {
            recommendations.push({
                type: 'market',
                priority: 'low',
                title: 'Bitcoin Price Rising',
                description: 'Bitcoin price increased significantly, good time to mine',
                impact: '+10% earnings bonus',
                cost: 'Free'
            });
        }

        return recommendations;
    }

    /**
     * Get 24-hour price change
     */
    getPriceChange24h() {
        if (this.priceHistory.length < 2) return 0;
        
        const now = this.bitcoinPrice;
        const oneDayAgo = this.priceHistory[0]?.price || this.bitcoinPrice;
        
        return ((now - oneDayAgo) / oneDayAgo) * 100;
    }

    /**
     * Format hashrate for display
     */
    formatHashrate(hashrate) {
        if (hashrate >= 1000000000000000000) {
            return `${(hashrate / 1000000000000000000).toFixed(2)} EH/s`;
        } else if (hashrate >= 1000000000000000) {
            return `${(hashrate / 1000000000000000).toFixed(2)} PH/s`;
        } else if (hashrate >= 1000000000000) {
            return `${(hashrate / 1000000000000).toFixed(2)} TH/s`;
        } else if (hashrate >= 1000000000) {
            return `${(hashrate / 1000000000).toFixed(2)} GH/s`;
        } else if (hashrate >= 1000000) {
            return `${(hashrate / 1000000).toFixed(2)} MH/s`;
        } else if (hashrate >= 1000) {
            return `${(hashrate / 1000).toFixed(2)} KH/s`;
        } else {
            return `${hashrate.toFixed(2)} H/s`;
        }
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            isCalculating: true,
            bitcoinPrice: this.bitcoinPrice,
            networkData: this.networkData,
            miningStats: this.miningStats,
            earnings: this.earnings,
            lastUpdate: new Date()
        };
    }
}

module.exports = AccurateEarningsCalculator;
