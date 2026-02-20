// Windows Updates Parser — wmic qfe list full /format:csv CSV

(function() {
  'use strict';
  window.PCHC = window.PCHC || {};
  window.PCHC.parsers = window.PCHC.parsers || {};

  window.PCHC.parsers.updates = {
  name: 'Windows Updates',
  category: 'security',

  detect(content, filename) {
    const fn = (filename || '').toLowerCase();
    if ((fn.includes('update') || fn.includes('hotfix') || fn.includes('qfe')) && fn.endsWith('.csv')) return true;
    return /HotFixID/i.test(content) && /InstalledOn/i.test(content);
  },

  parse(content) {
    const issues = [];
    const summary = {};

    const rows = parseCSV(content);
    if (rows.length < 2) {
      return {
        summary: { updateCount: 0 },
        score: 80,
        issues: [{ severity: 'warning', title: 'No update data found', detail: 'Could not parse Windows updates output.', raw: '', recommendation: 'Ensure the file was generated with: wmic qfe list full /format:csv' }]
      };
    }

    const headers = rows[0].map(h => h.toLowerCase().trim());
    const hotfixCol = headers.findIndex(h => h.includes('hotfixid'));
    const dateCol = headers.findIndex(h => h.includes('installedon'));
    const descCol = headers.findIndex(h => h.includes('description'));

    const updates = rows.slice(1)
      .filter(row => row.length > Math.max(hotfixCol, dateCol))
      .map(row => ({
        hotfixId: row[hotfixCol] || '',
        installedOn: row[dateCol] || '',
        description: row[descCol] || ''
      }))
      .filter(u => u.hotfixId.trim().length > 0);

    summary.updateCount = updates.length;

    // Parse dates and find the most recent update
    const now = new Date();
    let mostRecentDate = null;
    let mostRecentKB = '';

    for (const u of updates) {
      const date = parseUpdateDate(u.installedOn);
      if (date && (!mostRecentDate || date > mostRecentDate)) {
        mostRecentDate = date;
        mostRecentKB = u.hotfixId;
      }
    }

    if (mostRecentDate) {
      const daysSinceUpdate = Math.floor((now - mostRecentDate) / (1000 * 60 * 60 * 24));
      summary.daysSinceLastUpdate = daysSinceUpdate;
      summary.lastUpdateDate = mostRecentDate.toLocaleDateString();
      summary.lastUpdateKB = mostRecentKB;

      if (daysSinceUpdate > 90) {
        issues.push({
          severity: 'critical',
          title: `Windows updates are ${daysSinceUpdate} days old`,
          detail: `Last update (${mostRecentKB}) was installed on ${mostRecentDate.toLocaleDateString()}. That's over ${Math.floor(daysSinceUpdate / 30)} months without updates.`,
          raw: `Last update: ${mostRecentKB} on ${mostRecentDate.toLocaleDateString()}`,
          recommendation: 'Run Windows Update immediately. Unpatched systems are vulnerable to security exploits.'
        });
      } else if (daysSinceUpdate > 45) {
        issues.push({
          severity: 'warning',
          title: `Last Windows update was ${daysSinceUpdate} days ago`,
          detail: `Last update (${mostRecentKB}) installed on ${mostRecentDate.toLocaleDateString()}.`,
          raw: `Last update: ${mostRecentKB} on ${mostRecentDate.toLocaleDateString()}`,
          recommendation: 'Check for pending Windows updates. Updates should be installed at least monthly.'
        });
      } else {
        issues.push({
          severity: 'info',
          title: `Windows updates are current (${daysSinceUpdate} days ago)`,
          detail: `Last update (${mostRecentKB}) installed on ${mostRecentDate.toLocaleDateString()}.`,
          raw: `Last update: ${mostRecentKB} on ${mostRecentDate.toLocaleDateString()}`,
          recommendation: 'Updates are up to date. Keep automatic updates enabled.'
        });
      }
    }

    // Count update types
    const securityUpdates = updates.filter(u => /security/i.test(u.description));
    const hotfixes = updates.filter(u => /hotfix|update/i.test(u.description));
    summary.securityUpdates = securityUpdates.length;

    if (securityUpdates.length === 0 && updates.length > 0) {
      issues.push({
        severity: 'warning',
        title: 'No security updates detected in installed updates',
        detail: `Of ${updates.length} installed updates, none are marked as security updates.`,
        raw: `Total updates: ${updates.length}, Security: 0`,
        recommendation: 'Run Windows Update and specifically check for security updates.'
      });
    }

    // List KBs
    summary.kbNumbers = updates.map(u => u.hotfixId).filter(kb => /^KB/i.test(kb));

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

function parseUpdateDate(str) {
  if (!str || str.trim().length === 0) return null;
  // Handle "M/D/YYYY" format
  const m1 = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m1) return new Date(parseInt(m1[3]), parseInt(m1[1]) - 1, parseInt(m1[2]));
  // Handle "YYYYMMDD" format
  const m2 = str.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m2) return new Date(parseInt(m2[1]), parseInt(m2[2]) - 1, parseInt(m2[3]));
  // Fallback
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}


})();
