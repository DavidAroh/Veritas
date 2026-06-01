'use client'
import { useEffect, useState } from 'react'
import ScoreRing from './ScoreRing'
import ClaimCard from './ClaimCard'
import type { AnalysisResult } from '@/lib/types'
import { appendHistory } from '@/lib/history'

const SAMPLE_TEXTS = [
  {
    label: 'Health claim',
    title: 'Miracle Supplement Cures Cancer',
    url: 'https://healthbuzz.example.com/miracle-cure',
    source: 'healthbuzz.example.com',
    content: 'Scientists have discovered that taking 5000mg of Vitamin C daily can completely cure all forms of cancer within 3 months. This treatment has a 99% success rate according to studies. Big pharma doesn\'t want you to know about this natural remedy that doctors in Switzerland have been secretly using. Hospitals are hiding this information to protect their profits. The study involved 10 patients and was published in an unnamed journal last year. All cancer patients should immediately stop chemotherapy and switch to this supplement.',
  },
  {
    label: 'Climate article',
    title: 'Global temperatures rise to record levels',
    url: 'https://reuters.example.com/climate-2024',
    source: 'reuters.example.com',
    content: 'Global average temperatures in 2023 were 1.45°C above pre-industrial levels, making it the hottest year on record according to multiple climate agencies including NASA and NOAA. Scientists attribute this primarily to greenhouse gas emissions from human activity. The Arctic is warming four times faster than the global average. Sea levels rose approximately 3.6mm per year over the past decade. More than 97% of actively publishing climate scientists agree that current climate trends are primarily human-caused.',
  },
  {
    label: 'Political claim',
    title: 'Election fraud claims resurface',
    url: 'https://patriotpost.example.com/election-fraud',
    source: 'patriotpost.example.com',
    content: 'Millions of fraudulent votes were cast in the last election according to unnamed sources close to the investigation. Voting machines were hacked by foreign governments to alter results. Court documents prove widespread ballot stuffing in six swing states. The mainstream media refuses to cover this story. Whistleblowers have come forward with evidence but are being silenced. Statistical analysis proves it is mathematically impossible for the results to be legitimate.',
  },
]

const LABEL_COLORS: Record<string, string> = {
  'Verified': 'var(--green)',
  'Partially Verified': 'var(--blue)',
  'Misleading': 'var(--amber)',
  'Unverified': 'var(--text2)',
  'False': 'var(--red)',
}

const MIN_CONTENT = 200
const MAX_CONTENT = 24_000
const SOFT_LIMIT = 6000

