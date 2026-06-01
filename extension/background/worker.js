// Veritas Agent — Background Service Worker
// Orchestrates Gemini API calls and message routing

const DEFAULT_API_BASE = 'http://localhost:3000';
const MAX_CONTENT_CHARS = 6000;

const SYSTEM_PROMPT = `You are Veritas Agent, an AI-powered truth verification assistant.
Your role is to analyze information from the internet and determine its credibility.

ANALYSIS PROCESS:
Step 1 — Understand the content and determine the main topic.
Step 2 — Extract verifiable claims (ignore opinions/subjective statements).
Step 3 — For each claim, label it: TRUE, MISLEADING, FALSE, or UNVERIFIED.
Step 4 — Detect misinformation signals.
Step 5 — Evaluate source/publisher credibility.
Step 6 — Generate a credibility score 0-100.
Step 7 — Generate concise UI insights.

OUTPUT FORMAT - return ONLY valid JSON, no markdown, no prose, no code fences:
{
  "page_summary": "2-3 sentence summary",
  "credibility_score": 0,
  "credibility_label": "Verified|Partially Verified|Misleading|Unverified|False",
  "claims": [{"claim":"","verification":"TRUE|MISLEADING|FALSE|UNVERIFIED","confidence":"87%","reason":""}],
  "misinformation_signals": [],
  "source_reliability": "High|Medium|Low|Unknown - brief note",
  "final_verdict": "1-sentence verdict",
  "user_warning_message": ""
}`;

const DEFAULT_MODEL = 'gemini-2.5-flash';

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      { apiBase: DEFAULT_API_BASE, badgeCorner: 'bottom-right',
        whitelist: [], blacklist: [],
        inlineHighlights: true, autoAnalyze: true,
        geminiModel: DEFAULT_MODEL },
      (s) => resolve(s)
    );
  });
}

class AnalysisError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status || 500;
  }
}

