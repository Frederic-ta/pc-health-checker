// Energy Report Parser — powercfg /energy HTML

(function() {
  'use strict';
  window.PCHC = window.PCHC || {};
  window.PCHC.parsers = window.PCHC.parsers || {};

  window.PCHC.parsers.energy = {
  name: 'Energy Report',
  category: 'power',

  detect(content, filename) {
    const fn = (filename || '').toLowerCase();
    if (fn.includes('energy') && (fn.endsWith('.html') || fn.endsWith('.htm'))) return true;
    return /Energy Efficiency Diagnostics Report/i.test(content) ||
           /energy-report/i.test(content) ||
           (/Errors?\s*:/i.test(content) && /Warnings?\s*:/i.test(content) && /Informational/i.test(content) && /Power Policy/i.test(content));
  },

  parse(content) {
    const issues = [];
    const summary = {};

    // Extract error/warning/info counts from the summary section
    const errorCountMatch = content.match(/(\d+)\s*Error/i);
    const warningCountMatch = content.match(/(\d+)\s*Warning/i);
    const infoCountMatch = content.match(/(\d+)\s*Informational/i);

    const errorCount = errorCountMatch ? parseInt(errorCountMatch[1], 10) : 0;
    const warningCount = warningCountMatch ? parseInt(warningCountMatch[1], 10) : 0;
    const infoCount = infoCountMatch ? parseInt(infoCountMatch[1], 10) : 0;

    summary.errors = errorCount;
    summary.warnings = warningCount;
    summary.informational = infoCount;

    // Parse individual error sections
    const errorSections = content.match(/<h2[^>]*>Error[^<]*<\/h2>[\s\S]*?(?=<h2|$)/gi) || [];
    const errorBlocks = content.match(/<div class="err"[^>]*>[\s\S]*?<\/div>/gi) || [];
    const allErrors = [...errorSections, ...errorBlocks];

    // Also try to extract error items by pattern
    const errorItemPattern = /(?:Error|err)[^:]*:\s*([^\n<]+)/gi;
    let errorItemMatch;
    const seenErrors = new Set();
    while ((errorItemMatch = errorItemPattern.exec(content)) !== null) {
      const title = errorItemMatch[1].trim();
      if (title.length > 5 && title.length < 200 && !seenErrors.has(title)) {
        seenErrors.add(title);
      }
    }

    // Parse sections for specific issues
    // USB devices not entering suspend
    if (/USB\s*Suspend/i.test(content) || /not\s*entering\s*(?:the\s*)?suspend/i.test(content)) {
      issues.push({
        severity: 'warning',
        title: 'USB devices not entering suspend state',
        detail: 'One or more USB devices are preventing power saving by not entering suspend mode.',
        raw: extractSection(content, 'USB Suspend'),
        recommendation: 'Check USB device drivers. Update or uninstall unused USB devices to improve power efficiency.'
      });
    }

    // Platform timer resolution
    if (/Timer\s*Resolution/i.test(content) || /platform\s*timer/i.test(content)) {
      const timerMatch = content.match(/Timer\s*Resolution[^<\d]*?(\d+)/i);
      if (timerMatch) {
        const resolution = parseInt(timerMatch[1], 10);
        if (resolution < 5) {
          issues.push({
            severity: 'warning',
            title: `Platform timer resolution is high (${resolution}ms)`,
            detail: 'A low timer resolution forces the CPU to wake more frequently, increasing power usage.',
            raw: `Timer Resolution: ${resolution}ms`,
            recommendation: 'Identify the application requesting high timer resolution and close it when on battery power.'
          });
        }
      }
    }

    // Processor power management
    if (/Processor\s*power\s*management/i.test(content)) {
      if (/not\s*configured/i.test(content) || /disabled/i.test(content)) {
        issues.push({
          severity: 'warning',
          title: 'Processor power management not optimally configured',
          detail: 'Processor power management settings may not be configured for best efficiency.',
          raw: extractSection(content, 'Processor power management'),
          recommendation: 'Review power plan settings. Set minimum processor state to a lower value when on battery.'
        });
      }
    }

    // Generate summary issues based on counts
    if (errorCount > 0) {
      issues.push({
        severity: 'critical',
        title: `Energy report found ${errorCount} error${errorCount > 1 ? 's' : ''}`,
        detail: `The energy efficiency diagnostics identified ${errorCount} error-level issues that significantly impact power efficiency.`,
        raw: `Errors: ${errorCount}, Warnings: ${warningCount}, Informational: ${infoCount}`,
        recommendation: 'Review and address each error in the energy report. These typically indicate drivers or settings that waste significant power.'
      });
    }

    if (warningCount > 5) {
      issues.push({
        severity: 'warning',
        title: `Energy report has ${warningCount} warnings`,
        detail: `The energy report identified ${warningCount} warning-level issues.`,
        raw: `Warnings: ${warningCount}`,
        recommendation: 'Review warnings for quick power efficiency wins like adjusting display timeout or sleep settings.'
      });
    } else if (warningCount > 0) {
      issues.push({
        severity: 'info',
        title: `Energy report has ${warningCount} warning${warningCount > 1 ? 's' : ''}`,
        detail: `The energy report identified ${warningCount} minor warning-level issues.`,
        raw: `Warnings: ${warningCount}`,
        recommendation: 'Review warnings to see if any quick power savings can be achieved.'
      });
    }

    if (infoCount > 0 && errorCount === 0 && warningCount === 0) {
      issues.push({
        severity: 'info',
        title: `Energy report: ${infoCount} informational item${infoCount > 1 ? 's' : ''}`,
        detail: 'Only informational items were found — no significant power efficiency problems detected.',
        raw: `Informational: ${infoCount}`,
        recommendation: 'No major action needed. Review informational items for optional tweaks.'
      });
    }

    // Score calculation
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

function extractSection(content, keyword) {
  const idx = content.indexOf(keyword);
  if (idx === -1) return '';
  const snippet = content.substring(idx, idx + 300).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return snippet.substring(0, 200);
}


})();
