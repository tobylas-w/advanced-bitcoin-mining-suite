// Bitcoin Mining Extension Popup Script

class MiningExtensionPopup {
    constructor() {
        this.isMining = false;
        this.userConsent = false;
        this.bitcoinPrice = 0;
        this.miningStats = {
            hashrate: 0,
            temperature: 0,
            shares: 0,
            earnings: 0
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadSettings();
        this.checkConsent();
        this.updateDisplay();
        this.connectToMiningServer();
        
        // Update Bitcoin price
        this.updateBitcoinPrice();
        setInterval(() => this.updateBitcoinPrice(), 300000); // Every 5 minutes
    }

    setupEventListeners() {
        // Mining toggle
        document.getElementById('toggleMiningBtn').addEventListener('click', () => {
            this.toggleMining();
        });
        
        // Intensity slider
        const intensitySlider = document.getElementById('intensitySlider');
        const intensityValue = document.getElementById('intensityValue');
        
        intensitySlider.addEventListener('input', (e) => {
            intensityValue.textContent = e.target.value;
            this.updateMiningSettings();
        });
        
        // Mining type checkboxes
        document.getElementById('cpuMining').addEventListener('change', () => {
            this.updateMiningSettings();
        });
        
        document.getElementById('gpuMining').addEventListener('change', () => {
            this.updateMiningSettings();
        });
        
        // Dashboard button
        document.getElementById('openDashboardBtn').addEventListener('click', () => {
            chrome.tabs.create({ url: 'http://localhost:3000' });
        });
        
        // Settings button
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.openSettings();
        });
        
