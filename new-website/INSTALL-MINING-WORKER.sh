#!/bin/bash
# Bitcoin Mining Worker - Simple One-Click Installer
# Just double-click this file to install!

echo "=========================================="
echo "  Bitcoin Mining Worker Installer"
echo "  Simple One-Click Installation"
echo "=========================================="

# Check for uninstall option
if [ "$1" = "--uninstall" ] || [ "$1" = "-u" ]; then
    echo "🗑️  Uninstalling Bitcoin Mining Worker..."
    sudo systemctl stop mining-worker mining-stats.timer 2>/dev/null || true
    sudo systemctl disable mining-worker mining-stats.timer 2>/dev/null || true
    sudo rm -f /etc/systemd/system/mining-worker.service /etc/systemd/system/mining-stats.service /etc/systemd/system/mining-stats.timer
    sudo systemctl daemon-reload
    rm -rf ~/bitcoin-mining
    sudo rm -f /usr/local/bin/minerd
    echo "✅ Uninstallation complete"
    exit 0
fi

# Check for cleanup option
if [ "$1" = "--cleanup" ] || [ "$1" = "-c" ]; then
    echo "🧹 Cleaning up Bitcoin Mining Worker..."
    sudo systemctl stop mining-worker mining-stats.timer 2>/dev/null || true
    rm -rf ~/bitcoin-mining/cpuminer-multi
    echo "✅ Cleanup complete. Run installer again to reinstall."
    exit 0
fi

# Check if we have internet
if ! ping -c 1 google.com >/dev/null 2>&1; then
    echo "❌ No internet connection. Please connect to internet first."
    read -p "Press Enter to exit..."
    exit 1
fi

echo "✅ Internet connection found"
echo ""
echo "This will install Bitcoin mining software that:"
echo "• Mines Bitcoin automatically"
echo "• Reports to your main server"
echo "• Starts on boot"
echo "• Requires no manual management"
echo ""
read -p "Continue with installation? (y/n): " confirm

if [[ $confirm != [yY] ]]; then
    echo "Installation cancelled."
    exit 0
fi

echo ""
echo "🔧 Installing Bitcoin Mining Worker..."
echo "This may take 5-10 minutes..."

# Update system
echo "📦 Updating system packages..."
sudo apt update -y

# Install dependencies with better error handling
echo "📦 Installing mining software..."
DEPS="build-essential git curl wget libssl-dev libcurl4-openssl-dev libjansson-dev libgmp-dev automake autoconf pkg-config lm-sensors"

# Install dependencies one by one for better error handling
for dep in $DEPS; do
    echo "   Installing $dep..."
    if ! sudo apt install -y "$dep"; then
        echo "❌ Failed to install $dep"
        echo "   Continuing with other packages..."
    fi
done

# Verify critical dependencies
if ! command -v gcc >/dev/null 2>&1; then
    echo "❌ Critical Error: gcc not installed!"
    exit 1
fi

if ! command -v git >/dev/null 2>&1; then
    echo "❌ Critical Error: git not installed!"
    exit 1
fi

# Create mining directory
mkdir -p ~/bitcoin-mining
cd ~/bitcoin-mining

# Download and compile cpuminer with better error handling
echo "⛏️  Setting up Bitcoin miner..."

# Clean up any previous failed attempts
if [ -d "cpuminer-multi" ] && [ ! -f "cpuminer-multi/minerd" ]; then
    echo "   Cleaning up previous failed compilation..."
    rm -rf cpuminer-multi
fi

if [ ! -d "cpuminer-multi" ]; then
    echo "   Downloading cpuminer-multi..."
    if ! git clone https://github.com/tpruvot/cpuminer-multi.git; then
        echo "❌ Failed to download cpuminer-multi"
        echo "   Trying alternative repository..."
        git clone https://github.com/jh00nbr/cpuminer-multi.git
    fi
fi

cd cpuminer-multi

echo "   Configuring build..."
if ! ./autogen.sh; then
    echo "❌ autogen.sh failed"
    exit 1
fi

if ! ./configure CFLAGS="-march=native" --with-crypto --with-curl; then
    echo "❌ Configure failed"
    echo "   Trying without native optimization..."
    ./configure --with-crypto --with-curl
fi

echo "   Compiling cpuminer (this may take several minutes)..."
if ! make -j$(nproc); then
    echo "❌ Compilation failed"
    echo "   Trying with fewer threads..."
    make -j2
fi

# Verify the binary was created
if [ ! -f "minerd" ]; then
    echo "❌ Critical Error: minerd binary not created!"
    exit 1
