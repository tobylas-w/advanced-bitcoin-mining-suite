#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class AutoScalingManager {
    constructor() {
        this.config = {
            electricityCost: 0.10, // $0.10 per kWh (default)
            maxPowerConsumption: 200, // Watts
            minProfitabilityThreshold: 0.05, // $0.05/day minimum profit
            scalingFactors: {
                cpu: {
                    min: 1,
                    max: 16,
                    step: 1
                },
                gpu: {
                    min: 1,
                    max: 8,
                    step: 1
                },
                intensity: {
                    min: 10,
                    max: 100,
                    step: 10
                }
            },
            powerProfiles: {
                idle: 50,      // Watts when idle
                light: 100,    // Watts for light mining
                medium: 150,   // Watts for medium mining
                heavy: 200,    // Watts for heavy mining
                max: 250       // Watts for maximum mining
            }
        };
        
        this.currentProfile = 'medium';
        this.lastScalingDecision = 0;
        this.scalingCooldown = 300000; // 5 minutes between scaling decisions
        this.profitabilityHistory = [];
        this.powerHistory = [];
    }

    // Calculate power consumption based on current settings
    calculatePowerConsumption(cpuThreads, gpuThreads, intensity) {
        const basePower = this.config.powerProfiles.idle;
        const cpuPower = cpuThreads * 8; // ~8W per CPU thread
        const gpuPower = gpuThreads * 25; // ~25W per GPU thread
        const intensityFactor = intensity / 100;
        
        const totalPower = basePower + (cpuPower + gpuPower) * intensityFactor;
        return Math.min(totalPower, this.config.maxPowerConsumption);
    }

    // Calculate profitability including electricity costs
    calculateNetProfitability(grossProfit, powerConsumption, hours = 24) {
        const electricityCost = (powerConsumption / 1000) * hours * this.config.electricityCost;
        const netProfit = grossProfit - electricityCost;
        const roi = grossProfit > 0 ? (netProfit / grossProfit) * 100 : 0;
        
        return {
            grossProfit: grossProfit,
            electricityCost: electricityCost,
            netProfit: netProfit,
            roi: roi,
            isProfitable: netProfit > this.config.minProfitabilityThreshold
        };
    }

    // Determine optimal scaling based on profitability
    determineOptimalScaling(currentStats, targetProfitability = 1.0) {
        const { cpuThreads, gpuThreads, intensity, hashrate } = currentStats;
        
        // Test different scaling scenarios
        const scenarios = [];
        
        // Test different intensity levels
        for (let newIntensity = this.config.scalingFactors.intensity.min; 
             newIntensity <= this.config.scalingFactors.intensity.max; 
             newIntensity += this.config.scalingFactors.intensity.step) {
            
            // Test different CPU thread counts
            for (let newCpuThreads = this.config.scalingFactors.cpu.min; 
                 newCpuThreads <= Math.min(this.config.scalingFactors.cpu.max, cpuThreads * 2); 
                 newCpuThreads += this.config.scalingFactors.cpu.step) {
                
                // Test different GPU thread counts
                for (let newGpuThreads = this.config.scalingFactors.gpu.min; 
                     newGpuThreads <= Math.min(this.config.scalingFactors.gpu.max, gpuThreads * 2); 
                     newGpuThreads += this.config.scalingFactors.gpu.step) {
                    
                    const powerConsumption = this.calculatePowerConsumption(
                        newCpuThreads, newGpuThreads, newIntensity
                    );
                    
                    // Estimate hashrate based on scaling
                    const estimatedHashrate = hashrate * (newIntensity / intensity) * 
                                           ((newCpuThreads + newGpuThreads) / (cpuThreads + gpuThreads));
                    
                    // Estimate gross profit (simplified calculation)
                    const estimatedGrossProfit = estimatedHashrate * 0.0001; // Simplified profit calculation
                    
                    const profitability = this.calculateNetProfitability(
                        estimatedGrossProfit, powerConsumption
                    );
                    
                    scenarios.push({
                        cpuThreads: newCpuThreads,
                        gpuThreads: newGpuThreads,
                        intensity: newIntensity,
                        powerConsumption: powerConsumption,
                        estimatedHashrate: estimatedHashrate,
                        profitability: profitability,
                        efficiency: profitability.netProfit / powerConsumption // Profit per watt
                    });
                }
            }
        }
        
        // Sort by efficiency and profitability
        scenarios.sort((a, b) => {
            if (a.profitability.isProfitable && !b.profitability.isProfitable) return -1;
            if (!a.profitability.isProfitable && b.profitability.isProfitable) return 1;
            return b.efficiency - a.efficiency;
        });
        
        return scenarios[0]; // Return most efficient scenario
    }

    // Make scaling decision based on current conditions
    async makeScalingDecision(miningManager) {
        const now = Date.now();
        if (now - this.lastScalingDecision < this.scalingCooldown) {
            return null; // Still in cooldown
        }

        try {
            const stats = miningManager.getStats();
            const intensity = miningManager.getIntensity();
            
            const currentStats = {
                cpuThreads: intensity.cpu,
                gpuThreads: intensity.gpu,
                intensity: intensity.overall,
                hashrate: stats.hashrate,
                power: stats.power || this.calculatePowerConsumption(intensity.cpu, intensity.gpu, intensity.overall)
            };
            
            // Calculate current profitability
            const currentProfitability = this.calculateNetProfitability(
                stats.hashrate * 0.0001, // Simplified gross profit calculation
                currentStats.power
            );
            
            // Store profitability history
            this.profitabilityHistory.push({
                timestamp: now,
                profitability: currentProfitability,
                stats: currentStats
            });
            
            // Keep only last 24 hours of history
            const oneDayAgo = now - (24 * 60 * 60 * 1000);
            this.profitabilityHistory = this.profitabilityHistory.filter(h => h.timestamp > oneDayAgo);
            
            // Determine if scaling is needed
            let scalingDecision = null;
            
            if (!currentProfitability.isProfitable) {
                // Not profitable - scale down
                scalingDecision = this.determineOptimalScaling(currentStats, 0.1); // Target minimal profit
                console.log('📉 Mining not profitable, scaling down...');
            } else if (currentProfitability.roi > 200) {
                // Very profitable - scale up
                scalingDecision = this.determineOptimalScaling(currentStats, 2.0); // Target 2x profit
                console.log('📈 Mining highly profitable, scaling up...');
            } else if (currentProfitability.roi < 50) {
                // Low profitability - optimize
                scalingDecision = this.determineOptimalScaling(currentStats, 1.0);
                console.log('⚖️  Low profitability, optimizing...');
            }
            
            if (scalingDecision && this.shouldApplyScaling(scalingDecision, currentStats)) {
                await this.applyScaling(miningManager, scalingDecision);
                this.lastScalingDecision = now;
                return scalingDecision;
            }
            
        } catch (error) {
            console.log('⚠️  Auto-scaling decision failed:', error.message);
        }
        
        return null;
    }

    // Determine if scaling should be applied
    shouldApplyScaling(newSettings, currentSettings) {
        const cpuChange = Math.abs(newSettings.cpuThreads - currentSettings.cpuThreads);
        const gpuChange = Math.abs(newSettings.gpuThreads - currentSettings.gpuThreads);
        const intensityChange = Math.abs(newSettings.intensity - currentSettings.intensity);
        
        // Only apply if there's a significant change
        return cpuChange > 0 || gpuChange > 0 || intensityChange > 5;
    }

    // Apply scaling settings
    async applyScaling(miningManager, scalingDecision) {
        try {
            console.log('🔧 Applying auto-scaling...');
            console.log(`   CPU threads: ${scalingDecision.cpuThreads}`);
            console.log(`   GPU threads: ${scalingDecision.gpuThreads}`);
            console.log(`   Intensity: ${scalingDecision.intensity}%`);
            console.log(`   Expected power: ${scalingDecision.powerConsumption}W`);
            console.log(`   Expected profit: $${scalingDecision.profitability.netProfit.toFixed(2)}/day`);
            
            // Update intensity settings
            const newIntensity = {
                cpu: scalingDecision.cpuThreads,
                gpu: scalingDecision.gpuThreads,
                overall: scalingDecision.intensity
            };
            
            miningManager.setIntensity(newIntensity.cpu, newIntensity.gpu, newIntensity.overall);
            
            // Update power profile
            if (scalingDecision.powerConsumption < 100) {
                this.currentProfile = 'light';
            } else if (scalingDecision.powerConsumption < 150) {
                this.currentProfile = 'medium';
            } else if (scalingDecision.powerConsumption < 200) {
                this.currentProfile = 'heavy';
            } else {
                this.currentProfile = 'max';
            }
            
            console.log(`✅ Auto-scaling applied (${this.currentProfile} profile)`);
            
            // Save scaling history
            this.saveScalingHistory(scalingDecision);
            
        } catch (error) {
            console.log('❌ Failed to apply auto-scaling:', error.message);
        }
    }

    // Save scaling history for analysis
    saveScalingHistory(scalingDecision) {
        const historyPath = path.join(__dirname, 'scaling-history.json');
        const history = this.loadScalingHistory();
        
        history.push({
            timestamp: Date.now(),
            decision: scalingDecision,
            profile: this.currentProfile
        });
        
        // Keep only last 30 days
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const recentHistory = history.filter(h => h.timestamp > thirtyDaysAgo);
        
        fs.writeFileSync(historyPath, JSON.stringify(recentHistory, null, 2));
    }

    // Load scaling history
    loadScalingHistory() {
        const historyPath = path.join(__dirname, 'scaling-history.json');
        if (fs.existsSync(historyPath)) {
            try {
                return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
            } catch (error) {
                console.log('⚠️  Failed to load scaling history:', error.message);
            }
        }
        return [];
    }

    // Update electricity cost
    updateElectricityCost(newCost) {
        this.config.electricityCost = newCost;
        console.log(`💰 Electricity cost updated to $${newCost}/kWh`);
    }

    // Get current configuration
    getConfig() {
        return this.config;
    }

    // Get scaling statistics
    getScalingStats() {
        const history = this.loadScalingHistory();
        const recentHistory = history.slice(-24); // Last 24 scaling decisions
        
        if (recentHistory.length === 0) {
            return {
                totalScalingEvents: 0,
                averagePowerConsumption: 0,
                averageProfitability: 0,
                currentProfile: this.currentProfile
            };
        }
        
        const totalPower = recentHistory.reduce((sum, h) => sum + h.decision.powerConsumption, 0);
        const totalProfit = recentHistory.reduce((sum, h) => sum + h.decision.profitability.netProfit, 0);
        
        return {
            totalScalingEvents: history.length,
            recentScalingEvents: recentHistory.length,
            averagePowerConsumption: totalPower / recentHistory.length,
            averageProfitability: totalProfit / recentHistory.length,
            currentProfile: this.currentProfile,
            lastScalingDecision: this.lastScalingDecision
        };
    }
}

module.exports = AutoScalingManager;