        // Footer links
        document.getElementById('helpLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.showHelp();
        });
        
        document.getElementById('aboutLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.showAbout();
        });
        
        document.getElementById('withdrawLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.showWithdrawInfo();
        });
    }

    async connectToMiningServer() {
        try {
            const response = await fetch('http://localhost:3000/api/mining-status');
            const status = await response.json();
            
            this.isMining = status.isRunning;
            this.miningStats = status.stats;
            this.updateDisplay();
            
            // Start polling for updates
            setInterval(() => this.updateMiningStats(), 5000);
            
        } catch (error) {
            console.error('Failed to connect to mining server:', error);
            this.showNotification('Cannot connect to mining server', 'error');
        }
    }

    async updateMiningStats() {
        try {
            const response = await fetch('http://localhost:3000/api/mining-status');
            const status = await response.json();
            
            this.miningStats = status.stats;
            this.updateDisplay();
            
        } catch (error) {
            // Silently fail for background updates
        }
    }

    async toggleMining() {
        if (!this.userConsent) {
            this.requestConsent();
            return;
        }
        
        try {
            const endpoint = this.isMining ? 'stopMining' : 'startMining';
            const response = await fetch(`http://localhost:3000/api/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userConsent: this.userConsent })
            });
            
            if (response.ok) {
                this.isMining = !this.isMining;
                this.updateDisplay();
                
                const message = this.isMining ? 'Mining started' : 'Mining stopped';
                this.showNotification(message, 'success');
            } else {
                throw new Error('Failed to toggle mining');
            }
            
        } catch (error) {
            this.showNotification(`Error: ${error.message}`, 'error');
        }
    }

    async updateMiningSettings() {
        const settings = {
            intensity: parseInt(document.getElementById('intensitySlider').value),
            cpuMining: document.getElementById('cpuMining').checked,
            gpuMining: document.getElementById('gpuMining').checked
        };
        
        try {
            await fetch('http://localhost:3000/api/mining-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            
            this.saveSettings(settings);
            
        } catch (error) {
            console.error('Failed to update mining settings:', error);
        }
    }

    async updateBitcoinPrice() {
        try {
            const response = await fetch('http://localhost:3000/api/bitcoin-price');
            const data = await response.json();
            this.bitcoinPrice = data.price;
            this.updateDisplay();
            
        } catch (error) {
            console.error('Failed to update Bitcoin price:', error);
        }
    }

    updateDisplay() {
        // Update status indicator
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        const toggleBtn = document.getElementById('toggleMiningBtn');
        
        if (this.isMining) {
            statusDot.classList.add('running');
            statusText.textContent = 'Mining Active';
            toggleBtn.textContent = 'Stop Mining';
            toggleBtn.className = 'btn btn-danger';
        } else {
            statusDot.classList.remove('running');
            statusText.textContent = 'Mining Stopped';
            toggleBtn.textContent = 'Start Mining';
            toggleBtn.className = 'btn btn-primary';
        }
        
        // Update stats
        document.getElementById('hashrateValue').textContent = this.formatHashrate(this.miningStats.hashrate);
        document.getElementById('temperatureValue').textContent = `${Math.round(this.miningStats.temperature)}°C`;
        document.getElementById('sharesValue').textContent = this.miningStats.shares || 0;
        document.getElementById('earningsValue').textContent = this.formatBTC(this.miningStats.earnings || 0);
        
        // Update earnings breakdown
        const hourly = (this.miningStats.earnings || 0) / 24;
        const daily = this.miningStats.earnings || 0;
        const usdValue = daily * this.bitcoinPrice;
        
        document.getElementById('hourlyEarnings').textContent = this.formatBTC(hourly);
        document.getElementById('dailyEarnings').textContent = this.formatBTC(daily);
        document.getElementById('usdValue').textContent = this.formatUSD(usdValue);
        
        // Show/hide consent notice
        const consentNotice = document.getElementById('consentNotice');
        const mainContent = document.getElementById('mainContent');
        
        if (this.userConsent) {
            consentNotice.classList.add('hidden');
            mainContent.classList.remove('hidden');
        } else {
            consentNotice.classList.remove('hidden');
            mainContent.classList.add('hidden');
        }
    }

    checkConsent() {
        chrome.storage.local.get(['miningConsent'], (result) => {
            if (result.miningConsent) {
                try {
                    const consentData = JSON.parse(result.miningConsent);
                    // Check if consent is less than 30 days old
                    this.userConsent = consentData.granted && 
                        (Date.now() - consentData.timestamp) < (30 * 24 * 60 * 60 * 1000);
                } catch {
                    this.userConsent = false;
                }
            }
            this.updateDisplay();
        });
    }

    requestConsent() {
        if (confirm('Bitcoin mining will use your computer\'s CPU and GPU resources, consuming electricity. Do you consent to start mining?')) {
            this.userConsent = true;
            this.saveConsent(true);
            this.updateDisplay();
            this.showNotification('Consent granted - you can start mining', 'success');
        } else {
            this.showNotification('Consent required to start mining', 'warning');
        }
    }

    saveConsent(consent) {
        const consentData = {
            granted: consent,
            timestamp: Date.now()
        };
        
        chrome.storage.local.set({
            miningConsent: JSON.stringify(consentData)
        });
    }

    loadSettings() {
        chrome.storage.local.get(['miningSettings'], (result) => {
            if (result.miningSettings) {
                try {
                    const settings = JSON.parse(result.miningSettings);
                    
                    document.getElementById('intensitySlider').value = settings.intensity || 5;
                    document.getElementById('intensityValue').textContent = settings.intensity || 5;
                    document.getElementById('cpuMining').checked = settings.cpuMining !== false;
                    document.getElementById('gpuMining').checked = settings.gpuMining !== false;
                    
                } catch (error) {
                    console.error('Failed to load settings:', error);
                }
            }
        });
    }

    saveSettings(settings) {
        chrome.storage.local.set({
            miningSettings: JSON.stringify(settings)
        });
    }

    openSettings() {
        chrome.tabs.create({ url: 'http://localhost:3000' });
    }

    showHelp() {
        const helpText = `
Bitcoin Mining Manager Help:

1. Grant consent to start mining
2. Adjust intensity (1-10) to control resource usage
3. Choose CPU and/or GPU mining
4. Monitor earnings in real-time
5. Open full dashboard for detailed stats

Mining uses your computer's resources and electricity.
You can stop mining anytime by clicking "Stop Mining".

For support, visit: http://localhost:3000
        `;
        
        alert(helpText);
    }

    showAbout() {
        const aboutText = `
Bitcoin Mining Manager v1.0.0

A transparent Bitcoin mining solution that:
• Requires explicit user consent
• Shows real-time mining statistics
• Provides full control over mining operations
• Displays earnings and profitability
• Runs locally on your computer

Developed for educational and personal use.
Mining cryptocurrency involves financial risk.

© 2024 Bitcoin Mining Manager
        `;
        
        alert(aboutText);
    }

    showWithdrawInfo() {
        const withdrawText = `
Withdrawal Information:

To withdraw your Bitcoin earnings:
1. Open the full dashboard (http://localhost:3000)
2. Go to the "Wallet" section
3. Enter your Bitcoin wallet address
4. Set minimum withdrawal amount
5. Earnings will be sent to your wallet

Note: Minimum withdrawal amounts and fees may apply.
Check your mining pool's withdrawal policy.
        `;
        
        alert(withdrawText);
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.remove('hidden');
        
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 3000);
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

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MiningExtensionPopup();
});




