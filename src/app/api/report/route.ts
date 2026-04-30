import { NextRequest, NextResponse } from 'next/server'

// Lightweight share-link store. Lives in process memory so links survive
// only as long as the server instance does. Production should swap this
// for a real key-value store (Vercel KV, Upstash, Redis).
type StoredReport = {
  id: string
  url?: string
  result: unknown
  createdAt: number
}

const TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const MAX_REPORTS = 5_000

const store: Map<string, StoredReport> = (globalThis as any).__veritasReports
  || ((globalThis as any).__veritasReports = new Map<string, StoredReport>())

function gc() {
  const now = Date.now()
  store.forEach((r, id) => {
    if (now - r.createdAt > TTL_MS) store.delete(id)
  })
  if (store.size > MAX_REPORTS) {
    const entries: Array<[string, StoredReport]> = []
    store.forEach((r, id) => entries.push([id, r]))
    entries.sort((a, b) => a[1].createdAt - b[1].createdAt)
    const drop = entries.slice(0, store.size - MAX_REPORTS)
    drop.forEach(([id]) => store.delete(id))
  }
}

function newId(): string {
  // 12-char URL-safe id; collision-free at our scale
  const bytes = new Uint8Array(9)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('base64url')
}

function isValidResult(r: any): boolean {
  return (
    r &&
    typeof r === 'object' &&
    typeof r.credibility_score === 'number' &&
    typeof r.credibility_label === 'string' &&
    Array.isArray(r.claims)
  )
}

export async function POST(request: NextRequest) {
  let body: any
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_JSON' }, { status: 400 })
  }

  if (!isValidResult(body?.result)) {
    return NextResponse.json(
      { error: 'Result is missing or malformed', code: 'INVALID_RESULT' },
      { status: 400 },
    )
  }

  gc()
  const id = newId()
  store.set(id, {
    id,
    url: typeof body.url === 'string' ? body.url.slice(0, 2000) : undefined,
    result: body.result,
    createdAt: Date.now(),
  })

  return NextResponse.json({ id, expiresAt: Date.now() + TTL_MS })
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id is required', code: 'MISSING_ID' }, { status: 400 })
  }
  const found = store.get(id)
  if (!found) {
    return NextResponse.json({ error: 'Report not found or expired', code: 'NOT_FOUND' }, { status: 404 })
  }
  return NextResponse.json(found)
}