fi

echo "   Installing minerd binary..."
sudo cp minerd /usr/local/bin/

# Verify installation
if [ ! -f "/usr/local/bin/minerd" ]; then
    echo "❌ Critical Error: minerd not installed to /usr/local/bin/"
    exit 1
fi

cd ~/bitcoin-mining

echo "✅ Mining software installed"

# Create configuration
cd ~/bitcoin-mining
cat > mining-config.json << 'EOF'
{
    "server": "192.168.1.168",
    "port": 3000,
    "pool_url": "stratum+tcp://btc.ss.poolin.com:443",
    "wallet": "bc1qz2zqqgdz7whfmmkpcthn5gkv4ew4dfjs6fyeat",
    "worker_name": "linux-mint-worker",
    "auto_start": true
}
EOF

# Create simple start script
cat > start-mining.sh << 'EOF'
#!/bin/bash
cd ~/bitcoin-mining
exec /usr/local/bin/minerd -a sha256d \
    -o stratum+tcp://btc.ss.poolin.com:443 \
    -u bc1qz2zqqgdz7whfmmkpcthn5gkv4ew4dfjs6fyeat \
    -p x \
    -t 4
EOF

chmod +x start-mining.sh

# Create stats reporter with enhanced error handling
cat > report-stats.sh << 'EOF'
#!/bin/bash
# Enhanced stats reporter with better error handling and logging

HOSTNAME=$(hostname)
MINING_PID=$(pgrep -f "minerd" || echo "")
STATUS="offline"
HASHRATE="0"
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 | cut -d',' -f1 2>/dev/null || echo "0")
TEMPERATURE=$(sensors 2>/dev/null | grep -E "Core 0|Package id 0" | awk '{print $3}' | cut -d'+' -f2 | cut -d'°' -f1 | head -1 2>/dev/null || echo "45")
CPU_MODEL=$(lscpu | grep 'Model name' | cut -d':' -f2 | xargs 2>/dev/null || echo "Unknown CPU")
OS_INFO=$(lsb_release -d 2>/dev/null | cut -f2 || uname -s)

# Calculate uptime if mining is running
UPTIME=0
if [ ! -z "$MINING_PID" ]; then
    STATUS="mining"
    HASHRATE="0.05"
    # Try to get uptime from process start time
    UPTIME=$(ps -o etime= -p $MINING_PID 2>/dev/null | awk -F: '{if(NF==3) print $1*3600+$2*60+$3; else if(NF==2) print $1*60+$2; else print $1}' 2>/dev/null || echo "0")
fi

SERVER_URL="http://192.168.1.168:3000"
LOG_FILE="$HOME/bitcoin-mining/stats-report.log"

# Create log file if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Log function
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Test server connectivity with timeout
log_message "Starting stats report for $HOSTNAME"

# First test if server is reachable
if curl -s -m 10 "$SERVER_URL/api/status" > /dev/null 2>&1; then
    # Server is reachable, send stats
    RESPONSE=$(curl -s -X POST "$SERVER_URL/api/remote-client" \
        -H "Content-Type: application/json" \
        -d "{
            \"hostname\": \"$HOSTNAME\",
            \"status\": \"$STATUS\",
            \"hashrate\": $HASHRATE,
            \"shares\": {\"accepted\": 0, \"rejected\": 0},
            \"uptime\": $UPTIME,
            \"temperature\": $TEMPERATURE,
            \"power\": 85,
            \"cpuUsage\": $CPU_USAGE,
            \"gpuUsage\": 0,
            \"gpuTemperature\": 0,
            \"os\": \"$OS_INFO\",
            \"cpu\": \"$CPU_MODEL\",
            \"timestamp\": $(date +%s)
        }" 2>&1)
    
    if echo "$RESPONSE" | grep -q "success"; then
        log_message "Stats report successful: $STATUS, hashrate: $HASHRATE"
    else
        log_message "Stats report failed: $RESPONSE"
    fi
else
    log_message "Server not reachable at $SERVER_URL"
    
    # Try alternative connection methods
    if timeout 5 bash -c "</dev/tcp/192.168.1.168/3000" 2>/dev/null; then
        log_message "Port 3000 is open but HTTP API not responding"
    else
        log_message "Cannot connect to server port 3000"
    fi
fi

# Log current system status
log_message "System status: $STATUS, PID: $MINING_PID, CPU: $CPU_USAGE%, Temp: ${TEMPERATURE}°C"

