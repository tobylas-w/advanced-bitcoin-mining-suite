const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Ubuntu Deployment Script
 * Creates an automated installer for Ubuntu/Debian systems
 */
class UbuntuDeployment {
    constructor(config = {}) {
        this.config = {
            serverUrl: config.serverUrl || 'http://localhost:3000',
            installPath: config.installPath || '/opt/bitcoin-miner',
            userService: true,
            systemService: false,
            autoStart: false,
            ...config
        };
    }

    /**
     * Generate Ubuntu installer script
     */
    generateInstaller() {
        const installerScript = `#!/bin/bash

# Bitcoin Mining Client - Ubuntu/Debian Installer
# Requires sudo privileges

set -e

echo "========================================"
echo "   Bitcoin Mining Client Installer"
echo "   Ubuntu/Debian Compatible"
echo "========================================"
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "This installer requires sudo privileges."
    echo "Please run with: sudo bash install.sh"
    exit 1
fi

# Update package list
echo "Updating package list..."
apt update

# Install Node.js if not present
echo "Checking for Node.js..."
if ! command -v node &> /dev/null; then
    echo "Node.js not found. Installing..."
    
    # Install Node.js 18.x
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
    
    echo "Node.js installed successfully"
else
    echo "Node.js found: $(node --version)"
fi

# Install additional dependencies
echo "Installing additional dependencies..."
apt-get install -y curl wget build-essential

# Create installation directory
echo "Creating installation directory..."
mkdir -p "${this.config.installPath}"
cd "${this.config.installPath}"

# Create client files
echo "Creating client files..."

# Create client.js
cat > client.js << 'EOF'
const CrossPlatformClient = require('./CrossPlatformClient');

const config = {
    serverUrl: '${this.config.serverUrl}',
    platform: 'linux'
};

const client = new CrossPlatformClient(config);

client.connect().then(() => {
    console.log('Connected to mining server');
    console.log('Client ID:', client.clientId);
}).catch(console.error);

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down...');
    client.disconnect().then(() => process.exit(0));
});

process.on('SIGTERM', () => {
    console.log('Shutting down...');
    client.disconnect().then(() => process.exit(0));
});
EOF

# Create package.json
cat > package.json << 'EOF'
{
  "name": "bitcoin-mining-client",
  "version": "2.0.0",
  "main": "client.js",
  "dependencies": {
    "axios": "^1.6.0",
    "systeminformation": "^5.21.15"
  }
}
EOF

# Install dependencies
echo "Installing Node.js dependencies..."
npm install --production --silent

# Create startup script
echo "Creating startup script..."
cat > start-miner.sh << 'EOF'
#!/bin/bash
cd "${this.config.installPath}"
node client.js
EOF

chmod +x start-miner.sh

# Create systemd service file
echo "Creating systemd service..."
cat > /etc/systemd/system/bitcoin-miner.service << 'EOF'
[Unit]
Description=Bitcoin Mining Client
After=network.target

[Service]
Type=simple
User=mining
Group=mining
WorkingDirectory=${this.config.installPath}
ExecStart=/usr/bin/node client.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${this.config.installPath}

[Install]
WantedBy=multi-user.target
EOF

# Create mining user
echo "Creating mining user..."
if ! id "mining" &>/dev/null; then
    useradd -r -s /bin/false mining
fi

# Set ownership
chown -R mining:mining "${this.config.installPath}"
chmod 755 "${this.config.installPath}"

# Configure CPU governor for performance
echo "Configuring CPU governor for performance..."
if [ -f /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor ]; then
    echo performance > /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null || true
    echo "CPU governor set to performance mode"
fi

# Disable CPU frequency scaling
echo "Disabling CPU frequency scaling..."
systemctl disable ondemand 2>/dev/null || true

# Configure firewall (if ufw is installed)
if command -v ufw &> /dev/null; then
    echo "Configuring firewall..."
    ufw allow out 3000/tcp 2>/dev/null || true
fi

# Reload systemd
systemctl daemon-reload

# Enable service if auto-start is requested
if [ "${this.config.autoStart}" = "true" ]; then
    echo "Enabling auto-start..."
    systemctl enable bitcoin-miner.service
    echo "Service enabled to start on boot"
fi

echo ""
echo "========================================"
echo "   Installation Complete!"
echo "========================================"
echo ""
echo "The Bitcoin mining client has been installed to:"
echo "${this.config.installPath}"
echo ""
echo "Commands:"
echo "  Start mining:    sudo systemctl start bitcoin-miner"
echo "  Stop mining:     sudo systemctl stop bitcoin-miner"
echo "  Check status:    sudo systemctl status bitcoin-miner"
echo "  View logs:       sudo journalctl -u bitcoin-miner -f"
echo ""
echo "Manual start:     ${this.config.installPath}/start-miner.sh"
echo "Server URL:       ${this.config.serverUrl}"
echo ""

# Test connection to server
echo "Testing connection to mining server..."
if curl -s --connect-timeout 10 "${this.config.serverUrl}/health" > /dev/null; then
    echo "Connection test successful!"
else
    echo "Could not connect to mining server at ${this.config.serverUrl}"
    echo "Please ensure the server is running and accessible"
fi

echo ""
echo "Installation completed successfully!"`;

        return installerScript;
    }

