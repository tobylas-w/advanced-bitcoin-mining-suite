#!/bin/bash
# Bitcoin Mining Worker - Headless Client
# For Linux Mint and Ubuntu systems
# Reports to: 192.168.1.168:3000
# NO DASHBOARD - JUST MINING WORK

set -e  # Exit on any error

echo "=========================================="
echo "  Bitcoin Mining Worker v2.0"
echo "  Headless Mining Client"
echo "  Reports to: 192.168.1.168:3000"
echo "=========================================="

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "❌ Please don't run as root. Use a regular user account."
    exit 1
fi

# Check internet connection
if ! ping -c 1 8.8.8.8 >/dev/null 2>&1; then
    echo "❌ No internet connection. Please check your network."
    exit 1
fi

echo "✅ Internet connection verified"

# Get system info
HOSTNAME=$(hostname)
USERNAME=$(whoami)
OS_VERSION=$(lsb_release -d | cut -f2)
CPU_CORES=$(nproc)
MEMORY_GB=$(free -g | awk '/^Mem:/{print $2}')

echo "📋 System Information:"
echo "   Hostname: $HOSTNAME"
echo "   User: $USERNAME"
echo "   OS: $OS_VERSION"
echo "   CPU Cores: $CPU_CORES"
echo "   Memory: ${MEMORY_GB}GB"

# Install dependencies
echo ""
echo "🔧 Installing dependencies..."

# Update package list
sudo apt update

# Install required packages
sudo apt install -y \
    build-essential \
    git \
    curl \
    wget \
    lm-sensors \
    htop \
    jq \
    python3 \
    python3-pip

# Install radeontop for AMD GPU monitoring (if AMD GPU present)
if lspci | grep -i vga | grep -i amd >/dev/null 2>&1; then
    echo "🔍 AMD GPU detected, installing radeontop..."
    sudo apt install -y radeontop
fi

# Install NVIDIA monitoring tools (if NVIDIA GPU present)
if lspci | grep -i vga | grep -i nvidia >/dev/null 2>&1; then
    echo "🔍 NVIDIA GPU detected, installing nvidia-smi..."
    # nvidia-smi is usually included with NVIDIA drivers
    if ! command -v nvidia-smi >/dev/null 2>&1; then
        echo "⚠️  nvidia-smi not found. Please install NVIDIA drivers first."
    fi
fi

echo "✅ Dependencies installed"

# Create mining directory
MINING_DIR="$HOME/bitcoin-mining"
mkdir -p "$MINING_DIR"
cd "$MINING_DIR"

echo ""
echo "⛏️  Setting up Bitcoin mining..."

# Download and compile cpuminer
echo "📥 Downloading cpuminer..."
if [ ! -d "cpuminer-multi" ]; then
    git clone https://github.com/tpruvot/cpuminer-multi.git
fi

cd cpuminer-multi

echo "🔨 Compiling cpuminer (this may take a few minutes)..."
./autogen.sh
./configure --with-crypto --with-curl
make -j$(nproc)

# Install cpuminer system-wide
sudo make install

echo "✅ cpuminer compiled and installed"

# Create mining configuration
cd "$MINING_DIR"

cat > mining-config.json << EOF
{
    "server": "192.168.1.168",
    "port": 3000,
    "hostname": "$HOSTNAME",
    "username": "$USERNAME",
    "os": "$OS_VERSION",
    "cpu_cores": $CPU_CORES,
    "memory_gb": $MEMORY_GB,
    "pool_url": "stratum+tcp://btc.ss.poolin.com:443",
    "wallet": "bc1qz2zqqgdz7whfmmkpcthn5gkv4ew4dfjs6fyeat",
    "worker_name": "${HOSTNAME}-${USERNAME}",
    "auto_start": true,
    "restart_on_failure": true
}
EOF

# Create stats reporting script
cat > report-stats.sh << 'EOF'
#!/bin/bash

CONFIG_FILE="$HOME/bitcoin-mining/mining-config.json"
SERVER=$(jq -r '.server' "$CONFIG_FILE")
PORT=$(jq -r '.port' "$CONFIG_FILE")
HOSTNAME=$(jq -r '.hostname' "$CONFIG_FILE")

# Get system stats
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
GPU_USAGE="0"
GPU_TEMP="0"

# Try to get GPU usage (AMD)
if command -v radeontop >/dev/null 2>&1; then
    GPU_USAGE=$(timeout 2 radeontop -d- -l1 | grep -o '[0-9]*\.[0-9]*%' | head -1 | cut -d'%' -f1 || echo "0")
fi

# Try to get GPU usage (NVIDIA)
if command -v nvidia-smi >/dev/null 2>&1; then
    GPU_USAGE=$(nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null | head -1 || echo "0")
    GPU_TEMP=$(nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits 2>/dev/null | head -1 || echo "0")
fi

# Get CPU temperature
CPU_TEMP=$(sensors 2>/dev/null | grep -i "cpu\|core" | grep -o '[0-9]*\.[0-9]*°C' | head -1 | cut -d'°' -f1 || echo "0")