# Rotate log file if it's too large (>1MB)
if [ -f "$LOG_FILE" ] && [ $(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0) -gt 1048576 ]; then
    mv "$LOG_FILE" "$LOG_FILE.old"
    log_message "Log file rotated"
fi
EOF

chmod +x report-stats.sh

# Create diagnostics script
cat > CLIENT-DIAGNOSTICS.sh << 'EOF'
#!/bin/bash
# Bitcoin Mining Client Diagnostics Tool
# Run this on the client machine to troubleshoot connection issues

echo "=========================================="
echo "  Bitcoin Mining Client Diagnostics"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Server configuration
SERVER_IP="192.168.1.168"
SERVER_PORT="3000"
SERVER_URL="http://$SERVER_IP:$SERVER_PORT"

echo -e "${BLUE}🔍 System Information${NC}"
echo "Hostname: $(hostname)"
echo "OS: $(lsb_release -d 2>/dev/null | cut -f2 || uname -a)"
echo "Kernel: $(uname -r)"
echo "Architecture: $(uname -m)"
echo ""

echo -e "${BLUE}🌐 Network Configuration${NC}"
echo "Local IP addresses:"
ip addr show | grep -E "inet [0-9]" | grep -v "127.0.0.1" | awk '{print "  " $2}'
echo ""

echo -e "${BLUE}🔗 Server Connectivity Tests${NC}"

# Test 1: Basic ping
echo -n "1. Ping test to $SERVER_IP: "
if ping -c 1 -W 2 $SERVER_IP >/dev/null 2>&1; then
    echo -e "${GREEN}✅ SUCCESS${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
fi

# Test 2: Port connectivity
echo -n "2. Port $SERVER_PORT connectivity: "
if timeout 5 bash -c "</dev/tcp/$SERVER_IP/$SERVER_PORT" 2>/dev/null; then
    echo -e "${GREEN}✅ SUCCESS${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
fi

