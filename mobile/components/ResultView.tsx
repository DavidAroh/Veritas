import { Linking, Text, View } from 'react-native'
import type { AnalysisResult } from '@/lib/types'
import { COLORS, labelColor } from '@/lib/theme'
import ScoreRing from './ScoreRing'
import ClaimCard from './ClaimCard'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: COLORS.text3,
        fontSize: 10,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 8,
      }}
    >
      {children}
    </Text>
  )
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

export default function ResultView({ result }: { result: AnalysisResult }) {
  const color = labelColor(result.credibility_label)

  return (
    <View style={{ gap: 22 }}>
      {/* Score + summary */}
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <ScoreRing score={result.credibility_score} />
        <View style={{ flex: 1 }}>
          <Text style={{ color, fontSize: 18, fontWeight: '800', marginBottom: 4 }}>
            {result.credibility_label}
          </Text>
          <Text style={{ color: COLORS.text2, fontSize: 13, lineHeight: 19 }}>
            {result.page_summary}
          </Text>
        </View>
      </View>

      {!!result.user_warning_message && (
        <View
          style={{
            borderWidth: 1,
            borderColor: color + '44',
            backgroundColor: color + '12',
            borderRadius: 8,
            padding: 12,
          }}
        >
          <Text style={{ color, fontSize: 13 }}>⚠ {result.user_warning_message}</Text>
        </View>
      )}

      {/* Verdict */}
      <View>
        <SectionTitle>Final verdict</SectionTitle>
        <Text style={{ color: COLORS.text, fontSize: 14, lineHeight: 21 }}>
          {result.final_verdict}
        </Text>
      </View>

      {/* Claims */}
      <View style={{ gap: 8 }}>
        <SectionTitle>Claims ({result.claims.length})</SectionTitle>
        {result.claims.map((c, i) => (
          <ClaimCard key={i} claim={c} />
        ))}
      </View>

      {/* Sources */}
      {result.sources?.length > 0 && (
        <View style={{ gap: 6 }}>
          <SectionTitle>Sources ({result.sources.length})</SectionTitle>
          {result.sources.map((s, i) => (
            <Text
              key={i}
              onPress={() => Linking.openURL(s.url)}
              style={{
                color: COLORS.text,
                fontSize: 13,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderWidth: 1,
                borderColor: COLORS.border2,
                backgroundColor: COLORS.bg3,
                borderRadius: 6,
              }}
            >
              {s.title}
              {'\n'}
              <Text style={{ color: COLORS.acid, fontSize: 11 }}>↗ {hostOf(s.url)}</Text>
            </Text>
          ))}
        </View>
      )}

      {/* Signals */}
      {result.misinformation_signals.length > 0 && (
        <View style={{ gap: 6 }}>
          <SectionTitle>Misinformation signals</SectionTitle>
          {result.misinformation_signals.map((s, i) => (
            <View
              key={i}
              style={{
                borderWidth: 1,
                borderColor: COLORS.amber + '30',
                backgroundColor: COLORS.amber + '0c',
                borderRadius: 6,
                padding: 10,
              }}
            >
              <Text style={{ color: COLORS.text, fontSize: 12 }}>◆ {s}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={{ color: COLORS.text3, fontSize: 11 }}>
        Source reliability: {result.source_reliability}
      </Text>
    </View>
  )
}
