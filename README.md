# Veritas Agent

> Real-time AI credibility analysis for the web. Powered by Gemini.

Veritas Agent is a browser extension + Next.js web app that analyzes content as you browse — detecting claims, verifying facts, and scoring credibility in real time.

---

## Project Structure

```
veritas-agent/
├── src/                          # Next.js web app
│   ├── app/
│   │   ├── api/
│   │   │   ├── analyze/          # Gemini-backed analysis endpoint
│   │   │   ├── fetch-url/        # Server-side article fetcher
│   │   │   └── report/           # Shareable-link store
│   │   ├── history/              # Local research log
│   │   ├── report/               # Shared report viewer (?id=…)
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   └── lib/
│       ├── history.ts            # localStorage history helpers
│       └── types.ts
├── extension/                    # Chrome MV3 extension
│   ├── manifest.json
│   ├── background/worker.js
│   ├── content/content.js        # extraction, badge, inline highlights
│   ├── popup/popup.{html,js}
│   └── options/options.{html,js} # settings UI
├── mobile/                       # Expo (React Native) iOS + Android app
│   ├── app/                      # expo-router screens (home, browse, settings)
│   ├── components/               # ScoreRing, ClaimCard, ResultView
│   └── lib/                      # api client, storage, types, theme
├── __tests__/                    # Jest tests (mocked Gemini)
└── README.md
```

---

## Quick Start

### 1. Set up the Next.js app

```bash
npm install
cp .env.example .env.local
# Add your GEMINI_API_KEY to .env.local
npm run dev
```

Visit http://localhost:3000 to use the live demo. `/history` shows past analyses run on this device, and `/report?id=…` displays a shared analysis.

### 2. Load the Chrome extension

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `extension/` folder
4. The options page opens automatically on first install — set your backend URL there

The Veritas badge will appear on articles as you browse.

---

## Configuration

All extension settings live in the **options page** (right-click the extension icon → *Options*, or press the gear button in the popup).

| Setting | Default | Description |
|---|---|---|
| Backend URL | _(empty)_ | Your deployed Next.js URL (e.g. `https://veritas.vercel.app`). Leave blank to use direct Gemini. |
| Gemini API key | _(empty)_ | Used as a fallback when the backend is unreachable. Stored in `chrome.storage.local`, never synced. |
| Badge position | bottom-right | Drag-to-corner is also supported on any page. |
| Whitelist | _(empty)_ | One domain per line — always analyze. |
| Blacklist | _(empty)_ | One domain per line — never analyze. |
| Inline claim highlights | on | Underline flagged sentences directly in articles, with a tooltip. |
| Auto-analyze on page load | on | Off → analyze only via shortcut/refresh. |

### Server-side key (recommended)

Set `GEMINI_API_KEY` in `.env.local`. The extension calls your Next.js server, which holds the key.

Optional override:
```env
GEMINI_MODEL=gemini-2.0-flash
```

### Client-side key (fallback)

If no backend is reachable, the worker falls back to calling Gemini directly using the key from the options page (stored as `geminiKey` in `chrome.storage.local`).

### Deploying

```bash
npx vercel
```

Then open the extension's options page and paste your deployed URL into **Backend URL**. No code changes required.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Alt+V` | Re-analyze the current page |
| `Alt+Shift+V` | Open the Veritas popup |

(Configurable via `chrome://extensions/shortcuts`.)

---

## How It Works

### Analysis Pipeline

1. **Content extraction** — Content script strips nav/ads and extracts readable article text
2. **Claim detection** — Gemini identifies verifiable factual statements
3. **Verification pass** — Gemini's **Google Search grounding** checks each claim against live sources, labeling it TRUE / MISLEADING / FALSE / UNVERIFIED. The real URLs it consulted are returned in `groundingMetadata` and surfaced to the user as **Sources** (see the "Sources" tab in the popup and demo). Requires a search-capable model (the default `gemini-2.5-flash` qualifies).
4. **Signal analysis** — Detects sensational language, missing sources, etc.
5. **Source rating** — Publisher reliability evaluated
6. **Score generation** — 0–100 credibility score
7. **UI delivery** — Badge, popup, and inline highlights rendered in <3 seconds

