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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editSeed, setEditSeed] = useState('')
  const [editSummary, setEditSummary] = useState('')
  const [editSaving, setEditSaving] = useState(false)
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
    if (editingId === id) setEditingId(null)
  }

  function startEdit(ep: Episode) {
    setEditingId(ep.id)
    setEditSeed(ep.seed_text)
    setEditSummary(ep.summary_text || '')
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit(id: string) {
    setEditSaving(true)
    await supabase.from('episodes').update({
      seed_text: editSeed.trim(),
      summary_text: editSummary.trim() || null,
    }).eq('id', id)
    setEpisodes(prev => prev.map(ep =>
      ep.id === id
        ? { ...ep, seed_text: editSeed.trim(), summary_text: editSummary.trim() || null }
        : ep
    ))
    setEditSaving(false)
    setEditingId(null)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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
                <div style={{ display: 'flex', gap: 4 }}>
                  {editingId !== ep.id && (
                    <button
                      onClick={() => startEdit(ep)}
                      style={{ background: 'none', border: 'none', color: '#A0AEC0', fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
                      title="編集"
                    >
                      ✏️
                    </button>
                  )}
                  <button
                    onClick={() => deleteEpisode(ep.id)}
                    style={{ background: 'none', border: 'none', color: '#CBD5E0', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
                    title="削除"
                  >
                    ×
                  </button>
                </div>
              </div>

              {editingId === ep.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>一言メモ</div>
                  <textarea
                    value={editSeed}
                    onChange={e => setEditSeed(e.target.value)}
                    rows={2}
                    style={{ minHeight: 44 }}
                  />
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, marginBottom: 2 }}>日記メモ</div>
                  <textarea
                    value={editSummary}
                    onChange={e => setEditSummary(e.target.value)}
                    rows={4}
                    placeholder="（未入力の場合は空欄で保存されます）"
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      className="btn-primary"
                      onClick={() => saveEdit(ep.id)}
                      disabled={editSaving || !editSeed.trim()}
                      style={{ flex: 2 }}
                    >
                      {editSaving ? '保存中…' : '保存する'}
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={cancelEdit}
                      disabled={editSaving}
                      style={{ flex: 1 }}
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontWeight: 600, marginBottom: ep.summary_text ? 6 : 0 }}>{ep.seed_text}</div>
                  {ep.summary_text && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>{ep.summary_text}</div>
                  )}
                  {!ep.summary_text && (
                    <>
                      <div style={{ fontSize: 12, color: '#CBD5E0', fontStyle: 'italic', marginBottom: 8 }}>一言メモ（日記未作成）</div>
                      <button
                        className="btn-secondary"
                        onClick={() => router.push(`/chat?seed=${encodeURIComponent(ep.seed_text)}&episodeId=${ep.id}`)}
                        style={{ fontSize: 13, minHeight: 38 }}
                      >
                        💬 AIと話して日記にする
                      </button>
                    </>
                  )}
                </>
              )}

              <div style={{ fontSize: 11, color: '#CBD5E0', marginTop: 8 }}>
                {new Date(ep.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))
        )}
      </div>

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
        v1.2.0 — 2026-06-20
      </p>
    </div>
  )
}