# Test 3: HTTP connectivity
echo -n "3. HTTP server response: "
HTTP_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null --connect-timeout 5 "$SERVER_URL/api/status" 2>/dev/null)
if [ "$HTTP_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ SUCCESS (HTTP $HTTP_RESPONSE)${NC}"
else
    echo -e "${RED}❌ FAILED (HTTP $HTTP_RESPONSE)${NC}"
fi

# Test 4: API endpoint test
echo -n "4. API endpoint test: "
API_RESPONSE=$(curl -s --connect-timeout 5 "$SERVER_URL/api/status" 2>/dev/null)
if echo "$API_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✅ SUCCESS${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
    echo "   Response: $API_RESPONSE"
fi

echo ""

echo -e "${BLUE}⛏️  Mining Software Status${NC}"

# Check if minerd exists
if [ -f "/usr/local/bin/minerd" ]; then
    echo -e "Miner binary: ${GREEN}✅ Found${NC}"
    echo "  Version: $(/usr/local/bin/minerd --version 2>&1 | head -1)"
else
    echo -e "Miner binary: ${RED}❌ Not found${NC}"
fi

# Check if mining process is running
MINING_PID=$(pgrep -f "minerd" || echo "")
if [ ! -z "$MINING_PID" ]; then
    echo -e "Mining process: ${GREEN}✅ Running (PID: $MINING_PID)${NC}"
    echo "  Command: $(ps -p $MINING_PID -o cmd= 2>/dev/null || echo 'Unknown')"
else
    echo -e "Mining process: ${RED}❌ Not running${NC}"
fi

echo ""

echo -e "${BLUE}🔧 Systemd Services Status${NC}"

# Check mining service
if systemctl is-active --quiet mining-worker 2>/dev/null; then
    echo -e "mining-worker: ${GREEN}✅ Active${NC}"
elif systemctl is-enabled --quiet mining-worker 2>/dev/null; then
    echo -e "mining-worker: ${YELLOW}⚠️  Enabled but not active${NC}"
else
    echo -e "mining-worker: ${RED}❌ Not found/enabled${NC}"
fi

# Check stats timer
if systemctl is-active --quiet mining-stats.timer 2>/dev/null; then
    echo -e "mining-stats.timer: ${GREEN}✅ Active${NC}"
    echo "  Next run: $(systemctl show mining-stats.timer -p NextElapseUTC --value 2>/dev/null || echo 'Unknown')"
elif systemctl is-enabled --quiet mining-stats.timer 2>/dev/null; then
    echo -e "mining-stats.timer: ${YELLOW}⚠️  Enabled but not active${NC}"
else
    echo -e "mining-stats.timer: ${RED}❌ Not found/enabled${NC}"
fi

echo ""

echo -e "${BLUE}📊 Recent Stats Reports${NC}"
if [ -f "$HOME/bitcoin-mining/stats-report.log" ]; then
    echo "Recent stats reports:"
    tail -5 "$HOME/bitcoin-mining/stats-report.log" | while read line; do
        echo "  $line"
    done
else
    echo "No stats report log found"
fi

echo ""

echo -e "${BLUE}🧪 Manual Connection Test${NC}"
echo "Testing manual connection to server..."
MANUAL_TEST=$(curl -s -X POST "$SERVER_URL/api/remote-client" \
    -H "Content-Type: application/json" \
    -d "{
        \"hostname\": \"$(hostname)-diagnostic\",
        \"status\": \"testing\",
        \"hashrate\": 0,
        \"shares\": {\"accepted\": 0, \"rejected\": 0},
        \"uptime\": 0,
        \"temperature\": 25,
        \"power\": 0,
        \"cpuUsage\": 0,
        \"gpuUsage\": 0,
        \"gpuTemperature\": 0,
        \"os\": \"$(lsb_release -d 2>/dev/null | cut -f2 || uname -s)\",
        \"cpu\": \"$(lscpu | grep 'Model name' | cut -d':' -f2 | xargs || echo 'Unknown')\",
        \"timestamp\": $(date +%s)
    }" 2>/dev/null)

if echo "$MANUAL_TEST" | grep -q "success"; then
    echo -e "${GREEN}✅ Manual connection test: SUCCESS${NC}"
else
    echo -e "${RED}❌ Manual connection test: FAILED${NC}"
    echo "   Response: $MANUAL_TEST"
fi

echo ""

echo -e "${BLUE}🔧 Troubleshooting Recommendations${NC}"

# Check firewall
if command -v ufw >/dev/null 2>&1; then
    UFW_STATUS=$(ufw status 2>/dev/null | grep "Status:" | cut -d':' -f2 | xargs)
    if [ "$UFW_STATUS" = "active" ]; then
        echo -e "${YELLOW}⚠️  UFW firewall is active. Ensure outbound connections are allowed.${NC}"
    fi
fi

# Check if running as root for services
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Run as root (sudo) for complete service diagnostics.${NC}"
fi

# Network troubleshooting
if ! ping -c 1 -W 2 $SERVER_IP >/dev/null 2>&1; then
    echo -e "${RED}❌ Cannot reach server IP. Check:${NC}"
    echo "   • Network connectivity"
    echo "   • Firewall settings"
    echo "   • Server IP address (currently: $SERVER_IP)"
fi

if [ -z "$MINING_PID" ]; then
    echo -e "${YELLOW}⚠️  Mining not running. Try:${NC}"
    echo "   • sudo systemctl start mining-worker"
    echo "   • Check service logs: sudo journalctl -u mining-worker"
fi

echo ""
echo -e "${BLUE}📝 Next Steps${NC}"
echo "1. If network tests fail, check your network connection"
echo "2. If services are not running, restart them:"
echo "   sudo systemctl restart mining-worker mining-stats.timer"
echo "3. If manual test fails, check server logs on the main machine"
echo "4. Run this script as root for complete diagnostics"
echo ""
echo "=========================================="
echo "  Diagnostics Complete"
echo "=========================================="
EOF

chmod +x CLIENT-DIAGNOSTICS.sh

# Create systemd service
cat > mining-worker.service << EOF
[Unit]
Description=Bitcoin Mining Worker
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$HOME/bitcoin-mining
ExecStart=$HOME/bitcoin-mining/start-mining.sh
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Create stats reporting service
cat > mining-stats.service << EOF
[Unit]
Description=Mining Stats Reporter
After=network.target

[Service]
Type=oneshot
User=root
WorkingDirectory=$HOME/bitcoin-mining
ExecStart=$HOME/bitcoin-mining/report-stats.sh
EOF

# Create stats reporting timer
cat > mining-stats.timer << EOF
[Unit]
Description=Report mining stats every 30 seconds
Requires=mining-stats.service

[Timer]
OnBootSec=30
OnUnitActiveSec=30
Unit=mining-stats.service

[Install]
WantedBy=timers.target
EOF

# Install services
sudo cp mining-worker.service /etc/systemd/system/
sudo cp mining-stats.service /etc/systemd/system/
sudo cp mining-stats.timer /etc/systemd/system/
sudo systemctl daemon-reload

# Enable services for auto-start
sudo systemctl enable mining-worker.service
sudo systemctl enable mining-stats.timer

# Verify services are properly enabled
if sudo systemctl is-enabled mining-worker.service >/dev/null 2>&1; then
    echo "✅ Mining service enabled for auto-start"
else
    echo "⚠️  Warning: Mining service not enabled for auto-start"
fi

if sudo systemctl is-enabled mining-stats.timer >/dev/null 2>&1; then
    echo "✅ Stats reporting enabled for auto-start"
else
    echo "⚠️  Warning: Stats reporting not enabled for auto-start"
fi

echo "✅ Services installed"

# Start mining and stats reporting
echo "🚀 Starting Bitcoin mining..."
sudo systemctl start mining-worker.service
sudo systemctl start mining-stats.timer

# Wait and check status
sleep 5

# Test server connectivity with detailed diagnostics
echo "📡 Testing connection to main server..."
SERVER_IP="192.168.1.168"
SERVER_PORT="3000"
SERVER_URL="http://$SERVER_IP:$SERVER_PORT"

# Test 1: Ping test
echo -n "   Ping test: "
if ping -c 1 -W 3 $SERVER_IP >/dev/null 2>&1; then
    echo "✅ SUCCESS"
else
    echo "❌ FAILED"
    echo "⚠️  Warning: Cannot ping server ($SERVER_IP)"
fi

# Test 2: Port connectivity
echo -n "   Port connectivity: "
if timeout 5 bash -c "</dev/tcp/$SERVER_IP/$SERVER_PORT" 2>/dev/null; then
    echo "✅ SUCCESS"
else
    echo "❌ FAILED"
    echo "⚠️  Warning: Cannot connect to port $SERVER_PORT"
fi

# Test 3: HTTP API test
echo -n "   API endpoint test: "
HTTP_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null --connect-timeout 10 "$SERVER_URL/api/status" 2>/dev/null)
if [ "$HTTP_RESPONSE" = "200" ]; then
    echo "✅ SUCCESS (HTTP $HTTP_RESPONSE)"
    echo "✅ Server connection successful"
