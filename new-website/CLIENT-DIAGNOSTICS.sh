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
if [ -f "/var/log/syslog" ]; then
    echo "Recent mining-stats.service runs:"
    grep "mining-stats.service" /var/log/syslog | tail -3 | while read line; do
        echo "  $line"
    done
else
    echo "System log not accessible (run as root for full diagnostics)"
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

