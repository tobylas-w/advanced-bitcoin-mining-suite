const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, 'logs');
        this.ensureLogDir();
    }

    ensureLogDir() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`;
    }

    writeToFile(filename, message) {
        const logFile = path.join(this.logDir, filename);
        fs.appendFileSync(logFile, message);
        
        // Rotate log file if it's too large (>10MB)
        const stats = fs.statSync(logFile);
        if (stats.size > 10 * 1024 * 1024) {
            const rotatedFile = logFile.replace('.log', `-${Date.now()}.log`);
            fs.renameSync(logFile, rotatedFile);
        }
    }

    info(message, meta = {}) {
        const formatted = this.formatMessage('info', message, meta);
        console.log(`ℹ️  ${message}`);
        this.writeToFile('info.log', formatted);
    }

    warn(message, meta = {}) {
        const formatted = this.formatMessage('warn', message, meta);
        console.warn(`⚠️  ${message}`);
        this.writeToFile('warn.log', formatted);
    }

    error(message, meta = {}) {
        const formatted = this.formatMessage('error', message, meta);
        console.error(`❌ ${message}`);
        this.writeToFile('error.log', formatted);
    }

    debug(message, meta = {}) {
        if (process.env.NODE_ENV === 'development') {
            const formatted = this.formatMessage('debug', message, meta);
            console.debug(`🔍 ${message}`);
            this.writeToFile('debug.log', formatted);
        }
    }

    mining(message, meta = {}) {
        const formatted = this.formatMessage('mining', message, meta);
        console.log(`⛏️  ${message}`);
        this.writeToFile('mining.log', formatted);
    }
}

module.exports = new Logger();