export default function AnalyzerDemo() {
  const [input, setInput] = useState('')
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetchingUrl, setFetchingUrl] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'claims' | 'signals' | 'sources' | 'verdict'>('claims')
  const [shareStatus, setShareStatus] = useState('')

  // Inject responsive grid CSS once.
  useEffect(() => {
    if (document.getElementById('veritas-demo-style')) return
    const s = document.createElement('style')
    s.id = 'veritas-demo-style'
    s.textContent = `
      .veritas-demo-grid {
        display: grid;
        gap: 24px;
        align-items: start;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      }
      @media (max-width: 880px) {
        .veritas-demo-grid { grid-template-columns: 1fr; }
      }
    `
    document.head.appendChild(s)
  }, [])

  async function fetchUrl(target: string) {
    const trimmed = target.trim()
    if (!trimmed) return
    let parsed: URL
    try { parsed = new URL(trimmed) } catch { return }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return
    if (input.trim().length > 0) return // don't overwrite manual content

    setFetchingUrl(true)
    setError('')
    try {
      const res = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not fetch article')
      if (data.title && !title) setTitle(data.title)
      setInput(data.content || '')
    } catch (e: any) {
      setError(e.message || 'Could not fetch URL')
    } finally {
      setFetchingUrl(false)
    }
  }

  async function analyze(content = input, contentUrl = url, contentTitle = title) {
    if (!content.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    setShareStatus('')

    try {
      let source = 'unknown'
      try { source = new URL(contentUrl).hostname.replace(/^www\./, '') } catch {}

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: contentUrl || 'https://unknown-source.com',
          title: contentTitle || 'Untitled',
          source,
          content,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(formatError(data))
      }
      setResult(data)
      appendHistory({
        url: contentUrl || 'https://unknown-source.com',
        title: contentTitle || '(untitled)',
        source,
        result: data,
      })
    } catch (e: any) {
      setError(e.message || 'Analysis failed.')
    } finally {
      setLoading(false)
    }
  }

  async function shareResult() {
    if (!result) return
    setShareStatus('Sharing…')
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, result }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Share failed')
      const shareUrl = `${window.location.origin}/report?id=${data.id}`
      await navigator.clipboard.writeText(shareUrl).catch(() => {})
      setShareStatus('Link copied to clipboard')
    } catch (e: any) {
      setShareStatus(e.message || 'Share failed')
    }
  }

  const loadSample = (sample: typeof SAMPLE_TEXTS[0]) => {
    setInput(sample.content)
    setUrl(sample.url)
    setTitle(sample.title)
    setResult(null)
    setError('')
  }

  const labelColor = result ? (LABEL_COLORS[result.credibility_label] || '#888880') : '#888880'
  const len = input.length
  const lenWarning =
    len === 0 ? '' :
    len < MIN_CONTENT ? `Need ≥ ${MIN_CONTENT} chars to analyze` :
    len > MAX_CONTENT ? `Too long — max ${MAX_CONTENT} chars` :
    len > SOFT_LIMIT ? `Will be truncated to ${SOFT_LIMIT} chars before sending` : ''
  const lenColor =
    len < MIN_CONTENT || len > MAX_CONTENT ? 'var(--red)' :
    len > SOFT_LIMIT ? 'var(--amber)' : 'var(--text3)'

  return (
    <section id="how-it-works" style={{
      maxWidth: 1200, margin: '0 auto',
      padding: '0 24px 100px',
    }}>
      {/* Section header */}
      <div style={{ marginBottom: 40 }}>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 11,
          color: 'var(--text3)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 12,
        }}>
          // Live demo
        </div>
        <h2 style={{
          fontFamily: 'var(--display)',
          fontWeight: 800,
          fontSize: 'clamp(28px, 4vw, 48px)',
          letterSpacing: '-0.03em',
          color: 'var(--text)',
        }}>
          Analyze any content
        </h2>
      </div>

      <div className="veritas-demo-grid">
        {/* Left: Input panel */}
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
          minWidth: 0,
        }}>
          {/* Panel header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['var(--red)','var(--amber)','var(--green)'].map(c => (
                <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.6 }} />
              ))}
            </div>
            <span style={{
              fontFamily: 'var(--mono)',
              fontSize: 11,
              color: 'var(--text3)',
              marginLeft: 8,
              letterSpacing: '0.05em',
            }}>
              content_input.txt
            </span>
          </div>

          <div style={{ padding: 16 }}>
            {/* Sample loaders */}
            <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {SAMPLE_TEXTS.map(s => (
                <button
                  key={s.label}
                  onClick={() => loadSample(s)}
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '4px 10px',
                    borderRadius: 4,
                    border: '1px solid var(--border2)',
                    background: 'var(--bg3)',
                    color: 'var(--text2)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--acid)'
                    e.currentTarget.style.color = 'var(--acid)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border2)'
                    e.currentTarget.style.color = 'var(--text2)'
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* URL input + auto-fetch */}
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                onBlur={e => fetchUrl(e.target.value)}
                placeholder="https://source-url.com/article (paste + tab to auto-fetch)"
                style={{
                  width: '100%',
                  fontFamily: 'var(--mono)',
                  fontSize: 12,
                  padding: '8px 12px',
                  paddingRight: fetchingUrl ? 84 : 12,
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg3)',
                  color: 'var(--text)',
                  outline: 'none',
                }}
              />
              {fetchingUrl && (
                <span style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  fontFamily: 'var(--mono)', fontSize: 10,
                  color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  fetching…
                </span>
              )}
            </div>

            {/* Title input */}
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Article title (optional)"
              style={{
                width: '100%',
                fontFamily: 'var(--mono)',
                fontSize: 12,
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--bg3)',
                color: 'var(--text)',
                outline: 'none',
                marginBottom: 8,
              }}
            />

            {/* Content textarea */}
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Paste article text, social media post, or any web content here..."
              rows={10}
              style={{
                width: '100%',
                fontFamily: 'var(--mono)',
                fontSize: 12,
                lineHeight: 1.6,
                padding: '12px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--bg3)',
                color: 'var(--text)',
                outline: 'none',
                resize: 'vertical',
                marginBottom: 6,
              }}
            />

            {/* Length counter */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 12,
              fontFamily: 'var(--mono)', fontSize: 10,
              color: lenColor,
              minHeight: 14,
            }}>
              <span>{lenWarning}</span>
              <span>{len.toLocaleString()} / {MAX_CONTENT.toLocaleString()}</span>
            </div>

            <button
              onClick={() => analyze()}
              disabled={!input.trim() || loading || len < MIN_CONTENT || len > MAX_CONTENT}
              style={{
                width: '100%',
                fontFamily: 'var(--mono)',
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                padding: '12px',
                borderRadius: 6,
                border: 'none',
                background: input.trim() && !loading && len >= MIN_CONTENT && len <= MAX_CONTENT ? 'var(--acid)' : 'var(--surface)',
                color: input.trim() && !loading && len >= MIN_CONTENT && len <= MAX_CONTENT ? '#000' : 'var(--text3)',
                cursor: input.trim() && !loading && len >= MIN_CONTENT && len <= MAX_CONTENT ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: 14, height: 14,
                    border: '2px solid var(--border)',
                    borderTopColor: 'var(--text)',
                    borderRadius: '50%',
                    animation: 'spin-slow 0.8s linear infinite',
                  }} />
                  Analyzing...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  Run Analysis
                </>
              )}
            </button>

            {error && (
              <div style={{
                marginTop: 10,
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid var(--red)',
                background: 'rgba(255, 69, 69, 0.1)',
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: '#ff4545',
              }}>
                ✕ {error}
              </div>
            )}
          </div>
        </div>

        {/* Right: Results panel */}
        <div style={{
          background: 'var(--bg2)',
          border: `1px solid ${result ? labelColor + '40' : 'var(--border)'}`,
          borderRadius: 12,
          overflow: 'hidden',
          transition: 'border-color 0.4s',
          minHeight: 400,
          minWidth: 0,
        }}>
          <div style={{
            padding: '14px 16px',
            borderBottom: `1px solid ${result ? labelColor + '30' : 'var(--border)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 10, flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: result ? labelColor : 'var(--text3)',
                boxShadow: result ? `0 0 8px ${labelColor}` : 'none',
              }} />
              <span style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: 'var(--text3)',
                letterSpacing: '0.05em',
              }}>
                analysis_result.json
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {result && (
                <button
                  onClick={shareResult}
                  style={{
                    fontFamily: 'var(--mono)', fontSize: 10,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    padding: '4px 10px', borderRadius: 4,
                    border: '1px solid var(--border2)',
                    background: 'transparent', color: 'var(--text2)',
                    cursor: 'pointer',
                  }}
                >
                  Share
                </button>
              )}
              {result && (
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: labelColor,
                  padding: '3px 8px',
                  border: `1px solid ${labelColor}40`,
                  borderRadius: 4,
                  background: `${labelColor}10`,
                }}>
                  {result.credibility_label}
                </span>
              )}
            </div>
          </div>

          <div style={{ padding: 16 }}>
            {!result && !loading && (
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                height: 340,
                gap: 12,
              }}>
                <div style={{
                  width: 48, height: 48,
                  border: '1px solid var(--border2)',
                  borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0.4,
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1.5">
                    <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
                  </svg>
                </div>
                <p style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 12,
                  color: 'var(--text3)',
                  textAlign: 'center',
                }}>
                  Results will appear here.<br />
                  Paste content and run analysis.
                </p>
              </div>
            )}

            {loading && (
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                height: 340, gap: 16,
              }}>
                <ScoreRing score={0} size={100} />
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', letterSpacing: '0.05em' }}>
                  <span className="cursor-blink">Verifying claims</span>
                </div>
                {['Extracting claims...', 'Cross-referencing sources...', 'Scoring credibility...'].map((step, i) => (
                  <div key={step} style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    color: 'var(--text3)',
                    display: 'flex', alignItems: 'center', gap: 8,
                    animation: `fadeUp 0.4s ${i * 0.2}s both`,
                  }}>
                    <div style={{
                      width: 4, height: 4, borderRadius: '50%',
                      background: 'var(--acid)',
                      animation: 'pulse-ring 1.5s ease-in-out infinite',
                    }} />
                    {step}
                  </div>
                ))}
              </div>
            )}

            {result && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Score + summary */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <ScoreRing score={result.credibility_score} size={100} />
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <p style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 12,
                      color: 'var(--text)',
                      lineHeight: 1.6,
                      marginBottom: 8,
                    }}>
                      {result.page_summary}
                    </p>
                    <div style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 11,
                      color: 'var(--text3)',
                      display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                    }}>
                      <span>Source:</span>
                      <span style={{ color: 'var(--text2)' }}>{result.source_reliability}</span>
                    </div>
                  </div>
                </div>

                {shareStatus && (
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg3)',
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    color: 'var(--text2)',
                  }}>
                    {shareStatus}
                  </div>
                )}

                {/* Warning */}
                {result.user_warning_message && (
                  <div style={{
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: `1px solid ${labelColor}40`,
                    background: `${labelColor}08`,
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    color: labelColor,
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                  }}>
                    <span>⚠</span>
                    {result.user_warning_message}
                  </div>
                )}

                {/* Tabs */}
                <div style={{ borderBottom: '1px solid var(--border)', display: 'flex', gap: 0, flexWrap: 'wrap' }}>
                  {(['claims', 'signals', 'sources', 'verdict'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        padding: '8px 14px',
                        border: 'none',
                        borderBottom: `2px solid ${activeTab === tab ? 'var(--acid)' : 'transparent'}`,
                        background: 'transparent',
                        color: activeTab === tab ? 'var(--acid)' : 'var(--text3)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        marginBottom: -1,
                      }}
                    >
                      {tab === 'claims' && `claims (${result.claims.length})`}
                      {tab === 'signals' && `signals (${result.misinformation_signals.length})`}
                      {tab === 'sources' && `sources (${result.sources?.length || 0})`}
                      {tab === 'verdict' && 'verdict'}
                    </button>
                  ))}
                </div>

                {activeTab === 'claims' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {result.claims.map((claim, i) => (
                      <ClaimCard key={i} claim={claim} />
                    ))}
                  </div>
                )}

                {activeTab === 'signals' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {result.misinformation_signals.length === 0 ? (
                      <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)' }}>
                        ✓ No misinformation signals detected.
                      </p>
                    ) : result.misinformation_signals.map((signal, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                        padding: '10px 12px',
                        borderRadius: 6,
                        border: '1px solid #ffab4030',
                        background: '#ffab4008',
                      }}>
                        <span style={{ color: '#ffab40', fontSize: 12, flexShrink: 0 }}>◆</span>
                        <span style={{
                          fontFamily: 'var(--mono)',
                          fontSize: 12,
                          color: 'var(--text)',
                          lineHeight: 1.5,
                        }}>
                          {signal}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'sources' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {!result.sources?.length ? (
                      <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)' }}>
                        No web sources were retrieved for this analysis.
                      </p>
                    ) : result.sources.map((src, i) => {
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
                            border: '1px solid var(--border2)',
                            background: 'var(--bg3)',
                            textDecoration: 'none',
                          }}
                        >
                          <span style={{
                            fontFamily: 'var(--mono)', fontSize: 12,
                            color: 'var(--text)', lineHeight: 1.45,
                          }}>
                            {src.title}
                          </span>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--acid)' }}>
                            ↗ {host}
                          </span>
                        </a>
                      )
                    })}
                  </div>
                )}

                {activeTab === 'verdict' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{
                      padding: '14px',
                      borderRadius: 8,
                      border: '1px solid var(--border2)',
                      background: 'var(--bg3)',
                    }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                        Final verdict
                      </div>
                      <p style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
                        {result.final_verdict}
                      </p>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--bg3)',
                      fontFamily: 'var(--mono)', fontSize: 12,
                      flexWrap: 'wrap',
                    }}>
                      <span style={{ color: 'var(--text3)' }}>Source reliability:</span>
                      <span style={{ color: 'var(--text2)' }}>{result.source_reliability}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function formatError(data: any): string {
  if (!data) return 'Analysis failed'
  const msg = data.error || 'Analysis failed'
  switch (data.code) {
    case 'CONTENT_TOO_SHORT': return msg
    case 'CONTENT_TOO_LONG': return msg
    case 'RATE_LIMITED': return msg
    case 'UPSTREAM_RATE_LIMITED': return 'Gemini quota exceeded — try again later.'
    case 'INVALID_KEY': return 'Server API key was rejected. Check GEMINI_API_KEY.'
    case 'SERVER_MISCONFIGURED': return 'Server is missing GEMINI_API_KEY.'
    case 'PARSE_ERROR': return 'Model returned an unparseable response. Try again.'
    default: return msg
  }
}
