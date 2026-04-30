'use client'

import { useEffect, useMemo, useState } from 'react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { loadHistory, deleteHistoryEntry, clearHistory, type HistoryEntry } from '@/lib/history'

const LABEL_COLORS: Record<string, string> = {
  'Verified': 'var(--green)',
  'Partially Verified': 'var(--blue)',
  'Misleading': 'var(--amber)',
  'Unverified': 'var(--text2)',
  'False': 'var(--red)',
}

type FilterKey = 'all' | 'Verified' | 'Partially Verified' | 'Misleading' | 'Unverified' | 'False'

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setEntries(loadHistory())
    setHydrated(true)
  }, [])

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filter !== 'all' && e.result.credibility_label !== filter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!(e.title.toLowerCase().includes(q) ||
              e.url.toLowerCase().includes(q) ||
              e.source.toLowerCase().includes(q))) {
          return false
        }
      }
      return true
    })
  }, [entries, filter, search])

  function handleDelete(id: string) {
    deleteHistoryEntry(id)
    setEntries(loadHistory())
    if (openId === id) setOpenId(null)
  }

  function handleClear() {
    if (!confirm('Clear all saved analyses? This cannot be undone.')) return
    clearHistory()
    setEntries([])
  }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Header />

      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '120px 24px 60px' }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 16, marginBottom: 24,
        }}>
          <div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 11,
              color: 'var(--text3)', letterSpacing: '0.1em',
              textTransform: 'uppercase', marginBottom: 8,
            }}>
              // Research log
            </div>
            <h1 style={{
              fontFamily: 'var(--display)', fontWeight: 800,
              fontSize: 'clamp(28px, 4vw, 44px)', letterSpacing: '-0.03em',
              color: 'var(--text)',
            }}>
              History
            </h1>
            <p style={{
              fontFamily: 'var(--mono)', fontSize: 12,
              color: 'var(--text3)', marginTop: 8,
            }}>
              Past analyses run on this device. Stored locally — never uploaded.
            </p>
          </div>

          {entries.length > 0 && (
            <button
              onClick={handleClear}
              style={{
                fontFamily: 'var(--mono)', fontSize: 11,
                textTransform: 'uppercase', letterSpacing: '0.05em',
                padding: '8px 14px', borderRadius: 6,
                border: '1px solid var(--border2)', background: 'transparent',
                color: 'var(--text3)', cursor: 'pointer',
              }}
            >
              Clear all
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, source, URL…"
            style={{
              flex: '1 1 240px',
              fontFamily: 'var(--mono)', fontSize: 12,
              padding: '10px 12px', borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--bg3)', color: 'var(--text)', outline: 'none',
            }}
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterKey)}
            style={{
              fontFamily: 'var(--mono)', fontSize: 12,
              padding: '10px 12px', borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--bg3)', color: 'var(--text)', outline: 'none',
            }}
          >
            <option value="all">All labels</option>
            <option value="Verified">Verified</option>
            <option value="Partially Verified">Partially Verified</option>
            <option value="Misleading">Misleading</option>
            <option value="Unverified">Unverified</option>
            <option value="False">False</option>
          </select>
        </div>

        {hydrated && entries.length === 0 && (
          <EmptyState />
        )}

        {filtered.length === 0 && entries.length > 0 && (
          <p style={{ fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
            No entries match your filter.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((e) => (
            <HistoryRow
              key={e.id}
              entry={e}
              expanded={openId === e.id}
              onToggle={() => setOpenId(openId === e.id ? null : e.id)}
              onDelete={() => handleDelete(e.id)}
            />
          ))}
        </div>
      </section>

      <Footer />
    </main>
  )
}

function HistoryRow({
  entry, expanded, onToggle, onDelete,
}: {
  entry: HistoryEntry
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const color = LABEL_COLORS[entry.result.credibility_label] || 'var(--text2)'
  const date = new Date(entry.createdAt)

  return (
    <div style={{
      border: `1px solid ${expanded ? color + '60' : 'var(--border)'}`,
      borderRadius: 10, background: 'var(--bg2)', overflow: 'hidden',
      transition: 'border-color 0.15s',
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', textAlign: 'left',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gap: 14, alignItems: 'center',
          padding: '12px 16px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'inherit',
        }}
      >
        <div style={{
          width: 44, height: 44, borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--display)', fontWeight: 800,
          fontSize: 16, color, background: `${color}10`,
          border: `1px solid ${color}40`,
        }}>
          {entry.result.credibility_score}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 13,
            color: 'var(--text)', marginBottom: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {entry.title || '(untitled)'}
          </div>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 11,
            color: 'var(--text3)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {entry.source} · {date.toLocaleString()}
          </div>
        </div>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 10,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          padding: '4px 8px', borderRadius: 4,
          color, border: `1px solid ${color}40`, background: `${color}10`,
        }}>
          {entry.result.credibility_label}
        </span>
      </button>

      {expanded && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)', lineHeight: 1.55 }}>
            {entry.result.page_summary}
          </p>
          <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text)', lineHeight: 1.55 }}>
            <strong style={{ color: 'var(--text3)', fontWeight: 500 }}>Verdict:</strong> {entry.result.final_verdict}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {entry.url && entry.url !== 'https://unknown-source.com' && (
              <a
                href={entry.url}
                target="_blank"
                rel="noopener noreferrer"
                style={linkBtn}
              >
                Open source
              </a>
            )}
            <button onClick={onDelete} style={{ ...linkBtn, color: 'var(--red)', borderColor: 'rgba(255,69,69,0.4)' }}>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const linkBtn: React.CSSProperties = {
  display: 'inline-block',
  fontFamily: 'var(--mono)', fontSize: 11,
  textTransform: 'uppercase', letterSpacing: '0.05em',
  padding: '6px 12px', borderRadius: 4,
  border: '1px solid var(--border2)', background: 'transparent',
  color: 'var(--text2)', cursor: 'pointer', textDecoration: 'none',
}

function EmptyState() {
  return (
    <div style={{
      padding: 40, borderRadius: 12,
      border: '1px dashed var(--border2)',
      background: 'var(--bg2)',
      fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text3)',
      textAlign: 'center',
    }}>
      No analyses yet. Run one from the <a href="/#how-it-works" style={{ color: 'var(--acid)' }}>demo</a> and it'll appear here.
    </div>
  )
}
