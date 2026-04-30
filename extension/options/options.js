// Veritas Agent — Options page
// All settings live in chrome.storage.sync so they roam across devices.

const DEFAULTS = {
  apiBase: 'http://localhost:3000',
  geminiKey: '',
  geminiModel: 'gemini-2.5-flash',
  badgeCorner: 'bottom-right',
  whitelist: [],
  blacklist: [],
  inlineHighlights: true,
  autoAnalyze: true,
};

const PRESET_MODELS = [
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-pro-latest',
  'gemini-3.1-pro-preview',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite-preview',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
];

const $ = (id) => document.getElementById(id);

function parseDomains(text) {
  return text
    .split(/[\n,]/)
    .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
    .filter(Boolean);
}

function applyModelToUi(model) {
  const select = $('geminiModel');
  const custom = $('geminiModelCustom');
  if (PRESET_MODELS.includes(model)) {
    select.value = model;
    custom.style.display = 'none';
    custom.value = '';
  } else {
    select.value = '__custom__';
    custom.style.display = 'block';
    custom.value = model;
  }
}

function readModelFromUi() {
  const sel = $('geminiModel').value;
  if (sel === '__custom__') {
    return ($('geminiModelCustom').value || '').trim() || DEFAULTS.geminiModel;
  }
  return sel;
}

function load() {
  chrome.storage.sync.get(DEFAULTS, (s) => {
    $('apiBase').value = s.apiBase || '';
    $('badgeCorner').value = s.badgeCorner;
    $('whitelist').value = (s.whitelist || []).join('\n');
    $('blacklist').value = (s.blacklist || []).join('\n');
    $('inlineHighlights').checked = !!s.inlineHighlights;
    $('autoAnalyze').checked = !!s.autoAnalyze;
    applyModelToUi(s.geminiModel || DEFAULTS.geminiModel);
  });
  // API key stays local — never synced
  chrome.storage.local.get(['geminiKey'], (s) => {
    $('geminiKey').value = s.geminiKey || '';
  });
}

function save() {
  const settings = {
    apiBase: ($('apiBase').value || '').trim().replace(/\/+$/, ''),
    badgeCorner: $('badgeCorner').value,
    whitelist: parseDomains($('whitelist').value),
    blacklist: parseDomains($('blacklist').value),
    inlineHighlights: $('inlineHighlights').checked,
    autoAnalyze: $('autoAnalyze').checked,
    geminiModel: readModelFromUi(),
  };
  chrome.storage.sync.set(settings);
  chrome.storage.local.set({ geminiKey: ($('geminiKey').value || '').trim() });

  const toast = $('toast');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1600);
}

function reset() {
  chrome.storage.sync.set(DEFAULTS);
  chrome.storage.local.remove('geminiKey');
  load();
}

document.addEventListener('DOMContentLoaded', () => {
  load();
  $('save').addEventListener('click', save);
  $('reset').addEventListener('click', reset);
  $('geminiModel').addEventListener('change', (e) => {
    const isCustom = e.target.value === '__custom__';
    $('geminiModelCustom').style.display = isCustom ? 'block' : 'none';
    if (isCustom) $('geminiModelCustom').focus();
  });
});
