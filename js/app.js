/* ================================================
   PC Health Checker — Main Application Module
   Tab routing, file handling, state, rendering
   ================================================ */

import {
  initTheme,
  initOnboarding,
  initTabs,
  initDropZone,
  initCopyButtons,
  showToast,
  animateScoreRing,
  toggleProblemExpand,
  copyToClipboard,
  escapeHtml,
} from './ui.js';

import { detectAndParse } from './parsers/index.js';
import { calculateScores } from './scoring.js';
import { filterIssues } from './search.js';
import { exportToFile, downloadFile as downloadAsFile } from './export.js';
import { downloadBatScript } from './generator.js';

// ---- App State ----

const state = {
  /** @type {Map<string, { parser: { name: string, category: string }, result: { summary: object, score: number, issues: Array } }>} */
  parseResults: new Map(),

  /** Output of calculateScores() — null when no reports loaded */
  scores: null,

  /** Active filters */
  filters: {
    search: '',
    category: 'all',
    severity: 'all',
  },
};

const CATEGORY_LABELS = {
  power: '⚡ Power & Battery',
  system: '💻 System & Hardware',
  storage: '💾 Storage',
  network: '🌐 Network',
  security: '🛡️ Security',
  performance: '🚀 Performance',
};

const DEFAULT_SUMMARIES = {
  power: 'No data — drop a battery report, energy report, or sleep study',
  system: 'No data — drop an MSInfo32, DxDiag, or SystemInfo report',
  storage: 'No data — drop disk health or volume info reports',
  network: 'No data — drop a WiFi report or network config',
  security: 'No data — drop update history, event logs, or SFC results',
  performance: 'No data — drop a perfmon report, startup list, or process list',
};

// ---- Initialization ----

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initOnboarding();
  initTabs();
  initCopyButtons();
  initDropZone(handleFilesDropped);
  initFilters();
  initExport();
  initScriptDownloads();

  // Initial render (empty state)
  renderCategoryCards();
  renderProblems();
  animateScoreRing(null);
});

// ---- File Drop Handler ----

async function handleFilesDropped(files) {
  let parsedCount = 0;

  for (const file of files) {
    try {
      const content = await readFileContent(file);
      const parsed = detectAndParse(file.name, content);

      if (parsed) {
        state.parseResults.set(file.name, parsed);
        parsedCount++;
        showToast(`Parsed "${file.name}" as ${parsed.parser.name}`, 'success');
      } else {
        showToast(`Could not identify report type for "${file.name}"`, 'warning');
      }
    } catch (err) {
      showToast(`Failed to read "${file.name}": ${err.message}`, 'error');
    }
  }

  if (parsedCount > 0) {
    recalculate();
    render();
  }
}

function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsText(file);
  });
}

// ---- State & Score Computation ----

function recalculate() {
  if (state.parseResults.size > 0) {
    state.scores = calculateScores([...state.parseResults.values()]);
  } else {
    state.scores = null;
  }
}

export function clearReports() {
  state.parseResults.clear();
  recalculate();
  render();
}

// ---- Rendering ----

function render() {
  renderCategoryCards();
  renderProblems();
  animateScoreRing(state.scores ? state.scores.globalScore : null);
}

