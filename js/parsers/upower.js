// upower Parser — upower -d output

(function() {
  'use strict';
  window.PCHC = window.PCHC || {};
  window.PCHC.parsers = window.PCHC.parsers || {};

  window.PCHC.parsers.upower = {
    name: 'upower',
    category: 'power',

    detect(content, filename) {
      var fn = (filename || '').toLowerCase();
      if (fn.includes('upower')) return true;
      return /Device:.*battery/i.test(content) &&
             /energy-full/i.test(content);
    },

    parse(content) {
      var issues = [];
      var summary = {};

      // Energy full design
      var designMatch = content.match(/energy-full-design:\s*([\d.]+)\s*Wh/i);
      var designCapacity = designMatch ? parseFloat(designMatch[1]) : null;
      summary.designCapacity = designCapacity;

      // Energy full (current)
      var fullMatch = content.match(/energy-full:\s*([\d.]+)\s*Wh/i);
      var fullCapacity = fullMatch ? parseFloat(fullMatch[1]) : null;
      summary.fullChargeCapacity = fullCapacity;

      // Current energy
      var currentMatch = content.match(/energy:\s*([\d.]+)\s*Wh/i);
      if (currentMatch) summary.currentEnergy = parseFloat(currentMatch[1]);

      // Percentage
      var percentMatch = content.match(/percentage:\s*([\d.]+)%/i);
      if (percentMatch) summary.chargePercent = parseFloat(percentMatch[1]);

      // State
      var stateMatch = content.match(/state:\s*(\S+)/i);
      if (stateMatch) summary.state = stateMatch[1];

      // Cycles (if available)
      var cycleMatch = content.match(/charge-cycles:\s*(\d+)/i);
      if (cycleMatch) summary.cycleCount = parseInt(cycleMatch[1], 10);

      // Technology
      var techMatch = content.match(/technology:\s*(.+)/i);
      if (techMatch) summary.technology = techMatch[1].trim();

      // Vendor / Model
      var vendorMatch = content.match(/vendor:\s*(.+)/i);
      if (vendorMatch) summary.vendor = vendorMatch[1].trim();
      var modelMatch = content.match(/model:\s*(.+)/i);
      if (modelMatch) summary.model = modelMatch[1].trim();

      // Calculate battery health
      var healthPercent = null;
      if (designCapacity && fullCapacity) {
        healthPercent = Math.round((fullCapacity / designCapacity) * 100);
        summary.healthPercent = healthPercent;

        if (healthPercent < 40) {
          issues.push({
            severity: 'critical',
            title: 'Battery health critically low at ' + healthPercent + '%',
            detail: 'The battery can only hold ' + healthPercent + '% of its original design capacity. Design: ' + designCapacity + ' Wh, Current: ' + fullCapacity + ' Wh.',
            raw: 'energy-full-design: ' + designCapacity + ' Wh | energy-full: ' + fullCapacity + ' Wh',
            recommendation: 'Battery replacement is strongly recommended.'
          });
        } else if (healthPercent < 60) {
          issues.push({
            severity: 'warning',
            title: 'Battery health degraded at ' + healthPercent + '%',
            detail: 'The battery holds ' + healthPercent + '% of its original capacity.',
            raw: 'energy-full-design: ' + designCapacity + ' Wh | energy-full: ' + fullCapacity + ' Wh',
            recommendation: 'Consider replacing the battery soon.'
          });
        } else if (healthPercent < 80) {
          issues.push({
            severity: 'info',
            title: 'Battery health at ' + healthPercent + '%',
            detail: 'The battery holds ' + healthPercent + '% of its original capacity, normal for a used battery.',
            raw: 'energy-full-design: ' + designCapacity + ' Wh | energy-full: ' + fullCapacity + ' Wh',
            recommendation: 'Battery is aging normally. Monitor periodically.'
          });
        }
      }

      // Cycle count check
      if (summary.cycleCount !== undefined) {
        if (summary.cycleCount > 1000) {
          issues.push({
            severity: 'warning',
            title: 'High battery cycle count: ' + summary.cycleCount,
            detail: 'The battery has completed ' + summary.cycleCount + ' charge cycles.',
            raw: 'charge-cycles: ' + summary.cycleCount,
            recommendation: 'Battery has exceeded typical cycle life. Consider replacement.'
          });
        } else if (summary.cycleCount > 500) {
          issues.push({
            severity: 'info',
            title: 'Battery cycle count: ' + summary.cycleCount,
            detail: 'The battery has completed ' + summary.cycleCount + ' charge cycles.',
            raw: 'charge-cycles: ' + summary.cycleCount,
            recommendation: 'Monitor battery health closely.'
          });
        }
      }

      // Check if on-battery vs line power
      if (summary.state === 'discharging' && summary.chargePercent && summary.chargePercent < 20) {
        issues.push({
          severity: 'warning',
          title: 'Battery charge low: ' + summary.chargePercent + '%',
          detail: 'System is running on battery with low charge.',
          raw: 'State: discharging | Charge: ' + summary.chargePercent + '%',
          recommendation: 'Connect to power soon to avoid unexpected shutdown.'
        });
      }

      var score = 100;
      for (var k = 0; k < issues.length; k++) {
        if (issues[k].severity === 'critical') score -= 30;
        else if (issues[k].severity === 'warning') score -= 10;
        else if (issues[k].severity === 'info') score -= 2;
      }
      score = Math.max(0, Math.min(100, score));

      if (issues.length === 0 && designCapacity) {
        issues.push({
          severity: 'info',
          title: 'Battery health is good',
          detail: healthPercent ? 'Battery is at ' + healthPercent + '% of design capacity.' : 'No significant battery issues detected.',
          raw: '',
          recommendation: 'No action needed.'
        });
      } else if (issues.length === 0) {
        issues.push({
          severity: 'info',
          title: 'No battery detected',
          detail: 'No battery information found. This may be a desktop system.',
          raw: '',
          recommendation: 'No action needed for desktop systems.'
        });
      }

      return { summary: summary, score: score, issues: issues };
    }
  };
})();
