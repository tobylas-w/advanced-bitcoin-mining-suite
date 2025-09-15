const fs = require('fs');
const path = require('path');
const WindowsDeployment = require('./windows-deploy');
const UbuntuDeployment = require('./ubuntu-deploy');

/**
 * Cross-platform deployment manager
 * Handles deployment for Windows 11, Ubuntu, and other platforms
 */
class DeploymentManager {
    constructor(config = {}) {
        this.config = {
            serverUrl: config.serverUrl || 'http://localhost:3000',
            ...config
        };
        
        this.deployments = {
            windows: new WindowsDeployment(this.config),
            ubuntu: new UbuntuDeployment(this.config)
        };
    }

    /**
     * Generate deployment files for all platforms
     */
    async generateAllDeployments() {
        console.log('🚀 Generating cross-platform deployment files...');
        console.log(`📡 Server URL: ${this.config.serverUrl}`);
        console.log('');

        try {
            // Generate Windows deployment
            console.log('🪟 Generating Windows 11 deployment...');
            await this.deployments.windows.saveInstallerFiles();
            console.log('');

            // Generate Ubuntu deployment
            console.log('🐧 Generating Ubuntu deployment...');
            await this.deployments.ubuntu.saveInstallerFiles();
            console.log('');

            // Generate deployment instructions
            await this.generateDeploymentInstructions();
            
            console.log('✅ All deployment files generated successfully!');
            console.log('');
            console.log('📁 Deployment files are located in:');
            console.log('   - ./deploy/windows/ (Windows 11)');
            console.log('   - ./deploy/ubuntu/ (Ubuntu/Debian)');
            console.log('');
            console.log('📖 See DEPLOYMENT-GUIDE.md for detailed instructions');

        } catch (error) {
            console.error('❌ Error generating deployment files:', error);
            throw error;
        }
    }

    /**
     * Generate deployment instructions
     */
    async generateDeploymentInstructions() {
        const instructions = `# Cross-Platform Bitcoin Mining Deployment Guide

This guide explains how to deploy the Bitcoin mining client on different operating systems.

## Server Setup (Fedora Linux Host)

### 1. Start the Mining Server

\`\`\`bash
# Navigate to the project directory
cd /home/capital/Cryptoj

# Install dependencies
npm install

# Start the server
npm start
\`\`\`

The server will start on port 3000 and be accessible at:
- Local: http://localhost:3000
- Network: http://[YOUR_IP]:3000

### 2. Configure Firewall (if needed)

\`\`\`bash
# Allow port 3000 through firewall
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
\`\`\`

## Client Deployment

### Windows 11 Deployment

#### Option 1: Batch Installer (Recommended)
1. Copy the entire \`deploy/windows/\` folder to the Windows computer
2. Right-click on \`install.bat\` and select "Run as administrator"
3. Follow the on-screen instructions

#### Option 2: PowerShell Installer
1. Copy the \`deploy/windows/\` folder to the Windows computer
2. Open PowerShell as Administrator
3. Run: \`Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser\`
4. Run: \`.\\install.ps1\`

#### Option 3: Manual Installation
1. Install Node.js from https://nodejs.org/
2. Copy \`CrossPlatformClient.js\` to desired location
3. Create \`package.json\` with dependencies
4. Run \`npm install\` and then \`node client.js\`

### Ubuntu/Debian Deployment

#### Option 1: Automated Installer (Recommended)
1. Copy the entire \`deploy/ubuntu/\` folder to the Ubuntu computer
2. Open terminal and run:
   \`\`\`bash
   cd deploy/ubuntu
   chmod +x install.sh
   sudo ./install.sh
   \`\`\`

#### Option 2: Manual Installation
1. Install Node.js:
   \`\`\`bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   \`\`\`
2. Copy \`CrossPlatformClient.js\` to desired location
3. Create \`package.json\` with dependencies
4. Run \`npm install\` and then \`node client.js\`

### Performance Optimization

#### Ubuntu/Debian Optimization
Run the optimization script for better performance:
\`\`\`bash
cd deploy/ubuntu
sudo ./optimize.sh
\`\`\`

#### Windows 11 Optimization
For best performance on Windows:
1. Set power plan to "High Performance"
2. Add mining folder to Windows Defender exclusions
3. Run as Administrator when possible
4. Disable unnecessary startup programs

## Usage

### Starting Mining
- **Windows**: Double-click "Bitcoin Miner" shortcut or run \`start-miner.bat\`
- **Ubuntu**: Run \`sudo systemctl start bitcoin-miner\` or \`./start-miner.sh\`

### Monitoring
Access the web dashboard at: http://[SERVER_IP]:3000

### Stopping Mining
- **Windows**: Close the mining window or run uninstaller
- **Ubuntu**: Run \`sudo systemctl stop bitcoin-miner\`

## Troubleshooting

### Connection Issues
1. Verify the server is running on the host computer
2. Check firewall settings on both client and server
3. Ensure the server URL is correct in client configuration

### Performance Issues
1. Check CPU and memory usage
2. Verify temperature monitoring
3. Run platform-specific optimization scripts

### Permission Issues
- **Windows**: Run as Administrator
- **Ubuntu**: Use \`sudo\` for system-level operations

## Security Notes

- The mining client runs with user consent and transparency
- All mining activity is logged and visible
- No data is collected without explicit permission
- The system is designed for personal/office use only

## Support

For issues or questions:
1. Check the server logs on the host computer
2. Verify client logs on the mining computer
3. Ensure all dependencies are properly installed
4. Check network connectivity between client and server

## Uninstallation

### Windows
Run \`uninstall.bat\` as Administrator

### Ubuntu
Run \`sudo ./uninstall.sh\`

---

**Note**: This system is designed for legitimate Bitcoin mining with full user consent and transparency. Always ensure you have permission to run mining software on any computer.`;

        fs.writeFileSync(
            path.join(__dirname, '../../DEPLOYMENT-GUIDE.md'),
            instructions
        );

        console.log('📖 Generated DEPLOYMENT-GUIDE.md');
    }

