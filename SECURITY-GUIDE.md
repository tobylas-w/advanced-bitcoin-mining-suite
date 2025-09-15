# 🔒 Bitcoin Mining Suite - Security Guide

## Overview

The Bitcoin Mining Suite includes comprehensive security features to protect your wallet, network, and mining operations. This guide explains all security measures and how to configure them properly.

## 🛡️ Security Features

### 1. **Authentication & Authorization**
- **JWT Token Authentication**: Secure session management
- **Password Strength Validation**: Enforced strong passwords
- **Rate Limiting**: Prevents brute force attacks
- **Session Management**: Automatic session cleanup and validation

### 2. **Wallet Security**
- **Address Validation**: Bitcoin address format verification
- **Encrypted Storage**: Wallet addresses encrypted at rest
- **Change Tracking**: Monitor and limit wallet changes
- **Whitelist Support**: Restrict to approved addresses only

### 3. **Network Security**
- **DDoS Protection**: Automatic attack detection and mitigation
- **IP Filtering**: Block suspicious IPs automatically
- **Connection Limits**: Prevent connection flooding
- **Geo-blocking**: Optional country-based restrictions

### 4. **Data Protection**
- **Encryption**: All sensitive data encrypted
- **Secure Logging**: Security events logged securely
- **Audit Trail**: Complete activity tracking
- **Data Integrity**: Wallet address integrity verification

## 🔧 Security Configuration

### Environment Variables

```bash
# Security Configuration
SECRET_KEY=your-secret-key-here
ENCRYPTION_KEY=your-encryption-key-here
JWT_EXPIRY=24h
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_TIME=900000

# Network Security
MAX_CONNECTIONS_PER_IP=10
DDOS_THRESHOLD=100
ENABLE_GEO_BLOCKING=false
REQUIRE_HTTPS=false

# Wallet Security
MAX_WALLET_CHANGES=3
REQUIRE_CONFIRMATION=true
ENABLE_WHITELIST=false
```

### Security Policies

#### Password Policy
```javascript
{
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxAge: 90 days
}
```

#### Network Security
```javascript
{
    maxConnectionsPerIP: 10,
    connectionTimeout: 30000,
    ddosThreshold: 100,
    enableGeoBlocking: false,
    trustedNetworks: [],
    blockedCountries: []
}
```

#### Wallet Security
```javascript
{
    maxWalletChanges: 3, // per day
    requireConfirmation: true,
    enableWhitelist: false,
    encryptionEnabled: true
}
```

## 🔐 Wallet Security

### Setting Up Wallet Security

1. **Configure Your Wallet Address**
   ```bash
   # Access wallet setup
   curl -X POST http://localhost:3000/api/wallet/configure \
     -H "Content-Type: application/json" \
     -d '{
       "wallet": {
         "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
         "type": "legacy"
       },
       "worker": {
         "name": "office-computer-1"
       },
       "pool": "default"
     }'
   ```

2. **Enable Address Whitelist** (Optional)
   ```javascript
   // Add addresses to whitelist
   walletSecurity.addToWhitelist("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa");
   ```

3. **Monitor Wallet Changes**
   ```bash
   # Check wallet status
   curl http://localhost:3000/api/wallet/status
   ```

### Wallet Address Types

| Type | Format | Security Score | Recommendation |
|------|--------|----------------|----------------|
| **Legacy** | Starts with `1` | 60/100 | Basic compatibility |
| **SegWit** | Starts with `3` | 80/100 | Good balance |
| **Bech32** | Starts with `bc1` | 90/100 | **Recommended** |

### Security Best Practices

#### For Wallet Addresses
- ✅ Use **Bech32** addresses for maximum security
- ✅ **Never** share your private keys
- ✅ Use **hardware wallets** for large amounts
- ✅ **Test** with small amounts first
- ❌ Avoid **testnet** addresses in production
- ❌ Don't use **weak** or **sequential** addresses

#### For Network Security
- ✅ Enable **HTTPS** in production
- ✅ Use **firewall** rules
- ✅ Monitor **connection logs**
- ✅ Set **trusted networks**
- ❌ Don't expose **admin interfaces**
- ❌ Avoid **public networks**

## 🚨 Security Monitoring

### Real-Time Security Dashboard

Access the security dashboard at: `http://localhost:3000/security`

Features:
- **Active Sessions**: Monitor current user sessions
- **Failed Attempts**: Track login failures
- **Blocked IPs**: View blocked addresses
- **Security Events**: Real-time security alerts
- **Network Statistics**: Connection monitoring

### Security Event Types

| Event Type | Severity | Description |
|------------|----------|-------------|
| `login_success` | Info | Successful authentication |
| `login_failed` | Warning | Failed login attempt |
| `rate_limit_exceeded` | Warning | Too many requests |
| `suspicious_activity` | Warning | Unusual behavior detected |
| `session_hijack_attempt` | Critical | Potential session theft |
| `unauthorized_access` | Critical | Unauthorized access attempt |
| `wallet_access` | High | Wallet operation performed |
| `mining_started` | Info | Mining operation started |
| `config_changed` | High | Configuration modified |

### Security Logs

Security events are logged to:
- **Console**: Real-time monitoring
- **File**: `/logs/security.log` (persistent storage)
- **Dashboard**: Web interface monitoring

