// Process List Parser — tasklist /v /fo csv CSV

export default {
  name: 'Running Processes',
  category: 'performance',

  detect(content, filename) {
    const fn = (filename || '').toLowerCase();
    if ((fn.includes('tasklist') || fn.includes('process')) && fn.endsWith('.csv')) return true;
    return /Image Name/i.test(content) &&
           /PID/i.test(content) &&
           /Mem Usage/i.test(content);
  },

  parse(content) {
    const issues = [];
    const summary = {};

    const rows = parseCSV(content);
    if (rows.length < 2) {
      return {
        summary: { processCount: 0 },
        score: 100,
        issues: [{ severity: 'info', title: 'No process data found', detail: 'Could not parse tasklist output.', raw: '', recommendation: 'Ensure the file was generated with: tasklist /v /fo csv' }]
      };
    }

    const headers = rows[0].map(h => h.toLowerCase().trim().replace(/"/g, ''));
    const nameCol = headers.findIndex(h => h.includes('image name'));
    const pidCol = headers.findIndex(h => h.includes('pid'));
    const memCol = headers.findIndex(h => h.includes('mem'));
    const statusCol = headers.findIndex(h => h.includes('status'));
    const cpuTimeCol = headers.findIndex(h => h.includes('cpu time'));
    const windowTitleCol = headers.findIndex(h => h.includes('window title'));

    const processes = rows.slice(1)
      .filter(row => row.length > Math.max(nameCol, pidCol, memCol))
      .map(row => ({
        name: (row[nameCol] || '').replace(/"/g, ''),
        pid: parseInt((row[pidCol] || '0').replace(/"/g, ''), 10),
        memoryKB: parseMemory(row[memCol] || ''),
        status: statusCol >= 0 ? (row[statusCol] || '').replace(/"/g, '') : '',
        cpuTime: cpuTimeCol >= 0 ? (row[cpuTimeCol] || '').replace(/"/g, '') : '',
        windowTitle: windowTitleCol >= 0 ? (row[windowTitleCol] || '').replace(/"/g, '') : ''
      }))
      .filter(p => p.name.length > 0);

    summary.processCount = processes.length;

    // Total memory usage
    const totalMemKB = processes.reduce((sum, p) => sum + p.memoryKB, 0);
    const totalMemMB = Math.round(totalMemKB / 1024);
    summary.totalMemoryMB = totalMemMB;

    // Find memory hogs (top 10 by memory)
    const sorted = [...processes].sort((a, b) => b.memoryKB - a.memoryKB);
    const topMemory = sorted.slice(0, 10);
    summary.topMemoryProcesses = topMemory.map(p => ({
      name: p.name,
      memoryMB: Math.round(p.memoryKB / 1024)
    }));

    // Flag individual high-memory processes
    const highMem = processes.filter(p => p.memoryKB > 1024 * 1024); // >1 GB
    if (highMem.length > 0) {
      issues.push({
        severity: 'warning',
        title: `${highMem.length} process${highMem.length > 1 ? 'es' : ''} using over 1 GB of RAM`,
        detail: highMem.map(p => `${p.name}: ${Math.round(p.memoryKB / 1024)} MB`).join(', '),
        raw: highMem.map(p => `${p.name} (PID ${p.pid}): ${Math.round(p.memoryKB / 1024)} MB`).join('\n'),
        recommendation: 'Check if these processes are behaving normally. Restart the application if memory usage seems excessive.'
      });
    }

    // Very high memory (>2 GB single process)
    const veryHighMem = processes.filter(p => p.memoryKB > 2 * 1024 * 1024);
    if (veryHighMem.length > 0) {
      issues.push({
        severity: 'critical',
        title: `${veryHighMem.length} process${veryHighMem.length > 1 ? 'es' : ''} using over 2 GB of RAM`,
        detail: veryHighMem.map(p => `${p.name}: ${Math.round(p.memoryKB / 1024)} MB`).join(', '),
        raw: veryHighMem.map(p => `${p.name} (PID ${p.pid}): ${Math.round(p.memoryKB / 1024)} MB`).join('\n'),
        recommendation: 'These processes may have a memory leak. Consider restarting them or the application.'
      });
    }

    // Process count assessment
    if (processes.length > 200) {
      issues.push({
        severity: 'warning',
        title: `${processes.length} running processes — high count`,
        detail: `A typical Windows system runs 80-150 processes. ${processes.length} is above normal.`,
        raw: `Process count: ${processes.length}`,
        recommendation: 'Review running processes and close unnecessary applications and services.'
      });
    } else if (processes.length > 150) {
      issues.push({
        severity: 'info',
        title: `${processes.length} running processes`,
        detail: 'Slightly above average but may be normal depending on installed software.',
        raw: `Process count: ${processes.length}`,
        recommendation: 'Monitor if the count continues to grow. Close unused applications.'
      });
    }

    // Check for "Not Responding" processes
    const notResponding = processes.filter(p => /not responding/i.test(p.status));
    if (notResponding.length > 0) {
      issues.push({
        severity: 'warning',
        title: `${notResponding.length} process${notResponding.length > 1 ? 'es' : ''} not responding`,
        detail: `Hung processes: ${notResponding.map(p => p.name).join(', ')}`,
        raw: notResponding.map(p => `${p.name} (PID ${p.pid}) - Not Responding`).join('\n'),
        recommendation: 'Force-close hung processes via Task Manager. If recurring, reinstall the affected applications.'
      });
    }

    // Check for high CPU time processes
    const highCPU = processes.filter(p => {
      const seconds = parseCPUTime(p.cpuTime);
      return seconds > 3600; // > 1 hour of CPU time
    });
    if (highCPU.length > 3) {
      issues.push({
        severity: 'info',
        title: `${highCPU.length} processes with high CPU time (>1hr)`,
        detail: `Processes with significant CPU usage: ${highCPU.slice(0, 5).map(p => p.name).join(', ')}`,
        raw: highCPU.slice(0, 5).map(p => `${p.name}: CPU Time ${p.cpuTime}`).join('\n'),
        recommendation: 'Some high CPU time is normal for system processes. Check for any unexpected CPU-intensive processes.'
      });
    }

    // Summary of top consumers
    if (topMemory.length > 0 && issues.length === 0) {
      issues.push({
        severity: 'info',
        title: `${processes.length} processes running — total ${totalMemMB} MB RAM used`,
        detail: `Top consumers: ${topMemory.slice(0, 5).map(p => `${p.name} (${Math.round(p.memoryKB / 1024)} MB)`).join(', ')}`,
        raw: '',
        recommendation: 'Process list looks healthy.'
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

function parseMemory(str) {
  // Handles "123,456 K", "123456 K", "123,456", etc.
  const cleaned = str.replace(/"/g, '').replace(/[^\d]/g, '');
  return parseInt(cleaned, 10) || 0;
}

function parseCPUTime(str) {
  if (!str) return 0;
  const m = str.match(/(\d+):(\d+):(\d+)/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
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
