import { useEffect, useState } from 'react'
import { AppState, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { COLORS } from '@/lib/theme'
import { getSettings, saveSettings, clearHistory, DEFAULT_SETTINGS } from '@/lib/storage'
import type { Settings } from '@/lib/types'
import {
  overlaySupported,
  hasOverlayPermission,
  requestOverlayPermission,
  isAccessibilityEnabled,
  openAccessibilitySettings,
  startBubble,
  stopBubble,
} from '@/lib/overlay'

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-3.5-flash-preview',
  'gemini-3-flash-preview',
  'gemini-flash-latest',
]

function Label({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ color: COLORS.text3, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
      {children}
    </Text>
  )
}

const grantBtn = {
  borderWidth: 1,
  borderColor: COLORS.acid,
  borderRadius: 8,
  paddingHorizontal: 14,
  paddingVertical: 7,
}

const inputStyle = {
  color: COLORS.text,
  backgroundColor: COLORS.bg2,
  borderWidth: 1,
  borderColor: COLORS.border2,
  borderRadius: 8,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 13,
}

export default function SettingsScreen() {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)

  // Floating-bubble (Android overlay) state
  const [bubbleOn, setBubbleOn] = useState(false)
  const [overlayOk, setOverlayOk] = useState(false)
  const [accessibilityOk, setAccessibilityOk] = useState(false)

  useEffect(() => { getSettings().then(setS) }, [])

  // Re-check permissions whenever the screen regains focus (the user grants
  // them in system Settings and then returns to the app).
  useEffect(() => {
    if (!overlaySupported) return
    const refresh = () => {
      setOverlayOk(hasOverlayPermission())
      setAccessibilityOk(isAccessibilityEnabled())
    }
    refresh()
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') refresh() })
    return () => sub.remove()
  }, [])

  function toggleBubble(on: boolean) {
    if (on) {
      if (!hasOverlayPermission()) { requestOverlayPermission(); return }
      if (!isAccessibilityEnabled()) { openAccessibilitySettings(); return }
      const started = startBubble(s.apiBase, s.geminiKey, s.geminiModel)
      setBubbleOn(started)
    } else {
      stopBubble()
      setBubbleOn(false)
    }
  }

  function patch(p: Partial<Settings>) {
    setS((prev) => ({ ...prev, ...p }))
    setSaved(false)
  }

  async function persist() {
    await saveSettings(s)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }}>
        <View>
          <Label>Backend URL</Label>
          <TextInput
            value={s.apiBase}
            onChangeText={(v) => patch({ apiBase: v })}
            placeholder="https://your-app.vercel.app"
            placeholderTextColor={COLORS.text3}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={inputStyle}
          />
          <Text style={{ color: COLORS.text3, fontSize: 11, marginTop: 6 }}>
            Your deployed Veritas web app. Required for analyzing links (article fetch) and the
            most reliable analysis. Leave blank to use a direct Gemini key only.
          </Text>
        </View>

        <View>
          <Label>Gemini API key (fallback)</Label>
          <TextInput
            value={s.geminiKey}
            onChangeText={(v) => patch({ geminiKey: v })}
            placeholder="AIza…"
            placeholderTextColor={COLORS.text3}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={inputStyle}
          />
          <Text style={{ color: COLORS.text3, fontSize: 11, marginTop: 6 }}>
            Used when no backend is set or it's unreachable. Stored only on this device.
          </Text>
        </View>

        <View>
          <Label>Gemini model</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {MODELS.map((m) => {
              const active = s.geminiModel === m
              return (
                <Pressable
                  key={m}
                  onPress={() => patch({ geminiModel: m })}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: active ? COLORS.acid : COLORS.border2,
                    backgroundColor: active ? COLORS.acid + '14' : COLORS.bg2,
                  }}
                >
                  <Text style={{ color: active ? COLORS.acid : COLORS.text2, fontSize: 12 }}>{m}</Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: COLORS.text2, fontSize: 13 }}>Auto-analyze in browser</Text>
            <Text style={{ color: COLORS.text3, fontSize: 11, marginTop: 2 }}>
              Analyze each page as you open it in the in-app browser.
            </Text>
          </View>
          <Switch
            value={s.autoAnalyze}
            onValueChange={(v) => patch({ autoAnalyze: v })}
            trackColor={{ true: COLORS.acid + '66', false: COLORS.border2 }}
            thumbColor={s.autoAnalyze ? COLORS.acid : COLORS.gray}
          />
        </View>

        {overlaySupported && (
          <View style={{ gap: 12, borderTopWidth: 1, borderColor: COLORS.border, paddingTop: 18 }}>
            <View>
              <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: '700' }}>
                Floating bubble (Android)
              </Text>
              <Text style={{ color: COLORS.text3, fontSize: 11, marginTop: 4, lineHeight: 16 }}>
                Shows a Veritas bubble over other apps. While on a social or news app, tap it and
                Veritas reads the screen and fact-checks what you're viewing. Requires two Android
                permissions below.
              </Text>
            </View>

            {/* Permission 1: draw over other apps */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: COLORS.text2, fontSize: 13, flex: 1 }}>
                {overlayOk ? '✓ ' : '○ '}Display over other apps
              </Text>
              {!overlayOk && (
                <Pressable onPress={requestOverlayPermission} style={grantBtn}>
                  <Text style={{ color: COLORS.acid, fontSize: 12 }}>Grant</Text>
                </Pressable>
              )}
            </View>

            {/* Permission 2: accessibility (screen reading) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: COLORS.text2, fontSize: 13, flex: 1 }}>
                {accessibilityOk ? '✓ ' : '○ '}Read screen (Accessibility)
              </Text>
              {!accessibilityOk && (
                <Pressable onPress={openAccessibilitySettings} style={grantBtn}>
                  <Text style={{ color: COLORS.acid, fontSize: 12 }}>Enable</Text>
                </Pressable>
              )}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: COLORS.text2, fontSize: 13 }}>Show bubble</Text>
              <Switch
                value={bubbleOn}
                onValueChange={toggleBubble}
                disabled={!overlayOk || !accessibilityOk}
                trackColor={{ true: COLORS.acid + '66', false: COLORS.border2 }}
                thumbColor={bubbleOn ? COLORS.acid : COLORS.gray}
              />
            </View>
          </View>
        )}

        <Pressable
          onPress={persist}
          style={{ backgroundColor: COLORS.acid, borderRadius: 10, paddingVertical: 13, alignItems: 'center' }}
        >
          <Text style={{ color: '#000', fontWeight: '800', letterSpacing: 0.5 }}>
            {saved ? '✓ SAVED' : 'SAVE'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => clearHistory()}
          style={{ borderWidth: 1, borderColor: COLORS.border2, borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}
        >
          <Text style={{ color: COLORS.text3, fontSize: 12 }}>Clear history</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}
