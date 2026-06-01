import { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import { COLORS, scoreColor } from '@/lib/theme'
import { analyze } from '@/lib/api'
import { getSettings, addHistory } from '@/lib/storage'
import type { AnalysisResult } from '@/lib/types'
import ResultView from '@/components/ResultView'

// Runs after each page loads: pull the readable text + title back to RN.
const EXTRACT_JS = `
(function () {
  try {
    var clone = document.body.cloneNode(true);
    ['script','style','noscript','nav','header','footer','aside'].forEach(function (t) {
      Array.prototype.slice.call(clone.querySelectorAll(t)).forEach(function (n) { n.remove(); });
    });
    var text = (clone.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 8000);
    window.ReactNativeWebView.postMessage(JSON.stringify({ title: document.title, url: location.href, content: text }));
  } catch (e) {}
})();
true;
`

function normalizeUrl(raw: string): string {
  const v = raw.trim()
  if (!v) return v
  if (/^https?:\/\//i.test(v)) return v
  if (/^[\w-]+(\.[\w-]+)+/.test(v)) return 'https://' + v
  return 'https://www.google.com/search?q=' + encodeURIComponent(v)
}

export default function Browse() {
  const webRef = useRef<WebView>(null)
  const [address, setAddress] = useState('https://apnews.com')
  const [uri, setUri] = useState('https://apnews.com')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [open, setOpen] = useState(false)
  const lastAnalyzed = useRef<string>('')

  async function onMessage(e: WebViewMessageEvent) {
    let data: { title?: string; url?: string; content?: string }
    try { data = JSON.parse(e.nativeEvent.data) } catch { return }
    if (!data.content || data.content.length < 200) return
    if (data.url === lastAnalyzed.current) return
    lastAnalyzed.current = data.url || ''

    const settings = await getSettings()
    if (!settings.autoAnalyze) return

    setBusy(true)
    setResult(null)
    try {
      let source = ''
      try { source = new URL(data.url || '').hostname.replace(/^www\./, '') } catch {}
      const res = await analyze(
        { url: data.url, title: data.title, source, content: data.content },
        settings,
      )
      setResult(res)
      addHistory({
        id: Date.now().toString(36),
        url: data.url,
        title: data.title,
        result: res,
        createdAt: Date.now(),
      }).catch(() => {})
    } catch {
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  const badgeColor = result ? scoreColor(result.credibility_score) : COLORS.gray

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }} edges={['bottom']}>
      {/* Address bar */}
      <View style={{ flexDirection: 'row', gap: 8, padding: 10, alignItems: 'center' }}>
        <TextInput
          value={address}
          onChangeText={setAddress}
          onSubmitEditing={() => setUri(normalizeUrl(address))}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="Enter a URL…"
          placeholderTextColor={COLORS.text3}
          style={{
            flex: 1,
            color: COLORS.text,
            backgroundColor: COLORS.bg2,
            borderWidth: 1,
            borderColor: COLORS.border2,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 9,
            fontSize: 13,
          }}
        />
        <Pressable
          onPress={() => setUri(normalizeUrl(address))}
          style={{ backgroundColor: COLORS.acid, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 }}
        >
          <Text style={{ color: '#000', fontWeight: '800' }}>Go</Text>
        </Pressable>
      </View>

      <WebView
        ref={webRef}
        source={{ uri }}
        onNavigationStateChange={(s) => setAddress(s.url)}
        injectedJavaScript={EXTRACT_JS}
        onMessage={onMessage}
        style={{ flex: 1, backgroundColor: COLORS.bg }}
      />

      {/* Floating credibility badge */}
      {(busy || result) && (
        <Pressable
          onPress={() => result && setOpen(true)}
          style={{
            position: 'absolute',
            right: 16,
            bottom: 24,
            backgroundColor: COLORS.bg2,
            borderWidth: 1.5,
            borderColor: badgeColor,
            borderRadius: 28,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {busy ? (
            <ActivityIndicator color={COLORS.acid} size="small" />
          ) : (
            <>
              <Text style={{ color: badgeColor, fontWeight: '800', fontSize: 16 }}>
                {result!.credibility_score}
              </Text>
              <Text style={{ color: COLORS.text2, fontSize: 12 }}>{result!.credibility_label}</Text>
            </>
          )}
        </Pressable>
      )}

      {/* Result sheet */}
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)} transparent>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#000a' }}>
          <View style={{ maxHeight: '85%', backgroundColor: COLORS.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 }}>
            <Pressable onPress={() => setOpen(false)} style={{ alignSelf: 'flex-end', padding: 6 }}>
              <Text style={{ color: COLORS.text3, fontSize: 18 }}>✕</Text>
            </Pressable>
            <ScrollView>{result && <ResultView result={result} />}</ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
