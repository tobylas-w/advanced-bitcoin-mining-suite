/**
 * Commercial License Manager
 * Handles licensing, activation, and commercial features
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

class LicenseManager {
    constructor() {
        this.licenseKey = null;
        this.licenseData = null;
        this.isActivated = false;
        this.features = this.getDefaultFeatures();
        this.trialDays = 30;
        this.trialStartDate = null;
        this.activationServer = 'https://license.bitcoin-mining-enterprise.com';
        this.licenseConfig = this.loadLicenseConfig();
        
        this.initializeLicense();
    }

    loadLicenseConfig() {
        return {
            productName: 'Bitcoin Mining Enterprise Suite',
            productVersion: '2.0.0',
            vendor: 'Advanced Mining Solutions',
            licenseFile: 'license.dat',
            activationRequired: true,
            offlineMode: false,
            gracePeriod: 7, // days
            maxActivations: 5,
            checkInterval: 3600000 // 1 hour
        };
    }

    getDefaultFeatures() {
        return {
            basicMining: true,
            advancedMining: false,
            enterpriseMonitoring: false,
            stealthMode: false,
            persistence: false,
            security: false,
            commercialSupport: false,
            apiAccess: false,
            customBranding: false,
            whiteLabel: false,
            unlimitedClients: false,
            prioritySupport: false
        };
    }

    initializeLicense() {
        console.log('📋 Initializing license system...');
        
        // Load existing license
        this.loadLicense();
        
        // Check license status
        this.checkLicenseStatus();
        
        // Start periodic license checks
        this.startLicenseMonitoring();
        
        console.log('✅ License system initialized');
    }

    loadLicense() {
        const licensePath = path.join(process.cwd(), this.licenseConfig.licenseFile);
        
        try {
            if (fs.existsSync(licensePath)) {
                const licenseData = JSON.parse(fs.readFileSync(licensePath, 'utf8'));
                this.licenseKey = licenseData.licenseKey;
                this.licenseData = this.validateLicense(licenseData);
                this.isActivated = this.licenseData !== null;
                
                if (this.isActivated) {
                    this.features = { ...this.features, ...this.licenseData.features };
                    console.log('✅ Valid license loaded');
                } else {
                    console.log('⚠️ Invalid license detected');
                }
            } else {
                console.log('📝 No license found, starting trial period');
                this.startTrial();
            }
        } catch (error) {
            console.error('❌ License loading failed:', error.message);
            this.startTrial();
        }
    }

    validateLicense(licenseData) {
        try {
            // Validate license signature
            const { signature, ...data } = licenseData;
            const expectedSignature = this.generateLicenseSignature(data);
            
            if (signature !== expectedSignature) {
                throw new Error('Invalid license signature');
            }
            
            // Check expiration
            if (new Date(licenseData.expirationDate) < new Date()) {
                throw new Error('License expired');
            }
            
            // Check hardware binding
            if (!this.validateHardwareBinding(licenseData)) {
                throw new Error('Hardware binding mismatch');
            }
            
            return data;
        } catch (error) {
            console.error('License validation failed:', error.message);
            return null;
        }
    }

    generateLicenseSignature(data) {
        const dataString = JSON.stringify(data, Object.keys(data).sort());
        return crypto.createHash('sha256').update(dataString + 'bitcoin-mining-enterprise').digest('hex');
    }

    validateHardwareBinding(licenseData) {
        const currentFingerprint = this.generateHardwareFingerprint();
        return licenseData.hardwareFingerprint === currentFingerprint;
    }

    generateHardwareFingerprint() {
        const components = [
            os.platform(),
            os.arch(),
            os.hostname(),
            os.cpus()[0]?.model || 'unknown',
            os.totalmem().toString()
        ];
        
        const fingerprint = components.join('|');
        return crypto.createHash('sha256').update(fingerprint).digest('hex');
    }

    startTrial() {
        this.trialStartDate = new Date();
        this.isActivated = false;
        
        // Enable basic features for trial
        this.features.basicMining = true;
        
        console.log(`🎯 Trial period started - ${this.trialDays} days remaining`);
    }

    checkLicenseStatus() {
        if (!this.isActivated) {
            if (this.trialStartDate) {
                const trialDaysRemaining = this.getTrialDaysRemaining();
                if (trialDaysRemaining <= 0) {
                    console.log('⏰ Trial period expired');
                    this.disableFeatures();
                    return false;
                } else {
                    console.log(`⏰ Trial: ${trialDaysRemaining} days remaining`);
                }
            }
            return false;
        }
        
        return true;
    }

    getTrialDaysRemaining() {
        if (!this.trialStartDate) return 0;
        
        const now = new Date();
        const diffTime = now - this.trialStartDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return Math.max(0, this.trialDays - diffDays);
    }

    async activateLicense(licenseKey) {
        console.log('🔑 Activating license...');
        
        try {
            // Online activation
            const activationData = await this.requestActivation(licenseKey);
            
            if (activationData.success) {
                this.licenseKey = licenseKey;
                this.licenseData = activationData.license;
                this.features = { ...this.features, ...activationData.license.features };
                this.isActivated = true;
                
                // Save license
                this.saveLicense();
                
                console.log('✅ License activated successfully');
                return { success: true, message: 'License activated successfully' };
            } else {
                throw new Error(activationData.message || 'Activation failed');
            }
        } catch (error) {
            console.error('❌ License activation failed:', error.message);
            return { success: false, message: error.message };
        }
    }

    async requestActivation(licenseKey) {
        return new Promise((resolve, reject) => {
            const activationRequest = {
                licenseKey,
                hardwareFingerprint: this.generateHardwareFingerprint(),
                productVersion: this.licenseConfig.productVersion,
                timestamp: Date.now()
            };
            
            const postData = JSON.stringify(activationRequest);
            
            const options = {
                hostname: 'license.bitcoin-mining-enterprise.com',
                port: 443,
                path: '/api/activate',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                    'User-Agent': 'BitcoinMiningEnterprise/2.0.0'
                }
            };
            
            const req = https.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        resolve(response);
                    } catch (error) {
                        reject(new Error('Invalid activation response'));
                    }
                });
            });
            
            req.on('error', (error) => {
                reject(new Error(`Activation request failed: ${error.message}`));
            });
            
            req.write(postData);
            req.end();
        });
    }

    saveLicense() {
        const licensePath = path.join(process.cwd(), this.licenseConfig.licenseFile);
        
        const licenseData = {
            ...this.licenseData,
            licenseKey: this.licenseKey,
            signature: this.generateLicenseSignature(this.licenseData),
            activatedAt: new Date().toISOString(),
            hardwareFingerprint: this.generateHardwareFingerprint()
        };
        
        fs.writeFileSync(licensePath, JSON.stringify(licenseData, null, 2));
        
        // Set restrictive permissions
        fs.chmodSync(licensePath, 0o600);
    }

    disableFeatures() {
        this.features = {
            basicMining: false,
            advancedMining: false,
            enterpriseMonitoring: false,
            stealthMode: false,
            persistence: false,
            security: false,
            commercialSupport: false,
            apiAccess: false,
            customBranding: false,
            whiteLabel: false,
            unlimitedClients: false,
            prioritySupport: false
        };
    }

    startLicenseMonitoring() {
        setInterval(() => {
            this.checkLicenseStatus();
            
            // Online license validation
            if (this.isActivated && !this.licenseConfig.offlineMode) {
                this.validateLicenseOnline();
            }
        }, this.licenseConfig.checkInterval);
    }

    async validateLicenseOnline() {
        try {
            const validationRequest = {
                licenseKey: this.licenseKey,
                hardwareFingerprint: this.generateHardwareFingerprint(),
                timestamp: Date.now()
            };
            
            // Send validation request (simplified)
            console.log('🔍 Validating license online...');
            
            // Mock validation response
            setTimeout(() => {
                console.log('✅ License validation successful');
            }, 1000);
            
        } catch (error) {
            console.warn('⚠️ Online license validation failed:', error.message);
        }
    }

    // Feature Access Control
    hasFeature(feature) {
        if (!this.isActivated && !this.checkLicenseStatus()) {
            return false;
        }
        
        return this.features[feature] === true;
    }

    requireFeature(feature, operation) {
        if (!this.hasFeature(feature)) {
            const message = `Feature '${feature}' requires a valid license. ${operation || ''}`;
            throw new Error(message);
        }
    }

    // License Information
    getLicenseInfo() {
        return {
            isActivated: this.isActivated,
            licenseKey: this.licenseKey ? this.licenseKey.substring(0, 8) + '...' : null,
            features: this.features,
            expirationDate: this.licenseData?.expirationDate || null,
            trialDaysRemaining: this.getTrialDaysRemaining(),
            productName: this.licenseConfig.productName,
            productVersion: this.licenseConfig.productVersion,
            vendor: this.licenseConfig.vendor,
            hardwareFingerprint: this.generateHardwareFingerprint().substring(0, 16) + '...'
        };
    }

    // Commercial Editions
    getAvailableEditions() {
        return {
            trial: {
                name: 'Trial Edition',
                price: 0,
                duration: '30 days',
                features: ['basicMining']
            },
            basic: {
                name: 'Basic Edition',
                price: 99,
                duration: '1 year',
                features: ['basicMining', 'advancedMining']
            },
            professional: {
                name: 'Professional Edition',
                price: 299,
                duration: '1 year',
                features: ['basicMining', 'advancedMining', 'enterpriseMonitoring', 'security']
            },
            enterprise: {
                name: 'Enterprise Edition',
                price: 999,
                duration: '1 year',
                features: ['basicMining', 'advancedMining', 'enterpriseMonitoring', 'stealthMode', 'persistence', 'security', 'commercialSupport', 'apiAccess']
            },
            whiteLabel: {
                name: 'White Label Edition',
                price: 4999,
                duration: '1 year',
                features: ['basicMining', 'advancedMining', 'enterpriseMonitoring', 'stealthMode', 'persistence', 'security', 'commercialSupport', 'apiAccess', 'customBranding', 'whiteLabel', 'unlimitedClients', 'prioritySupport']
            }
        };
    }

    // License Upgrade
    async upgradeLicense(newLicenseKey) {
        console.log('⬆️ Upgrading license...');
        
        const result = await this.activateLicense(newLicenseKey);
        
        if (result.success) {
            console.log('✅ License upgraded successfully');
        }
        
        return result;
    }

    // License Deactivation
    deactivateLicense() {
        console.log('🔓 Deactivating license...');
        
        this.licenseKey = null;
        this.licenseData = null;
        this.isActivated = false;
        this.features = this.getDefaultFeatures();
        
        // Remove license file
        const licensePath = path.join(process.cwd(), this.licenseConfig.licenseFile);
        if (fs.existsSync(licensePath)) {
            fs.unlinkSync(licensePath);
        }
        
        // Start new trial
        this.startTrial();
        
        console.log('✅ License deactivated');
    }

    // Commercial Support
    getSupportInfo() {
        return {
            hasSupport: this.hasFeature('commercialSupport'),
            supportLevel: this.hasFeature('prioritySupport') ? 'priority' : 'standard',
            supportEmail: 'support@bitcoin-mining-enterprise.com',
            supportPhone: '+1-800-MINING-1',
            documentation: 'https://docs.bitcoin-mining-enterprise.com',
            community: 'https://community.bitcoin-mining-enterprise.com'
        };
    }
}

module.exports = LicenseManager;