    /**
     * Create a simple web-based installer
     */
    async generateWebInstaller() {
        const webInstallerHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bitcoin Mining Client Installer</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            border-radius: 15px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            max-width: 600px;
            width: 100%;
        }
        h1 {
            color: #333;
            text-align: center;
            margin-bottom: 30px;
        }
        .platform-selector {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
        }
        .platform-card {
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            padding: 20px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .platform-card:hover {
            border-color: #667eea;
            transform: translateY(-2px);
        }
        .platform-card.selected {
            border-color: #667eea;
            background: #f0f4ff;
        }
        .platform-icon {
            font-size: 48px;
            margin-bottom: 10px;
        }
        .download-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            width: 100%;
            margin-top: 20px;
            transition: background 0.3s ease;
        }
        .download-btn:hover {
            background: #5a6fd8;
        }
        .download-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        .instructions {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin-top: 20px;
            display: none;
        }
        .instructions.show {
            display: block;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Bitcoin Mining Client Installer</h1>
        
        <p style="text-align: center; color: #666; margin-bottom: 30px;">
            Download the appropriate installer for your operating system
        </p>
        
        <div class="platform-selector">
            <div class="platform-card" onclick="selectPlatform('windows')">
                <div class="platform-icon">🪟</div>
                <h3>Windows 11</h3>
                <p>Automated installer with system integration</p>
            </div>
            
            <div class="platform-card" onclick="selectPlatform('ubuntu')">
                <div class="platform-icon">🐧</div>
                <h3>Ubuntu/Debian</h3>
                <p>Systemd service with optimization</p>
            </div>
        </div>
        
        <button class="download-btn" id="downloadBtn" onclick="downloadInstaller()" disabled>
            Select a platform to download
        </button>
        
        <div class="instructions" id="instructions">
            <h3>Installation Instructions:</h3>
            <div id="instructionContent"></div>
        </div>
    </div>

    <script>
        let selectedPlatform = null;
        const serverUrl = '${this.config.serverUrl}';

        function selectPlatform(platform) {
            selectedPlatform = platform;
            
            // Update UI
            document.querySelectorAll('.platform-card').forEach(card => {
                card.classList.remove('selected');
            });
            event.currentTarget.classList.add('selected');
            
            document.getElementById('downloadBtn').disabled = false;
            document.getElementById('downloadBtn').textContent = \`Download \${platform} Installer\`;
            
            showInstructions(platform);
        }

        function showInstructions(platform) {
            const instructions = document.getElementById('instructions');
            const content = document.getElementById('instructionContent');
            
            let instructionText = '';
            
            if (platform === 'windows') {
                instructionText = \`
                    <ol>
                        <li>Download and extract the Windows installer package</li>
                        <li>Right-click on <code>install.bat</code> and select "Run as administrator"</li>
                        <li>Follow the on-screen installation prompts</li>
                        <li>Use the desktop shortcut or Start menu to start mining</li>
                    </ol>
                    <p><strong>Note:</strong> Windows Defender may prompt for permission. Allow the application to run.</p>
                \`;
            } else if (platform === 'ubuntu') {
                instructionText = \`
                    <ol>
                        <li>Download and extract the Ubuntu installer package</li>
                        <li>Open terminal and navigate to the installer directory</li>
                        <li>Run: <code>chmod +x install.sh && sudo ./install.sh</code></li>
                        <li>Start mining with: <code>sudo systemctl start bitcoin-miner</code></li>
                    </ol>
                    <p><strong>Note:</strong> For best performance, also run <code>sudo ./optimize.sh</code></p>
                \`;
            }
            
            content.innerHTML = instructionText;
            instructions.classList.add('show');
        }

        function downloadInstaller() {
            if (!selectedPlatform) return;
            
            // Create download link
            const link = document.createElement('a');
            link.href = \`/api/download-installer/\${selectedPlatform}\`;
            link.download = \`bitcoin-miner-\${selectedPlatform}-installer.zip\`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Update button text
            document.getElementById('downloadBtn').textContent = 'Download Started!';
            setTimeout(() => {
                document.getElementById('downloadBtn').textContent = \`Download \${selectedPlatform} Installer\`;
            }, 2000);
        }
    </script>
</body>
</html>`;

        const installerDir = path.join(__dirname, '../../public/installer');
        if (!fs.existsSync(installerDir)) {
            fs.mkdirSync(installerDir, { recursive: true });
        }

        fs.writeFileSync(
            path.join(installerDir, 'index.html'),
            webInstallerHTML
        );

        console.log('🌐 Generated web-based installer');
    }
}

module.exports = DeploymentManager;
