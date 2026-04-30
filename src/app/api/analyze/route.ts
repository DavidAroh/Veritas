import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are Veritas Agent, an AI-powered truth verification assistant.
Your role is to analyze information from the internet and determine its credibility.

ANALYSIS PROCESS:
Step 1 — Understand the content and determine the main topic.
Step 2 — Extract verifiable claims (ignore opinions/subjective statements).
Step 3 — For each claim, label it: TRUE, MISLEADING, FALSE, or UNVERIFIED.
Step 4 — Detect misinformation signals: sensational language, lack of sources, conspiratorial framing, misleading statistics, emotional manipulation.
Step 5 — Evaluate source/publisher credibility if available.
Step 6 — Generate a credibility score 0–100.
Step 7 — Generate concise UI insights.

OUTPUT FORMAT — return ONLY valid JSON, no markdown, no prose, no code fences:
{
  "page_summary": "2-3 sentence summary of what this page is about",
  "credibility_score": 0,
  "credibility_label": "Verified|Partially Verified|Misleading|Unverified|False",
  "claims": [
    {
      "claim": "exact claim text",
      "verification": "TRUE|MISLEADING|FALSE|UNVERIFIED",
      "confidence": "87%",
      "reason": "concise 1-sentence reason"
    }
  ],
  "misinformation_signals": ["signal 1", "signal 2"],
  "source_reliability": "High|Medium|Low|Unknown — brief note",
  "final_verdict": "1-sentence plain-language verdict",
  "user_warning_message": "short warning or empty string if clean"
}

RULES:
- Be neutral and evidence-based
- Do not assume claims are true without reasoning
- Clearly indicate uncertainty
- Avoid hallucinating facts
- If verification cannot be determined, label UNVERIFIED
- Extract 3–6 claims maximum
- Keep all text concise (browser extension UI)
- Return ONLY the JSON object, nothing else`

const MIN_CONTENT_CHARS = 200
const MAX_CONTENT_CHARS = 6000
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 12

type ErrorCode =
  | 'MISSING_CONTENT'
  | 'CONTENT_TOO_SHORT'
  | 'CONTENT_TOO_LONG'
  | 'RATE_LIMITED'
  | 'SERVER_MISCONFIGURED'
  | 'UPSTREAM_RATE_LIMITED'
  | 'INVALID_KEY'
  | 'API_ERROR'
  | 'PARSE_ERROR'
  | 'INTERNAL_ERROR'

function errorResponse(code: ErrorCode, message: string, status: number) {
  return NextResponse.json({ error: message, code }, { status })
}

const rateBuckets = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now()
  const bucket = rateBuckets.get(ip)
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { ok: true }
  }
  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  bucket.count += 1
  return { ok: true }
}

// Periodic cleanup so the map doesn't grow unbounded.
if (typeof globalThis !== 'undefined' && !(globalThis as any).__veritasRateCleanup) {
  ;(globalThis as any).__veritasRateCleanup = setInterval(() => {
    const now = Date.now()
    rateBuckets.forEach((b, ip) => {
      if (b.resetAt < now) rateBuckets.delete(ip)
    })
  }, RATE_LIMIT_WINDOW_MS).unref?.()
}

function clientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for') || ''
  return xff.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown'
}

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request)
    const limit = checkRateLimit(ip)
    if (!limit.ok) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${limit.retryAfter}s.`, code: 'RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
      )
    }

    const body = await request.json().catch(() => null)
    if (!body) return errorResponse('MISSING_CONTENT', 'Request body is required', 400)

    const { url, title, source, content } = body as {
      url?: string; title?: string; source?: string; content?: string
    }

    if (!content || typeof content !== 'string') {
      return errorResponse('MISSING_CONTENT', 'Content is required', 400)
    }
    if (content.trim().length < MIN_CONTENT_CHARS) {
      return errorResponse(
        'CONTENT_TOO_SHORT',
        `Content is too short to analyze (need ≥ ${MIN_CONTENT_CHARS} characters).`,
        400,
      )
    }
    if (content.length > MAX_CONTENT_CHARS * 4) {
      return errorResponse(
        'CONTENT_TOO_LONG',
        `Content exceeds ${MAX_CONTENT_CHARS * 4} characters. Trim before sending.`,
        413,
      )
    }

    const truncatedContent = content.slice(0, MAX_CONTENT_CHARS)

    const apiKey = process.env.GEMINI_API_KEY || ''
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not set')
      return errorResponse(
        'SERVER_MISCONFIGURED',
        'Server configuration error: GEMINI_API_KEY is missing',
        500,
      )
    }

    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{
          role: 'user',
          parts: [{ text: JSON.stringify({ url, title, source, content: truncatedContent }) }],
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2000,
          responseMimeType: 'application/json',
        },
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Gemini API error:', response.status, err)

      if (response.status === 429) {
        return errorResponse(
          'UPSTREAM_RATE_LIMITED',
          'Gemini quota exceeded. Try again later or check https://aistudio.google.com.',
          429,
        )
      }
      if (response.status === 401 || response.status === 403) {
        return errorResponse('INVALID_KEY', 'Gemini rejected the API key.', response.status)
      }

      let geminiError = 'Analysis failed'
      try {
        const parsed = JSON.parse(err)
        geminiError = parsed?.error?.message || geminiError
      } catch {}
      return errorResponse('API_ERROR', `Gemini API error: ${geminiError}`, 502)
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    const clean = text.replace(/```json|```/g, '').trim()
    let result
    try {
      result = JSON.parse(clean)
    } catch {
      return errorResponse('PARSE_ERROR', 'Failed to parse analysis result', 502)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Analysis route error:', error)
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500)
  }
}

export const __test = { checkRateLimit, rateBuckets, MIN_CONTENT_CHARS, MAX_CONTENT_CHARS }
