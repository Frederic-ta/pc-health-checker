// Driver Query Parser — driverquery /v /fo csv CSV

(function() {
  'use strict';
  window.PCHC = window.PCHC || {};
  window.PCHC.parsers = window.PCHC.parsers || {};

  window.PCHC.parsers.drivers = {
    name: 'Driver Query',
    category: 'system',

    detect(content, filename) {
      const fn = (filename || '').toLowerCase();
      if ((fn.includes('driver') || fn.includes('driverquery')) && fn.endsWith('.csv')) return true;
      return /Module Name/i.test(content) &&
             /Display Name/i.test(content) &&
             /Driver Type/i.test(content);
    },

    parse(content) {
      const issues = [];
      const summary = {};

      const rows = parseCSV(content);
      if (rows.length === 0) {
        return {
          summary: { totalDrivers: 0 },
          score: 100,
          issues: [{ severity: 'info', title: 'No driver data found', detail: 'Could not parse driver query output.', raw: '', recommendation: 'Ensure the file was generated with: driverquery /v /fo csv' }]
        };
      }

      summary.totalDrivers = rows.length;

      // Find column indices
      const headers = rows[0];
      const colIdx = (name) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));

      const moduleCol = colIdx('Module Name');
      const displayCol = colIdx('Display Name');
      const typeCol = colIdx('Driver Type');
      const dateCol = colIdx('Link Date');
      const stateCol = colIdx('State');
      const statusCol = colIdx('Status');
      const startCol = colIdx('Start Mode');

      const drivers = rows.slice(1).map(row => ({
        module: row[moduleCol] || '',
        displayName: row[displayCol] || '',
        type: row[typeCol] || '',
        linkDate: row[dateCol] || '',
        state: row[stateCol] || '',
        status: row[statusCol] || '',
        startMode: row[startCol] || ''
      }));

      summary.totalDrivers = drivers.length;

      // Check for stopped/degraded drivers
      const stoppedDrivers = drivers.filter(d =>
        d.state && /stopped/i.test(d.state) && /boot|system|auto/i.test(d.startMode)
      );
      if (stoppedDrivers.length > 0) {
        issues.push({
          severity: 'warning',
          title: `${stoppedDrivers.length} auto-start driver${stoppedDrivers.length > 1 ? 's are' : ' is'} stopped`,
          detail: `Drivers expected to be running but are stopped: ${stoppedDrivers.slice(0, 5).map(d => d.displayName || d.module).join(', ')}`,
          raw: stoppedDrivers.slice(0, 5).map(d => `${d.module} (${d.displayName}) - ${d.state}`).join('\n'),
          recommendation: 'These drivers should be running. Check Device Manager for errors or reinstall affected drivers.'
        });
      }

      // Check for old drivers
      const now = new Date();
      const oldDrivers = [];
      const veryOldDrivers = [];

      for (const d of drivers) {
        if (!d.linkDate) continue;
        const date = parseDriverDate(d.linkDate);
        if (!date) continue;

        const ageMonths = Math.floor((now - date) / (1000 * 60 * 60 * 24 * 30));
        if (ageMonths > 60) {
          veryOldDrivers.push({ ...d, ageMonths });
        } else if (ageMonths > 36) {
          oldDrivers.push({ ...d, ageMonths });
        }
      }

      summary.outdatedDrivers = veryOldDrivers.length + oldDrivers.length;

      if (veryOldDrivers.length > 10) {
        issues.push({
          severity: 'warning',
          title: `${veryOldDrivers.length} drivers are over 5 years old`,
          detail: `Many drivers haven't been updated in over 5 years. This is common for built-in Windows drivers but some may need attention.`,
          raw: veryOldDrivers.slice(0, 5).map(d => `${d.displayName || d.module}: ${d.linkDate}`).join('\n'),
          recommendation: 'Review old drivers — some may be built-in Windows drivers (normal), but third-party drivers should be updated.'
        });
      } else if (veryOldDrivers.length > 0) {
        issues.push({
          severity: 'info',
          title: `${veryOldDrivers.length} driver${veryOldDrivers.length > 1 ? 's are' : ' is'} over 5 years old`,
          detail: veryOldDrivers.slice(0, 5).map(d => `${d.displayName || d.module}: ${d.linkDate}`).join('; '),
          raw: veryOldDrivers.slice(0, 5).map(d => `${d.displayName || d.module}: ${d.linkDate}`).join('\n'),
          recommendation: 'Check if these drivers have newer versions available.'
        });
      }

      // Check for kernel vs filesystem driver ratio
      const kernelDrivers = drivers.filter(d => /kernel/i.test(d.type));
      const fsDrivers = drivers.filter(d => /file system/i.test(d.type));
      summary.kernelDrivers = kernelDrivers.length;
      summary.fileSystemDrivers = fsDrivers.length;

      if (issues.length === 0) {
        issues.push({
          severity: 'info',
          title: `${drivers.length} drivers loaded — no issues detected`,
          detail: `All checked drivers appear to be in normal state.`,
          raw: '',
          recommendation: 'Drivers look healthy. Keep them updated periodically.'
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

  function parseCSV(text) {
    const rows = [];
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().length === 0) continue;
      const row = [];
      let inQuotes = false;
      let field = '';
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === ',' && !inQuotes) {
          row.push(field.trim());
          field = '';
        } else {
          field += ch;
        }
      }
      row.push(field.trim());
      rows.push(row);
    }
    return rows;
  }

  function parseDriverDate(str) {
    // Handles various date formats: "1/15/2020 12:00:00 AM", "2020-01-15", etc.
    const m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2]));
    const iso = str.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }
})();
