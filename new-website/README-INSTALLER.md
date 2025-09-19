# Bitcoin Mining Worker - Simple Installation

## 🎯 What This Does
This installs Bitcoin mining software that:
- Mines Bitcoin automatically
- Reports to your main server (192.168.1.168:3000)
- Starts automatically on boot
- Works silently in the background
- Requires no manual management

## 📥 Installation Methods

### Method 1: USB Drive
1. Copy `INSTALL-MINING-WORKER.sh` to a USB drive
2. Insert USB into Linux Mint computer
3. Open file manager, navigate to USB
4. Right-click `INSTALL-MINING-WORKER.sh`
5. Select "Open with Terminal"
6. Follow the prompts

### Method 2: Email
1. Email `INSTALL-MINING-WORKER.sh` to yourself
2. Download attachment on Linux Mint computer
3. Right-click the file
4. Select "Open with Terminal"
5. Follow the prompts

### Method 3: Download
1. On Linux Mint computer, open browser
2. Go to: http://192.168.1.168:3000/INSTALL-MINING-WORKER.sh
3. Save the file
4. Right-click and "Open with Terminal"

## 🎛️ After Installation

### Check Status
```bash
sudo systemctl status bitcoin-mining
```

### Stop Mining
```bash
sudo systemctl stop bitcoin-mining
```

### Start Mining
```bash
sudo systemctl start bitcoin-mining
```

### View Logs
```bash
sudo journalctl -u bitcoin-mining -f
```

## 📊 Monitor on Main Server
Visit: http://192.168.1.168:3000
- Go to "Client List" section
- Your Linux Mint computer will appear there
- See real-time mining stats

## ❓ Troubleshooting

### If installation fails:
- Make sure you have internet connection
- Make sure you're not running as root user
- Check that the file is executable

### If mining doesn't start:
- Check internet connection
- Verify main server is running (192.168.1.168:3000)
- Check logs: `sudo journalctl -u bitcoin-mining -f`

## 🎯 That's It!
Once installed, the computer will mine Bitcoin automatically and report to your main dashboard. No further management needed!
