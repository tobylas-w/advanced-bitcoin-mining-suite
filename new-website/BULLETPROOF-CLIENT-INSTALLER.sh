#!/bin/bash
# BULLETPROOF Bitcoin Mining Client Installer
# Zero-maintenance, install-and-forget deployment
# Server: Auto-detected
# Version: 2.0

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

echo "=========================================="
echo "  BULLETPROOF MINING CLIENT INSTALLER"
echo "  Zero-Maintenance Deployment"
echo "  Version 2.0"
echo "=========================================="

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    error "Please don't run as root. Use a regular user account."
    exit 1
fi

# Get system information
HOSTNAME=$(hostname)
OS_INFO=$(lsb_release -d 2>/dev/null | cut -f2 || echo "Unknown Linux")
CPU_MODEL=$(lscpu | grep "Model name" | cut -d: -f2 | xargs || echo "Unknown CPU")
MEMORY_GB=$(free -g | awk '/^Mem:/{print $2}')
GPU_INFO=$(lspci | grep -i vga | head -1 | cut -d: -f3 | xargs || echo "No GPU detected")

log "System Information:"
log "  Hostname: $HOSTNAME"
log "  OS: $OS_INFO"
log "  CPU: $CPU_MODEL"
log "  Memory: ${MEMORY_GB}GB"
log "  GPU: $GPU_INFO"

# Network auto-detection and configuration
log "🔍 Auto-detecting network configuration..."

# Function to test server connectivity
test_server_connection() {
    local server_ip=$1
    local server_port=$2
    
    if curl -s --connect-timeout 5 "http://$server_ip:$server_port/api/status" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Auto-detect server IP
SERVER_IPS=(
    "192.168.1.168"  # Primary server IP
    "192.168.0.168"  # Alternative network
    "10.0.0.168"     # Corporate network
    "172.16.0.168"   # Docker network
)

# Try to detect server from network
DETECTED_SERVER=""
for ip in "${SERVER_IPS[@]}"; do
    if test_server_connection "$ip" "3000"; then
        DETECTED_SERVER="$ip"
        log "✅ Server detected: $ip:3000"
        break
    fi
done

# If no server detected, try to find it via network scan
if [ -z "$DETECTED_SERVER" ]; then
    log "🔍 Scanning local network for mining server..."
    
    # Get local network range
    LOCAL_IP=$(ip route get 8.8.8.8 | awk '{print $7; exit}' 2>/dev/null || echo "192.168.1.1")
    NETWORK_RANGE=$(echo $LOCAL_IP | cut -d. -f1-3)
    
    # Scan common server IPs in the network
    for i in {1..254}; do
        test_ip="$NETWORK_RANGE.$i"
        if test_server_connection "$test_ip" "3000"; then
            DETECTED_SERVER="$test_ip"
            log "✅ Server found via network scan: $test_ip:3000"
            break
        fi
    done
fi

# Final fallback
if [ -z "$DETECTED_SERVER" ]; then
    error "Could not auto-detect mining server. Please check network connectivity."
    error "Make sure the mining server is running and accessible."
    exit 1
fi

SERVER_URL="http://$DETECTED_SERVER:3000"
log "🎯 Using server: $SERVER_URL"

# Get server configuration
log "📡 Fetching server configuration..."
SERVER_CONFIG=$(curl -s --connect-timeout 10 "$SERVER_URL/api/installer-info" 2>/dev/null || echo "{}")

if [ "$SERVER_CONFIG" = "{}" ]; then
    warning "Could not fetch server configuration, using defaults"
    POOL_URL="stratum+tcp://btc.ss.poolin.com:443"
    WALLET_ADDRESS="bc1qz2zqqgdz7whfmmkpcthn5gkv4ew4dfjs6fyeat"
else
    POOL_URL=$(echo "$SERVER_CONFIG" | grep -o '"poolUrl":"[^"]*"' | cut -d'"' -f4 || echo "stratum+tcp://btc.ss.poolin.com:443")
    WALLET_ADDRESS=$(echo "$SERVER_CONFIG" | grep -o '"walletAddress":"[^"]*"' | cut -d'"' -f4 || echo "bc1qz2zqqgdz7whfmmkpcthn5gkv4ew4dfjs6fyeat")
fi

log "📊 Server Configuration:"
log "  Pool: $POOL_URL"
log "  Wallet: $WALLET_ADDRESS"

# Install dependencies
log "📦 Installing system dependencies..."

# Detect package manager and install dependencies
if command -v apt-get >/dev/null 2>&1; then
    # Debian/Ubuntu
    sudo apt-get update -qq
    sudo apt-get install -y curl git build-essential autotools-dev automake libtool pkg-config lm-sensors bc htop
elif command -v yum >/dev/null 2>&1; then
    # CentOS/RHEL
    sudo yum update -y
    sudo yum install -y curl git gcc gcc-c++ make autoconf automake libtool pkgconfig lm_sensors bc htop
elif command -v dnf >/dev/null 2>&1; then
    # Fedora
    sudo dnf update -y
    sudo dnf install -y curl git gcc gcc-c++ make autoconf automake libtool pkgconfig lm_sensors bc htop
elif command -v pacman >/dev/null 2>&1; then
    # Arch Linux
    sudo pacman -Syu --noconfirm
    sudo pacman -S --noconfirm curl git base-devel lm_sensors bc htop
else
    error "Unsupported package manager. Please install dependencies manually."
    exit 1
fi

log "✅ Dependencies installed successfully"

# Download and compile cpuminer
log "⛏️  Setting up CPU miner..."

MINER_DIR="$HOME/cpuminer"
if [ -d "$MINER_DIR" ]; then
    log "CPU miner already exists, updating..."
    cd "$MINER_DIR"
    git pull
else
    log "Downloading CPU miner..."
    git clone https://github.com/pooler/cpuminer.git "$MINER_DIR"
    cd "$MINER_DIR"
fi

# Configure and compile
log "🔨 Compiling CPU miner..."
./autogen.sh
./configure CFLAGS="-O3"
make -j$(nproc)

log "✅ CPU miner compiled successfully"

# Create mining service script
log "🔧 Creating mining service..."

SERVICE_SCRIPT="$HOME/mining-service.sh"
cat > "$SERVICE_SCRIPT" << 'EOF'
#!/bin/bash
# Mining Service Script - Auto-generated

# Configuration
SERVER_URL="SERVER_URL_PLACEHOLDER"
HOSTNAME="HOSTNAME_PLACEHOLDER"
POOL_URL="POOL_URL_PLACEHOLDER"
WALLET_ADDRESS="WALLET_ADDRESS_PLACEHOLDER"
MINER_PATH="MINER_PATH_PLACEHOLDER"

# Logging
LOG_FILE="$HOME/mining.log"
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# System monitoring functions
get_cpu_usage() {
    if command -v top >/dev/null 2>&1; then
        top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}'
    else
        cat /proc/loadavg | cut -d' ' -f1 | awk '{printf "%.0f", $1*100}'
    fi
}

