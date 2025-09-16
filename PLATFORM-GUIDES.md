# 🖥️ Platform-Specific Setup Guides

Detailed setup guides for each supported operating system.

## 🍎 macOS Setup Guide

### System Requirements
- **macOS**: 10.15 (Catalina) or later
- **Architecture**: Intel x64 or Apple Silicon (M1/M2)
- **RAM**: 4GB+ recommended
- **Storage**: 2GB+ free space

### Prerequisites
1. **Install Homebrew**:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. **Install Xcode Command Line Tools**:
   ```bash
   xcode-select --install
   ```

### Installation Steps
1. **Clone Repository**:
   ```bash
   git clone https://github.com/your-repo/bitcoin-mining-system.git
   cd bitcoin-mining-system
   ```

2. **Run macOS Installer**:
   ```bash
   chmod +x install-macos.sh
   ./install-macos.sh
   ```

3. **Configure Wallet**:
   ```bash
   nano config/wallet.js
   # Replace 'YOUR_WALLET_ADDRESS' with your actual Bitcoin address
   ```

4. **Start Mining**:
   ```bash
   ./start-mining.sh
   ```

### Apple Silicon (M1/M2) Specific Notes
- Homebrew installs to `/opt/homebrew` instead of `/usr/local`
- Some dependencies may need ARM64 specific builds
- Performance may vary compared to Intel Macs

### Troubleshooting macOS
- **Gatekeeper Issues**: Allow unsigned binaries in System Preferences
- **Permission Denied**: Use `sudo` for system-wide installations
- **Homebrew Path Issues**: Add `/opt/homebrew/bin` to PATH for Apple Silicon

---

## 🪟 Windows Setup Guide

### System Requirements
- **Windows**: 10 or 11 (64-bit)
- **RAM**: 4GB+ recommended
- **Storage**: 2GB+ free space
- **Administrator Access**: Required for installation

### Prerequisites
1. **Enable PowerShell Execution**:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

2. **Install Chocolatey** (automatic with installer):
   ```powershell
   Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
   ```

### Installation Steps
1. **Download Repository**:
   ```cmd
   git clone https://github.com/your-repo/bitcoin-mining-system.git
   cd bitcoin-mining-system
   ```

2. **Run Windows Installer** (as Administrator):
   ```cmd
   install-windows.bat
   ```

3. **Configure Wallet**:
   ```cmd
   notepad config\wallet.js
   # Replace 'YOUR_WALLET_ADDRESS' with your actual Bitcoin address
   ```

4. **Start Mining**:
   ```cmd
   start-mining.bat
   ```

### Windows-Specific Features
- **Windows Service**: Install as a Windows service for auto-start
- **Desktop Shortcut**: Automatic desktop shortcut creation
- **Task Manager Integration**: Monitor CPU usage in Task Manager

### Troubleshooting Windows
- **Antivirus Issues**: Add mining folder to exclusions
- **Windows Defender**: Add exclusion for mining executables
- **Permission Issues**: Always run as Administrator
- **MinGW Issues**: Ensure MinGW-w64 is properly installed

---

## 🐧 Linux Setup Guide

### Supported Distributions
- **Ubuntu/Debian**: 18.04+
- **Fedora/RHEL**: 30+
- **Arch Linux**: Latest
- **OpenSUSE**: 15+
- **Other**: Most modern distributions

### System Requirements
- **RAM**: 2GB+ (4GB+ recommended)
- **Storage**: 2GB+ free space
- **CPU**: 2+ cores recommended

### Distribution-Specific Installation

#### Ubuntu/Debian
```bash
# Update package lists
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y autoconf automake libtool libcurl4-openssl-dev libssl-dev gcc make git nodejs npm

# Install system
node universal-installer.js
```

#### Fedora/RHEL/CentOS
```bash
# Update package lists
sudo dnf update -y

# Install dependencies
sudo dnf install -y autoconf automake libtool curl-devel openssl-devel gcc make git nodejs npm

# Install system
node universal-installer.js
```

