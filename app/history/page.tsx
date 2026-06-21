'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Journal = {
  id: string
  date: string
  summary: string
  other_events: string[] | null
  created_at: string
}

export default function HistoryPage() {
  const [journals, setJournals] = useState<Journal[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('journals')
        .select('id, date, summary, other_events, created_at')
        .order('date', { ascending: false })
        .limit(30)

      setJournals(data || [])
      setLoading(false)
    }
    load()
  }, [])

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
    })
  }

  function getGoodThings(summary: string): string[] {
    const matches = summary.match(/[①②③]\s*(.+)/g)
    if (matches) return matches.map(m => m.replace(/^[①②③]\s*/, '').trim())
    const lines = summary.split('\n').filter(l => l.trim())
    return lines.slice(0, 3)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: 'var(--main)',
        color: 'white',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <button
          onClick={() => router.push('/')}
          style={{ background: 'none', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer', padding: 0 }}
        >
          ←
        </button>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>ジャーナル履歴</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>過去の3つのよかったこと</div>
        </div>
      </header>

      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>読み込み中…</div>
        ) : journals.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📖</div>
            <div>まだ保存されたジャーナルがありません</div>
          </div>
        ) : (
          journals.map(j => (
            <div
              key={j.id}
              className="card"
              onClick={() => setExpanded(expanded === j.id ? null : j.id)}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--main-dark)' }}>
                  {formatDate(j.date)}
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>
                  {expanded === j.id ? '▲' : '▼'}
                </span>
              </div>

              {expanded === j.id ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--main-dark)', marginBottom: 6 }}>良かったこと</div>
                  {getGoodThings(j.summary).map((item, i) => (
                    <div key={i} style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 2 }}>
                      ✓ {item}
                    </div>
                  ))}

                  {(j.other_events ?? []).length > 0 && (
                    <>
                      <div style={{ height: 1, background: '#E2E8F0', margin: '10px 0' }} />
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>その他</div>
                      {(j.other_events ?? []).map((ev, i) => (
                        <div key={i} style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                          ・{ev}
                        </div>
                      ))}
                    </>
                  )}

                  <div style={{ marginTop: 12, borderTop: '1px solid #E2E8F0', paddingTop: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>全文</div>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.85, color: 'var(--text)' }}>
                      {j.summary}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 6 }}>
                  {getGoodThings(j.summary).map((item, i) => (
                    <div key={i} style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      ✓ {item}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <p style={{ textAlign: 'center', color: '#CBD5E0', fontSize: 11, padding: '8px 0 12px' }}>
        v1.3.0 — 2026-06-21
      </p>
    </div>
  )
}
