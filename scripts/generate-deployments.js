#!/usr/bin/env node

/**
 * Deployment Generation Script
 * Generates all deployment files for cross-platform Bitcoin mining
 */

const DeploymentManager = require('../src/deployment/DeploymentManager');
const path = require('path');

async function main() {
    console.log('🚀 Bitcoin Mining Suite - Deployment Generator');
    console.log('═'.repeat(60));
    console.log('');

    try {
        // Get server URL from command line or use default
        const serverUrl = process.argv[2] || 'http://localhost:3000';
        
        console.log(`📡 Target Server: ${serverUrl}`);
        console.log('');

        // Create deployment manager
        const deploymentManager = new DeploymentManager({
            serverUrl: serverUrl
        });

        // Generate all deployment files
        await deploymentManager.generateAllDeployments();

        // Generate web installer
        await deploymentManager.generateWebInstaller();

        console.log('');
        console.log('🎉 Deployment generation completed successfully!');
        console.log('');
        console.log('📁 Generated files:');
        console.log('   ├── deploy/windows/');
        console.log('   │   ├── install.bat');
        console.log('   │   ├── uninstall.bat');
        console.log('   │   ├── install.ps1');
        console.log('   │   └── CrossPlatformClient.js');
        console.log('   ├── deploy/ubuntu/');
        console.log('   │   ├── install.sh');
        console.log('   │   ├── uninstall.sh');
        console.log('   │   ├── optimize.sh');
        console.log('   │   ├── bitcoin-miner.service');
        console.log('   │   ├── bitcoin-miner.desktop');
        console.log('   │   └── CrossPlatformClient.js');
        console.log('   ├── public/installer/index.html');
        console.log('   └── DEPLOYMENT-GUIDE.md');
        console.log('');
        console.log('🚀 Next steps:');
        console.log('   1. Start the mining server: npm start');
        console.log('   2. Access the web installer: http://localhost:3000/installer');
        console.log('   3. Or manually copy deployment files to target computers');
        console.log('');

    } catch (error) {
        console.error('❌ Error generating deployments:', error);
        process.exit(1);
    }
}

// Handle command line usage
if (require.main === module) {
    main();
}

module.exports = { main };
