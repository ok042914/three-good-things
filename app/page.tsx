'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Episode = {
  id: string
  seed_text: string
  summary_text: string | null
  created_at: string
}

export default function HomePage() {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  })
  const todayISO = new Date().toISOString().split('T')[0]

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('episodes')
        .select('id, seed_text, summary_text, created_at')
        .eq('date', todayISO)
        .order('created_at', { ascending: false })

      setEpisodes(data || [])
      setLoading(false)
    }
    load()
  }, [])

  async function deleteEpisode(id: string) {
    await supabase.from('episodes').delete().eq('id', id)
    setEpisodes(prev => prev.filter(e => e.id !== id))
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダー */}
      <header style={{
        background: 'var(--main)',
        color: 'white',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>Three Good Things</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{today}</div>
        </div>
        <button
          onClick={handleLogout}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, color: 'white', padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}
        >
          ログアウト
        </button>
      </header>

      <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button className="btn-primary" onClick={() => router.push('/chat')}>
          ＋ 新しい出来事を記録する
        </button>

        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-muted)' }}>
          今日の記録（{episodes.length}件）
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>読み込み中…</div>
        ) : episodes.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
            <div>今日はまだ記録がありません</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>上のボタンから記録を始めましょう</div>
          </div>
        ) : (
          episodes.map((ep, i) => (
            <div key={ep.id} className="card" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{
                  background: 'var(--main-light)',
                  color: 'var(--main-dark)',
                  borderRadius: 6,
                  padding: '2px 8px',
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 8,
                }}>
                  出来事 {episodes.length - i}
                </div>
                <button
                  onClick={() => deleteEpisode(ep.id)}
                  style={{ background: 'none', border: 'none', color: '#CBD5E0', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
                >
                  ×
                </button>
              </div>
              <div style={{ fontWeight: 600, marginBottom: ep.summary_text ? 6 : 0 }}>{ep.seed_text}</div>
              {ep.summary_text && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>{ep.summary_text}</div>
              )}
              <div style={{ fontSize: 11, color: '#CBD5E0', marginTop: 8 }}>
                {new Date(ep.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 下部アクションバー */}
      <div style={{ padding: 16, borderTop: '1px solid #E2E8F0', background: 'white', display: 'flex', gap: 8 }}>
        <button className="btn-secondary" onClick={() => router.push('/history')} style={{ flex: 1 }}>
          📖 履歴
        </button>
        <button
          className="btn-primary"
          onClick={() => router.push('/summary')}
          disabled={episodes.length === 0}
          style={{ flex: 2 }}
        >
          ✨ 今日をまとめる
        </button>
      </div>

      <p style={{ textAlign: 'center', color: '#CBD5E0', fontSize: 11, padding: '4px 0 12px' }}>
        v1.0.0 — 2026-06-20
      </p>
    </div>
  )
}
