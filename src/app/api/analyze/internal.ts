// Internal helpers for the /api/analyze route. Lives in a sibling file
// because Next.js route files may only export route handlers — exporting
// arbitrary symbols from `route.ts` is a build-time type error.

import type {
  AnalysisResult,
  Claim,
  CredibilityLabel,
  Source,
  VerificationStatus,
} from '@/lib/types'

export const MIN_CONTENT_CHARS = 200
export const MAX_CONTENT_CHARS = 6000
export const RATE_LIMIT_WINDOW_MS = 60_000
export const RATE_LIMIT_MAX_REQUESTS = 12

export type ErrorCode =
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

export const rateBuckets = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(
  ip: string,
): { ok: true } | { ok: false; retryAfter: number } {
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

// ─── Output validation ──────────────────────────────────────────────────
// Gemini is instructed to return a fixed JSON shape, but a model can drift:
// out-of-range scores, invalid labels, malformed claims. We coerce the raw
// parse into a known-good AnalysisResult so the UI and the /report store
// never see surprises. Returns null only when the payload is too far gone
// to be a meaningful analysis (no usable score), which the route maps to
// PARSE_ERROR.

const VALID_LABELS: CredibilityLabel[] = [
  'Verified', 'Partially Verified', 'Misleading', 'Unverified', 'False',
]
const VALID_VERIFICATIONS: VerificationStatus[] = [
  'TRUE', 'MISLEADING', 'FALSE', 'UNVERIFIED',
]

function labelForScore(score: number): CredibilityLabel {
  if (score >= 75) return 'Verified'
  if (score >= 45) return 'Partially Verified'
  if (score >= 25) return 'Misleading'
  return 'False'
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

// Pulls the real web sources Gemini consulted out of its grounding metadata.
// Shape (v1beta REST): candidate.groundingMetadata.groundingChunks[].web = { uri, title }.
// These are the trustworthy citations — never the URLs the model writes in
// its own text, which it tends to fabricate.
export function extractGroundingSources(candidate: unknown): Source[] {
  if (!candidate || typeof candidate !== 'object') return []
  const meta = (candidate as any).groundingMetadata
  const chunks = meta?.groundingChunks
  if (!Array.isArray(chunks)) return []

  const sources: Source[] = []
  for (const chunk of chunks) {
    const url = asString(chunk?.web?.uri).trim()
    if (!url) continue
    sources.push({ url, title: asString(chunk?.web?.title).trim() || url })
  }
  return dedupeSources(sources)
}

function dedupeSources(sources: Source[]): Source[] {
  const seen = new Set<string>()
  const out: Source[] = []
  for (const s of sources) {
    if (seen.has(s.url)) continue
    seen.add(s.url)
    out.push(s)
  }
  return out
}

export function normalizeResult(
  raw: unknown,
  groundingSources: Source[] = [],
): AnalysisResult | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>

  // A meaningful analysis must carry a numeric score. Accept numeric strings
  // ("72") but reject anything that isn't finite once coerced.
  const rawScore =
    typeof r.credibility_score === 'number'
      ? r.credibility_score
      : Number(r.credibility_score)
  if (!Number.isFinite(rawScore)) return null
  const credibility_score = Math.max(0, Math.min(100, Math.round(rawScore)))

  const credibility_label = VALID_LABELS.includes(
    r.credibility_label as CredibilityLabel,
  )
    ? (r.credibility_label as CredibilityLabel)
    : labelForScore(credibility_score)

  const claims: Claim[] = Array.isArray(r.claims)
    ? r.claims
        .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
        .map((c) => ({
          claim: asString(c.claim),
          verification: VALID_VERIFICATIONS.includes(
            c.verification as VerificationStatus,
          )
            ? (c.verification as VerificationStatus)
            : 'UNVERIFIED',
          confidence: asString(c.confidence),
          reason: asString(c.reason),
        }))
        .filter((c) => c.claim.length > 0)
    : []

  const misinformation_signals = Array.isArray(r.misinformation_signals)
    ? r.misinformation_signals.filter((s): s is string => typeof s === 'string')
    : []

  // Grounding sources are authoritative; also accept any well-formed sources
  // the model echoed in its JSON, then dedupe by URL.
  const modelSources: Source[] = Array.isArray(r.sources)
    ? r.sources
        .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
        .map((s) => ({ url: asString(s.url).trim(), title: asString(s.title).trim() }))
        .filter((s) => s.url.length > 0)
        .map((s) => ({ url: s.url, title: s.title || s.url }))
    : []

  return {
    page_summary: asString(r.page_summary),
    credibility_score,
    credibility_label,
    claims,
    misinformation_signals,
    source_reliability: asString(r.source_reliability, 'Unknown'),
    final_verdict: asString(r.final_verdict),
    user_warning_message: asString(r.user_warning_message),
    sources: dedupeSources([...groundingSources, ...modelSources]),
  }
}

// Periodic cleanup so the bucket map doesn't grow unbounded.
if (typeof globalThis !== 'undefined' && !(globalThis as any).__veritasRateCleanup) {
  ;(globalThis as any).__veritasRateCleanup = setInterval(() => {
    const now = Date.now()
    rateBuckets.forEach((b, ip) => {
      if (b.resetAt < now) rateBuckets.delete(ip)
    })
  }, RATE_LIMIT_WINDOW_MS).unref?.()
}