async function analyzeContent(payload) {
  const settings = await getSettings();
  const apiBase = (settings.apiBase || '').trim();

  // Try the configured backend first
  if (apiBase) {
    try {
      const res = await fetch(`${apiBase}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) return await res.json();
      // Backend reachable but returned an error — surface its code
      const errBody = await res.json().catch(() => ({}));
      if (res.status >= 400 && res.status < 500 && errBody.code) {
        throw new AnalysisError(errBody.code, errBody.error || 'Backend error', res.status);
      }
      // 5xx or unstructured — fall through to direct call
      console.log('[Veritas] Backend returned', res.status, '— falling back to direct Gemini call');
    } catch (e) {
      if (e instanceof AnalysisError) throw e;
      console.log('[Veritas] Backend unreachable, falling back to direct Gemini call');
    }
  }

  // Fallback: direct Gemini call
  const stored = await new Promise((r) => chrome.storage.local.get(['geminiKey'], r));
  const geminiKey = stored.geminiKey;
  if (!geminiKey) {
    throw new AnalysisError(
      'NO_API_KEY',
      'No backend configured and no Gemini API key set. Open Veritas settings to add one.',
      400
    );
  }

  const truncatedContent = (payload.content || '').slice(0, MAX_CONTENT_CHARS);
  const model = settings.geminiModel || DEFAULT_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{
        role: 'user',
        parts: [{ text: JSON.stringify({ ...payload, content: truncatedContent }) }],
      }],
      // Search grounding: verify claims against live sources and return the
      // URLs used in groundingMetadata. responseMimeType can't be combined
      // with tools, so we strip fences from the text instead.
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2000,
      },
    }),
  });

  if (!res.ok) {
    let body = null;
    try { body = await res.json(); } catch (_) {}
    if (res.status === 429) {
      const retryDetail = (body?.error?.details || []).find(
        (d) => d['@type'] && d['@type'].includes('RetryInfo'),
      );
      const retry = retryDetail?.retryDelay || '';
      const isFreeTierZero = /limit:\s*0/.test(body?.error?.message || '');
      const detailMsg = isFreeTierZero
        ? `Free-tier quota for ${model} is exhausted (or unavailable for your project). Try a different model in Veritas options, or add billing to your Google project.`
        : `Gemini quota for ${model} exceeded${retry ? ` — retry in ${retry}` : ''}.`;
      throw new AnalysisError('UPSTREAM_RATE_LIMITED', detailMsg, 429);
    }
    if (res.status === 401 || res.status === 403) {
      throw new AnalysisError('INVALID_KEY', 'Gemini rejected the API key.', res.status);
    }
    if (res.status === 404) {
      throw new AnalysisError('MODEL_NOT_FOUND',
        `Model "${model}" not found. Pick a different model in Veritas options.`, 404);
    }
    throw new AnalysisError('API_ERROR',
      `Gemini API error ${res.status}: ${body?.error?.message || 'unknown'}`, res.status);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts || [])
    .map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .join('');
  const clean = text.replace(/```json|```/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new AnalysisError('PARSE_ERROR', 'Could not parse Gemini response.', 502);
  }
  parsed.sources = extractGroundingSources(candidate);
  return parsed;
}

// Pulls real web citations out of Gemini's grounding metadata. Mirrors the
// server-side extractor in src/app/api/analyze/internal.ts.
function extractGroundingSources(candidate) {
  const chunks = candidate?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];
  const seen = new Set();
  const out = [];
  for (const chunk of chunks) {
    const url = (chunk?.web?.uri || '').trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, title: (chunk?.web?.title || '').trim() || url });
  }
  return out;
}

// In-flight guard: prevents duplicate simultaneous calls for the same URL
const inFlight = new Set();

function shouldSkipUrl(url, settings) {
  if (/^(chrome|about|chrome-extension|moz-extension|edge|brave):\/\//.test(url)) {
    return { skip: true, code: 'INTERNAL_PAGE' };
  }
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const matches = (list) => list.some((d) => host === d || host.endsWith('.' + d));
    if (matches(settings.blacklist || [])) return { skip: true, code: 'BLACKLISTED' };
  } catch {}
  return { skip: false };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYZE') {
    const { payload } = message;
    const url = payload.url;

    (async () => {
      const settings = await getSettings();
      const skip = shouldSkipUrl(url, settings);
      if (skip.skip) {
        sendResponse({ error: 'Skipped', code: skip.code });
        return;
      }

      if (inFlight.has(url)) {
        sendResponse({ error: 'Analysis already in progress', code: 'IN_FLIGHT' });
        return;
      }

      inFlight.add(url);
      console.log('[Veritas] Analyzing:', url);

      try {
        const result = await analyzeContent(payload);
        inFlight.delete(url);
        console.log('[Veritas] Done:', url, result.credibility_label, result.credibility_score);
        sendResponse({ result });
      } catch (err) {
        inFlight.delete(url);
        console.error('[Veritas] Error:', err.code || 'UNKNOWN', err.message);
        sendResponse({ error: err.message, code: err.code || 'UNKNOWN' });
      }
    })();

    return true; // keep channel open for async sendResponse
  }

  if (message.type === 'GET_RESULT') {
    chrome.storage.local.get([message.url], (result) => {
      sendResponse(result[message.url] || null);
    });
    return true;
  }

  if (message.type === 'GET_SETTINGS') {
    getSettings().then(sendResponse);
    return true;
  }

  if (message.type === 'OPEN_POPUP') {
    if (chrome.action && chrome.action.openPopup) {
      chrome.action.openPopup().catch(() => {});
    }
    return false;
  }

  if (message.type === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    return false;
  }
});

// Keyboard shortcut → trigger re-analysis on the active tab
if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener((command) => {
    if (command !== 'reanalyze') return;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.id) return;
      chrome.tabs.sendMessage(tab.id, { type: 'FORCE_REANALYZE' }, () => {
        // ignore failures (page may not have content script)
        if (chrome.runtime.lastError) {/* noop */}
      });
    });
  });
}

// First-run: open options so user can set their backend / API key
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }

  // Clean up cache entries older than 7 days
  chrome.storage.local.get(null, (items) => {
    const now = Date.now();
    const toRemove = [];
    for (const [key, val] of Object.entries(items)) {
      if (val && val._cachedAt && now - val._cachedAt > 7 * 24 * 60 * 60 * 1000) {
        toRemove.push(key);
      }
    }
    if (toRemove.length) {
      chrome.storage.local.remove(toRemove);
      console.log('[Veritas] Cleaned up', toRemove.length, 'stale cache entries');
    }
  });
});
