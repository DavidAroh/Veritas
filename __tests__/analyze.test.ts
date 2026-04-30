/**
 * Tests for /api/analyze — verifies the claim verification pipeline
 * shape, error handling, and rate limiting.
 *
 * The Gemini API is fully mocked via global.fetch — no network calls,
 * no real API key required.
 */
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/analyze/route'
import { rateBuckets, MAX_CONTENT_CHARS } from '@/app/api/analyze/internal'

const VALID_RESPONSE = {
  page_summary: 'A short test summary.',
  credibility_score: 72,
  credibility_label: 'Partially Verified',
  claims: [
    { claim: 'Test claim A', verification: 'TRUE',       confidence: '90%', reason: 'reasonable evidence' },
    { claim: 'Test claim B', verification: 'MISLEADING', confidence: '60%', reason: 'context missing' },
  ],
  misinformation_signals: ['vague sourcing'],
  source_reliability: 'Medium - reasonable outlet',
  final_verdict: 'Generally accurate but with caveats.',
  user_warning_message: '',
}

function mockGeminiSuccess(payload: unknown = VALID_RESPONSE) {
  return jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
    text: async () => '',
  })
}

function mockGeminiError(status: number, body: any = { error: { message: 'oops' } }) {
  return jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  })
}

function buildRequest(body: any, ip = '1.2.3.4'): NextRequest {
  return new NextRequest('http://localhost/api/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

const LONG_CONTENT = 'x'.repeat(500)

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-key'
  rateBuckets.clear()
})

afterEach(() => {
  ;(global as any).fetch = undefined
})

describe('analyze route — happy path', () => {
  it('returns the parsed Gemini JSON when content is valid', async () => {
    ;(global as any).fetch = mockGeminiSuccess()

    const res = await POST(buildRequest({
      url: 'https://example.com', title: 'T', source: 'example.com',
      content: LONG_CONTENT,
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.credibility_score).toBe(72)
    expect(body.credibility_label).toBe('Partially Verified')
    expect(Array.isArray(body.claims)).toBe(true)
    expect(body.claims).toHaveLength(2)
    expect(body.claims[0]).toMatchObject({
      claim: expect.any(String),
      verification: expect.stringMatching(/^(TRUE|MISLEADING|FALSE|UNVERIFIED)$/),
      confidence: expect.any(String),
      reason: expect.any(String),
    })
  })

  it('strips ```json fences from Gemini output before parsing', async () => {
    ;(global as any).fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200, text: async () => '',
      json: async () => ({
        candidates: [{ content: { parts: [{
          text: '```json\n' + JSON.stringify(VALID_RESPONSE) + '\n```',
        }] } }],
      }),
    })

    const res = await POST(buildRequest({
      url: 'https://example.com', title: 'T', source: 'example.com',
      content: LONG_CONTENT,
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.credibility_label).toBe('Partially Verified')
  })
})

describe('analyze route — input validation', () => {
  it('rejects missing content with code MISSING_CONTENT', async () => {
    const res = await POST(buildRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('MISSING_CONTENT')
  })

  it('rejects too-short content with code CONTENT_TOO_SHORT', async () => {
    const res = await POST(buildRequest({ content: 'too short' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('CONTENT_TOO_SHORT')
  })

  it('rejects oversized content with code CONTENT_TOO_LONG', async () => {
    const huge = 'x'.repeat(MAX_CONTENT_CHARS * 4 + 100)
    const res = await POST(buildRequest({ content: huge }))
    expect(res.status).toBe(413)
    const body = await res.json()
    expect(body.code).toBe('CONTENT_TOO_LONG')
  })
})

describe('analyze route — upstream errors', () => {
  it('maps Gemini 429 to UPSTREAM_RATE_LIMITED', async () => {
    ;(global as any).fetch = mockGeminiError(429)
    const res = await POST(buildRequest({ content: LONG_CONTENT }))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.code).toBe('UPSTREAM_RATE_LIMITED')
  })

  it('maps Gemini 401 to INVALID_KEY', async () => {
    ;(global as any).fetch = mockGeminiError(401)
    const res = await POST(buildRequest({ content: LONG_CONTENT }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('INVALID_KEY')
  })

  it('returns PARSE_ERROR when Gemini returns garbage text', async () => {
    ;(global as any).fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200, text: async () => '',
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'not json at all' }] } }],
      }),
    })
    const res = await POST(buildRequest({ content: LONG_CONTENT }))
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.code).toBe('PARSE_ERROR')
  })
})

describe('analyze route — rate limiting', () => {
  it('returns RATE_LIMITED after the 13th request from one IP', async () => {
    ;(global as any).fetch = mockGeminiSuccess()
    let lastStatus = 200
    let lastCode = ''
    for (let i = 0; i < 13; i++) {
      const res = await POST(buildRequest({ content: LONG_CONTENT }, '9.9.9.9'))
      lastStatus = res.status
      lastCode = (await res.json()).code || ''
    }
    expect(lastStatus).toBe(429)
    expect(lastCode).toBe('RATE_LIMITED')
  })

  it('does NOT rate-limit a different IP', async () => {
    ;(global as any).fetch = mockGeminiSuccess()
    // Burn out IP A
    for (let i = 0; i < 13; i++) {
      await POST(buildRequest({ content: LONG_CONTENT }, '8.8.8.8'))
    }
    // IP B should still succeed
    const res = await POST(buildRequest({ content: LONG_CONTENT }, '7.7.7.7'))
    expect(res.status).toBe(200)
  })
})

describe('analyze route — server config', () => {
  it('returns SERVER_MISCONFIGURED when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY
    const res = await POST(buildRequest({ content: LONG_CONTENT }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.code).toBe('SERVER_MISCONFIGURED')
  })
})
