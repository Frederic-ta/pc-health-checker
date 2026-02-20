// PC Health Checker — Main Application Module

(function() {
  'use strict';
  var P = window.PCHC;

  var state = {
    parseResults: new Map(),
    scores: null,
    filters: { search: '', category: 'all', severity: 'all' },
    konamiProgress: 0
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

  // Report definitions for selective script generation
  var SCRIPT_REPORTS = [
    { id: 'battery', name: 'Battery Report', bat: 'powercfg /batteryreport /output "%OUTDIR%\\battery-report.html"', ps1: 'powercfg /batteryreport /output "$outDir\\battery-report.html" 2>$null', admin: true },
    { id: 'energy', name: 'Energy Report', bat: 'powercfg /energy /output "%OUTDIR%\\energy-report.html"', ps1: 'powercfg /energy /output "$outDir\\energy-report.html" 2>$null', admin: true },
    { id: 'sleep', name: 'Sleep Study', bat: 'powercfg /sleepstudy /output "%OUTDIR%\\sleep-study.html"', ps1: 'powercfg /sleepstudy /output "$outDir\\sleep-study.html" 2>$null', admin: true },
    { id: 'msinfo', name: 'MSInfo32 Report', bat: 'msinfo32 /report "%OUTDIR%\\msinfo32.txt"', ps1: 'msinfo32 /report "$outDir\\msinfo32.txt"', admin: false },
    { id: 'dxdiag', name: 'DxDiag Report', bat: 'dxdiag /t "%OUTDIR%\\dxdiag.txt"', ps1: 'dxdiag /t "$outDir\\dxdiag.txt"\nStart-Sleep -Seconds 10', admin: false },
    { id: 'sysinfo', name: 'System Info', bat: 'systeminfo > "%OUTDIR%\\systeminfo.txt"', ps1: 'systeminfo > "$outDir\\systeminfo.txt"', admin: false },
    { id: 'drivers', name: 'Driver Query', bat: 'driverquery /v /fo csv > "%OUTDIR%\\driverquery.csv"', ps1: 'driverquery /v /fo csv > "$outDir\\drivers.csv"', admin: false },
    { id: 'disk', name: 'Disk Info', bat: 'wmic diskdrive get model,size,status /format:csv > "%OUTDIR%\\disk-info.csv"', ps1: 'wmic diskdrive get model,size,status /format:csv > "$outDir\\disk-info.csv"', admin: false },
    { id: 'volume', name: 'Volume Info', bat: 'wmic volume get caption,capacity,freespace /format:csv > "%OUTDIR%\\volume-info.csv"', ps1: 'wmic volume get caption,capacity,freespace /format:csv > "$outDir\\volume-info.csv"', admin: false },
    { id: 'wifi', name: 'WiFi Report', bat: 'netsh wlan show wlanreport & copy "%ProgramData%\\Microsoft\\Windows\\WlanReport\\wlan-report-latest.html" "%OUTDIR%\\wifi-report.html"', ps1: 'netsh wlan show wlanreport 2>$null\nCopy-Item "$env:ProgramData\\Microsoft\\Windows\\WlanReport\\wlan-report-latest.html" "$outDir\\wifi-report.html" -ErrorAction SilentlyContinue', admin: true },
    { id: 'network', name: 'Network Config', bat: 'ipconfig /all > "%OUTDIR%\\ipconfig.txt"', ps1: 'ipconfig /all > "$outDir\\network-config.txt"', admin: false },
    { id: 'updates', name: 'Installed Updates', bat: 'wmic qfe list full /format:csv > "%OUTDIR%\\updates.csv"', ps1: 'wmic qfe list full /format:csv > "$outDir\\updates.csv"', admin: false },
    { id: 'events', name: 'System Events', bat: 'wevtutil qe System /c:100 /f:xml /rd:true > "%OUTDIR%\\system-events.xml"', ps1: 'wevtutil qe System /c:100 /f:xml /rd:true > "$outDir\\system-events.xml"', admin: true },
    { id: 'startup', name: 'Startup Programs', bat: 'wmic startup get caption,command /format:csv > "%OUTDIR%\\startup.csv"', ps1: 'wmic startup get caption,command /format:csv > "$outDir\\startup.csv"', admin: false },
    { id: 'processes', name: 'Running Processes', bat: 'tasklist /v /fo csv > "%OUTDIR%\\tasklist.csv"', ps1: 'tasklist /v /fo csv > "$outDir\\processes.csv"', admin: false }
  ];

  document.addEventListener('DOMContentLoaded', function() {
    P.initTheme();
    P.initOnboarding();
    P.initTabs();
    P.initCopyButtons();
    P.initDropZone(handleFilesDropped);
    initFilters();
    initExport();
    initReset();
    initReportCheckboxes();
    initScriptDownloads();
    initEasterEgg();
    renderCategoryCards();
    renderProblems();
    P.animateScoreRing(null);
  });

  // ---- Reset ----
  function initReset() {
    document.getElementById('reset-btn').addEventListener('click', function() {
      if (state.parseResults.size === 0) {
        P.showToast('Nothing to reset', 'info');
        return;
      }
      state.parseResults.clear();
      state.scores = null;
      render();
      P.showToast('All reports cleared!', 'success');
    });
  }

  // ---- Report Checkboxes ----
  function initReportCheckboxes() {
    // Add checkboxes to each report card
    var cards = document.querySelectorAll('.report-command-card');
    cards.forEach(function(card, idx) {
      if (idx < SCRIPT_REPORTS.length) {
        var header = card.querySelector('.command-card-header');
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = true;
        cb.className = 'report-checkbox';
        cb.dataset.reportIdx = idx;
        cb.title = 'Include in script download';
        header.insertBefore(cb, header.firstChild);
      }
    });

    // Select All button
    var selectAllBtn = document.getElementById('select-all-reports');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', function() {
        var checkboxes = document.querySelectorAll('.report-checkbox');
        var allChecked = Array.from(checkboxes).every(function(cb) { return cb.checked; });
        checkboxes.forEach(function(cb) { cb.checked = !allChecked; });
        selectAllBtn.textContent = allChecked ? '☑️ Select All' : '☐ Deselect All';
      });
    }
  }

  function getSelectedReports() {
    var selected = [];
    document.querySelectorAll('.report-checkbox').forEach(function(cb) {
      if (cb.checked) {
        var idx = parseInt(cb.dataset.reportIdx, 10);
        if (SCRIPT_REPORTS[idx]) selected.push(SCRIPT_REPORTS[idx]);
      }
    });
    return selected;
  }

  // ---- File Drop ----
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

  // ---- Script Downloads (selective) ----
  function initScriptDownloads() {
    var batBtn = document.getElementById('generate-bat-btn');
    var ps1Btn = document.getElementById('generate-ps1-btn');

    if (batBtn) batBtn.addEventListener('click', function() {
      var selected = getSelectedReports();
      if (selected.length === 0) {
        P.showToast('Select at least one report to include!', 'warning');
        return;
      }
      downloadSelectedBat(selected);
      P.showToast('Downloaded .bat with ' + selected.length + ' report' + (selected.length > 1 ? 's' : ''), 'success');
    });

    if (ps1Btn) ps1Btn.addEventListener('click', function() {
      var selected = getSelectedReports();
      if (selected.length === 0) {
        P.showToast('Select at least one report to include!', 'warning');
        return;
      }
      downloadSelectedPs1(selected);
      P.showToast('Downloaded .ps1 with ' + selected.length + ' report' + (selected.length > 1 ? 's' : ''), 'success');
    });
  }

  function downloadSelectedBat(reports) {
    var lines = [
      '@echo off',
      'echo ================================================',
      'echo   PC Health Checker - Report Generator',
      'echo   Run as Administrator for best results',
      'echo ================================================',
      'echo.',
      '',
      'set TIMESTAMP=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%',
      'set TIMESTAMP=%TIMESTAMP: =0%',
      'set OUTDIR=%USERPROFILE%\\Desktop\\PC-Health-Reports_%TIMESTAMP%',
      'mkdir "%OUTDIR%"',
      'echo Output folder: %OUTDIR%',
      'echo.', ''
    ];
    reports.forEach(function(r, i) {
      var note = r.admin ? ' (may require admin)' : '';
      lines.push('echo [' + (i + 1) + '/' + reports.length + '] ' + r.name + '...' + note);
      lines.push(r.bat + ' 2>nul');
      lines.push('');
    });
    lines.push('echo.', 'echo Done! Reports saved to: %OUTDIR%', 'pause');
    P.downloadFile(lines.join('\r\n'), 'generate-health-reports.bat', 'application/bat');
  }

  function downloadSelectedPs1(reports) {
    var lines = [
      '# PC Health Checker - Report Generator (PowerShell)',
      '# Run as Administrator for best results',
      '',
      '$outDir = "$env:USERPROFILE\\Desktop\\PC-Health-Reports_$(Get-Date -Format yyyyMMdd_HHmm)"',
      'New-Item -ItemType Directory -Path $outDir -Force | Out-Null',
      ''
    ];
    reports.forEach(function(r, i) {
      lines.push('Write-Host "[' + (i + 1) + '/' + reports.length + '] ' + r.name + '..."');
      lines.push(r.ps1);
      lines.push('');
    });
    lines.push('Write-Host "Done! Reports saved to: $outDir"');
    lines.push('Read-Host "Press Enter to exit"');
    P.downloadFile(lines.join('\n'), 'generate-all-reports.ps1', 'text/plain');
  }

  // ---- Easter Egg: Konami Code ----
  function initEasterEgg() {
    var konami = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65]; // ↑↑↓↓←→←→BA
    var progress = 0;

    document.addEventListener('keydown', function(e) {
      if (e.keyCode === konami[progress]) {
        progress++;
        if (progress === konami.length) {
          progress = 0;
          activateEasterEgg();
        }
      } else {
        progress = 0;
      }
    });

    // Secret: click the title icon 5 times fast
    var titleClicks = 0;
    var titleTimer = null;
    var titleIcon = document.querySelector('.title-icon');
    if (titleIcon) {
      titleIcon.style.cursor = 'pointer';
      titleIcon.addEventListener('click', function(e) {
        e.stopPropagation();
        titleClicks++;
        clearTimeout(titleTimer);
        titleTimer = setTimeout(function() { titleClicks = 0; }, 2000);
        if (titleClicks >= 5) {
          titleClicks = 0;
          activateEasterEgg();
        }
      });
    }
  }

  function activateEasterEgg() {
    // Matrix rain effect
    var canvas = document.createElement('canvas');
    canvas.id = 'matrix-canvas';
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;pointer-events:none;opacity:0.85;';
    document.body.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    var chars = '01アイウエオカキクケコサシスセソPCHEALTH🏥💻⚡🔧'.split('');
    var fontSize = 14;
    var columns = Math.floor(canvas.width / fontSize);
    var drops = [];
    for (var i = 0; i < columns; i++) drops[i] = Math.random() * -100;

    var frameCount = 0;
    var maxFrames = 180; // ~3 seconds at 60fps

    function draw() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#0f0';
      ctx.font = fontSize + 'px monospace';

      for (var j = 0; j < drops.length; j++) {
        var text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, j * fontSize, drops[j] * fontSize);
        if (drops[j] * fontSize > canvas.height && Math.random() > 0.975) drops[j] = 0;
        drops[j]++;
      }

      frameCount++;
      if (frameCount < maxFrames) {
        requestAnimationFrame(draw);
      } else {
        // Fade out
        canvas.style.transition = 'opacity 1s';
        canvas.style.opacity = '0';
        setTimeout(function() { canvas.remove(); }, 1000);
      }
    }

    draw();

    // Show secret message
    P.showToast('🐱 Achievement Unlocked: You found the secret! Your PC thanks you.', 'success');

    // Bonus: temporarily change the title
    var titleEl = document.querySelector('.app-title');
    var originalTitle = titleEl.innerHTML;
    titleEl.innerHTML = '<span class="title-icon">🐱</span> PC Health Checker <small style="font-size:0.5em;opacity:0.7">// built with love by KatKat & Kuro</small>';
    setTimeout(function() { titleEl.innerHTML = originalTitle; }, 8000);
  }
})();
