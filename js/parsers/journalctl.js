// journalctl Parser — journalctl -b --output=json

(function() {
  'use strict';
  window.PCHC = window.PCHC || {};
  window.PCHC.parsers = window.PCHC.parsers || {};

  window.PCHC.parsers.journalctl = {
    name: 'journalctl',
    category: 'security',

    detect(content, filename) {
      var fn = (filename || '').toLowerCase();
      if (fn.includes('journalctl') || fn.includes('journal.json')) return true;
      // JSON lines with systemd journal fields
      return /\"_SYSTEMD_UNIT\"|\"__REALTIME_TIMESTAMP\"|\"PRIORITY\"/i.test(content.substring(0, 2000));
    },

    parse(content) {
      var issues = [];
      var summary = { critical: 0, errors: 0, warnings: 0, totalEntries: 0, units: {} };

      // journalctl --output=json produces one JSON object per line
      var lines = content.split('\n');
      var entries = [];

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line || line[0] !== '{') continue;
        try {
          entries.push(JSON.parse(line));
        } catch (e) {
          // skip malformed lines
        }
      }

      summary.totalEntries = entries.length;

      for (var j = 0; j < entries.length; j++) {
        var entry = entries[j];
        var priority = parseInt(entry.PRIORITY, 10);
        var unit = entry._SYSTEMD_UNIT || entry.SYSLOG_IDENTIFIER || 'unknown';
        var msg = entry.MESSAGE || '';

        summary.units[unit] = (summary.units[unit] || 0) + 1;

        // Priority: 0=emerg, 1=alert, 2=crit, 3=err, 4=warn
        if (priority <= 2) {
          summary.critical++;
        } else if (priority === 3) {
          summary.errors++;
        } else if (priority === 4) {
          summary.warnings++;
        }
      }

      if (summary.critical > 0) {
        issues.push({
          severity: 'critical',
          title: summary.critical + ' critical/emergency journal entries found',
          detail: 'The system journal contains ' + summary.critical + ' entries with priority level critical, alert, or emergency.',
          raw: 'Total entries: ' + summary.totalEntries + ' | Critical: ' + summary.critical + ' | Errors: ' + summary.errors + ' | Warnings: ' + summary.warnings,
          recommendation: 'Review critical journal entries with: journalctl -b -p 0..2 . These may indicate kernel panics, hardware failures, or severe service crashes.'
        });
      }

      if (summary.errors > 20) {
        issues.push({
          severity: 'warning',
          title: summary.errors + ' error-level journal entries',
          detail: 'A high number of error-level messages were logged during this boot.',
          raw: 'Error entries: ' + summary.errors,
          recommendation: 'Review errors with: journalctl -b -p 3 . Investigate recurring units or services that produce errors.'
        });
      } else if (summary.errors > 0) {
        issues.push({
          severity: 'info',
          title: summary.errors + ' error-level journal entries',
          detail: 'Some error messages were found in the system journal.',
          raw: 'Error entries: ' + summary.errors,
          recommendation: 'Review with: journalctl -b -p 3'
        });
      }

      if (summary.warnings > 50) {
        issues.push({
          severity: 'warning',
          title: summary.warnings + ' warning-level journal entries',
          detail: 'A high number of warnings in the system journal may indicate recurring issues.',
          raw: 'Warning entries: ' + summary.warnings,
          recommendation: 'Run: journalctl -b -p 4 to see all warnings. Look for patterns.'
        });
      }

      // Score
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
          title: 'System journal looks clean',
          detail: 'No critical or error entries found in this boot journal (' + summary.totalEntries + ' entries analyzed).',
          raw: '',
          recommendation: 'No action needed.'
        });
      }

      return { summary: summary, score: score, issues: issues };
    }
  };
})();
