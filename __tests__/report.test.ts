/**
 * Tests for the /api/report share endpoint round-trip.
 */
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/report/route'

const VALID_RESULT = {
  page_summary: 'A summary',
  credibility_score: 88,
  credibility_label: 'Verified',
  claims: [{ claim: 'x', verification: 'TRUE', confidence: '95%', reason: 'r' }],
  misinformation_signals: [],
  source_reliability: 'High',
  final_verdict: 'Trustworthy.',
  user_warning_message: '',
}

function postReq(body: any): NextRequest {
  return new NextRequest('http://localhost/api/report', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function getReq(id: string | null): NextRequest {
  const url = new URL('http://localhost/api/report')
  if (id !== null) url.searchParams.set('id', id)
  return new NextRequest(url, { method: 'GET' })
}

describe('report route', () => {
  it('rejects an invalid result shape', async () => {
    const res = await POST(postReq({ url: 'https://x', result: { not: 'valid' } }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('INVALID_RESULT')
  })

  it('stores a valid result and lets us retrieve it by id', async () => {
    const post = await POST(postReq({ url: 'https://example.com', result: VALID_RESULT }))
    expect(post.status).toBe(200)
    const { id } = await post.json()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(6)

    const get = await GET(getReq(id))
    expect(get.status).toBe(200)
    const body = await get.json()
    expect(body.id).toBe(id)
    expect(body.url).toBe('https://example.com')
    expect(body.result.credibility_label).toBe('Verified')
  })

  it('returns 404 for an unknown id', async () => {
    const res = await GET(getReq('does-not-exist'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.code).toBe('NOT_FOUND')
  })

  it('requires an id on GET', async () => {
    const res = await GET(getReq(null))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('MISSING_ID')
  })
})
