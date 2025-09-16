#!/bin/bash

echo "========================================"
echo "  BITCOIN MINING DEPLOYMENT - UBUNTU"
echo "========================================"
echo

# Check for root privileges
if [ "$EUID" -ne 0 ]; then
    echo "[ERROR] This script requires root privileges"
    echo "Run with: sudo $0"
    exit 1
fi

echo "[INFO] Installing Bitcoin Mining System..."

# Update system
echo "[INFO] Updating system packages..."
apt update && apt upgrade -y

# Install dependencies
echo "[INFO] Installing dependencies..."
apt install -y nodejs npm git build-essential automake autoconf libtool openssl libcurl4-openssl-dev

# Create installation directory
INSTALL_DIR="/opt/bitcoin-miner"
mkdir -p "$INSTALL_DIR"

# Download and build CPUMiner
echo "[INFO] Building CPUMiner..."
cd /tmp
git clone https://github.com/pooler/cpuminer.git
cd cpuminer
./autogen.sh
./configure
make
cp minerd "$INSTALL_DIR/"

# Copy mining system files
echo "[INFO] Copying mining system files..."
cp -r "$(dirname "$0")/../src" "$INSTALL_DIR/"
cp "$(dirname "$0")/../package.json" "$INSTALL_DIR/"

# Install Node.js dependencies
echo "[INFO] Installing Node.js dependencies..."
cd "$INSTALL_DIR"
npm install --production

# Create systemd service
echo "[INFO] Creating systemd service..."
cat > /etc/systemd/system/bitcoin-miner.service << EOF
[Unit]
Description=Bitcoin Mining Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node $INSTALL_DIR/src/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
echo "[INFO] Starting Bitcoin mining service..."
systemctl daemon-reload
systemctl enable bitcoin-miner
systemctl start bitcoin-miner

# Create firewall rules
echo "[INFO] Configuring firewall..."
ufw allow 3000/tcp

echo
echo "========================================"
echo "  INSTALLATION COMPLETE!"
echo "========================================"
echo
echo "Bitcoin mining system installed to: $INSTALL_DIR"
echo "Service Name: bitcoin-miner"
echo "Dashboard: http://localhost:3000"
echo
echo "Your wallet: bc1qgef2v0taxcae8wfmf868ydg92qp36guv68ddh4"
echo
echo "To check status: systemctl status bitcoin-miner"
echo "To view logs: journalctl -u bitcoin-miner -f"
echo
