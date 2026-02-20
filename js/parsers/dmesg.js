// dmesg Parser — dmesg kernel ring buffer output

(function() {
  'use strict';
  window.PCHC = window.PCHC || {};
  window.PCHC.parsers = window.PCHC.parsers || {};

  window.PCHC.parsers.dmesg = {
    name: 'dmesg',
    category: 'system',

    detect(content, filename) {
      var fn = (filename || '').toLowerCase();
      if (fn.includes('dmesg')) return true;
      // Typical dmesg patterns: timestamps like [    0.000000] or ISO timestamps
      return /\[\s*\d+\.\d+\]\s/m.test(content.substring(0, 2000)) &&
             /Linux\s+version|kernel:|DMI:/i.test(content.substring(0, 5000));
    },

    parse(content) {
      var issues = [];
      var summary = { errors: 0, warnings: 0, hardwareErrors: 0, usbErrors: 0 };
      var lines = content.split('\n');

      var errorLines = [];
      var warnLines = [];
      var hwErrors = [];
      var usbErrors = [];

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];

        // Kernel errors
        if (/\berror\b/i.test(line) && !/Corrected error/i.test(line)) {
          summary.errors++;
          if (errorLines.length < 10) errorLines.push(line.trim());
        }

        // Warnings
        if (/\bwarn(?:ing)?\b/i.test(line)) {
          summary.warnings++;
          if (warnLines.length < 10) warnLines.push(line.trim());
        }

        // Hardware / PCIe / MCE errors
        if (/(?:hardware\s*error|mce|machine\s*check|pcie.*error|AER|GHES)/i.test(line)) {
          summary.hardwareErrors++;
          if (hwErrors.length < 5) hwErrors.push(line.trim());
        }

        // USB errors
        if (/usb.*(?:error|fail|disconnect|device\s*descriptor\s*read)/i.test(line)) {
          summary.usbErrors++;
          if (usbErrors.length < 5) usbErrors.push(line.trim());
        }
      }

      // Segfaults / oops
      var segfaults = lines.filter(function(l) { return /segfault|oops|panic|BUG:/i.test(l); });
      summary.segfaults = segfaults.length;

      // OOM killer
      var oomLines = lines.filter(function(l) { return /Out of memory|oom-killer|invoked oom/i.test(l); });
      summary.oomEvents = oomLines.length;

      // Issues
      if (summary.hardwareErrors > 0) {
        issues.push({
          severity: 'critical',
          title: summary.hardwareErrors + ' hardware error(s) detected in kernel log',
          detail: 'Machine Check Exceptions, PCIe errors, or other hardware faults were logged.',
          raw: hwErrors.join('\n'),
          recommendation: 'Run hardware diagnostics. Check for overheating, loose components, or failing hardware. Review: dmesg | grep -i "error\\|mce\\|hardware"'
        });
      }

      if (summary.segfaults > 0) {
        issues.push({
          severity: 'critical',
          title: summary.segfaults + ' segfault(s) or kernel oops detected',
          detail: 'Segmentation faults or kernel oops indicate software bugs or memory issues.',
          raw: segfaults.slice(0, 5).join('\n'),
          recommendation: 'Test RAM with memtest86+. Update the kernel and affected software. Check for corrupted files.'
        });
      }

      if (summary.oomEvents > 0) {
        issues.push({
          severity: 'critical',
          title: 'OOM killer invoked ' + summary.oomEvents + ' time(s)',
          detail: 'The system ran out of memory and had to kill processes.',
          raw: oomLines.slice(0, 3).join('\n'),
          recommendation: 'Add more RAM or increase swap. Identify memory-hungry processes with: top or htop.'
        });
      }

      if (summary.usbErrors > 5) {
        issues.push({
          severity: 'warning',
          title: summary.usbErrors + ' USB error(s) detected',
          detail: 'Multiple USB device errors may indicate faulty cables, ports, or devices.',
          raw: usbErrors.join('\n'),
          recommendation: 'Try different USB ports or cables. Update USB drivers. Check for loose connections.'
        });
      } else if (summary.usbErrors > 0) {
        issues.push({
          severity: 'info',
          title: summary.usbErrors + ' USB error(s) in kernel log',
          detail: 'Minor USB errors were detected.',
          raw: usbErrors.join('\n'),
          recommendation: 'Usually harmless if not recurring. Monitor for patterns.'
        });
      }

      if (summary.errors > 20) {
        issues.push({
          severity: 'warning',
          title: summary.errors + ' kernel error messages found',
          detail: 'A high number of error messages in the kernel log.',
          raw: errorLines.join('\n'),
          recommendation: 'Review errors for patterns: dmesg | grep -i error'
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
          title: 'Kernel log looks clean',
          detail: 'No significant errors detected in dmesg output.',
          raw: '',
          recommendation: 'No action needed.'
        });
      }

      return { summary: summary, score: score, issues: issues };
    }
  };
})();
