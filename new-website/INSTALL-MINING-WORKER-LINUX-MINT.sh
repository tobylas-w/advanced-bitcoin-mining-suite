#!/bin/bash
# Bitcoin Mining Client Installer - Linux Mint Optimized
# Server: 192.168.1.168:3000

set -e  # Exit on any error

echo "=========================================="
echo "  Bitcoin Mining Client Installer v2.1"
echo "  Linux Mint Optimized"
echo "  Server: 192.168.1.168:3000"
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

echo "✅ System check passed"

# Detect Linux Mint version
if [ -f /etc/linuxmint/info ]; then
    MINT_VERSION=$(grep RELEASE /etc/linuxmint/info | cut -d= -f2)
    echo "🔍 Detected Linux Mint $MINT_VERSION"
else
    echo "⚠️  Linux Mint version detection failed, using generic Ubuntu packages"
fi

# Install dependencies with Linux Mint specific packages
echo "📦 Installing dependencies..."
sudo apt-get update -qq

# Install essential packages
sudo apt-get install -y curl git build-essential autotools-dev automake libtool pkg-config lm-sensors bc

# Install additional packages for better compatibility
sudo apt-get install -y htop iotop nethogs

# Install GPU monitoring tools
echo "🔧 Installing GPU monitoring tools..."
# Try to install radeontop for AMD GPUs
sudo apt-get install -y radeontop 2>/dev/null || echo "⚠️  radeontop not available (may need manual install)"

# Try to install nvidia-smi for NVIDIA GPUs (if applicable)
if command -v nvidia-smi >/dev/null 2>&1; then
    echo "✅ NVIDIA GPU detected"
else
    echo "ℹ️  No NVIDIA GPU detected, skipping nvidia-smi"
fi

# Check if cpuminer already exists
MINER_DIR="/home/$USER/cpuminer"
if [ -d "$MINER_DIR" ] && [ -f "$MINER_DIR/minerd" ]; then
    echo "✅ cpuminer already installed"
else
    echo "🔨 Compiling cpuminer..."
    rm -rf "$MINER_DIR"
    cd /tmp
    git clone https://github.com/pooler/cpuminer.git "$MINER_DIR"
    cd "$MINER_DIR"
    
    # Compile with optimizations for Linux Mint
    ./autogen.sh
    ./configure CFLAGS="-O3 -march=native -mtune=native"
    make -j$(nproc)
    
    if [ ! -f "$MINER_DIR/minerd" ]; then
        echo "❌ Compilation failed!"
        exit 1
    fi
    
    echo "✅ cpuminer compiled successfully"
fi

# Create systemd service for auto-start
echo "⚙️  Creating system service..."
sudo tee /etc/systemd/system/bitcoin-miner.service > /dev/null << EOF
[Unit]
Description=Bitcoin Mining Client
After=network.target
Wants=network.target

[Service]
Type=forking
User=$USER
WorkingDirectory=/home/$USER
ExecStart=/home/$USER/mining-client.sh
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Create the main mining script with Linux Mint optimizations
cat > /home/$USER/mining-client.sh << 'EOF'
#!/bin/bash
# Production Bitcoin Mining Client - Linux Mint Optimized
# Auto-restarting, error handling, proper logging

set -e

# Configuration
MINER_PATH="/home/$USER/cpuminer/minerd"
POOL_URL="stratum+tcp://btc.ss.poolin.com:443"
WALLET="bc1qz2zqqgdz7whfmmkpcthn5gkv4ew4dfjs6fyeat"
SERVER_URL="http://192.168.1.168:3000"
LOG_FILE="/home/$USER/mining.log"
PID_FILE="/home/$USER/mining.pid"

# Client identification
CLIENT_ID="$(hostname)-$(date +%s)"
CLIENT_NAME="$(hostname)"
CPU_CORES=$(nproc)

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Cleanup function
cleanup() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            log "Stopping miner (PID: $PID)"
            kill "$PID"
            wait "$PID" 2>/dev/null || true
        fi
        rm -f "$PID_FILE"
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

log "Starting Bitcoin Mining Client (Linux Mint Optimized)"
log "Client: $CLIENT_NAME ($CLIENT_ID)"
log "Server: $SERVER_URL"
log "CPU Cores: $CPU_CORES"

