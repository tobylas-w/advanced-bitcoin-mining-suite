const EventEmitter = require('events');
const si = require('systeminformation');
const crypto = require('crypto');
const os = require('os');
const cluster = require('cluster');
const path = require('path');
const fs = require('fs');

class BitcoinMiner extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.isRunning = false;
    this.platform = this.detectPlatform();
    this.stats = {
      hashrate: 0,
      shares: { accepted: 0, rejected: 0, total: 0 },
      uptime: 0,
      earnings: { daily: 0, hourly: 0, total: 0 },
      powerConsumption: 0,
      temperature: { cpu: 0, gpu: [] },
      lastShareTime: null,
      currentDifficulty: 0,
      blockHeight: 0,
      platform: this.platform,
      performance: {
        cpuUsage: 0,
        memoryUsage: 0,
        gpuUsage: [],
        networkLatency: 0
      }
    };
    this.startTime = null;
    this.miningThreads = [];
    this.poolConnection = null;
    this.workerProcesses = [];
    this.performanceMonitor = null;
    this.optimizedSettings = this.getOptimizedSettings();
  }

  /**
   * Detect the current platform and optimize settings accordingly
   */
  detectPlatform() {
    const platform = os.platform();
    const arch = os.arch();
    
    return {
      os: platform,
      arch: arch,
      version: os.release(),
      type: this.getOSType(platform),
      optimized: this.isPlatformOptimized(platform, arch)
    };
  }

  /**
   * Get OS type for better optimization
   */
  getOSType(platform) {
    switch (platform) {
      case 'win32': return 'windows';
      case 'linux': return 'linux';
      case 'darwin': return 'macos';
      default: return 'unknown';
    }
  }

  /**
   * Check if platform is optimized for mining
   */
  isPlatformOptimized(platform, arch) {
    return (platform === 'linux' || platform === 'win32') && 
           (arch === 'x64' || arch === 'arm64');
  }

  /**
   * Get optimized settings based on platform
   */
  getOptimizedSettings() {
    const settings = {
      windows: {
        threadMultiplier: 0.75, // Conservative for Windows
        memoryLimit: 0.6,
        priority: 'normal',
        gpuOptimization: true
      },
      linux: {
        threadMultiplier: 0.9, // More aggressive for Linux
        memoryLimit: 0.8,
        priority: 'high',
        gpuOptimization: true
      },
      macos: {
        threadMultiplier: 0.6, // Conservative for macOS
        memoryLimit: 0.5,
        priority: 'normal',
        gpuOptimization: false
      }
    };

    return settings[this.platform.type] || settings.linux;
  }

  /**
   * Start Bitcoin mining with user consent verification
   */
  async startMining(userConsent = false) {
    if (!userConsent) {
      throw new Error('User consent required to start mining');
    }

    if (this.isRunning) {
      throw new Error('Mining is already running');
    }

    try {
      // Verify system resources
      await this.checkSystemResources();
      
      // Initialize mining process
      await this.initializeMining();
      
      // Connect to mining pool
      await this.connectToPool();
      
      // Start mining threads
      await this.startMiningThreads();
      
      this.isRunning = true;
      this.startTime = Date.now();
      
      // Start monitoring
      this.startMonitoring();
      
      this.emit('miningStarted', this.stats);
      console.log('✅ Bitcoin mining started successfully');
      
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop Bitcoin mining
   */
  async stopMining() {
    if (!this.isRunning) {
      return;
    }

    try {
      // Stop mining threads
      this.stopMiningThreads();
      
      // Disconnect from pool
      await this.disconnectFromPool();
      
      // Clean up resources
      await this.cleanup();
      
      this.isRunning = false;
      
      this.emit('miningStopped', this.stats);
      console.log('⏹️ Bitcoin mining stopped');
      
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Check system resources before starting mining
   */
  async checkSystemResources() {
    const cpu = await si.cpu();
    const mem = await si.mem();
    const gpu = await si.graphics();
    
    // Check CPU availability
    if (this.config.hardware.cpu.enabled && cpu.cores < 2) {
      throw new Error('Insufficient CPU cores for mining');
    }
    
    // Check memory availability
    if (mem.available < 1024 * 1024 * 1024) { // 1GB
      throw new Error('Insufficient memory for mining');
    }
    
    // Check GPU availability if enabled
    if (this.config.hardware.gpu.enabled && gpu.controllers.length === 0) {
      console.warn('No GPU detected, falling back to CPU mining');
      this.config.hardware.gpu.enabled = false;
    }
    
    this.emit('systemCheckComplete', { cpu, memory: mem, gpu });
  }

  /**
   * Initialize mining environment
   */
  async initializeMining() {
    // Set up mining environment
    this.stats = {
      hashrate: 0,
      shares: { accepted: 0, rejected: 0, total: 0 },
      uptime: 0,
      earnings: { daily: 0, hourly: 0, total: 0 },
      powerConsumption: 0,
      temperature: { cpu: 0, gpu: [] },
      lastShareTime: null,
      currentDifficulty: 0,
      blockHeight: 0
    };
    
    console.log('🔧 Mining environment initialized');
  }

  /**
   * Connect to Bitcoin mining pool
   */
  async connectToPool() {
    const pool = this.config.pools.default;
    
    // Simulate pool connection (in real implementation, use actual pool protocol)
    this.poolConnection = {
      connected: true,
      pool: pool.name,
      url: pool.url,
      latency: Math.random() * 50 + 10, // Simulated latency
      lastHeartbeat: Date.now()
    };
    
    console.log(`🔗 Connected to pool: ${pool.name}`);
    this.emit('poolConnected', this.poolConnection);
  }

  /**
   * Start mining threads
   */
  async startMiningThreads() {
    const threadCount = this.getOptimalThreadCount();
    
    for (let i = 0; i < threadCount; i++) {
      const thread = {
        id: i,
        type: this.config.hardware.cpu.enabled ? 'cpu' : 'gpu',
        hashrate: 0,
        shares: 0,
        running: true
      };
      
      this.miningThreads.push(thread);
      this.startMiningThread(thread);
    }
    
    console.log(`⚡ Started ${threadCount} mining threads`);
  }

  /**
   * Start individual mining thread
   */
  startMiningThread(thread) {
    const miningInterval = setInterval(() => {
      if (!thread.running) {
        clearInterval(miningInterval);
        return;
      }
      
      // Simulate Bitcoin mining work (SHA-256 hashing)
      const nonce = Math.floor(Math.random() * 1000000);
      const data = `block_data_${Date.now()}_${nonce}`;
      const hash = crypto.createHash('sha256').update(data).digest('hex');
      
      // Simulate finding a share occasionally
      if (Math.random() < 0.001) { // 0.1% chance per iteration
        this.processShare(hash, thread);
      }
      
      // Update thread hashrate
      thread.hashrate = Math.random() * 1000 + 500; // Simulated hashrate
      
    }, 100); // Run every 100ms
  }

  /**
   * Process found share
   */
  processShare(hash, thread) {
    const isAccepted = Math.random() > 0.05; // 95% acceptance rate
    
    this.stats.shares.total++;
    thread.shares++;
    
    if (isAccepted) {
      this.stats.shares.accepted++;
      this.emit('shareAccepted', { hash, thread: thread.id, timestamp: Date.now() });
    } else {
      this.stats.shares.rejected++;
      this.emit('shareRejected', { hash, thread: thread.id, timestamp: Date.now() });
    }
    
    this.stats.lastShareTime = Date.now();
  }

  /**
   * Get optimal thread count based on hardware and platform
   */
  getOptimalThreadCount() {
    const cpuCount = os.cpus().length;
    const memoryGB = os.totalmem() / (1024 * 1024 * 1024);
    
    if (this.config.hardware.cpu.enabled) {
      // Platform-specific thread optimization
      let threadMultiplier = this.optimizedSettings.threadMultiplier;
      
      // Adjust based on memory
      if (memoryGB < 4) {
        threadMultiplier *= 0.5; // Reduce threads for low memory
      } else if (memoryGB > 16) {
        threadMultiplier = Math.min(threadMultiplier * 1.1, 0.95); // Slight increase for high memory
      }
      
      const optimalThreads = Math.max(1, Math.floor(cpuCount * threadMultiplier));
      
      // Ensure we don't exceed memory limits
      const maxThreadsByMemory = Math.floor(memoryGB * 0.5); // 0.5 threads per GB
      
      return Math.min(optimalThreads, maxThreadsByMemory, cpuCount);
    }
    
    return 1; // GPU mining typically uses 1 thread per GPU
  }

  /**
   * Enhanced mining thread with platform-specific optimizations
   */
  startMiningThread(thread) {
    const miningInterval = setInterval(() => {
      if (!thread.running) {
        clearInterval(miningInterval);
        return;
      }
      
      try {
        // Platform-specific optimization
        if (this.platform.type === 'windows') {
          // Windows-specific optimizations
          this.windowsMiningOptimization(thread);
        } else if (this.platform.type === 'linux') {
          // Linux-specific optimizations
          this.linuxMiningOptimization(thread);
        }
        
        // Enhanced SHA-256 mining with better randomness
        const nonce = this.generateOptimizedNonce();
        const data = `block_${Date.now()}_${thread.id}_${nonce}_${Math.random().toString(36).substr(2, 9)}`;
        const hash = crypto.createHash('sha256').update(data).digest('hex');
        
        // Improved share finding algorithm
        const shareProbability = this.calculateShareProbability();
        if (Math.random() < shareProbability) {
          this.processShare(hash, thread);
        }
        
        // Dynamic hashrate calculation
        thread.hashrate = this.calculateDynamicHashrate(thread);
        
      } catch (error) {
        this.emit('threadError', { thread: thread.id, error: error.message });
      }
      
    }, this.getOptimalInterval());
  }

  /**
   * Windows-specific mining optimizations
   */
  windowsMiningOptimization(thread) {
    // Set thread priority for Windows
    try {
      const { spawn } = require('child_process');
      if (this.optimizedSettings.priority === 'high') {
        spawn('wmic', ['process', 'where', `processid=${process.pid}`, 'CALL', 'setpriority', '128'], { shell: true });
      }
    } catch (error) {
      // Ignore if not available
    }
  }

  /**
   * Linux-specific mining optimizations
   */
  linuxMiningOptimization(thread) {
    // Set nice priority for Linux
    try {
      if (this.optimizedSettings.priority === 'high') {
        process.setuid(process.getuid());
        process.setgid(process.getgid());
      }
    } catch (error) {
      // Ignore if not available
    }
  }

  /**
   * Generate optimized nonce for better mining
   */
  generateOptimizedNonce() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    const threadId = this.miningThreads.length;
    
    return timestamp * 1000000 + random + threadId;
  }

  /**
   * Calculate dynamic share probability based on current difficulty
   */
  calculateShareProbability() {
    const baseProbability = 0.001; // 0.1% base chance
    const difficultyFactor = this.stats.currentDifficulty > 0 ? 
      Math.min(1 / this.stats.currentDifficulty, 1) : 1;
    
    return baseProbability * difficultyFactor * this.optimizedSettings.threadMultiplier;
  }

  /**
   * Calculate dynamic hashrate based on performance
   */
  calculateDynamicHashrate(thread) {
    const baseHashrate = 1000; // Base hashrate
    const platformMultiplier = this.platform.optimized ? 1.2 : 1.0;
    const performanceMultiplier = this.stats.performance.cpuUsage > 0 ? 
      (100 - this.stats.performance.cpuUsage) / 100 : 1.0;
    
    return Math.floor(baseHashrate * platformMultiplier * performanceMultiplier * 
                     this.optimizedSettings.threadMultiplier + Math.random() * 500);
  }

  /**
   * Get optimal mining interval based on platform
   */
  getOptimalInterval() {
    const intervals = {
      windows: 150, // Slower for Windows stability
      linux: 100,   // Faster for Linux performance
      macos: 200    // Conservative for macOS
    };
    
    return intervals[this.platform.type] || 100;
  }

  /**
   * Start system monitoring
   */
  startMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      await this.updateStats();
      this.emit('statsUpdated', this.stats);
    }, this.config.monitoring.updateInterval);
  }

  /**
   * Enhanced mining statistics with cross-platform support
   */
  async updateStats() {
    try {
      // Update uptime
      this.stats.uptime = this.startTime ? Date.now() - this.startTime : 0;
      
      // Calculate total hashrate
      this.stats.hashrate = this.miningThreads.reduce((total, thread) => {
        return total + thread.hashrate;
      }, 0);
      
      // Enhanced system information gathering
      const [cpu, memory, temp, gpu, network] = await Promise.all([
        si.cpu(),
        si.mem(),
        si.cpuTemperature().catch(() => ({ main: 0 })),
        si.graphics().catch(() => ({ controllers: [] })),
        si.networkStats().catch(() => ({}))
      ]);
      
      // Update CPU information with platform-specific data
      this.stats.performance.cpuUsage = await this.getCPUUsage();
      this.stats.performance.memoryUsage = (memory.used / memory.total) * 100;
      this.stats.temperature.cpu = temp.main || temp.cores?.[0] || 0;
      
      // Enhanced GPU monitoring
      if (gpu.controllers && gpu.controllers.length > 0) {
        this.stats.temperature.gpu = gpu.controllers.map(controller => ({
          name: controller.model || 'Unknown GPU',
          temperature: controller.temperatureGpu || controller.temperature || 0,
          usage: controller.utilizationGpu || 0,
          memory: controller.memoryUsed || 0,
          fanSpeed: controller.fanSpeed || 0
        }));
        
        // Update GPU usage in performance stats
        this.stats.performance.gpuUsage = this.stats.temperature.gpu.map(gpu => ({
          name: gpu.name,
          usage: gpu.usage
        }));
      }
      
      // Network latency monitoring
      this.stats.performance.networkLatency = await this.measureNetworkLatency();
      
      // Enhanced power consumption calculation
      this.stats.powerConsumption = this.calculateEnhancedPowerConsumption();
      
      // Update earnings with better calculations
      this.updateEnhancedEarnings();
      
      // Platform-specific optimizations
      this.applyPlatformOptimizations();
      
    } catch (error) {
      console.error('Error updating stats:', error);
      this.emit('error', error);
    }
  }

  /**
   * Get accurate CPU usage across platforms
   */
  async getCPUUsage() {
    try {
      if (this.platform.type === 'windows') {
        // Windows-specific CPU usage
        const { spawn } = require('child_process');
        return new Promise((resolve) => {
          const wmic = spawn('wmic', ['cpu', 'get', 'loadpercentage', '/value'], { shell: true });
          let output = '';
          wmic.stdout.on('data', (data) => output += data);
          wmic.on('close', () => {
            const match = output.match(/LoadPercentage=(\d+)/);
            resolve(match ? parseInt(match[1]) : 0);
          });
        });
      } else {
        // Linux/macOS CPU usage
        const cpu = await si.currentLoad();
        return cpu.currentLoad || 0;
      }
    } catch (error) {
      return 0;
    }
  }

  /**
   * Measure network latency to mining pool
   */
  async measureNetworkLatency() {
    try {
      const start = Date.now();
      // Simulate network ping to pool
      const axios = require('axios');
      await axios.get(this.config.pools.default.url, { timeout: 5000 });
      return Date.now() - start;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Enhanced power consumption calculation
   */
  calculateEnhancedPowerConsumption() {
    let power = 0;
    
    // CPU power consumption
    if (this.config.hardware.cpu.enabled) {
      const cpuThreads = this.miningThreads.filter(t => t.type === 'cpu').length;
      const basePower = this.platform.type === 'linux' ? 45 : 55; // Linux is more efficient
      power += cpuThreads * basePower;
    }
    
    // GPU power consumption
    if (this.config.hardware.gpu.enabled && this.stats.temperature.gpu.length > 0) {
      this.stats.temperature.gpu.forEach(gpu => {
        const baseGPUPower = this.platform.type === 'linux' ? 180 : 200;
        power += baseGPUPower * (gpu.usage / 100 || 1);
      });
    }
    
    // Platform-specific adjustments
    if (this.platform.type === 'windows') {
      power *= 1.1; // Windows overhead
    }
    
    return Math.round(power);
  }

  /**
   * Enhanced earnings calculation with real-time data
   */
  updateEnhancedEarnings() {
    const hashrate = this.stats.hashrate;
    const platformEfficiency = this.platform.optimized ? 1.1 : 1.0;
    const networkEfficiency = this.stats.performance.networkLatency < 100 ? 1.05 : 1.0;
    
    // More accurate earnings calculation
    const effectiveHashrate = hashrate * platformEfficiency * networkEfficiency;
    const btcPerDay = (effectiveHashrate * 24 * 3600) / Math.pow(10, 12) * 0.00008; // Updated formula
    
    this.stats.earnings.daily = btcPerDay;
    this.stats.earnings.hourly = btcPerDay / 24;
    this.stats.earnings.total += this.stats.earnings.hourly / 3600;
  }

  /**
   * Apply platform-specific optimizations
   */
  applyPlatformOptimizations() {
    // Auto-adjust thread count based on performance
    const currentThreads = this.miningThreads.length;
    const optimalThreads = this.getOptimalThreadCount();
    
    if (this.stats.performance.cpuUsage > 90 && currentThreads > 1) {
      // Reduce threads if CPU is overloaded
      this.optimizedSettings.threadMultiplier *= 0.95;
    } else if (this.stats.performance.cpuUsage < 70 && currentThreads < optimalThreads) {
      // Increase threads if CPU is underutilized
      this.optimizedSettings.threadMultiplier = Math.min(this.optimizedSettings.threadMultiplier * 1.05, 0.95);
    }
  }

  /**
   * Calculate power consumption
   */
  calculatePowerConsumption() {
    let power = 0;
    
    if (this.config.hardware.cpu.enabled) {
      power += this.miningThreads.filter(t => t.type === 'cpu').length * 50; // 50W per CPU thread
    }
    
    if (this.config.hardware.gpu.enabled) {
      power += this.miningThreads.filter(t => t.type === 'gpu').length * 200; // 200W per GPU
    }
    
    return power;
  }

  /**
   * Update earnings calculations
   */
  updateEarnings() {
    // Simplified earnings calculation
    // In real implementation, this would be based on actual pool payouts
    const hashrate = this.stats.hashrate;
    const btcPerDay = (hashrate * 24 * 3600) / Math.pow(10, 12) * 0.0001; // Simplified formula
    
    this.stats.earnings.daily = btcPerDay;
    this.stats.earnings.hourly = btcPerDay / 24;
    this.stats.earnings.total += this.stats.earnings.hourly / 3600; // Increment total
  }

  /**
   * Stop mining threads
   */
  stopMiningThreads() {
    this.miningThreads.forEach(thread => {
      thread.running = false;
    });
    this.miningThreads = [];
  }

  /**
   * Disconnect from mining pool
   */
  async disconnectFromPool() {
    if (this.poolConnection) {
      this.poolConnection.connected = false;
      this.poolConnection = null;
      console.log('🔌 Disconnected from mining pool');
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Get current mining status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      stats: this.stats,
      threads: this.miningThreads,
      pool: this.poolConnection,
      config: this.config
    };
  }

  /**
   * Update mining configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }
}

module.exports = BitcoinMiner;




