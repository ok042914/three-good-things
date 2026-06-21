'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Episode = {
  id: string
  seed_text: string
  summary_text: string | null
  chat_log: { role: string; parts: string }[]
  created_at: string
  schedule_id: string | null
}

type Schedule = {
  id: string
  content: string
  status: 'planned' | 'completed'
  created_at: string
}

export default function HomePage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editSeed, setEditSeed] = useState('')
  const [editSummary, setEditSummary] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [newSchedule, setNewSchedule] = useState('')
  const [addingSchedule, setAddingSchedule] = useState(false)
  const [showScheduleInput, setShowScheduleInput] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const todayISO = new Date().toISOString().split('T')[0]

  const loadData = useCallback(async (date: string) => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const [{ data: epData }, { data: scData }] = await Promise.all([
      supabase
        .from('episodes')
        .select('id, seed_text, summary_text, chat_log, created_at, schedule_id')
        .eq('date', date)
        .order('created_at', { ascending: false }),
      supabase
        .from('schedule')
        .select('id, content, status, created_at')
        .eq('date', date)
        .order('created_at', { ascending: true }),
    ])

    setEpisodes(epData || [])
    setSchedules(scData || [])
    setLoading(false)
  }, [])

  const episodesBySchedule = useMemo(() => {
    const map = new Map<string, Episode>()
    for (const ep of episodes) {
      if (ep.schedule_id) map.set(ep.schedule_id, ep)
    }
    return map
  }, [episodes])

  const visibleEpisodes = useMemo(
    () => episodes.filter(ep => !ep.schedule_id),
    [episodes]
  )

  useEffect(() => {
    loadData(selectedDate)
  }, [selectedDate])

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedDate(e.target.value)
    setEditingId(null)
  }

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

  async function addSchedule() {
    if (!newSchedule.trim()) return
    setAddingSchedule(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase.from('schedule').insert({
      user_id: user.id,
      date: selectedDate,
      content: newSchedule.trim(),
      status: 'planned',
    }).select('id, content, status, created_at').single()

    if (data) setSchedules(prev => [...prev, data])
    setNewSchedule('')
    setAddingSchedule(false)
    setShowScheduleInput(false)
  }

  async function toggleSchedule(sc: Schedule) {
    const newStatus = sc.status === 'planned' ? 'completed' : 'planned'
    await supabase.from('schedule').update({ status: newStatus }).eq('id', sc.id)
    setSchedules(prev => prev.map(s =>
      s.id === sc.id ? { ...s, status: newStatus } : s
    ))

    // 完了にした瞬間、まだ振り返り(episode)が無ければAIとの会話へ誘導する
    if (newStatus === 'completed' && !episodesBySchedule.has(sc.id)) {
      router.push(`/chat?seed=${encodeURIComponent(sc.content)}&scheduleId=${sc.id}&date=${selectedDate}`)
    }
  }

  async function deleteSchedule(id: string) {
    await supabase.from('schedule').delete().eq('id', id)
    setSchedules(prev => prev.filter(s => s.id !== id))
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isToday = selectedDate === todayISO
  const isFuture = selectedDate > todayISO

  const displayDate = new Date(selectedDate).toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: 'var(--main)',
        color: 'white',
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>Three Good Things</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{displayDate}</div>
        </div>
        <button
          onClick={handleLogout}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, color: 'white', padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}
        >
          ログアウト
        </button>
      </header>

      {/* 日付選択バー */}
      <div style={{ background: 'white', borderBottom: '1px solid #E2E8F0', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => {
            const d = new Date(selectedDate)
            d.setDate(d.getDate() - 1)
            setSelectedDate(d.toISOString().split('T')[0])
          }}
          style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)' }}
        >
          ‹
        </button>
        <input
          type="date"
          value={selectedDate}
          onChange={handleDateChange}
          style={{
            flex: 1,
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            padding: '7px 10px',
            fontSize: 14,
            color: 'var(--text)',
            textAlign: 'center',
          }}
        />
        <button
          onClick={() => {
            const d = new Date(selectedDate)
            d.setDate(d.getDate() + 1)
            setSelectedDate(d.toISOString().split('T')[0])
          }}
          style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)' }}
        >
          ›
        </button>
        {!isToday && (
          <button
            onClick={() => setSelectedDate(todayISO)}
            style={{ background: 'var(--main-light)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: 'var(--main-dark)', whiteSpace: 'nowrap' }}
          >
            今日
          </button>
        )}
      </div>

      <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* スケジュールセクション */}
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {isFuture ? '📅 予定' : '📅 この日の予定'}
            </div>
            <button
              onClick={() => setShowScheduleInput(v => !v)}
              style={{ background: 'var(--main-light)', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: 'var(--main-dark)', cursor: 'pointer' }}
            >
              ＋ 追加
            </button>
          </div>

          {showScheduleInput && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                type="text"
                value={newSchedule}
                onChange={e => setNewSchedule(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addSchedule() }}
                placeholder="予定を入力…"
                autoFocus
                style={{ flex: 1, border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 14, minHeight: 40 }}
              />
              <button
                onClick={addSchedule}
                disabled={!newSchedule.trim() || addingSchedule}
                style={{ background: 'var(--main)', border: 'none', borderRadius: 8, color: 'white', padding: '8px 12px', fontSize: 14, cursor: 'pointer', opacity: !newSchedule.trim() ? 0.5 : 1 }}
              >
                保存
              </button>
            </div>
          )}

          {schedules.length === 0 ? (
            <div style={{ fontSize: 13, color: '#CBD5E0', textAlign: 'center', padding: '8px 0' }}>
              予定なし
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {schedules.map(sc => {
                const linkedEpisode = episodesBySchedule.get(sc.id)
                return (
                  <div key={sc.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={() => toggleSchedule(sc)}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 4,
                          border: sc.status === 'completed' ? '2px solid var(--main)' : '2px solid #CBD5E0',
                          background: sc.status === 'completed' ? 'var(--main)' : 'white',
                          cursor: 'pointer',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: 13,
                        }}
                      >
                        {sc.status === 'completed' ? '✓' : ''}
                      </button>
                      <span style={{
                        fontSize: 14,
                        flex: 1,
                        color: 'var(--text)',
                        textDecoration: 'none',
                      }}>
                        {sc.content}
                      </span>
                      <button
                        onClick={() => deleteSchedule(sc.id)}
                        style={{ background: 'none', border: 'none', color: '#CBD5E0', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
                      >
                        ×
                      </button>
                    </div>

                    {sc.status === 'completed' && linkedEpisode && (
                      <div style={{ marginLeft: 30, padding: '8px 10px', background: '#F7FAFC', borderRadius: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--main-dark)', marginBottom: 4 }}>振り返り</div>
                        {linkedEpisode.summary_text && (
                          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                            {linkedEpisode.summary_text}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                          <button
                            className="btn-secondary"
                            onClick={() => router.push(`/chat?episodeId=${linkedEpisode.id}&resume=true`)}
                            style={{ fontSize: 12, minHeight: 32, padding: '4px 10px' }}
                          >
                            💬 AIと話を続ける
                          </button>
                          <button
                            onClick={() => deleteEpisode(linkedEpisode.id)}
                            style={{ background: 'none', border: 'none', color: '#CBD5E0', fontSize: 12, cursor: 'pointer', padding: 0 }}
                          >
                            振り返りを削除
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 出来事セクション（未来日は非表示） */}
        {!isFuture && (
          <>
            <button className="btn-primary" onClick={() => router.push(`/chat?date=${selectedDate}`)}>
              ＋ 出来事を記録する
            </button>

            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-muted)' }}>
              {isToday ? '今日' : 'この日'}の記録（{visibleEpisodes.length}件）
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>読み込み中…</div>
            ) : visibleEpisodes.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
                <div>記録がありません</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>上のボタンから記録を始めましょう</div>
              </div>
            ) : (
              visibleEpisodes.map((ep, i) => (
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
                      出来事 {visibleEpisodes.length - i}
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
                      {ep.summary_text && ep.chat_log?.length > 0 && (
                        <button
                          className="btn-secondary"
                          onClick={() => router.push(`/chat?episodeId=${ep.id}&resume=true`)}
                          style={{ fontSize: 13, minHeight: 38, marginTop: 8 }}
                        >
                          💬 AIと話を再開する
                        </button>
                      )}
                    </>
                  )}

                  <div style={{ fontSize: 11, color: '#CBD5E0', marginTop: 8 }}>
                    {new Date(ep.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {isFuture && (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
            <div style={{ fontSize: 13 }}>未来の日付は予定のみ登録できます</div>
          </div>
        )}
      </div>

      <div style={{ padding: 16, borderTop: '1px solid #E2E8F0', background: 'white', display: 'flex', gap: 8 }}>
        <button className="btn-secondary" onClick={() => router.push('/history')} style={{ flex: 1 }}>
          📖 履歴
        </button>
        {!isFuture && (
          <button
            className="btn-primary"
            onClick={() => router.push(`/summary?date=${selectedDate}`)}
            disabled={episodes.length === 0}
            style={{ flex: 2 }}
          >
            ✨ まとめる
          </button>
        )}
      </div>

      <p style={{ textAlign: 'center', color: '#000', fontSize: 11, padding: '4px 0 12px' }}>
        v{process.env.NEXT_PUBLIC_VERSION} — {process.env.NEXT_PUBLIC_BUILD_TIME}
      </p>
    </div>
  )
}