function renderCategoryCards() {
  const grid = document.getElementById('category-grid');
  const cards = grid.querySelectorAll('.category-card');

  cards.forEach(card => {
    const cat = card.dataset.category;
    const catData = state.scores?.categoryScores?.[cat];
    const score = catData?.score ?? null;
    const scoreEl = card.querySelector('.card-score');
    const summaryEl = card.querySelector('.card-summary');
    const emptyState = card.querySelector('.card-empty-state');

    const issueCounts = catData?.issueCounts ?? { critical: 0, warning: 0, info: 0 };

    card.querySelector('.critical-count').textContent = `🔴 ${issueCounts.critical}`;
    card.querySelector('.warning-count').textContent = `🟠 ${issueCounts.warning}`;
    card.querySelector('.info-count').textContent = `🔵 ${issueCounts.info}`;

    if (catData?.hasData) {
      scoreEl.textContent = score;
      card.classList.add('has-data');
      card.classList.remove('no-data');
      emptyState.classList.add('hidden');

      if (score >= 80) scoreEl.dataset.score = 'green';
      else if (score >= 50) scoreEl.dataset.score = 'orange';
      else scoreEl.dataset.score = 'red';

      const total = issueCounts.critical + issueCounts.warning + issueCounts.info;
      summaryEl.textContent = total > 0
        ? `${total} issue${total > 1 ? 's' : ''} found`
        : 'Looking good — no issues detected';
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
  const list = document.getElementById('problems-list');
  const countEl = document.getElementById('problems-count');

  const allIssues = state.scores?.allIssues ?? [];
  const filtered = getFilteredIssues(allIssues);
  countEl.textContent = `(${filtered.length})`;

  if (filtered.length === 0) {
    const noData = allIssues.length === 0;
    list.innerHTML = `
      <div class="empty-problems">
        <span class="empty-problems-icon">${noData ? '✅' : '🔍'}</span>
        <p>${noData
          ? 'No problems detected yet. Drop some report files to begin analysis.'
          : 'No problems match the current filters.'
        }</p>
      </div>
    `;
    return;
  }

  const severityIcons = { critical: '🔴', warning: '🟠', info: '🔵' };

  list.innerHTML = filtered.map((issue, idx) => `
    <div class="problem-item" data-severity="${issue.severity}" data-idx="${idx}">
      <div class="problem-item-header">
        <span class="problem-severity">${severityIcons[issue.severity] || '🔵'}</span>
        <span class="problem-title">${escapeHtml(issue.title)}</span>
        <span class="problem-category-tag">${CATEGORY_LABELS[issue.category] || issue.category}</span>
        <span class="problem-expand-icon">▼</span>
      </div>
      <div class="problem-detail">
        <div class="problem-detail-inner">
          ${issue.detail ? `<p class="problem-explanation">${escapeHtml(issue.detail)}</p>` : ''}
          ${issue.raw ? `<pre class="problem-raw">${escapeHtml(issue.raw)}</pre>` : ''}
          ${issue.recommendation ? `
            <div class="problem-recommendation">
              <strong>Recommendation:</strong> ${escapeHtml(issue.recommendation)}
            </div>
          ` : ''}
          <div class="problem-actions">
            <button class="btn btn-copy btn-copy-issue" title="Copy issue details">📋 Copy</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  // Bind expand/collapse
  list.querySelectorAll('.problem-item-header').forEach(header => {
    header.addEventListener('click', () => {
      toggleProblemExpand(header.closest('.problem-item'));
    });
  });

  // Bind copy buttons on issue details
  list.querySelectorAll('.btn-copy-issue').forEach((btn, idx) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const issue = filtered[idx];
      const text = `[${issue.severity.toUpperCase()}] ${issue.title}\n${issue.detail || ''}\n${issue.recommendation ? 'Recommendation: ' + issue.recommendation : ''}`;
      copyToClipboard(text.trim());
    });
  });
}

function getFilteredIssues(allIssues) {
  const filters = {};

  if (state.filters.category !== 'all') {
    filters.categories = [state.filters.category];
  }

  if (state.filters.severity !== 'all') {
    filters.severities = [state.filters.severity];
  }

  if (state.filters.search) {
    filters.query = state.filters.search;
  }

  return filterIssues(allIssues, filters);
}

// ---- Search & Filters ----

function initFilters() {
  const searchInput = document.getElementById('search-input');
  let debounceTimer;

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.filters.search = searchInput.value.trim();
      renderProblems();
    }, 200);
  });

  // Category filter buttons
  document.querySelectorAll('[data-filter-category]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter-category]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filters.category = btn.dataset.filterCategory;
      renderProblems();
    });
  });

  // Severity filter buttons
  document.querySelectorAll('[data-filter-severity]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter-severity]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filters.severity = btn.dataset.filterSeverity;
      renderProblems();
    });
  });
}

// ---- Export ----

function initExport() {
  const exportBtn = document.getElementById('export-btn');
  exportBtn.addEventListener('click', handleExport);
}

function handleExport() {
  if (!state.scores || state.parseResults.size === 0) {
    showToast('Nothing to export — drop some report files first', 'warning');
    return;
  }

  exportToFile(state.scores);
  showToast('Summary exported!', 'success');
}

// ---- Script Download (Generate All) ----

function initScriptDownloads() {
  document.getElementById('generate-bat-btn')?.addEventListener('click', () => {
    downloadBatScript();
    showToast('Downloaded generate-health-reports.bat', 'success');
  });
  document.getElementById('generate-ps1-btn')?.addEventListener('click', handlePs1Download);
}

function handlePs1Download() {
  const script = `# PC Health Checker - Report Generator (PowerShell)
# Run as Administrator for best results

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  PC Health Checker - Report Generator" -ForegroundColor Cyan
Write-Host "  Run as Administrator for best results" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$timestamp = Get-Date -Format "yyyyMMdd_HHmm"
$outDir = "$env:USERPROFILE\\Desktop\\PC-Health-Reports_$timestamp"
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

Write-Host "[1/15] Generating Battery Report..."
powercfg /batteryreport /output "$outDir\\battery-report.html" 2>$null

Write-Host "[2/15] Generating Energy Report..."
powercfg /energy /output "$outDir\\energy-report.html" 2>$null

Write-Host "[3/15] Generating Sleep Study..."
powercfg /sleepstudy /output "$outDir\\sleep-study.html" 2>$null

Write-Host "[4/15] Exporting Power Schemes..."
powercfg /query > "$outDir\\power-schemes.txt" 2>$null

Write-Host "[5/15] Generating MSInfo32 Report..."
msinfo32 /report "$outDir\\msinfo32.txt"

Write-Host "[6/15] Generating DxDiag Report..."
dxdiag /t "$outDir\\dxdiag.txt"
Start-Sleep -Seconds 10

Write-Host "[7/15] Exporting System Info..."
systeminfo > "$outDir\\systeminfo.txt" 2>$null

Write-Host "[8/15] Exporting Driver Query..."
driverquery /v /fo csv > "$outDir\\drivers.csv" 2>$null

Write-Host "[9/15] Exporting Disk Info..."
wmic diskdrive get model,size,status /format:csv > "$outDir\\disk-info.csv" 2>$null

Write-Host "[10/15] Exporting Volume Info..."
wmic volume get caption,capacity,freespace /format:csv > "$outDir\\volume-info.csv" 2>$null

Write-Host "[11/15] Generating WiFi Report..."
netsh wlan show wlanreport 2>$null
Copy-Item "$env:ProgramData\\Microsoft\\Windows\\WlanReport\\wlan-report-latest.html" "$outDir\\wifi-report.html" -ErrorAction SilentlyContinue

Write-Host "[12/15] Exporting Network Config..."
ipconfig /all > "$outDir\\network-config.txt" 2>$null

Write-Host "[13/15] Exporting Installed Updates..."
wmic qfe list full /format:csv > "$outDir\\updates.csv" 2>$null

Write-Host "[14/15] Exporting System Events..."
wevtutil qe System /c:100 /f:xml /rd:true > "$outDir\\system-events.xml" 2>$null

Write-Host "[15/15] Exporting Startup Programs..."
wmic startup get caption,command /format:csv > "$outDir\\startup.csv" 2>$null

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Done! Reports saved to:" -ForegroundColor Green
Write-Host "  $outDir" -ForegroundColor Green
Write-Host "" -ForegroundColor Green
Write-Host "  Drag the folder into PC Health Checker" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Read-Host "Press Enter to exit"
`;

  downloadAsFile(script, 'generate-all-reports.ps1', 'text/plain');
  showToast('Downloaded generate-all-reports.ps1', 'success');
}
