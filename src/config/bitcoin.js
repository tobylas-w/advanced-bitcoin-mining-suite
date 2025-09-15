const bitcoinConfig = {
  // Bitcoin Network Configuration
  network: {
    mainnet: {
      difficulty: 'auto', // Auto-adjust based on network
      blockTime: 600, // 10 minutes in seconds
      halvingBlocks: 210000,
      nextHalving: 1050000, // Approximate
    },
    testnet: {
      difficulty: 'auto',
      blockTime: 600,
      halvingBlocks: 210000,
      nextHalving: 1050000,
    }
  },

  // Mining Pool Configuration
  pools: {
    default: {
      name: 'Bitcoin Pool',
      url: 'stratum+tcp://pool.bitcoin.com:3333',
      backup: [
        'stratum+tcp://btc.f2pool.com:3333',
        'stratum+tcp://pool.viabtc.com:3333',
        'stratum+tcp://btc.ss.poolin.com:443'
      ],
      user: 'wallet_address',
      pass: 'worker_name',
      algo: 'sha256'
    }
  },

  // Mining Algorithms
  algorithms: {
    sha256: {
      name: 'SHA-256',
      description: 'Bitcoin\'s proof-of-work algorithm',
      efficiency: 'high',
      powerConsumption: 'medium'
    }
  },

  // Hardware Optimization
  hardware: {
    cpu: {
      enabled: true,
      threads: 'auto', // Auto-detect optimal thread count
      intensity: 8, // 1-10 scale
      priority: 'normal'
    },
    gpu: {
      enabled: true,
      devices: 'all', // Use all available GPUs
      intensity: 18, // 1-25 scale
      memory: 'auto',
      powerLimit: 100 // Percentage
    },
    asic: {
      enabled: false, // Set to true if ASIC miners are connected
      devices: [],
      pool: 'default'
    }
  },

  // Performance Monitoring
  monitoring: {
    updateInterval: 5000, // 5 seconds
    historyRetention: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    alerts: {
      hashrateDrop: 0.8, // Alert if hashrate drops below 80%
      temperatureHigh: 85, // Alert if temperature exceeds 85°C
      powerHigh: 0.9, // Alert if power usage exceeds 90% of limit
      connectionLost: 30000 // Alert if no shares for 30 seconds
    }
  },

  // User Interface
  ui: {
    showAdvanced: false,
    theme: 'dark',
    language: 'en',
    currency: 'USD',
    timezone: 'UTC'
  },

  // Security
  security: {
    requireAuth: true,
    sessionTimeout: 3600000, // 1 hour
    maxFailedAttempts: 3,
    encryptionEnabled: true
  },

  // Notifications
  notifications: {
    desktop: true,
    email: false,
    webhook: false,
    sound: true,
    vibration: false
  }
};

module.exports = bitcoinConfig;




