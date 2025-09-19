#!/bin/bash

echo "🔍 Testing connection to mining server..."
echo "Target: http://192.168.1.168:3000"

# Test basic connectivity
echo "📡 Testing basic connectivity..."
if curl -s -m 5 http://192.168.1.168:3000/api/status > /dev/null; then
    echo "✅ Server is reachable"
else
    echo "❌ Cannot reach server at 192.168.1.168:3000"
    echo "🔧 Troubleshooting:"
    echo "   - Check if server is running"
    echo "   - Check network connectivity"
    echo "   - Check firewall settings"
    exit 1
fi

# Test client registration
echo "📋 Testing client registration..."
HOSTNAME=$(hostname)
RESPONSE=$(curl -s -X POST http://192.168.1.168:3000/api/remote-client \
    -H "Content-Type: application/json" \
    -d "{
        \"hostname\": \"$HOSTNAME\",
        \"status\": \"testing\",
        \"hashrate\": 0.05,
        \"shares\": {\"accepted\": 0, \"rejected\": 0},
        \"uptime\": 0,
        \"temperature\": 45,
        \"cpuUsage\": 25,
        \"gpuUsage\": 0,
        \"gpuTemperature\": 0,
        \"power\": 85
    }")

if echo "$RESPONSE" | grep -q "success"; then
    echo "✅ Client registration successful"
    echo "📊 Response: $RESPONSE"
else
    echo "❌ Client registration failed"
    echo "📊 Response: $RESPONSE"
    exit 1
fi

# Check if client appears in list
echo "📋 Checking client list..."
CLIENTS=$(curl -s http://192.168.1.168:3000/api/remote-clients)
if echo "$CLIENTS" | grep -q "$HOSTNAME"; then
    echo "✅ Client appears in server client list"
    echo "📊 Client list: $CLIENTS"
else
    echo "❌ Client not found in server list"
    echo "📊 Server response: $CLIENTS"
fi

echo ""
echo "🎯 Next steps:"
echo "1. If all tests pass, the connection is working"
echo "2. Check if mining service is running: systemctl status mining-worker"
echo "3. If service is not running, start it: sudo systemctl start mining-worker"
echo "4. Check service logs: sudo journalctl -u mining-worker -f"
