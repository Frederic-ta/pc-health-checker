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
    initOsToggle();
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
    renderLoadedFiles();
    renderKeyInfo();
    renderCategoryCards();
    renderProblems();
    P.animateScoreRing(state.scores ? state.scores.globalScore : null);
  }

  // ---- Loaded Files List ----
  function renderLoadedFiles() {
    var section = document.getElementById('loaded-files-section');
    var list = document.getElementById('loaded-files-list');
    var countEl = document.getElementById('loaded-files-count');

    if (state.parseResults.size === 0) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    countEl.textContent = '(' + state.parseResults.size + ')';

    list.innerHTML = '';
    state.parseResults.forEach(function(parsed, filename) {
      var chip = document.createElement('span');
      chip.className = 'loaded-file-chip';
      chip.innerHTML = '<span class="chip-type">' + P.escapeHtml(parsed.parser.name) + '</span>' +
        '<span class="chip-name">' + P.escapeHtml(filename) + '</span>' +
        '<button class="chip-remove" title="Remove this file">✕</button>';
      chip.querySelector('.chip-remove').addEventListener('click', function() {
        state.parseResults.delete(filename);
        recalculate();
        render();
        P.showToast('Removed "' + filename + '"', 'info');
      });
      list.appendChild(chip);
    });
  }

  // ---- Key Info Panels ----
  function renderKeyInfo() {
    var section = document.getElementById('key-info-section');
    var grid = document.getElementById('key-info-grid');

    if (state.parseResults.size === 0) {
      section.classList.add('hidden');
      return;
    }

    var cards = [];
    var allResults = Array.from(state.parseResults.values());

    // Collect summaries by parser name
    var summaries = {};
    allResults.forEach(function(r) {
      summaries[r.parser.name] = r.result.summary;
    });

    // Battery info
    var bat = summaries['Battery Report'];
    if (bat) {
      var rows = [];
      if (bat.designCapacity) rows.push({ label: 'Design Capacity', value: formatMWh(bat.designCapacity) });
      if (bat.fullChargeCapacity) rows.push({ label: 'Full Charge Capacity', value: formatMWh(bat.fullChargeCapacity) });
      if (bat.healthPercent) {
        var cls = bat.healthPercent >= 80 ? 'good' : bat.healthPercent >= 50 ? 'warn' : 'bad';
        rows.push({ label: 'Battery Health', value: bat.healthPercent + '%', cls: cls });
      }
      if (bat.cycleCount !== null && bat.cycleCount !== undefined) {
        var ccCls = bat.cycleCount > 1000 ? 'bad' : bat.cycleCount > 500 ? 'warn' : 'good';
        rows.push({ label: 'Cycle Count', value: bat.cycleCount.toString(), cls: ccCls });
      }
      if (bat.avgDrainRate) rows.push({ label: 'Avg Drain Rate', value: (bat.avgDrainRate / 1000).toFixed(1) + ' W' });
      if (rows.length > 0) cards.push({ title: '🔋 Battery', rows: rows });
    }

    // Energy report
    var energy = summaries['Energy Report'];
    if (energy) {
      var rows = [];
      if (energy.errors !== undefined) rows.push({ label: 'Errors', value: energy.errors.toString(), cls: energy.errors > 0 ? 'bad' : 'good' });
      if (energy.warnings !== undefined) rows.push({ label: 'Warnings', value: energy.warnings.toString(), cls: energy.warnings > 5 ? 'warn' : 'good' });
      if (energy.informational !== undefined) rows.push({ label: 'Informational', value: energy.informational.toString() });
      if (rows.length > 0) cards.push({ title: '⚡ Energy Efficiency', rows: rows });
    }

    // MSInfo / System info
    var sys = summaries['MSInfo32'] || summaries['MSInfo32 Report'];
    if (sys) {
      var rows = [];
      if (sys.manufacturer || sys.model) rows.push({ label: 'Machine', value: ((sys.manufacturer || '') + ' ' + (sys.model || '')).trim() });
      if (sys.osName) rows.push({ label: 'OS', value: sys.osName });
      if (sys.cpu) rows.push({ label: 'CPU', value: truncate(sys.cpu, 40) });
      if (sys.totalRam) rows.push({ label: 'Total RAM', value: sys.totalRam });
      if (sys.availableRam) rows.push({ label: 'Available RAM', value: sys.availableRam });
      if (sys.ramUsedPercent) {
        var rCls = sys.ramUsedPercent > 90 ? 'bad' : sys.ramUsedPercent > 75 ? 'warn' : 'good';
        rows.push({ label: 'RAM Used', value: sys.ramUsedPercent + '%', cls: rCls });
      }
      if (sys.gpu) rows.push({ label: 'GPU', value: truncate(sys.gpu, 40) });
      if (rows.length > 0) cards.push({ title: '💻 System', rows: rows });
    }

    // DxDiag
    var dx = summaries['DxDiag'];
    if (dx && !sys) {
      var rows = [];
      if (dx.os) rows.push({ label: 'OS', value: dx.os });
      if (dx.cpu) rows.push({ label: 'CPU', value: truncate(dx.cpu, 40) });
      if (dx.ram) rows.push({ label: 'RAM', value: dx.ram });
      if (dx.gpuName) rows.push({ label: 'GPU', value: truncate(dx.gpuName, 40) });
      if (dx.vram) rows.push({ label: 'VRAM', value: dx.vram });
      if (dx.directXVersion) rows.push({ label: 'DirectX', value: dx.directXVersion });
      if (dx.driverVersion) rows.push({ label: 'GPU Driver', value: dx.driverVersion });
      if (dx.driverDate) rows.push({ label: 'Driver Date', value: dx.driverDate });
      if (rows.length > 0) cards.push({ title: '🎮 Graphics', rows: rows });
    } else if (dx && sys) {
      // Add GPU-specific info as separate card
      var rows = [];
      if (dx.gpuName) rows.push({ label: 'GPU', value: truncate(dx.gpuName, 40) });
      if (dx.vram) rows.push({ label: 'VRAM', value: dx.vram });
      if (dx.directXVersion) rows.push({ label: 'DirectX', value: dx.directXVersion });
      if (dx.driverVersion) rows.push({ label: 'Driver Version', value: dx.driverVersion });
      if (dx.driverDate) rows.push({ label: 'Driver Date', value: dx.driverDate });
      if (rows.length > 0) cards.push({ title: '🎮 Graphics', rows: rows });
    }

    // Drivers
    var drv = summaries['Driver Query'];
    if (drv) {
      var rows = [];
      if (drv.totalDrivers) rows.push({ label: 'Total Drivers', value: drv.totalDrivers.toString() });
      if (drv.outdatedDrivers !== undefined) {
        var dCls = drv.outdatedDrivers > 5 ? 'warn' : 'good';
        rows.push({ label: 'Outdated Drivers', value: drv.outdatedDrivers.toString(), cls: dCls });
      }
      if (rows.length > 0) cards.push({ title: '🔧 Drivers', rows: rows });
    }

    // Disk
    var disk = summaries['Disk Info'];
    if (disk) {
      var rows = [];
      if (disk.diskCount) rows.push({ label: 'Drives Found', value: disk.diskCount.toString() });
      if (disk.disks) {
        disk.disks.forEach(function(d) {
          var size = d.sizeGB ? d.sizeGB + ' GB' : 'Unknown size';
          rows.push({ label: d.model || 'Disk', value: size });
        });
      }
      if (disk.volumeCount) rows.push({ label: 'Volumes', value: disk.volumeCount.toString() });
      if (disk.volumes) {
        disk.volumes.forEach(function(v) {
          if (v.caption && v.freePercent !== undefined) {
            var vCls = v.freePercent < 10 ? 'bad' : v.freePercent < 20 ? 'warn' : 'good';
            rows.push({ label: v.caption, value: v.freePercent + '% free', cls: vCls });
          }
        });
      }
      if (rows.length > 0) cards.push({ title: '💾 Storage', rows: rows });
    }

    // Network
    var net = summaries['Network Config'];
    if (net) {
      var rows = [];
      if (net.adapters) {
        net.adapters.forEach(function(a) {
          if (a.name && a.ip) rows.push({ label: truncate(a.name, 25), value: a.ip });
        });
      }
      if (net.dns) rows.push({ label: 'DNS', value: net.dns });
      if (rows.length > 0) cards.push({ title: '🌐 Network', rows: rows });
    }

    // Events
    var evt = summaries['System Events'];
    if (evt) {
      var rows = [];
      if (evt.totalEvents !== undefined) rows.push({ label: 'Events Analyzed', value: evt.totalEvents.toString() });
      if (evt.critical !== undefined) rows.push({ label: 'Critical', value: evt.critical.toString(), cls: evt.critical > 0 ? 'bad' : 'good' });
      if (evt.errors !== undefined) rows.push({ label: 'Errors', value: evt.errors.toString(), cls: evt.errors > 10 ? 'warn' : 'good' });
      if (evt.warnings !== undefined) rows.push({ label: 'Warnings', value: evt.warnings.toString() });
      if (rows.length > 0) cards.push({ title: '📝 Event Log', rows: rows });
    }

    // Updates
    var upd = summaries['Installed Updates'];
    if (upd) {
      var rows = [];
      if (upd.totalUpdates !== undefined) rows.push({ label: 'Total Updates', value: upd.totalUpdates.toString() });
      if (upd.latestUpdate) rows.push({ label: 'Most Recent', value: upd.latestUpdate });
      if (upd.daysSinceLastUpdate !== undefined) {
        var uCls = upd.daysSinceLastUpdate > 90 ? 'bad' : upd.daysSinceLastUpdate > 30 ? 'warn' : 'good';
        rows.push({ label: 'Days Since Update', value: upd.daysSinceLastUpdate.toString(), cls: uCls });
      }
      if (rows.length > 0) cards.push({ title: '🛡️ Updates', rows: rows });
    }

    // Startup
    var startup = summaries['Startup Programs'];
    if (startup) {
      var rows = [];
      if (startup.totalPrograms !== undefined) {
        var sCls = startup.totalPrograms > 15 ? 'warn' : 'good';
        rows.push({ label: 'Startup Programs', value: startup.totalPrograms.toString(), cls: sCls });
      }
      if (rows.length > 0) cards.push({ title: '🚀 Startup', rows: rows });
    }

    // Processes
    var proc = summaries['Running Processes'];
    if (proc) {
      var rows = [];
      if (proc.totalProcesses !== undefined) rows.push({ label: 'Running Processes', value: proc.totalProcesses.toString() });
      if (proc.highMemoryProcesses !== undefined && proc.highMemoryProcesses > 0) {
        rows.push({ label: 'High Memory Processes', value: proc.highMemoryProcesses.toString(), cls: 'warn' });
      }
      if (rows.length > 0) cards.push({ title: '⚙️ Processes', rows: rows });
    }

    if (cards.length === 0) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    grid.innerHTML = cards.map(function(card) {
      return '<div class="key-info-card"><h4>' + card.title + '</h4><div class="info-rows">' +
        card.rows.map(function(row) {
          var valClass = row.cls ? ' ' + row.cls : '';
          return '<div class="info-row"><span class="info-label">' + P.escapeHtml(row.label) +
            '</span><span class="info-value' + valClass + '">' + P.escapeHtml(row.value) + '</span></div>';
        }).join('') + '</div></div>';
    }).join('');
  }

  function formatMWh(mwh) {
    if (mwh >= 1000) return (mwh / 1000).toFixed(1) + ' Wh';
    return mwh + ' mWh';
  }

  function truncate(str, max) {
    if (!str) return '';
    return str.length > max ? str.substring(0, max - 1) + '…' : str;
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
    var fixTypeLabels = { fixable: 'Auto-fixable', manual: 'Manual fix', hardware: 'Hardware' };
    var fixTypeIcons = { fixable: '🔧', manual: '📖', hardware: '🔩' };

    list.innerHTML = filtered.map(function(issue, idx) {
      // Get remediation info if available
      var remediation = P.getRemediation ? P.getRemediation(issue) : null;
      var badgeHtml = '';
      var remediationHtml = '';

      if (remediation) {
        badgeHtml = '<span class="fix-badge ' + remediation.fixType + '">' +
          (fixTypeIcons[remediation.fixType] || '') + ' ' +
          (fixTypeLabels[remediation.fixType] || remediation.fixType) + '</span>';

        var cmdHtml = '';
        if (remediation.command) {
          cmdHtml = '<button class="btn-copy-cmd" data-copy-cmd="' + P.escapeHtml(remediation.command) + '" title="Copy command to clipboard">' +
            '<span class="cmd-icon">📋</span> ' + P.escapeHtml(remediation.command) + '</button>';
        }

        remediationHtml = '<div class="remediation-section">' +
          badgeHtml +
          cmdHtml +
          '<p class="remediation-guide">' + P.escapeHtml(remediation.guide) + '</p>' +
          '</div>';
      }

      return '<div class="problem-item" data-severity="' + issue.severity + '" data-idx="' + idx + '">' +
        '<div class="problem-item-header">' +
        '<span class="problem-severity">' + (severityIcons[issue.severity] || '🔵') + '</span>' +
        '<span class="problem-title">' + P.escapeHtml(issue.title) + '</span>' +
        (remediation ? '<span class="fix-badge ' + remediation.fixType + '">' + (fixTypeIcons[remediation.fixType] || '') + ' ' + (fixTypeLabels[remediation.fixType] || '') + '</span>' : '') +
        '<span class="problem-category-tag">' + (CATEGORY_LABELS[issue.category] || issue.category) + '</span>' +
        '<span class="problem-expand-icon">▼</span></div>' +
        '<div class="problem-detail"><div class="problem-detail-inner">' +
        (issue.detail ? '<p class="problem-explanation">' + P.escapeHtml(issue.detail) + '</p>' : '') +
        (issue.raw ? '<pre class="problem-raw">' + P.escapeHtml(issue.raw) + '</pre>' : '') +
        (issue.recommendation ? '<div class="problem-recommendation"><strong>Recommendation:</strong> ' + P.escapeHtml(issue.recommendation) + '</div>' : '') +
        remediationHtml +
        '</div></div></div>';
    }).join('');

    list.querySelectorAll('.problem-item-header').forEach(function(header) {
      header.addEventListener('click', function() {
        P.toggleProblemExpand(header.closest('.problem-item'));
      });
    });

    // Copy command buttons in remediation sections
    list.querySelectorAll('.btn-copy-cmd').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var cmd = btn.dataset.copyCmd;
        if (cmd && navigator.clipboard) {
          navigator.clipboard.writeText(cmd).then(function() {
            P.showToast('Command copied!', 'success');
          });
        }
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

  // ---- OS Toggle ----
  function initOsToggle() {
    var toggleBtns = document.querySelectorAll('.os-toggle-btn');
    if (!toggleBtns.length) return;

    // Default to 'auto' which shows all
    document.body.dataset.osFilter = 'auto';

    toggleBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        toggleBtns.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        document.body.dataset.osFilter = btn.dataset.os;
      });
    });
  }

  // ---- Script Downloads (selective) ----
  function initScriptDownloads() {
    var batBtn = document.getElementById('generate-bat-btn');
    var ps1Btn = document.getElementById('generate-ps1-btn');
    var shBtn = document.getElementById('generate-sh-btn');

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

    if (shBtn) shBtn.addEventListener('click', function() {
      if (P.downloadShScript) {
        P.downloadShScript();
        P.showToast('Downloaded Linux .sh script', 'success');
      }
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
