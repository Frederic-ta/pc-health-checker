// UI Module — Theme, onboarding, toasts, drop zone, animations

(function() {
  'use strict';
  window.PCHC = window.PCHC || {};

  // ---- Theme ----
  var THEME_KEY = 'pchc-theme';

  function initTheme() {
    var saved = localStorage.getItem(THEME_KEY);
    var theme = saved || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme');
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
  }

  // ---- Onboarding ----
  function initOnboarding() {
    if (localStorage.getItem('pchc-onboarding-dismissed') === 'true') return;
    var overlay = document.getElementById('onboarding-overlay');
    var nextBtn = document.getElementById('onboarding-next');
    var skipBtn = document.getElementById('onboarding-skip');
    var dismissCheck = document.getElementById('onboarding-dismiss-check');
    overlay.classList.remove('hidden');

    var currentStep = 0;
    var steps = overlay.querySelectorAll('.onboarding-step');
    var dots = overlay.querySelectorAll('.onboarding-dot');

    function showStep(idx) {
      steps.forEach(function(s, i) { s.classList.toggle('hidden', i !== idx); });
      dots.forEach(function(d, i) { d.classList.toggle('active', i === idx); });
      nextBtn.textContent = idx === steps.length - 1 ? 'Get Started' : 'Next';
    }

    nextBtn.addEventListener('click', function() {
      if (currentStep < steps.length - 1) { currentStep++; showStep(currentStep); }
      else { closeOnboarding(); }
    });
    skipBtn.addEventListener('click', closeOnboarding);
    dots.forEach(function(dot) {
      dot.addEventListener('click', function() {
        currentStep = parseInt(dot.dataset.dot, 10);
        showStep(currentStep);
      });
    });

    function closeOnboarding() {
      if (dismissCheck.checked) localStorage.setItem('pchc-onboarding-dismissed', 'true');
      overlay.classList.add('hidden');
    }
  }

  // ---- Tabs ----
  function initTabs() {
    var tabButtons = document.querySelectorAll('.tab-btn');
    var tabContents = document.querySelectorAll('.tab-content');
    tabButtons.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var tabId = btn.dataset.tab;
        tabButtons.forEach(function(b) { b.classList.toggle('active', b.dataset.tab === tabId); });
        tabContents.forEach(function(c) {
          var isTarget = c.id === 'tab-' + tabId;
          c.classList.toggle('active', isTarget);
          c.classList.toggle('hidden', !isTarget);
        });
      });
    });
  }

  // ---- Toast ----
  function showToast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    var icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = '<span class="toast-icon">' + (icons[type] || icons.info) + '</span><span>' + escapeHtml(message) + '</span>';
    container.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 4000);
  }

  // ---- Drop Zone ----
  function initDropZone(onFilesDropped) {
    var zone = document.getElementById('drop-zone');
    var fileInput = document.getElementById('file-input');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(function(evt) {
      document.body.addEventListener(evt, function(e) { e.preventDefault(); });
    });

    zone.addEventListener('dragenter', function(e) { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragover', function(e) { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', function(e) {
      e.preventDefault();
      if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
    });
    zone.addEventListener('drop', function(e) {
      e.preventDefault();
      zone.classList.remove('drag-over');
      var files = Array.from(e.dataTransfer.files);
      if (files.length > 0 && onFilesDropped) onFilesDropped(files);
    });
    zone.addEventListener('click', function() { fileInput.click(); });
    zone.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
    });
    fileInput.addEventListener('change', function() {
      var files = Array.from(fileInput.files);
      if (files.length > 0 && onFilesDropped) onFilesDropped(files);
      fileInput.value = '';
    });
  }

  // ---- Copy ----
  function copyToClipboard(text) {
    try {
      navigator.clipboard.writeText(text).then(function() {
        showToast('Copied to clipboard', 'success');
      });
    } catch(e) {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast('Copied to clipboard', 'success');
    }
  }

  function initCopyButtons() {
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('.btn-copy');
      if (btn && btn.dataset.copy) copyToClipboard(btn.dataset.copy);
    });
  }

  // ---- Score Ring ----
  var RING_CIRCUMFERENCE = 2 * Math.PI * 70;

  function animateScoreRing(score) {
    var ring = document.querySelector('.score-ring-fill');
    var numberEl = document.getElementById('score-number');
    var descEl = document.getElementById('score-description');

    if (score === null || score === undefined || isNaN(score)) {
      ring.style.strokeDashoffset = RING_CIRCUMFERENCE;
      numberEl.textContent = '—';
      numberEl.className = 'score-number';
      descEl.textContent = 'Drop report files above to calculate your PC health score';
      return;
    }

    var clamped = Math.max(0, Math.min(100, Math.round(score)));
    ring.style.strokeDashoffset = RING_CIRCUMFERENCE - (clamped / 100) * RING_CIRCUMFERENCE;

    ring.classList.remove('score-orange', 'score-red');
    numberEl.classList.remove('score-green', 'score-orange', 'score-red');
    if (clamped >= 80) { numberEl.classList.add('score-green'); }
    else if (clamped >= 50) { ring.classList.add('score-orange'); numberEl.classList.add('score-orange'); }
    else { ring.classList.add('score-red'); numberEl.classList.add('score-red'); }

    // Animate counter
    var duration = 800, start = performance.now();
    function tick(now) {
      var elapsed = now - start;
      var progress = Math.min(elapsed / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      numberEl.textContent = Math.round(clamped * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    if (clamped >= 80) descEl.textContent = 'Your PC is in good health!';
    else if (clamped >= 50) descEl.textContent = 'Some issues found — review the problems below.';
    else descEl.textContent = 'Significant problems detected — immediate attention recommended.';
  }

  function toggleProblemExpand(itemEl) {
    itemEl.classList.toggle('expanded');
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Expose
  window.PCHC.initTheme = initTheme;
  window.PCHC.initOnboarding = initOnboarding;
  window.PCHC.initTabs = initTabs;
  window.PCHC.initDropZone = initDropZone;
  window.PCHC.initCopyButtons = initCopyButtons;
  window.PCHC.showToast = showToast;
  window.PCHC.animateScoreRing = animateScoreRing;
  window.PCHC.toggleProblemExpand = toggleProblemExpand;
  window.PCHC.copyToClipboard = copyToClipboard;
  window.PCHC.escapeHtml = escapeHtml;
})();
