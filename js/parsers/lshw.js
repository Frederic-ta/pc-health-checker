// lshw Parser — lshw -json output

(function() {
  'use strict';
  window.PCHC = window.PCHC || {};
  window.PCHC.parsers = window.PCHC.parsers || {};

  window.PCHC.parsers.lshw = {
    name: 'lshw',
    category: 'system',

    detect(content, filename) {
      var fn = (filename || '').toLowerCase();
      if (fn.includes('lshw')) return true;
      // lshw JSON typically has "class" : "system" at top level
      return /\"class\"\s*:\s*\"system\"/i.test(content.substring(0, 3000)) &&
             /\"children\"/i.test(content.substring(0, 5000));
    },

    parse(content) {
      var issues = [];
      var summary = {};
      var data;

      try {
        data = JSON.parse(content);
      } catch (e) {
        return {
          summary: {},
          score: 50,
          issues: [{ severity: 'warning', title: 'Could not parse lshw JSON', detail: 'The file does not appear to be valid JSON.', raw: e.message, recommendation: 'Re-run: sudo lshw -json > lshw.json' }]
        };
      }

      // Flatten the tree to find components
      var components = [];
      function walk(node) {
        if (!node) return;
        components.push(node);
        if (node.children) {
          for (var i = 0; i < node.children.length; i++) {
            walk(node.children[i]);
          }
        }
      }
      walk(data);

      // Extract CPU info
      var cpu = components.find(function(c) { return c.class === 'processor'; });
      if (cpu) {
        summary.cpu = cpu.product || cpu.description || 'Unknown CPU';
        summary.cpuVendor = cpu.vendor || '';
        if (cpu.capacity) {
          summary.cpuMaxSpeed = (cpu.capacity / 1000000000).toFixed(2) + ' GHz';
        }
      }

      // Extract memory
      var memBank = components.find(function(c) { return c.class === 'memory' && c.id === 'memory'; });
      if (memBank && memBank.size) {
        var ramGB = (memBank.size / (1024 * 1024 * 1024)).toFixed(1);
        summary.totalRam = ramGB + ' GB';
      }

      // Extract GPU(s)
      var gpus = components.filter(function(c) { return c.class === 'display'; });
      if (gpus.length > 0) {
        summary.gpu = gpus.map(function(g) { return g.product || g.description || 'Unknown GPU'; }).join(', ');
      }

      // Extract storage
      var disks = components.filter(function(c) { return c.class === 'disk'; });
      if (disks.length > 0) {
        summary.disks = disks.map(function(d) {
          var sizeGB = d.size ? (d.size / (1024 * 1024 * 1024)).toFixed(0) + ' GB' : 'Unknown';
          return (d.product || 'Disk') + ' (' + sizeGB + ')';
        });
      }

      // Extract network
      var nics = components.filter(function(c) { return c.class === 'network'; });
      if (nics.length > 0) {
        summary.networkAdapters = nics.map(function(n) { return n.product || n.description || 'Network Adapter'; });
      }

      // System info
      if (data.product) summary.model = data.product;
      if (data.vendor) summary.manufacturer = data.vendor;

      // Issue detection
      if (!cpu) {
        issues.push({
          severity: 'warning',
          title: 'CPU information not found in lshw output',
          detail: 'The lshw report did not contain processor information.',
          raw: '',
          recommendation: 'Ensure lshw was run with sudo: sudo lshw -json'
        });
      }

      if (!memBank || !memBank.size) {
        issues.push({
          severity: 'info',
          title: 'Memory size not detected',
          detail: 'Could not determine total system RAM from the lshw report.',
          raw: '',
          recommendation: 'Check with: free -h or cat /proc/meminfo'
        });
      }

      // Check for disabled/unclaimed devices
      var unclaimed = components.filter(function(c) { return c.claimed === false || c.disabled === true; });
      if (unclaimed.length > 0) {
        issues.push({
          severity: 'warning',
          title: unclaimed.length + ' unclaimed/disabled device(s) found',
          detail: 'Some hardware devices are not claimed by a driver or are disabled.',
          raw: unclaimed.map(function(u) { return (u.class || '') + ': ' + (u.product || u.description || u.id); }).join('\n'),
          recommendation: 'Install missing drivers or enable disabled devices. Check: lspci -v for details.'
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
          title: 'Hardware inventory looks good',
          detail: 'All hardware components detected and claimed by drivers.',
          raw: '',
          recommendation: 'No action needed.'
        });
      }

      return { summary: summary, score: score, issues: issues };
    }
  };
})();