    /**
     * Generate uninstaller script
     */
    generateUninstaller() {
        const uninstallerScript = `#!/bin/bash

# Bitcoin Mining Client - Ubuntu/Debian Uninstaller
# Requires sudo privileges

set -e

echo "========================================"
echo "   Bitcoin Mining Client Uninstaller"
echo "========================================"
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "This uninstaller requires sudo privileges."
    echo "Please run with: sudo bash uninstall.sh"
    exit 1
fi

# Stop and disable service
echo "Stopping mining service..."
systemctl stop bitcoin-miner.service 2>/dev/null || true
systemctl disable bitcoin-miner.service 2>/dev/null || true

# Remove service file
echo "Removing systemd service..."
rm -f /etc/systemd/system/bitcoin-miner.service
systemctl daemon-reload

# Remove mining user
echo "Removing mining user..."
userdel mining 2>/dev/null || true

# Remove installation directory
echo "Removing installation files..."
rm -rf "${this.config.installPath}"

# Reset CPU governor
echo "Resetting CPU governor..."
if [ -f /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor ]; then
    echo ondemand > /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null || true
fi

# Re-enable CPU frequency scaling
echo "Re-enabling CPU frequency scaling..."
systemctl enable ondemand 2>/dev/null || true

echo ""
echo "========================================"
echo "   Uninstallation Complete!"
echo "========================================"
echo ""
echo "The Bitcoin mining client has been removed."
echo ""
echo "You may want to restart your system to ensure all changes take effect."
echo ""`;

        return uninstallerScript;
    }

    /**
     * Generate systemd service file
     */
    generateSystemdService() {
        const serviceContent = `[Unit]
Description=Bitcoin Mining Client
After=network.target
Wants=network.target

[Service]
Type=simple
User=mining
Group=mining
WorkingDirectory=${this.config.installPath}
ExecStart=/usr/bin/node client.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${this.config.installPath}

# Resource limits
LimitNOFILE=65536
LimitNPROC=32768

[Install]
WantedBy=multi-user.target`;

        return serviceContent;
    }

