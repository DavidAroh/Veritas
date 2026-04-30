'use client'

interface ScoreRingProps {
  score: number
  size?: number
  strokeWidth?: number
  animated?: boolean
}

function getColor(score: number) {
  if (score >= 75) return 'var(--green)'
  if (score >= 45) return 'var(--amber)'
  if (score >= 25) return 'var(--amber)' // or suggest a different var
  return 'var(--red)'
}

function getLabel(score: number) {
  if (score >= 75) return 'Verified'
  if (score >= 45) return 'Partial'
  if (score >= 25) return 'Misleading'
  return 'False'
}

export default function ScoreRing({ score, size = 120, strokeWidth = 8, animated = true }: ScoreRingProps) {
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const color = getColor(score)

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="var(--border2)"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          style={{
            transition: animated ? 'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)' : 'none',
            filter: `drop-shadow(0 0 6px ${color}60)`,
          }}
        />
      </svg>
      {/* Center text */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: 'var(--display)',
          fontWeight: 800,
          fontSize: size * 0.22,
          color,
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}>{score}</span>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: size * 0.1,
          color: 'var(--text3)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginTop: 2,
        }}>{getLabel(score)}</span>
      </div>
    </div>
  )
}
