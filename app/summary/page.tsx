'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SummaryPage() {
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const todayISO = new Date().toISOString().split('T')[0]

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
      .select('seed_text, summary_text')
      .eq('date', todayISO)
      .order('created_at', { ascending: true })

    if (!episodes || episodes.length === 0) {
      setSummary('今日の記録がありません。ホームに戻って出来事を記録してください。')
      setLoading(false)
      return
    }

    const res = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        episodes: episodes.map(e => ({ seedText: e.seed_text, summaryText: e.summary_text })),
        date: todayISO,
      }),
    })
    const data = await res.json()
    setSummary(data.summary)
    setLoading(false)
  }

  async function saveSummary() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('journals').upsert({
      user_id: user.id,
      date: todayISO,
      summary,
    }, { onConflict: 'user_id,date' })

    setSaved(true)
    setSaving(false)
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
          <div style={{ fontWeight: 600, fontSize: 16 }}>今日のまとめ</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>AIが3つのよかったことを生成しました</div>
        </div>
      </header>

      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div style={{ fontSize: 40 }}>✨</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 15 }}>AIが今日を振り返っています…</div>
          </div>
        ) : (
          <>
            <div className="card" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.85, fontSize: 14 }}>
              {summary}
            </div>

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

      <p style={{ textAlign: 'center', color: '#CBD5E0', fontSize: 11, padding: '8px 0 12px' }}>
        v1.0.0 — 2026-06-20
      </p>
    </div>
  )
}
