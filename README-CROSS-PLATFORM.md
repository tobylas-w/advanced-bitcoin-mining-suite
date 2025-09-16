# 🚀 Bitcoin Mining System - Cross-Platform

A professional-grade Bitcoin mining system that works seamlessly across **macOS**, **Windows**, and **Linux**.

## 🌟 Features

- ✅ **Cross-Platform Support**: Works on macOS, Windows, and Linux
- ⚡ **Real Bitcoin Mining**: Actual CPUMiner integration with live hashrate
- 📊 **Professional Dashboard**: Modern web interface with real-time monitoring
- 🔧 **Auto-Detection**: Automatically detects your OS and optimizes settings
- 💰 **Profit Optimization**: Advanced profit tracking and optimization
- 🛡️ **Bulletproof Installation**: One-click installers for all platforms
- 📱 **Mobile Responsive**: Dashboard works on desktop and mobile devices

## 🖥️ Supported Platforms

| Platform | Status | Installer | Notes |
|----------|--------|-----------|-------|
| **macOS** | ✅ Full Support | `install-macos.sh` | Requires Homebrew |
| **Windows** | ✅ Full Support | `install-windows.bat` | Requires Administrator |
| **Linux** | ✅ Full Support | `universal-installer.js` | Works on all distros |

## 🚀 Quick Start

### Option 1: Universal Installer (Recommended)
```bash
# Works on all platforms
node universal-installer.js
```

### Option 2: Platform-Specific Installers

#### macOS
```bash
chmod +x install-macos.sh
./install-macos.sh
```

#### Windows
```cmd
# Run as Administrator
install-windows.bat
```

#### Linux
```bash
chmod +x install-linux.sh
./install-linux.sh
```

## 📋 System Requirements

### Minimum Requirements
- **CPU**: 2+ cores
- **RAM**: 2GB+
- **Storage**: 1GB free space
- **OS**: macOS 10.15+, Windows 10+, or Linux (any distro)
- **Node.js**: Version 14 or higher

### Recommended Requirements
- **CPU**: 4+ cores
- **RAM**: 4GB+
- **Storage**: 5GB free space
- **Internet**: Stable broadband connection

## 🔧 Installation Details

### macOS Installation
1. **Install Homebrew** (if not already installed):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. **Install Dependencies**:
   ```bash
   brew install autoconf automake libtool curl openssl gcc make git node
   ```

3. **Run Installer**:
   ```bash
   chmod +x install-macos.sh
   ./install-macos.sh
   ```

### Windows Installation
1. **Run as Administrator**
2. **Install Chocolatey** (automatic if not present)
3. **Install Dependencies**:
   - Git, Node.js, MinGW-w64, AutoTools, cURL, OpenSSL
4. **Run Installer**:
   ```cmd
   install-windows.bat
   ```

### Linux Installation
1. **Update Package Manager**:
   ```bash
   # Fedora/RHEL
   sudo dnf update
   
   # Ubuntu/Debian
   sudo apt update
   ```

2. **Install Dependencies**:
   ```bash
   # Fedora/RHEL
   sudo dnf install autoconf automake libtool curl-devel openssl-devel gcc make git
   
   # Ubuntu/Debian
   sudo apt install autoconf automake libtool libcurl4-openssl-dev libssl-dev gcc make git
   ```

3. **Run Installer**:
   ```bash
   node universal-installer.js
   ```

## ⚙️ Configuration

### Wallet Configuration
Edit `config/wallet.js`:
```javascript
module.exports = {
    // Replace with your Bitcoin wallet address
    address: 'YOUR_BITCOIN_WALLET_ADDRESS',
    
    // Worker name for pool identification
    workerName: 'your-worker-name',
    
    // Pool configuration
    pools: [
        {
            name: 'Antpool',
            url: 'stratum+tcp://btc.ss.poolin.com:443',
            fee: 2.5,
            reliability: 99.9
        }
    ]
};
```

### Mining Configuration
Edit `config/bitcoin.js`:
```javascript
module.exports = {
    mining: {
        algorithm: 'sha256d',
        threads: 4, // Adjust based on your CPU
        retries: 10,
        timeout: 60,
        scantime: 5
    },
    
    performance: {
        aggressiveMode: false,
        maxCpuUsage: 80,
        temperatureThreshold: 85
    }
};
```

## 🎯 Usage

