#!/usr/bin/env node

/**
 * Profit Test Script
 * Tests the profit optimization and tracking systems
 */

const MaximumProfitOptimizer = require('./src/profit/MaximumProfitOptimizer');
const ProfitTracker = require('./src/profit/ProfitTracker');

console.log('💰 Testing Profit Systems...\n');

// Test profit optimizer
console.log('🎯 Testing Maximum Profit Optimizer...');
const optimizer = new MaximumProfitOptimizer();

setTimeout(() => {
    console.log('\n📊 Profit Optimizer Status:');
    const status = optimizer.getCurrentProfitStatus();
    console.log(`   Daily Projection: $${status.dailyProjection.toFixed(2)}`);
    console.log(`   Monthly Projection: $${status.monthlyProjection.toFixed(2)}`);
    console.log(`   Yearly Projection: $${status.yearlyProjection.toFixed(2)}`);
    console.log(`   Optimization Level: ${status.optimizationLevel}%`);
    console.log(`   Best Pool: ${status.bestPool?.name || 'Calculating...'}`);
    
    // Enable aggressive mode
    console.log('\n🚀 Enabling Aggressive Mode...');
    optimizer.enableAggressiveMode();
    
    setTimeout(() => {
        const aggressiveStatus = optimizer.getCurrentProfitStatus();
        console.log(`   New Daily Projection: $${aggressiveStatus.dailyProjection.toFixed(2)}`);
        console.log(`   New Monthly Projection: $${aggressiveStatus.monthlyProjection.toFixed(2)}`);
        console.log(`   New Yearly Projection: $${aggressiveStatus.yearlyProjection.toFixed(2)}`);
    }, 2000);
}, 3000);

// Test profit tracker
console.log('\n💰 Testing Profit Tracker...');
const tracker = new ProfitTracker();

// Listen for profit updates
tracker.on('profitUpdate', (data) => {
    console.log(`\n💵 Profit Update:`);
    console.log(`   Hourly Profit: $${data.hourlyProfit.toFixed(2)}`);
    console.log(`   Total Earned: $${data.totalEarned.toFixed(2)}`);
    console.log(`   Total BTC: ${data.totalBTC.toFixed(8)}`);
    console.log(`   Today's Earnings: $${data.todayEarnings.toFixed(2)}`);
});

tracker.on('profitAdded', (data) => {
    console.log(`\n💰 Profit Added:`);
    console.log(`   Amount: $${data.amount.toFixed(2)}`);
    console.log(`   Description: ${data.description}`);
    console.log(`   New Total: $${data.totalEarned.toFixed(2)}`);
});

// Add some test profits
setTimeout(() => {
    console.log('\n🧪 Adding test profits...');
    tracker.addProfitEntry(5.50, 'Test mining session');
    tracker.addProfitEntry(12.75, 'Optimized mining run');
    tracker.addProfitEntry(8.25, 'Peak performance mining');
}, 5000);

// Show final report
setTimeout(() => {
    console.log('\n📊 Final Profit Report:');
    const report = tracker.getProfitReport();
    console.log(`   Total Earned: $${report.totalEarned.toFixed(2)}`);
    console.log(`   Total BTC: ${report.totalBTC.toFixed(8)}`);
    console.log(`   Today's Earnings: $${report.todayEarnings.toFixed(2)}`);
    console.log(`   This Week: $${report.thisWeekEarnings.toFixed(2)}`);
    console.log(`   This Month: $${report.thisMonthEarnings.toFixed(2)}`);
    console.log(`   Bitcoin Price: $${report.bitcoinPrice.toLocaleString()}`);
    
    console.log('\n📈 Projections:');
    console.log(`   Daily: $${report.projections.daily.toFixed(2)}`);
    console.log(`   Weekly: $${report.projections.weekly.toFixed(2)}`);
    console.log(`   Monthly: $${report.projections.monthly.toFixed(2)}`);
    console.log(`   Yearly: $${report.projections.yearly.toFixed(2)}`);
    console.log(`   Break-even in: ${report.projections.breakEvenDays} days`);
    console.log(`   ROI: ${report.projections.roiPercentage.toFixed(1)}%`);
    
    console.log('\n💡 Recommendations:');
    report.recommendations.forEach(rec => {
        console.log(`   ${rec.type.toUpperCase()}: ${rec.message}`);
        console.log(`   Impact: ${rec.impact}`);
    });
    
    console.log('\n✅ Profit systems test completed successfully!');
    console.log('🚀 Your Bitcoin mining system is ready to MAKE MONEY!');
    
    process.exit(0);
}, 10000);
