'use client'

import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

function SummaryContent() {
  const searchParams = useSearchParams()
  const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0]

  const [summary, setSummary] = useState('')
  const [otherEvents, setOtherEvents] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    generateSummary()
  }, [])

  async function generateSummary() {
    setLoading(true)
    setSaved(false)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: episodes } = await supabase
      .from('episodes')
      .select('seed_text, summary_text, schedule_id')
      .eq('date', dateParam)
      .order('created_at', { ascending: true })

    // completedなスケジュールも候補に含める（AI会話で日記化済みのものはepisodes側に含まれるため除外）
    const { data: schedules } = await supabase
      .from('schedule')
      .select('id, content')
      .eq('date', dateParam)
      .eq('status', 'completed')

    if (!episodes || episodes.length === 0) {
      setSummary('この日の記録がありません。ホームに戻って出来事を記録してください。')
      setLoading(false)
      return
    }

    const linkedScheduleIds = new Set(episodes.map(e => e.schedule_id).filter(Boolean))
    const completedSchedules = (schedules || [])
      .filter(s => !linkedScheduleIds.has(s.id))
      .map(s => s.content)

    const res = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        episodes: episodes.map(e => ({ seedText: e.seed_text, summaryText: e.summary_text })),
        date: dateParam,
        completedSchedules,
      }),
    })
    const data = await res.json()
    setSummary(data.summary)
    setOtherEvents(data.otherEvents ?? [])
    setLoading(false)
  }

  async function saveSummary() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('journals').upsert({
      user_id: user.id,
      date: dateParam,
      summary,
      other_events: otherEvents,
    }, { onConflict: 'user_id,date' })

    setSaved(true)
    setSaving(false)
  }

  async function copyToClipboard() {
    let text = summary
    if (otherEvents.length > 0) {
      text += '\n\n【その他】\n\n' + otherEvents.map(ev => `・${ev}`).join('\n\n')
    }
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formattedDate = new Date(dateParam).toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  })

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
          <div style={{ fontWeight: 600, fontSize: 16 }}>まとめ</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>{formattedDate}</div>
        </div>
      </header>

      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div style={{ fontSize: 40 }}>✨</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 15 }}>AIが振り返っています…</div>
          </div>
        ) : (
          <>
            <div className="card" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.85, fontSize: 14 }}>
              {summary}
            </div>

            {otherEvents.length > 0 && (
              <div className="card" style={{ background: '#F7FAFC' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>その他の出来事</div>
                {otherEvents.map((ev, i) => (
                  <div key={i} style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8 }}>・{ev}</div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" onClick={copyToClipboard} style={{ flex: 1 }}>
                {copied ? '✅ コピーしました' : '📋 コピー'}
              </button>
              <button
                className="btn-primary"
                onClick={saveSummary}
                disabled={saving || saved}
                style={{ flex: 1 }}
              >
                {saved ? '✅ 保存済み' : saving ? '保存中…' : '💾 保存する'}
              </button>
            </div>

            <button className="btn-secondary" onClick={generateSummary}>
              🔄 やり直す
            </button>
          </>
        )}
      </div>

      <p style={{ textAlign: 'center', color: '#000', fontSize: 11, padding: '8px 0 12px' }}>
        v1.6.0 — 2026-06-21
      </p>
    </div>
  )
}

export default function SummaryPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        読み込み中…
      </div>
    }>
      <SummaryContent />
    </Suspense>
  )
}
