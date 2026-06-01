'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ScoreRing from '@/components/ScoreRing'
import ClaimCard from '@/components/ClaimCard'
import type { AnalysisResult } from '@/lib/types'

const LABEL_COLORS: Record<string, string> = {
  'Verified': 'var(--green)',
  'Partially Verified': 'var(--blue)',
  'Misleading': 'var(--amber)',
  'Unverified': 'var(--text2)',
  'False': 'var(--red)',
}

function ReportInner() {
  const params = useSearchParams()
  const id = params.get('id') || ''
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [meta, setMeta] = useState<{ url?: string; createdAt?: number } | null>(null)

  useEffect(() => {
    if (!id) {
      setError('No report id provided.')
      setLoading(false)
      return
    }
    fetch(`/api/report?id=${encodeURIComponent(id)}`)
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error || 'Failed to load report')
        setResult(data.result as AnalysisResult)
        setMeta({ url: data.url, createdAt: data.createdAt })
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Header />

      <section style={{ maxWidth: 880, margin: '0 auto', padding: '120px 24px 60px' }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 11,
          color: 'var(--text3)', letterSpacing: '0.1em',
          textTransform: 'uppercase', marginBottom: 12,
        }}>
          // Shared report
        </div>
        <h1 style={{
          fontFamily: 'var(--display)',
          fontWeight: 800,
          fontSize: 'clamp(28px, 4vw, 44px)',
          letterSpacing: '-0.03em',
          color: 'var(--text)',
          marginBottom: 24,
        }}>
          Veritas analysis
        </h1>

        {loading && (
          <p style={{ fontFamily: 'var(--mono)', color: 'var(--text3)' }}>Loading report…</p>
        )}

        {error && (
          <div style={{
            padding: '14px 16px',
            border: '1px solid var(--red)',
            borderRadius: 8,
            background: 'rgba(255,69,69,0.08)',
            fontFamily: 'var(--mono)',
            color: 'var(--red)',
            fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {result && (
          <ReportBody result={result} sourceUrl={meta?.url} createdAt={meta?.createdAt} />
        )}
      </section>

      <Footer />
    </main>
  )
}

function ReportBody({
  result, sourceUrl, createdAt,
}: { result: AnalysisResult; sourceUrl?: string; createdAt?: number }) {
  const labelColor = LABEL_COLORS[result.credibility_label] || 'var(--text2)'
  return (
    <div style={{
      background: 'var(--bg2)',
      border: `1px solid ${labelColor}40`,
      borderRadius: 12,
      padding: 24,
      display: 'flex', flexDirection: 'column', gap: 20,
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 20, alignItems: 'center',
      }}>
        <ScoreRing score={result.credibility_score} size={120} />
        <div>
          <div style={{
            fontFamily: 'var(--display)', fontWeight: 700,
            fontSize: 22, color: labelColor, marginBottom: 6,
          }}>
            {result.credibility_label}
          </div>
          <p style={{
            fontFamily: 'var(--mono)', fontSize: 13,
            color: 'var(--text)', lineHeight: 1.55,
          }}>
            {result.page_summary}
          </p>
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                marginTop: 8,
                fontFamily: 'var(--mono)', fontSize: 11,
                color: 'var(--text3)', wordBreak: 'break-all',
                display: 'inline-block',
              }}
            >
              {sourceUrl}
            </a>
          )}
        </div>
      </div>

      {result.user_warning_message && (
        <div style={{
          padding: '12px 14px',
          border: `1px solid ${labelColor}40`,
          borderRadius: 8,
          background: `${labelColor}10`,
          color: labelColor,
          fontFamily: 'var(--mono)',
          fontSize: 12,
        }}>
          ⚠ {result.user_warning_message}
        </div>
      )}

      <div>
        <SectionTitle>Final verdict</SectionTitle>
        <p style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
          {result.final_verdict}
        </p>
      </div>

      <div>
        <SectionTitle>Claims ({result.claims.length})</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {result.claims.map((c, i) => <ClaimCard key={i} claim={c} />)}
        </div>
      </div>

      {result.sources?.length > 0 && (
        <div>
          <SectionTitle>Sources ({result.sources.length})</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.sources.map((src, i) => {
              let host = src.url
              try { host = new URL(src.url).hostname.replace(/^www\./, '') } catch {}
              return (
                <a
                  key={i}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 3,
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg3)',
                    textDecoration: 'none',
                  }}
                >
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text)', lineHeight: 1.45 }}>
                    {src.title}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--green)' }}>
                    ↗ {host}
                  </span>
                </a>
              )
            })}
          </div>
        </div>
      )}

      {result.misinformation_signals.length > 0 && (
        <div>
          <SectionTitle>Misinformation signals</SectionTitle>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.misinformation_signals.map((s, i) => (
              <li key={i} style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #ffab4030',
                background: '#ffab4008',
                fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text)',
              }}>
                ◆ {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{
        display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap',
        fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)',
        borderTop: '1px solid var(--border)', paddingTop: 12,
      }}>
        <span>Source reliability: {result.source_reliability}</span>
        {createdAt && (
          <span>Generated {new Date(createdAt).toLocaleString()}</span>
        )}
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--mono)', fontSize: 10,
      textTransform: 'uppercase', letterSpacing: '0.1em',
      color: 'var(--text3)', marginBottom: 8,
    }}>
      {children}
    </div>
  )
}

export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportInner />
    </Suspense>
  )
}
