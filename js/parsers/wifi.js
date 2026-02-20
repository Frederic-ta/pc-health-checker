// WiFi Report Parser — netsh wlan show wlanreport HTML

(function() {
  'use strict';
  window.PCHC = window.PCHC || {};
  window.PCHC.parsers = window.PCHC.parsers || {};

  window.PCHC.parsers.wifi = {
  name: 'WiFi Report',
  category: 'network',

  detect(content, filename) {
    const fn = (filename || '').toLowerCase();
    if ((fn.includes('wifi') || fn.includes('wlan')) && (fn.endsWith('.html') || fn.endsWith('.htm'))) return true;
    return /Wireless LAN/i.test(content) && (/wlan/i.test(content) || /WLAN/i.test(content)) ||
           /WlanReport/i.test(content) ||
           /Wi-Fi\s*Session/i.test(content);
  },

  parse(content) {
    const issues = [];
    const summary = {};

    // Extract adapter info
    const adapterMatch = content.match(/(?:Adapter|Interface)\s*(?:Name|Description)[^<:]*?[>:]\s*([^<\n]+)/i);
    summary.adapter = adapterMatch ? adapterMatch[1].trim() : '';

    // Extract SSID
    const ssidMatch = content.match(/SSID[^<:]*?[>:]\s*([^<\n]+)/i);
    summary.ssid = ssidMatch ? ssidMatch[1].trim() : '';

    // Extract connection profile
    const profileMatch = content.match(/Profile[^<:]*?[>:]\s*([^<\n]+)/i);
    summary.profile = profileMatch ? profileMatch[1].trim() : '';

    // Count disconnections
    const disconnectPattern = /disconnect/gi;
    let disconnectCount = 0;
    let m;
    while ((m = disconnectPattern.exec(content)) !== null) disconnectCount++;
    // Rough heuristic — divide by 2 since "disconnect" may appear as label + value
    disconnectCount = Math.max(0, Math.floor(disconnectCount / 2));
    summary.disconnects = disconnectCount;

    // Count connection failures
    const failPattern = /(?:fail|failure|failed)/gi;
    let failCount = 0;
    while ((m = failPattern.exec(content)) !== null) failCount++;
    summary.connectionFailures = Math.floor(failCount / 2);

    // Signal quality
    const signalMatch = content.match(/Signal\s*(?:Quality|Strength)[^<\d]*?(\d+)\s*%/i);
    if (signalMatch) {
      const signal = parseInt(signalMatch[1], 10);
      summary.signalQuality = signal;

      if (signal < 30) {
        issues.push({
          severity: 'critical',
          title: `Very weak WiFi signal: ${signal}%`,
          detail: 'WiFi signal quality is very poor, which will cause slow speeds and frequent disconnections.',
          raw: `Signal Quality: ${signal}%`,
          recommendation: 'Move closer to the router, remove physical obstructions, or consider a WiFi extender/mesh system.'
        });
      } else if (signal < 50) {
        issues.push({
          severity: 'warning',
          title: `Weak WiFi signal: ${signal}%`,
          detail: 'WiFi signal is below optimal levels. You may experience slower speeds.',
          raw: `Signal Quality: ${signal}%`,
          recommendation: 'Try moving closer to the router or adjusting its position for better coverage.'
        });
      }
    }

    // Assess disconnections
    if (disconnectCount > 10) {
      issues.push({
        severity: 'critical',
        title: `${disconnectCount} WiFi disconnections detected`,
        detail: 'Frequent WiFi disconnections indicate a serious connectivity problem.',
        raw: `Disconnection events: ~${disconnectCount}`,
        recommendation: 'Check WiFi driver, router firmware, and interference from nearby networks. Try changing WiFi channel.'
      });
    } else if (disconnectCount > 5) {
      issues.push({
        severity: 'warning',
        title: `${disconnectCount} WiFi disconnections detected`,
        detail: 'Several WiFi disconnection events found in the report.',
        raw: `Disconnection events: ~${disconnectCount}`,
        recommendation: 'Update WiFi adapter driver. Check for interference from other WiFi networks or devices.'
      });
    } else if (disconnectCount > 0) {
      issues.push({
        severity: 'info',
        title: `${disconnectCount} WiFi disconnection${disconnectCount > 1 ? 's' : ''} detected`,
        detail: 'A few WiFi disconnections were found, which may be normal.',
        raw: `Disconnection events: ~${disconnectCount}`,
        recommendation: 'Monitor for recurring disconnection patterns.'
      });
    }

    // Connection failures
    if (summary.connectionFailures > 5) {
      issues.push({
        severity: 'warning',
        title: `Multiple WiFi connection failures detected`,
        detail: `Approximately ${summary.connectionFailures} connection failures found in the report.`,
        raw: `Connection failures: ~${summary.connectionFailures}`,
        recommendation: 'Check WiFi password, driver, and router settings. Try forgetting and reconnecting to the network.'
      });
    }

    // Check for error sections
    const errorPattern = /(?:Error|error code)[^<\d]*?(?:0x[0-9a-fA-F]+|\d+)/gi;
    const errors = [];
    while ((m = errorPattern.exec(content)) !== null) {
      const errText = m[0].trim();
      if (!errors.includes(errText)) errors.push(errText);
    }
    if (errors.length > 3) {
      issues.push({
        severity: 'warning',
        title: `${errors.length} error codes found in WiFi report`,
        detail: `Error codes: ${errors.slice(0, 5).join(', ')}`,
        raw: errors.slice(0, 10).join('\n'),
        recommendation: 'Search for these error codes to identify specific WiFi issues. Updating the WiFi driver often resolves many errors.'
      });
    }

    if (issues.length === 0) {
      issues.push({
        severity: 'info',
        title: 'WiFi report shows no significant issues',
        detail: summary.ssid ? `Connected to: ${summary.ssid}` : 'No major WiFi problems detected.',
        raw: '',
        recommendation: 'WiFi connectivity appears healthy.'
      });
    }

    // Score
    let score = 100;
    for (const issue of issues) {
      if (issue.severity === 'critical') score -= 30;
      else if (issue.severity === 'warning') score -= 10;
      else if (issue.severity === 'info') score -= 2;
    }
    score = Math.max(0, Math.min(100, score));

    return { summary, score, issues };
  }
};


})();
