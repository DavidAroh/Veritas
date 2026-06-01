import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { getPendingCapture } from '@/lib/overlay'
import { Link, useFocusEffect } from 'expo-router'
import { useShareIntent } from 'expo-share-intent'
import { SafeAreaView } from 'react-native-safe-area-context'
import { COLORS } from '@/lib/theme'
import { analyze, fetchUrl, AnalysisError, type AnalyzePayload } from '@/lib/api'
import { getSettings, addHistory, getHistory } from '@/lib/storage'
import type { AnalysisResult, HistoryEntry } from '@/lib/types'
import ResultView from '@/components/ResultView'

const URL_RE = /^https?:\/\/\S+$/i

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export default function Home() {
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])

  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent()

  const refreshHistory = useCallback(() => {
    getHistory().then(setHistory)
  }, [])

  useFocusEffect(refreshHistory)

  // Analyze whatever was shared into the app from another app.
  useEffect(() => {
    if (!hasShareIntent) return
    const shared = (shareIntent.webUrl || shareIntent.text || '').trim()
    if (shared) {
      setInput(shared)
      run(shared)
    }
    resetShareIntent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasShareIntent])

  // When the floating bubble captures a screen and re-opens the app, analyze
  // the captured text. Checked on mount and whenever the app returns to front.
  const runRef = useRef<(raw?: string) => void>(() => {})
  useEffect(() => {
    const check = () => {
      const cap = getPendingCapture()
      if (cap && cap.trim().length >= 200) {
        setInput(cap)
        runRef.current(cap)
      }
    }
    check()
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check()
    })
    return () => sub.remove()
  }, [])

  async function run(raw?: string) {
    const value = (raw ?? input).trim()
    if (!value) return
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const settings = await getSettings()
      let payload: AnalyzePayload
      let url: string | undefined
      let title: string | undefined

      if (URL_RE.test(value)) {
        const fetched = await fetchUrl(value, settings)
        url = fetched.url
        title = fetched.title
        payload = { url: fetched.url, title: fetched.title, source: fetched.source, content: fetched.content }
      } else {
        payload = { content: value }
      }

      const res = await analyze(payload, settings)
      setResult(res)
      const entry: HistoryEntry = { id: newId(), url, title, result: res, createdAt: Date.now() }
      await addHistory(entry)
      refreshHistory()
    } catch (e: any) {
      const msg = e instanceof AnalysisError ? `${e.code}: ${e.message}` : e?.message || 'Analysis failed'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }
  runRef.current = run

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: COLORS.text2, fontSize: 13, lineHeight: 19 }}>
          Paste a link or article text, or share content from any app into Veritas.
        </Text>

        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="https://example.com/article  — or paste text…"
          placeholderTextColor={COLORS.text3}
          multiline
          style={{
            minHeight: 90,
            color: COLORS.text,
            backgroundColor: COLORS.bg2,
            borderWidth: 1,
            borderColor: COLORS.border2,
            borderRadius: 10,
            padding: 12,
            fontSize: 14,
            textAlignVertical: 'top',
          }}
        />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={() => run()}
            disabled={busy}
            style={{
              flex: 1,
              backgroundColor: COLORS.acid,
              opacity: busy ? 0.5 : 1,
              borderRadius: 10,
              paddingVertical: 13,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#000', fontWeight: '800', letterSpacing: 0.5 }}>
              {busy ? 'ANALYZING…' : 'ANALYZE'}
            </Text>
          </Pressable>
          <Link href="/browse" asChild>
            <Pressable style={btnGhost}>
              <Text style={{ color: COLORS.text2, fontWeight: '700' }}>Browse</Text>
            </Pressable>
          </Link>
          <Link href="/settings" asChild>
            <Pressable style={btnGhost}>
              <Text style={{ color: COLORS.text2, fontWeight: '700' }}>⚙</Text>
            </Pressable>
          </Link>
        </View>

        {busy && (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <ActivityIndicator color={COLORS.acid} />
          </View>
        )}

        {!!error && (
          <View style={{ borderWidth: 1, borderColor: COLORS.red, backgroundColor: COLORS.red + '12', borderRadius: 8, padding: 12 }}>
            <Text style={{ color: COLORS.red, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {result && (
          <View style={{ marginTop: 8 }}>
            <ResultView result={result} />
          </View>
        )}

        {!result && !busy && history.length > 0 && (
          <View style={{ marginTop: 8, gap: 8 }}>
            <Text style={{ color: COLORS.text3, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Recent
            </Text>
            {history.slice(0, 10).map((h) => (
              <Pressable
                key={h.id}
                onPress={() => setResult(h.result)}
                style={{ backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12 }}
              >
                <Text numberOfLines={1} style={{ color: COLORS.text, fontSize: 13 }}>
                  {h.title || h.url || h.result.page_summary}
                </Text>
                <Text style={{ color: COLORS.text3, fontSize: 11, marginTop: 3 }}>
                  {h.result.credibility_label} · {h.result.credibility_score}/100
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const btnGhost = {
  borderWidth: 1,
  borderColor: COLORS.border2,
  borderRadius: 10,
  paddingVertical: 13,
  paddingHorizontal: 16,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
}
