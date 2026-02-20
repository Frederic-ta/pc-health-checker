// Startup Programs Parser — wmic startup CSV

(function() {
  'use strict';
  window.PCHC = window.PCHC || {};
  window.PCHC.parsers = window.PCHC.parsers || {};

  window.PCHC.parsers.startup = {
  name: 'Startup Programs',
  category: 'performance',

  detect(content, filename) {
    const fn = (filename || '').toLowerCase();
    if (fn.includes('startup') && fn.endsWith('.csv')) return true;
    return /Caption/i.test(content) && /Command/i.test(content) &&
           (/startup/i.test(content) || /Node/i.test(content));
  },

  parse(content) {
    const issues = [];
    const summary = {};

    const rows = parseCSV(content);
    if (rows.length < 2) {
      return {
        summary: { startupCount: 0 },
        score: 100,
        issues: [{ severity: 'info', title: 'No startup data found', detail: 'Could not parse startup programs output.', raw: '', recommendation: 'Ensure the file was generated with: wmic startup get caption,command /format:csv' }]
      };
    }

    const headers = rows[0].map(h => h.toLowerCase().trim());
    const captionCol = headers.findIndex(h => h.includes('caption'));
    const commandCol = headers.findIndex(h => h.includes('command'));

    const programs = rows.slice(1)
      .filter(row => row.length > Math.max(captionCol, commandCol))
      .map(row => ({
        caption: row[captionCol] || '',
        command: row[commandCol] || ''
      }))
      .filter(p => p.caption.trim().length > 0 || p.command.trim().length > 0);

    summary.startupCount = programs.length;
    summary.programs = programs.map(p => p.caption || extractExeName(p.command));

    // Assess startup count
    if (programs.length > 25) {
      issues.push({
        severity: 'critical',
        title: `${programs.length} startup programs — severely impacting boot time`,
        detail: `Having ${programs.length} programs starting at boot significantly slows down system startup and consumes memory.`,
        raw: programs.slice(0, 10).map(p => p.caption || p.command).join('\n'),
        recommendation: 'Disable unnecessary startup programs in Task Manager > Startup tab. Keep only essential programs like antivirus.'
      });
    } else if (programs.length > 15) {
      issues.push({
        severity: 'warning',
        title: `${programs.length} startup programs — may slow boot time`,
        detail: `${programs.length} programs launch at startup. Typical recommendation is under 10.`,
        raw: programs.slice(0, 10).map(p => p.caption || p.command).join('\n'),
        recommendation: 'Review startup programs in Task Manager. Disable programs you don\'t need immediately at boot.'
      });
    } else if (programs.length > 10) {
      issues.push({
        severity: 'info',
        title: `${programs.length} startup programs`,
        detail: `Slightly above the recommended count of ~10 startup programs.`,
        raw: programs.map(p => p.caption || p.command).join('\n'),
        recommendation: 'Consider disabling a few non-essential startup programs for faster boot times.'
      });
    } else {
      issues.push({
        severity: 'info',
        title: `${programs.length} startup programs — good`,
        detail: 'Startup program count is within a healthy range.',
        raw: programs.map(p => p.caption || p.command).join('\n'),
        recommendation: 'Startup configuration looks fine.'
      });
    }

    // Flag known resource-heavy startup programs
    const heavyPrograms = [
      { pattern: /discord/i, name: 'Discord' },
      { pattern: /spotify/i, name: 'Spotify' },
      { pattern: /steam/i, name: 'Steam' },
      { pattern: /teams/i, name: 'Microsoft Teams' },
      { pattern: /skype/i, name: 'Skype' },
      { pattern: /itunes/i, name: 'iTunes Helper' },
      { pattern: /adobe.*(?:updater|cc|creative)/i, name: 'Adobe Creative Cloud' },
      { pattern: /onedrive/i, name: 'OneDrive' },
      { pattern: /dropbox/i, name: 'Dropbox' },
      { pattern: /cortana/i, name: 'Cortana' }
    ];

    const foundHeavy = [];
    for (const prog of programs) {
      const text = `${prog.caption} ${prog.command}`;
      for (const heavy of heavyPrograms) {
        if (heavy.pattern.test(text) && !foundHeavy.includes(heavy.name)) {
          foundHeavy.push(heavy.name);
        }
      }
    }

    if (foundHeavy.length > 3) {
      issues.push({
        severity: 'info',
        title: `${foundHeavy.length} resource-heavy apps in startup`,
        detail: `These apps consume significant resources at boot: ${foundHeavy.join(', ')}`,
        raw: foundHeavy.join('\n'),
        recommendation: 'Consider disabling these from startup if you don\'t need them immediately. You can still launch them manually.'
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

function extractExeName(command) {
  if (!command) return '';
  const match = command.match(/([^\\\/]+)\.(exe|bat|cmd|vbs|js)/i);
  return match ? match[1] : command.substring(0, 50);
}

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


})();
