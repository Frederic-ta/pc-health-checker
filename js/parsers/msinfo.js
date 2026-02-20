// MSInfo32 Parser — msinfo32 /report TXT

export default {
  name: 'MSInfo32 Report',
  category: 'system',

  detect(content, filename) {
    const fn = (filename || '').toLowerCase();
    if (fn.includes('msinfo') && fn.endsWith('.txt')) return true;
    // MSInfo32 reports have a distinctive format
    return /^\[System Summary\]/mi.test(content) ||
           (/OS Name\s/i.test(content) && /System Manufacturer/i.test(content) && /System Model/i.test(content));
  },

  parse(content) {
    const issues = [];
    const summary = {};

    // Extract OS info
    const osMatch = content.match(/OS Name\s+(.+)/i);
    summary.osName = osMatch ? osMatch[1].trim() : 'Unknown';

    const osVersionMatch = content.match(/Version\s+([\d.]+)/i);
    summary.osVersion = osVersionMatch ? osVersionMatch[1].trim() : '';

    // Extract CPU
    const cpuMatch = content.match(/Processor\s+(.+)/i);
    summary.cpu = cpuMatch ? cpuMatch[1].trim() : 'Unknown';

    // Extract RAM
    const ramMatch = content.match(/(?:Total Physical Memory|Installed Physical Memory)\s+([\d,.]+ [GMTK]B)/i);
    summary.totalRam = ramMatch ? ramMatch[1].trim() : 'Unknown';

    const availRamMatch = content.match(/Available Physical Memory\s+([\d,.]+ [GMTK]B)/i);
    summary.availableRam = availRamMatch ? availRamMatch[1].trim() : '';

    // Extract system manufacturer/model
    const mfgMatch = content.match(/System Manufacturer\s+(.+)/i);
    summary.manufacturer = mfgMatch ? mfgMatch[1].trim() : '';

    const modelMatch = content.match(/System Model\s+(.+)/i);
    summary.model = modelMatch ? modelMatch[1].trim() : '';

    // Extract BIOS
    const biosMatch = content.match(/BIOS Version\/Date\s+(.+)/i);
    summary.bios = biosMatch ? biosMatch[1].trim() : '';

    // Look for GPU info in display section
    const gpuMatch = content.match(/(?:Name|Adapter Description)\s+(.*?(?:NVIDIA|AMD|Radeon|GeForce|Intel|Graphics|GPU)[^\r\n]*)/i);
    summary.gpu = gpuMatch ? gpuMatch[1].trim() : '';

    // Check for problem devices
    const problemSection = content.match(/\[Problem Devices\]([\s\S]*?)(?:\[|$)/i);
    if (problemSection) {
      const problemText = problemSection[1].trim();
      const problemDevices = problemText.split('\n').filter(line => line.trim().length > 0 && !/^Item/.test(line.trim()));

      if (problemDevices.length > 0) {
        issues.push({
          severity: 'warning',
          title: `${problemDevices.length} problem device${problemDevices.length > 1 ? 's' : ''} detected`,
          detail: `Devices with issues: ${problemDevices.slice(0, 5).map(d => d.trim()).join('; ')}`,
          raw: problemDevices.slice(0, 10).join('\n'),
          recommendation: 'Update or reinstall drivers for problem devices. Check Device Manager for yellow exclamation marks.'
        });
      }
    }

    // Check for device conflicts
    const conflictSection = content.match(/\[(?:IRQ |I\/O |Memory |DMA )?Conflicts[^[\]]*\]([\s\S]*?)(?:\[|$)/i);
    if (conflictSection) {
      const conflictText = conflictSection[1].trim();
      if (conflictText.length > 10 && !/no conflicts/i.test(conflictText)) {
        const conflictLines = conflictText.split('\n').filter(l => l.trim().length > 0);
        issues.push({
          severity: 'warning',
          title: 'Device conflicts detected',
          detail: `Hardware resource conflicts found that may cause instability.`,
          raw: conflictLines.slice(0, 5).join('\n'),
          recommendation: 'Check Device Manager for conflicting devices. May need to update BIOS or drivers.'
        });
      }
    }

    // Check for driver issues
    const driverSection = content.match(/\[(?:Loaded |Signed )?Drivers?\]([\s\S]*?)(?:\[|$)/i);
    if (driverSection) {
      const driverText = driverSection[1];
      const unsignedDrivers = [];
      const lines = driverText.split('\n');
      for (const line of lines) {
        if (/not signed|no\s*$/i.test(line) && line.trim().length > 5) {
          unsignedDrivers.push(line.trim());
        }
      }
      if (unsignedDrivers.length > 0) {
        issues.push({
          severity: 'warning',
          title: `${unsignedDrivers.length} unsigned driver${unsignedDrivers.length > 1 ? 's' : ''} found`,
          detail: 'Unsigned drivers may pose security risks or cause stability issues.',
          raw: unsignedDrivers.slice(0, 5).join('\n'),
          recommendation: 'Update unsigned drivers to signed versions from the manufacturer.'
        });
      }
    }

    // Check available RAM ratio
    if (summary.totalRam && summary.availableRam) {
      const totalGB = parseRamToGB(summary.totalRam);
      const availGB = parseRamToGB(summary.availableRam);
      if (totalGB > 0 && availGB >= 0) {
        const usedPercent = Math.round(((totalGB - availGB) / totalGB) * 100);
        summary.ramUsedPercent = usedPercent;
        if (usedPercent > 90) {
          issues.push({
            severity: 'critical',
            title: `RAM usage critically high: ${usedPercent}%`,
            detail: `${availGB.toFixed(1)} GB free of ${totalGB.toFixed(1)} GB total.`,
            raw: `Total: ${summary.totalRam}, Available: ${summary.availableRam}`,
            recommendation: 'Close unnecessary applications. Consider upgrading RAM if this is a persistent issue.'
          });
        } else if (usedPercent > 80) {
          issues.push({
            severity: 'warning',
            title: `RAM usage high: ${usedPercent}%`,
            detail: `${availGB.toFixed(1)} GB free of ${totalGB.toFixed(1)} GB total.`,
            raw: `Total: ${summary.totalRam}, Available: ${summary.availableRam}`,
            recommendation: 'Monitor memory usage. Close memory-heavy applications when not needed.'
          });
        }
      }
    }

    if (issues.length === 0) {
      issues.push({
        severity: 'info',
        title: 'System hardware appears healthy',
        detail: `${summary.manufacturer} ${summary.model} — ${summary.cpu}`,
        raw: '',
        recommendation: 'No hardware issues detected.'
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

function parseRamToGB(str) {
  const match = str.match(/([\d,.]+)\s*(GB|MB|TB|KB)/i);
  if (!match) return 0;
  const val = parseFloat(match[1].replace(/,/g, ''));
  const unit = match[2].toUpperCase();
  if (unit === 'TB') return val * 1024;
  if (unit === 'GB') return val;
  if (unit === 'MB') return val / 1024;
  if (unit === 'KB') return val / (1024 * 1024);
  return 0;
}
