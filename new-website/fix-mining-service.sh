#!/bin/bash

echo "🔧 Fixing mining service on Linux Mint..."

# Create the mining service directory
sudo mkdir -p /opt/mining-worker
cd /opt/mining-worker

# Download and compile cpuminer if not already done
if [ ! -f "minerd" ]; then
    echo "📦 Installing dependencies and cpuminer..."
    
    # Update system
    sudo apt update
    
    # Install dependencies
    sudo apt install -y build-essential libssl-dev libcurl4-openssl-dev libjansson-dev libgmp-dev automake git
    
    # Clone and compile cpuminer
    if [ ! -d "cpuminer-multi" ]; then
        git clone https://github.com/tpruvot/cpuminer-multi.git
    fi
    
    cd cpuminer-multi
    ./autogen.sh
    ./configure CFLAGS="-march=native" --with-crypto --with-curl
    make -j$(nproc)
    sudo cp minerd /opt/mining-worker/
    cd ..
fi

# Create start script
sudo tee start-mining.sh > /dev/null << 'EOF'
#!/bin/bash
cd /opt/mining-worker

# Start mining
./minerd \
    -a sha256d \
    -o stratum+tcp://btc.ss.poolin.com:443 \
    -u bc1qz2zqqgdz7whfmmkpcthn5gkv4ew4dfjs6fyeat \
    -p x \
    -t 4

EOF

sudo chmod +x start-mining.sh

# Create stats reporter script
sudo tee report-stats.sh > /dev/null << 'EOF'
#!/bin/bash
HOSTNAME=$(hostname)
MINING_PID=$(pgrep -f "minerd" || echo "")
STATUS="offline"
HASHRATE="0"
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
TEMPERATURE=$(sensors 2>/dev/null | grep -E "Core 0|Package id 0" | awk '{print $3}' | cut -d'+' -f2 | cut -d'°' -f1 | head -1 || echo "45")

if [ ! -z "$MINING_PID" ]; then
    STATUS="mining"
    HASHRATE="0.05"
fi

curl -s -X POST "http://192.168.1.168:3000/api/remote-client" \
    -H "Content-Type: application/json" \
    -d "{
        \"hostname\": \"$HOSTNAME\",
        \"status\": \"$STATUS\",
        \"hashrate\": $HASHRATE,
        \"shares\": {\"accepted\": 0, \"rejected\": 0},
        \"uptime\": 0,
        \"temperature\": $TEMPERATURE,
        \"cpuUsage\": $CPU_USAGE,
        \"gpuUsage\": 0,
        \"gpuTemperature\": 0,
        \"power\": 85,
        \"os\": \"Linux Mint\",
        \"cpu\": \"$(lscpu | grep 'Model name' | cut -d':' -f2 | xargs)\"
    }" > /dev/null 2>&1
EOF

sudo chmod +x report-stats.sh

# Create systemd service
sudo tee /etc/systemd/system/mining-worker.service > /dev/null << 'EOF'
[Unit]
Description=Bitcoin Mining Worker
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/mining-worker
ExecStart=/opt/mining-worker/start-mining.sh
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Create stats reporting service
sudo tee /etc/systemd/system/mining-stats.service > /dev/null << 'EOF'
[Unit]
Description=Mining Stats Reporter
After=network.target

[Service]
Type=oneshot
User=root
WorkingDirectory=/opt/mining-worker
ExecStart=/opt/mining-worker/report-stats.sh

[Install]
WantedBy=multi-user.target
EOF

# Create stats reporting timer
sudo tee /etc/systemd/system/mining-stats.timer > /dev/null << 'EOF'
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

# Reload systemd and start services
sudo systemctl daemon-reload
sudo systemctl enable mining-worker.service
sudo systemctl enable mining-stats.timer
sudo systemctl start mining-worker.service
sudo systemctl start mining-stats.timer

echo "✅ Mining service created and started!"
echo "📊 Check status with: sudo systemctl status mining-worker"
echo "📋 Check logs with: sudo journalctl -u mining-worker -f"
echo "📈 Check stats with: sudo systemctl status mining-stats.timer"
