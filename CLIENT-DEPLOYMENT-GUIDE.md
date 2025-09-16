# 🏢 CLIENT DEPLOYMENT GUIDE

## 🎯 **OBJECTIVE: Mine on CLIENT COMPUTERS, not this main computer**

### **Architecture:**
- **Main Computer (This Fedora):** Control center + dashboard
- **Client Computers (Office PCs):** Actual Bitcoin mining

## 🚀 **DEPLOYMENT PROCESS:**

### **Step 1: Deploy to Client Computers**

#### **Windows 11 Computers:**
```bash
# Download installer
wget https://your-server.com/deployment/windows-installer.bat

# Run as administrator
# Right-click → "Run as administrator"
```

#### **Ubuntu/Linux Computers:**
```bash
# Download installer
wget https://your-server.com/deployment/ubuntu-installer.sh

# Run installation
chmod +x ubuntu-installer.sh
sudo ./ubuntu-installer.sh
```

### **Step 2: What Happens on Client Computers**

Each client computer will:
1. **Install dependencies** (Node.js, CPUMiner)
2. **Start client-miner.js** (not the main server)
3. **Detect hardware** (CPU cores, GPU if available)
4. **Start mining** with 75% of CPU cores
5. **Report back** to main server every 60 seconds
6. **Run as service** (auto-start on boot)

### **Step 3: Monitor from Main Computer**

**Access your control dashboard:**
```
http://localhost:3000/compact-dashboard.html
```

**Features:**
- View all connected clients
- See individual hashrates
- Monitor total network earnings
- Control start/stop for all clients

## 💰 **EARNINGS PROJECTION:**

### **Per Client Computer:**
- **CPU Only:** ~50 MH/s → ~$4/day → ~$120/month
- **CPU + GPU:** ~150 MH/s → ~$12/day → ~$360/month

### **Scaling:**
- **5 Clients:** $600-$1,800/month
- **10 Clients:** $1,200-$3,600/month
- **20 Clients:** $2,400-$7,200/month

## 🔧 **CLIENT MINER FEATURES:**

### **Hardware Detection:**
- ✅ CPU cores count
- ✅ Total memory
- ✅ GPU detection (AMD/NVIDIA)
- ✅ Platform detection (Windows/Linux)

### **Mining Strategy:**
- ✅ Uses 75% of CPU cores
- ✅ GPU mining if available
- ✅ Automatic restart on failure
- ✅ Reports to main server

### **Server Communication:**
- ✅ Registers with main server
- ✅ Reports stats every 60 seconds
- ✅ Continues mining if server offline
- ✅ Graceful shutdown handling

## 📊 **MONITORING:**

### **From Main Computer Dashboard:**
```
http://localhost:3000/compact-dashboard.html
```

**Shows:**
- Total network hashrate
- Individual client performance
- Combined earnings
- Client status (online/offline)
- Real-time updates

### **From Command Line:**
```bash
# Check individual client
curl http://CLIENT_IP:3000/api/status

# Check main server
curl http://localhost:3000/api/clients
```

## 🎯 **DEPLOYMENT CHECKLIST:**

### **Before Deployment:**
- [ ] Main server running on this computer
- [ ] Dashboard accessible at localhost:3000
- [ ] Installers ready in deployment/ folder

### **Client Deployment:**
- [ ] Download installer to client computer
- [ ] Run installer as administrator/root
- [ ] Verify client appears in dashboard
- [ ] Confirm mining is active

### **Verification:**
- [ ] Client shows in dashboard
- [ ] Hashrate > 0
- [ ] Shares being found
- [ ] Earnings calculating

## ⚠️ **IMPORTANT NOTES:**

### **Legal & Ethical:**
- ✅ Only deploy on computers you own
- ✅ Get explicit permission from users
- ✅ Be transparent about mining activity
- ✅ Monitor power usage and cooling

### **Technical:**
- ✅ Clients run independently
- ✅ Mining continues if main server goes down
- ✅ Automatic restart on client reboot
- ✅ No complex network configuration needed

---

## 🚀 **READY TO DEPLOY!**

**Your main server is ready at:**
```
http://localhost:3000/compact-dashboard.html
```

**Deploy to client computers using:**
- `deployment/windows-installer.bat` (Windows)
- `deployment/ubuntu-installer.sh` (Linux)

**This will mine on CLIENT computers and report back to THIS computer!** 🎯
