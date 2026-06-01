import AsyncStorage from '@react-native-async-storage/async-storage'
import type { HistoryEntry, Settings } from './types'

const SETTINGS_KEY = 'veritas:settings'
const HISTORY_KEY = 'veritas:history'
const HISTORY_LIMIT = 50

export const DEFAULT_SETTINGS: Settings = {
  apiBase: '',
  geminiKey: '',
  geminiModel: 'gemini-2.5-flash',
  autoAnalyze: true,
}

export async function getSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export async function getHistory(): Promise<HistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY)
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : []
  } catch {
    return []
  }
}

export async function addHistory(entry: HistoryEntry): Promise<void> {
  const list = await getHistory()
  const next = [entry, ...list].slice(0, HISTORY_LIMIT)
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next))
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(HISTORY_KEY)
}
