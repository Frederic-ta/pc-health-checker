/* ================================================
   PC Health Checker — UI Module
   Theme toggle, onboarding, toasts, animations
   ================================================ */

// ---- Theme Toggle ----

const THEME_KEY = 'pchc-theme';

export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const theme = saved || 'dark';
  document.documentElement.setAttribute('data-theme', theme);

  const btn = document.getElementById('theme-toggle');
  btn.addEventListener('click', toggleTheme);
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
}

// ---- Onboarding ----

const ONBOARDING_KEY = 'pchc-onboarding-dismissed';

export function initOnboarding() {
  const dismissed = localStorage.getItem(ONBOARDING_KEY);
  if (dismissed === 'true') return;

  const overlay = document.getElementById('onboarding-overlay');
  const nextBtn = document.getElementById('onboarding-next');
  const skipBtn = document.getElementById('onboarding-skip');
  const dismissCheck = document.getElementById('onboarding-dismiss-check');

  overlay.classList.remove('hidden');

  let currentStep = 0;
  const steps = overlay.querySelectorAll('.onboarding-step');
  const dots = overlay.querySelectorAll('.onboarding-dot');
  const totalSteps = steps.length;

  function showStep(idx) {
    steps.forEach((s, i) => s.classList.toggle('hidden', i !== idx));
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    nextBtn.textContent = idx === totalSteps - 1 ? 'Get Started' : 'Next';
  }

  nextBtn.addEventListener('click', () => {
    if (currentStep < totalSteps - 1) {
      currentStep++;
      showStep(currentStep);
    } else {
      closeOnboarding();
    }
  });

  skipBtn.addEventListener('click', closeOnboarding);

  // Click dots to navigate
  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      currentStep = parseInt(dot.dataset.dot, 10);
      showStep(currentStep);
    });
  });

  function closeOnboarding() {
    if (dismissCheck.checked) {
      localStorage.setItem(ONBOARDING_KEY, 'true');
    }
    overlay.classList.add('hidden');
  }
}

// ---- Tab Switching ----

export function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      switchTab(tabId, tabButtons, tabContents);
    });
  });
}

export function switchTab(tabId, tabButtons, tabContents) {
  if (!tabButtons) tabButtons = document.querySelectorAll('.tab-btn');
  if (!tabContents) tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  tabContents.forEach(c => {
    const isTarget = c.id === `tab-${tabId}`;
    c.classList.toggle('active', isTarget);
    c.classList.toggle('hidden', !isTarget);
  });
}

// ---- Toast Notifications ----

const TOAST_DURATION = 4000;

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} type
 */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, TOAST_DURATION);
}

// ---- Drop Zone Visual Feedback ----

export function initDropZone(onFilesDropped) {
  const zone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  // Prevent default drag behaviors on the whole page
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
    document.body.addEventListener(evt, e => e.preventDefault());
  });

  zone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    // Only remove if leaving the zone entirely
    if (!zone.contains(e.relatedTarget)) {
      zone.classList.remove('drag-over');
    }
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && onFilesDropped) {
      onFilesDropped(files);
    }
  });

  // Click to browse
  zone.addEventListener('click', () => fileInput.click());

  // Keyboard accessibility
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files);
    if (files.length > 0 && onFilesDropped) {
      onFilesDropped(files);
    }
    fileInput.value = '';
  });
}

// ---- Copy to Clipboard ----

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard', 'success');
  } catch {
    // Fallback
    const textarea = document.createElement('textarea');
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

export function initCopyButtons() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-copy');
    if (btn && btn.dataset.copy) {
      copyToClipboard(btn.dataset.copy);
    }
  });
}

// ---- Score Ring Animation ----

const RING_CIRCUMFERENCE = 2 * Math.PI * 70; // r=70

/**
 * Animate the score ring to a given score.
 * @param {number} score 0-100
 */
export function animateScoreRing(score) {
  const ring = document.querySelector('.score-ring-fill');
  const numberEl = document.getElementById('score-number');
  const descEl = document.getElementById('score-description');

  if (score === null || score === undefined || isNaN(score)) {
    ring.style.strokeDashoffset = RING_CIRCUMFERENCE;
    ring.classList.remove('score-orange', 'score-red');
    numberEl.textContent = '—';
    numberEl.className = 'score-number';
    descEl.textContent = 'Drop report files above to calculate your PC health score';
    return;
  }

  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const offset = RING_CIRCUMFERENCE - (clamped / 100) * RING_CIRCUMFERENCE;

  ring.style.strokeDashoffset = offset;

  // Color class
  ring.classList.remove('score-orange', 'score-red');
  numberEl.classList.remove('score-green', 'score-orange', 'score-red');
  if (clamped >= 80) {
    numberEl.classList.add('score-green');
  } else if (clamped >= 50) {
    ring.classList.add('score-orange');
    numberEl.classList.add('score-orange');
  } else {
    ring.classList.add('score-red');
    numberEl.classList.add('score-red');
  }

  // Animate number counting up
  animateCounter(numberEl, clamped);

  // Description
  if (clamped >= 80) {
    descEl.textContent = 'Your PC is in good health!';
  } else if (clamped >= 50) {
    descEl.textContent = 'Some issues found — review the problems below.';
  } else {
    descEl.textContent = 'Significant problems detected — immediate attention recommended.';
  }
}

function animateCounter(el, target) {
  const duration = 800;
  const start = performance.now();
  const from = 0;

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(from + (target - from) * eased);
    el.textContent = current;
    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }
  requestAnimationFrame(tick);
}

// ---- Expandable Cards ----

export function initExpandableCards() {
  // This is wired in app.js when problems are rendered
  // We just expose the toggle helper
}

export function toggleProblemExpand(itemEl) {
  itemEl.classList.toggle('expanded');
}

// ---- HTML Escape Helper ----

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