### Start Mining
```bash
# All platforms
node bitcoin-mining-server.js

# Or use the start script
./start-mining.sh    # macOS/Linux
start-mining.bat     # Windows
```

### Access Dashboard
Open your browser and navigate to:
```
http://localhost:3000
```

### Stop Mining
```bash
# All platforms
./stop-mining.sh     # macOS/Linux
stop-mining.bat      # Windows
```

## 📊 Dashboard Features

- **Real-time Hashrate**: Live mining performance monitoring
- **Share Tracking**: Accepted/rejected shares statistics
- **Earnings Calculator**: Projected daily/monthly/yearly earnings
- **System Information**: CPU, memory, and platform details
- **Client Management**: Monitor multiple mining clients
- **Profit Optimization**: Advanced profit tracking and optimization

## 🔧 Troubleshooting

### Common Issues

#### 1. Permission Errors
**macOS/Linux**:
```bash
sudo chmod +x install-macos.sh
sudo ./install-macos.sh
```

**Windows**:
- Right-click installer → "Run as Administrator"

#### 2. Dependencies Not Found
**macOS**:
```bash
brew update && brew upgrade
brew install autoconf automake libtool curl openssl gcc make git
```

**Windows**:
```cmd
choco upgrade all
choco install git nodejs mingw-w64 autotools curl openssl
```

**Linux**:
```bash
# Update package lists
sudo dnf update  # Fedora/RHEL
sudo apt update  # Ubuntu/Debian

# Install dependencies
sudo dnf install autoconf automake libtool curl-devel openssl-devel gcc make git
sudo apt install autoconf automake libtool libcurl4-openssl-dev libssl-dev gcc make git
```

#### 3. CPUMiner Build Failed
```bash
# Clean and rebuild
rm -rf cpuminer
git clone https://github.com/pooler/cpuminer.git
cd cpuminer
./autogen.sh
./configure
make
cp minerd ../
```

#### 4. Node.js Issues
```bash
# Update Node.js
npm install -g n
n latest

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Platform-Specific Issues

#### macOS
- **Apple Silicon**: Ensure you have the correct Homebrew installation path
- **Xcode Command Line Tools**: Install via `xcode-select --install`
- **Gatekeeper**: Allow unsigned binaries in System Preferences

#### Windows
- **Windows Defender**: Add exclusion for mining folder
- **PowerShell Execution Policy**: Set to Bypass for installer
- **Antivirus**: May flag mining software as suspicious (add exclusion)

#### Linux
- **SELinux**: May block mining processes (disable or configure)
- **Firewall**: Ensure port 3000 is open for dashboard access
- **User Permissions**: Ensure user has access to /tmp directory

## 📈 Performance Optimization

### CPU Optimization
- **Thread Count**: Adjust based on CPU cores and thermal throttling
- **CPU Usage**: Monitor temperature and adjust thread count accordingly
- **Power Settings**: Set to high performance mode

### Memory Optimization
- **RAM Usage**: Monitor memory consumption during mining
- **Swap Space**: Ensure adequate swap space for stability

### Network Optimization
- **Pool Selection**: Choose pools with low latency
- **Connection Stability**: Use wired connection for better stability

## 🛡️ Security Considerations

### Wallet Security
- **Private Keys**: Never share your private keys
- **Wallet Address**: Double-check wallet address before starting
- **Backup**: Keep secure backups of your wallet

### Network Security
- **Firewall**: Configure firewall to block unnecessary connections
- **VPN**: Consider using VPN for additional privacy
- **Updates**: Keep system and software updated

### System Security
- **Antivirus**: Configure exclusions for mining software
- **User Permissions**: Run with minimal required permissions
- **Monitoring**: Monitor system for unusual activity

## 📞 Support

### Getting Help
1. **Check Documentation**: Review this README and other docs
2. **Check Issues**: Look for similar issues on GitHub
3. **Create Issue**: Create a new issue with system details
4. **Community**: Join our community discussions

### System Information for Support
When requesting help, please include:
- Operating System and version
- Architecture (x64, ARM64, etc.)
- Node.js version
- Error messages and logs
- System specifications

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) file for guidelines.

## ⚠️ Disclaimer

This software is for educational and research purposes. Mining Bitcoin may not be profitable depending on your hardware, electricity costs, and Bitcoin price. Always consider the costs and risks before mining.

---

**Happy Mining! 🚀💰**
