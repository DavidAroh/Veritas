// Veritas Agent — Popup Script
// External JS required by Manifest V3 CSP (no inline scripts allowed)

const COLORS = {
  TRUE:       { bg: '#4ade8015', text: '#4ade80', border: '#4ade8040', icon: '✓' },
  MISLEADING: { bg: '#ffab4015', text: '#ffab40', border: '#ffab4040', icon: '⚠' },
  FALSE:      { bg: '#ff454515', text: '#ff4545', border: '#ff454540', icon: '✕' },
  UNVERIFIED: { bg: '#88888015', text: '#888880', border: '#88888040', icon: '?' },
};

const LABEL_COLORS = {
  'Verified':           '#4ade80',
  'Partially Verified': '#60a5fa',
  'Misleading':         '#ffab40',
  'Unverified':         '#888880',
  'False':              '#ff4545',
};

let activeTab = 'claims';
let currentResult = null;
let currentTabId = null;
let currentPageUrl = null;

function scoreColor(score) {
  if (score >= 75) return '#4ade80';
  if (score >= 45) return '#60a5fa';
  if (score >= 25) return '#ffab40';
  return '#ff4545';
}

function renderResult(result) {
  currentResult = result;
  setViewMoreVisible(true);
  const color = LABEL_COLORS[result.credibility_label] || '#888880';
  const sColor = scoreColor(result.credibility_score);
  const circumference = 2 * Math.PI * 28;
  const progress = (result.credibility_score / 100) * circumference;

  const pill = document.getElementById('status-pill');
  pill.textContent = result.credibility_label;
  pill.style.color = color;
  pill.style.borderColor = color + '40';
  pill.style.background = color + '10';

  const summary = (result.page_summary || '').slice(0, 120) +
    ((result.page_summary || '').length > 120 ? '…' : '');

  const warningHtml = result.user_warning_message
    ? `<div class="warning-banner" style="color:${color};border-color:${color}40;background:${color}08">
         <span>⚠</span><span>${result.user_warning_message}</span>
       </div>`
    : '';

  document.getElementById('main-content').innerHTML = `
    <div class="score-area">
      <div class="score-ring-wrap">
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="28" fill="none" stroke="#1f1f1f" stroke-width="7"/>
          <circle cx="36" cy="36" r="28" fill="none" stroke="${sColor}" stroke-width="7"
            stroke-linecap="round"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${circumference - progress}"
            style="filter:drop-shadow(0 0 5px ${sColor}60)"
          />
        </svg>
        <div class="score-center">
          <span class="score-num" style="color:${sColor}">${result.credibility_score}</span>
          <span class="score-sub">/100</span>
        </div>
      </div>
      <div class="score-info">
        <div class="score-label" style="color:${color}">${result.credibility_label}</div>
        <div class="score-summary">${summary}</div>
      </div>
    </div>

    ${warningHtml}

    <div class="tabs">
      <button class="tab ${activeTab === 'claims' ? 'active' : ''}" data-tab="claims">
        Claims (${result.claims.length})
      </button>
      <button class="tab ${activeTab === 'signals' ? 'active' : ''}" data-tab="signals">
        Signals (${result.misinformation_signals.length})
      </button>
      <button class="tab ${activeTab === 'sources' ? 'active' : ''}" data-tab="sources">
        Sources (${(result.sources || []).length})
      </button>
    </div>

    <div id="tab-content"></div>

    <div class="source-row">
      <span class="source-label">Source reliability:</span>
      <span>${result.source_reliability}</span>
    </div>
  `;

  // Attach tab click handlers via event delegation (no inline onclick)
  document.querySelector('.tabs').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    switchTab(btn.dataset.tab);
  });

  renderTab();
}

