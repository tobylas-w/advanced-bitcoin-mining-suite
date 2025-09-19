#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

class ProfitabilityManager {
    constructor() {
        this.algorithms = {
            // CPU algorithms
            'monero': {
                name: 'Monero (XMR)',
                algorithm: 'RandomX',
                cpuMiner: 'xmrig',
                pool: 'stratum+tcp://pool.supportxmr.com:443',
                wallet: '48jewbtxe4jU3MnzJjYK8CgEZM7vWk5j2J9f4gF7k8mN3pQ6rT9vW2yZ5aB8cE1hK4nP7sU0xY3',
                difficulty: 300000000000,
                reward: 0.6,
                profitability: 0
            },
            'bitcoin': {
                name: 'Bitcoin (BTC)',
                algorithm: 'SHA256',
                cpuMiner: 'minerd',
                pool: 'stratum+tcp://btc.ss.poolin.com:443',
                wallet: 'bc1qz2zqqgdz7whfmmkpcthn5gkv4ew4dfjs6fyeat',
                difficulty: 70000000000000,
                reward: 3.125,
                profitability: 0
            },
            
            // GPU algorithms
            'ethereum': {
                name: 'Ethereum (ETH)',
                algorithm: 'Ethash',
                gpuMiner: 'lolMiner',
                pool: 'stratum+tcp://eth.poolin.com:4444',
                wallet: '0x1234567890123456789012345678901234567890',
                difficulty: 15000000,
                reward: 2.0,
                profitability: 0
            },
            'ethereum-classic': {
                name: 'Ethereum Classic (ETC)',
                algorithm: 'Etchash',
                gpuMiner: 'lolMiner',
                pool: 'stratum+tcp://etc.poolin.com:4444',
                wallet: '0x1234567890123456789012345678901234567890',
                difficulty: 5000000,
                reward: 3.2,
                profitability: 0
            },
            'ravencoin': {
                name: 'Ravencoin (RVN)',
                algorithm: 'KawPow',
                gpuMiner: 'lolMiner',
                pool: 'stratum+tcp://rvn.poolin.com:4444',
                wallet: 'R9f9V4r2j8M1N7cB3kL6pQ9sT2vW5yZ8',
                difficulty: 8000000,
                reward: 5000,
                profitability: 0
            }
        };
        
        this.currentAlgorithm = 'bitcoin'; // Default to Bitcoin
        this.priceData = {};
        this.lastUpdate = 0;
        this.updateInterval = 300000; // 5 minutes
    }

    async fetchPrices() {
        try {
            console.log('💰 Fetching cryptocurrency prices...');
            
            // Fetch prices from CoinGecko API
            const coins = ['bitcoin', 'monero', 'ethereum', 'ethereum-classic', 'ravencoin'];
            const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coins.join(',')}&vs_currencies=usd`;
            
            const data = await this.makeRequest(url);
            this.priceData = data;
            
            console.log('💰 Prices updated:', Object.keys(data).length, 'coins');
            return data;
        } catch (error) {
            console.log('⚠️  Failed to fetch prices, using cached data');
            return this.priceData;
        }
    }

    async makeRequest(url) {
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });
    }

    calculateProfitability(algorithm, hashrate, powerConsumption = 100) {
        const algo = this.algorithms[algorithm];
        if (!algo) return 0;

        const priceData = this.priceData[algorithm.replace('-', '-')] || { usd: 0 };
        const price = priceData.usd || 0;
        
        if (price === 0) return 0;

        // Calculate daily revenue
        const dailyBlocks = (86400 * hashrate) / algo.difficulty;
        const dailyReward = dailyBlocks * algo.reward;
        const dailyRevenue = dailyReward * price;

        // Calculate daily costs (assuming $0.10/kWh)
        const dailyPowerCost = (powerConsumption / 1000) * 24 * 0.10;

        // Calculate profitability
        const profitability = dailyRevenue - dailyPowerCost;
        
        return {
            algorithm: algorithm,
            name: algo.name,
            hashrate: hashrate,
            dailyRevenue: dailyRevenue,
            dailyCost: dailyPowerCost,
            profitability: profitability,
            roi: profitability > 0 ? (profitability / dailyPowerCost) * 100 : 0
        };
    }

    async findMostProfitableAlgorithm(cpuHashrate = 100, gpuHashrate = 1000) {
        await this.fetchPrices();
        
        const results = [];
        
        // Test CPU algorithms
        const cpuAlgorithms = ['monero', 'bitcoin'];
        for (const algo of cpuAlgorithms) {
            const result = this.calculateProfitability(algo, cpuHashrate, 85);
            results.push(result);
        }
        
        // Test GPU algorithms
        const gpuAlgorithms = ['ethereum', 'ethereum-classic', 'ravencoin'];
        for (const algo of gpuAlgorithms) {
            const result = this.calculateProfitability(algo, gpuHashrate, 150);
            results.push(result);
        }
        
        // Sort by profitability
        results.sort((a, b) => b.profitability - a.profitability);
        
        return results;
    }

    async shouldSwitchAlgorithm(currentAlgorithm, currentHashrate) {
        const results = await this.findMostProfitableAlgorithm(currentHashrate, currentHashrate * 10);
        const mostProfitable = results[0];
        
        if (mostProfitable && mostProfitable.profitability > 0.1) { // $0.10 minimum profit
            if (mostProfitable.algorithm !== currentAlgorithm) {
                console.log(`🔄 Algorithm switch recommended: ${currentAlgorithm} → ${mostProfitable.algorithm}`);
                console.log(`💰 Expected profit increase: $${mostProfitable.profitability.toFixed(2)}/day`);
                return mostProfitable.algorithm;
            }
        }
        
        return null;
    }

    getAlgorithmConfig(algorithm) {
        return this.algorithms[algorithm] || null;
    }

    async updateProfitability() {
        const now = Date.now();
        if (now - this.lastUpdate < this.updateInterval) {
            return; // Don't update too frequently
        }

        try {
            await this.fetchPrices();
            this.lastUpdate = now;
            
            // Log current profitability
            const results = await this.findMostProfitableAlgorithm();
            console.log('💰 Current profitability ranking:');
            results.slice(0, 3).forEach((result, index) => {
                console.log(`   ${index + 1}. ${result.name}: $${result.profitability.toFixed(2)}/day`);
            });
            
        } catch (error) {
            console.log('⚠️  Failed to update profitability:', error.message);
        }
    }

    // Save profitability data to file
    saveProfitabilityData(data) {
        const dataPath = path.join(__dirname, 'profitability-data.json');
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    }

    // Load profitability data from file
    loadProfitabilityData() {
        const dataPath = path.join(__dirname, 'profitability-data.json');
        if (fs.existsSync(dataPath)) {
            try {
                return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
            } catch (error) {
                console.log('⚠️  Failed to load profitability data:', error.message);
            }
        }
        return null;
    }
}

module.exports = ProfitabilityManager;

