// PC Health Checker — Main Application Module

(function() {
  'use strict';
  var P = window.PCHC;

  var state = {
    parseResults: new Map(),
    scores: null,
    filters: { search: '', category: 'all', severity: 'all' }
  };

  var CATEGORY_LABELS = {
    power: '⚡ Power & Battery', system: '💻 System & Hardware', storage: '💾 Storage',
    network: '🌐 Network', security: '🛡️ Security', performance: '🚀 Performance'
  };

  var DEFAULT_SUMMARIES = {
    power: 'No data — drop a battery report, energy report, or sleep study',
    system: 'No data — drop an MSInfo32, DxDiag, or SystemInfo report',
    storage: 'No data — drop disk health or volume info reports',
    network: 'No data — drop a WiFi report or network config',
    security: 'No data — drop update history, event logs, or SFC results',
    performance: 'No data — drop a perfmon report, startup list, or process list'
  };

  document.addEventListener('DOMContentLoaded', function() {
    P.initTheme();
    P.initOnboarding();
    P.initTabs();
    P.initCopyButtons();
    P.initDropZone(handleFilesDropped);
    initFilters();
    initExport();
    initScriptDownloads();
    renderCategoryCards();
    renderProblems();
    P.animateScoreRing(null);
  });

  function handleFilesDropped(files) {
    var parsedCount = 0;
    var processed = 0;

    files.forEach(function(file) {
      var reader = new FileReader();
      reader.onload = function() {
        var content = reader.result;
        var parsed = P.detectAndParse(file.name, content);
        if (parsed) {
          state.parseResults.set(file.name, parsed);
          parsedCount++;
          P.showToast('Parsed "' + file.name + '" as ' + parsed.parser.name, 'success');
        } else {
          P.showToast('Could not identify report type for "' + file.name + '"', 'warning');
        }
        processed++;
        if (processed === files.length && parsedCount > 0) {
          recalculate();
          render();
        }
      };
      reader.onerror = function() {
        P.showToast('Failed to read "' + file.name + '"', 'error');
        processed++;
      };
      reader.readAsText(file);
    });
  }

  function recalculate() {
    state.scores = state.parseResults.size > 0 ? P.calculateScores(Array.from(state.parseResults.values())) : null;
  }

  function render() {
    renderCategoryCards();
    renderProblems();
    P.animateScoreRing(state.scores ? state.scores.globalScore : null);
  }

  function renderCategoryCards() {
    var grid = document.getElementById('category-grid');
    grid.querySelectorAll('.category-card').forEach(function(card) {
      var cat = card.dataset.category;
      var catData = state.scores && state.scores.categoryScores ? state.scores.categoryScores[cat] : null;
      var score = catData ? catData.score : null;
      var scoreEl = card.querySelector('.card-score');
      var summaryEl = card.querySelector('.card-summary');
      var emptyState = card.querySelector('.card-empty-state');
      var issueCounts = catData ? catData.issueCounts : { critical: 0, warning: 0, info: 0 };

      card.querySelector('.critical-count').textContent = '🔴 ' + issueCounts.critical;
      card.querySelector('.warning-count').textContent = '🟠 ' + issueCounts.warning;
      card.querySelector('.info-count').textContent = '🔵 ' + issueCounts.info;

      if (catData && catData.hasData) {
        scoreEl.textContent = score;
        card.classList.add('has-data');
        card.classList.remove('no-data');
        emptyState.classList.add('hidden');
        scoreEl.dataset.score = score >= 80 ? 'green' : score >= 50 ? 'orange' : 'red';
        var total = issueCounts.critical + issueCounts.warning + issueCounts.info;
        summaryEl.textContent = total > 0 ? total + ' issue' + (total > 1 ? 's' : '') + ' found' : 'Looking good — no issues detected';
      } else {
        scoreEl.textContent = '—';
        scoreEl.dataset.score = '';
        card.classList.remove('has-data');
        card.classList.add('no-data');
        emptyState.classList.remove('hidden');
        summaryEl.textContent = DEFAULT_SUMMARIES[cat] || 'No data';
      }
    });
  }

  function renderProblems() {
    var list = document.getElementById('problems-list');
    var countEl = document.getElementById('problems-count');
    var allIssues = state.scores ? state.scores.allIssues : [];

    var filters = {};
    if (state.filters.category !== 'all') filters.categories = [state.filters.category];
    if (state.filters.severity !== 'all') filters.severities = [state.filters.severity];
    if (state.filters.search) filters.query = state.filters.search;

    var filtered = P.filterIssues(allIssues, filters);
    countEl.textContent = '(' + filtered.length + ')';

    if (filtered.length === 0) {
      var noData = allIssues.length === 0;
      list.innerHTML = '<div class="empty-problems"><span class="empty-problems-icon">' +
        (noData ? '✅' : '🔍') + '</span><p>' +
        (noData ? 'No problems detected yet. Drop some report files to begin analysis.' : 'No problems match the current filters.') +
        '</p></div>';
      return;
    }

    var severityIcons = { critical: '🔴', warning: '🟠', info: '🔵' };

    list.innerHTML = filtered.map(function(issue, idx) {
      return '<div class="problem-item" data-severity="' + issue.severity + '" data-idx="' + idx + '">' +
        '<div class="problem-item-header">' +
        '<span class="problem-severity">' + (severityIcons[issue.severity] || '🔵') + '</span>' +
        '<span class="problem-title">' + P.escapeHtml(issue.title) + '</span>' +
        '<span class="problem-category-tag">' + (CATEGORY_LABELS[issue.category] || issue.category) + '</span>' +
        '<span class="problem-expand-icon">▼</span></div>' +
        '<div class="problem-detail"><div class="problem-detail-inner">' +
        (issue.detail ? '<p class="problem-explanation">' + P.escapeHtml(issue.detail) + '</p>' : '') +
        (issue.raw ? '<pre class="problem-raw">' + P.escapeHtml(issue.raw) + '</pre>' : '') +
        (issue.recommendation ? '<div class="problem-recommendation"><strong>Recommendation:</strong> ' + P.escapeHtml(issue.recommendation) + '</div>' : '') +
        '</div></div></div>';
    }).join('');

    list.querySelectorAll('.problem-item-header').forEach(function(header) {
      header.addEventListener('click', function() {
        P.toggleProblemExpand(header.closest('.problem-item'));
      });
    });
  }

  function initFilters() {
    var searchInput = document.getElementById('search-input');
    var debounceTimer;
    searchInput.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        state.filters.search = searchInput.value.trim();
        renderProblems();
      }, 200);
    });

    document.querySelectorAll('[data-filter-category]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('[data-filter-category]').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        state.filters.category = btn.dataset.filterCategory;
        renderProblems();
      });
    });

    document.querySelectorAll('[data-filter-severity]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('[data-filter-severity]').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        state.filters.severity = btn.dataset.filterSeverity;
        renderProblems();
      });
    });
  }

  function initExport() {
    document.getElementById('export-btn').addEventListener('click', function() {
      if (!state.scores || state.parseResults.size === 0) {
        P.showToast('Nothing to export — drop some report files first', 'warning');
        return;
      }
      P.exportToFile(state.scores);
      P.showToast('Summary exported!', 'success');
    });
  }

  function initScriptDownloads() {
    var batBtn = document.getElementById('generate-bat-btn');
    var ps1Btn = document.getElementById('generate-ps1-btn');
    if (batBtn) batBtn.addEventListener('click', function() {
      P.downloadBatScript();
      P.showToast('Downloaded generate-health-reports.bat', 'success');
    });
    if (ps1Btn) ps1Btn.addEventListener('click', function() {
      handlePs1Download();
    });
  }

  function handlePs1Download() {
    var script = '# PC Health Checker - Report Generator (PowerShell)\n# Run as Administrator\n\n' +
      '$outDir = "$env:USERPROFILE\\Desktop\\PC-Health-Reports_$(Get-Date -Format yyyyMMdd_HHmm)"\n' +
      'New-Item -ItemType Directory -Path $outDir -Force | Out-Null\n\n' +
      'powercfg /batteryreport /output "$outDir\\battery-report.html" 2>$null\n' +
      'powercfg /energy /output "$outDir\\energy-report.html" 2>$null\n' +
      'powercfg /sleepstudy /output "$outDir\\sleep-study.html" 2>$null\n' +
      'msinfo32 /report "$outDir\\msinfo32.txt"\n' +
      'dxdiag /t "$outDir\\dxdiag.txt"\n' +
      'systeminfo > "$outDir\\systeminfo.txt"\n' +
      'driverquery /v /fo csv > "$outDir\\drivers.csv"\n' +
      'wmic diskdrive get model,size,status /format:csv > "$outDir\\disk-info.csv"\n' +
      'ipconfig /all > "$outDir\\network-config.txt"\n' +
      'wmic qfe list full /format:csv > "$outDir\\updates.csv"\n' +
      'wevtutil qe System /c:100 /f:xml /rd:true > "$outDir\\system-events.xml"\n' +
      'wmic startup get caption,command /format:csv > "$outDir\\startup.csv"\n' +
      'tasklist /v /fo csv > "$outDir\\processes.csv"\n\n' +
      'Write-Host "Done! Reports saved to: $outDir"\nRead-Host "Press Enter to exit"';
    P.downloadFile(script, 'generate-all-reports.ps1', 'text/plain');
    P.showToast('Downloaded generate-all-reports.ps1', 'success');
  }
})();
