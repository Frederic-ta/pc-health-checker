// Export — generate markdown summary and download

(function() {
  'use strict';
  window.PCHC = window.PCHC || {};

  var SEVERITY_ICONS = { critical: '🔴', warning: '🟠', info: '🔵' };
  var CATEGORY_ICONS = { power: '⚡', system: '💻', storage: '💾', network: '🌐', security: '🛡️', performance: '🚀' };
  var CATEGORY_LABELS = { power: 'Power & Battery', system: 'System & Hardware', storage: 'Storage', network: 'Network', security: 'Security', performance: 'Performance' };

  function getScoreLabel(score) {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 60) return 'Fair';
    if (score >= 40) return 'Poor';
    return 'Critical';
  }

  function generateMarkdown(scores) {
    var lines = [];
    var now = new Date();
    lines.push('# PC Health Check Report');
    lines.push('*Generated: ' + now.toLocaleDateString() + ' ' + now.toLocaleTimeString() + '*');
    lines.push('');

    if (scores.globalScore !== null) {
      lines.push('## Global Health Score: ' + scores.globalScore + '/100 (' + getScoreLabel(scores.globalScore) + ')');
    } else {
      lines.push('## Global Health Score: No Data');
    }
    lines.push('');

    lines.push('## Category Breakdown');
    lines.push('');
    lines.push('| Category | Score | Critical | Warning | Info |');
    lines.push('|----------|-------|----------|---------|------|');

    Object.keys(scores.categoryScores).forEach(function(cat) {
      var data = scores.categoryScores[cat];
      var icon = CATEGORY_ICONS[cat] || '';
      var label = CATEGORY_LABELS[cat] || cat;
      if (data.hasData) {
        lines.push('| ' + icon + ' ' + label + ' | ' + data.score + '/100 | ' + data.issueCounts.critical + ' | ' + data.issueCounts.warning + ' | ' + data.issueCounts.info + ' |');
      } else {
        lines.push('| ' + icon + ' ' + label + ' | No data | - | - | - |');
      }
    });
    lines.push('');

    lines.push('## Issues Found');
    lines.push('');

    ['critical', 'warning', 'info'].forEach(function(sev) {
      var groupIssues = scores.allIssues.filter(function(i) { return i.severity === sev; });
      if (groupIssues.length === 0) return;
      lines.push('### ' + SEVERITY_ICONS[sev] + ' ' + sev.charAt(0).toUpperCase() + sev.slice(1) + ' (' + groupIssues.length + ')');
      lines.push('');
      groupIssues.forEach(function(issue) {
        lines.push('#### ' + (CATEGORY_ICONS[issue.category] || '') + ' ' + issue.title);
        lines.push('- **Detail:** ' + issue.detail);
        if (issue.recommendation) lines.push('- **Recommendation:** ' + issue.recommendation);
        lines.push('');
      });
    });

    return lines.join('\n');
  }

  function downloadFile(content, filename, mimeType) {
    mimeType = mimeType || 'text/markdown';
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportToFile(scores) {
    var md = generateMarkdown(scores);
    var date = new Date().toISOString().split('T')[0];
    downloadFile(md, 'pc-health-report-' + date + '.md');
  }

  window.PCHC.exportToFile = exportToFile;
  window.PCHC.downloadFile = downloadFile;
})();