#### Arch Linux
```bash
# Update package lists
sudo pacman -Syu

# Install dependencies
sudo pacman -S autoconf automake libtool curl openssl gcc make git nodejs npm

# Install system
node universal-installer.js
```

### Linux-Specific Features
- **Systemd Service**: Create systemd service for auto-start
- **Cron Jobs**: Schedule mining operations
- **Process Monitoring**: Use htop/top for monitoring

### Troubleshooting Linux
- **Permission Issues**: Ensure user has necessary permissions
- **SELinux**: May need to configure SELinux policies
- **Firewall**: Ensure port 3000 is open for dashboard
- **Dependencies**: Some distributions may have different package names

---

## 🔧 Advanced Configuration

### Performance Tuning

#### CPU Optimization
```bash
# Check CPU info
lscpu  # Linux
sysctl -n hw.ncpu  # macOS
echo %NUMBER_OF_PROCESSORS%  # Windows

# Adjust thread count in config/bitcoin.js
threads: Math.floor(CPU_CORES * 0.8)  # 80% of cores
```

#### Memory Optimization
```bash
# Monitor memory usage
free -h  # Linux
vm_stat  # macOS
Get-Process | Sort-Object WS -Descending  # Windows PowerShell
```

#### Network Optimization
- Use wired connection instead of WiFi
- Choose pools with low latency
- Configure firewall properly

### Security Configuration

#### Firewall Setup
```bash
# Linux (ufw)
sudo ufw allow 3000/tcp
sudo ufw enable

# macOS
sudo pfctl -f /etc/pf.conf

# Windows
netsh advfirewall firewall add rule name="Bitcoin Mining" dir=in action=allow protocol=TCP localport=3000
```

#### User Permissions
```bash
# Linux - Create dedicated mining user
sudo useradd -m -s /bin/bash bitcoin-miner
sudo usermod -aG sudo bitcoin-miner

# Switch to mining user
sudo su - bitcoin-miner
```

### Monitoring and Maintenance

#### Log Monitoring
```bash
# View mining logs
tail -f mining.log

# View system logs
journalctl -u bitcoin-mining -f  # systemd
tail -f /var/log/syslog  # Ubuntu/Debian
```

#### Performance Monitoring
```bash
# CPU temperature (Linux)
sensors

# System resources
htop  # Linux/macOS
top  # All platforms
```

#### Backup Configuration
```bash
# Backup configuration
cp -r config/ backup/config-$(date +%Y%m%d)

# Backup mining data
cp -r data/ backup/data-$(date +%Y%m%d)
```

---

## 🚨 Emergency Procedures

### Stop Mining Immediately
```bash
# All platforms
./stop-mining.sh  # macOS/Linux
stop-mining.bat   # Windows

# Force stop
pkill -f minerd  # Linux/macOS
taskkill /f /im minerd.exe  # Windows
```

### System Recovery
```bash
# Reset configuration
cp config/wallet.js.backup config/wallet.js
cp config/bitcoin.js.backup config/bitcoin.js

# Clean reinstall
./uninstall.sh  # macOS/Linux
uninstall.bat   # Windows
node universal-installer.js
```

### Data Recovery
```bash
# Restore from backup
cp -r backup/data-YYYYMMDD/* data/
cp -r backup/config-YYYYMMDD/* config/
```

---

## 📞 Platform-Specific Support

### macOS Support
- **Apple Developer Forums**: For Apple Silicon specific issues
- **Homebrew Issues**: GitHub repository for package issues
- **Stack Overflow**: macOS development questions

### Windows Support
- **Microsoft Tech Community**: Windows-specific issues
- **Chocolatey Issues**: Package management problems
- **PowerShell Gallery**: Script and module issues

### Linux Support
- **Distribution Forums**: Ubuntu, Fedora, Arch forums
- **Stack Overflow**: Linux administration questions
- **GitHub Issues**: Open source project issues

---

**Need Help?** Create an issue on GitHub with your platform details and error messages!
