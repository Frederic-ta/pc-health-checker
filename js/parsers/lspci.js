// lspci Parser — lspci -v output

(function() {
  'use strict';
  window.PCHC = window.PCHC || {};
  window.PCHC.parsers = window.PCHC.parsers || {};

  window.PCHC.parsers.lspci = {
    name: 'lspci',
    category: 'system',

    detect(content, filename) {
      var fn = (filename || '').toLowerCase();
      if (fn.includes('lspci')) return true;
      // lspci -v output has lines like "00:00.0 Host bridge: ..."
      return /^\d{2}:\d{2}\.\d\s/m.test(content.substring(0, 2000)) &&
             /(?:Host bridge|VGA compatible|Network controller|Ethernet controller)/i.test(content);
    },

    parse(content) {
      var issues = [];
      var summary = { devices: 0, gpus: [], networkControllers: [], storageControllers: [] };

      // Split into device blocks
      var blocks = content.split(/(?=^\d{2}:\d{2}\.\d\s)/m);

      for (var i = 0; i < blocks.length; i++) {
        var block = blocks[i].trim();
        if (!block) continue;

        // Parse device header: "00:02.0 VGA compatible controller: Intel ..."
        var headerMatch = block.match(/^(\d{2}:\d{2}\.\d)\s+(.+?):\s*(.+)/);
        if (!headerMatch) continue;

        summary.devices++;
        var type = headerMatch[2];
        var name = headerMatch[3].trim();

        // Categorize devices
        if (/VGA|3D|Display/i.test(type)) {
          summary.gpus.push(name);
        } else if (/Network|Ethernet|WiFi|Wireless/i.test(type)) {
          summary.networkControllers.push(name);
        } else if (/SATA|NVMe|RAID|SCSI|IDE|Storage/i.test(type)) {
          summary.storageControllers.push(name);
        }

        // Check for kernel driver
        var driverMatch = block.match(/Kernel\s+driver\s+in\s+use:\s*(.+)/i);
        var modulesMatch = block.match(/Kernel\s+modules:\s*(.+)/i);

        if (!driverMatch && modulesMatch && /VGA|3D|Display|Network|Ethernet/i.test(type)) {
          issues.push({
            severity: 'warning',
            title: 'No kernel driver loaded for: ' + name,
            detail: 'Device type: ' + type + '. Available modules: ' + modulesMatch[1],
            raw: block.substring(0, 300),
            recommendation: 'Install the appropriate driver. Available modules: ' + modulesMatch[1]
          });
        }
      }

      // Summary info
      if (summary.gpus.length > 0) {
        summary.gpu = summary.gpus.join(', ');
      }

      if (summary.gpus.length === 0) {
        issues.push({
          severity: 'info',
          title: 'No discrete GPU detected',
          detail: 'No VGA or 3D controller found in PCI device list.',
          raw: '',
          recommendation: 'System may be using integrated graphics or a non-PCI GPU.'
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
          title: summary.devices + ' PCI devices detected',
          detail: 'All PCI devices have drivers loaded.',
          raw: 'GPUs: ' + (summary.gpus.join(', ') || 'none') + '\nNetwork: ' + (summary.networkControllers.join(', ') || 'none'),
          recommendation: 'No action needed.'
        });
      }

      return { summary: summary, score: score, issues: issues };
    }
  };
})();
