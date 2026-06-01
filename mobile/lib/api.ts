// API client for the mobile app. Mirrors the extension's background worker:
// it prefers the configured backend (/api/analyze) and falls back to calling
// Gemini directly with the user's stored key. Also wraps /api/fetch-url so the
// app can analyze a bare URL (e.g. from a Share sheet) without scraping itself.

import type { AnalysisResult, Settings, Source } from './types'

const MAX_CONTENT_CHARS = 6000

const SYSTEM_PROMPT = `You are Veritas Agent, an AI-powered truth verification assistant.
Analyze information from the internet and determine its credibility.

Use the Google Search tool to verify claims against current, real sources before labeling them.
Extract 3-6 verifiable claims, label each TRUE/MISLEADING/FALSE/UNVERIFIED, detect misinformation
signals, evaluate source credibility, and produce a 0-100 credibility score.

Return ONLY valid JSON, no markdown, no code fences:
{
  "page_summary": "2-3 sentence summary",
  "credibility_score": 0,
  "credibility_label": "Verified|Partially Verified|Misleading|Unverified|False",
  "claims": [{"claim":"","verification":"TRUE|MISLEADING|FALSE|UNVERIFIED","confidence":"87%","reason":""}],
  "misinformation_signals": [],
  "source_reliability": "High|Medium|Low|Unknown - brief note",
  "final_verdict": "1-sentence verdict",
  "user_warning_message": ""
}`

export class AnalysisError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export interface AnalyzePayload {
  url?: string
  title?: string
  source?: string
  content: string
}

export async function analyze(
  payload: AnalyzePayload,
  settings: Settings,
): Promise<AnalysisResult> {
  const apiBase = (settings.apiBase || '').replace(/\/+$/, '')

  // 1) Preferred: the deployed Next.js backend (holds the server-side key).
  if (apiBase) {
    try {
      const res = await fetch(`${apiBase}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) return (await res.json()) as AnalysisResult
      const err = await res.json().catch(() => ({}))
      if (res.status >= 400 && res.status < 500 && err.code) {
        throw new AnalysisError(err.code, err.error || 'Backend error')
      }
      // 5xx → fall through to direct Gemini
    } catch (e) {
      if (e instanceof AnalysisError) throw e
      // network error → fall through
    }
  }

  // 2) Fallback: direct Gemini call with the user's key.
  return analyzeDirect(payload, settings)
}

async function analyzeDirect(
  payload: AnalyzePayload,
  settings: Settings,
): Promise<AnalysisResult> {
  if (!settings.geminiKey) {
    throw new AnalysisError(
      'NO_API_KEY',
      'No backend URL and no Gemini key set. Add one in Settings.',
    )
  }
  const model = settings.geminiModel || 'gemini-2.5-flash'
  const content = (payload.content || '').slice(0, MAX_CONTENT_CHARS)
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.geminiKey}`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify({ ...payload, content }) }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null as any)
    if (res.status === 429) throw new AnalysisError('UPSTREAM_RATE_LIMITED', 'Gemini quota exceeded.')
    if (res.status === 401 || res.status === 403) throw new AnalysisError('INVALID_KEY', 'Gemini rejected the key.')
    throw new AnalysisError('API_ERROR', body?.error?.message || `Gemini error ${res.status}`)
  }

  const data = await res.json()
  const candidate = data.candidates?.[0]
  const text = (candidate?.content?.parts || [])
    .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
    .join('')
  const clean = text.replace(/```json|```/g, '').trim()
  let parsed: AnalysisResult
  try {
    parsed = JSON.parse(clean)
  } catch {
    throw new AnalysisError('PARSE_ERROR', 'Could not parse Gemini response.')
  }
  parsed.sources = extractGroundingSources(candidate)
  if (!Array.isArray(parsed.claims)) parsed.claims = []
  if (!Array.isArray(parsed.misinformation_signals)) parsed.misinformation_signals = []
  return parsed
}

function extractGroundingSources(candidate: any): Source[] {
  const chunks = candidate?.groundingMetadata?.groundingChunks
  if (!Array.isArray(chunks)) return []
  const seen = new Set<string>()
  const out: Source[] = []
  for (const chunk of chunks) {
    const url = (chunk?.web?.uri || '').trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    out.push({ url, title: (chunk?.web?.title || '').trim() || url })
  }
  return out
}

// Resolve a bare URL into { title, source, content } via the backend scraper.
export async function fetchUrl(
  url: string,
  settings: Settings,
): Promise<{ url: string; source: string; title: string; content: string }> {
  const apiBase = (settings.apiBase || '').replace(/\/+$/, '')
  if (!apiBase) {
    throw new AnalysisError('NO_BACKEND', 'A backend URL is required to fetch article text from a link.')
  }
  const res = await fetch(`${apiBase}/api/fetch-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  const data = await res.json()
  if (!res.ok) throw new AnalysisError(data.code || 'FETCH_FAILED', data.error || 'Could not fetch the link.')
  return data
}
