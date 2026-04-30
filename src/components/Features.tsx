'use client'

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      </svg>
    ),
    title: 'Gemini 3 reasoning',
    desc: 'Every analysis runs through Gemini 3\'s advanced reasoning — not just keyword matching or simple rule systems.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    title: 'Real-time, sub-3s',
    desc: 'A fast first pass delivers the credibility badge within seconds. Deep claim analysis follows asynchronously.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    title: 'Source reputation layer',
    desc: 'Domain reliability scores from NewsGuard and MBFC are baked in — so known bad actors are flagged instantly.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
    title: 'Non-intrusive UI',
    desc: 'A small badge in the page corner. No popups. No interruptions. Full details one click away in the extension popup.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>
      </svg>
    ),
    title: 'Smart caching',
    desc: 'Results are cached by URL hash in IndexedDB. Re-visiting the same article returns results instantly.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
        <circle cx="12" cy="13" r="3"/>
      </svg>
    ),
    title: 'Works on everything',
    desc: 'News articles, blog posts, social media, video transcripts — if the content script can read it, Veritas can analyze it.',
  },
]

export default function Features() {
  return (
    <section id="features" style={{
      maxWidth: 1200, margin: '0 auto',
      padding: '80px 32px',
      borderTop: '1px solid var(--border)',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 2fr',
        gap: 80,
        alignItems: 'start',
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color: 'var(--text3)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 12,
          }}>
            // Features
          </div>
          <h2 style={{
            fontFamily: 'var(--display)',
            fontWeight: 800,
            fontSize: 'clamp(28px, 3vw, 42px)',
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            color: 'var(--text)',
            marginBottom: 20,
          }}>
            Built for how people actually read the web.
          </h2>
          <p style={{
            fontFamily: 'var(--mono)',
            fontSize: 13,
            color: 'var(--text2)',
            lineHeight: 1.7,
          }}>
            Veritas Agent lives quietly in your browser until you need it. 
            No account required, no tracking, no selling your data.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 1,
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
          background: 'var(--border)',
        }}>
          {FEATURES.map(f => (
            <div
              key={f.title}
              style={{
                background: 'var(--bg2)',
                padding: '24px',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg2)')}
            >
              <div style={{
                color: 'var(--acid)',
                marginBottom: 12,
                opacity: 0.8,
              }}>
                {f.icon}
              </div>
              <h3 style={{
                fontFamily: 'var(--display)',
                fontWeight: 700,
                fontSize: 14,
                color: 'var(--text)',
                letterSpacing: '-0.01em',
                marginBottom: 8,
              }}>
                {f.title}
              </h3>
              <p style={{
                fontFamily: 'var(--mono)',
                fontSize: 12,
                color: 'var(--text2)',
                lineHeight: 1.6,
              }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
