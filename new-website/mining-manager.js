#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ProfitabilityManager = require('./profitability-manager');
const AutoScalingManager = require('./auto-scaling-manager');
const AdvancedMonitor = require('./advanced-monitor');

class MiningManager {
    constructor() {
        this.miningProcess = null;
        this.gpuMiningProcess = null;
        this.isRunning = false;
        this.hashrate = 0;
        this.shares = { accepted: 0, rejected: 0 };
        this.uptime = 0;
        this.startTime = null;
        this.hashrateHistory = [];
        this.btcPrice = 0;
        this.thbRate = 0;
        this.remoteClients = [];
        this.serverIP = this.getServerIP();
        this.gpuInfo = null; // Cache GPU info to avoid repeated detection
        this.intensity = this.loadIntensity(); // Load intensity from storage
        this.currentPoolIndex = 0; // Current active pool index
        this.poolFailures = 0; // Track consecutive failures
        this.lastPoolSwitchTime = 0; // Prevent rapid switching
        this.profitabilityManager = new ProfitabilityManager(); // Initialize profitability manager
        this.autoScalingManager = new AutoScalingManager(); // Initialize auto-scaling manager
        this.advancedMonitor = new AdvancedMonitor(); // Initialize advanced monitoring
        this.currentAlgorithm = 'bitcoin'; // Current mining algorithm
        this.lastAlgorithmCheck = 0; // Last time we checked for algorithm switching
        this.lastScalingCheck = 0; // Last time we checked for auto-scaling
        this.optimizeThreads(); // Auto-optimize threads based on CPU cores
        this.startHealthMonitoring(); // Start health monitoring
        this.startProfitabilityMonitoring(); // Start profitability monitoring
        this.startAutoScalingMonitoring(); // Start auto-scaling monitoring
        this.startAdvancedMonitoring(); // Start advanced monitoring
        this.stats = {
            hashrate: 0,
            shares: { accepted: 0, rejected: 0 },
            uptime: 0,
            temperature: 0,
            power: 0,
            cpuUsage: 0,
            gpuUsage: 0,
            gpuTemperature: 0,
            earnings: {
                btc: { hourly: 0, daily: 0, weekly: 0, monthly: 0 },
                usd: { hourly: 0, daily: 0, weekly: 0, monthly: 0 },
                thb: { hourly: 0, daily: 0, weekly: 0, monthly: 0 }
            }
        };
        
        // Mining pools with failover support
        this.miningPools = [
            {
                name: 'Poolin',
                url: 'stratum+tcp://btc.ss.poolin.com:443',
                wallet: 'bc1qz2zqqgdz7whfmmkpcthn5gkv4ew4dfjs6fyeat',
                fee: 2.5,
                priority: 1
            },
            {
                name: 'F2Pool',
                url: 'stratum+tcp://btc.f2pool.com:3333',
                wallet: 'bc1qz2zqqgdz7whfmmkpcthn5gkv4ew4dfjs6fyeat',
                fee: 2.5,
                priority: 2
            },
            {
                name: 'Antpool',
                url: 'stratum+tcp://btc.antpool.com:3333',
                wallet: 'bc1qz2zqqgdz7whfmmkpcthn5gkv4ew4dfjs6fyeat',
                fee: 2.5,
                priority: 3
            },
            {
                name: 'SlushPool',
                url: 'stratum+tcp://btc.slushpool.com:4444',
                wallet: 'bc1qz2zqqgdz7whfmmkpcthn5gkv4ew4dfjs6fyeat',
                fee: 2.0,
                priority: 4
            }
        ];
        
        // Start monitoring
        this.startMonitoring();
    }

    getCurrentPool() {
        return this.miningPools[this.currentPoolIndex];
    }

    switchToNextPool() {
        const now = Date.now();
        // Prevent rapid switching (minimum 30 seconds between switches)
        if (now - this.lastPoolSwitchTime < 30000) {
            return false;
        }

        this.currentPoolIndex = (this.currentPoolIndex + 1) % this.miningPools.length;
        this.lastPoolSwitchTime = now;
        this.poolFailures = 0;
        console.log('🔄 Switching to pool: ' + this.getCurrentPool().name + ' (' + this.getCurrentPool().url + ')');
        return true;
    }

    handlePoolFailure() {
        this.poolFailures++;
        console.log('⚠️ Pool failure detected (' + this.poolFailures + '/3) for ' + this.getCurrentPool().name);
        
        if (this.poolFailures >= 3) {
            if (this.switchToNextPool()) {
                // Restart mining with new pool
                this.stopMining();
                setTimeout(() => {
                    this.startMining();
                }, 5000);
                return true;
            }
        }
        return false;
    }

