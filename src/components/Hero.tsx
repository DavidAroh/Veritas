'use client'
import { useState, useEffect } from 'react'

const LABELS = ['VERIFIED', 'MISLEADING', 'FALSE', 'UNVERIFIED', 'PARTIALLY VERIFIED']
const COLORS = ['var(--green)', 'var(--amber)', 'var(--red)', 'var(--text2)', 'var(--blue)']

export default function Hero() {
  const [labelIdx, setLabelIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setLabelIdx(i => (i + 1) % LABELS.length)
        setVisible(true)
      }, 300)
    }, 2000)
    return () => clearInterval(t)
  }, [])

  return (
    <section style={{
      paddingTop: 140, paddingBottom: 80,
      maxWidth: 1200, margin: '0 auto', padding: '140px 32px 80px',
      position: 'relative',
    }}>
      {/* Background grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(var(--border) 1px, transparent 1px),
          linear-gradient(90deg, var(--border) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
        maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)',
        opacity: 0.3,
      }} />

      <div style={{ position: 'relative', maxWidth: 900 }}>
        {/* Eyebrow */}
        <div className="fade-up" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          border: '1px solid var(--border2)',
          borderRadius: 4,
          padding: '4px 12px',
          marginBottom: 32,
          background: 'var(--bg2)',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--acid)', animation: 'pulse-ring 2s ease-in-out infinite' }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Powered by Gemini AI
          </span>
        </div>

        {/* Headline */}
        <h1 className="fade-up fade-up-1" style={{
          fontFamily: 'var(--display)',
          fontWeight: 800,
          fontSize: 'clamp(48px, 7vw, 88px)',
          lineHeight: 0.95,
          letterSpacing: '-0.04em',
          color: 'var(--text)',
          marginBottom: 16,
        }}>
          EVERY CLAIM.<br />
          <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 400, color: 'var(--text2)' }}>Every page.</span>
          <br />
          <span style={{
            color: COLORS[labelIdx],
            transition: 'all 0.3s ease',
            opacity: visible ? 1 : 0,
            display: 'inline-block',
            transform: visible ? 'translateY(0)' : 'translateY(8px)',
          }}>
            {LABELS[labelIdx]}.
          </span>
        </h1>

        {/* Subhead */}
        <p className="fade-up fade-up-2" style={{
          fontFamily: 'var(--mono)',
          fontSize: 16,
          color: 'var(--text2)',
          lineHeight: 1.7,
          maxWidth: 520,
          marginTop: 24,
          marginBottom: 40,
        }}>
          Veritas Agent analyzes what you read in real-time — extracting claims, 
          verifying facts, and scoring credibility before you share or believe it.
        </p>

        {/* CTAs */}
        <div className="fade-up fade-up-3" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button style={{
            fontFamily: 'var(--mono)',
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            padding: '14px 28px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--acid)',
            color: '#000',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7,10 12,15 17,10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Install Extension
          </button>
          <button style={{
            fontFamily: 'var(--mono)',
            fontSize: 13,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            padding: '14px 28px',
            borderRadius: 8,
            border: '1px solid var(--border2)',
            background: 'transparent',
            color: 'var(--text2)',
            cursor: 'pointer',
          }}>
            Try the demo ↓
          </button>
        </div>

        {/* Stats row */}
        <div className="fade-up fade-up-4" style={{
          display: 'flex', gap: 40, marginTop: 64,
          paddingTop: 32,
          borderTop: '1px solid var(--border)',
        }}>
          {[
            { value: '7-step', label: 'Analysis pipeline' },
            { value: '<3s', label: 'Average response' },
            { value: '5-tier', label: 'Credibility scale' },
          ].map(stat => (
            <div key={stat.label}>
              <div style={{
                fontFamily: 'var(--display)',
                fontWeight: 700,
                fontSize: 28,
                color: 'var(--acid)',
                letterSpacing: '-0.02em',
              }}>{stat.value}</div>
              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 12,
                color: 'var(--text3)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginTop: 4,
              }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
