/**
 * Tests for /api/fetch-url — the server-side article fetcher.
 *
 * Covers input validation, SSRF host blocking, content-type / status
 * handling, extraction, and timeout behavior. The network is fully
 * mocked via global.fetch — no real requests are made. Blocked-host and
 * invalid-URL cases must reject *before* any fetch, so we assert fetch
 * was never called for those.
 */
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/fetch-url/route'

function postReq(body: any): NextRequest {
  return new NextRequest('http://localhost/api/fetch-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Builds a fake fetch Response whose body streams `html` as a single chunk,
// matching the getReader() loop the route uses.
function mockHtmlResponse(
  html: string,
  { status = 200, contentType = 'text/html; charset=utf-8' } = {},
) {
  const bytes = new TextEncoder().encode(html)
  let sent = false
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (k: string) =>
        k.toLowerCase() === 'content-type' ? contentType : null,
    },
    body: {
      getReader: () => ({
        read: async () =>
          sent
            ? { done: true, value: undefined }
            : ((sent = true), { done: false, value: bytes }),
        cancel: async () => {},
      }),
    },
  }
}

const ARTICLE_HTML = `
<html>
  <head>
    <title>Fallback Title</title>
    <meta property="og:title" content="The Real Headline" />
  </head>
  <body>
    <nav>home about contact</nav>
    <article>
      <p>${'This is a substantial paragraph of article text that should easily clear the extraction threshold. '.repeat(8)}</p>
    </article>
    <footer>copyright</footer>
  </body>
</html>`

afterEach(() => {
  ;(global as any).fetch = undefined
  jest.restoreAllMocks()
})

describe('fetch-url — input validation', () => {
  it('rejects a missing url with MISSING_URL', async () => {
    const fetchSpy = ((global as any).fetch = jest.fn())
    const res = await POST(postReq({}))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('MISSING_URL')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects a malformed url with INVALID_URL', async () => {
    const fetchSpy = ((global as any).fetch = jest.fn())
    const res = await POST(postReq({ url: 'not a url' }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('INVALID_URL')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects non-http(s) protocols with INVALID_URL', async () => {
    const fetchSpy = ((global as any).fetch = jest.fn())
    const res = await POST(postReq({ url: 'ftp://example.com/file' }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('INVALID_URL')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects invalid JSON bodies with INVALID_JSON', async () => {
    const req = new NextRequest('http://localhost/api/fetch-url', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'this is not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('INVALID_JSON')
  })
})

describe('fetch-url — SSRF host blocking', () => {
  const blocked = [
    'http://localhost/admin',
    'http://127.0.0.1/',
    'http://10.0.0.5/',
    'http://192.168.1.1/',
    'http://172.16.0.1/',
    'https://db.internal/',
    'https://printer.local/',
  ]

  for (const url of blocked) {
    it(`blocks ${url} without fetching`, async () => {
      const fetchSpy = ((global as any).fetch = jest.fn())
      const res = await POST(postReq({ url }))
      expect(res.status).toBe(400)
      expect((await res.json()).code).toBe('BLOCKED_HOST')
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  }
})

describe('fetch-url — fetching and extraction', () => {
  it('extracts title and article text from a public page', async () => {
    ;(global as any).fetch = jest.fn().mockResolvedValue(mockHtmlResponse(ARTICLE_HTML))

    const res = await POST(postReq({ url: 'https://news.example.com/story?utm=1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title).toBe('The Real Headline')
    expect(body.source).toBe('news.example.com')
    expect(body.content.length).toBeGreaterThan(200)
    // Noise tags should have been stripped out of the extracted text.
    expect(body.content).not.toContain('copyright')
    expect(body.content).not.toContain('home about contact')
  })

  it('returns NOT_HTML for non-HTML content types', async () => {
    ;(global as any).fetch = jest
      .fn()
      .mockResolvedValue(mockHtmlResponse('{"a":1}', { contentType: 'application/json' }))

    const res = await POST(postReq({ url: 'https://api.example.com/data' }))
    expect(res.status).toBe(415)
    expect((await res.json()).code).toBe('NOT_HTML')
  })

  it('maps an upstream error status to SOURCE_ERROR', async () => {
    ;(global as any).fetch = jest
      .fn()
      .mockResolvedValue(mockHtmlResponse('', { status: 500 }))

    const res = await POST(postReq({ url: 'https://example.com/down' }))
    expect(res.status).toBe(502)
    expect((await res.json()).code).toBe('SOURCE_ERROR')
  })

  it('returns EXTRACT_FAILED when too little text is recovered', async () => {
    ;(global as any).fetch = jest
      .fn()
      .mockResolvedValue(mockHtmlResponse('<html><body><p>tiny</p></body></html>'))

    const res = await POST(postReq({ url: 'https://example.com/empty' }))
    expect(res.status).toBe(422)
    expect((await res.json()).code).toBe('EXTRACT_FAILED')
  })
})

describe('fetch-url — network failures', () => {
  it('maps an aborted request to TIMEOUT', async () => {
    ;(global as any).fetch = jest
      .fn()
      .mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }))

    const res = await POST(postReq({ url: 'https://slow.example.com' }))
    expect(res.status).toBe(504)
    expect((await res.json()).code).toBe('TIMEOUT')
  })

  it('maps a generic fetch failure to FETCH_FAILED', async () => {
    ;(global as any).fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'))

    const res = await POST(postReq({ url: 'https://gone.example.com' }))
    expect(res.status).toBe(504)
    expect((await res.json()).code).toBe('FETCH_FAILED')
  })
})
