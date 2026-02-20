// Memory Linux Parser — free -h and /proc/meminfo output

(function() {
  'use strict';
  window.PCHC = window.PCHC || {};
  window.PCHC.parsers = window.PCHC.parsers || {};

  window.PCHC.parsers.memoryLinux = {
    name: 'Memory (Linux)',
    category: 'performance',

    detect(content, filename) {
      var fn = (filename || '').toLowerCase();
      if (fn.includes('memory-linux') || fn.includes('meminfo') || fn === 'free.txt') return true;
      // free -h output has "Mem:" and "Swap:" lines; /proc/meminfo has "MemTotal:"
      return (/Mem:\s/m.test(content) && /Swap:\s/m.test(content)) ||
             (/MemTotal:/i.test(content) && /MemFree:/i.test(content));
    },

    parse(content) {
      var issues = [];
      var summary = {};

      // Parse free -h output
      // Mem:           15Gi       8.2Gi       4.1Gi       512Mi       3.1Gi       6.5Gi
      var memMatch = content.match(/Mem:\s+([\d.]+\S+)\s+([\d.]+\S+)\s+([\d.]+\S+)/i);
      if (memMatch) {
        summary.totalRam = memMatch[1];
        summary.usedRam = memMatch[2];
        summary.freeRam = memMatch[3];
      }

      var swapMatch = content.match(/Swap:\s+([\d.]+\S+)\s+([\d.]+\S+)\s+([\d.]+\S+)/i);
      if (swapMatch) {
        summary.totalSwap = swapMatch[1];
        summary.usedSwap = swapMatch[2];
        summary.freeSwap = swapMatch[3];
      }

      // Parse /proc/meminfo for more detail
      var memTotalMatch = content.match(/MemTotal:\s+(\d+)\s*kB/i);
      var memAvailMatch = content.match(/MemAvailable:\s+(\d+)\s*kB/i);
      var swapTotalMatch = content.match(/SwapTotal:\s+(\d+)\s*kB/i);
      var swapFreeMatch = content.match(/SwapFree:\s+(\d+)\s*kB/i);

      var memTotalKB = memTotalMatch ? parseInt(memTotalMatch[1], 10) : null;
      var memAvailKB = memAvailMatch ? parseInt(memAvailMatch[1], 10) : null;
      var swapTotalKB = swapTotalMatch ? parseInt(swapTotalMatch[1], 10) : null;
      var swapFreeKB = swapFreeMatch ? parseInt(swapFreeMatch[1], 10) : null;

      if (memTotalKB) {
        summary.totalRamMB = Math.round(memTotalKB / 1024);
        summary.totalRamGB = (memTotalKB / 1048576).toFixed(1) + ' GB';
      }
      if (memAvailKB) {
        summary.availableRamMB = Math.round(memAvailKB / 1024);
      }

      // Calculate usage percentage
      if (memTotalKB && memAvailKB) {
        var usedPercent = Math.round(((memTotalKB - memAvailKB) / memTotalKB) * 100);
        summary.ramUsedPercent = usedPercent;

        if (usedPercent > 95) {
          issues.push({
            severity: 'critical',
            title: 'RAM usage critically high at ' + usedPercent + '%',
            detail: 'Only ' + Math.round(memAvailKB / 1024) + ' MB available out of ' + Math.round(memTotalKB / 1024) + ' MB total.',
            raw: 'MemTotal: ' + memTotalKB + ' kB | MemAvailable: ' + memAvailKB + ' kB',
            recommendation: 'Close unused applications. Consider adding more RAM if this is a recurring issue.'
          });
        } else if (usedPercent > 85) {
          issues.push({
            severity: 'warning',
            title: 'High memory usage: ' + usedPercent + '%',
            detail: Math.round(memAvailKB / 1024) + ' MB available out of ' + Math.round(memTotalKB / 1024) + ' MB total.',
            raw: 'MemTotal: ' + memTotalKB + ' kB | MemAvailable: ' + memAvailKB + ' kB',
            recommendation: 'Monitor memory usage. Close memory-intensive applications if not needed.'
          });
        }
      }

      // Swap usage
      if (swapTotalKB && swapTotalKB > 0 && swapFreeKB !== null) {
        var swapUsedKB = swapTotalKB - swapFreeKB;
        var swapPercent = Math.round((swapUsedKB / swapTotalKB) * 100);
        summary.swapUsedPercent = swapPercent;

        if (swapPercent > 80) {
          issues.push({
            severity: 'warning',
            title: 'High swap usage: ' + swapPercent + '%',
            detail: 'System is heavily using swap space, which degrades performance.',
            raw: 'SwapTotal: ' + swapTotalKB + ' kB | SwapFree: ' + swapFreeKB + ' kB',
            recommendation: 'Add more RAM or increase swap size. Check for memory leaks with: top or htop.'
          });
        } else if (swapPercent > 50) {
          issues.push({
            severity: 'info',
            title: 'Moderate swap usage: ' + swapPercent + '%',
            detail: 'Some swap is being used, which is normal under heavy load.',
            raw: 'SwapTotal: ' + swapTotalKB + ' kB | SwapFree: ' + swapFreeKB + ' kB',
            recommendation: 'Normal if the system is under load. Monitor for increasing usage.'
          });
        }
      } else if (swapTotalKB === 0 || (swapTotalMatch && swapTotalKB === 0)) {
        issues.push({
          severity: 'info',
          title: 'No swap space configured',
          detail: 'The system has no swap partition or file.',
          raw: 'SwapTotal: 0 kB',
          recommendation: 'Consider adding a swap file for systems with limited RAM: sudo fallocate -l 4G /swapfile'
        });
      }

      // Low total RAM check
      if (memTotalKB && memTotalKB < 2 * 1048576) {
        issues.push({
          severity: 'warning',
          title: 'Low total RAM: ' + (memTotalKB / 1048576).toFixed(1) + ' GB',
          detail: 'System has less than 2 GB of RAM.',
          raw: 'MemTotal: ' + memTotalKB + ' kB',
          recommendation: 'Consider upgrading RAM for better performance.'
        });
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
          title: 'Memory usage is healthy',
          detail: summary.totalRamGB ? 'Total RAM: ' + summary.totalRamGB + ', usage is normal.' : 'Memory usage is within normal ranges.',
          raw: '',
          recommendation: 'No action needed.'
        });
      }

      return { summary: summary, score: score, issues: issues };
    }
  };
})();
