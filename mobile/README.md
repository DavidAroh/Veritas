# Veritas Mobile

Native iOS + Android app (Expo / React Native) that reuses the Veritas web
backend (`/api/analyze`, `/api/fetch-url`) to score the credibility of news,
articles, and social-media posts on the go.

## How content gets in

Mobile OSes sandbox apps — a background app **cannot** read what other apps
(Chrome, Twitter, a news app) are showing. So instead of "always watching,"
Veritas Mobile offers the three store-approved equivalents:

1. **Share-to-analyze** — in any app, tap **Share → Veritas**. The shared link
   or text is analyzed immediately. (Configured via `expo-share-intent` in
   `app.json`.)
2. **In-app browser** (`/browse`) — a built-in WebView that auto-analyzes every
   page you open and shows a floating credibility badge, just like the desktop
   extension.
3. **Paste** — drop a URL or article text on the home screen and tap Analyze.
4. **Floating bubble (Android only)** — see below.

## Floating bubble overlay (Android only)

A draggable Veritas "V" bubble that floats **over other apps**. While you're in
a social or news app, tap it → Veritas reads the current screen and fact-checks
what you're looking at, then opens with the verdict.

Implemented as a native Expo module in [`modules/veritas-overlay/`](modules/veritas-overlay)
using two Android system capabilities:

- **`SYSTEM_ALERT_WINDOW`** ("Display over other apps") — draws the bubble via a
  foreground `OverlayService`.
- **An `AccessibilityService`** — reads the foreground app's on-screen text when
  the bubble is tapped (`VeritasAccessibilityService.grabScreenText()`).

Enable it in **Settings → Floating bubble**: grant "Display over other apps",
enable the Veritas accessibility service, then toggle **Show bubble**.

Once active:
- **Tap** the bubble → it reads the screen, analyzes it, and shows the verdict
  in an **overlay panel right on top of the app you're in** (you never leave).
  Tap ✕ (or the bubble again) to close the panel.
- **Long-press** the bubble → dismiss/hide it.
- **Drag** to reposition.

The bubble runs the analysis natively (Kotlin), calling your **Backend URL** —
or your **Gemini key** as a fallback — so make sure one of those is set in
Settings *before* enabling the bubble (the config is captured when you toggle it
on; re-toggle after changing settings).

> ### ⚠️ Important constraints
> - **iOS cannot do this at all.** Apple forbids floating over other apps and
>   reading other apps' screens. The feature is hidden on iOS (the native module
>   is Android-only; `overlaySupported` is `false`).
> - **Requires a native build.** Overlays + accessibility services don't work in
>   Expo Go — build a dev client / APK with `npx expo run:android` or EAS.
> - **Google Play policy risk.** Play restricts `AccessibilityService` to genuine
>   accessibility use. Shipping this on the Play Store may require a policy
>   declaration/exception or risk removal. It works fine for sideloaded / EAS
>   internal builds. Consider this an advanced, opt-in feature.
> - The result panel is built with **native Android views** (not React Native),
>   so it intentionally shows a focused subset: score, label, summary, verdict,
>   and claims. Open the app for the full breakdown (sources, signals, history).

## Setup

```bash
cd mobile
npm install
npx expo start
```

Press `i` (iOS simulator), `a` (Android emulator), or scan the QR with the
**Expo Go** app.

> **Note on share extensions & notifications:** `expo-share-intent` and
> `expo-notifications` require a custom dev client / native build — they don't
> run in the stock Expo Go app. Build one with:
> ```bash
> npx expo run:ios      # or: npx expo run:android
> ```

## Configuration

Open **Settings** in the app and set:

| Setting | Purpose |
|---|---|
| **Backend URL** | Your deployed Veritas web app (e.g. `https://veritas.vercel.app`). Required to analyze *links* (server fetches the article) and for the most reliable analysis. |
| **Gemini API key** | Fallback used when no backend is set or it's unreachable. Stored only on-device. |
| **Gemini model** | Which model to use for the direct-key fallback. |
| **Auto-analyze in browser** | Toggle automatic analysis in the in-app browser. |

If you run the web app locally, use your machine's LAN IP (e.g.
`http://192.168.1.20:3000`) as the Backend URL so the phone can reach it.

## Project layout

```
mobile/
├── app/
│   ├── _layout.tsx      # Stack nav + notification handler
│   ├── index.tsx        # Home: paste / share-to-analyze + history
│   ├── browse.tsx       # In-app browser with auto-analysis + badge
│   └── settings.tsx     # Backend URL, Gemini key, model, toggles
├── components/
│   ├── ScoreRing.tsx
│   ├── ClaimCard.tsx
│   └── ResultView.tsx   # Full result: score, claims, sources, signals
├── lib/
│   ├── api.ts           # analyze() + fetchUrl() (backend → direct Gemini)
│   ├── storage.ts       # AsyncStorage settings + history
│   ├── types.ts         # Shared with the web app's src/lib/types.ts
│   ├── theme.ts         # Brand palette + score/label colors
│   └── overlay.ts       # Safe JS wrapper over the native overlay module
└── modules/
    └── veritas-overlay/ # Native Android module (Kotlin)
        ├── index.ts                       # JS bridge
        └── android/.../                    # OverlayService, AccessibilityService,
                                            # VeritasOverlayModule, manifest, xml
```

## Roadmap / not yet wired

- Notification quick-action to analyze the current clipboard (handler stubbed
  in `_layout.tsx`; needs a background task + action category).
- iOS Share Extension UI polish (currently routes shared content into the app).
- Deep-link into a shared `/report?id=…` from the web app.