# Test server connectivity with detailed error reporting
log "🔍 Testing server connectivity..."
if ! curl -s --connect-timeout 10 "$SERVER_URL/api/status" >/dev/null; then
    log "❌ Cannot connect to server: $SERVER_URL"
    log "🔍 Network diagnostics:"
    
    # Test basic connectivity
    if ping -c 1 8.8.8.8 >/dev/null 2>&1; then
        log "✅ Internet connection: OK"
    else
        log "❌ Internet connection: FAILED"
    fi
    
    # Test DNS resolution
    if nslookup $(echo "$SERVER_URL" | sed 's|http://||' | sed 's|:.*||') >/dev/null 2>&1; then
        log "✅ DNS resolution: OK"
    else
        log "❌ DNS resolution: FAILED"
    fi
    
    # Test port connectivity
    SERVER_HOST=$(echo "$SERVER_URL" | sed 's|http://||' | sed 's|:.*||')
    SERVER_PORT=$(echo "$SERVER_URL" | sed 's|.*:||' | sed 's|/.*||')
    if timeout 5 bash -c "</dev/tcp/$SERVER_HOST/$SERVER_PORT" 2>/dev/null; then
        log "✅ Port $SERVER_PORT connectivity: OK"
    else
        log "❌ Port $SERVER_PORT connectivity: FAILED"
    fi
    
    log "🔄 Retrying in 30 seconds..."
    sleep 30
    exit 1
fi

log "✅ Server connection verified"

