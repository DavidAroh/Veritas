// Internal helpers for the /api/analyze route. Lives in a sibling file
// because Next.js route files may only export route handlers — exporting
// arbitrary symbols from `route.ts` is a build-time type error.

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

// Periodic cleanup so the bucket map doesn't grow unbounded.
if (typeof globalThis !== 'undefined' && !(globalThis as any).__veritasRateCleanup) {
  ;(globalThis as any).__veritasRateCleanup = setInterval(() => {
    const now = Date.now()
    rateBuckets.forEach((b, ip) => {
      if (b.resetAt < now) rateBuckets.delete(ip)
    })
  }, RATE_LIMIT_WINDOW_MS).unref?.()
}