    /**
     * Generate performance optimization script
     */
    generateOptimizationScript() {
        const optimizationScript = `#!/bin/bash

# Ubuntu/Debian Performance Optimization for Bitcoin Mining
# Requires sudo privileges

set -e

echo "========================================"
echo "   Ubuntu Mining Performance Optimizer"
echo "========================================"
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "This script requires sudo privileges."
    echo "Please run with: sudo bash optimize.sh"
    exit 1
fi

# Set CPU governor to performance
echo "Setting CPU governor to performance mode..."
for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
    if [ -f "$cpu" ]; then
        echo performance > "$cpu" 2>/dev/null || true
    fi
done

# Disable CPU frequency scaling
echo "Disabling CPU frequency scaling..."
systemctl disable ondemand 2>/dev/null || true
systemctl disable powersave 2>/dev/null || true

# Optimize network settings
echo "Optimizing network settings..."
cat > /etc/sysctl.d/99-bitcoin-mining.conf << 'EOF'
# Bitcoin Mining Network Optimizations
net.core.rmem_default = 262144
net.core.rmem_max = 16777216
net.core.wmem_default = 262144
net.core.wmem_max = 16777216
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_rmem = 4096 65536 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.ipv4.tcp_congestion_control = bbr
EOF

# Apply network optimizations
sysctl -p /etc/sysctl.d/99-bitcoin-mining.conf

# Optimize file limits
echo "Optimizing file limits..."
cat > /etc/security/limits.d/99-bitcoin-mining.conf << 'EOF'
# Bitcoin Mining File Limits
mining soft nofile 65536
mining hard nofile 65536
mining soft nproc 32768
mining hard nproc 32768
EOF

# Set high priority for mining process
echo "Setting high priority for mining process..."
echo "mining soft priority -10" >> /etc/security/limits.d/99-bitcoin-mining.conf
echo "mining hard priority -10" >> /etc/security/limits.d/99-bitcoin-mining.conf

# Disable unnecessary services
echo "Disabling unnecessary services..."
systemctl disable bluetooth 2>/dev/null || true
systemctl disable cups 2>/dev/null || true
systemctl disable avahi-daemon 2>/dev/null || true

# Optimize swap settings
echo "Optimizing swap settings..."
echo 'vm.swappiness=10' >> /etc/sysctl.d/99-bitcoin-mining.conf
echo 'vm.vfs_cache_pressure=50' >> /etc/sysctl.d/99-bitcoin-mining.conf

# Apply all optimizations
sysctl -p /etc/sysctl.d/99-bitcoin-mining.conf

echo ""
echo "========================================"
echo "   Optimization Complete!"
echo "========================================"
echo ""
echo "Performance optimizations have been applied:"
echo "  - CPU governor set to performance mode"
echo "  - Network settings optimized"
echo "  - File limits increased"
echo "  - Process priority set to high"
echo "  - Unnecessary services disabled"
echo ""
echo "For best results, restart your system."
echo ""`;

        return optimizationScript;
    }

    /**
     * Generate desktop application entry
     */
    generateDesktopEntry() {
        const desktopEntry = `[Desktop Entry]
Version=1.0
Type=Application
Name=Bitcoin Miner
Comment=Bitcoin Mining Client
Exec=${this.config.installPath}/start-miner.sh
Icon=applications-system
Terminal=true
Categories=Network;Finance;
StartupNotify=true`;

        return desktopEntry;
    }

    /**
     * Save installer files to disk
     */
    async saveInstallerFiles() {
        const installerDir = path.join(__dirname, '../../deploy/ubuntu');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(installerDir)) {
            fs.mkdirSync(installerDir, { recursive: true });
        }

        // Save installer script
        fs.writeFileSync(
            path.join(installerDir, 'install.sh'),
            this.generateInstaller()
        );
        
        // Make installer executable
        fs.chmodSync(path.join(installerDir, 'install.sh'), '755');

        // Save uninstaller script
        fs.writeFileSync(
            path.join(installerDir, 'uninstall.sh'),
            this.generateUninstaller()
        );
        
        // Make uninstaller executable
        fs.chmodSync(path.join(installerDir, 'uninstall.sh'), '755');

        // Save optimization script
        fs.writeFileSync(
            path.join(installerDir, 'optimize.sh'),
            this.generateOptimizationScript()
        );
        
        // Make optimization script executable
        fs.chmodSync(path.join(installerDir, 'optimize.sh'), '755');

        // Save systemd service file
        fs.writeFileSync(
            path.join(installerDir, 'bitcoin-miner.service'),
            this.generateSystemdService()
        );

        // Save desktop entry
        fs.writeFileSync(
            path.join(installerDir, 'bitcoin-miner.desktop'),
            this.generateDesktopEntry()
        );

        // Save CrossPlatformClient.js
        const clientPath = path.join(__dirname, '../client/CrossPlatformClient.js');
        if (fs.existsSync(clientPath)) {
            fs.copyFileSync(
                clientPath,
                path.join(installerDir, 'CrossPlatformClient.js')
            );
        }

        console.log(`✅ Ubuntu installer files saved to: ${installerDir}`);
        console.log('📁 Files created:');
        console.log('   - install.sh (Main installer)');
        console.log('   - uninstall.sh (Uninstaller)');
        console.log('   - optimize.sh (Performance optimizer)');
        console.log('   - bitcoin-miner.service (Systemd service)');
        console.log('   - bitcoin-miner.desktop (Desktop entry)');
        console.log('   - CrossPlatformClient.js (Client code)');
    }
}

module.exports = UbuntuDeployment;
