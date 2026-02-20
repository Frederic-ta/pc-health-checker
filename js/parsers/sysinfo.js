// SystemInfo Parser — systeminfo TXT

(function() {
  'use strict';
  window.PCHC = window.PCHC || {};
  window.PCHC.parsers = window.PCHC.parsers || {};

  window.PCHC.parsers.sysinfo = {
    name: 'System Info',
    category: 'system',

    detect(content, filename) {
      const fn = (filename || '').toLowerCase();
      if ((fn.includes('sysinfo') || fn.includes('systeminfo')) && fn.endsWith('.txt')) return true;
      return /Host Name:/i.test(content) &&
             /OS Name:/i.test(content) &&
             /System Boot Time:/i.test(content);
    },

    parse(content) {
      const issues = [];
      const summary = {};

      // Extract key fields with colon-delimited format
      const extract = (label) => {
        const re = new RegExp(`${label}:\\s*(.+)`, 'i');
        const m = content.match(re);
        return m ? m[1].trim() : '';
      };

      summary.hostName = extract('Host Name');
      summary.osName = extract('OS Name');
      summary.osVersion = extract('OS Version');
      summary.manufacturer = extract('System Manufacturer');
      summary.model = extract('System Model');
      summary.systemType = extract('System Type');
      summary.bootTime = extract('System Boot Time');
      summary.originalInstall = extract('Original Install Date');

      // RAM
      const totalPhysMem = extract('Total Physical Memory');
      const availPhysMem = extract('Available Physical Memory');
      const totalVirtMem = extract('Total Virtual Memory');
      const availVirtMem = extract('Available Virtual Memory');
      summary.totalPhysicalMemory = totalPhysMem;
      summary.availablePhysicalMemory = availPhysMem;

      // Uptime calculation
      if (summary.bootTime) {
        const bootDate = parseWindowsDate(summary.bootTime);
        if (bootDate) {
          const now = new Date();
          const uptimeMs = now - bootDate;
          const uptimeDays = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
          const uptimeHours = Math.floor((uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          summary.uptimeDays = uptimeDays;
          summary.uptimeHours = uptimeHours;

          if (uptimeDays > 30) {
            issues.push({
              severity: 'warning',
              title: `System hasn't been rebooted in ${uptimeDays} days`,
              detail: `Last boot: ${summary.bootTime}. Uptime: ${uptimeDays} days, ${uptimeHours} hours.`,
              raw: `System Boot Time: ${summary.bootTime}`,
              recommendation: 'Restart your computer regularly (at least weekly) to apply updates and clear memory leaks.'
            });
          } else if (uptimeDays > 14) {
            issues.push({
              severity: 'info',
              title: `System uptime: ${uptimeDays} days`,
              detail: `Last boot: ${summary.bootTime}.`,
              raw: `System Boot Time: ${summary.bootTime}`,
              recommendation: 'Consider restarting soon to apply any pending updates.'
            });
          }
        }
      }

      // RAM usage
      if (totalPhysMem && availPhysMem) {
        const totalMB = parseMBFromString(totalPhysMem);
        const availMB = parseMBFromString(availPhysMem);
        if (totalMB > 0 && availMB >= 0) {
          const usedPercent = Math.round(((totalMB - availMB) / totalMB) * 100);
          summary.ramUsedPercent = usedPercent;

          if (totalMB < 4096) {
            issues.push({
              severity: 'warning',
              title: `Low total RAM: ${totalPhysMem}`,
              detail: 'Less than 4 GB of RAM may cause performance issues with modern applications.',
              raw: `Total Physical Memory: ${totalPhysMem}`,
              recommendation: 'Consider upgrading RAM to at least 8 GB for better performance.'
            });
          }

          if (usedPercent > 90) {
            issues.push({
              severity: 'critical',
              title: `RAM usage critically high: ${usedPercent}%`,
              detail: `Only ${availPhysMem} free of ${totalPhysMem} total.`,
              raw: `Total: ${totalPhysMem}, Available: ${availPhysMem}`,
              recommendation: 'Close unnecessary applications immediately. Consider upgrading RAM.'
            });
          } else if (usedPercent > 80) {
            issues.push({
              severity: 'warning',
              title: `RAM usage high: ${usedPercent}%`,
              detail: `${availPhysMem} free of ${totalPhysMem} total.`,
              raw: `Total: ${totalPhysMem}, Available: ${availPhysMem}`,
              recommendation: 'Monitor memory usage. Close memory-heavy applications when not needed.'
            });
          }
        }
      }

      // Hotfixes
      const hotfixSection = content.match(/Hotfix\(s\):\s*(\d+)\s*Hotfix/i);
      if (hotfixSection) {
        const hotfixCount = parseInt(hotfixSection[1], 10);
        summary.hotfixCount = hotfixCount;
      }

      // Extract all hotfix KB numbers
      const kbPattern = /KB\d+/gi;
      const kbs = [];
      let kbMatch;
      while ((kbMatch = kbPattern.exec(content)) !== null) {
        if (!kbs.includes(kbMatch[0].toUpperCase())) {
          kbs.push(kbMatch[0].toUpperCase());
        }
      }
      summary.hotfixes = kbs;

      // Check for Hyper-V
      const hyperVMatch = content.match(/Hyper-V Requirements:\s*(.+)/i);
      if (hyperVMatch) {
        summary.hyperV = hyperVMatch[1].trim();
      }

      // Network adapters
      const nicSection = content.match(/Network Card\(s\):\s*(\d+)/i);
      if (nicSection) {
        summary.networkAdapters = parseInt(nicSection[1], 10);
      }

      if (issues.length === 0) {
        issues.push({
          severity: 'info',
          title: 'System info looks healthy',
          detail: `${summary.osName} ${summary.osVersion} — ${summary.manufacturer} ${summary.model}`,
          raw: '',
          recommendation: 'No issues detected from system info.'
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

  function parseWindowsDate(str) {
    // Handles formats like "2/15/2026, 10:30:00 AM" or "15/02/2026 10:30:00"
    const m1 = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?/i);
    if (m1) {
      let hours = parseInt(m1[4], 10);
      if (m1[7]) {
        if (m1[7].toUpperCase() === 'PM' && hours < 12) hours += 12;
        if (m1[7].toUpperCase() === 'AM' && hours === 12) hours = 0;
      }
      return new Date(parseInt(m1[3]), parseInt(m1[1]) - 1, parseInt(m1[2]), hours, parseInt(m1[5]), parseInt(m1[6]));
    }
    // Try Date.parse as fallback
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  function parseMBFromString(str) {
    const match = str.match(/([\d,.]+)\s*MB/i);
    if (match) return parseFloat(match[1].replace(/,/g, ''));
    const gbMatch = str.match(/([\d,.]+)\s*GB/i);
    if (gbMatch) return parseFloat(gbMatch[1].replace(/,/g, '')) * 1024;
    return 0;
  }
})();
