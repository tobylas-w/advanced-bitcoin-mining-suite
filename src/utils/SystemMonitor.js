const si = require('systeminformation');

class SystemMonitor {
    constructor() {
        this.systemInfo = null;
        this.lastUpdate = 0;
        this.updateInterval = 5000; // 5 seconds
        this.alerts = [];
    }

    /**
     * Get comprehensive system information
     */
    async getSystemInfo() {
        const now = Date.now();
        
        // Update system info if needed
        if (now - this.lastUpdate > this.updateInterval) {
            await this.updateSystemInfo();
        }
        
        return this.systemInfo;
    }

    /**
     * Update system information
     */
    async updateSystemInfo() {
        try {
            const [
                cpu,
                memory,
                graphics,
                cpuTemperature,
                disk,
                network,
                currentLoad,
                processes
            ] = await Promise.all([
                si.cpu(),
                si.mem(),
                si.graphics(),
                si.cpuTemperature(),
                si.diskLayout(),
                si.networkStats(),
                si.currentLoad(),
                si.processes()
            ]);

            this.systemInfo = {
                cpu: {
                    manufacturer: cpu.manufacturer,
                    brand: cpu.brand,
                    cores: cpu.cores,
                    physicalCores: cpu.physicalCores,
                    processors: cpu.processors,
                    speed: cpu.speed,
                    speedMin: cpu.speedMin,
                    speedMax: cpu.speedMax,
                    usage: Math.round(currentLoad.currentLoad),
                    temperature: cpuTemperature.main || 0,
                    temperatureMax: cpuTemperature.max || 0,
                    temperatureCores: cpuTemperature.cores || []
                },
                memory: {
                    total: memory.total,
                    free: memory.free,
                    used: memory.used,
                    available: memory.available,
                    usage: Math.round((memory.used / memory.total) * 100),
                    swap: memory.swap
                },
                gpu: {
                    controllers: graphics.controllers.map(controller => ({
                        name: controller.name,
                        model: controller.model,
                        vendor: controller.vendor,
                        vram: controller.vram,
                        temperatureGpu: controller.temperatureGpu,
                        temperatureMemory: controller.temperatureMemory,
                        fanSpeed: controller.fanSpeed,
                        utilizationGpu: controller.utilizationGpu,
                        utilizationMemory: controller.utilizationMemory,
                        powerDraw: controller.powerDraw,
                        memoryUsed: controller.memoryUsed,
                        memoryTotal: controller.memoryTotal
                    }))
                },
                disk: disk.map(d => ({
                    name: d.name,
                    type: d.type,
                    size: d.size,
                    interfaceType: d.interfaceType
                })),
                network: network.map(n => ({
                    iface: n.iface,
                    operstate: n.operstate,
                    rx_bytes: n.rx_bytes,
                    tx_bytes: n.tx_bytes,
                    rx_sec: n.rx_sec,
                    tx_sec: n.tx_sec
                })),
                processes: {
                    all: processes.all,
                    running: processes.running,
                    blocked: processes.blocked,
                    sleeping: processes.sleeping,
                    mining: this.findMiningProcesses(processes.list)
                },
                timestamp: new Date().toISOString()
            };

            this.lastUpdate = Date.now();
            this.checkSystemAlerts();

        } catch (error) {
            console.error('Failed to update system info:', error);
            throw error;
        }
    }

    /**
     * Find mining-related processes
     */
    findMiningProcesses(processes) {
        const miningKeywords = ['miner', 'bitcoin', 'crypto', 'hash', 'pool', 'stratum'];
        
        return processes.filter(process => {
            const name = process.name.toLowerCase();
            const command = (process.command || '').toLowerCase();
            
            return miningKeywords.some(keyword => 
                name.includes(keyword) || command.includes(keyword)
            );
        }).map(process => ({
            pid: process.pid,
            name: process.name,
            command: process.command,
            cpu: process.cpu,
            mem: process.mem,
            running: process.running
        }));
    }

