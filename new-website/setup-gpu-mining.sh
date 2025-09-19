#!/bin/bash
# GPU Mining Setup Script
# This script sets up real GPU mining for AMD GPUs

echo "=========================================="
echo "  GPU Mining Setup"
echo "=========================================="

# Check if we have a GPU
echo "🔍 Detecting GPU..."
GPU_INFO=$(lspci | grep -i vga)
echo "GPU detected: $GPU_INFO"

# Check for AMD GPU
if echo "$GPU_INFO" | grep -qi "amd\|radeon"; then
    echo "✅ AMD GPU detected"
    GPU_TYPE="amd"
elif echo "$GPU_INFO" | grep -qi "nvidia"; then
    echo "✅ NVIDIA GPU detected"
    GPU_TYPE="nvidia"
else
    echo "❌ No compatible GPU detected"
    exit 1
fi

# Check OpenCL availability
echo "🔍 Checking OpenCL availability..."
if command -v clinfo >/dev/null 2>&1; then
    echo "✅ OpenCL info available"
    clinfo | grep -E "Platform Name|Device Name" | head -4
else
    echo "⚠️  OpenCL info not available, but continuing..."
fi

# Create GPU mining directory
mkdir -p ~/gpu-mining
cd ~/gpu-mining

# Download appropriate GPU miner
echo "📥 Downloading GPU miner..."

if [ "$GPU_TYPE" = "amd" ]; then
    echo "Downloading AMD GPU miner (lolMiner)..."
    
    # Download lolMiner for AMD GPUs
    LOLMINER_VERSION="1.86"
    LOLMINER_URL="https://github.com/Lolliedieb/lolMiner-releases/releases/download/${LOLMINER_VERSION}/lolMiner_v${LOLMINER_VERSION}_Lin64.tar.gz"
    
    if ! wget -q "$LOLMINER_URL" -O lolminer.tar.gz; then
        echo "❌ Failed to download lolMiner"
        echo "Trying alternative download..."
        # Try alternative URL
        LOLMINER_URL="https://github.com/Lolliedieb/lolMiner-releases/releases/download/v${LOLMINER_VERSION}/lolMiner_v${LOLMINER_VERSION}_Lin64.tar.gz"
        wget -q "$LOLMINER_URL" -O lolminer.tar.gz
    fi
    
    if [ -f "lolminer.tar.gz" ]; then
        echo "✅ lolMiner downloaded"
        tar -xzf lolminer.tar.gz
        mv lolMiner_v${LOLMINER_VERSION}_Lin64 lolminer
        chmod +x lolminer/lolMiner
        echo "✅ lolMiner extracted and ready"
    else
        echo "❌ Failed to download lolMiner"
        exit 1
    fi
    
elif [ "$GPU_TYPE" = "nvidia" ]; then
    echo "Downloading NVIDIA GPU miner (T-Rex)..."
    
    # Download T-Rex for NVIDIA GPUs
    TREX_VERSION="0.26.8"
    TREX_URL="https://github.com/trexminer/T-Rex/releases/download/${TREX_VERSION}/t-rex-${TREX_VERSION}-linux.tar.gz"
    
    if ! wget -q "$TREX_URL" -O trex.tar.gz; then
        echo "❌ Failed to download T-Rex"
        exit 1
    fi
    
    if [ -f "trex.tar.gz" ]; then
        echo "✅ T-Rex downloaded"
        tar -xzf trex.tar.gz
        chmod +x t-rex
        echo "✅ T-Rex extracted and ready"
    else
        echo "❌ Failed to download T-Rex"
        exit 1
    fi
fi

# Create GPU mining configuration
echo "⚙️  Creating GPU mining configuration..."

if [ "$GPU_TYPE" = "amd" ]; then
    cat > gpu-mining.sh << 'EOF'
#!/bin/bash
cd ~/gpu-mining/lolminer

# AMD GPU mining with lolMiner
./lolMiner \
    --algo SHA256 \
    --pool stratum+tcp://btc.ss.poolin.com:443 \
    --user bc1qz2zqqgdz7whfmmkpcthn5gkv4ew4dfjs6fyeat \
    --pass x \
    --tls on \
    --keepfree 1024 \
    --4g-alloc-size 4076 \
    --watchdog exit
EOF
elif [ "$GPU_TYPE" = "nvidia" ]; then
    cat > gpu-mining.sh << 'EOF'
#!/bin/bash
cd ~/gpu-mining

# NVIDIA GPU mining with T-Rex
./t-rex \
    -a sha256d \
    -o stratum+tcp://btc.ss.poolin.com:443 \
    -u bc1qz2zqqgdz7whfmmkpcthn5gkv4ew4dfjs6fyeat \
    -p x \
    --tls \
    --no-watchdog
EOF
fi

chmod +x gpu-mining.sh

# Create systemd service for GPU mining
echo "🔧 Creating systemd service..."

cat > gpu-mining.service << EOF
[Unit]
Description=GPU Bitcoin Mining
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME/gpu-mining
ExecStart=$HOME/gpu-mining/gpu-mining.sh
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Install the service
sudo cp gpu-mining.service /etc/systemd/system/
sudo systemctl daemon-reload

echo "✅ GPU mining setup complete!"
echo ""
echo "To start GPU mining: sudo systemctl start gpu-mining"
echo "To stop GPU mining: sudo systemctl stop gpu-mining"
echo "To enable auto-start: sudo systemctl enable gpu-mining"
echo "To check status: sudo systemctl status gpu-mining"
echo ""
echo "Manual testing: cd ~/gpu-mining && ./gpu-mining.sh"
echo ""
echo "=========================================="

