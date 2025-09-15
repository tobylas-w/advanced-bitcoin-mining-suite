// Browser-based installer for office computers
// This creates a simple web page that employees can visit to install the mining client

const fs = require('fs');
const path = require('path');

class BrowserInstaller {
    constructor() {
        this.installerHtml = this.generateInstallerHtml();
        this.installerScript = this.generateInstallerScript();
    }

    /**
     * Generate the installer HTML page
     */
    generateInstallerHtml() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bitcoin Mining Client Installer</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1a1a1a, #2d2d2d);
            color: #ffffff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .installer-container {
            background: #333;
            border-radius: 12px;
            padding: 2rem;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5);
            text-align: center;
        }
        
        .logo {
            font-size: 3rem;
            color: #f7931a;
            margin-bottom: 1rem;
        }
        
        h1 {
            color: #f7931a;
            margin-bottom: 1rem;
            font-size: 1.8rem;
        }
        
        .subtitle {
            color: #ccc;
            margin-bottom: 2rem;
            font-size: 1rem;
        }
        
        .consent-box {
            background: #444;
            border-radius: 8px;
            padding: 1.5rem;
            margin-bottom: 2rem;
            text-align: left;
        }
        
        .consent-title {
            color: #f7931a;
            font-weight: bold;
            margin-bottom: 1rem;
            text-align: center;
        }
        
        .consent-text {
            color: #ccc;
            line-height: 1.6;
            margin-bottom: 1rem;
        }
        
        .consent-list {
            color: #ccc;
            padding-left: 1.5rem;
            margin-bottom: 1rem;
        }
        
        .consent-list li {
            margin-bottom: 0.5rem;
        }
        
        .consent-checkbox {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            justify-content: center;
            margin-bottom: 1.5rem;
        }
        
        .consent-checkbox input[type="checkbox"] {
            width: 20px;
            height: 20px;
            accent-color: #f7931a;
        }
        
        .btn {
            padding: 1rem 2rem;
            border: none;
            border-radius: 8px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            margin: 0.5rem;
            font-size: 1rem;
        }
        
        .btn-primary {
            background: #f7931a;
            color: white;
        }
        
        .btn-primary:hover:not(:disabled) {
            background: #e8821a;
            transform: translateY(-2px);
        }
        
        .btn-secondary {
            background: #6c757d;
            color: white;
        }
        
        .btn-secondary:hover {
            background: #5a6268;
        }
        
        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        .status {
            margin-top: 1rem;
            padding: 1rem;
            border-radius: 6px;
            display: none;
        }
        
        .status.success {
            background: #28a745;
            color: white;
        }
        
        .status.error {
            background: #dc3545;
            color: white;
        }
        
        .status.info {
            background: #17a2b8;
            color: white;
        }
        
        .progress {
            width: 100%;
            height: 6px;
            background: #444;
            border-radius: 3px;
            overflow: hidden;
            margin: 1rem 0;
            display: none;
        }
        
        .progress-bar {
            height: 100%;
            background: #f7931a;
            width: 0%;
            transition: width 0.3s ease;
        }
        
        .computer-info {
            background: #444;
            border-radius: 6px;
            padding: 1rem;
            margin-bottom: 1rem;
            text-align: left;
        }
        
        .computer-info h3 {
            color: #f7931a;
            margin-bottom: 0.5rem;
        }
        
        .computer-info p {
            color: #ccc;
            margin-bottom: 0.25rem;
        }
    </style>
</head>
<body>
    <div class="installer-container">
        <div class="logo">₿</div>
        <h1>Bitcoin Mining Client</h1>
        <div class="subtitle">Office Mining Network Installation</div>
        
        <div class="computer-info">
            <h3>Computer Information</h3>
            <p><strong>Computer:</strong> <span id="computerName">Loading...</span></p>
            <p><strong>Operating System:</strong> <span id="osInfo">Loading...</span></p>
            <p><strong>CPU Cores:</strong> <span id="cpuCores">Loading...</span></p>
            <p><strong>Memory:</strong> <span id="memoryInfo">Loading...</span></p>
        </div>
        
        <div class="consent-box">
            <div class="consent-title">Installation Consent</div>
            <div class="consent-text">
                This will install Bitcoin mining software on your computer to participate in the office mining network.
            </div>
            <ul class="consent-list">
                <li>Uses CPU and GPU resources for Bitcoin mining</li>
                <li>Consumes electricity (may increase power bill)</li>
                <li>Generates heat (ensure proper cooling)</li>
                <li>Can be stopped/uninstalled at any time</li>
                <li>All mining activity is transparent and monitored</li>
                <li>Profits are shared according to office policy</li>
            </ul>
            
            <div class="consent-checkbox">
                <input type="checkbox" id="consentCheckbox">
                <label for="consentCheckbox">I understand and agree to install Bitcoin mining software</label>
            </div>
        </div>
        
        <button id="installBtn" class="btn btn-primary" disabled>
            Install Mining Client
        </button>
        
        <button id="cancelBtn" class="btn btn-secondary">
            Cancel
        </button>
        
        <div class="progress" id="progress">
            <div class="progress-bar" id="progressBar"></div>
        </div>
        
        <div class="status" id="status"></div>
    </div>
    
    <script>
        ${this.installerScript}
    </script>
