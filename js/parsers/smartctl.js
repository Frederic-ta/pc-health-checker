// smartctl Parser — smartctl -a output

(function() {
  'use strict';
  window.PCHC = window.PCHC || {};
  window.PCHC.parsers = window.PCHC.parsers || {};

  window.PCHC.parsers.smartctl = {
    name: 'smartctl',
    category: 'storage',

    detect(content, filename) {
      var fn = (filename || '').toLowerCase();
      if (fn.includes('smartctl') || fn.includes('smart')) return true;
      return /smartctl\s+[\d.]+/i.test(content) ||
             /SMART\s+overall-health/i.test(content) ||
             /SMART\/Health\s+Information/i.test(content);
    },

    parse(content) {
      var issues = [];
      var summary = {};

      // Device model
      var modelMatch = content.match(/(?:Device Model|Product|Model Number):\s*(.+)/i);
      if (modelMatch) summary.model = modelMatch[1].trim();

      // Serial
      var serialMatch = content.match(/Serial\s*Number:\s*(.+)/i);
      if (serialMatch) summary.serial = serialMatch[1].trim();

      // Firmware
      var fwMatch = content.match(/Firmware\s*Version:\s*(.+)/i);
      if (fwMatch) summary.firmware = fwMatch[1].trim();

      // Capacity
      var capMatch = content.match(/User\s*Capacity:\s*([\d,.\s]+bytes)/i);
      if (capMatch) summary.capacity = capMatch[1].trim();

      // Overall health
      var healthMatch = content.match(/SMART\s+overall-health.*?:\s*(.+)/i);
      if (healthMatch) {
        summary.health = healthMatch[1].trim();
        if (!/passed|ok/i.test(summary.health)) {
          issues.push({
            severity: 'critical',
            title: 'SMART health check FAILED: ' + summary.health,
            detail: 'The drive self-assessment test indicates the drive is failing or has failed.',
            raw: 'SMART overall-health: ' + summary.health,
            recommendation: 'Back up all data immediately and replace the drive as soon as possible.'
          });
        }
      }

      // Temperature
      var tempMatch = content.match(/Temperature_Celsius.*?(\d+)(?:\s|$)/m) ||
                      content.match(/Temperature:\s*(\d+)\s*Celsius/i);
      if (tempMatch) {
        var temp = parseInt(tempMatch[1], 10);
        summary.temperature = temp + ' C';
        if (temp > 60) {
          issues.push({
            severity: 'critical',
            title: 'Disk temperature critically high: ' + temp + ' C',
            detail: 'Drive temperature exceeds safe operating limits (typically 0-60 C).',
            raw: 'Temperature: ' + temp + ' C',
            recommendation: 'Improve case airflow, add cooling fans, or move the drive to a cooler location. Sustained high temperatures accelerate drive failure.'
          });
        } else if (temp > 50) {
          issues.push({
            severity: 'warning',
            title: 'Disk temperature elevated: ' + temp + ' C',
            detail: 'Drive temperature is higher than ideal (recommended: below 45 C).',
            raw: 'Temperature: ' + temp + ' C',
            recommendation: 'Ensure adequate airflow. Clean dust from vents and fans.'
          });
        }
      }

      // Power-on hours
      var pohMatch = content.match(/Power_On_Hours.*?(\d+)(?:\s|$)/m) ||
                     content.match(/Power On Hours:\s*([\d,]+)/i);
      if (pohMatch) {
        var hours = parseInt(pohMatch[1].replace(/,/g, ''), 10);
        summary.powerOnHours = hours;
        if (hours > 50000) {
          issues.push({
            severity: 'warning',
            title: 'Drive has ' + hours.toLocaleString() + ' power-on hours',
            detail: 'Extended use increases the likelihood of drive failure.',
            raw: 'Power-On Hours: ' + hours,
            recommendation: 'Ensure backups are current. Consider proactive drive replacement.'
          });
        }
      }

      // Reallocated sectors
      var reallocMatch = content.match(/Reallocated_Sector_Ct.*?(\d+)(?:\s|$)/m);
      if (reallocMatch) {
        var realloc = parseInt(reallocMatch[1], 10);
        summary.reallocatedSectors = realloc;
        if (realloc > 100) {
          issues.push({
            severity: 'critical',
            title: realloc + ' reallocated sectors detected',
            detail: 'A high number of bad sectors have been remapped. The drive is likely failing.',
            raw: 'Reallocated_Sector_Ct: ' + realloc,
            recommendation: 'Back up data immediately. Replace the drive.'
          });
        } else if (realloc > 0) {
          issues.push({
            severity: 'warning',
            title: realloc + ' reallocated sector(s) detected',
            detail: 'Some bad sectors have been remapped. This may indicate early drive degradation.',
            raw: 'Reallocated_Sector_Ct: ' + realloc,
            recommendation: 'Monitor SMART data regularly. Ensure backups are current.'
          });
        }
      }

      // Current pending sectors
      var pendingMatch = content.match(/Current_Pending_Sector.*?(\d+)(?:\s|$)/m);
      if (pendingMatch) {
        var pending = parseInt(pendingMatch[1], 10);
        summary.pendingSectors = pending;
        if (pending > 0) {
          issues.push({
            severity: 'warning',
            title: pending + ' pending sector(s) awaiting reallocation',
            detail: 'Sectors that could not be read are waiting to be remapped on next write.',
            raw: 'Current_Pending_Sector: ' + pending,
            recommendation: 'Run a full disk surface scan. Back up data as a precaution.'
          });
        }
      }

      // Offline uncorrectable
      var offlineMatch = content.match(/Offline_Uncorrectable.*?(\d+)(?:\s|$)/m);
      if (offlineMatch) {
        var offline = parseInt(offlineMatch[1], 10);
        if (offline > 0) {
          issues.push({
            severity: 'warning',
            title: offline + ' uncorrectable offline sector(s)',
            detail: 'These sectors could not be read or corrected during offline testing.',
            raw: 'Offline_Uncorrectable: ' + offline,
            recommendation: 'Run: smartctl -t long /dev/sdX to perform a full test.'
          });
        }
      }

      var score = 100;
      for (var k = 0; k < issues.length; k++) {
        if (issues[k].severity === 'critical') score -= 30;
        else if (issues[k].severity === 'warning') score -= 10;
        else if (issues[k].severity === 'info') score -= 2;
      }
      score = Math.max(0, Math.min(100, score));

      if (issues.length === 0) {
        issues.push({
          severity: 'info',
          title: 'Disk SMART health is good',
          detail: summary.model ? 'Drive: ' + summary.model + ' — all SMART attributes within normal ranges.' : 'All SMART attributes within normal ranges.',
          raw: '',
          recommendation: 'No action needed. Continue regular backups.'
        });
      }

      return { summary: summary, score: score, issues: issues };
    }
  };
})();