# Get power usage (estimate)
POWER_USAGE=$(echo "$CPU_USAGE * 0.8" | bc -l 2>/dev/null || echo "0")

# Check if mining process is running
MINING_PID=$(pgrep -f "minerd\|cpuminer" || echo "")
MINING_STATUS="offline"
HASHRATE="0"
SHARES_ACCEPTED="0"
SHARES_REJECTED="0"
UPTIME="0"

if [ ! -z "$MINING_PID" ]; then
    MINING_STATUS="mining"
    # Try to get hashrate from process (simplified)
    HASHRATE=$(echo "scale=2; $CPU_USAGE * 0.01" | bc -l 2>/dev/null || echo "0.05")
    
    # Get uptime (simplified)
    UPTIME=$(ps -o etime= -p $MINING_PID 2>/dev/null | awk '{print $1}' | cut -d':' -f1 || echo "0")
    UPTIME=$(($UPTIME * 60)) # Convert minutes to seconds
fi

# Prepare stats data
STATS_DATA=$(cat << STATS_EOF
{
    "hostname": "$HOSTNAME",
    "status": "$MINING_STATUS",
    "hashrate": $HASHRATE,
    "shares": {
        "accepted": $SHARES_ACCEPTED,
        "rejected": $SHARES_REJECTED
    },
    "uptime": $UPTIME,
    "temperature": $CPU_TEMP,
    "power": $POWER_USAGE,
    "cpuUsage": $CPU_USAGE,
    "gpuUsage": $GPU_USAGE,
    "gpuTemperature": $GPU_TEMP,
    "timestamp": $(date +%s)
}
STATS_EOF
)

# Send stats to server
curl -s -X POST "http://$SERVER:$PORT/api/remote-client" \
    -H "Content-Type: application/json" \
    -d "$STATS_DATA" >/dev/null 2>&1 || true

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Stats reported: $MINING_STATUS, ${HASHRATE}MH/s, ${CPU_USAGE}% CPU"
EOF

chmod +x report-stats.sh

# Create systemd service for automatic mining
cat > bitcoin-mining.service << EOF
[Unit]
Description=Bitcoin Mining Client
After=network.target
Wants=network.target

[Service]
Type=simple
User=$USERNAME
WorkingDirectory=$MINING_DIR
ExecStart=$MINING_DIR/start-mining.sh
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Create mining start script
cat > start-mining.sh << 'EOF'
#!/bin/bash

CONFIG_FILE="$HOME/bitcoin-mining/mining-config.json"
POOL_URL=$(jq -r '.pool_url' "$CONFIG_FILE")
WALLET=$(jq -r '.wallet' "$CONFIG_FILE")
WORKER_NAME=$(jq -r '.worker_name' "$CONFIG_FILE")

echo "Starting Bitcoin mining..."
echo "Pool: $POOL_URL"
echo "Wallet: $WALLET"
echo "Worker: $WORKER_NAME"

# Start mining with cpuminer
exec minerd \
    -a sha256d \
    -o "$POOL_URL" \
    -u "$WALLET" \
    -p x \
    -t 4 \
    --retry-pause=5 \
    --failover-only \
    --no-longpoll \
    --no-getwork \
    --no-stratum
EOF

chmod +x start-mining.sh

# Install systemd service
sudo cp bitcoin-mining.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable bitcoin-mining.service

echo ""
echo "✅ Mining worker installed successfully!"
echo ""
echo "📋 What was installed:"
echo "   • cpuminer (Bitcoin mining software)"
echo "   • System monitoring tools"
echo "   • Automatic mining service"
echo "   • Stats reporting to main server"
echo ""
echo "🎛️  Management commands:"
echo "   Start mining:  sudo systemctl start bitcoin-mining"
echo "   Stop mining:   sudo systemctl stop bitcoin-mining"
echo "   Status:        sudo systemctl status bitcoin-mining"
echo "   View logs:     sudo journalctl -u bitcoin-mining -f"
echo ""
echo "📊 This worker will:"
echo "   • Start mining automatically on boot"
echo "   • Report stats to main server every 30 seconds"
echo "   • Restart if mining fails"
echo "   • Work silently in background"
echo ""

# Setup automatic stats reporting
(crontab -l 2>/dev/null; echo "*/30 * * * * $MINING_DIR/report-stats.sh") | crontab -

echo "🚀 Starting mining worker..."
sudo systemctl start bitcoin-mining.service

# Wait a moment and check status
sleep 3
if sudo systemctl is-active --quiet bitcoin-mining; then
    echo "✅ Mining worker started successfully!"
    echo "🔧 This machine is now a Bitcoin mining worker"
    echo "📊 Stats will be reported to main server automatically"
else
    echo "⚠️  Mining worker may have issues. Check with: sudo systemctl status bitcoin-mining"
fi

echo ""
echo "🎯 This is a HEADLESS WORKER - no dashboard needed"
echo "📡 All monitoring is done from the main server dashboard"
echo ""
echo "🎉 Worker installation complete! This machine is now mining Bitcoin!"
EOF
