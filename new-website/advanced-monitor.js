#!/usr/bin/env node

const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class AdvancedMonitor {
    constructor() {
        this.metrics = {
            power: {
                current: 0,
                average: 0,
                peak: 0,
                history: []
            },
            efficiency: {
                hashratePerWatt: 0,
                profitPerWatt: 0,
                thermalEfficiency: 0,
                history: []
            },
            system: {
                cpu: {
                    usage: 0,
                    temperature: 0,
                    frequency: 0,
                    cores: 0
                },
                gpu: {
                    usage: 0,
                    temperature: 0,
                    memory: {
                        used: 0,
                        total: 0
                    },
                    power: 0
                },
                memory: {
                    used: 0,
                    total: 0,
                    swap: 0
                },
                disk: {
                    usage: 0,
                    io: {
                        read: 0,
                        write: 0
                    }
                },
                network: {
                    rx: 0,
                    tx: 0,
                    latency: 0
                }
            },
            mining: {
                hashrate: 0,
                shares: {
                    accepted: 0,
                    rejected: 0
                },
                uptime: 0,
                efficiency: 0
            }
        };
        
        this.alerts = [];
        this.thresholds = {
            temperature: {
                cpu: 80,
                gpu: 85
            },
            power: {
                max: 250,
                warning: 200
            },
            efficiency: {
                minHashratePerWatt: 0.1,
                minProfitPerWatt: 0.001
            }
        };
        
        this.monitoringInterval = 10000; // 10 seconds
        this.historyLimit = 360; // 1 hour of data (10-second intervals)
        this.isMonitoring = false;
    }

    // Start advanced monitoring
    startMonitoring() {
        if (this.isMonitoring) {
            console.log('⚠️  Advanced monitoring already running');
            return;
        }

        console.log('🔍 Starting advanced system monitoring...');
        this.isMonitoring = true;
        
        // Initial metrics collection
        this.collectMetrics();
        
        // Set up monitoring interval
        this.monitoringTimer = setInterval(() => {
            this.collectMetrics();
            this.analyzeMetrics();
            this.checkAlerts();
        }, this.monitoringInterval);
        
        console.log('✅ Advanced monitoring started');
    }

    // Stop advanced monitoring
    stopMonitoring() {
        if (!this.isMonitoring) {
            console.log('⚠️  Advanced monitoring not running');
            return;
        }

        console.log('🛑 Stopping advanced system monitoring...');
        this.isMonitoring = false;
        
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
            this.monitoringTimer = null;
        }
        
        console.log('✅ Advanced monitoring stopped');
    }

    // Collect comprehensive system metrics
    async collectMetrics() {
        try {
            await Promise.all([
                this.collectPowerMetrics(),
                this.collectSystemMetrics(),
                this.collectMiningMetrics(),
                this.collectEfficiencyMetrics()
            ]);
            
            // Store metrics history
            this.storeMetricsHistory();
            
        } catch (error) {
            console.log('⚠️  Error collecting metrics:', error.message);
        }
    }

    // Collect power consumption metrics
    async collectPowerMetrics() {
        try {
            // Try to get power consumption from various sources
            let powerConsumption = 0;
            
            // Method 1: Try RAPL (Intel/AMD power monitoring)
            try {
                const raplPower = await this.getRAPLPower();
                if (raplPower > 0) {
                    powerConsumption += raplPower;
                }
            } catch (e) {
                // RAPL not available
            }
            
            // Method 2: Try nvidia-smi for GPU power
            try {
                const gpuPower = await this.getGPUPower();
                if (gpuPower > 0) {
                    powerConsumption += gpuPower;
                }
            } catch (e) {
                // nvidia-smi not available
            }
            
            // Method 3: Estimate based on CPU/GPU usage
            if (powerConsumption === 0) {
                powerConsumption = await this.estimatePowerConsumption();
            }
            
            this.metrics.power.current = powerConsumption;
            this.updatePowerHistory(powerConsumption);
            
        } catch (error) {
            console.log('⚠️  Error collecting power metrics:', error.message);
        }
    }

    // Get RAPL power consumption
    async getRAPLPower() {
        return new Promise((resolve, reject) => {
            exec('cat /sys/class/powercap/intel-rapl:0/energy_uj 2>/dev/null', (error, stdout) => {
                if (error) {
                    reject(error);
                    return;
                }
                
                const energyUj = parseInt(stdout.trim());
                if (energyUj > 0) {
                    // Convert from microjoules to watts (simplified calculation)
                    resolve(energyUj / 1000000); // Rough conversion
                } else {
                    reject(new Error('Invalid RAPL data'));
                }
            });
        });
    }

    // Get GPU power consumption
    async getGPUPower() {
        return new Promise((resolve, reject) => {
            exec('nvidia-smi --query-gpu=power.draw --format=csv,noheader,nounits 2>/dev/null', (error, stdout) => {
                if (error) {
                    reject(error);
                    return;
                }
                
                const powerDraw = parseFloat(stdout.trim());
                if (!isNaN(powerDraw) && powerDraw > 0) {
                    resolve(powerDraw);
                } else {
                    reject(new Error('Invalid GPU power data'));
                }
            });
        });
    }

    // Estimate power consumption based on system usage
    async estimatePowerConsumption() {
        try {
            const cpuUsage = await this.getCPUUsage();
            const gpuUsage = await this.getGPUUsage();
            
            // Base power consumption
            let basePower = 50; // Idle power
            
            // CPU power (roughly 10W per 100% usage)
            basePower += (cpuUsage / 100) * 80;
            
            // GPU power (roughly 150W for full usage)
            basePower += (gpuUsage / 100) * 150;
            
            return Math.min(basePower, this.thresholds.power.max);
        } catch (error) {
            return 100; // Default estimate
        }
    }

    // Collect system metrics
    async collectSystemMetrics() {
        try {
            // CPU metrics
            this.metrics.system.cpu.usage = await this.getCPUUsage();
            this.metrics.system.cpu.temperature = await this.getCPUTemperature();
            this.metrics.system.cpu.frequency = await this.getCPUFrequency();
            this.metrics.system.cpu.cores = os.cpus().length;
            
            // GPU metrics
            this.metrics.system.gpu.usage = await this.getGPUUsage();
            this.metrics.system.gpu.temperature = await this.getGPUTemperature();
            this.metrics.system.gpu.memory = await this.getGPUMemory();
            
            // Memory metrics
            this.metrics.system.memory = await this.getMemoryUsage();
            
            // Disk metrics
            this.metrics.system.disk = await this.getDiskUsage();
            
            // Network metrics
            this.metrics.system.network = await this.getNetworkStats();
            
        } catch (error) {
            console.log('⚠️  Error collecting system metrics:', error.message);
        }
    }

    // Get CPU usage
    async getCPUUsage() {
        return new Promise((resolve) => {
            exec('top -bn1 | grep "Cpu(s)" | awk \'{print $2}\' | cut -d\'%\' -f1', (error, stdout) => {
                if (error) {
                    resolve(0);
                    return;
                }
                const usage = parseFloat(stdout.trim()) || 0;
                resolve(usage);
            });
        });
    }

    // Get CPU temperature
    async getCPUTemperature() {
        return new Promise((resolve) => {
            exec('sensors 2>/dev/null | grep -E "Core 0|Package id 0" | awk \'{print $3}\' | cut -d\'+\' -f2 | cut -d\'°\' -f1 | head -1', (error, stdout) => {
                if (error) {
                    resolve(45); // Default temperature
                    return;
                }
                const temp = parseFloat(stdout.trim()) || 45;
                resolve(temp);
            });
        });
    }

    // Get CPU frequency
    async getCPUFrequency() {
        try {
            const freq = execSync('cat /proc/cpuinfo | grep "cpu MHz" | head -1 | awk \'{print $4}\'', { encoding: 'utf8' });
            return parseFloat(freq.trim()) || 0;
        } catch (error) {
            return 0;
        }
    }

    // Get GPU usage
    async getGPUUsage() {
        return new Promise((resolve) => {
            // Try nvidia-smi first
            exec('nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null', (error, stdout) => {
                if (error) {
                    // Try radeontop for AMD GPUs
                    exec('timeout 1 radeontop -d- -l1 2>/dev/null | grep -o "[0-9]*%" | head -1 | cut -d\'%\' -f1', (error2, stdout2) => {
                        if (error2) {
                            resolve(0);
                            return;
                        }
                        const usage = parseFloat(stdout2.trim()) || 0;
                        resolve(usage);
                    });
                    return;
                }
                const usage = parseFloat(stdout.trim()) || 0;
                resolve(usage);
            });
        });
    }

    // Get GPU temperature
    async getGPUTemperature() {
        return new Promise((resolve) => {
            // Try nvidia-smi first
            exec('nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits 2>/dev/null', (error, stdout) => {
                if (error) {
                    // Try sensors for AMD GPUs
                    exec('sensors 2>/dev/null | grep -i "radeon\|amd" | grep -o "[0-9]*°C" | head -1 | cut -d\'°\' -f1', (error2, stdout2) => {
                        if (error2) {
                            resolve(45); // Default temperature
                            return;
                        }
                        const temp = parseFloat(stdout2.trim()) || 45;
                        resolve(temp);
                    });
                    return;
                }
                const temp = parseFloat(stdout.trim()) || 45;
                resolve(temp);
            });
        });
    }

    // Get GPU memory usage
    async getGPUMemory() {
        return new Promise((resolve) => {
            exec('nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits 2>/dev/null', (error, stdout) => {
                if (error) {
                    resolve({ used: 0, total: 0 });
                    return;
                }
                const [used, total] = stdout.trim().split(', ').map(v => parseInt(v) || 0);
                resolve({ used, total });
            });
        });
    }

    // Get memory usage
    async getMemoryUsage() {
        return new Promise((resolve) => {
            exec('free -m | grep Mem', (error, stdout) => {
                if (error) {
                    resolve({ used: 0, total: 0, swap: 0 });
                    return;
                }
                const parts = stdout.trim().split(/\s+/);
                const used = parseInt(parts[2]) || 0;
                const total = parseInt(parts[1]) || 0;
                
                // Get swap usage
                exec('free -m | grep Swap', (error2, stdout2) => {
                    const swapParts = stdout2.trim().split(/\s+/);
                    const swap = parseInt(swapParts[2]) || 0;
                    resolve({ used, total, swap });
                });
            });
        });
    }

    // Get disk usage
    async getDiskUsage() {
        return new Promise((resolve) => {
            exec('df -h / | tail -1 | awk \'{print $5}\' | cut -d\'%\' -f1', (error, stdout) => {
                if (error) {
                    resolve({ usage: 0, io: { read: 0, write: 0 } });
                    return;
                }
                const usage = parseInt(stdout.trim()) || 0;
                
                // Get disk I/O stats
                exec('iostat -x 1 1 2>/dev/null | tail -1 | awk \'{print $4, $5}\'', (error2, stdout2) => {
                    if (error2) {
                        resolve({ usage, io: { read: 0, write: 0 } });
                        return;
                    }
                    const [read, write] = stdout2.trim().split(' ').map(v => parseFloat(v) || 0);
                    resolve({ usage, io: { read, write } });
                });
            });
        });
    }

    // Get network statistics
    async getNetworkStats() {
        return new Promise((resolve) => {
            exec('cat /proc/net/dev | grep eth0 | awk \'{print $2, $10}\'', (error, stdout) => {
                if (error) {
                    resolve({ rx: 0, tx: 0, latency: 0 });
                    return;
                }
                const [rx, tx] = stdout.trim().split(' ').map(v => parseInt(v) || 0);
                
                // Get network latency
                exec('ping -c 1 8.8.8.8 2>/dev/null | grep "time=" | cut -d\'=\' -f4 | cut -d\' \' -f1', (error2, stdout2) => {
                    const latency = parseFloat(stdout2.trim()) || 0;
                    resolve({ rx, tx, latency });
                });
            });
        });
    }

    // Collect mining metrics
    async collectMiningMetrics() {
        // This would be populated by the mining manager
        // For now, we'll use placeholder values
        this.metrics.mining.hashrate = 0;
        this.metrics.mining.shares = { accepted: 0, rejected: 0 };
        this.metrics.mining.uptime = 0;
        this.metrics.mining.efficiency = 0;
    }

    // Calculate efficiency metrics
    async collectEfficiencyMetrics() {
        const hashrate = this.metrics.mining.hashrate;
        const power = this.metrics.power.current;
        
        if (power > 0) {
            this.metrics.efficiency.hashratePerWatt = hashrate / power;
        }
        
        // Thermal efficiency (hashrate per degree Celsius)
        const avgTemp = (this.metrics.system.cpu.temperature + this.metrics.system.gpu.temperature) / 2;
        if (avgTemp > 0) {
            this.metrics.efficiency.thermalEfficiency = hashrate / avgTemp;
        }
        
        this.updateEfficiencyHistory();
    }

    // Update power consumption history
    updatePowerHistory(power) {
        this.metrics.power.history.push({
            timestamp: Date.now(),
            power: power
        });
        
        // Limit history size
        if (this.metrics.power.history.length > this.historyLimit) {
            this.metrics.power.history.shift();
        }
        
        // Calculate average and peak
        const recentPower = this.metrics.power.history.slice(-60); // Last 10 minutes
        this.metrics.power.average = recentPower.reduce((sum, h) => sum + h.power, 0) / recentPower.length;
        this.metrics.power.peak = Math.max(...this.metrics.power.history.map(h => h.power));
    }

    // Update efficiency history
    updateEfficiencyHistory() {
        this.metrics.efficiency.history.push({
            timestamp: Date.now(),
            hashratePerWatt: this.metrics.efficiency.hashratePerWatt,
            thermalEfficiency: this.metrics.efficiency.thermalEfficiency
        });
        
        // Limit history size
        if (this.metrics.efficiency.history.length > this.historyLimit) {
            this.metrics.efficiency.history.shift();
        }
    }

    // Store metrics history
    storeMetricsHistory() {
        const historyPath = path.join(__dirname, 'monitoring-history.json');
        const history = {
            timestamp: Date.now(),
            metrics: this.metrics
        };
        
        // Append to history file
        let existingHistory = [];
        if (fs.existsSync(historyPath)) {
            try {
                const data = fs.readFileSync(historyPath, 'utf8');
                existingHistory = JSON.parse(data);
            } catch (error) {
                console.log('⚠️  Error reading monitoring history:', error.message);
            }
        }
        
        existingHistory.push(history);
        
        // Keep only last 24 hours
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        const recentHistory = existingHistory.filter(h => h.timestamp > oneDayAgo);
        
        fs.writeFileSync(historyPath, JSON.stringify(recentHistory, null, 2));
    }

    // Analyze metrics for trends and anomalies
    analyzeMetrics() {
        // Analyze power consumption trends
        this.analyzePowerTrends();
        
        // Analyze efficiency trends
        this.analyzeEfficiencyTrends();
        
        // Analyze system health
        this.analyzeSystemHealth();
    }

    // Analyze power consumption trends
    analyzePowerTrends() {
        const recentPower = this.metrics.power.history.slice(-30); // Last 5 minutes
        if (recentPower.length < 10) return;
        
        // Check for power spikes
        const avgPower = recentPower.reduce((sum, h) => sum + h.power, 0) / recentPower.length;
        const maxPower = Math.max(...recentPower.map(h => h.power));
        
        if (maxPower > avgPower * 1.5) {
            this.addAlert('warning', 'Power spike detected', `Power increased from ${avgPower.toFixed(1)}W to ${maxPower.toFixed(1)}W`);
        }
        
        // Check for power efficiency degradation
        if (this.metrics.efficiency.hashratePerWatt < this.thresholds.efficiency.minHashratePerWatt) {
            this.addAlert('warning', 'Low mining efficiency', `Hashrate per watt: ${this.metrics.efficiency.hashratePerWatt.toFixed(3)}`);
        }
    }

    // Analyze efficiency trends
    analyzeEfficiencyTrends() {
        const recentEfficiency = this.metrics.efficiency.history.slice(-30);
        if (recentEfficiency.length < 10) return;
        
        // Check for efficiency degradation
        const avgEfficiency = recentEfficiency.reduce((sum, h) => sum + h.hashratePerWatt, 0) / recentEfficiency.length;
        const currentEfficiency = this.metrics.efficiency.hashratePerWatt;
        
        if (currentEfficiency < avgEfficiency * 0.8) {
            this.addAlert('warning', 'Mining efficiency degraded', `Efficiency dropped from ${avgEfficiency.toFixed(3)} to ${currentEfficiency.toFixed(3)}`);
        }
    }

    // Analyze system health
    analyzeSystemHealth() {
        // Check CPU temperature
        if (this.metrics.system.cpu.temperature > this.thresholds.temperature.cpu) {
            this.addAlert('critical', 'High CPU temperature', `${this.metrics.system.cpu.temperature}°C`);
        }
        
        // Check GPU temperature
        if (this.metrics.system.gpu.temperature > this.thresholds.temperature.gpu) {
            this.addAlert('critical', 'High GPU temperature', `${this.metrics.system.gpu.temperature}°C`);
        }
        
        // Check power consumption
        if (this.metrics.power.current > this.thresholds.power.warning) {
            this.addAlert('warning', 'High power consumption', `${this.metrics.power.current.toFixed(1)}W`);
        }
        
        // Check memory usage
        const memoryUsagePercent = (this.metrics.system.memory.used / this.metrics.system.memory.total) * 100;
        if (memoryUsagePercent > 90) {
            this.addAlert('warning', 'High memory usage', `${memoryUsagePercent.toFixed(1)}%`);
        }
    }

    // Check for alerts
    checkAlerts() {
        // Remove old alerts (older than 1 hour)
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        this.alerts = this.alerts.filter(alert => alert.timestamp > oneHourAgo);
        
        // Log new critical alerts
        const newCriticalAlerts = this.alerts.filter(alert => 
            alert.level === 'critical' && 
            alert.timestamp > Date.now() - 60000 // Last minute
        );
        
        newCriticalAlerts.forEach(alert => {
            console.log(`🚨 CRITICAL: ${alert.message} - ${alert.details}`);
        });
    }

    // Add alert
    addAlert(level, message, details) {
        const alert = {
            timestamp: Date.now(),
            level: level,
            message: message,
            details: details
        };
        
        // Avoid duplicate alerts
        const existingAlert = this.alerts.find(a => 
            a.message === message && 
            a.timestamp > Date.now() - 300000 // 5 minutes
        );
        
        if (!existingAlert) {
            this.alerts.push(alert);
            console.log(`⚠️  ${level.toUpperCase()}: ${message} - ${details}`);
        }
    }

    // Get current metrics
    getMetrics() {
        return this.metrics;
    }

    // Get alerts
    getAlerts() {
        return this.alerts;
    }

    // Get monitoring status
    getStatus() {
        return {
            isMonitoring: this.isMonitoring,
            metricsCount: Object.keys(this.metrics).length,
            alertsCount: this.alerts.length,
            historySize: this.metrics.power.history.length
        };
    }
}

module.exports = AdvancedMonitor;