### Architecture

```
Browser tab
  └── content.js
        ├── Extracts article text
        ├── Injects credibility badge (drag-to-corner)
        ├── Highlights flagged claims inline
        └── Sends to background worker

worker.js
  ├── Reads settings (chrome.storage.sync)
  ├── Skips chrome:// / blacklisted hosts
  ├── In-flight dedup per URL
  └── POST {backend}/api/analyze
        └── Falls back to direct Gemini if backend unreachable

Next.js (/api/analyze)
  ├── Per-IP rate limit (12/min)
  ├── Length guard (200–24,000 chars)
  ├── Calls Gemini, returns structured JSON
  └── Errors return { error, code } — see "Error codes" below

Popup
  ├── Reads cached result (instant)
  ├── Refresh / Share / Settings buttons
  └── Live updates via storage.onChanged
```

### Credibility Labels

| Score | Label | Color |
|---|---|---|
| 75–100 | Verified | Green |
| 45–74 | Partially Verified | Blue |
| 25–44 | Misleading | Amber |
| 0–24 | False | Red |
| N/A | Unverified | Gray |

### Error codes

`/api/analyze` returns `{ error, code }` with one of:

| Code | When |
|---|---|
| `MISSING_CONTENT` | No `content` in body |
| `CONTENT_TOO_SHORT` | Body has < 200 chars |
| `CONTENT_TOO_LONG` | Body exceeds 24k chars |
| `RATE_LIMITED` | Too many requests from this IP |
| `UPSTREAM_RATE_LIMITED` | Gemini quota exceeded |
| `INVALID_KEY` | Gemini rejected the key |
| `SERVER_MISCONFIGURED` | Server has no `GEMINI_API_KEY` |
| `API_ERROR` | Other Gemini error |
| `PARSE_ERROR` | Gemini returned non-JSON |
| `INTERNAL_ERROR` | Unhandled exception |

The extension surfaces these as contextual messages.

---

## Web Pages

- `/` — Landing + live demo. The demo also auto-fetches article text when you paste a URL and tab away (uses `/api/fetch-url`).
- `/history` — Past analyses run from the demo on this device. Stored in `localStorage`, capped at 50 entries.
- `/report?id=…` — Shared analysis from any device.

---

## Extension Permissions

| Permission | Reason |
|---|---|
| `activeTab` | Read the current tab's URL |
| `storage` | Cache analysis results, persist settings |
| `scripting` | Inject content script |
| `host_permissions: *` | Analyze any web page |

---

## Development

```bash
npm run dev      # Next.js dev server
npm run build    # Production build
npm run lint     # ESLint
npm test         # Jest (mocks Gemini — no real API key needed)
```

To reload the extension after changes: `chrome://extensions/` → Veritas → refresh icon.

---

## Roadmap

- [x] Search-grounded citations (real source URLs per analysis)
- [x] Inline text highlighting for flagged claims
- [x] User settings popup for API key management
- [x] History dashboard
- [x] Share analysis report as link
- [x] Domain whitelist / blacklist
- [x] Drag-to-position badge
- [x] Keyboard shortcuts
- [x] Rate limiting + structured error codes
- [x] Article URL auto-fetch
- [x] Unit tests for the analyze pipeline
- [ ] Firefox support (Manifest V2 variant)
- [ ] NewsGuard / MBFC domain database integration
- [ ] Persistent share-link storage (KV) — currently in-memory
- [ ] Freemium model with usage limits

---

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, React 18
- **Styling**: CSS variables, custom design system (DM Mono + Syne)
- **AI**: Google Gemini (`gemini-2.5-flash` default; Gemini 3.x preview models also selectable)
- **Extension**: Manifest V3, Vanilla JS
- **Mobile**: Expo / React Native (iOS + Android) — see [`mobile/README.md`](mobile/README.md)
- **Tests**: Jest + ts-jest (mocked upstream)
