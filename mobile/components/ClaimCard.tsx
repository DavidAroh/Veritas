import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { Claim } from '@/lib/types'
import { COLORS, VERDICT } from '@/lib/theme'

export default function ClaimCard({ claim }: { claim: Claim }) {
  const [open, setOpen] = useState(false)
  const v = VERDICT[claim.verification] || VERDICT.UNVERIFIED
  const pct = parseFloat(claim.confidence) || 0

  return (
    <Pressable
      onPress={() => setOpen((x) => !x)}
      style={{
        borderWidth: 1,
        borderColor: v.color + '33',
        backgroundColor: open ? v.color + '14' : COLORS.bg2,
        borderRadius: 8,
        padding: 12,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <View
          style={{
            paddingHorizontal: 7,
            paddingVertical: 3,
            borderRadius: 4,
            backgroundColor: v.color + '1f',
            borderWidth: 1,
            borderColor: v.color + '33',
          }}
        >
          <Text style={{ color: v.color, fontSize: 9, fontWeight: '700' }}>
            {v.icon} {claim.verification}
          </Text>
        </View>
        <Text style={{ flex: 1, color: COLORS.text, fontSize: 13, lineHeight: 19 }}>
          {claim.claim}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: COLORS.border }}>
          <View style={{ width: `${pct}%`, height: 3, borderRadius: 2, backgroundColor: v.color }} />
        </View>
        <Text style={{ color: COLORS.text3, fontSize: 10 }}>{claim.confidence}</Text>
      </View>

      {open && (
        <Text style={{ color: COLORS.text2, fontSize: 12, lineHeight: 18, paddingTop: 4 }}>
          {claim.reason}
        </Text>
      )}
    </Pressable>
  )
}