    /**
     * Check for system alerts
     */
    checkSystemAlerts() {
        this.alerts = [];
        
        if (!this.systemInfo) return;

        // CPU temperature alert
        if (this.systemInfo.cpu.temperature > 85) {
            this.alerts.push({
                type: 'warning',
                component: 'CPU',
                message: `High CPU temperature: ${this.systemInfo.cpu.temperature}°C`,
                severity: 'high'
            });
        } else if (this.systemInfo.cpu.temperature > 75) {
            this.alerts.push({
                type: 'info',
                component: 'CPU',
                message: `Elevated CPU temperature: ${this.systemInfo.cpu.temperature}°C`,
                severity: 'medium'
            });
        }

        // Memory usage alert
        if (this.systemInfo.memory.usage > 90) {
            this.alerts.push({
                type: 'warning',
                component: 'Memory',
                message: `High memory usage: ${this.systemInfo.memory.usage}%`,
                severity: 'high'
            });
        }

        // GPU temperature alerts
        this.systemInfo.gpu.controllers.forEach((gpu, index) => {
            if (gpu.temperatureGpu > 85) {
                this.alerts.push({
                    type: 'warning',
                    component: `GPU ${index + 1}`,
                    message: `High GPU temperature: ${gpu.temperatureGpu}°C`,
                    severity: 'high'
                });
            } else if (gpu.temperatureGpu > 75) {
                this.alerts.push({
                    type: 'info',
                    component: `GPU ${index + 1}`,
                    message: `Elevated GPU temperature: ${gpu.temperatureGpu}°C`,
                    severity: 'medium'
                });
            }

            // GPU memory usage
            if (gpu.utilizationMemory > 95) {
                this.alerts.push({
                    type: 'warning',
                    component: `GPU ${index + 1}`,
                    message: `High GPU memory usage: ${gpu.utilizationMemory}%`,
                    severity: 'medium'
                });
            }
        });

        // CPU usage alert
        if (this.systemInfo.cpu.usage > 95) {
            this.alerts.push({
                type: 'info',
                component: 'CPU',
                message: `High CPU usage: ${this.systemInfo.cpu.usage}%`,
                severity: 'medium'
            });
        }
    }

    /**
     * Get system alerts
     */
    getAlerts() {
        return this.alerts;
    }

