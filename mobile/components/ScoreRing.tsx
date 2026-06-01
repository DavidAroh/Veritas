import { View, Text } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { scoreColor, COLORS } from '@/lib/theme'

export default function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const stroke = size * 0.09
  const r = size / 2 - stroke
  const c = 2 * Math.PI * r
  const progress = (Math.max(0, Math.min(100, score)) / 100) * c
  const color = scoreColor(score)

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={COLORS.border2} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c}`}
          strokeDashoffset={c - progress}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={{ color, fontSize: size * 0.3, fontWeight: '800' }}>{score}</Text>
      <Text style={{ color: COLORS.text3, fontSize: size * 0.12, marginTop: -2 }}>/100</Text>
    </View>
  )
}
