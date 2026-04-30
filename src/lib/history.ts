import type { AnalysisResult } from './types'

export interface HistoryEntry {
  id: string
  url: string
  title: string
  source: string
  result: AnalysisResult
  createdAt: number
}

const KEY = 'veritas:history'
const MAX_ENTRIES = 50

function isBrowser(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage
}

export function loadHistory(): HistoryEntry[] {
  if (!isBrowser()) return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveHistory(entries: HistoryEntry[]): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
  } catch {}
}

export function appendHistory(entry: Omit<HistoryEntry, 'id' | 'createdAt'>): HistoryEntry {
  const full: HistoryEntry = {
    ...entry,
    id: Math.random().toString(36).slice(2, 11) + Date.now().toString(36).slice(-4),
    createdAt: Date.now(),
  }
  const existing = loadHistory().filter(
    (e) => !(e.url === full.url && e.title === full.title),
  )
  const next = [full, ...existing].slice(0, MAX_ENTRIES)
  saveHistory(next)
  return full
}

export function deleteHistoryEntry(id: string): void {
  saveHistory(loadHistory().filter((e) => e.id !== id))
}

export function clearHistory(): void {
  saveHistory([])
}