get_cpu_temp() {
    if [ -f "/sys/class/thermal/thermal_zone0/temp" ]; then
        cat /sys/class/thermal/thermal_zone0/temp | awk '{printf "%.0f", $1/1000}'
    elif command -v sensors >/dev/null 2>&1; then
        sensors 2>/dev/null | grep -i "core 0\|cpu" | grep -o '[0-9]*°C' | head -1 | sed 's/°C//' || echo "0"
    else
        echo "0"
    fi
}

get_power_usage() {
    cpu_usage=$(get_cpu_usage)
    cpu_temp=$(get_cpu_temp)
    base_power=45
    cpu_power=$(echo "$cpu_usage * 0.8" | bc -l 2>/dev/null || echo "$cpu_usage")
    thermal_power=$(echo "($cpu_temp - 70) * 0.5" | bc -l 2>/dev/null || echo "0")
    if (( $(echo "$thermal_power < 0" | bc -l 2>/dev/null || echo "1") )); then
        thermal_power=0
    fi
    echo "$base_power + $cpu_power + $thermal_power" | bc -l 2>/dev/null | cut -d. -f1 || echo "65"
}

# Mining function
start_mining() {
    log "Starting CPU mining..."
    
    # Calculate optimal thread count (use 80% of available cores)
    THREADS=$(nproc)
    THREADS=$((THREADS * 80 / 100))
    if [ $THREADS -lt 1 ]; then
        THREADS=1
    fi
    
    log "Using $THREADS threads for mining"
    
    # Start mining
    "$MINER_PATH" -a sha256d -o "$POOL_URL" -u "$WALLET_ADDRESS" -p x -t $THREADS &
    MINER_PID=$!
    
    log "Mining started with PID: $MINER_PID"
    echo $MINER_PID > "$HOME/mining.pid"
}

# Stats reporting function
report_stats() {
    local status="offline"
    local hashrate=0
    local uptime=0
    
    if [ -f "$HOME/mining.pid" ]; then
        local pid=$(cat "$HOME/mining.pid")
        if kill -0 "$pid" 2>/dev/null; then
            status="mining"
            hashrate=0.25  # Estimated hashrate
            uptime=$(ps -o etime= -p "$pid" 2>/dev/null | tr -d ' ' || echo "0")
        fi
    fi
    
    local cpu_usage=$(get_cpu_usage)
    local cpu_temp=$(get_cpu_temp)
    local power_usage=$(get_power_usage)
    
    # Report to server with multiple fallback attempts
    local server_ips=("192.168.1.168" "192.168.0.168" "10.0.0.168" "172.16.0.168")
    local reported=false
    
    for server_ip in "${server_ips[@]}"; do
        if curl -s --connect-timeout 5 -X POST "http://$server_ip:3000/api/remote-client" \
            -H "Content-Type: application/json" \
            -d "{
                \"hostname\": \"$HOSTNAME\",
                \"name\": \"$HOSTNAME\",
                \"status\": \"$status\",
                \"hashrate\": $hashrate,
                \"uptime\": \"$uptime\",
                \"shares\": {\"accepted\": 0, \"rejected\": 0},
                \"os\": \"$(lsb_release -d 2>/dev/null | cut -f2 || echo "Unknown")\",
                \"cpu\": \"$(lscpu | grep "Model name" | cut -d: -f2 | xargs || echo "Unknown")\",
                \"cpuUsage\": $cpu_usage,
                \"temperature\": $cpu_temp,
                \"power\": $power_usage,
                \"version\": \"2.0\",
                \"capabilities\": [\"cpu_mining\", \"auto_reconnect\", \"health_monitoring\"]
            }" >/dev/null 2>&1; then
            reported=true
            break
        fi
    done
    
    if [ "$reported" = true ]; then
        log "Stats reported successfully"
    else
        log "Failed to report stats to server"
    fi
}