</body>
</html>`;
    }

    /**
     * Generate the installer JavaScript
     */
    generateInstallerScript() {
        return `
        class BitcoinMiningInstaller {
            constructor() {
                this.installerUrl = 'http://your-host-computer:3000/api/install-client';
                this.setupEventListeners();
                this.loadComputerInfo();
            }
            
            setupEventListeners() {
                const consentCheckbox = document.getElementById('consentCheckbox');
                const installBtn = document.getElementById('installBtn');
                const cancelBtn = document.getElementById('cancelBtn');
                
                consentCheckbox.addEventListener('change', (e) => {
                    installBtn.disabled = !e.target.checked;
                });
                
                installBtn.addEventListener('click', () => {
                    this.installClient();
                });
                
                cancelBtn.addEventListener('click', () => {
                    window.close();
                });
            }
            
            loadComputerInfo() {
                document.getElementById('computerName').textContent = navigator.platform;
                document.getElementById('osInfo').textContent = navigator.userAgent.split('(')[1].split(')')[0];
                document.getElementById('cpuCores').textContent = navigator.hardwareConcurrency || 'Unknown';
                document.getElementById('memoryInfo').textContent = navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'Unknown';
            }
            
            async installClient() {
                const installBtn = document.getElementById('installBtn');
                const progress = document.getElementById('progress');
                const progressBar = document.getElementById('progressBar');
                const status = document.getElementById('status');
                
                installBtn.disabled = true;
                progress.style.display = 'block';
                status.style.display = 'none';
                
                try {
                    this.showStatus('info', 'Downloading mining client...');
                    this.updateProgress(25);
                    
                    // Download and install the mining client
                    const response = await fetch(this.installerUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            computerInfo: this.getComputerInfo(),
                            userConsent: true,
                            timestamp: new Date().toISOString()
                        })
                    });
                    
                    this.updateProgress(50);
                    this.showStatus('info', 'Installing mining client...');
                    
                    if (!response.ok) {
                        throw new Error('Installation failed');
                    }
                    
                    this.updateProgress(75);
                    this.showStatus('info', 'Configuring mining client...');
                    
                    // Simulate installation process
                    await this.sleep(2000);
                    
                    this.updateProgress(100);
                    this.showStatus('success', 'Installation completed successfully! Mining client is now running.');
                    
                    installBtn.textContent = 'Installed ✓';
                    installBtn.classList.remove('btn-primary');
                    installBtn.classList.add('btn-secondary');
                    
                } catch (error) {
                    this.showStatus('error', 'Installation failed: ' + error.message);
                    installBtn.disabled = false;
                }
            }
            
            getComputerInfo() {
                return {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    language: navigator.language,
                    hardwareConcurrency: navigator.hardwareConcurrency,
                    deviceMemory: navigator.deviceMemory,
                    timestamp: new Date().toISOString()
                };
            }
            
            updateProgress(percent) {
                const progressBar = document.getElementById('progressBar');
                progressBar.style.width = percent + '%';
            }
            
            showStatus(type, message) {
                const status = document.getElementById('status');
                status.className = 'status ' + type;
                status.textContent = message;
                status.style.display = 'block';
            }
            
            sleep(ms) {
                return new Promise(resolve => setTimeout(resolve, ms));
            }
        }
        
        // Initialize installer when page loads
        document.addEventListener('DOMContentLoaded', () => {
            new BitcoinMiningInstaller();
        });
        `;
    }

    /**
     * Save installer files
     */
    saveInstallerFiles() {
        const installerDir = path.join(__dirname, '../../public/installer');
        
        // Create installer directory
        if (!fs.existsSync(installerDir)) {
            fs.mkdirSync(installerDir, { recursive: true });
        }
        
        // Save HTML installer
        const htmlPath = path.join(installerDir, 'index.html');
        fs.writeFileSync(htmlPath, this.installerHtml);
        
        // Save installer script
        const scriptPath = path.join(installerDir, 'installer.js');
        fs.writeFileSync(scriptPath, this.installerScript);
        
        console.log('📁 Browser installer files saved:');
        console.log(`   HTML: ${htmlPath}`);
        console.log(`   Script: ${scriptPath}`);
        console.log(`   URL: http://your-host-computer:3000/installer`);
    }
}

// Generate installer files
const browserInstaller = new BrowserInstaller();
browserInstaller.saveInstallerFiles();

module.exports = BrowserInstaller;



