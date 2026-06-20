'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Journal = {
  id: string
  date: string
  summary: string
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
        .select('id, date, summary, created_at')
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

  function getPreview(summary: string) {
    const lines = summary.split('\n').filter(l => l.trim())
    return lines.slice(0, 2).join(' ').slice(0, 60) + '…'
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
                <div style={{
                  fontWeight: 600,
                  fontSize: 14,
                  color: 'var(--main-dark)',
                }}>
                  {formatDate(j.date)}
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>
                  {expanded === j.id ? '▲' : '▼'}
                </span>
              </div>

              {expanded === j.id ? (
                <div style={{ marginTop: 12, whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.85 }}>
                  {j.summary}
                </div>
              ) : (
                <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {getPreview(j.summary)}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <p style={{ textAlign: 'center', color: '#CBD5E0', fontSize: 11, padding: '8px 0 12px' }}>
        v1.0.0 — 2026-06-20
      </p>
    </div>
  )
}
