'use client'
import { useState } from 'react'
import type { Claim } from '@/lib/types'

const COLORS: Record<string, { bg: string; text: string; border: string; chip: string }> = {
  TRUE:       { bg: 'rgba(74,222,128,0.08)',  text: 'var(--green)', border: 'rgba(74,222,128,0.2)',  chip: 'rgba(74,222,128,0.12)' },
  MISLEADING: { bg: 'rgba(255,171,64,0.08)',  text: 'var(--amber)', border: 'rgba(255,171,64,0.2)',  chip: 'rgba(255,171,64,0.12)' },
  FALSE:      { bg: 'rgba(255,69,69,0.08)',   text: 'var(--red)',   border: 'rgba(255,69,69,0.2)',   chip: 'rgba(255,69,69,0.12)'  },
  UNVERIFIED: { bg: 'rgba(136,136,128,0.08)', text: 'var(--text2)', border: 'rgba(136,136,128,0.2)', chip: 'rgba(136,136,128,0.12)' },
}

const ICONS: Record<string, string> = {
  TRUE: '✓', MISLEADING: '~', FALSE: '✕', UNVERIFIED: '?',
}

export default function ClaimCard({ claim }: { claim: Claim }) {
  const [expanded, setExpanded] = useState(false)
  const c = COLORS[claim.verification] || COLORS.UNVERIFIED
  const pct = parseFloat(claim.confidence) || 0

  return (
    <div
      onClick={() => setExpanded(x => !x)}
      style={{
        border: `1px solid ${c.border}`,
        borderRadius: 8,
        cursor: 'pointer',
        background: expanded ? c.bg : 'var(--bg2)',
        transition: 'all 0.2s',
        overflow: 'hidden',
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px' }}>
        {/* Chip */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 8px',
          borderRadius: 4,
          background: c.chip,
          border: `1px solid ${c.border}`,
          fontSize: 9, fontWeight: 500, color: c.text,
          fontFamily: 'var(--mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          flexShrink: 0,
          marginTop: 2,
        }}>
          <span>{ICONS[claim.verification]}</span>
          {claim.verification}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: 'var(--mono)',
            fontSize: 12,
            color: 'var(--text)',
            lineHeight: 1.5,
            marginBottom: 8,
          }}>
            {claim.claim}
          </p>

          {/* Confidence bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--border)' }}>
              <div style={{
                width: `${pct}%`,
                height: '100%',
                borderRadius: 2,
                background: c.text,
                transition: 'width 0.5s ease',
              }} />
            </div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
              {claim.confidence}
            </span>
          </div>
        </div>

        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 12,
          color: 'var(--text3)',
          flexShrink: 0,
          marginTop: 2,
          transition: 'transform 0.2s',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>▾</span>
      </div>

      {expanded && (
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 11,
          color: 'var(--text2)',
          lineHeight: 1.55,
          padding: '0 14px 12px',
          borderTop: `1px solid ${c.border}`,
          paddingTop: 10,
        }}>
          {claim.reason}
        </div>
      )}
    </div>
  )
}

