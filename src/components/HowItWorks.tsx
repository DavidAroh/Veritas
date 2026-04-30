'use client'

const STEPS = [
  {
    num: '01',
    title: 'Content extraction',
    desc: 'Content script reads the DOM, strips boilerplate, and packages text + URL into a structured payload.',
    color: '#b8ff57',
  },
  {
    num: '02',
    title: 'Claim detection',
    desc: 'Claude identifies verifiable factual claims, ignoring pure opinion or subjective statements.',
    color: '#60a5fa',
  },
  {
    num: '03',
    title: 'Verification pass',
    desc: 'Each claim is evaluated for factual accuracy, labeled TRUE / MISLEADING / FALSE / UNVERIFIED.',
    color: '#a78bfa',
  },
  {
    num: '04',
    title: 'Signal analysis',
    desc: 'Scans for sensational language, conspiratorial framing, missing sources, and emotional manipulation.',
    color: '#f472b6',
  },
  {
    num: '05',
    title: 'Source rating',
    desc: 'Publisher is looked up against a domain reputation database and factual track record.',
    color: '#fb923c',
  },
  {
    num: '06',
    title: 'Score generation',
    desc: 'A 0–100 credibility score is computed from claim accuracy, signal count, and source reliability.',
    color: '#4ade80',
  },
  {
    num: '07',
    title: 'UI delivery',
    desc: 'Results surface in the badge, popup, and inline highlights — within 3 seconds of page load.',
    color: '#facc15',
  },
]

export default function HowItWorks() {
  return (
    <section style={{
      maxWidth: 1200, margin: '0 auto',
      padding: '80px 32px',
      borderTop: '1px solid var(--border)',
    }}>
      <div style={{ marginBottom: 56 }}>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 11,
          color: 'var(--text3)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 12,
        }}>
          // Architecture
        </div>
        <h2 style={{
          fontFamily: 'var(--display)',
          fontWeight: 800,
          fontSize: 'clamp(28px, 4vw, 48px)',
          letterSpacing: '-0.03em',
          color: 'var(--text)',
        }}>
          7-step analysis pipeline
        </h2>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 1,
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--border)',
      }}>
        {STEPS.map((step, i) => (
          <div
            key={step.num}
            style={{
              background: 'var(--bg2)',
              padding: '24px',
              position: 'relative',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg2)')}
          >
            {/* Step number */}
            <div style={{
              fontFamily: 'var(--display)',
              fontWeight: 800,
              fontSize: 42,
              color: step.color,
              opacity: 0.2,
              letterSpacing: '-0.04em',
              lineHeight: 1,
              marginBottom: 12,
            }}>
              {step.num}
            </div>

            {/* Accent bar */}
            <div style={{
              width: 28, height: 2,
              background: step.color,
              borderRadius: 1,
              marginBottom: 12,
            }} />

            <h3 style={{
              fontFamily: 'var(--display)',
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: '-0.01em',
              color: 'var(--text)',
              marginBottom: 8,
            }}>
              {step.title}
            </h3>

            <p style={{
              fontFamily: 'var(--mono)',
              fontSize: 12,
              color: 'var(--text2)',
              lineHeight: 1.6,
            }}>
              {step.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