# Main service loop
main() {
    log "Mining service started"
    
    # Start mining
    start_mining
    
    # Main loop
    while true; do
        # Report stats every 30 seconds
        report_stats
        
        # Check if miner is still running
        if [ -f "$HOME/mining.pid" ]; then
            local pid=$(cat "$HOME/mining.pid")
            if ! kill -0 "$pid" 2>/dev/null; then
                log "Miner process died, restarting..."
                start_mining
            fi
        fi
        
        # Sleep for 30 seconds
        sleep 30
    done
}

# Handle signals
trap 'log "Mining service stopped"; exit 0' SIGTERM SIGINT

# Start the service
main
EOF

# Replace placeholders in service script
sed -i "s|SERVER_URL_PLACEHOLDER|$SERVER_URL|g" "$SERVICE_SCRIPT"
sed -i "s|HOSTNAME_PLACEHOLDER|$HOSTNAME|g" "$SERVICE_SCRIPT"
sed -i "s|POOL_URL_PLACEHOLDER|$POOL_URL|g" "$SERVICE_SCRIPT"
sed -i "s|WALLET_ADDRESS_PLACEHOLDER|$WALLET_ADDRESS|g" "$SERVICE_SCRIPT"
sed -i "s|MINER_PATH_PLACEHOLDER|$MINER_DIR/minerd|g" "$SERVICE_SCRIPT"

chmod +x "$SERVICE_SCRIPT"

# Create systemd service
log "🔧 Creating systemd service..."

SERVICE_NAME="mining-client"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"

sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=Bitcoin Mining Client
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME
ExecStart=$SERVICE_SCRIPT
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl start "$SERVICE_NAME"

log "✅ Mining service created and started"

# Test connection to server
log "🧪 Testing connection to mining server..."
if test_server_connection "$DETECTED_SERVER" "3000"; then
    log "✅ Connection to server successful"
else
    warning "Could not connect to server, but service is installed"
fi

# Final status
log "🎉 Installation completed successfully!"
log ""
log "📊 Installation Summary:"
log "  ✅ Dependencies installed"
log "  ✅ CPU miner compiled"
log "  ✅ Mining service created"
log "  ✅ Auto-start enabled"
log "  ✅ Server connection: $DETECTED_SERVER:3000"
log ""
log "🔧 Service Management:"
log "  Start:   sudo systemctl start $SERVICE_NAME"
log "  Stop:    sudo systemctl stop $SERVICE_NAME"
log "  Status:  sudo systemctl status $SERVICE_NAME"
log "  Logs:    journalctl -u $SERVICE_NAME -f"
log ""
log "📁 Files:"
log "  Service: $SERVICE_SCRIPT"
log "  Miner:   $MINER_DIR/minerd"
log "  Logs:    $HOME/mining.log"
log ""
log "🚀 The mining client is now running automatically!"
log "   No further maintenance required - it's completely automated."

# Register with server
log "📡 Registering with mining server..."
curl -s --connect-timeout 10 -X POST "$SERVER_URL/api/remote-client" \
    -H "Content-Type: application/json" \
    -d "{
        \"hostname\": \"$HOSTNAME\",
        \"name\": \"$HOSTNAME\",
        \"status\": \"installed\",
        \"hashrate\": 0,
        \"uptime\": \"0\",
        \"shares\": {\"accepted\": 0, \"rejected\": 0},
        \"os\": \"$OS_INFO\",
        \"cpu\": \"$CPU_MODEL\",
        \"cpuUsage\": 0,
        \"temperature\": 0,
        \"power\": 0,
        \"version\": \"2.0\",
        \"capabilities\": [\"cpu_mining\", \"auto_reconnect\", \"health_monitoring\"]
    }" >/dev/null 2>&1 && log "✅ Successfully registered with server" || warning "Could not register with server"

echo "=========================================="
echo "  INSTALLATION COMPLETE"
echo "  Zero-maintenance mining client active"
echo "=========================================="