    /**
     * Get system performance metrics
     */
    async getPerformanceMetrics() {
        const systemInfo = await this.getSystemInfo();
        
        return {
            cpu: {
                usage: systemInfo.cpu.usage,
                temperature: systemInfo.cpu.temperature,
                cores: systemInfo.cpu.cores,
                speed: systemInfo.cpu.speed
            },
            memory: {
                usage: systemInfo.memory.usage,
                available: systemInfo.memory.available,
                total: systemInfo.memory.total
            },
            gpu: systemInfo.gpu.controllers.map(gpu => ({
                name: gpu.name,
                temperature: gpu.temperatureGpu,
                usage: gpu.utilizationGpu,
                memoryUsage: gpu.utilizationMemory,
                powerDraw: gpu.powerDraw
            })),
            alerts: this.alerts,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get optimal mining settings based on system capabilities
     */
    async getOptimalMiningSettings() {
        const systemInfo = await this.getSystemInfo();
        
        const settings = {
            cpu: {
                enabled: true,
                threads: Math.max(1, Math.floor(systemInfo.cpu.cores * 0.8)), // Use 80% of cores
                intensity: systemInfo.cpu.temperature < 70 ? 8 : 5, // Reduce intensity if hot
                priority: 'normal'
            },
            gpu: {
                enabled: systemInfo.gpu.controllers.length > 0,
                devices: systemInfo.gpu.controllers.map((_, index) => index),
                intensity: systemInfo.gpu.controllers.every(gpu => gpu.temperatureGpu < 75) ? 18 : 15,
                powerLimit: 100,
                memoryClock: 'auto',
                coreClock: 'auto'
            },
            monitoring: {
                temperatureThreshold: Math.min(85, this.getRecommendedTemperatureThreshold()),
                updateInterval: 5000
            }
        };

        return settings;
    }

    /**
     * Get recommended temperature threshold based on system
     */
    getRecommendedTemperatureThreshold() {
        if (!this.systemInfo) return 80;

        const cpuTemp = this.systemInfo.cpu.temperature;
        const gpuTemps = this.systemInfo.gpu.controllers.map(gpu => gpu.temperatureGpu);
        const maxTemp = Math.max(cpuTemp, ...gpuTemps);

        // Adjust threshold based on current temperatures
        if (maxTemp < 60) return 85; // Cool system, can run hotter
        if (maxTemp < 75) return 80; // Warm system, moderate threshold
        return 75; // Hot system, conservative threshold
    }

    /**
     * Check if system can handle mining
     */
    async canHandleMining() {
        const systemInfo = await this.getSystemInfo();
        
        const checks = {
            cpu: {
                passed: systemInfo.cpu.cores >= 2,
                message: systemInfo.cpu.cores >= 2 ? 'CPU suitable for mining' : 'Insufficient CPU cores'
            },
            memory: {
                passed: systemInfo.memory.total >= 2 * 1024 * 1024 * 1024, // 2GB minimum
                message: systemInfo.memory.total >= 2 * 1024 * 1024 * 1024 ? 'Sufficient memory' : 'Insufficient memory'
            },
            temperature: {
                passed: systemInfo.cpu.temperature < 90 && 
                       systemInfo.gpu.controllers.every(gpu => gpu.temperatureGpu < 90),
                message: 'System temperatures within safe limits'
            },
            gpu: {
                passed: systemInfo.gpu.controllers.length > 0,
                message: systemInfo.gpu.controllers.length > 0 ? 'GPU detected' : 'No GPU detected - CPU mining only'
            }
        };

        const overallPassed = Object.values(checks).every(check => check.passed);

        return {
            canMine: overallPassed,
            checks: checks,
            recommendations: this.getMiningRecommendations(systemInfo)
        };
    }

    /**
     * Get mining recommendations based on system
     */
    getMiningRecommendations(systemInfo) {
        const recommendations = [];

        // CPU recommendations
        if (systemInfo.cpu.cores < 4) {
            recommendations.push({
                type: 'warning',
                message: 'Limited CPU cores detected',
                suggestion: 'Consider using lower mining intensity or focus on GPU mining'
            });
        }

        // Memory recommendations
        if (systemInfo.memory.total < 4 * 1024 * 1024 * 1024) { // 4GB
            recommendations.push({
                type: 'info',
                message: 'Limited system memory',
                suggestion: 'Close unnecessary applications before mining'
            });
        }

        // Temperature recommendations
        if (systemInfo.cpu.temperature > 70) {
            recommendations.push({
                type: 'warning',
                message: 'System already warm',
                suggestion: 'Ensure proper cooling before starting mining'
            });
        }

        // GPU recommendations
        if (systemInfo.gpu.controllers.length === 0) {
            recommendations.push({
                type: 'info',
                message: 'No GPU detected',
                suggestion: 'CPU mining only - consider adding a GPU for better performance'
            });
        } else {
            const gpuCount = systemInfo.gpu.controllers.length;
            recommendations.push({
                type: 'success',
                message: `${gpuCount} GPU(s) detected`,
                suggestion: 'GPU mining recommended for better efficiency'
            });
        }

        return recommendations;
    }

    /**
     * Monitor system during mining
     */
    async startMiningMonitor(callback) {
        const monitorInterval = setInterval(async () => {
            try {
                const metrics = await this.getPerformanceMetrics();
                callback(metrics);
            } catch (error) {
                console.error('Mining monitor error:', error);
            }
        }, 5000);

        return () => clearInterval(monitorInterval);
    }

    /**
     * Get system efficiency score
     */
    async getEfficiencyScore() {
        const systemInfo = await this.getSystemInfo();
        
        let score = 100;

        // Temperature penalty
        if (systemInfo.cpu.temperature > 80) score -= 20;
        else if (systemInfo.cpu.temperature > 70) score -= 10;

        // Memory usage penalty
        if (systemInfo.memory.usage > 90) score -= 15;
        else if (systemInfo.memory.usage > 80) score -= 5;

        // CPU usage penalty (too high means inefficient)
        if (systemInfo.cpu.usage > 95) score -= 10;

        // GPU efficiency
        systemInfo.gpu.controllers.forEach(gpu => {
            if (gpu.temperatureGpu > 80) score -= 15;
            else if (gpu.temperatureGpu > 70) score -= 5;

            if (gpu.utilizationMemory > 95) score -= 5;
        });

        return Math.max(0, Math.min(100, score));
    }
}

module.exports = SystemMonitor;