# Start mining with proper error handling
while true; do
    log "Starting miner process..."
    
    # Start miner in background
    nohup "$MINER_PATH" \
        -a sha256d \
        -o "$POOL_URL" \
        -u "$WALLET" \
        -p x \
        -t "$CPU_CORES" \
        >> "$LOG_FILE" 2>&1 &
    
    MINER_PID=$!
    echo "$MINER_PID" > "$PID_FILE"
    
    log "Miner started (PID: $MINER_PID)"
    
    # System monitoring functions - Linux Mint optimized
    get_cpu_usage() {
        # Get CPU usage percentage - Linux Mint compatible
        if command -v top >/dev/null 2>&1; then
            # Try different top output formats for different Linux distributions
            cpu_line=$(top -bn1 | grep -E "Cpu\\(s\\)|%Cpu" | head -1)
            if echo "$cpu_line" | grep -q "id,"; then
                # Standard format
                echo "$cpu_line" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk '{print 100 - $1}'
            elif echo "$cpu_line" | grep -q "id "; then
                # Alternative format
                echo "$cpu_line" | awk '{for(i=1;i<=NF;i++) if($i ~ /id/) {gsub(/%/, "", $(i-1)); print 100-$(i-1); exit}}'
            else
                # Fallback
                echo "0"
            fi
        else
            # Fallback using /proc/loadavg
            load=$(cat /proc/loadavg | cut -d' ' -f1)
            cores=$(nproc)
            echo "$load $cores" | awk '{printf "%.0f", ($1/$2)*100}'
        fi
    }
    
    get_gpu_usage() {
        # Try different GPU monitoring methods
        if command -v nvidia-smi >/dev/null 2>&1; then
            # NVIDIA GPU
            nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null | head -1 || echo "0"
        elif command -v radeontop >/dev/null 2>&1; then
            # AMD GPU
            timeout 1 radeontop -d - -l 1 2>/dev/null | grep -o '[0-9]*%' | head -1 | sed 's/%//' || echo "0"
        else
            echo "0"
        fi
    }
    
    get_cpu_temp() {
        # Try different temperature sources - Linux Mint compatible
        if [ -f "/sys/class/thermal/thermal_zone0/temp" ]; then
            cat /sys/class/thermal/thermal_zone0/temp | awk '{printf "%.0f", $1/1000}'
        elif [ -f "/sys/class/thermal/thermal_zone1/temp" ]; then
            cat /sys/class/thermal/thermal_zone1/temp | awk '{printf "%.0f", $1/1000}'
        elif command -v sensors >/dev/null 2>&1; then
            # Try multiple sensor patterns for different systems
            temp=$(sensors 2>/dev/null | grep -E -i "(core 0|package id 0|cpu|temp1)" | grep -o '[0-9]*\.[0-9]*°C' | head -1 | sed 's/°C//' || echo "0")
            if [ "$temp" = "0" ]; then
                # Try alternative sensor output format
                temp=$(sensors 2>/dev/null | grep -E -i "(core 0|package id 0|cpu|temp1)" | grep -o '[0-9]*°C' | head -1 | sed 's/°C//' || echo "0")
            fi
            echo "$temp"
        else
            echo "0"
        fi
    }
    
    get_gpu_temp() {
        # Try different GPU temperature sources
        if command -v nvidia-smi >/dev/null 2>&1; then
            nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits 2>/dev/null | head -1 || echo "0"
        elif command -v sensors >/dev/null 2>&1; then
            sensors 2>/dev/null | grep -i "radeon\\|gpu" | grep -o '[0-9]*°C' | head -1 | sed 's/°C//' || echo "0"
        else
            echo "0"
        fi
    }
    
    get_power_usage() {
        # Estimate power usage based on CPU usage and temperature - Linux Mint compatible
        cpu_usage=$(get_cpu_usage)
        cpu_temp=$(get_cpu_temp)
        base_power=45
        
        # Use bc if available, otherwise use awk for calculations
        if command -v bc >/dev/null 2>&1; then
            cpu_power=$(echo "$cpu_usage * 0.8" | bc -l 2>/dev/null || echo "$cpu_usage")
            thermal_power=$(echo "($cpu_temp - 70) * 0.5" | bc -l 2>/dev/null || echo "0")
            if (( $(echo "$thermal_power < 0" | bc -l 2>/dev/null || echo "1") )); then
                thermal_power=0
            fi
            echo "$base_power + $cpu_power + $thermal_power" | bc -l 2>/dev/null | cut -d. -f1 || echo "65"
        else
            # Fallback using awk for calculations
            cpu_power=$(awk "BEGIN {printf \"%.0f\", $cpu_usage * 0.8}")
            thermal_power=$(awk "BEGIN {printf \"%.0f\", ($cpu_temp - 70) * 0.5}")
            if [ "$thermal_power" -lt 0 ]; then
                thermal_power=0
            fi
            awk "BEGIN {printf \"%.0f\", $base_power + $cpu_power + $thermal_power}"
        fi
    }
    
    # Stats reporting function
    report_stats() {
        if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
            # Parse hashrate from log (simplified)
            HASH_RATE=$(tail -n 50 "$LOG_FILE" | grep -o '[0-9]*\.[0-9]* khash/s' | tail -1 | grep -o '[0-9]*\.[0-9]*' || echo "0")
            UPTIME=$(ps -o etime= -p "$(cat "$PID_FILE")" | tr -d ' ')
            
            # Get system info
            CPU_MODEL=$(cat /proc/cpuinfo | grep 'model name' | head -1 | cut -d: -f2 | xargs)
            OS_INFO="$(uname -s) $(uname -r)"
            
            # Get system monitoring data
            CPU_USAGE=$(get_cpu_usage)
            GPU_USAGE=$(get_gpu_usage)
            CPU_TEMP=$(get_cpu_temp)
            GPU_TEMP=$(get_gpu_temp)
            POWER_USAGE=$(get_power_usage)
            
            # Report to server with error handling
            response=$(curl -s --connect-timeout 10 -X POST "$SERVER_URL/api/remote-client" \
                -H "Content-Type: application/json" \
                -d "{
                    \"id\": \"$CLIENT_ID\",
                    \"name\": \"$CLIENT_NAME\",
                    \"hashrate\": $HASH_RATE,
                    \"status\": \"mining\",
                    \"uptime\": \"$UPTIME\",
                    \"shares\": 0,
                    \"os\": \"$OS_INFO\",
                    \"cpu\": \"$CPU_MODEL\",
                    \"cpuUsage\": $CPU_USAGE,
                    \"gpuUsage\": $GPU_USAGE,
                    \"temperature\": $CPU_TEMP,
                    \"gpuTemperature\": $GPU_TEMP,
                    \"power\": $POWER_USAGE
                }" 2>&1)
            
            if [ $? -eq 0 ] && echo "$response" | grep -q "success"; then
                log "✅ Stats reported successfully"
            else
                log "⚠️  Failed to report stats: $response"
                # Try to reconnect
                if ! curl -s --connect-timeout 5 "$SERVER_URL/api/status" >/dev/null; then
                    log "❌ Server connection lost, attempting to reconnect..."
                fi
            fi
        else
            # Report offline
            curl -s --connect-timeout 5 -X POST "$SERVER_URL/api/remote-client" \
                -H "Content-Type: application/json" \
                -d "{
                    \"id\": \"$CLIENT_ID\",
                    \"name\": \"$CLIENT_NAME\",
                    \"status\": \"offline\"
                }" || true
        fi
    }
    
    # Monitor miner process and report stats
    while [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; do
        report_stats
        sleep 30
    done
    
    log "❌ Miner process died. Restarting in 10 seconds..."
    sleep 10
done
EOF

chmod +x /home/$USER/mining-client.sh

# Enable and start the service
echo "🚀 Enabling auto-start service..."
sudo systemctl daemon-reload
sudo systemctl enable bitcoin-miner.service
sudo systemctl start bitcoin-miner.service

# Wait a moment and check status
sleep 3
if systemctl is-active --quiet bitcoin-miner.service; then
    echo "✅ Service started successfully"
else
    echo "⚠️  Service may have issues. Check: sudo journalctl -u bitcoin-miner.service"
fi

echo ""
echo "=========================================="
echo "  Installation Complete!"
echo "=========================================="
echo "📊 Monitor: http://192.168.1.168:3000"
echo "📝 Logs: tail -f /home/$USER/mining.log"
echo "🔧 Service: sudo systemctl status bitcoin-miner.service"
echo "⏹️  Stop: sudo systemctl stop bitcoin-miner.service"
echo "▶️  Start: sudo systemctl start bitcoin-miner.service"
echo ""
echo "✅ Client will auto-start on boot and restart if it crashes"
echo "🔍 Linux Mint optimizations applied for better compatibility"
