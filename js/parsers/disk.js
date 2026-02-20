// Disk Info Parser — wmic diskdrive CSV

export default {
  name: 'Disk Info',
  category: 'storage',

  detect(content, filename) {
    const fn = (filename || '').toLowerCase();
    if ((fn.includes('disk') || fn.includes('volume')) && fn.endsWith('.csv')) return true;
    return (/Model/i.test(content) && /Size/i.test(content) && /Status/i.test(content) && /Node/i.test(content)) ||
           (/Caption/i.test(content) && /Capacity/i.test(content) && /FreeSpace/i.test(content));
  },

  parse(content) {
    const issues = [];
    const summary = {};

    const rows = parseCSV(content);
    if (rows.length < 2) {
      return {
        summary: { diskCount: 0 },
        score: 100,
        issues: [{ severity: 'info', title: 'No disk data found', detail: 'Could not parse disk info output.', raw: '', recommendation: 'Ensure the file was generated with: wmic diskdrive get model,size,status /format:csv' }]
      };
    }

    const headers = rows[0].map(h => h.toLowerCase().trim());

    // Determine if this is a diskdrive or volume report
    const isVolume = headers.some(h => h.includes('freespace') || h.includes('capacity'));
    const isDiskDrive = headers.some(h => h.includes('model'));

    if (isDiskDrive) {
      return parseDiskDrive(rows, headers, issues, summary);
    } else if (isVolume) {
      return parseVolume(rows, headers, issues, summary);
    }

    // Fallback — try both
    return parseDiskDrive(rows, headers, issues, summary);
  }
};

function parseDiskDrive(rows, headers, issues, summary) {
  const modelIdx = headers.findIndex(h => h.includes('model'));
  const sizeIdx = headers.findIndex(h => h.includes('size'));
  const statusIdx = headers.findIndex(h => h.includes('status'));

  const disks = rows.slice(1).filter(row => row.length > Math.max(modelIdx, sizeIdx, statusIdx)).map(row => ({
    model: row[modelIdx] || 'Unknown',
    sizeBytes: parseInt((row[sizeIdx] || '0').replace(/[^0-9]/g, ''), 10) || 0,
    status: row[statusIdx] || 'Unknown'
  })).filter(d => d.model.trim().length > 0 || d.sizeBytes > 0);

  summary.diskCount = disks.length;
  summary.disks = disks.map(d => ({
    model: d.model,
    sizeGB: Math.round(d.sizeBytes / (1024 * 1024 * 1024)),
    status: d.status
  }));

  // Check status
  for (const disk of disks) {
    const sizeGB = Math.round(disk.sizeBytes / (1024 * 1024 * 1024));
    const status = disk.status.toLowerCase();

    if (status !== 'ok' && status !== '' && status !== 'unknown') {
      issues.push({
        severity: 'critical',
        title: `Disk "${disk.model}" status: ${disk.status}`,
        detail: `Disk ${disk.model} (${sizeGB} GB) is reporting status "${disk.status}" which indicates potential failure.`,
        raw: `Model: ${disk.model}, Size: ${sizeGB} GB, Status: ${disk.status}`,
        recommendation: 'BACK UP YOUR DATA IMMEDIATELY. This disk may be failing. Replace the drive as soon as possible.'
      });
    } else if (sizeGB < 64 && sizeGB > 0) {
      issues.push({
        severity: 'info',
        title: `Small disk detected: ${disk.model} (${sizeGB} GB)`,
        detail: `Disk ${disk.model} is only ${sizeGB} GB. This may be a boot drive or removable media.`,
        raw: `Model: ${disk.model}, Size: ${sizeGB} GB`,
        recommendation: 'Ensure you have adequate storage space for your needs.'
      });
    }
  }

  if (disks.length > 0 && issues.length === 0) {
    issues.push({
      severity: 'info',
      title: `${disks.length} disk${disks.length > 1 ? 's' : ''} detected — all reporting OK`,
      detail: disks.map(d => `${d.model} (${Math.round(d.sizeBytes / (1024 * 1024 * 1024))} GB)`).join(', '),
      raw: '',
      recommendation: 'Disk health looks good.'
    });
  }

  let score = 100;
  for (const issue of issues) {
    if (issue.severity === 'critical') score -= 30;
    else if (issue.severity === 'warning') score -= 10;
    else if (issue.severity === 'info') score -= 2;
  }
  score = Math.max(0, Math.min(100, score));

  return { summary, score, issues };
}

function parseVolume(rows, headers, issues, summary) {
  const captionIdx = headers.findIndex(h => h.includes('caption'));
  const capacityIdx = headers.findIndex(h => h.includes('capacity'));
  const freeIdx = headers.findIndex(h => h.includes('freespace') || h.includes('free'));

  const volumes = rows.slice(1).filter(row => row.length > Math.max(captionIdx, capacityIdx, freeIdx)).map(row => ({
    caption: row[captionIdx] || '',
    capacityBytes: parseInt((row[capacityIdx] || '0').replace(/[^0-9]/g, ''), 10) || 0,
    freeBytes: parseInt((row[freeIdx] || '0').replace(/[^0-9]/g, ''), 10) || 0
  })).filter(v => v.capacityBytes > 0);

  summary.volumeCount = volumes.length;
  summary.volumes = volumes.map(v => ({
    caption: v.caption,
    capacityGB: Math.round(v.capacityBytes / (1024 * 1024 * 1024)),
    freeGB: Math.round(v.freeBytes / (1024 * 1024 * 1024)),
    usedPercent: Math.round(((v.capacityBytes - v.freeBytes) / v.capacityBytes) * 100)
  }));

  for (const v of summary.volumes) {
    if (v.usedPercent > 95) {
      issues.push({
        severity: 'critical',
        title: `Volume ${v.caption} is almost full (${v.usedPercent}% used)`,
        detail: `Only ${v.freeGB} GB free of ${v.capacityGB} GB total on ${v.caption}.`,
        raw: `Caption: ${v.caption}, Capacity: ${v.capacityGB} GB, Free: ${v.freeGB} GB`,
        recommendation: 'Free up disk space immediately. Delete temp files, empty recycle bin, or move data to external storage.'
      });
    } else if (v.usedPercent > 85) {
      issues.push({
        severity: 'warning',
        title: `Volume ${v.caption} is ${v.usedPercent}% full`,
        detail: `${v.freeGB} GB free of ${v.capacityGB} GB total on ${v.caption}.`,
        raw: `Caption: ${v.caption}, Capacity: ${v.capacityGB} GB, Free: ${v.freeGB} GB`,
        recommendation: 'Consider freeing up space. Run Disk Cleanup or remove unused applications.'
      });
    }
  }

  if (issues.length === 0 && volumes.length > 0) {
    issues.push({
      severity: 'info',
      title: `${volumes.length} volume${volumes.length > 1 ? 's' : ''} — adequate free space`,
      detail: volumes.map(v => `${v.caption} ${v.freeGB}/${v.capacityGB} GB free`).join(', '),
      raw: '',
      recommendation: 'Storage space looks sufficient.'
    });
  }

  let score = 100;
  for (const issue of issues) {
    if (issue.severity === 'critical') score -= 30;
    else if (issue.severity === 'warning') score -= 10;
    else if (issue.severity === 'info') score -= 2;
  }
  score = Math.max(0, Math.min(100, score));

  return { summary, score, issues };
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
