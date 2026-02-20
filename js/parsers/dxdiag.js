// DxDiag Parser — dxdiag /t TXT

(function() {
  'use strict';
  window.PCHC = window.PCHC || {};
  window.PCHC.parsers = window.PCHC.parsers || {};

  window.PCHC.parsers.dxdiag = {
    name: 'DxDiag Report',
    category: 'system',

    detect(content, filename) {
      const fn = (filename || '').toLowerCase();
      if (fn.includes('dxdiag') && fn.endsWith('.txt')) return true;
      return /DxDiag/i.test(content) && /DirectX/i.test(content) ||
             (/System Information/i.test(content) && /Display Devices/i.test(content) && /DirectX Version/i.test(content));
    },

    parse(content) {
      const issues = [];
      const summary = {};

      // Extract DirectX version
      const dxMatch = content.match(/DirectX Version:\s*(.+)/i);
      summary.directXVersion = dxMatch ? dxMatch[1].trim() : 'Unknown';

      // Extract system info
      const osMatch = content.match(/Operating System:\s*(.+)/i);
      summary.os = osMatch ? osMatch[1].trim() : '';

      const cpuMatch = content.match(/Processor:\s*(.+)/i);
      summary.cpu = cpuMatch ? cpuMatch[1].trim() : '';

      const ramMatch = content.match(/Memory:\s*(.+)/i);
      summary.ram = ramMatch ? ramMatch[1].trim() : '';

      // Extract Display Devices section
      const displaySection = content.match(/[-]+\s*Display Devices\s*[-]+\s*([\s\S]*?)(?:[-]{5,}|\z)/i);
      const displayText = displaySection ? displaySection[1] : content;

      // GPU info
      const gpuNameMatch = displayText.match(/Card name:\s*(.+)/i);
      summary.gpuName = gpuNameMatch ? gpuNameMatch[1].trim() : 'Unknown';

      const gpuMfgMatch = displayText.match(/Manufacturer:\s*(.+)/i);
      summary.gpuManufacturer = gpuMfgMatch ? gpuMfgMatch[1].trim() : '';

      const vramMatch = displayText.match(/(?:Dedicated Memory|Display Memory|Approx\.\s*Total Memory):\s*(.+)/i);
      summary.vram = vramMatch ? vramMatch[1].trim() : '';

      // Driver info
      const driverVersionMatch = displayText.match(/Driver Version:\s*(.+)/i);
      summary.driverVersion = driverVersionMatch ? driverVersionMatch[1].trim() : '';

      const driverDateMatch = displayText.match(/Driver Date\/Size:\s*(.+)/i) ||
                              displayText.match(/Driver Date:\s*(.+)/i);
      summary.driverDate = driverDateMatch ? driverDateMatch[1].trim() : '';

      // Check driver age
      if (summary.driverDate) {
        const dateMatch = summary.driverDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (dateMatch) {
          const driverDate = new Date(parseInt(dateMatch[3]), parseInt(dateMatch[1]) - 1, parseInt(dateMatch[2]));
          const now = new Date();
          const ageMonths = Math.floor((now - driverDate) / (1000 * 60 * 60 * 24 * 30));

          if (ageMonths > 24) {
            issues.push({
              severity: 'warning',
              title: `Display driver is ${ageMonths} months old`,
              detail: `GPU driver for ${summary.gpuName} was last updated ${summary.driverDate}. That's over ${Math.floor(ageMonths / 12)} year${ageMonths >= 24 ? 's' : ''} ago.`,
              raw: `Driver: ${summary.driverVersion}, Date: ${summary.driverDate}`,
              recommendation: 'Update your GPU driver from the manufacturer website (NVIDIA, AMD, or Intel).'
            });
          } else if (ageMonths > 12) {
            issues.push({
              severity: 'info',
              title: `Display driver is ${ageMonths} months old`,
              detail: `GPU driver for ${summary.gpuName} was last updated ${summary.driverDate}.`,
              raw: `Driver: ${summary.driverVersion}, Date: ${summary.driverDate}`,
              recommendation: 'Consider updating your GPU driver for best performance and compatibility.'
            });
          }
        }
      }

      // Check for problems found / notes sections
      const problemSections = content.match(/(?:Notes|Problems Found):\s*(.+)/gi) || [];
      for (const section of problemSections) {
        const noteText = section.replace(/(?:Notes|Problems Found):\s*/i, '').trim();
        if (noteText.length > 3 && !/No problems found/i.test(noteText) && !/N\/A/i.test(noteText)) {
          issues.push({
            severity: 'warning',
            title: 'DxDiag reported a problem',
            detail: noteText,
            raw: section,
            recommendation: 'Investigate the reported issue. May require driver update or DirectX repair.'
          });
        }
      }

      // Check WHQL (Windows Hardware Quality Labs) signed
      const whqlMatch = displayText.match(/WHQL.*?:\s*(.+)/i);
      if (whqlMatch && /no/i.test(whqlMatch[1])) {
        issues.push({
          severity: 'info',
          title: 'Display driver is not WHQL certified',
          detail: 'The GPU driver has not been certified by Windows Hardware Quality Labs.',
          raw: `WHQL: ${whqlMatch[1].trim()}`,
          recommendation: 'Consider using a WHQL-certified driver version for maximum stability.'
        });
      }

      // DirectX version check
      if (summary.directXVersion) {
        const dxVersionNum = parseFloat(summary.directXVersion.replace(/[^\d.]/g, ''));
        if (dxVersionNum > 0 && dxVersionNum < 12) {
          issues.push({
            severity: 'info',
            title: `DirectX ${summary.directXVersion} (not the latest)`,
            detail: `System is running DirectX ${summary.directXVersion}. DirectX 12 is recommended for modern games and applications.`,
            raw: `DirectX Version: ${summary.directXVersion}`,
            recommendation: 'Update Windows to get the latest DirectX version. DirectX 12 comes with Windows 10/11.'
          });
        }
      }

      if (issues.length === 0) {
        issues.push({
          severity: 'info',
          title: 'Display and DirectX configuration looks good',
          detail: `GPU: ${summary.gpuName}, Driver: ${summary.driverVersion}, DirectX: ${summary.directXVersion}`,
          raw: '',
          recommendation: 'No issues detected.'
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
})();
