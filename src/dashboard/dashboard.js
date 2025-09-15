// Bitcoin Mining Dashboard JavaScript

class BitcoinMiningDashboard {
    constructor() {
        this.socket = null;
        this.charts = {};
        this.isMining = false;
        this.userConsent = false;
        this.bitcoinPrice = 0;
        this.chartData = {
            hashrate: { labels: [], data: [] },
            temperature: { labels: [], data: [] }
        };
        
        this.init();
    }

    init() {
        this.setupSocket();
        this.setupEventListeners();
        this.setupCharts();
        this.loadSettings();
        this.showConsentModal();
        this.updateSystemInfo();
        
        // Update Bitcoin price
        this.updateBitcoinPrice();
        setInterval(() => this.updateBitcoinPrice(), 300000); // Every 5 minutes
    }

    setupSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.updateConnectionStatus(true);
            this.addLogEntry('Connected to mining server', 'success');
        });
        
        this.socket.on('disconnect', () => {
            this.updateConnectionStatus(false);
            this.addLogEntry('Disconnected from mining server', 'error');
        });
        
        this.socket.on('miningStats', (stats) => {
            this.updateMiningStats(stats);
            this.updateCharts(stats);
        });
        
        this.socket.on('miningStarted', () => {
            this.isMining = true;
            this.updateMiningStatus();
            this.addLogEntry('Mining started successfully', 'success');
        });
        
        this.socket.on('miningStopped', () => {
            this.isMining = false;
            this.updateMiningStatus();
            this.addLogEntry('Mining stopped', 'info');
        });
        
        this.socket.on('shareAccepted', (data) => {
            this.addLogEntry(`Share accepted by pool (${data.hash.substring(0, 8)}...)`, 'success');
        });
        
        this.socket.on('shareRejected', (data) => {
            this.addLogEntry(`Share rejected by pool (${data.hash.substring(0, 8)}...)`, 'warning');
        });
        
        this.socket.on('error', (error) => {
            this.addLogEntry(`Error: ${error.message}`, 'error');
        });
    }

    setupEventListeners() {
        // Mining toggle
        document.getElementById('toggleMining').addEventListener('click', () => {
            if (!this.userConsent) {
                this.showConsentModal();
                return;
            }
            
            if (this.isMining) {
                this.stopMining();
            } else {
                this.startMining();
            }
        });
        
        // Settings
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.showSettingsModal();
        });
        
        // Intensity slider
        const intensitySlider = document.getElementById('miningIntensity');
        const intensityValue = document.getElementById('intensityValue');
        
        intensitySlider.addEventListener('input', (e) => {
            intensityValue.textContent = e.target.value;
        });
        
        // Apply settings
        document.getElementById('applySettings').addEventListener('click', () => {
            this.applyMiningSettings();
        });
        
        // Modal controls
        this.setupModalControls();
        
        // Consent modal
        this.setupConsentModal();
        
        // Settings tabs
        this.setupSettingsTabs();
        
        // Log controls
        document.getElementById('clearLog').addEventListener('click', () => {
            this.clearLog();
        });
        
        document.getElementById('exportLog').addEventListener('click', () => {
            this.exportLog();
        });
    }

    setupModalControls() {
        const settingsModal = document.getElementById('settingsModal');
        const consentModal = document.getElementById('consentModal');
        
        // Settings modal
        document.getElementById('closeSettings').addEventListener('click', () => {
            settingsModal.classList.remove('show');
        });
        
        document.getElementById('cancelSettings').addEventListener('click', () => {
            settingsModal.classList.remove('show');
        });
        
        document.getElementById('saveSettings').addEventListener('click', () => {
            this.saveSettings();
            settingsModal.classList.remove('show');
        });
        
        // Click outside to close
        [settingsModal, consentModal].forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            });
        });
    }

    setupConsentModal() {
        const consentModal = document.getElementById('consentModal');
        const agreeCheckbox = document.getElementById('agreeToTerms');
        const acceptBtn = document.getElementById('acceptConsent');
        const declineBtn = document.getElementById('declineConsent');
        
        agreeCheckbox.addEventListener('change', (e) => {
            acceptBtn.disabled = !e.target.checked;
        });
        
        acceptBtn.addEventListener('click', () => {
            this.userConsent = true;
            this.saveConsent(true);
            consentModal.classList.remove('show');
            this.addLogEntry('User consent granted for Bitcoin mining', 'success');
        });
        
        declineBtn.addEventListener('click', () => {
            this.userConsent = false;
            this.saveConsent(false);
            consentModal.classList.remove('show');
            this.addLogEntry('User declined mining consent', 'warning');
        });
    }

    setupSettingsTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                
                // Remove active class from all tabs and contents
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                // Add active class to clicked tab and corresponding content
                btn.classList.add('active');
                document.getElementById(tabId).classList.add('active');
            });
        });
    }

    setupCharts() {
        // Hashrate chart
        const hashrateCtx = document.getElementById('hashrateChart').getContext('2d');
        this.charts.hashrate = new Chart(hashrateCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Hashrate (H/s)',
                    data: [],
                    borderColor: '#f7931a',
                    backgroundColor: 'rgba(247, 147, 26, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#cccccc'
                        },
                        grid: {
                            color: '#444444'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#cccccc'
                        },
                        grid: {
                            color: '#444444'
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#cccccc'
                        }
                    }
                }
            }
        });
        
        // Temperature chart
        const tempCtx = document.getElementById('temperatureChart').getContext('2d');
        this.charts.temperature = new Chart(tempCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'CPU Temperature (°C)',
                    data: [],
                    borderColor: '#ff6b35',
                    backgroundColor: 'rgba(255, 107, 53, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            color: '#cccccc'
                        },
                        grid: {
                            color: '#444444'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#cccccc'
                        },
                        grid: {
                            color: '#444444'
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#cccccc'
                        }
                    }
                }
            }
        });
    }

    showConsentModal() {
        if (!this.getConsentStatus()) {
            document.getElementById('consentModal').classList.add('show');
        } else {
            this.userConsent = true;
        }
    }

    showSettingsModal() {
        this.loadSettingsToForm();
        document.getElementById('settingsModal').classList.add('show');
    }

    async startMining() {
        try {
            this.socket.emit('startMining', { userConsent: this.userConsent });
            this.addLogEntry('Starting Bitcoin mining...', 'info');
        } catch (error) {
            this.addLogEntry(`Failed to start mining: ${error.message}`, 'error');
        }
    }

    async stopMining() {
        try {
            this.socket.emit('stopMining');
            this.addLogEntry('Stopping Bitcoin mining...', 'info');
        } catch (error) {
            this.addLogEntry(`Failed to stop mining: ${error.message}`, 'error');
        }
    }

    applyMiningSettings() {
        const settings = {
            intensity: parseInt(document.getElementById('miningIntensity').value),
            cpuMining: document.getElementById('cpuMining').checked,
            gpuMining: document.getElementById('gpuMining').checked
        };
        
        this.socket.emit('updateMiningSettings', settings);
        this.addLogEntry('Mining settings applied', 'success');
    }

    updateMiningStats(stats) {
        // Update status cards
        document.getElementById('hashrateValue').textContent = this.formatHashrate(stats.hashrate);
        document.getElementById('dailyEarnings').textContent = this.formatBTC(stats.earnings.daily);
        document.getElementById('dailyEarningsUSD').textContent = this.formatUSD(stats.earnings.daily * this.bitcoinPrice);
        document.getElementById('sharesValue').textContent = `${stats.shares.accepted} / ${stats.shares.total}`;
        
        const acceptRate = stats.shares.total > 0 ? (stats.shares.accepted / stats.shares.total * 100).toFixed(1) : 0;
        document.getElementById('sharesRate').textContent = `${acceptRate}% accepted`;
        
        // Update temperature
        const maxTemp = Math.max(stats.temperature.cpu, ...stats.temperature.gpu.map(g => g.temperature));
        document.getElementById('temperatureValue').textContent = `${maxTemp}°C`;
        
        const tempStatus = maxTemp > 85 ? 'High' : maxTemp > 70 ? 'Warm' : 'Normal';
        document.getElementById('temperatureStatus').textContent = tempStatus;
        document.getElementById('temperatureStatus').className = `status-change ${tempStatus.toLowerCase()}`;
        
        // Update earnings breakdown
        document.getElementById('hourlyEarnings').textContent = this.formatBTC(stats.earnings.hourly);
        document.getElementById('dailyEarningsDetail').textContent = this.formatBTC(stats.earnings.daily);
        document.getElementById('weeklyEarnings').textContent = this.formatBTC(stats.earnings.daily * 7);
        document.getElementById('monthlyEarnings').textContent = this.formatBTC(stats.earnings.daily * 30);
    }

    updateMiningStatus() {
        const toggleBtn = document.getElementById('toggleMining');
        const statusIndicator = document.getElementById('miningStatus');
        const uptimeIndicator = document.getElementById('uptimeStatus');
        
        if (this.isMining) {
            toggleBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Mining';
            toggleBtn.className = 'btn btn-danger';
            statusIndicator.innerHTML = '<i class="fas fa-play-circle"></i><span>Running</span>';
            statusIndicator.className = 'indicator running';
        } else {
            toggleBtn.innerHTML = '<i class="fas fa-play"></i> Start Mining';
            toggleBtn.className = 'btn btn-primary';
            statusIndicator.innerHTML = '<i class="fas fa-pause-circle"></i><span>Stopped</span>';
            statusIndicator.className = 'indicator stopped';
        }
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connectionStatus');
        if (connected) {
            statusElement.innerHTML = '<i class="fas fa-circle"></i><span>Connected</span>';
            statusElement.className = 'connection-status connected';
        } else {
            statusElement.innerHTML = '<i class="fas fa-circle"></i><span>Disconnected</span>';
            statusElement.className = 'connection-status disconnected';
        }
    }

    updateCharts(stats) {
        const now = new Date().toLocaleTimeString();
        
        // Update hashrate chart
        this.chartData.hashrate.labels.push(now);
        this.chartData.hashrate.data.push(stats.hashrate);
        
        // Keep only last 20 data points
        if (this.chartData.hashrate.labels.length > 20) {
            this.chartData.hashrate.labels.shift();
            this.chartData.hashrate.data.shift();
        }
        
        this.charts.hashrate.update();
        
        // Update temperature chart
        const maxTemp = Math.max(stats.temperature.cpu, ...stats.temperature.gpu.map(g => g.temperature));
        this.chartData.temperature.labels.push(now);
        this.chartData.temperature.data.push(maxTemp);
        
        if (this.chartData.temperature.labels.length > 20) {
            this.chartData.temperature.labels.shift();
            this.chartData.temperature.data.shift();
        }
        
        this.charts.temperature.update();
    }

    async updateSystemInfo() {
        try {
            const response = await fetch('/api/system-info');
            const systemInfo = await response.json();
            
            // Update CPU info
            document.getElementById('cpuModel').textContent = systemInfo.cpu.manufacturer + ' ' + systemInfo.cpu.brand;
            document.getElementById('cpuCores').textContent = systemInfo.cpu.cores;
            document.getElementById('cpuUsage').textContent = systemInfo.cpu.usage + '%';
            document.getElementById('cpuTemp').textContent = systemInfo.cpu.temperature + '°C';
            
            // Update GPU info
            if (systemInfo.gpu.controllers.length > 0) {
                const gpu = systemInfo.gpu.controllers[0];
                document.getElementById('gpuModel').textContent = gpu.model;
                document.getElementById('gpuMemory').textContent = (gpu.vram / 1024 / 1024 / 1024).toFixed(1) + ' GB';
                document.getElementById('gpuUsage').textContent = '0%'; // GPU usage not available in systeminformation
                document.getElementById('gpuTemp').textContent = (gpu.temperatureGpu || 'N/A') + '°C';
            } else {
                document.getElementById('gpuModel').textContent = 'No GPU detected';
                document.getElementById('gpuMemory').textContent = 'N/A';
                document.getElementById('gpuUsage').textContent = 'N/A';
                document.getElementById('gpuTemp').textContent = 'N/A';
            }
        } catch (error) {
            console.error('Failed to update system info:', error);
        }
    }

    async updateBitcoinPrice() {
        try {
            const response = await fetch('/api/bitcoin-price');
            const data = await response.json();
            this.bitcoinPrice = data.price;
        } catch (error) {
            console.error('Failed to update Bitcoin price:', error);
        }
    }

    addLogEntry(message, type = 'info') {
        const logContent = document.getElementById('logContent');
        const timestamp = new Date().toLocaleTimeString();
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.innerHTML = `
            <span class="log-time">[${timestamp}]</span>
            <span class="log-message">${message}</span>
        `;
        
        logContent.appendChild(logEntry);
        logContent.scrollTop = logContent.scrollHeight;
        
        // Keep only last 100 log entries
        while (logContent.children.length > 100) {
            logContent.removeChild(logContent.firstChild);
        }
    }

    clearLog() {
        document.getElementById('logContent').innerHTML = `
            <div class="log-entry info">
                <span class="log-time">[${new Date().toLocaleTimeString()}]</span>
                <span class="log-message">Log cleared</span>
            </div>
        `;
    }

    exportLog() {
        const logContent = document.getElementById('logContent');
        const logText = Array.from(logContent.children).map(entry => 
            entry.textContent.trim()
        ).join('\n');
        
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mining-log-${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    loadSettings() {
        const settings = JSON.parse(localStorage.getItem('miningSettings') || '{}');
        
        if (settings.intensity) {
            document.getElementById('miningIntensity').value = settings.intensity;
            document.getElementById('intensityValue').textContent = settings.intensity;
        }
        
        if (settings.cpuMining !== undefined) {
            document.getElementById('cpuMining').checked = settings.cpuMining;
        }
        
        if (settings.gpuMining !== undefined) {
            document.getElementById('gpuMining').checked = settings.gpuMining;
        }
    }

    saveSettings() {
        const settings = {
            intensity: parseInt(document.getElementById('miningIntensity').value),
            cpuMining: document.getElementById('cpuMining').checked,
            gpuMining: document.getElementById('gpuMining').checked,
            theme: document.getElementById('dashboardTheme').value,
            currency: document.getElementById('currencyDisplay').value,
            walletAddress: document.getElementById('walletAddress').value,
            miningPool: document.getElementById('miningPool').value,
            workerName: document.getElementById('workerName').value,
            enableNotifications: document.getElementById('enableNotifications').checked,
            notificationSound: document.getElementById('notificationSound').checked,
            temperatureAlert: parseInt(document.getElementById('temperatureAlert').value),
            requireAuth: document.getElementById('requireAuth').checked,
            sessionTimeout: parseInt(document.getElementById('sessionTimeout').value)
        };
        
        localStorage.setItem('miningSettings', JSON.stringify(settings));
        this.addLogEntry('Settings saved successfully', 'success');
    }

    loadSettingsToForm() {
        const settings = JSON.parse(localStorage.getItem('miningSettings') || '{}');
        
        Object.keys(settings).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = settings[key];
                } else {
                    element.value = settings[key];
                }
            }
        });
    }

    saveConsent(consent) {
        localStorage.setItem('miningConsent', JSON.stringify({
            granted: consent,
            timestamp: Date.now()
        }));
    }

    getConsentStatus() {
        const consent = localStorage.getItem('miningConsent');
        if (!consent) return false;
        
        try {
            const consentData = JSON.parse(consent);
            // Check if consent is less than 30 days old
            return consentData.granted && (Date.now() - consentData.timestamp) < (30 * 24 * 60 * 60 * 1000);
        } catch {
            return false;
        }
    }

    formatHashrate(hashrate) {
        if (hashrate >= 1e12) return (hashrate / 1e12).toFixed(2) + ' TH/s';
        if (hashrate >= 1e9) return (hashrate / 1e9).toFixed(2) + ' GH/s';
        if (hashrate >= 1e6) return (hashrate / 1e6).toFixed(2) + ' MH/s';
        if (hashrate >= 1e3) return (hashrate / 1e3).toFixed(2) + ' KH/s';
        return hashrate.toFixed(0) + ' H/s';
    }

    formatBTC(btc) {
        return btc.toFixed(8) + ' BTC';
    }

    formatUSD(usd) {
        return '$' + usd.toFixed(2);
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new BitcoinMiningDashboard();
});




