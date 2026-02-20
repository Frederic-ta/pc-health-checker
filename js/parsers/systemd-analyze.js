// systemd-analyze Parser — systemd-analyze blame output

(function() {
  'use strict';
  window.PCHC = window.PCHC || {};
  window.PCHC.parsers = window.PCHC.parsers || {};

  window.PCHC.parsers.systemdAnalyze = {
    name: 'systemd-analyze',
    category: 'performance',

    detect(content, filename) {
      var fn = (filename || '').toLowerCase();
      if (fn.includes('systemd-analyze') || fn.includes('systemd_analyze')) return true;
      // systemd-analyze output: "Startup finished in Xs (kernel) + Xs (userspace) = Xs"
      // blame output: "  Xs service-name.service"
      return /Startup\s+finished\s+in/i.test(content) ||
             /^\s*\d+[\d.]*m?s\s+\S+\.service/m.test(content);
    },

    parse(content) {
      var issues = [];
      var summary = {};

      // Parse total boot time
      var bootMatch = content.match(/Startup\s+finished\s+in\s+(.+?)\s*=\s*([\d.]+)(min|s|ms)/i);
      if (bootMatch) {
        var totalStr = bootMatch[2];
        var unit = bootMatch[3];
        var totalSeconds;
        if (unit === 'min') {
          totalSeconds = parseFloat(totalStr) * 60;
        } else if (unit === 'ms') {
          totalSeconds = parseFloat(totalStr) / 1000;
        } else {
          totalSeconds = parseFloat(totalStr);
        }
        summary.totalBootTime = totalSeconds.toFixed(1) + 's';
        summary.totalBootSeconds = totalSeconds;

        // Also try to parse kernel + userspace separately
        var detailMatch = content.match(/Startup\s+finished\s+in\s+([\d.]+)(min|s|ms)\s*\(kernel\)\s*\+\s*([\d.]+)(min|s|ms)\s*\(userspace\)/i);
        if (detailMatch) {
          var kernelVal = parseFloat(detailMatch[1]);
          if (detailMatch[2] === 'min') kernelVal *= 60;
          else if (detailMatch[2] === 'ms') kernelVal /= 1000;
          summary.kernelTime = kernelVal.toFixed(1) + 's';

          var userspaceVal = parseFloat(detailMatch[3]);
          if (detailMatch[4] === 'min') userspaceVal *= 60;
          else if (detailMatch[4] === 'ms') userspaceVal /= 1000;
          summary.userspaceTime = userspaceVal.toFixed(1) + 's';
        }
      }

      // Parse blame output
      var blameSection = content;
      var blameStart = content.indexOf('---BLAME---');
      if (blameStart !== -1) {
        blameSection = content.substring(blameStart);
      }

      var services = [];
      var blameLines = blameSection.split('\n');
      for (var i = 0; i < blameLines.length; i++) {
        var line = blameLines[i].trim();
        // Match patterns like "12.345s NetworkManager.service" or "1min 2.345s snapd.service"
        var svcMatch = line.match(/^(?:(\d+)min\s+)?([\d.]+)(ms|s)\s+(.+)/);
        if (svcMatch) {
          var minutes = svcMatch[1] ? parseInt(svcMatch[1], 10) : 0;
          var value = parseFloat(svcMatch[2]);
          var svcUnit = svcMatch[3];
          var svcName = svcMatch[4].trim();

          var svcSeconds;
          if (svcUnit === 'ms') {
            svcSeconds = value / 1000;
          } else {
            svcSeconds = value;
          }
          svcSeconds += minutes * 60;

          services.push({ name: svcName, seconds: svcSeconds });
        }
      }

      summary.totalServices = services.length;

      // Find slow services (> 10 seconds)
      var slowServices = services.filter(function(s) { return s.seconds > 10; });
      summary.slowServices = slowServices.length;

      if (summary.totalBootSeconds && summary.totalBootSeconds > 120) {
        issues.push({
          severity: 'warning',
          title: 'Slow boot time: ' + summary.totalBootTime,
          detail: 'Total boot time exceeds 2 minutes.',
          raw: 'Total: ' + summary.totalBootTime + (summary.kernelTime ? ' | Kernel: ' + summary.kernelTime + ' | Userspace: ' + summary.userspaceTime : ''),
          recommendation: 'Disable unnecessary services. Run: systemd-analyze blame to see the slowest services.'
        });
      } else if (summary.totalBootSeconds && summary.totalBootSeconds > 60) {
        issues.push({
          severity: 'info',
          title: 'Boot time: ' + summary.totalBootTime,
          detail: 'Boot time is over a minute, which may be improvable.',
          raw: 'Total: ' + summary.totalBootTime,
          recommendation: 'Review slow services and consider disabling unused ones.'
        });
      }

      // Report slow services
      if (slowServices.length > 0) {
        var topSlow = slowServices.slice(0, 5);
        issues.push({
          severity: slowServices.length > 3 ? 'warning' : 'info',
          title: slowServices.length + ' slow boot service(s) (>10s)',
          detail: 'These services took the longest to start during boot.',
          raw: topSlow.map(function(s) { return s.seconds.toFixed(1) + 's — ' + s.name; }).join('\n'),
          recommendation: 'Consider disabling or optimizing slow services: sudo systemctl disable <service-name>'
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
          title: 'Boot performance is good',
          detail: summary.totalBootTime ? 'Total boot time: ' + summary.totalBootTime : 'No slow services detected.',
          raw: '',
          recommendation: 'No action needed.'
        });
      }

      return { summary: summary, score: score, issues: issues };
    }
  };
})();