else
    echo "❌ FAILED (HTTP $HTTP_RESPONSE)"
    echo "⚠️  Warning: Cannot reach main server ($SERVER_URL)"
    echo "   Mining will continue but stats may not report"
    echo "   Run CLIENT-DIAGNOSTICS.sh for detailed troubleshooting"
fi

# Check if minerd binary exists
if [ ! -f "/usr/local/bin/minerd" ]; then
    echo "❌ Critical Error: minerd binary not found!"
    echo "   Installation failed during compilation"
    exit 1
fi

if sudo systemctl is-active --quiet mining-worker; then
    echo "✅ Bitcoin mining started successfully!"
    echo "📊 Stats reporting every 30 seconds"
    echo ""
    echo "🎉 Installation Complete!"
    echo ""
    echo "Your computer is now mining Bitcoin and reporting to:"
    echo "Main Server: http://192.168.1.168:3000"
    echo ""
    echo "This computer will:"
    echo "• Start mining automatically on boot"
    echo "• Report stats every 30 seconds"
    echo "• Work silently in the background"
    echo "• Require no further management"
    echo ""
echo "To check status: sudo systemctl status mining-worker"
echo "To stop mining: sudo systemctl stop mining-worker"
echo "To start mining: sudo systemctl start mining-worker"
echo "To check stats: sudo systemctl status mining-stats.timer"
echo "To run diagnostics: bash ~/bitcoin-mining/CLIENT-DIAGNOSTICS.sh"
echo "To uninstall: bash $0 --uninstall"
echo "To cleanup and reinstall: bash $0 --cleanup"
    echo ""
    echo "🔍 Quick verification:"
    echo "• Mining process: $(pgrep -f minerd | wc -l) processes running"
    echo "• Service status: $(sudo systemctl is-active mining-worker)"
    echo "• Auto-start enabled: $(sudo systemctl is-enabled mining-worker)"
    echo "• Stats timer: $(sudo systemctl is-active mining-stats.timer)"
else
    echo "❌ Failed to start mining service"
    echo ""
    echo "🔧 Troubleshooting:"
    echo "1. Check service status: sudo systemctl status mining-worker"
    echo "2. Check logs: sudo journalctl -u mining-worker -f"
    echo "3. Check stats timer: sudo systemctl status mining-stats.timer"
    echo "4. Manual start: sudo systemctl start mining-worker"
    echo ""
    echo "The installation completed but the service needs manual intervention."
fi

echo ""
read -p "Press Enter to close..."
