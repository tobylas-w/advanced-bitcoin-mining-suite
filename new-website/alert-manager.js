const nodemailer = require('nodemailer');
const logger = require('./logger');

class AlertManager {
    constructor() {
        this.alerts = [];
        this.config = {
            email: {
                enabled: process.env.EMAIL_ALERTS === 'true',
                smtp: {
                    host: process.env.SMTP_HOST || 'smtp.gmail.com',
                    port: parseInt(process.env.SMTP_PORT) || 587,
                    secure: process.env.SMTP_SECURE === 'true',
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    }
                },
                to: process.env.ALERT_EMAIL || '',
                from: process.env.SMTP_USER || ''
            },
            webhook: {
                enabled: process.env.WEBHOOK_ALERTS === 'true',
                url: process.env.WEBHOOK_URL || ''
            },
            thresholds: {
                highTemp: 85, // °C
                highPower: 300, // Watts
                lowHashrate: 0.1, // MH/s
                highCpuUsage: 95, // %
                highMemoryUsage: 90, // %
                lowProfitability: -0.1 // BTC/day
            }
        };
        
        this.transporter = null;
        this.initializeEmail();
    }

    initializeEmail() {
        if (this.config.email.enabled && this.config.email.auth.user && this.config.email.auth.pass) {
            this.transporter = nodemailer.createTransporter(this.config.email.smtp);
            logger.info('Email alerts configured', { 
                host: this.config.email.smtp.host,
                to: this.config.email.to 
            });
        }
    }

    async sendAlert(type, severity, message, data = {}) {
        const alert = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            type,
            severity,
            message,
            data
        };

        this.alerts.push(alert);
        
        // Keep only last 100 alerts
        if (this.alerts.length > 100) {
            this.alerts = this.alerts.slice(-100);
        }

        logger.warn(`Alert: ${type} - ${message}`, { severity, data });

        // Send email alert for critical issues
        if (severity === 'critical' && this.config.email.enabled) {
            await this.sendEmailAlert(alert);
        }

        // Send webhook alert
        if (this.config.webhook.enabled) {
            await this.sendWebhookAlert(alert);
        }

        return alert;
    }

    async sendEmailAlert(alert) {
        if (!this.transporter || !this.config.email.to) return;

        try {
            const mailOptions = {
                from: this.config.email.from,
                to: this.config.email.to,
                subject: `🚨 Mining Alert: ${alert.type} - ${alert.severity.toUpperCase()}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #ff4444;">🚨 Bitcoin Mining Alert</h2>
                        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3>Alert Details</h3>
                            <p><strong>Type:</strong> ${alert.type}</p>
                            <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
                            <p><strong>Time:</strong> ${new Date(alert.timestamp).toLocaleString()}</p>
                            <p><strong>Message:</strong> ${alert.message}</p>
                        </div>
                        ${Object.keys(alert.data).length > 0 ? `
                        <div style="background: #e8f4f8; padding: 15px; border-radius: 8px;">
                            <h4>Additional Data:</h4>
                            <pre style="background: white; padding: 10px; border-radius: 4px; overflow-x: auto;">${JSON.stringify(alert.data, null, 2)}</pre>
                        </div>
                        ` : ''}
                        <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 8px;">
                            <p><strong>Dashboard:</strong> <a href="http://192.168.1.168:3000">http://192.168.1.168:3000</a></p>
                            <p><strong>Server IP:</strong> 192.168.1.168:3000</p>
                        </div>
                    </div>
                `
            };

            await this.transporter.sendMail(mailOptions);
            logger.info('Email alert sent successfully', { alertId: alert.id });
        } catch (error) {
            logger.error('Failed to send email alert', { error: error.message, alertId: alert.id });
        }
    }

    async sendWebhookAlert(alert) {
        if (!this.config.webhook.url) return;

        try {
            const response = await fetch(this.config.webhook.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: `🚨 Mining Alert: ${alert.type} - ${alert.severity.toUpperCase()}`,
                    attachments: [{
                        color: alert.severity === 'critical' ? 'danger' : 'warning',
                        fields: [
                            { title: 'Type', value: alert.type, short: true },
                            { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
                            { title: 'Time', value: new Date(alert.timestamp).toLocaleString(), short: true },
                            { title: 'Message', value: alert.message, short: false }
                        ]
                    }]
                })
            });

            if (response.ok) {
                logger.info('Webhook alert sent successfully', { alertId: alert.id });
            } else {
                logger.error('Webhook alert failed', { status: response.status, alertId: alert.id });
            }
        } catch (error) {
            logger.error('Failed to send webhook alert', { error: error.message, alertId: alert.id });
        }
    }

    checkThresholds(metrics) {
        const checks = [];

        // Temperature check
        if (metrics.temperature > this.config.thresholds.highTemp) {
            checks.push({
                type: 'high_temperature',
                severity: 'critical',
                message: `High temperature detected: ${metrics.temperature}°C (threshold: ${this.config.thresholds.highTemp}°C)`,
                data: { temperature: metrics.temperature, threshold: this.config.thresholds.highTemp }
            });
        }

        // Power check
        if (metrics.power > this.config.thresholds.highPower) {
            checks.push({
                type: 'high_power',
                severity: 'warning',
                message: `High power consumption: ${metrics.power}W (threshold: ${this.config.thresholds.highPower}W)`,
                data: { power: metrics.power, threshold: this.config.thresholds.highPower }
            });
        }

        // Hashrate check
        if (metrics.hashrate < this.config.thresholds.lowHashrate) {
            checks.push({
                type: 'low_hashrate',
                severity: 'warning',
                message: `Low hashrate detected: ${metrics.hashrate} MH/s (threshold: ${this.config.thresholds.lowHashrate} MH/s)`,
                data: { hashrate: metrics.hashrate, threshold: this.config.thresholds.lowHashrate }
            });
        }

        // CPU usage check
        if (metrics.cpuUsage > this.config.thresholds.highCpuUsage) {
            checks.push({
                type: 'high_cpu_usage',
                severity: 'warning',
                message: `High CPU usage: ${metrics.cpuUsage}% (threshold: ${this.config.thresholds.highCpuUsage}%)`,
                data: { cpuUsage: metrics.cpuUsage, threshold: this.config.thresholds.highCpuUsage }
            });
        }

        // Memory usage check
        if (metrics.memoryUsage > this.config.thresholds.highMemoryUsage) {
            checks.push({
                type: 'high_memory_usage',
                severity: 'warning',
                message: `High memory usage: ${metrics.memoryUsage}% (threshold: ${this.config.thresholds.highMemoryUsage}%)`,
                data: { memoryUsage: metrics.memoryUsage, threshold: this.config.thresholds.highMemoryUsage }
            });
        }

        // Profitability check
        if (metrics.profitability < this.config.thresholds.lowProfitability) {
            checks.push({
                type: 'low_profitability',
                severity: 'warning',
                message: `Low profitability: ${metrics.profitability} BTC/day (threshold: ${this.config.thresholds.lowProfitability} BTC/day)`,
                data: { profitability: metrics.profitability, threshold: this.config.thresholds.lowProfitability }
            });
        }

        return checks;
    }

    async processMetrics(metrics) {
        const thresholdChecks = this.checkThresholds(metrics);
        
        for (const check of thresholdChecks) {
            await this.sendAlert(check.type, check.severity, check.message, check.data);
        }
    }

    getAlerts(limit = 50) {
        return this.alerts.slice(-limit).reverse();
    }

    getAlertStats() {
        const stats = {
            total: this.alerts.length,
            critical: this.alerts.filter(a => a.severity === 'critical').length,
            warning: this.alerts.filter(a => a.severity === 'warning').length,
            info: this.alerts.filter(a => a.severity === 'info').length,
            last24h: this.alerts.filter(a => 
                new Date(a.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
            ).length
        };
        return stats;
    }

    clearAlerts() {
        this.alerts = [];
        logger.info('All alerts cleared');
    }
}

module.exports = AlertManager;
