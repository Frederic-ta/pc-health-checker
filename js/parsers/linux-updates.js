// Linux Updates Parser — apt list --upgradable / dnf check-update output

(function() {
  'use strict';
  window.PCHC = window.PCHC || {};
  window.PCHC.parsers = window.PCHC.parsers || {};

  window.PCHC.parsers.linuxUpdates = {
    name: 'Linux Updates',
    category: 'security',

    detect(content, filename) {
      var fn = (filename || '').toLowerCase();
      if (fn.includes('linux-updates') || fn.includes('upgradable') || fn.includes('check-update')) return true;
      // apt list --upgradable output: "package/distro version [upgradable from: version]"
      // dnf check-update output: "package.arch  version  repo"
      return /\[upgradable\s+from:/i.test(content) ||
             (/Listing\.\.\./i.test(content) && /upgradable/i.test(content)) ||
             // dnf format
             (/\.x86_64|\.noarch|\.i686/i.test(content) && /updates|fedora|epel/i.test(content));
    },

    parse(content) {
      var issues = [];
      var summary = { totalUpdates: 0, securityUpdates: 0, packages: [] };

      var lines = content.split('\n');
      var isApt = /upgradable/i.test(content);
      var isDnf = /\.x86_64|\.noarch|\.i686/i.test(content) && !isApt;

      if (isApt) {
        // apt format: "package/distro version arch [upgradable from: old-version]"
        for (var i = 0; i < lines.length; i++) {
          var aptMatch = lines[i].match(/^(\S+)\/(\S+)\s+(\S+)\s+\S+\s+\[upgradable\s+from:\s+(\S+)\]/i);
          if (aptMatch) {
            summary.totalUpdates++;
            var pkg = { name: aptMatch[1], repo: aptMatch[2], newVersion: aptMatch[3], oldVersion: aptMatch[4] };
            summary.packages.push(pkg);
            // Check if it's a security update
            if (/security/i.test(aptMatch[2])) {
              summary.securityUpdates++;
            }
          }
        }
      } else if (isDnf) {
        // dnf format: "package.arch     version     repo"
        for (var j = 0; j < lines.length; j++) {
          var line = lines[j].trim();
          // Skip headers and blank lines
          if (!line || /^Last metadata|^$/i.test(line) || /Obsoleting/i.test(line)) continue;
          var dnfMatch = line.match(/^(\S+)\s+(\S+)\s+(\S+)/);
          if (dnfMatch && /\.\S+$/.test(dnfMatch[1])) {
            summary.totalUpdates++;
            summary.packages.push({ name: dnfMatch[1], newVersion: dnfMatch[2], repo: dnfMatch[3] });
            if (/security/i.test(dnfMatch[3])) {
              summary.securityUpdates++;
            }
          }
        }
      }

      // Issues
      if (summary.securityUpdates > 0) {
        issues.push({
          severity: 'critical',
          title: summary.securityUpdates + ' security update(s) pending',
          detail: 'Security patches are available but not installed.',
          raw: 'Security updates: ' + summary.securityUpdates + ' out of ' + summary.totalUpdates + ' total',
          recommendation: isApt ? 'Run: sudo apt update && sudo apt upgrade -y' : 'Run: sudo dnf update --security -y'
        });
      }

      if (summary.totalUpdates > 50) {
        issues.push({
          severity: 'warning',
          title: summary.totalUpdates + ' package updates pending',
          detail: 'A large number of packages have updates available.',
          raw: 'Total pending: ' + summary.totalUpdates,
          recommendation: isApt ? 'Run: sudo apt update && sudo apt upgrade -y' : 'Run: sudo dnf update -y'
        });
      } else if (summary.totalUpdates > 10) {
        issues.push({
          severity: 'info',
          title: summary.totalUpdates + ' package updates available',
          detail: 'Several package updates are waiting to be installed.',
          raw: 'Total pending: ' + summary.totalUpdates,
          recommendation: 'Run your package manager update command to stay current.'
        });
      } else if (summary.totalUpdates > 0 && summary.securityUpdates === 0) {
        issues.push({
          severity: 'info',
          title: summary.totalUpdates + ' package update(s) available',
          detail: 'Minor updates are available.',
          raw: 'Total pending: ' + summary.totalUpdates,
          recommendation: 'Install updates at your convenience.'
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
          title: 'System is up to date',
          detail: 'No pending package updates found.',
          raw: '',
          recommendation: 'No action needed. The system has all available updates installed.'
        });
      }

      return { summary: summary, score: score, issues: issues };
    }
  };
})();
