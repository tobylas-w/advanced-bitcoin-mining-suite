const axios = require('axios');

class ProfitabilityCalculator {
    constructor() {
        this.bitcoinPrice = 0;
        this.networkDifficulty = 0;
        this.blockReward = 6.25; // Current Bitcoin block reward
        this.blocksPerDay = 144; // 6 blocks per hour * 24 hours
        this.lastUpdate = 0;
        this.updateInterval = 300000; // 5 minutes
        this.earningsHistory = [];
        
        this.updateBitcoinData();
    }

    /**
     * Get current Bitcoin price
     */
    async getBitcoinPrice() {
        try {
            const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
            this.bitcoinPrice = response.data.bitcoin.usd;
            return { price: this.bitcoinPrice };
        } catch (error) {
            console.error('Failed to fetch Bitcoin price:', error);
            // Fallback to cached price or default
            return { price: this.bitcoinPrice || 50000 };
        }
    }

    /**
     * Get current network difficulty
     */
    async getNetworkDifficulty() {
        try {
            const response = await axios.get('https://blockstream.info/api/stats');
            this.networkDifficulty = response.data.difficulty;
            return this.networkDifficulty;
        } catch (error) {
            console.error('Failed to fetch network difficulty:', error);
            // Fallback to estimated difficulty - current Bitcoin difficulty is around 95 trillion
            return this.networkDifficulty || 95000000000000;
        }
    }

