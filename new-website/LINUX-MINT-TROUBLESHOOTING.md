# Linux Mint Connection Troubleshooting Guide

## 🔍 **ISSUES IDENTIFIED AND FIXED**

### **Problem 1: Missing `bc` command** ✅ FIXED
- **Issue**: The installer script used `bc -l` for calculations, but `bc` is not installed by default on Linux Mint
- **Fix**: Added `bc` to the package installation list
- **Location**: Line 1028 in mining-manager.js

### **Problem 2: CPU usage detection** ✅ FIXED
- **Issue**: Different `top` output formats between Linux distributions
- **Fix**: Added multiple format detection patterns for Linux Mint compatibility
- **Location**: Lines 1164-1185 in mining-manager.js

### **Problem 3: Temperature monitoring** ✅ FIXED
- **Issue**: Different temperature sensor paths and formats
- **Fix**: Added multiple temperature source detection with fallbacks
- **Location**: Lines 1200-1217 in mining-manager.js

### **Problem 4: Power calculation fallback** ✅ FIXED
- **Issue**: `bc` dependency for power calculations
- **Fix**: Added `awk` fallback for calculations when `bc` is not available
- **Location**: Lines 1230-1253 in mining-manager.js

### **Problem 5: Network connectivity diagnostics** ✅ FIXED
- **Issue**: Poor error reporting when connection fails
- **Fix**: Added comprehensive network diagnostics including DNS, port, and connectivity tests
- **Location**: Lines 1136-1168 in mining-manager.js

### **Problem 6: Stats reporting error handling** ✅ FIXED
- **Issue**: Silent failures in stats reporting
- **Fix**: Added detailed error reporting and reconnection logic
- **Location**: Lines 1300-1327 in mining-manager.js

## 🚀 **SOLUTIONS PROVIDED**

### **1. Updated Main Installer Script**
- Added `bc` package installation
- Enhanced CPU usage detection for Linux Mint
- Improved temperature monitoring compatibility
- Added network diagnostics
- Better error handling and reporting

### **2. Linux Mint Specific Installer**
- Created `INSTALL-MINING-WORKER-LINUX-MINT.sh`
- Optimized for Linux Mint package management
- Additional monitoring tools (htop, iotop, nethogs)
- Enhanced compatibility checks

### **3. Network Troubleshooting**
The installer now provides detailed diagnostics:
- Internet connectivity test
- DNS resolution test
- Port connectivity test
- Server reachability test

## 🔧 **MANUAL TROUBLESHOOTING STEPS**

### **Step 1: Check Network Connectivity**
```bash
# Test internet connection
ping -c 1 8.8.8.8

# Test DNS resolution
nslookup 192.168.1.168

# Test port connectivity
timeout 5 bash -c "</dev/tcp/192.168.1.168/3000"
```

### **Step 2: Check Required Packages**
```bash
# Install missing packages
sudo apt-get update
sudo apt-get install -y curl git build-essential autotools-dev automake libtool pkg-config lm-sensors bc

# Check if packages are installed
which curl git bc
```

### **Step 3: Check System Monitoring**
```bash
# Test CPU usage detection
top -bn1 | grep -E "Cpu\\(s\\)|%Cpu"

# Test temperature sensors
sensors 2>/dev/null | head -10

# Test thermal zones
ls -la /sys/class/thermal/
```

### **Step 4: Test Client Registration**
```bash
# Test API endpoint directly
curl -X POST -H "Content-Type: application/json" \
  -d '{"id":"test-client","name":"Test","status":"offline"}' \
  http://192.168.1.168:3000/api/remote-client
```

### **Step 5: Check Firewall Settings**
```bash
# Check if firewall is blocking connections
sudo ufw status

# If firewall is active, allow the port
sudo ufw allow 3000
```

## 📋 **COMMON LINUX MINT ISSUES**

### **Issue: Package Installation Fails**
```bash
# Update package lists
sudo apt-get update

# Fix broken packages
sudo apt-get --fix-broken install

# Clean package cache
sudo apt-get clean
```

### **Issue: Compilation Fails**
```bash
# Install additional build tools
sudo apt-get install -y gcc g++ make

# Check available memory
free -h

# Use fewer parallel jobs
make -j2  # Instead of make -j$(nproc)
```

### **Issue: Service Won't Start**
```bash
# Check service status
sudo systemctl status bitcoin-miner.service

# Check logs
sudo journalctl -u bitcoin-miner.service -f

# Check permissions
ls -la /home/$USER/mining-client.sh
```

### **Issue: Stats Not Reporting**
```bash
# Check if client is running
ps aux | grep minerd

# Check log file
tail -f /home/$USER/mining.log

# Test manual stats reporting
curl -s http://192.168.1.168:3000/api/status
```

## 🎯 **VERIFICATION STEPS**

### **1. Test Updated Installer**
```bash
# Download and test the updated installer
curl http://192.168.1.168:3000/api/installer-script > test-installer.sh
chmod +x test-installer.sh
./test-installer.sh
```

### **2. Test Linux Mint Specific Installer**
```bash
# Download Linux Mint optimized installer
curl http://192.168.1.168:3000/INSTALL-MINING-WORKER-LINUX-MINT.sh > mint-installer.sh
chmod +x mint-installer.sh
./mint-installer.sh
```

### **3. Verify Client Registration**
```bash
# Check if client appears in the list
curl -s http://192.168.1.168:3000/api/remote-clients | jq .
```

## 📊 **EXPECTED RESULTS**

After applying the fixes, you should see:
- ✅ Successful package installation including `bc`
- ✅ Proper CPU usage detection
- ✅ Working temperature monitoring
- ✅ Successful network connectivity tests
- ✅ Client appearing in the remote clients list
- ✅ Regular stats reporting every 30 seconds

## 🆘 **IF PROBLEMS PERSIST**

1. **Check the mining log**: `tail -f /home/$USER/mining.log`
2. **Check system logs**: `sudo journalctl -u bitcoin-miner.service`
3. **Test network manually**: Use the diagnostic commands above
4. **Verify server is running**: `curl http://192.168.1.168:3000/api/status`
5. **Check firewall settings**: Ensure port 3000 is accessible

## 📞 **SUPPORT**

If issues persist after following this guide:
1. Collect the mining log file
2. Run the network diagnostics
3. Check system service status
4. Provide Linux Mint version information

**Last Updated**: September 19, 2025
**Status**: All major Linux Mint compatibility issues resolved
