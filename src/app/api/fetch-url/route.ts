import { NextRequest, NextResponse } from 'next/server'

const MAX_BYTES = 1_500_000
const FETCH_TIMEOUT_MS = 8_000
const USER_AGENT =
  'Mozilla/5.0 (compatible; VeritasAgent/1.0; +https://veritas-agent.example.com/bot)'

const NOISE_TAGS = [
  'script', 'style', 'noscript', 'iframe', 'svg',
  'header', 'footer', 'nav', 'aside', 'form', 'button',
]

const ARTICLE_HINTS = [
  /<article\b[^>]*>([\s\S]*?)<\/article>/i,
  /<main\b[^>]*>([\s\S]*?)<\/main>/i,
  /<div[^>]+(?:class|id)=["'][^"']*(?:article|post|story|entry|content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
]

function strip(html: string): string {
  let out = html
  for (const tag of NOISE_TAGS) {
    const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi')
    out = out.replace(re, ' ')
  }
  out = out.replace(/<!--[\s\S]*?-->/g, ' ')
  out = out.replace(/<[^>]+>/g, ' ')
  out = out.replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
  out = out.replace(/\s+/g, ' ').trim()
  return out
}

function extractTitle(html: string): string {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
  if (og) return og[1].trim()
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (t) return strip(t[1]).slice(0, 200)
  return ''
}

function extractContent(html: string): string {
  for (const re of ARTICLE_HINTS) {
    const m = html.match(re)
    if (m) {
      const text = strip(m[1])
      if (text.length > 400) return text
    }
  }
  return strip(html)
}

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === 'localhost' || h === '0.0.0.0') return true
  if (/^127\./.test(h)) return true
  if (/^10\./.test(h)) return true
  if (/^192\.168\./.test(h)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true
  if (h.endsWith('.internal') || h.endsWith('.local')) return true
  return false
}

export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_JSON' }, { status: 400 })
  }

  const targetUrl = (body?.url || '').trim()
  if (!targetUrl) {
    return NextResponse.json({ error: 'URL is required', code: 'MISSING_URL' }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(targetUrl)
  } catch {
    return NextResponse.json({ error: 'Invalid URL', code: 'INVALID_URL' }, { status: 400 })
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return NextResponse.json({ error: 'Only http(s) URLs allowed', code: 'INVALID_URL' }, { status: 400 })
  }
  if (isBlockedHost(parsed.hostname)) {
    return NextResponse.json({ error: 'Blocked host', code: 'BLOCKED_HOST' }, { status: 400 })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(parsed.toString(), {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,*/*;q=0.8' },
      redirect: 'follow',
      signal: controller.signal,
    })
    clearTimeout(timer)

    const ct = res.headers.get('content-type') || ''
    if (!res.ok) {
      return NextResponse.json(
        { error: `Source responded ${res.status}`, code: 'SOURCE_ERROR' },
        { status: 502 },
      )
    }
    if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
      return NextResponse.json(
        { error: 'Source did not return HTML', code: 'NOT_HTML' },
        { status: 415 },
      )
    }

    const reader = res.body?.getReader()
    if (!reader) {
      return NextResponse.json(
        { error: 'No response body', code: 'EMPTY_BODY' },
        { status: 502 },
      )
    }

    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        total += value.byteLength
        if (total > MAX_BYTES) {
          await reader.cancel()
          break
        }
        chunks.push(value)
      }
    }

    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)))
    const html = buf.toString('utf8')

    const title = extractTitle(html)
    const content = extractContent(html).slice(0, 24_000)

    if (content.length < 200) {
      return NextResponse.json(
        { error: 'Could not extract enough article text', code: 'EXTRACT_FAILED' },
        { status: 422 },
      )
    }

    return NextResponse.json({
      url: parsed.toString(),
      source: parsed.hostname.replace(/^www\./, ''),
      title,
      content,
    })
  } catch (e: any) {
    clearTimeout(timer)
    const code = e?.name === 'AbortError' ? 'TIMEOUT' : 'FETCH_FAILED'
    return NextResponse.json(
      { error: e?.message || 'Fetch failed', code },
      { status: 504 },
    )
  }
}