## 🔧 Security Configuration

### Enable Two-Factor Authentication (2FA)

```javascript
// In your configuration
const securityConfig = {
    enable2FA: true,
    twoFactorService: 'totp', // or 'sms', 'email'
    backupCodes: 10
};
```

### Configure Network Firewall

```bash
# Allow only specific IPs (if needed)
firewall-cmd --permanent --add-rich-rule="rule family='ipv4' source address='192.168.1.0/24' port protocol='tcp' port='3000' accept"

# Block suspicious IPs
firewall-cmd --permanent --add-rich-rule="rule family='ipv4' source address='1.2.3.4' reject"

# Reload firewall
firewall-cmd --reload
```

### SSL/TLS Configuration

```javascript
// For production deployment
const httpsOptions = {
    key: fs.readFileSync('path/to/private-key.pem'),
    cert: fs.readFileSync('path/to/certificate.pem'),
    ca: fs.readFileSync('path/to/ca-certificate.pem')
};

const server = https.createServer(httpsOptions, app);
```

## 🚨 Incident Response

### Security Incident Procedures

1. **Immediate Response**
   - Check security dashboard for alerts
   - Review recent security logs
   - Identify affected systems

2. **Containment**
   - Block suspicious IPs
   - Disable compromised accounts
   - Isolate affected systems

3. **Investigation**
   - Analyze security logs
   - Identify attack vectors
   - Document findings

4. **Recovery**
   - Patch vulnerabilities
   - Update security policies
   - Restore normal operations

### Emergency Contacts

```bash
# Emergency shutdown
curl -X POST http://localhost:3000/api/emergency/stop-all

# Block all external access
curl -X POST http://localhost:3000/api/security/block-all-external

# Enable maintenance mode
curl -X POST http://localhost:3000/api/security/maintenance-mode
```

## 📊 Security Metrics

### Key Performance Indicators (KPIs)

- **Failed Login Rate**: < 5%
- **Blocked IP Count**: Monitor daily
- **Security Events**: Track trends
- **Session Duration**: Average 2-4 hours
- **Wallet Changes**: < 3 per day

### Security Monitoring Dashboard

```bash
# Get security status
curl http://localhost:3000/api/security/status

# Response includes:
{
    "authentication": {
        "activeSessions": 3,
        "failedAttempts": 1,
        "recentEvents": [...]
    },
    "network": {
        "activeConnections": 15,
        "blockedIPs": ["1.2.3.4"],
        "suspiciousIPs": [...]
    },
    "wallet": {
        "encryptedWallets": 1,
        "whitelistedAddresses": 2,
        "recentChanges": [...]
    }
}
```

## 🔍 Security Auditing

### Regular Security Checks

#### Daily
- [ ] Review security logs
- [ ] Check for failed login attempts
- [ ] Monitor network connections
- [ ] Verify wallet status

#### Weekly
- [ ] Review blocked IPs
- [ ] Check session patterns
- [ ] Validate wallet addresses
- [ ] Update security policies

#### Monthly
- [ ] Security vulnerability assessment
- [ ] Password policy review
- [ ] Network security audit
- [ ] Backup security configurations

### Security Checklist

#### Initial Setup
- [ ] Change default passwords
- [ ] Configure firewall rules
- [ ] Enable HTTPS (production)
- [ ] Set up wallet security
- [ ] Configure rate limiting
- [ ] Enable security monitoring

#### Ongoing Maintenance
- [ ] Regular security updates
- [ ] Monitor security logs
- [ ] Review access permissions
- [ ] Test backup procedures
- [ ] Update security policies
- [ ] Train users on security

## 🆘 Troubleshooting

### Common Security Issues

#### "Too many login attempts"
```bash
# Check rate limiting
curl http://localhost:3000/api/security/status

# Reset failed attempts (if needed)
curl -X POST http://localhost:3000/api/security/reset-failed-attempts
```

#### "Wallet address blocked"
```bash
# Check wallet security status
curl http://localhost:3000/api/wallet/status

# Add to whitelist (if needed)
curl -X POST http://localhost:3000/api/wallet/whitelist \
  -d '{"address": "your-address-here"}'
```

#### "IP address blocked"
```bash
# Check blocked IPs
curl http://localhost:3000/api/security/status

# Unblock IP (if needed)
curl -X POST http://localhost:3000/api/security/unblock-ip \
  -d '{"ip": "1.2.3.4"}'
```

### Security Support

For security-related issues:
1. Check the security logs first
2. Review this security guide
3. Check the troubleshooting section
4. Contact system administrator

---

## 🎯 Security Summary

Your Bitcoin mining system includes:

✅ **Multi-layered security** with authentication, encryption, and monitoring  
✅ **Wallet protection** with address validation and encrypted storage  
✅ **Network security** with DDoS protection and IP filtering  
✅ **Real-time monitoring** with security dashboards and alerts  
✅ **Audit trails** with comprehensive logging and tracking  
✅ **Incident response** with automated blocking and recovery  

**Remember**: Security is an ongoing process. Regularly review and update your security configurations to maintain the highest level of protection for your Bitcoin mining operations.

🔒 **Stay secure, stay profitable!** 💰
