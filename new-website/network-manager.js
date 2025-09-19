const os = require('os');
const { exec } = require('child_process');
const logger = require('./logger');

class NetworkManager {
    constructor() {
        this.serverIP = this.detectServerIP();
        this.serverPort = 3000;
        this.networkInterfaces = this.getNetworkInterfaces();
        this.firewallRules = [];
        this.dnsServers = [];
        this.networkConfig = {
            autoDetect: true,
            fallbackIPs: [],
            retryAttempts: 5,
            retryDelay: 30000, // 30 seconds
            connectionTimeout: 10000, // 10 seconds
            keepAliveInterval: 30000, // 30 seconds
            maxReconnectAttempts: 10
        };
        
        this.initializeNetwork();
    }

    detectServerIP() {
        const interfaces = os.networkInterfaces();
        
        // Priority order for IP detection
        const priorities = [
            'eth0', 'enp0s3', 'en0', 'wlan0', 'wlp2s0', // Common interface names
            'ens33', 'ens18', 'enp1s0', 'enp2s0' // Virtual machine interfaces
        ];
        
        // First, try to find a non-loopback IPv4 address
        for (const priority of priorities) {
            if (interfaces[priority]) {
                for (const iface of interfaces[priority]) {
                    if (iface.family === 'IPv4' && !iface.internal) {
                        logger.info('Server IP detected via priority interface', { 
                            interface: priority, 
                            ip: iface.address 
                        });
                        return iface.address;
                    }
                }
            }
        }
        
        // Fallback: find any non-loopback IPv4 address
        for (const [name, ifaces] of Object.entries(interfaces)) {
            for (const iface of ifaces) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    logger.info('Server IP detected via fallback', { 
                        interface: name, 
                        ip: iface.address 
                    });
                    return iface.address;
                }
            }
        }
        
        // Last resort: use localhost
        logger.warn('No external IP found, using localhost');
        return '127.0.0.1';
    }

    getNetworkInterfaces() {
        const interfaces = os.networkInterfaces();
        const result = {};
        
        for (const [name, ifaces] of Object.entries(interfaces)) {
            result[name] = ifaces.map(iface => ({
                address: iface.address,
                family: iface.family,
                internal: iface.internal,
                mac: iface.mac,
                netmask: iface.netmask,
                cidr: iface.cidr
            }));
        }
        
        return result;
    }

    initializeNetwork() {
        this.checkFirewallConfiguration();
        this.checkDNSConfiguration();
        this.generateFallbackIPs();
        this.testNetworkConnectivity();
    }

    checkFirewallConfiguration() {
        // Check if firewall is blocking our port
        const commands = [
            'ufw status', // Ubuntu/Debian
            'firewall-cmd --list-ports', // CentOS/RHEL/Fedora
            'iptables -L INPUT -n', // Generic iptables
            'netstat -tlnp | grep :3000' // Check if port is listening
        ];
        
        commands.forEach(cmd => {
            exec(cmd, (error, stdout, stderr) => {
                if (!error) {
                    logger.info('Firewall check completed', { command: cmd, output: stdout.trim() });
                }
            });
        });
    }

    checkDNSConfiguration() {
        // Get DNS servers
        const dnsFiles = [
            '/etc/resolv.conf',
            '/etc/systemd/resolved.conf',
            '/run/systemd/resolve/resolv.conf'
        ];
        
        dnsFiles.forEach(file => {
            try {
                const fs = require('fs');
                if (fs.existsSync(file)) {
                    const content = fs.readFileSync(file, 'utf8');
                    const dnsServers = content.match(/nameserver\s+(\S+)/g);
                    if (dnsServers) {
                        this.dnsServers = dnsServers.map(server => server.split(/\s+/)[1]);
                        logger.info('DNS servers detected', { servers: this.dnsServers });
                    }
                }
            } catch (error) {
                logger.debug('Could not read DNS config', { file, error: error.message });
            }
        });
    }

    generateFallbackIPs() {
        // Generate fallback IPs based on common network ranges
        const baseIP = this.serverIP.split('.').slice(0, 3).join('.');
        const fallbackIPs = [
            `${baseIP}.1`, // Gateway
            `${baseIP}.2`, // Common server IP
            `${baseIP}.100`, // Common server IP
            `${baseIP}.254`, // Common server IP
            '192.168.1.168', // Hardcoded fallback
            '192.168.0.168', // Alternative network
            '10.0.0.168', // Corporate network
            '172.16.0.168' // Docker network
        ];
        
        this.networkConfig.fallbackIPs = [...new Set(fallbackIPs)]; // Remove duplicates
        logger.info('Fallback IPs generated', { fallbacks: this.networkConfig.fallbackIPs });
    }

    async testNetworkConnectivity() {
        const testURLs = [
            `http://${this.serverIP}:${this.serverPort}/api/status`,
            'http://8.8.8.8', // Google DNS
            'http://1.1.1.1', // Cloudflare DNS
            'https://api.coingecko.com/api/v3/ping' // External API
        ];
        
        for (const url of testURLs) {
            try {
                const response = await this.testConnection(url);
                logger.info('Network connectivity test', { url, status: response ? 'success' : 'failed' });
            } catch (error) {
                logger.warn('Network connectivity test failed', { url, error: error.message });
            }
        }
    }

    testConnection(url, timeout = 5000) {
        return new Promise((resolve) => {
            const https = require('https');
            const http = require('http');
            const client = url.startsWith('https') ? https : http;
            
            const req = client.get(url, { timeout }, (res) => {
                resolve(true);
            });
            
            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });
        });
    }

    // Network configuration for clients
    getClientNetworkConfig() {
        return {
            server: {
                primary: {
                    host: this.serverIP,
                    port: this.serverPort,
                    protocol: 'http'
                },
                fallbacks: this.networkConfig.fallbackIPs.map(ip => ({
                    host: ip,
                    port: this.serverPort,
                    protocol: 'http'
                }))
            },
            connection: {
                timeout: this.networkConfig.connectionTimeout,
                retryAttempts: this.networkConfig.retryAttempts,
                retryDelay: this.networkConfig.retryDelay,
                keepAliveInterval: this.networkConfig.keepAliveInterval,
                maxReconnectAttempts: this.networkConfig.maxReconnectAttempts
            },
            dns: {
                servers: this.dnsServers,
                fallbackServers: ['8.8.8.8', '1.1.1.1', '9.9.9.9']
            },
            firewall: {
                autoConfigure: true,
                requiredPorts: [this.serverPort],
                protocols: ['tcp']
            }
        };
    }

    // Generate network diagnostic script for clients
    generateNetworkDiagnosticScript() {
        const serverIPs = [this.serverIP, ...this.networkConfig.fallbackIPs];
        const serverIPsList = serverIPs.join(' ');
        
        return `#!/bin/bash
# Network Diagnostic Script for Mining Client
# Generated by Network Manager

echo "=========================================="
echo "  Network Diagnostic Report"
echo "  Generated: $(date)"
echo "=========================================="

# Basic network info
echo ""
echo "📡 Network Interfaces:"
ip addr show 2>/dev/null || ifconfig 2>/dev/null || echo "Network tools not available"

echo ""
echo "🌐 Default Gateway:"
ip route | grep default 2>/dev/null || route -n | grep '^0.0.0.0' 2>/dev/null || echo "Gateway not found"

echo ""
echo "🔍 DNS Configuration:"
cat /etc/resolv.conf 2>/dev/null || echo "DNS config not accessible"

echo ""
echo "🔥 Firewall Status:"
if command -v ufw >/dev/null 2>&1; then
    ufw status
elif command -v firewall-cmd >/dev/null 2>&1; then
    firewall-cmd --list-ports
elif command -v iptables >/dev/null 2>&1; then
    iptables -L INPUT -n | head -10
else
    echo "No firewall tools found"
fi

echo ""
echo "🌍 Internet Connectivity:"
if ping -c 1 8.8.8.8 >/dev/null 2>&1; then
    echo "✅ Internet connection: OK"
else
    echo "❌ Internet connection: FAILED"
fi

echo ""
echo "🔗 Server Connectivity Test:"
for ip in ${serverIPsList}; do
    if curl -s --connect-timeout 5 "http://$ip:${this.serverPort}/api/status" >/dev/null 2>&1; then
        echo "✅ Server $ip:${this.serverPort} - REACHABLE"
        break
    else
        echo "❌ Server $ip:${this.serverPort} - UNREACHABLE"
    fi
done

echo ""
echo "📊 Network Performance:"
if command -v ping >/dev/null 2>&1; then
    echo "Ping to Google DNS:"
    ping -c 3 8.8.8.8 2>/dev/null | tail -1 || echo "Ping test failed"
fi

echo ""
echo "=========================================="
echo "  Diagnostic Complete"
echo "=========================================="`;
    }

    // Auto-configure firewall for the mining port
    configureFirewall() {
        const port = this.serverPort;
        const commands = [
            // Ubuntu/Debian UFW
            `ufw allow ${port}/tcp`,
            `ufw allow ${port}/udp`,
            
            // CentOS/RHEL/Fedora firewalld
            `firewall-cmd --permanent --add-port=${port}/tcp`,
            `firewall-cmd --permanent --add-port=${port}/udp`,
            `firewall-cmd --reload`,
            
            // Generic iptables
            `iptables -A INPUT -p tcp --dport ${port} -j ACCEPT`,
            `iptables -A INPUT -p udp --dport ${port} -j ACCEPT`
        ];
        
        commands.forEach(cmd => {
            exec(cmd, (error, stdout, stderr) => {
                if (!error) {
                    logger.info('Firewall rule applied', { command: cmd });
                } else {
                    logger.debug('Firewall command failed (expected)', { command: cmd, error: error.message });
                }
            });
        });
    }

    // Network troubleshooting for clients
    troubleshootClientConnection(clientIP) {
        const diagnostics = {
            timestamp: new Date().toISOString(),
            clientIP,
            serverIP: this.serverIP,
            tests: []
        };
        
        // Test basic connectivity
        this.testConnection(`http://${clientIP}:${this.serverPort}/api/status`)
            .then(result => {
                diagnostics.tests.push({
                    test: 'client_reachability',
                    result: result ? 'success' : 'failed',
                    details: result ? 'Client is reachable' : 'Client is not reachable'
                });
            });
        
        // Test DNS resolution
        const dns = require('dns');
        dns.lookup(clientIP, (err, address) => {
            diagnostics.tests.push({
                test: 'dns_resolution',
                result: err ? 'failed' : 'success',
                details: err ? err.message : `Resolved to ${address}`
            });
        });
        
        return diagnostics;
    }

    // Get network status for dashboard
    getNetworkStatus() {
        return {
            server: {
                ip: this.serverIP,
                port: this.serverPort,
                interfaces: this.networkInterfaces
            },
            connectivity: {
                dnsServers: this.dnsServers,
                fallbackIPs: this.networkConfig.fallbackIPs,
                lastTest: new Date().toISOString()
            },
            configuration: this.networkConfig,
            diagnostics: {
                script: this.generateNetworkDiagnosticScript()
            }
        };
    }

    // Update network configuration
    updateNetworkConfig(newConfig) {
        this.networkConfig = { ...this.networkConfig, ...newConfig };
        logger.info('Network configuration updated', { config: this.networkConfig });
    }
}

module.exports = NetworkManager;