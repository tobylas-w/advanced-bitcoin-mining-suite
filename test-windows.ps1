# Quick test script for Windows 11 computers
Write-Host "🧪 Testing Bitcoin Mining Client on Windows 11" -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Yellow

# Test Node.js
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found - will be installed automatically" -ForegroundColor Red
}

# Test PowerShell version
Write-Host "✅ PowerShell: $($PSVersionTable.PSVersion)" -ForegroundColor Green

# Test system information
Write-Host "`n📋 System Information:" -ForegroundColor Cyan
Write-Host "   Computer: $env:COMPUTERNAME" -ForegroundColor White
Write-Host "   OS: $((Get-WmiObject -Class Win32_OperatingSystem).Caption)" -ForegroundColor White
Write-Host "   CPU Cores: $((Get-WmiObject -Class Win32_Processor).NumberOfCores)" -ForegroundColor White
Write-Host "   RAM: $([math]::Round((Get-WmiObject -Class Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 2)) GB" -ForegroundColor White

# Check for GPU
$gpuInfo = Get-WmiObject -Class Win32_VideoController | Where-Object { $_.Name -notlike "*Basic*" -and $_.Name -notlike "*Standard*" }
if ($gpuInfo.Count -gt 0) {
    Write-Host "   GPU: $($gpuInfo[0].Name)" -ForegroundColor White
    Write-Host "✅ Dedicated GPU detected - GPU mining will be enabled" -ForegroundColor Green
} else {
    Write-Host "   GPU: No dedicated GPU detected" -ForegroundColor White
    Write-Host "⚠️ Only CPU mining will be available" -ForegroundColor Yellow
}

# Test network connectivity
Write-Host "`n🌐 Testing Network Connectivity:" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ Central server connection: OK" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Central server not reachable (this is OK if not running)" -ForegroundColor Yellow
    Write-Host "   Make sure your central server is running on port 3000" -ForegroundColor White
}

Write-Host "`n✅ Windows 11 computer is ready for Bitcoin mining client deployment!" -ForegroundColor Green
Write-Host "`n💡 Next steps:" -ForegroundColor Cyan
Write-Host "1. Run: .\deploy-windows.ps1 -CentralServerIP YOUR_SERVER_IP" -ForegroundColor White
Write-Host "2. The script will install Node.js and the mining client" -ForegroundColor White
Write-Host "3. A desktop shortcut will be created" -ForegroundColor White
Write-Host "4. The client will connect to your central server" -ForegroundColor White

Read-Host "`nPress Enter to exit"