    /**
     * Calculate mining profitability for given hashrate
     */
    async calculateProfitability(userHashrate = 0) {
        const now = Date.now();
        
        // Update data if needed
        if (now - this.lastUpdate > this.updateInterval) {
            await this.updateBitcoinData();
        }
        
        const btcPerDay = this.calculateBTCPerDay(userHashrate);
        const usdPerDay = btcPerDay * this.bitcoinPrice;
        
        return {
            hashrate: userHashrate,
            btcPerDay: btcPerDay,
            usdPerDay: usdPerDay,
            btcPerHour: btcPerDay / 24,
            usdPerHour: usdPerDay / 24,
            btcPerMonth: btcPerDay * 30,
            usdPerMonth: usdPerDay * 30,
            bitcoinPrice: this.bitcoinPrice,
            networkDifficulty: this.networkDifficulty,
            blockReward: this.blockReward,
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Calculate BTC earned per day for given hashrate
     */
    calculateBTCPerDay(hashrate) {
        if (hashrate === 0) return 0;
        
        // Formula: (Hashrate / Network Difficulty) * Block Reward * Blocks Per Day
        const dailyBTC = (hashrate / this.networkDifficulty) * this.blockReward * this.blocksPerDay;
        return Math.max(0, dailyBTC);
    }

    /**
     * Calculate power consumption costs
     */
    calculatePowerCosts(powerConsumptionWatts, electricityCostPerKWh = 0.12) {
        const dailyKWh = (powerConsumptionWatts * 24) / 1000;
        const dailyCost = dailyKWh * electricityCostPerKWh;
        
        return {
            powerWatts: powerConsumptionWatts,
            dailyKWh: dailyKWh,
            dailyCost: dailyCost,
            monthlyCost: dailyCost * 30,
            yearlyCost: dailyCost * 365,
            costPerKWh: electricityCostPerKWh
        };
    }

    /**
     * Calculate net profit (earnings - costs)
     */
    async calculateNetProfit(hashrate, powerConsumptionWatts, electricityCostPerKWh = 0.12) {
        const profitability = await this.calculateProfitability(hashrate);
        const powerCosts = this.calculatePowerCosts(powerConsumptionWatts, electricityCostPerKWh);
        
        const netDaily = profitability.usdPerDay - powerCosts.dailyCost;
        const netMonthly = profitability.usdPerMonth - powerCosts.monthlyCost;
        
        return {
            grossEarnings: profitability,
            powerCosts: powerCosts,
            netDaily: netDaily,
            netMonthly: netMonthly,
            profitMargin: profitability.usdPerDay > 0 ? (netDaily / profitability.usdPerDay) * 100 : 0,
            roi: this.calculateROI(profitability.usdPerMonth, powerCosts.monthlyCost)
        };
    }

    /**
     * Calculate Return on Investment
     */
    calculateROI(monthlyEarnings, monthlyCosts) {
        if (monthlyCosts === 0) return monthlyEarnings > 0 ? 100 : 0;
        return ((monthlyEarnings - monthlyCosts) / monthlyCosts) * 100;
    }

    /**
     * Get optimal mining settings based on profitability
     */
    async getOptimalSettings(currentHashrate, currentPowerConsumption) {
        const profitability = await this.calculateNetProfit(currentHashrate, currentPowerConsumption);
        
        const recommendations = [];
        
        // Hashrate recommendations
        if (profitability.netDaily < 0) {
            recommendations.push({
                type: 'warning',
                message: 'Current mining is unprofitable. Consider stopping or optimizing.',
                action: 'Consider reducing mining intensity or stopping during high electricity cost periods.'
            });
        }
        
        // Temperature optimization
        if (currentHashrate > 0) {
            const efficiency = currentHashrate / currentPowerConsumption;
            if (efficiency < 1000) { // Less than 1 H/s per watt
                recommendations.push({
                    type: 'info',
                    message: 'Low mining efficiency detected.',
                    action: 'Consider optimizing cooling or reducing overclocking to improve efficiency.'
                });
            }
        }
        
        // Time-based optimization
        const hourlyEarnings = profitability.grossEarnings.usdPerHour;
        if (hourlyEarnings < 0.01) {
            recommendations.push({
                type: 'suggestion',
                message: 'Very low hourly earnings.',
                action: 'Consider mining only during off-peak electricity hours for better profitability.'
            });
        }
        
        return {
            currentProfitability: profitability,
            recommendations: recommendations,
            optimalSettings: {
                miningIntensity: profitability.netDaily > 0 ? 8 : 3,
                cpuMining: profitability.netDaily > 0.1,
                gpuMining: profitability.netDaily > 0.5,
                temperatureThreshold: 75 // Conservative for efficiency
            }
        };
    }

    /**
     * Update Bitcoin data from APIs
     */
    async updateBitcoinData() {
        try {
            await Promise.all([
                this.getBitcoinPrice(),
                this.getNetworkDifficulty()
            ]);
            this.lastUpdate = Date.now();
            console.log(`📊 Updated Bitcoin data - Price: $${this.bitcoinPrice}, Difficulty: ${this.networkDifficulty}`);
        } catch (error) {
            console.error('Failed to update Bitcoin data:', error);
        }
    }

    /**
     * Get earnings history
     */
    getEarningsHistory() {
        return this.earningsHistory;
    }

    /**
     * Add earnings record
     */
    addEarningsRecord(hashrate, earnings, timestamp = Date.now()) {
        this.earningsHistory.push({
            timestamp: timestamp,
            hashrate: hashrate,
            btcEarnings: earnings.btc,
            usdEarnings: earnings.usd,
            bitcoinPrice: this.bitcoinPrice
        });
        
        // Keep only last 1000 records
        if (this.earningsHistory.length > 1000) {
            this.earningsHistory = this.earningsHistory.slice(-1000);
        }
    }

    /**
     * Get mining pool recommendations
     */
    getPoolRecommendations() {
        return [
            {
                name: 'F2Pool',
                url: 'stratum+tcp://btc.f2pool.com:3333',
                fee: 2.5,
                payout: 'PPS',
                description: 'Low fees, reliable payouts'
            },
            {
                name: 'Antpool',
                url: 'stratum+tcp://stratum-btc.antpool.com:3333',
                fee: 4.0,
                payout: 'PPS+',
                description: 'Large pool, stable performance'
            },
            {
                name: 'ViaBTC',
                url: 'stratum+tcp://btc.viabtc.com:3333',
                fee: 4.0,
                payout: 'PPS+',
                description: 'Good for small miners'
            },
            {
                name: 'Slush Pool',
                url: 'stratum+tcp://stratum.slushpool.com:3333',
                fee: 2.0,
                payout: 'Score',
                description: 'Original mining pool, low fees'
            }
        ];
    }

    /**
     * Calculate break-even hashrate
     */
    calculateBreakEvenHashrate(electricityCostPerKWh = 0.12, powerConsumptionWatts = 200) {
        const dailyCost = (powerConsumptionWatts * 24 * electricityCostPerKWh) / 1000;
        const requiredDailyBTC = dailyCost / this.bitcoinPrice;
        
        if (requiredDailyBTC <= 0) return 0;
        
        // Calculate required hashrate to break even
        const requiredHashrate = (requiredDailyBTC * this.networkDifficulty) / (this.blockReward * this.blocksPerDay);
        
        return {
            requiredHashrate: requiredHashrate,
            requiredDailyBTC: requiredDailyBTC,
            dailyCost: dailyCost,
            powerConsumption: powerConsumptionWatts,
            electricityCost: electricityCostPerKWh
        };
    }

    /**
     * Get mining difficulty trend
     */
    async getDifficultyTrend() {
        try {
            // This would typically fetch historical difficulty data
            // For now, we'll return a simplified trend
            return {
                current: this.networkDifficulty,
                trend: 'stable', // 'increasing', 'decreasing', 'stable'
                nextAdjustment: this.estimateNextDifficultyAdjustment(),
                averageChange: 0.05 // 5% average change
            };
        } catch (error) {
            console.error('Failed to get difficulty trend:', error);
            return null;
        }
    }

    /**
     * Estimate next difficulty adjustment
     */
    estimateNextDifficultyAdjustment() {
        // Simplified estimation - in reality this would use historical data
        const currentTime = Date.now();
        const blockTime = 10 * 60 * 1000; // 10 minutes in milliseconds
        const blocksUntilAdjustment = 2016; // Bitcoin adjusts every 2016 blocks
        const estimatedTime = currentTime + (blocksUntilAdjustment * blockTime);
        
        return new Date(estimatedTime);
    }
}

module.exports = ProfitabilityCalculator;