    startMining() {
        if (this.isRunning) {
            return { success: false, message: 'Mining already running' };
        }

        try {
            const minerdPath = path.join(__dirname, '../cpuminer/minerd');
            if (!fs.existsSync(minerdPath)) {
                return { success: false, message: 'Miner not found at ' + minerdPath };
            }

            const currentPool = this.getCurrentPool();
            console.log('🚀 Starting CPU mining with ' + currentPool.name + ' pool...');

            this.miningProcess = spawn(minerdPath, [
                '-a', 'sha256d',
                '-o', currentPool.url,
                '-u', currentPool.wallet,
                '-p', 'x',
                '-t', this.intensity.cpu.toString() // Use intensity-controlled threads
            ], {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            this.isRunning = true;
            this.startTime = Date.now();
            this.hashrate = 0;
            this.shares = { accepted: 0, rejected: 0 };

            // Parse miner output
            this.miningProcess.stdout.on('data', (data) => {
                const output = data.toString();
                console.log('⛏️  MINING:', output.trim());
                this.parseMinerOutput(output);
            });

            this.miningProcess.stderr.on('data', (data) => {
                const output = data.toString();
                console.log('⛏️  MINING:', output.trim());
                this.parseMinerOutput(output);
            });

            this.miningProcess.on('close', (code) => {
                this.isRunning = false;
                this.miningProcess = null;
                console.log('Miner exited with code ' + code);
            });

            return { success: true, message: 'Mining started successfully' };
        } catch (error) {
            return { success: false, message: 'Failed to start mining: ' + error.message };
        }
    }

    stopMining() {
        if (!this.isRunning || !this.miningProcess) {
            return { success: false, message: 'Mining not running' };
        }

        try {
            this.miningProcess.kill('SIGTERM');
            this.isRunning = false;
            this.miningProcess = null;
            return { success: true, message: 'Mining stopped successfully' };
        } catch (error) {
            return { success: false, message: 'Failed to stop mining: ' + error.message };
        }
    }

    parseMinerOutput(output) {
        const lines = output.split('\n');
        
        lines.forEach(line => {
            // Parse hashrate: "thread 0: 2097152 hashes, 1690 khash/s"
            const hashrateMatch = line.match(/(\d+) khash\/s/);
            if (hashrateMatch) {
                const threadHashrate = parseFloat(hashrateMatch[1]);
                this.updateHashrate(threadHashrate);
                // Reset pool failures on successful mining
                this.poolFailures = 0;
            }

            // Parse shares: "thread 0: accepted 1/1 (diff 1.00), 1690 khash/s"
            const shareMatch = line.match(/accepted (\d+)\/(\d+)/);
            if (shareMatch) {
                const accepted = parseInt(shareMatch[1]);
                const total = parseInt(shareMatch[2]);
                this.shares.accepted += accepted;
                this.shares.rejected += (total - accepted);
                // Reset pool failures on successful share submission
                this.poolFailures = 0;
            }

            // Detect pool connection errors
            const poolErrorPatterns = [
                /connection\s+failed/i,
                /stratum\s+connection\s+failed/i,
                /pool\s+connection\s+lost/i,
                /timeout/i,
                /refused/i,
                /unreachable/i
            ];

            poolErrorPatterns.forEach(pattern => {
                if (pattern.test(line)) {
                    console.log('🚨 Pool connection issue detected: ' + line.trim());
                    this.handlePoolFailure();
                }
            });
        });
    }

    parseGPUOutput(output) {
        const lines = output.split('\n');
        for (const line of lines) {
            // Parse lolMiner output for hashrate and shares
            if (line.includes('Speed:') || line.includes('MH/s')) {
                const match = line.match(/(\d+(?:\.\d+)?)\s*MH\/s/);
                if (match) {
                    const gpuHashrate = parseFloat(match[1]);
                    // Add GPU hashrate to total hashrate
                    this.stats.hashrate = Math.max(this.stats.hashrate, gpuHashrate);
                }
            }
            
            if (line.includes('Accepted:') || line.includes('Rejected:')) {
                const acceptedMatch = line.match(/Accepted:\s*(\d+)/);
                const rejectedMatch = line.match(/Rejected:\s*(\d+)/);
                
                if (acceptedMatch) this.shares.accepted += parseInt(acceptedMatch[1]);
                if (rejectedMatch) this.shares.rejected += parseInt(rejectedMatch[1]);
                
                this.stats.shares = { ...this.shares };
            }
            
            // Log GPU mining activity
            if (line.includes('GPU') || line.includes('Device')) {
                console.log('🎮 ' + line.trim());
            }
        }
    }

    updateHashrate(newHashrate) {
        // Simple averaging for now
        this.hashrate = (this.hashrate + newHashrate) / 2;
        this.stats.hashrate = this.hashrate / 1000; // Convert to MH/s
    }

    getStats() {
        if (this.isRunning && this.startTime) {
            this.stats.uptime = Math.floor((Date.now() - this.startTime) / 1000);
        } else {
            this.stats.uptime = 0;
        }

        return {
            isRunning: this.isRunning,
            hashrate: this.stats.hashrate.toFixed(2),
            shares: { ...this.shares },
            uptime: this.stats.uptime,
            temperature: this.getTemperature(),
            power: this.getPowerUsage(),
            cpuUsage: this.getCPUUsage(),
            gpuUsage: this.getGPUUsage(),
            gpuTemperature: this.getGPUTemperature(),
            earnings: this.stats.earnings || {
                btc: { hourly: 0, daily: 0, weekly: 0, monthly: 0 },
                usd: { hourly: 0, daily: 0, weekly: 0, monthly: 0 },
                thb: { hourly: 0, daily: 0, weekly: 0, monthly: 0 }
            }
        };
    }

    getTemperature() {
        // Try to read actual CPU temperature
        try {
            const fs = require('fs');
            // Try different temperature sensor paths
            const tempPaths = [
                '/sys/class/thermal/thermal_zone0/temp',
                '/sys/class/thermal/thermal_zone1/temp',
                '/sys/class/hwmon/hwmon0/temp1_input',
                '/sys/class/hwmon/hwmon1/temp1_input'
            ];
            
            for (const path of tempPaths) {
                try {
                    if (fs.existsSync(path)) {
                        const temp = parseInt(fs.readFileSync(path, 'utf8').trim());
                        return Math.floor(temp / 1000); // Convert millidegrees to degrees
                    }
                } catch (e) {
                    continue;
                }
            }
        } catch (e) {
            // Fallback to estimated temperature based on load
            const load = this.getCPUUsage();
            return Math.floor(60 + (load * 0.3));
        }
        return 75; // Default fallback
    }

    getPowerUsage() {
        // Estimate power usage based on CPU usage and temperature
        const cpuUsage = this.getCPUUsage();
        const temp = this.getTemperature();
        const basePower = 45; // Base system power
        const cpuPower = cpuUsage * 0.8; // CPU power scaling
        const thermalPower = Math.max(0, (temp - 70) * 0.5); // Thermal scaling
        return Math.floor(basePower + cpuPower + thermalPower);
    }

    getCPUUsage() {
        try {
            const fs = require('fs');
            const loadavg = fs.readFileSync('/proc/loadavg', 'utf8');
            const load1 = parseFloat(loadavg.split(' ')[0]);
            const cpuCount = require('os').cpus().length;
            const usage = Math.min(100, (load1 / cpuCount) * 100);
            return Math.floor(usage);
        } catch (e) {
            return Math.floor(Math.random() * 20) + 80; // Fallback for mining load
        }
    }

    getGPUUsage() {
        try {
            const { execSync } = require('child_process');
            
            // Check what GPU we have first
            const gpuInfo = this.getGPUInfo();
            
            if (gpuInfo.type === 'nvidia') {
                try {
                    const nvidiaOutput = execSync('nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits', { encoding: 'utf8', timeout: 2000 });
                    return parseInt(nvidiaOutput.trim()) || 0;
                } catch (e) {
                    return 0;
                }
            } else if (gpuInfo.type === 'amd') {
                try {
                    const amdOutput = execSync('timeout 1 radeontop -d - -l 1 2>/dev/null | grep -o "[0-9]*%" | head -1', { encoding: 'utf8', timeout: 3000 });
                    return parseInt(amdOutput.trim().replace('%', '')) || 0;
                } catch (e) {
                    return 0;
                }
            } else if (gpuInfo.type === 'intel') {
                try {
                    const intelOutput = execSync('timeout 1 intel_gpu_top -s 1 2>/dev/null | grep -o "[0-9]*%" | head -1', { encoding: 'utf8', timeout: 3000 });
                    return parseInt(intelOutput.trim().replace('%', '')) || 0;
                } catch (e) {
                    return 0;
                }
            }
            
        } catch (e) {
            // All GPU monitoring methods failed
        }
        
        // Fallback: estimate GPU usage based on mining activity
        return this.isRunning ? Math.floor(Math.random() * 30) + 70 : 0;
    }

    getGPUInfo() {
        // Return cached GPU info if already detected
        if (this.gpuInfo) {
            return this.gpuInfo;
        }
        
        try {
            const { execSync } = require('child_process');
            
            // Check for NVIDIA GPU
            try {
                execSync('nvidia-smi --version', { encoding: 'utf8', timeout: 1000 });
                this.gpuInfo = { type: 'nvidia', name: 'NVIDIA GPU' };
                return this.gpuInfo;
            } catch (e) {
                // Not NVIDIA
            }
            
            // Check for AMD GPU
            try {
                const lspciOutput = execSync('lspci | grep -i vga', { encoding: 'utf8', timeout: 5000 });
                const lowerOutput = lspciOutput.toLowerCase();
                if (lowerOutput.includes('amd') || lowerOutput.includes('radeon') || lowerOutput.includes('vega')) {
                    this.gpuInfo = { type: 'amd', name: 'AMD Radeon Vega' };
                    console.log('🔍 GPU detected: AMD Radeon Vega');
                    return this.gpuInfo;
                }
            } catch (e) {
                console.log('🔍 lspci failed:', e.message);
                // Fallback: assume AMD GPU if we have OpenCL
                try {
                    execSync('clinfo | grep -i "AMD Radeon"', { encoding: 'utf8', timeout: 3000 });
                    this.gpuInfo = { type: 'amd', name: 'AMD Radeon Vega' };
                    console.log('🔍 GPU detected via clinfo: AMD Radeon Vega');
                    return this.gpuInfo;
                } catch (e2) {
                    console.log('🔍 clinfo fallback also failed:', e2.message);
                }
            }
            
            // Check for Intel GPU
            try {
                const lspciOutput = execSync('lspci | grep -i vga', { encoding: 'utf8', timeout: 1000 });
                if (lspciOutput.toLowerCase().includes('intel')) {
                    this.gpuInfo = { type: 'intel', name: 'Intel GPU' };
                    return this.gpuInfo;
                }
            } catch (e) {
                // lspci failed
            }
            
        } catch (e) {
            // All detection methods failed
        }
        
        this.gpuInfo = { type: 'unknown', name: 'Unknown GPU' };
        return this.gpuInfo;
    }

    async startGPUMining() {
        if (this.gpuMiningProcess) {
            return { success: false, message: 'GPU mining already running' };
        }

        try {
            const gpuInfo = this.getGPUInfo();
            
            if (gpuInfo.type === 'amd') {
                return await this.startAMDGPUMining();
            } else if (gpuInfo.type === 'nvidia') {
                return await this.startNVIDIAGPUMining();
            } else {
                return { success: false, message: 'No compatible GPU found for mining' };
            }
        } catch (error) {
            return { success: false, message: 'Failed to start GPU mining: ' + error.message };
        }
    }

    async startAMDGPUMining() {
        try {
            // Check if we have an OpenCL miner available
            const { execSync } = require('child_process');
            
            // Try to find a suitable AMD miner
            let minerPath = null;
            const possibleMiners = [
                path.join(require('os').homedir(), 'gpu-mining', 'lolminer', 'lolMiner'),
                '/usr/local/bin/sgminer',
                '/usr/bin/sgminer',
                '/usr/local/bin/claymore',
                '/usr/bin/claymore'
            ];
            
            for (const path of possibleMiners) {
                try {
                    execSync(`${path} --version`, { timeout: 2000 });
                    minerPath = path;
                    break;
                } catch (e) {
                    continue;
                }
            }
            
            if (!minerPath) {
                console.log('🔧 AMD GPU miner not found, using CPU miner with GPU threads...');
                // Fallback: Use cpuminer with more threads to simulate GPU mining
                const { spawn } = require('child_process');
                // Find the correct cpuminer path
                let cpuminerPath = null;
                const possiblePaths = [
                    '/home/capital/Cryptoj/cpuminer/minerd',
                    '/home/capital/Cryptoj/new-website/cpuminer-multi/cpuminer',
                    '/usr/local/bin/cpuminer',
                    '/usr/bin/cpuminer',
                    'cpuminer'
                ];
                
                for (const path of possiblePaths) {
                    try {
                        execSync(`${path} --version`, { timeout: 2000 });
                        cpuminerPath = path;
                        break;
                    } catch (e) { continue; }
                }
                
                if (cpuminerPath) {
                    const currentPool = this.getCurrentPool();
                    this.gpuMiningProcess = spawn(cpuminerPath, [
                        '-a', 'sha256d',
                        '-o', currentPool.url,
                        '-u', currentPool.wallet,
                        '-p', 'x',
                        '-t', this.intensity.gpu.toString() // Use intensity-controlled GPU threads
                    ]);
                } else {
                    throw new Error('cpuminer not found for GPU simulation');
                }
                
                console.log('🎮 AMD GPU mining simulated with additional CPU threads');
                return { success: true, message: 'AMD GPU mining simulated with CPU threads' };
            }
            
            // Start GPU mining process
            const { spawn } = require('child_process');
            
            // Check if it's lolMiner
            if (minerPath.includes('lolMiner')) {
                console.log('🎮 Starting lolMiner for GPU mining...');
                // Use lolMiner for more profitable algorithms (e.g., Ethereum Classic)
                this.gpuMiningProcess = spawn(minerPath, [
                    '--algo', 'ETHASH',
                    '--pool', 'stratum+tcp://etc.poolin.com:4444',
                    '--user', '0x1234567890123456789012345678901234567890', // Placeholder wallet
                    '--pass', 'x',
                    '--tls', 'on',
                    '--keepfree', '1024',
                    '--4g-alloc-size', '4076'
                ], {
                    cwd: path.join(require('os').homedir(), 'gpu-mining'),
                    stdio: ['pipe', 'pipe', 'pipe']
                });
                
                this.gpuMiningProcess.stdout.on('data', (data) => {
                    this.parseGPUOutput(data.toString());
                });
                
                this.gpuMiningProcess.stderr.on('data', (data) => {
                    console.log('🎮 lolMiner Error:', data.toString());
                });
                
                console.log('🎮 AMD GPU mining started with lolMiner (ETHASH)');
                return { success: true, message: 'AMD GPU mining started with lolMiner' };
            } else {
                // Traditional GPU miner
                const currentPool = this.getCurrentPool();
                this.gpuMiningProcess = spawn(minerPath, [
                    '-k', 'scrypt',
                    '-o', currentPool.url,
                    '-u', currentPool.wallet,
                    '-p', 'x',
                    '--gpu-platform', '0'
                ]);
                
                console.log('🎮 AMD GPU mining started');
                return { success: true, message: 'AMD GPU mining started successfully' };
            }
            
        } catch (error) {
            return { success: false, message: 'Failed to start AMD GPU mining: ' + error.message };
        }
    }

    async startNVIDIAGPUMining() {
        try {
            // Check if we have CUDA miner available
            const { execSync } = require('child_process');
            
            let minerPath = null;
            const possibleMiners = [
                '/usr/local/bin/cgminer',
                '/usr/bin/cgminer',
                '/usr/local/bin/ccminer',
                '/usr/bin/ccminer'
            ];
            
            for (const path of possibleMiners) {
                try {
                    execSync(`${path} --version`, { timeout: 2000 });
                    minerPath = path;
                    break;
                } catch (e) {
                    continue;
                }
            }
            
            if (!minerPath) {
                return { 
                    success: false, 
                    message: 'NVIDIA GPU miner not found. Install cgminer or ccminer for GPU mining.' 
                };
            }
            
            // Start GPU mining process
            const { spawn } = require('child_process');
            const currentPool = this.getCurrentPool();
            this.gpuMiningProcess = spawn(minerPath, [
                '-a', 'scrypt',
                '-o', currentPool.url,
                '-u', currentPool.wallet,
                '-p', 'x'
            ]);
            
            console.log('🎮 NVIDIA GPU mining started');
            return { success: true, message: 'NVIDIA GPU mining started successfully' };
            
        } catch (error) {
            return { success: false, message: 'Failed to start NVIDIA GPU mining: ' + error.message };
        }
    }

    stopGPUMining() {
        if (this.gpuMiningProcess) {
            this.gpuMiningProcess.kill();
            this.gpuMiningProcess = null;
            console.log('🎮 GPU mining stopped');
            return { success: true, message: 'GPU mining stopped successfully' };
        }
        return { success: false, message: 'GPU mining not running' };
    }

    getGPUTemperature() {
        try {
            const { execSync } = require('child_process');
            const gpuInfo = this.getGPUInfo();
            
            if (gpuInfo.type === 'nvidia') {
                try {
                    const nvidiaOutput = execSync('nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits', { encoding: 'utf8', timeout: 2000 });
                    return parseInt(nvidiaOutput.trim()) || 0;
                } catch (e) {
                    return 0;
                }
            } else if (gpuInfo.type === 'amd') {
                try {
                    // Try sensors for AMD GPU temperature (amdgpu)
                    const sensorsOutput = execSync('sensors 2>/dev/null | grep -A 5 "amdgpu-pci" | grep "edge:" | grep -o "[0-9]*\.[0-9]*°C" | head -1', { encoding: 'utf8', timeout: 2000 });
                    return parseInt(parseFloat(sensorsOutput.trim().replace('°C', ''))) || 0;
                } catch (e) {
                    return 0;
                }
            } else if (gpuInfo.type === 'intel') {
                try {
                    const sensorsOutput = execSync('sensors 2>/dev/null | grep -i "intel\|gpu" | grep -o "[0-9]*°C" | head -1', { encoding: 'utf8', timeout: 2000 });
                    return parseInt(sensorsOutput.trim().replace('°C', '')) || 0;
                } catch (e) {
                    return 0;
                }
            }
            
        } catch (e) {
            // All temperature monitoring methods failed
        }
        
        // Fallback: estimate GPU temperature based on usage
        const gpuUsage = this.getGPUUsage();
        return gpuUsage > 0 ? Math.floor(50 + (gpuUsage * 0.4)) : 45;
    }

    getServerIP() {
        const networkInterfaces = os.networkInterfaces();
        for (const interfaceName in networkInterfaces) {
            const networkInterface = networkInterfaces[interfaceName];
            for (const netInterface of networkInterface) {
                if (netInterface.family === 'IPv4' && !netInterface.internal) {
                    return netInterface.address;
                }
            }
        }
        return 'localhost';
    }

    loadIntensity() {
        try {
            const intensityFile = path.join(__dirname, 'mining-intensity.json');
            if (fs.existsSync(intensityFile)) {
                const data = fs.readFileSync(intensityFile, 'utf8');
                const parsed = JSON.parse(data);
                return {
                    cpu: parsed.cpu || 8,
                    gpu: parsed.gpu || 4,
                    overall: parsed.overall || 100
                };
            }
        } catch (e) {
            console.log('Could not load intensity settings, using defaults');
        }
        return {
            cpu: 8,
            gpu: 4,
            overall: 100
        };
    }

    saveIntensity() {
        try {
            const intensityFile = path.join(__dirname, 'mining-intensity.json');
            const data = {
                cpu: this.intensity.cpu,
                gpu: this.intensity.gpu,
                overall: this.intensity.overall,
                timestamp: Date.now()
            };
            fs.writeFileSync(intensityFile, JSON.stringify(data, null, 2));
            console.log('Intensity settings saved');
        } catch (e) {
            console.log('Could not save intensity settings:', e.message);
        }
    }

    setIntensity(cpu, gpu, overall) {
        this.intensity = {
            cpu: Math.max(1, Math.min(16, cpu)), // CPU: 1-16 threads
            gpu: Math.max(1, Math.min(8, gpu)),  // GPU: 1-8 threads
            overall: Math.max(10, Math.min(100, overall)) // Overall: 10-100%
        };
        this.saveIntensity();
        
        // Restart mining with new intensity if currently running
        if (this.isRunning) {
            console.log('Restarting mining with new intensity settings...');
            this.stopMining();
            setTimeout(() => {
                this.startMining();
            }, 2000);
        }
        
        return this.intensity;
    }

    getIntensity() {
        return this.intensity;
    }

    optimizeThreads() {
        const cpuCores = os.cpus().length;
        const optimalCpuThreads = Math.max(1, Math.min(cpuCores, 12)); // Max 12 threads
        const optimalGpuThreads = Math.max(1, Math.min(Math.floor(cpuCores / 2), 6)); // Half CPU cores, max 6
        
        // Only auto-optimize if intensity is at default values
        if (this.intensity.cpu === 8 && this.intensity.gpu === 4) {
            this.intensity.cpu = optimalCpuThreads;
            this.intensity.gpu = optimalGpuThreads;
            console.log(`🔧 Auto-optimized threads: CPU=${optimalCpuThreads}, GPU=${optimalGpuThreads} (${cpuCores} cores detected)`);
        }
    }

    startHealthMonitoring() {
        setInterval(() => {
            this.checkHealth();
        }, 30000); // Check every 30 seconds
    }

    startProfitabilityMonitoring() {
        // Check profitability every 5 minutes
        setInterval(async () => {
            try {
                await this.profitabilityManager.updateProfitability();
                await this.checkAlgorithmSwitch();
            } catch (error) {
                console.log('⚠️  Profitability monitoring error:', error.message);
            }
        }, 300000); // 5 minutes
    }

    startAutoScalingMonitoring() {
        // Check auto-scaling every 10 minutes
        setInterval(async () => {
            try {
                await this.checkAutoScaling();
            } catch (error) {
                console.log('⚠️  Auto-scaling monitoring error:', error.message);
            }
        }, 600000); // 10 minutes
    }

    async checkAutoScaling() {
        const now = Date.now();
        if (now - this.lastScalingCheck < 600000) { // Check every 10 minutes max
            return;
        }

        try {
            const scalingDecision = await this.autoScalingManager.makeScalingDecision(this);
            if (scalingDecision) {
                console.log('🔧 Auto-scaling applied successfully');
            }
            this.lastScalingCheck = now;
        } catch (error) {
            console.log('⚠️  Auto-scaling check failed:', error.message);
        }
    }

    startAdvancedMonitoring() {
        console.log('🔍 Starting advanced monitoring...');
        this.advancedMonitor.startMonitoring();
    }

    getAdvancedMetrics() {
        return this.advancedMonitor.getMetrics();
    }

    getSystemAlerts() {
        return this.advancedMonitor.getAlerts();
    }

    async checkAlgorithmSwitch() {
        const now = Date.now();
        if (now - this.lastAlgorithmCheck < 600000) { // Check every 10 minutes max
            return;
        }

        try {
            const currentHashrate = this.stats.hashrate;
            const newAlgorithm = await this.profitabilityManager.shouldSwitchAlgorithm(this.currentAlgorithm, currentHashrate);
            
            if (newAlgorithm) {
                console.log(`🔄 Switching algorithm from ${this.currentAlgorithm} to ${newAlgorithm}`);
                await this.switchAlgorithm(newAlgorithm);
                this.lastAlgorithmCheck = now;
            }
        } catch (error) {
            console.log('⚠️  Algorithm switch check failed:', error.message);
        }
    }

    async switchAlgorithm(newAlgorithm) {
        try {
            console.log(`🔄 Switching to ${newAlgorithm} algorithm...`);
            
            // Stop current mining
            if (this.isRunning) {
                await this.stopMining();
            }
            
            // Update current algorithm
            this.currentAlgorithm = newAlgorithm;
            
            // Start mining with new algorithm
            if (newAlgorithm === 'bitcoin' || newAlgorithm === 'monero') {
                // CPU algorithms
                await this.startMining();
            } else {
                // GPU algorithms
                await this.startGPUMining();
            }
            
            console.log(`✅ Successfully switched to ${newAlgorithm}`);
        } catch (error) {
            console.log('❌ Failed to switch algorithm:', error.message);
        }
    }

    checkHealth() {
        try {
            // Check if mining process is still running
            if (this.isRunning && this.miningProcess) {
                if (this.miningProcess.killed || this.miningProcess.exitCode !== null) {
                    console.log('⚠️ Mining process died, attempting restart...');
                    this.restartMining();
                }
            }

            // Check GPU mining process
            if (this.gpuMiningProcess) {
                if (this.gpuMiningProcess.killed || this.gpuMiningProcess.exitCode !== null) {
                    console.log('⚠️ GPU mining process died, attempting restart...');
                    this.restartGPUMining();
                }
            }

            // Check temperature thresholds
            const temp = this.getTemperature();
            if (temp > 85) {
                console.log(`⚠️ High temperature detected: ${temp}°C, reducing intensity...`);
                this.reduceIntensityForHeat();
            }

            // Check system load
            const cpuUsage = this.getCPUUsage();
            if (cpuUsage > 95) {
                console.log(`⚠️ High CPU usage: ${cpuUsage}%, monitoring...`);
            }

        } catch (error) {
            console.error('Health check failed:', error.message);
        }
    }

    restartMining() {
        try {
            this.stopMining();
            setTimeout(() => {
                this.startMining();
                console.log('✅ Mining process restarted successfully');
            }, 2000);
        } catch (error) {
            console.error('Failed to restart mining:', error.message);
        }
    }

    restartGPUMining() {
        try {
            this.stopGPUMining();
            setTimeout(() => {
                this.startGPUMining();
                console.log('✅ GPU mining process restarted successfully');
            }, 2000);
        } catch (error) {
            console.error('Failed to restart GPU mining:', error.message);
        }
    }

    reduceIntensityForHeat() {
        // Reduce intensity by 20% if temperature is too high
        this.intensity.overall = Math.max(50, this.intensity.overall - 20);
        this.saveIntensity();
        console.log(`🌡️ Reduced intensity to ${this.intensity.overall}% due to high temperature`);
    }

    addRemoteClient(clientData) {
        // Add a remote mining client
        const client = {
            id: clientData.hostname || Date.now().toString(), // Use hostname as ID for consistency
            hostname: clientData.hostname || `client-${Date.now()}`,
            name: clientData.name || clientData.hostname || `Remote Client ${this.remoteClients.length + 1}`,
            ip: clientData.ip,
            hashrate: clientData.hashrate || 0,
            status: clientData.status || 'offline',
            uptime: clientData.uptime || 0,
            shares: clientData.shares || { accepted: 0, rejected: 0 },
            lastSeen: Date.now(),
            os: clientData.os || 'Unknown',
            cpu: clientData.cpu || 'Unknown',
            cpuUsage: clientData.cpuUsage || 0,
            gpuUsage: clientData.gpuUsage || 0,
            temperature: clientData.temperature || 0,
            gpuTemperature: clientData.gpuTemperature || 0,
            power: clientData.power || 0
        };
        
        this.remoteClients.push(client);
        console.log('📡 Remote client added: ' + client.hostname + ' (' + client.ip + ')');
        return client;
    }

    updateRemoteClient(clientId, clientData) {
        const client = this.remoteClients.find(c => c.id === clientId || c.hostname === clientId);
        if (client) {
            Object.assign(client, clientData);
            client.lastSeen = Date.now();
            console.log('📡 Remote client updated: ' + client.hostname + ' - ' + client.hashrate + ' MH/s');
        } else {
            console.log('📡 Client not found for update: ' + clientId);
        }
    }

    getRemoteClients() {
        // Remove clients that haven't been seen in 5 minutes
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        this.remoteClients = this.remoteClients.filter(c => c.lastSeen > fiveMinutesAgo);
        
        return this.remoteClients;
    }

    getClientInstallerInfo() {
        const currentPool = this.getCurrentPool();
        return {
            serverIP: this.serverIP,
            serverPort: 3000,
            poolUrl: currentPool.url,
            poolName: currentPool.name,
            wallet: currentPool.wallet,
            installScript: this.generateInstallScript()
        };
    }

    generateInstallScript() {
        return `#!/bin/bash
# Bitcoin Mining Client Installer - Production Ready
# Server: ${this.serverIP}:3000

set -e  # Exit on any error

echo "=========================================="
echo "  Bitcoin Mining Client Installer v2.0"
echo "  Server: ${this.serverIP}:3000"
echo "=========================================="

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "❌ Please don't run as root. Use a regular user account."
    exit 1
fi

# Check internet connection
if ! ping -c 1 8.8.8.8 >/dev/null 2>&1; then
    echo "❌ No internet connection. Please check your network."
    exit 1
fi

echo "✅ System check passed"

# Install dependencies
echo "📦 Installing dependencies..."
sudo apt-get update -qq
sudo apt-get install -y curl git build-essential autotools-dev automake libtool pkg-config lm-sensors bc

# Install GPU monitoring tools
echo "🔧 Installing GPU monitoring tools..."
# Try to install radeontop for AMD GPUs
sudo apt-get install -y radeontop 2>/dev/null || echo "⚠️  radeontop not available (may need manual install)"

# Try to install nvidia-smi for NVIDIA GPUs (if applicable)
if command -v nvidia-smi >/dev/null 2>&1; then
    echo "✅ NVIDIA GPU detected"
else
    echo "ℹ️  No NVIDIA GPU detected, skipping nvidia-smi"
fi

# Check if cpuminer already exists
MINER_DIR="/home/$USER/cpuminer"
if [ -d "$MINER_DIR" ] && [ -f "$MINER_DIR/minerd" ]; then
    echo "✅ cpuminer already installed"
else
    echo "🔨 Compiling cpuminer..."
    rm -rf "$MINER_DIR"
    cd /tmp
    git clone https://github.com/pooler/cpuminer.git "$MINER_DIR"
    cd "$MINER_DIR"
    
    # Compile with optimizations
    ./autogen.sh
    ./configure CFLAGS="-O3 -march=native"
    make -j$(nproc)
    
    if [ ! -f "$MINER_DIR/minerd" ]; then
        echo "❌ Compilation failed!"
        exit 1
    fi
    
    echo "✅ cpuminer compiled successfully"
fi

# Create systemd service for auto-start
echo "⚙️  Creating system service..."
sudo tee /etc/systemd/system/bitcoin-miner.service > /dev/null << EOF
[Unit]
Description=Bitcoin Mining Client
After=network.target
Wants=network.target

[Service]
Type=forking
User=$USER
WorkingDirectory=/home/$USER
ExecStart=/home/$USER/mining-client.sh
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Create the main mining script
cat > /home/$USER/mining-client.sh << 'EOF'
#!/bin/bash
# Production Bitcoin Mining Client
# Auto-restarting, error handling, proper logging

set -e

# Configuration
MINER_PATH="/home/$USER/cpuminer/minerd"
POOL_URL="${this.getCurrentPool().url}"
WALLET="${this.getCurrentPool().wallet}"
SERVER_URL="http://${this.serverIP}:3000"
LOG_FILE="/home/$USER/mining.log"
PID_FILE="/home/$USER/mining.pid"

# Client identification
CLIENT_ID="$(hostname)-$(date +%s)"
CLIENT_NAME="$(hostname)"
CPU_CORES=$(nproc)

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Cleanup function
cleanup() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            log "Stopping miner (PID: $PID)"
            kill "$PID"
            wait "$PID" 2>/dev/null || true
        fi
        rm -f "$PID_FILE"
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

log "Starting Bitcoin Mining Client"
log "Client: $CLIENT_NAME ($CLIENT_ID)"
log "Server: $SERVER_URL"
log "CPU Cores: $CPU_CORES"

# Test server connectivity with detailed error reporting
log "🔍 Testing server connectivity..."
if ! curl -s --connect-timeout 10 "$SERVER_URL/api/status" >/dev/null; then
    log "❌ Cannot connect to server: $SERVER_URL"
    log "🔍 Network diagnostics:"
    
    # Test basic connectivity
    if ping -c 1 8.8.8.8 >/dev/null 2>&1; then
        log "✅ Internet connection: OK"
    else
        log "❌ Internet connection: FAILED"
    fi
    
    # Test DNS resolution
    if nslookup $(echo "$SERVER_URL" | sed 's|http://||' | sed 's|:.*||') >/dev/null 2>&1; then
        log "✅ DNS resolution: OK"
    else
        log "❌ DNS resolution: FAILED"
    fi
    
    # Test port connectivity
    SERVER_HOST=$(echo "$SERVER_URL" | sed 's|http://||' | sed 's|:.*||')
    SERVER_PORT=$(echo "$SERVER_URL" | sed 's|.*:||' | sed 's|/.*||')
    if timeout 5 bash -c "</dev/tcp/$SERVER_HOST/$SERVER_PORT" 2>/dev/null; then
        log "✅ Port $SERVER_PORT connectivity: OK"
    else
        log "❌ Port $SERVER_PORT connectivity: FAILED"
    fi
    
    log "🔄 Retrying in 30 seconds..."
    sleep 30
    exit 1
fi

log "✅ Server connection verified"

# Start mining with proper error handling
while true; do
    log "Starting miner process..."
    
    # Start miner in background
    nohup "$MINER_PATH" \\
        -a sha256d \\
        -o "$POOL_URL" \\
        -u "$WALLET" \\
        -p x \\
        -t "$CPU_CORES" \\
        >> "$LOG_FILE" 2>&1 &
    
    MINER_PID=$!
    echo "$MINER_PID" > "$PID_FILE"
    
    log "Miner started (PID: $MINER_PID)"
    
    # System monitoring functions
    get_cpu_usage() {
        # Get CPU usage percentage - Linux Mint compatible
        if command -v top >/dev/null 2>&1; then
            # Try different top output formats for different Linux distributions
            cpu_line=$(top -bn1 | grep -E "Cpu\\(s\\)|%Cpu" | head -1)
            if echo "$cpu_line" | grep -q "id,"; then
                # Standard format
                echo "$cpu_line" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk '{print 100 - $1}'
            elif echo "$cpu_line" | grep -q "id "; then
                # Alternative format
                echo "$cpu_line" | awk '{for(i=1;i<=NF;i++) if($i ~ /id/) {gsub(/%/, "", $(i-1)); print 100-$(i-1); exit}}'
            else
                # Fallback
                echo "0"
            fi
        else
            # Fallback using /proc/loadavg
            load=$(cat /proc/loadavg | cut -d' ' -f1)
            cores=$(nproc)
            echo "$load $cores" | awk '{printf "%.0f", ($1/$2)*100}'
        fi
    }
    
    get_gpu_usage() {
        # Try different GPU monitoring methods
        if command -v nvidia-smi >/dev/null 2>&1; then
            # NVIDIA GPU
            nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null | head -1 || echo "0"
        elif command -v radeontop >/dev/null 2>&1; then
            # AMD GPU
            timeout 1 radeontop -d - -l 1 2>/dev/null | grep -o '[0-9]*%' | head -1 | sed 's/%//' || echo "0"
        else
            echo "0"
        fi
    }
    
    get_cpu_temp() {
        # Try different temperature sources - Linux Mint compatible
        if [ -f "/sys/class/thermal/thermal_zone0/temp" ]; then
            cat /sys/class/thermal/thermal_zone0/temp | awk '{printf "%.0f", $1/1000}'
        elif [ -f "/sys/class/thermal/thermal_zone1/temp" ]; then
            cat /sys/class/thermal/thermal_zone1/temp | awk '{printf "%.0f", $1/1000}'
        elif command -v sensors >/dev/null 2>&1; then
            # Try multiple sensor patterns for different systems
            temp=$(sensors 2>/dev/null | grep -E -i "(core 0|package id 0|cpu|temp1)" | grep -o '[0-9]*\.[0-9]*°C' | head -1 | sed 's/°C//' || echo "0")
            if [ "$temp" = "0" ]; then
                # Try alternative sensor output format
                temp=$(sensors 2>/dev/null | grep -E -i "(core 0|package id 0|cpu|temp1)" | grep -o '[0-9]*°C' | head -1 | sed 's/°C//' || echo "0")
            fi
            echo "$temp"
        else
            echo "0"
        fi
    }
    
    get_gpu_temp() {
        # Try different GPU temperature sources
        if command -v nvidia-smi >/dev/null 2>&1; then
            nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits 2>/dev/null | head -1 || echo "0"
        elif command -v sensors >/dev/null 2>&1; then
            sensors 2>/dev/null | grep -i "radeon\\|gpu" | grep -o '[0-9]*°C' | head -1 | sed 's/°C//' || echo "0"
        else
            echo "0"
        fi
    }
    
    get_power_usage() {
        # Estimate power usage based on CPU usage and temperature - Linux Mint compatible
        cpu_usage=$(get_cpu_usage)
        cpu_temp=$(get_cpu_temp)
        base_power=45
        
        # Use bc if available, otherwise use awk for calculations
        if command -v bc >/dev/null 2>&1; then
            cpu_power=$(echo "$cpu_usage * 0.8" | bc -l 2>/dev/null || echo "$cpu_usage")
            thermal_power=$(echo "($cpu_temp - 70) * 0.5" | bc -l 2>/dev/null || echo "0")
            if (( $(echo "$thermal_power < 0" | bc -l 2>/dev/null || echo "1") )); then
                thermal_power=0
            fi
            echo "$base_power + $cpu_power + $thermal_power" | bc -l 2>/dev/null | cut -d. -f1 || echo "65"
        else
            # Fallback using awk for calculations
            cpu_power=$(awk "BEGIN {printf \"%.0f\", $cpu_usage * 0.8}")
            thermal_power=$(awk "BEGIN {printf \"%.0f\", ($cpu_temp - 70) * 0.5}")
            if [ "$thermal_power" -lt 0 ]; then
                thermal_power=0
            fi
            awk "BEGIN {printf \"%.0f\", $base_power + $cpu_power + $thermal_power}"
        fi
    }
    
    # Stats reporting function
    report_stats() {
        if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
            # Parse hashrate from log (simplified)
            HASH_RATE=$(tail -n 50 "$LOG_FILE" | grep -o '[0-9]*\\.[0-9]* khash/s' | tail -1 | grep -o '[0-9]*\\.[0-9]*' || echo "0")
            UPTIME=$(ps -o etime= -p "$(cat "$PID_FILE")" | tr -d ' ')
            
            # Get system info
            CPU_MODEL=$(cat /proc/cpuinfo | grep 'model name' | head -1 | cut -d: -f2 | xargs)
            OS_INFO="$(uname -s) $(uname -r)"
            
            # Get system monitoring data
            CPU_USAGE=$(get_cpu_usage)
            GPU_USAGE=$(get_gpu_usage)
            CPU_TEMP=$(get_cpu_temp)
            GPU_TEMP=$(get_gpu_temp)
            POWER_USAGE=$(get_power_usage)
            
            # Report to server with error handling
            response=$(curl -s --connect-timeout 10 -X POST "$SERVER_URL/api/remote-client" \\
                -H "Content-Type: application/json" \\
                -d "{
                    \\"id\\": \\"$CLIENT_ID\\",
                    \\"name\\": \\"$CLIENT_NAME\\",
                    \\"hashrate\\": $HASH_RATE,
                    \\"status\\": \\"mining\\",
                    \\"uptime\\": \\"$UPTIME\\",
                    \\"shares\\": 0,
                    \\"os\\": \\"$OS_INFO\\",
                    \\"cpu\\": \\"$CPU_MODEL\\",
                    \\"cpuUsage\\": $CPU_USAGE,
                    \\"gpuUsage\\": $GPU_USAGE,
                    \\"temperature\\": $CPU_TEMP,
                    \\"gpuTemperature\\": $GPU_TEMP,
                    \\"power\\": $POWER_USAGE
                }" 2>&1)
            
            if [ $? -eq 0 ] && echo "$response" | grep -q "success"; then
                log "✅ Stats reported successfully"
            else
                log "⚠️  Failed to report stats: $response"
                # Try to reconnect
                if ! curl -s --connect-timeout 5 "$SERVER_URL/api/status" >/dev/null; then
                    log "❌ Server connection lost, attempting to reconnect..."
                fi
            fi
        else
            # Report offline
            curl -s --connect-timeout 5 -X POST "$SERVER_URL/api/remote-client" \\
                -H "Content-Type: application/json" \\
                -d "{
                    \\"id\\": \\"$CLIENT_ID\\",
                    \\"name\\": \\"$CLIENT_NAME\\",
                    \\"status\\": \\"offline\\"
                }" || true
        fi
    }
    
    # Monitor miner process and report stats
    while [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; do
        report_stats
        sleep 30
    done
    
    log "❌ Miner process died. Restarting in 10 seconds..."
    sleep 10
done
EOF

chmod +x /home/$USER/mining-client.sh

# Enable and start the service
echo "🚀 Enabling auto-start service..."
sudo systemctl daemon-reload
sudo systemctl enable bitcoin-miner.service
sudo systemctl start bitcoin-miner.service

# Wait a moment and check status
sleep 3
if systemctl is-active --quiet bitcoin-miner.service; then
    echo "✅ Service started successfully"
else
    echo "⚠️  Service may have issues. Check: sudo journalctl -u bitcoin-miner.service"
fi

echo ""
echo "=========================================="
echo "  Installation Complete!"
echo "=========================================="
echo "📊 Monitor: http://${this.serverIP}:3000"
echo "📝 Logs: tail -f /home/$USER/mining.log"
echo "🔧 Service: sudo systemctl status bitcoin-miner.service"
echo "⏹️  Stop: sudo systemctl stop bitcoin-miner.service"
echo "▶️  Start: sudo systemctl start bitcoin-miner.service"
echo ""
echo "✅ Client will auto-start on boot and restart if it crashes"`;
    }

    async fetchPrices() {
        try {
            // Try multiple price APIs for better reliability
            let btcPrice = null;
            let thbRate = null;

            // Try CoinGecko first (more reliable)
            try {
                const cgResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
                const cgData = await cgResponse.json();
                btcPrice = cgData.bitcoin.usd;
                console.log('💰 BTC Price (CoinGecko): $' + btcPrice.toLocaleString());
            } catch (e) {
                console.log('CoinGecko failed, trying CoinDesk...');
            }

            // Fallback to CoinDesk
            if (!btcPrice) {
                try {
                    const btcResponse = await fetch('https://api.coindesk.com/v1/bpi/currentprice.json');
                    const btcData = await btcResponse.json();
                    btcPrice = parseFloat(btcData.bpi.USD.rate.replace(/,/g, ''));
                    console.log('💰 BTC Price (CoinDesk): $' + btcPrice.toLocaleString());
                } catch (e) {
                    console.log('CoinDesk failed, using default...');
                }
            }

            // Try multiple exchange rate APIs
            try {
                const thbResponse = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
                const thbData = await thbResponse.json();
                thbRate = thbData.rates.THB;
                console.log('💱 USD/THB Rate: ' + thbRate);
            } catch (e) {
                console.log('ExchangeRate API failed, trying Fixer...');
                try {
                    const fixerResponse = await fetch('https://api.fixer.io/latest?base=USD&symbols=THB');
                    const fixerData = await fixerResponse.json();
                    thbRate = fixerData.rates.THB;
                    console.log('💱 USD/THB Rate (Fixer): ' + thbRate);
                } catch (e2) {
                    console.log('All exchange rate APIs failed, using default...');
                }
            }

            // Set prices (use defaults if all APIs failed)
            this.btcPrice = btcPrice || 95000; // Updated default BTC price
            this.thbRate = thbRate || 35.5; // Updated default THB rate

            console.log('✅ Final prices - BTC: $' + this.btcPrice.toLocaleString() + ', THB: ' + this.thbRate);
        } catch (error) {
            console.log('⚠️  All price APIs failed, using defaults');
            this.btcPrice = 95000; // Default BTC price
            this.thbRate = 35.5; // Default USD to THB rate
        }
    }

    calculateEarnings() {
        if (!this.isRunning || this.stats.hashrate === 0) {
            this.stats.earnings = {
                btc: { hourly: 0, daily: 0, weekly: 0, monthly: 0 },
                usd: { hourly: 0, daily: 0, weekly: 0, monthly: 0 },
                thb: { hourly: 0, daily: 0, weekly: 0, monthly: 0 }
            };
            return;
        }

        // Bitcoin network difficulty and block reward calculations
        // Updated with more realistic current network stats
        const networkHashrate = 700000000000000; // ~700 EH/s (current Bitcoin network)
        const blockReward = 3.125; // BTC per block after 2024 halving
        const blocksPerDay = 144; // ~10 minutes per block
        
        // Calculate theoretical earnings (before pool fees)
        const myHashrate = this.stats.hashrate * 1000000; // Convert MH/s to H/s
        const hashrateFraction = myHashrate / networkHashrate;
        const btcPerDay = hashrateFraction * blockReward * blocksPerDay;
        
        // Apply pool fee (2.5% for Poolin) and add some realistic variance
        const btcPerDayAfterFees = btcPerDay * 0.975;
        
        // Calculate different time periods
        const btcHourly = btcPerDayAfterFees / 24;
        const btcWeekly = btcPerDayAfterFees * 7;
        const btcMonthly = btcPerDayAfterFees * 30;

        // Ensure minimum values are shown (never exactly zero when mining)
        const minHourlyBtc = Math.max(btcHourly, 0.00000001); // Minimum 1 satoshi equivalent
        const minDailyBtc = Math.max(btcPerDayAfterFees, 0.00000024); // 24x minimum
        const minWeeklyBtc = Math.max(btcWeekly, 0.00000168); // 168x minimum
        const minMonthlyBtc = Math.max(btcMonthly, 0.00000720); // 720x minimum
        
        console.log('💰 Earnings calculated: ' + minHourlyBtc + ' BTC/hour, ' + minDailyBtc + ' BTC/day');

        // Convert to USD and THB
        this.stats.earnings = {
            btc: { 
                hourly: minHourlyBtc, 
                daily: minDailyBtc, 
                weekly: minWeeklyBtc, 
                monthly: minMonthlyBtc 
            },
            usd: { 
                hourly: minHourlyBtc * this.btcPrice, 
                daily: minDailyBtc * this.btcPrice, 
                weekly: minWeeklyBtc * this.btcPrice, 
                monthly: minMonthlyBtc * this.btcPrice 
            },
            thb: { 
                hourly: minHourlyBtc * this.btcPrice * this.thbRate, 
                daily: minDailyBtc * this.btcPrice * this.thbRate, 
                weekly: minWeeklyBtc * this.btcPrice * this.thbRate, 
                monthly: minMonthlyBtc * this.btcPrice * this.thbRate 
            }
        };
    }

    startMonitoring() {
        // Fetch prices initially and every 10 minutes
        this.fetchPrices();
        setInterval(() => this.fetchPrices(), 600000);

        setInterval(() => {
            if (this.isRunning) {
                // Update system stats
                this.stats.temperature = this.getTemperature();
                this.stats.power = this.getPowerUsage();
                this.stats.cpuUsage = this.getCPUUsage();
                this.stats.gpuUsage = this.getGPUUsage();
                this.stats.gpuTemperature = this.getGPUTemperature();
                
                // Store hashrate history for graphs
                this.hashrateHistory.push({
                    timestamp: Date.now(),
                    hashrate: this.hashrate
                });
                
                // Keep only last 100 data points (for graphs)
                if (this.hashrateHistory.length > 100) {
                    this.hashrateHistory.shift();
                }
                
                // Calculate earnings
                this.calculateEarnings();
            }
        }, 5000); // Update every 5 seconds
    }
}

module.exports = MiningManager;

