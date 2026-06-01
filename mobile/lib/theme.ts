// Brand palette shared across the app (matches the web app / extension).
export const COLORS = {
  bg: '#0a0a0a',
  bg2: '#0d0d0d',
  bg3: '#111111',
  border: '#1a1a1a',
  border2: '#1f1f1f',
  text: '#e8e6e0',
  text2: '#c0beb8',
  text3: '#666660',
  acid: '#b8ff57',
  green: '#4ade80',
  blue: '#60a5fa',
  amber: '#ffab40',
  red: '#ff4545',
  gray: '#888880',
}

export const VERDICT = {
  TRUE: { color: COLORS.green, icon: '✓' },
  MISLEADING: { color: COLORS.amber, icon: '~' },
  FALSE: { color: COLORS.red, icon: '✕' },
  UNVERIFIED: { color: COLORS.gray, icon: '?' },
} as const

export function scoreColor(score: number): string {
  if (score >= 75) return COLORS.green
  if (score >= 45) return COLORS.blue
  if (score >= 25) return COLORS.amber
  return COLORS.red
}

export function labelColor(label: string): string {
  switch (label) {
    case 'Verified': return COLORS.green
    case 'Partially Verified': return COLORS.blue
    case 'Misleading': return COLORS.amber
    case 'False': return COLORS.red
    default: return COLORS.gray
  }
}
