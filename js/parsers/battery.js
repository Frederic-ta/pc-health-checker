// Battery Report Parser — powercfg /batteryreport HTML

export default {
  name: 'Battery Report',
  category: 'power',

  detect(content, filename) {
    const fn = (filename || '').toLowerCase();
    if (fn.includes('battery') && (fn.endsWith('.html') || fn.endsWith('.htm'))) return true;
    return /battery\s*report/i.test(content) ||
           /BATTERY:BATTERY/i.test(content) ||
           /Design\s*Capacity/i.test(content) && /Full\s*Charge\s*Capacity/i.test(content);
  },

  parse(content) {
    const issues = [];
    const summary = {};

    // Extract design capacity
    const designMatch = content.match(/Design\s*Capacity[^<\d]*?([\d,]+)\s*mWh/i);
    const designCapacity = designMatch ? parseInt(designMatch[1].replace(/,/g, ''), 10) : null;
    summary.designCapacity = designCapacity;

    // Extract full charge capacity
    const fullChargeMatch = content.match(/Full\s*Charge\s*Capacity[^<\d]*?([\d,]+)\s*mWh/i);
    const fullChargeCapacity = fullChargeMatch ? parseInt(fullChargeMatch[1].replace(/,/g, ''), 10) : null;
    summary.fullChargeCapacity = fullChargeCapacity;

    // Extract cycle count
    const cycleMatch = content.match(/Cycle\s*Count[^<\d]*?(\d+)/i);
    const cycleCount = cycleMatch ? parseInt(cycleMatch[1], 10) : null;
    summary.cycleCount = cycleCount;

    // Calculate battery health
    let healthPercent = null;
    if (designCapacity && fullChargeCapacity) {
      healthPercent = Math.round((fullChargeCapacity / designCapacity) * 100);
      summary.healthPercent = healthPercent;

      if (healthPercent < 40) {
        issues.push({
          severity: 'critical',
          title: `Battery health critically low at ${healthPercent}%`,
          detail: `The battery can only hold ${healthPercent}% of its original design capacity. Design: ${designCapacity} mWh, Current: ${fullChargeCapacity} mWh.`,
          raw: `Design Capacity: ${designCapacity} mWh | Full Charge Capacity: ${fullChargeCapacity} mWh`,
          recommendation: 'Battery replacement is strongly recommended. The battery has significantly degraded and may cause unexpected shutdowns.'
        });
      } else if (healthPercent < 60) {
        issues.push({
          severity: 'warning',
          title: `Battery health degraded at ${healthPercent}%`,
          detail: `The battery holds ${healthPercent}% of its original capacity. Design: ${designCapacity} mWh, Current: ${fullChargeCapacity} mWh.`,
          raw: `Design Capacity: ${designCapacity} mWh | Full Charge Capacity: ${fullChargeCapacity} mWh`,
          recommendation: 'Consider replacing the battery soon. Avoid leaving the laptop unplugged for extended periods.'
        });
      } else if (healthPercent < 80) {
        issues.push({
          severity: 'info',
          title: `Battery health at ${healthPercent}%`,
          detail: `The battery holds ${healthPercent}% of its original capacity, which is normal for a used battery.`,
          raw: `Design Capacity: ${designCapacity} mWh | Full Charge Capacity: ${fullChargeCapacity} mWh`,
          recommendation: 'Battery is aging normally. Monitor health periodically.'
        });
      }
    }

    // Cycle count assessment
    if (cycleCount !== null) {
      if (cycleCount > 1000) {
        issues.push({
          severity: 'warning',
          title: `High battery cycle count: ${cycleCount}`,
          detail: `The battery has completed ${cycleCount} charge cycles. Most batteries are rated for 300-500 cycles.`,
          raw: `Cycle Count: ${cycleCount}`,
          recommendation: 'Battery has exceeded typical cycle life. Consider replacement if experiencing short battery life.'
        });
      } else if (cycleCount > 500) {
        issues.push({
          severity: 'info',
          title: `Battery cycle count: ${cycleCount}`,
          detail: `The battery has completed ${cycleCount} charge cycles.`,
          raw: `Cycle Count: ${cycleCount}`,
          recommendation: 'Battery is approaching end of rated cycle life. Monitor battery health closely.'
        });
      }
    }

    // Extract recent usage patterns — look for usage table rows
    const usageRows = content.match(/<tr[^>]*>.*?Active.*?<\/tr>/gis);
    const recentDrainRates = [];
    if (usageRows) {
      for (const row of usageRows.slice(0, 10)) {
        const drainMatch = row.match(/(\d+)\s*mW/i);
        if (drainMatch) {
          recentDrainRates.push(parseInt(drainMatch[1], 10));
        }
      }
    }
    if (recentDrainRates.length > 0) {
      const avgDrain = Math.round(recentDrainRates.reduce((a, b) => a + b, 0) / recentDrainRates.length);
      summary.avgDrainRate = avgDrain;
      if (avgDrain > 30000) {
        issues.push({
          severity: 'warning',
          title: `High average battery drain rate: ${(avgDrain / 1000).toFixed(1)}W`,
          detail: `Average power consumption is ${(avgDrain / 1000).toFixed(1)}W during recent active use.`,
          raw: `Average drain: ${avgDrain} mW across ${recentDrainRates.length} samples`,
          recommendation: 'Check for power-hungry background applications. Consider adjusting power plan to "Power Saver" when on battery.'
        });
      }
    }

    // Score calculation
    let score = 100;
    for (const issue of issues) {
      if (issue.severity === 'critical') score -= 30;
      else if (issue.severity === 'warning') score -= 10;
      else if (issue.severity === 'info') score -= 2;
    }
    score = Math.max(0, Math.min(100, score));

    if (issues.length === 0 && designCapacity) {
      issues.push({
        severity: 'info',
        title: 'Battery health is good',
        detail: healthPercent ? `Battery is at ${healthPercent}% of design capacity.` : 'No significant battery issues detected.',
        raw: '',
        recommendation: 'No action needed. Continue normal usage.'
      });
    }

    return { summary, score, issues };
  }
};
