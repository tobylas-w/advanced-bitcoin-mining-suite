const os = require('os');

const clientConfig = {
    // Central server configuration
    centralServer: {
        host: 'localhost', // Change this to your host computer's IP
        port: 3000,
        protocol: 'http'
    },

    // Mining configuration
    mining: {
        defaultIntensity: 5,
        cpuMining: true,
        gpuMining: true,
        maxTemperature: 85,
        updateInterval: 5000
    },

    // Client identification
    client: {
        hostname: os.hostname(),
        platform: os.platform(),
        version: '1.0.0',
        autoReconnect: true,
        reconnectInterval: 5000,
        heartbeatInterval: 30000
    },

    // Logging configuration
    logging: {
        level: 'info', // 'debug', 'info', 'warn', 'error'
        file: true,
        console: true,
        maxFileSize: '10MB',
        maxFiles: 5
    },

    // Performance monitoring
    monitoring: {
        systemCheckInterval: 10000,
        statsUpdateInterval: 5000,
        temperatureAlert: 80,
        cpuUsageAlert: 95,
        memoryUsageAlert: 90
    }
};

module.exports = clientConfig;