function renderTab() {
  if (!currentResult) return;
  const container = document.getElementById('tab-content');
  if (!container) return;

  if (activeTab === 'claims') {
    container.innerHTML = `
      <div class="claims-list">
        ${currentResult.claims.map((c, i) => {
          const col = COLORS[c.verification] || COLORS.UNVERIFIED;
          return `
            <div class="claim-item" id="claim-${i}"
              style="border-color:${col.border};background:${col.bg}"
              data-claim="${i}"
            >
              <div class="claim-header">
                <div class="claim-badge" style="background:${col.bg};color:${col.text};border:1px solid ${col.border}">
                  ${col.icon}
                </div>
                <div style="flex:1">
                  <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:${col.text};margin-bottom:3px">
                    ${c.verification} · ${c.confidence}
                  </div>
                  <div class="claim-text">"${c.claim}"</div>
                </div>
              </div>
              <div class="claim-reason">${c.reason}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Event delegation for claim expand/collapse
    container.addEventListener('click', function (e) {
      const item = e.target.closest('[data-claim]');
      if (item) item.classList.toggle('expanded');
    });

  } else if (activeTab === 'sources') {
    const sources = currentResult.sources || [];
    const noSources = '<div style="padding:16px;text-align:center;font-size:11px;color:#444440">No web sources were retrieved for this analysis.</div>';
    const sourceItems = sources.map(s => {
      let host = s.url;
      try { host = new URL(s.url).hostname.replace(/^www\./, ''); } catch (_) {}
      return `
        <a class="source-item" href="${escapeAttr(s.url)}" target="_blank" rel="noopener noreferrer">
          <span class="source-title">${escapeHtml(s.title || s.url)}</span>
          <span class="source-host">↗ ${escapeHtml(host)}</span>
        </a>
      `;
    }).join('');

    container.innerHTML = `
      <div class="sources-list">
        ${sources.length === 0 ? noSources : sourceItems}
      </div>
    `;

  } else {
    const noSignals = '<div style="padding:16px;text-align:center;font-size:11px;color:#444440">No misinformation signals detected.</div>';
    const signalItems = currentResult.misinformation_signals.map(s => `
      <div class="signal-item">
        <span class="signal-icon">◆</span>
        <span>${s}</span>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="signals-list">
        ${currentResult.misinformation_signals.length === 0 ? noSignals : signalItems}
        <div class="verdict-box">
          <div class="verdict-label">Final verdict</div>
          <div class="verdict-text">${currentResult.final_verdict}</div>
        </div>
      </div>
    `;
  }
}

function escapeAttr(s) {
  // Only allow http(s) links through; everything else becomes an inert anchor.
  const url = String(s == null ? '' : s);
  return /^https?:\/\//i.test(url) ? escapeHtml(url) : '#';
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  renderTab();
}

function showAnalyzing() {
  setViewMoreVisible(false);
  const pill = document.getElementById('status-pill');
  pill.textContent = 'Analyzing';
  pill.style.color = '#60a5fa';
  pill.style.borderColor = '#60a5fa40';
  pill.style.background = '#60a5fa10';
  document.getElementById('main-content').innerHTML = `
    <div class="loading-state">
      <div class="spinner" style="border-top-color:#60a5fa"></div>
      <div class="loading-text">Analyzing page…</div>
    </div>
  `;
}

function showEmpty(msg) {
  setViewMoreVisible(false);
  document.getElementById('status-pill').textContent = 'No data';
  document.getElementById('main-content').innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e8e6e0" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      </div>
      <div class="empty-title">No analysis available</div>
      <div class="empty-sub">${msg}</div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function showError(err) {
  setViewMoreVisible(false);
  const pill = document.getElementById('status-pill');
  pill.textContent = 'Error';
  pill.style.color = '#ff4545';
  pill.style.borderColor = '#ff454540';
  pill.style.background = '#ff454510';

  const code = err.code || 'UNKNOWN';
  const showOptionsBtn = ['NO_API_KEY', 'INVALID_KEY', 'UPSTREAM_RATE_LIMITED', 'MODEL_NOT_FOUND'].includes(code);

  document.getElementById('main-content').innerHTML = `
    <div style="padding:18px 14px;display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;gap:8px;align-items:flex-start">
        <span style="color:#ff4545;font-size:14px;flex-shrink:0;line-height:1.3">⚠</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#ff4545;margin-bottom:4px">
            ${escapeHtml(code)}
          </div>
          <div style="font-size:11px;color:#c0beb8;line-height:1.5;word-wrap:break-word">
            ${escapeHtml(err.error || 'Analysis failed.')}
          </div>
        </div>
      </div>
      ${showOptionsBtn ? `
        <button id="err-open-options" class="icon-btn" style="align-self:flex-start">
          Open settings
        </button>
      ` : ''}
    </div>
  `;
  const btn = document.getElementById('err-open-options');
  if (btn) btn.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
  });
}

// ── Action buttons ────────────────────────────────────────────────────────────
function setRefreshBusy(busy) {
  const btn = document.getElementById('btn-refresh');
  if (!btn) return;
  btn.disabled = !!busy;
  btn.style.opacity = busy ? '0.5' : '1';
}

