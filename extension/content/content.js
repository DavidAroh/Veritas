// Veritas Agent — Content Script (Grammarly-style continuous monitoring)
// Re-analyzes on every navigation, URL change, and significant content change

(function () {
  'use strict';

  if (window.location.protocol === 'chrome-extension:') return;

  // Guard: check extension context is still valid before any chrome API call.
  function contextValid() {
    try { return !!chrome.runtime.id; } catch (_) { return false; }
  }

  // ─── State ───────────────────────────────────────────────────────────────
  let currentUrl = location.href;
  let debounceTimer = null;
  let mutationDebounce = null;
  let isAnalyzing = false;
  let analyzedUrls = new Set();
  let settings = {
    apiBase: '',
    badgeCorner: 'bottom-right',
    whitelist: [],
    blacklist: [],
    inlineHighlights: true,
    autoAnalyze: true,
  };
  let highlightedClaims = [];

  const STATUS_MAP = {
    'Verified':           { status: 'verified',   color: '#4ade80' },
    'Partially Verified': { status: 'partial',    color: '#60a5fa' },
    'Misleading':         { status: 'misleading', color: '#ffab40' },
    'Unverified':         { status: 'unverified', color: '#888880' },
    'False':              { status: 'false',       color: '#ff4545' },
  };

  const VERDICT_COLORS = {
    TRUE:       '#4ade80',
    MISLEADING: '#ffab40',
    FALSE:      '#ff4545',
    UNVERIFIED: '#888880',
  };

  // ─── Settings ────────────────────────────────────────────────────────────
  function loadSettings() {
    try {
      chrome.storage.sync.get(
        { apiBase: '', badgeCorner: 'bottom-right',
          whitelist: [], blacklist: [],
          inlineHighlights: true, autoAnalyze: true },
        function (s) {
          if (!contextValid()) return;
          settings = s;
          applyBadgePosition();
        }
      );
    } catch (_) {}
  }

  function hostMatches(list) {
    if (!list || !list.length) return false;
    var host = location.hostname.replace(/^www\./, '');
    return list.some(function (d) { return host === d || host.endsWith('.' + d); });
  }

  function isBlacklisted() { return hostMatches(settings.blacklist); }
  function isWhitelisted() { return hostMatches(settings.whitelist); }

  // Listen for settings changes so user doesn't need to reload tabs
  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'sync') return;
      Object.keys(changes).forEach(function (k) {
        settings[k] = changes[k].newValue;
      });
      applyBadgePosition();
    });
  }

  // ─── Content extraction ──────────────────────────────────────────────────
  // Operates on the live DOM (no cloneNode) to avoid reparsing <img> srcsets.
  const NOISE_ANCESTOR_SELECTOR = [
    'nav', 'header', 'footer', 'aside',
    '.sidebar', '.ads', '.advertisement', '.cookie-banner',
    '[class*="nav"]', '[class*="menu"]', '[id*="nav"]', '[id*="sidebar"]',
    '[class*="ad-"]', '[id*="ad-"]', '.widget', '.related', '.comments',
  ].join(',');

  function isInsideNoise(el) {
    try { return !!el.closest(NOISE_ANCESTOR_SELECTOR); } catch (_) { return false; }
  }

  function extractContent() {
    const articleSelectors = [
      'article', '[role="main"]', 'main',
      '.article-body', '.article-content', '.article__body',
      '.post-content', '.post-body', '.post__content',
      '.entry-content', '.entry-body',
      '.story-body', '.story-content',
      '.news-body', '.news-content',
      '#article-body', '#main-content', '#content',
      '.content-body', '.page-content',
    ];

    let content = '';
    for (const sel of articleSelectors) {
      try {
        const el = document.querySelector(sel);
        if (el && !isInsideNoise(el) && el.innerText && el.innerText.trim().length > 300) {
          content = el.innerText;
          break;
        }
      } catch (_) {}
    }

    if (!content || content.trim().length < 300) {
      let maxLen = 0;
      const candidates = document.querySelectorAll('article, main, section, div');
      for (let i = 0; i < candidates.length; i++) {
        const el = candidates[i];
        if (isInsideNoise(el)) continue;
        const t = el.innerText ? el.innerText.trim() : '';
        if (t.length > maxLen) { maxLen = t.length; content = t; }
      }
    }

    return content.replace(/\s+/g, ' ').trim().slice(0, 8000);
  }

  function isArticlePage() {
    if (isWhitelisted()) return true; // whitelist forces analysis
    const skip = [
      /^https?:\/\/[^/]+\/?(\?.*)?$/,
      /\/(search|login|signup|register|account|profile|settings|cart|checkout)/i,
      /\.(jpg|jpeg|png|gif|pdf|mp4|mp3|zip)(\?.*)?$/i,
    ];
    if (skip.some(r => r.test(location.href))) return false;
    return extractContent().length > 400;
  }

  // ─── Badge UI ────────────────────────────────────────────────────────────
  function cornerToCss(corner) {
    var map = {
      'bottom-right': { top: 'auto', bottom: '20px', left: 'auto',  right: '20px' },
      'bottom-left':  { top: 'auto', bottom: '20px', left: '20px',  right: 'auto' },
      'top-right':    { top: '20px', bottom: 'auto', left: 'auto',  right: '20px' },
      'top-left':     { top: '20px', bottom: 'auto', left: '20px',  right: 'auto' },
    };
    return map[corner] || map['bottom-right'];
  }

  function applyBadgePosition() {
    var inner = document.getElementById('veritas-inner');
    if (!inner) return;
    var pos = cornerToCss(settings.badgeCorner);
    inner.style.top = pos.top;
    inner.style.bottom = pos.bottom;
    inner.style.left = pos.left;
    inner.style.right = pos.right;
  }

  function ensureBadge() {
    if (document.getElementById('veritas-inner')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'veritas-agent-badge';

    const inner = document.createElement('div');
    inner.id = 'veritas-inner';
    var pos = cornerToCss(settings.badgeCorner);
    inner.style.cssText = [
      'position:fixed', 'top:' + pos.top, 'bottom:' + pos.bottom,
      'left:' + pos.left, 'right:' + pos.right, 'z-index:2147483647',
      'display:flex', 'align-items:center', 'gap:8px', 'padding:8px 14px',
      'background:#111111', 'border:1px solid #2a2a2a', 'border-radius:100px',
      'font-family:"DM Mono","Courier New",monospace', 'font-size:12px',
      'color:#888880', 'cursor:pointer', 'box-shadow:0 4px 24px rgba(0,0,0,0.6)',
      'transition:border-color 0.2s,box-shadow 0.2s', 'user-select:none',
      'max-width:240px', 'backdrop-filter:blur(8px)',
    ].join(';');

    inner.innerHTML = [
      '<div id="veritas-dot" style="width:8px;height:8px;border-radius:50%;',
      'background:#555550;flex-shrink:0;transition:background 0.3s,box-shadow 0.3s"></div>',
      '<span id="veritas-text" style="white-space:nowrap;letter-spacing:0.02em">Veritas</span>',
      '<span id="veritas-score" style="font-weight:600;color:#e8e6e0;display:none;flex-shrink:0"></span>',
      '<span id="veritas-grip" title="Drag" style="margin-left:4px;color:#444440;cursor:grab;font-size:14px;line-height:1">⠿</span>',
    ].join('');

    inner.addEventListener('mouseenter', function () {
      this.style.borderColor = '#b8ff57';
      this.style.boxShadow = '0 4px 24px rgba(0,0,0,0.6),0 0 0 1px #b8ff5730';
    });
    inner.addEventListener('mouseleave', function () {
      this.style.borderColor = '#2a2a2a';
      this.style.boxShadow = '0 4px 24px rgba(0,0,0,0.6)';
    });
    inner.addEventListener('click', function (e) {
      if (e.target && e.target.id === 'veritas-grip') return;
      try { chrome.runtime.sendMessage({ type: 'OPEN_POPUP' }); } catch (_) {}
    });

    attachDrag(inner);

    wrapper.appendChild(inner);
    document.body.appendChild(wrapper);
  }

  // ─── Drag-to-corner ──────────────────────────────────────────────────────
  function attachDrag(badge) {
    var grip = badge.querySelector('#veritas-grip');
    if (!grip) return;
    var dragging = false;
    var startX, startY;

    grip.addEventListener('mousedown', function (e) {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      grip.style.cursor = 'grabbing';
      badge.style.transition = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      // Move badge with cursor, anchored to top-left while dragging
      var rect = badge.getBoundingClientRect();
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      badge.style.right = 'auto';
      badge.style.bottom = 'auto';
      badge.style.left = (rect.left + dx) + 'px';
      badge.style.top  = (rect.top  + dy) + 'px';
      startX = e.clientX;
      startY = e.clientY;
    });

    document.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = false;
      grip.style.cursor = 'grab';
      badge.style.transition = 'border-color 0.2s,box-shadow 0.2s';

      // Snap to nearest corner
      var rect = badge.getBoundingClientRect();
      var midX = window.innerWidth / 2;
      var midY = window.innerHeight / 2;
      var corner =
        (rect.top + rect.height / 2 < midY ? 'top-' : 'bottom-') +
        (rect.left + rect.width / 2 < midX ? 'left' : 'right');
      settings.badgeCorner = corner;
      applyBadgePosition();
      try { chrome.storage.sync.set({ badgeCorner: corner }); } catch (_) {}
    });
  }

  function setBadgeState(status, score, label) {
    ensureBadge();

    const dot     = document.getElementById('veritas-dot');
    const text    = document.getElementById('veritas-text');
    const scoreEl = document.getElementById('veritas-score');
    if (!dot || !text || !scoreEl) return;

    const colors = {
      idle: '#333330', scanning: '#60a5fa', analyzing: '#a78bfa',
      verified: '#4ade80', partial: '#60a5fa', misleading: '#ffab40',
      unverified: '#888880', false: '#ff4545', error: '#ff4545',
    };

    const textMap = {
      idle: 'Veritas', scanning: 'Scanning...', analyzing: 'Analyzing...',
      verified: label || 'Verified', partial: label || 'Partial',
      misleading: label || 'Misleading', unverified: label || 'Unverified',
      false: label || 'False', error: 'Error',
    };

    const color = colors[status] || colors.idle;
    dot.style.background = color;
    dot.style.boxShadow = ['scanning', 'analyzing'].includes(status)
      ? '0 0 0 0 ' + color
      : ['idle', 'error'].includes(status) ? 'none' : '0 0 8px ' + color + '80';
    dot.style.animation = ['scanning', 'analyzing'].includes(status)
      ? 'veritas-pulse 1s ease-in-out infinite' : 'none';

    text.textContent = textMap[status] || 'Veritas';
    text.style.color = ['idle', 'error', 'unverified'].includes(status) ? '#888880' : '#e8e6e0';

    const showScore = score !== undefined && score !== null
      && !['idle', 'scanning', 'analyzing', 'error'].includes(status);
    scoreEl.style.display = showScore ? 'inline' : 'none';
    if (showScore) { scoreEl.textContent = score; scoreEl.style.color = color; }
  }

  function injectStyles() {
    if (document.getElementById('veritas-styles')) return;
    const s = document.createElement('style');
    s.id = 'veritas-styles';
    s.textContent =
      '@keyframes veritas-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:0.6}}' +
      '.veritas-claim-mark{background-image:linear-gradient(transparent 60%,var(--vc) 60%);' +
      'background-size:100% 100%;cursor:help;border-radius:2px;padding:0 2px;' +
      'transition:background-color 0.15s}' +
      '.veritas-claim-mark:hover{outline:1px dashed var(--vc);outline-offset:1px}' +
      '#veritas-tooltip{position:absolute;z-index:2147483647;max-width:320px;' +
      'background:#0d0d0d;border:1px solid #2a2a2a;border-radius:8px;padding:10px 12px;' +
      'color:#e8e6e0;font-family:"DM Mono","Courier New",monospace;font-size:12px;' +
      'line-height:1.5;box-shadow:0 8px 32px rgba(0,0,0,0.7);pointer-events:none;' +
      'opacity:0;transform:translateY(4px);transition:opacity 0.15s,transform 0.15s}' +
      '#veritas-tooltip.show{opacity:1;transform:translateY(0)}' +
      '#veritas-tooltip .vt-verdict{font-size:9px;text-transform:uppercase;' +
      'letter-spacing:0.08em;font-weight:700;margin-bottom:4px}' +
      '#veritas-tooltip .vt-claim{color:#c0beb8;margin-bottom:6px;font-size:11px}' +
      '#veritas-tooltip .vt-reason{color:#888880;font-size:11px;border-top:1px solid #1f1f1f;padding-top:6px}';
    (document.head || document.documentElement).appendChild(s);
  }

  // ─── Inline highlighting ─────────────────────────────────────────────────
  function clearHighlights() {
    document.querySelectorAll('.veritas-claim-mark').forEach(function (el) {
      var parent = el.parentNode;
      if (!parent) return;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
      parent.normalize();
    });
    var tip = document.getElementById('veritas-tooltip');
    if (tip) tip.remove();
  }

  function ensureTooltip() {
    var tip = document.getElementById('veritas-tooltip');
    if (tip) return tip;
    tip = document.createElement('div');
    tip.id = 'veritas-tooltip';
    document.body.appendChild(tip);
    return tip;
  }

  function showTooltip(target, claim) {
    var tip = ensureTooltip();
    var color = VERDICT_COLORS[claim.verification] || VERDICT_COLORS.UNVERIFIED;
    tip.innerHTML =
      '<div class="vt-verdict" style="color:' + color + '">' +
        claim.verification + ' · ' + (claim.confidence || '') + '</div>' +
      '<div class="vt-claim">' + escapeHtml(claim.claim) + '</div>' +
      '<div class="vt-reason">' + escapeHtml(claim.reason || '') + '</div>';
    var rect = target.getBoundingClientRect();
    var top = window.scrollY + rect.bottom + 8;
    var left = Math.min(
      window.scrollX + rect.left,
      window.scrollX + window.innerWidth - 340
    );
    tip.style.top = top + 'px';
    tip.style.left = Math.max(8, left) + 'px';
    tip.classList.add('show');
  }

  function hideTooltip() {
    var tip = document.getElementById('veritas-tooltip');
    if (tip) tip.classList.remove('show');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Find first text node containing a given snippet and wrap a span around it.
  function highlightClaimInDom(claim) {
    if (claim.verification === 'TRUE') return; // only flag the questionable ones
    var snippet = (claim.claim || '').trim();
    if (snippet.length < 20) return;
    // Use first ~80 chars to maximize match likelihood without over-matching
    var needle = snippet.slice(0, 80).toLowerCase();
    var color = VERDICT_COLORS[claim.verification] || VERDICT_COLORS.UNVERIFIED;

    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || node.nodeValue.length < needle.length) return NodeFilter.FILTER_REJECT;
        var p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        var tag = p.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
        if (p.closest('#veritas-agent-badge') || p.closest('#veritas-tooltip')) return NodeFilter.FILTER_REJECT;
        if (p.classList && p.classList.contains('veritas-claim-mark')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    var node;
    while ((node = walker.nextNode())) {
      var text = node.nodeValue;
      var idx = text.toLowerCase().indexOf(needle);
      if (idx === -1) continue;
      try {
        var range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + needle.length);
        var span = document.createElement('span');
        span.className = 'veritas-claim-mark';
        span.style.setProperty('--vc', color + '60');
        span.title = claim.verification + ': ' + (claim.reason || '');
        span.addEventListener('mouseenter', function () { showTooltip(span, claim); });
        span.addEventListener('mouseleave', hideTooltip);
        range.surroundContents(span);
        return; // highlight first hit only
      } catch (_) {
        // surroundContents fails on partial-element ranges; try next node
      }
    }
  }

  function applyHighlights(claims) {
    if (!settings.inlineHighlights) return;
    if (!claims || !claims.length) return;
    highlightedClaims = claims;
    clearHighlights();
    claims.forEach(highlightClaimInDom);
  }

  // ─── Core analysis ───────────────────────────────────────────────────────
  function runAnalysis(forceRefresh) {
    if (isAnalyzing) return;
    if (!contextValid()) return;
    if (isBlacklisted()) { setBadgeState('idle'); return; }
    if (!settings.autoAnalyze && !forceRefresh) { setBadgeState('idle'); return; }
    if (!isArticlePage()) { setBadgeState('idle'); return; }

    const url = location.href;
    injectStyles();
    setBadgeState('scanning');

    if (!forceRefresh) {
      try {
        chrome.storage.local.get([url], function (cached) {
          if (!contextValid()) return;
          const r = cached[url];
          if (r && r._cachedAt && (Date.now() - r._cachedAt < 30 * 60 * 1000)) {
            const mapped = STATUS_MAP[r.credibility_label];
            setBadgeState(mapped ? mapped.status : 'unverified', r.credibility_score, r.credibility_label);
            applyHighlights(r.claims);
            analyzedUrls.add(url);
          } else {
            doApiCall(url);
          }
        });
      } catch (_) { setBadgeState('idle'); }
    } else {
      // Force refresh — bust the cache
      clearHighlights();
      analyzedUrls.delete(url);
      doApiCall(url);
    }
  }

  function doApiCall(url) {
    if (!contextValid()) return;
    isAnalyzing = true;
    setBadgeState('analyzing');

    var payload = {
      url: url,
      title: document.title || (document.querySelector('h1') ? document.querySelector('h1').innerText : ''),
      source: location.hostname.replace('www.', ''),
      content: extractContent(),
    };

    try {
      chrome.runtime.sendMessage({ type: 'ANALYZE', payload: payload }, function (response) {
        isAnalyzing = false;
        if (!contextValid()) return;

        if (chrome.runtime.lastError || !response || response.error) {
          setBadgeState('error');
          var errToStore = {};
          errToStore['__veritas_error__:' + url] = {
            error: (response && response.error) || (chrome.runtime.lastError && chrome.runtime.lastError.message) || 'Unknown error',
            code: (response && response.code) || 'UNKNOWN',
            _cachedAt: Date.now(),
          };
          try { chrome.storage.local.set(errToStore); } catch (_) {}
          return;
        }

        if (response.result) {
          var r = response.result;
          var mapped = STATUS_MAP[r.credibility_label];
          setBadgeState(mapped ? mapped.status : 'unverified', r.credibility_score, r.credibility_label);
          var toStore = {};
          toStore[url] = Object.assign({}, r, { _cachedAt: Date.now() });
          try {
            chrome.storage.local.set(toStore);
            chrome.storage.local.remove('__veritas_error__:' + url);
          } catch (_) {}
          applyHighlights(r.claims);
          analyzedUrls.add(url);
        }
      });
    } catch (e) {
      isAnalyzing = false;
      setBadgeState('error');
    }
  }

  // ─── Listen for force-reanalyze (keyboard shortcut, popup refresh) ───────
  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg && msg.type === 'FORCE_REANALYZE') {
      runAnalysis(true);
      sendResponse({ ok: true });
    }
    return true;
  });

  // ─── SPA navigation detection ────────────────────────────────────────────
  function onUrlChange() {
    var newUrl = location.href;
    if (newUrl === currentUrl) return;
    currentUrl = newUrl;
    isAnalyzing = false;
    clearHighlights();

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      setBadgeState('scanning');
      runAnalysis(false);
    }, 1200);
  }

  var _push = history.pushState;
  var _replace = history.replaceState;

  history.pushState = function () {
    _push.apply(history, arguments);
    if (contextValid()) setTimeout(onUrlChange, 150);
  };
  history.replaceState = function () {
    _replace.apply(history, arguments);
    if (contextValid()) setTimeout(onUrlChange, 150);
  };

  window.addEventListener('popstate', function () { if (contextValid()) setTimeout(onUrlChange, 150); });
  window.addEventListener('hashchange', function () { if (contextValid()) setTimeout(onUrlChange, 150); });

  var lastContentSig = '';
  function getContentSig() {
    var h1 = document.querySelector('h1');
    return location.href + '::' + document.title + '::' + (h1 ? h1.innerText : '');
  }

  var observer = new MutationObserver(function () {
    if (location.href !== currentUrl) { onUrlChange(); return; }
    var sig = getContentSig();
    if (sig === lastContentSig) return;
    lastContentSig = sig;
    if (!analyzedUrls.has(location.href)) {
      clearTimeout(mutationDebounce);
      mutationDebounce = setTimeout(function () { runAnalysis(false); }, 2000);
    }
  });

  // ─── Boot ────────────────────────────────────────────────────────────────
  function boot() {
    injectStyles();
    loadSettings();
    lastContentSig = getContentSig();

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
    });

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () { runAnalysis(false); }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.addEventListener('load', function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      if (!analyzedUrls.has(location.href)) runAnalysis(false);
    }, 1800);
  });

})();
