// Sleep Study Parser — powercfg /sleepstudy HTML

(function() {
  'use strict';
  window.PCHC = window.PCHC || {};
  window.PCHC.parsers = window.PCHC.parsers || {};

  window.PCHC.parsers.sleep = {
  name: 'Sleep Study',
  category: 'power',

  detect(content, filename) {
    const fn = (filename || '').toLowerCase();
    if (fn.includes('sleep') && (fn.endsWith('.html') || fn.endsWith('.htm'))) return true;
    return /Sleep\s*Study/i.test(content) ||
           /sleepstudy/i.test(content) ||
           (/Connected\s*Standby/i.test(content) && /Drain\s*Rate/i.test(content));
  },

  parse(content) {
    const issues = [];
    const summary = {};

    // Extract sleep sessions
    // Sleep study tables typically have columns: Type, Start Time, Duration, Energy Drain
    const sessions = [];
    const sessionPattern = /(?:AC|DC|Battery|Connected Standby|Modern Standby|Sleep)[^<]*?(\d+:\d+:\d+)[^<]*?(\d+(?:\.\d+)?)\s*%/gi;
    let match;
    while ((match = sessionPattern.exec(content)) !== null) {
      sessions.push({
        duration: match[1],
        drainPercent: parseFloat(match[2])
      });
    }
    summary.sessionCount = sessions.length;

    // Extract drain rates
    const drainRates = [];
    const drainPattern = /(?:drain|rate)[^<\d]*?(\d+(?:\.\d+)?)\s*(?:mW|%\/hr|%\s*per\s*hour)/gi;
    while ((match = drainPattern.exec(content)) !== null) {
      drainRates.push(parseFloat(match[1]));
    }

    // Also look for percentage-based drain in table cells
    const drainCellPattern = />\s*(\d+(?:\.\d+)?)\s*%\s*</g;
    const percentValues = [];
    while ((match = drainCellPattern.exec(content)) !== null) {
      percentValues.push(parseFloat(match[1]));
    }

    // Calculate average drain
    if (drainRates.length > 0) {
      const avgDrain = drainRates.reduce((a, b) => a + b, 0) / drainRates.length;
      summary.avgDrainRate = Math.round(avgDrain * 100) / 100;
    }

    // Extract top offenders / active devices during sleep
    const offenders = [];
    const offenderPattern = /(?:Top\s*Offender|Active\s*Device|Offender)[^<]*?<[^>]*>([^<]+)/gi;
    while ((match = offenderPattern.exec(content)) !== null) {
      const name = match[1].trim();
      if (name.length > 2 && name.length < 100) {
        offenders.push(name);
      }
    }

    // Also search for device names in hw/sw activity sections
    const devicePattern = /(?:Device|Driver|Module)[^<:]*?[>:]\s*([^<\n]+)/gi;
    while ((match = devicePattern.exec(content)) !== null) {
      const name = match[1].trim();
      if (name.length > 3 && name.length < 80 && !offenders.includes(name) && !/^\d+$/.test(name)) {
        offenders.push(name);
      }
    }
    summary.topOffenders = offenders.slice(0, 10);

    // Assess drain rates
    if (sessions.length > 0) {
      const highDrainSessions = sessions.filter(s => s.drainPercent > 5);
      if (highDrainSessions.length > sessions.length * 0.5) {
        issues.push({
          severity: 'warning',
          title: `High sleep drain detected in ${highDrainSessions.length} of ${sessions.length} sessions`,
          detail: `More than half of sleep sessions show drain above 5%. Something is preventing efficient sleep.`,
          raw: `High drain sessions: ${highDrainSessions.length}/${sessions.length}`,
          recommendation: 'Check for devices or apps keeping the system active during sleep. Review top offenders list.'
        });
      }

      const criticalDrain = sessions.filter(s => s.drainPercent > 20);
      if (criticalDrain.length > 0) {
        issues.push({
          severity: 'critical',
          title: `${criticalDrain.length} sleep session${criticalDrain.length > 1 ? 's' : ''} with excessive drain (>20%)`,
          detail: 'One or more sleep sessions drained over 20% battery. The system may not be sleeping properly.',
          raw: criticalDrain.map(s => `Duration: ${s.duration}, Drain: ${s.drainPercent}%`).join('; '),
          recommendation: 'Check wake timers, background apps, and connected standby settings. Run "powercfg /requests" to see active power requests.'
        });
      }
    }

    // Offender assessment
    if (offenders.length > 5) {
      issues.push({
        severity: 'warning',
        title: `${offenders.length} active devices/processes during sleep`,
        detail: `Multiple devices or processes are active during sleep: ${offenders.slice(0, 5).join(', ')}${offenders.length > 5 ? '...' : ''}`,
        raw: offenders.join(', '),
        recommendation: 'Review which devices need to remain active during sleep. Disable wake-on-LAN for unused network adapters.'
      });
    } else if (offenders.length > 0) {
      issues.push({
        severity: 'info',
        title: `${offenders.length} device${offenders.length > 1 ? 's' : ''} active during sleep`,
        detail: `Active during sleep: ${offenders.join(', ')}`,
        raw: offenders.join(', '),
        recommendation: 'These devices may be normal (e.g., network adapter for wake-on-LAN). Review if any are unexpected.'
      });
    }

    if (issues.length === 0) {
      issues.push({
        severity: 'info',
        title: 'Sleep study shows no major issues',
        detail: sessions.length > 0 ? `Analyzed ${sessions.length} sleep sessions.` : 'No detailed sleep session data could be extracted.',
        raw: '',
        recommendation: 'Sleep behavior appears normal.'
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