function flashShareBtn(text) {
  const btn = document.getElementById('btn-share');
  if (!btn) return;
  const original = btn.innerHTML;
  btn.innerHTML = text;
  setTimeout(() => { btn.innerHTML = original; }, 1500);
}

// Toggle the "View full report" CTA. Only meaningful once we have a result.
function setViewMoreVisible(visible) {
  const btn = document.getElementById('btn-viewmore');
  if (btn) btn.style.display = visible ? 'flex' : 'none';
}

function flashViewMore(text, keep) {
  const label = document.getElementById('viewmore-label');
  if (!label) return;
  label.textContent = text;
  if (!keep) setTimeout(() => { label.textContent = 'View full report'; }, 1800);
}

// Persists the current analysis to the backend and opens the full report
// page (the Veritas web app) in a new tab, where the user gets the complete
// breakdown: summary, every claim with reasoning, sources, and signals.
async function openFullReport() {
  if (!currentResult) return;
  const settings = await new Promise((r) =>
    chrome.storage.sync.get({ apiBase: '' }, r),
  );
  const apiBase = (settings.apiBase || '').replace(/\/+$/, '');
  if (!apiBase) {
    flashViewMore('Set backend URL in settings');
    return;
  }
  flashViewMore('Opening…', true);
  try {
    const res = await fetch(`${apiBase}/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: currentPageUrl, result: currentResult }),
    });
    if (!res.ok) throw new Error('Report failed');
    const { id } = await res.json();
    chrome.tabs.create({ url: `${apiBase}/report?id=${id}` });
    flashViewMore('View full report');
  } catch (e) {
    flashViewMore('Failed — try again');
  }
}

async function shareCurrentResult() {
  if (!currentResult) {
    flashShareBtn('Nothing to share');
    return;
  }
  const settings = await new Promise((r) =>
    chrome.storage.sync.get({ apiBase: '' }, r),
  );
  const apiBase = (settings.apiBase || '').replace(/\/+$/, '');
  if (!apiBase) {
    flashShareBtn('Set backend URL');
    return;
  }
  try {
    const res = await fetch(`${apiBase}/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: currentPageUrl, result: currentResult }),
    });
    if (!res.ok) throw new Error('Share failed');
    const { id } = await res.json();
    const shareUrl = `${apiBase}/report?id=${id}`;
    await navigator.clipboard.writeText(shareUrl).catch(() => {});
    flashShareBtn('Link copied');
  } catch (e) {
    flashShareBtn('Failed');
  }
}

function refreshCurrentTab() {
  if (!currentTabId) return;
  setRefreshBusy(true);
  showAnalyzing();
  chrome.tabs.sendMessage(currentTabId, { type: 'FORCE_REANALYZE' }, () => {
    // ignore — content script may not be present
    if (chrome.runtime.lastError) {/* noop */}
    setTimeout(() => setRefreshBusy(false), 1200);
  });
}

document.getElementById('btn-refresh').addEventListener('click', refreshCurrentTab);
document.getElementById('btn-share').addEventListener('click', shareCurrentResult);
document.getElementById('btn-viewmore').addEventListener('click', openFullReport);
document.getElementById('btn-settings').addEventListener('click', () => {
  if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
});

// ── Init: read storage immediately, no loading flash ──────────────────────────
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  const main = document.getElementById('main-content');

  if (!tab || !tab.url) {
    main.style.visibility = 'visible';
    showEmpty('No active tab found.');
    return;
  }

  currentTabId = tab.id;
  currentPageUrl = tab.url;
  const pageUrl = tab.url;
  const errorKey = '__veritas_error__:' + pageUrl;

  chrome.storage.local.get([pageUrl, errorKey], (stored) => {
    if (stored[pageUrl]) {
      // Cached result — render instantly, zero spinner flash
      renderResult(stored[pageUrl]);
    } else if (stored[errorKey]) {
      showError(stored[errorKey]);
    } else {
      // Not done yet — show analyzing state
      showAnalyzing();
    }

    // Reveal now that we have something real to show
    main.style.visibility = 'visible';

    // Live listener: auto-update the moment analysis finishes
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local') return;
      if (changes[pageUrl] && changes[pageUrl].newValue) {
        renderResult(changes[pageUrl].newValue);
        document.getElementById('main-content').style.visibility = 'visible';
      } else if (changes[errorKey] && changes[errorKey].newValue) {
        showError(changes[errorKey].newValue);
        document.getElementById('main-content').style.visibility = 'visible';
      }
    });
  });
});
