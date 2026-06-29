'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const DEPTH_LABELS: Record<number, { label: string; description: string }> = {
  1: { label: 'あっさり', description: '1往復程度で日記化。手短に記録したいとき' },
  2: { label: 'ライト', description: '2往復程度。少しだけ話を広げる' },
  3: { label: '標準', description: '2〜3往復。ちょうどよいバランス（デフォルト）' },
  4: { label: 'じっくり', description: '3〜4往復。具体的なエピソードをしっかり引き出す' },
  5: { label: 'とことん', description: '5往復以上。多角的に内省を促し、濃い日記にする' },
}

export default function SettingsPage() {
  const [depthLevel, setDepthLevel] = useState(3)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data } = await supabase
      .from('user_settings')
      .select('depth_level')
      .eq('user_id', user.id)
      .single()

    if (data) setDepthLevel(data.depth_level)
    setLoading(false)
  }

  async function saveSettings() {
    setSaving(true)
    setSaved(false)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    await supabase.from('user_settings').upsert({
      user_id: user.id,
      depth_level: depthLevel,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        読み込み中…
      </div>
    )
  }

  const current = DEPTH_LABELS[depthLevel]

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
          style={{ background: 'none', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}
        >
          ←
        </button>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>設定</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>アプリの動作をカスタマイズ</div>
        </div>
      </header>

      <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* 深掘り度合い設定 */}
        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
            会話の深掘り度合い
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
            AIがどれくらい質問を重ねてから日記化するかを設定します。
          </div>

          {/* スライダー */}
          <div style={{ marginBottom: 16 }}>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={depthLevel}
              onChange={e => setDepthLevel(Number(e.target.value))}
              style={{
                width: '100%',
                accentColor: 'var(--main)',
                height: 6,
                cursor: 'pointer',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <span key={n} style={{ fontSize: 11, color: n === depthLevel ? 'var(--main-dark)' : 'var(--text-muted)', fontWeight: n === depthLevel ? 700 : 400 }}>
                  {n}
                </span>
              ))}
            </div>
          </div>

          {/* 現在の設定表示 */}
          <div style={{
            background: 'var(--main-light)',
            borderRadius: 10,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                background: 'var(--main)',
                color: 'white',
                borderRadius: 6,
                padding: '2px 8px',
                fontSize: 13,
                fontWeight: 700,
              }}>
                {depthLevel}
              </span>
              <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--main-dark)' }}>
                {current.label}
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {current.description}
            </div>
          </div>

          {/* 段階一覧 */}
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {([1, 2, 3, 4, 5] as const).map(n => (
              <button
                key={n}
                onClick={() => setDepthLevel(n)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: n === depthLevel ? 'var(--main-light)' : 'transparent',
                  border: n === depthLevel ? '1.5px solid var(--main)' : '1.5px solid #E2E8F0',
                  borderRadius: 10,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  minHeight: 44,
                }}
              >
                <span style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: n === depthLevel ? 'var(--main)' : '#E2E8F0',
                  color: n === depthLevel ? 'white' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {n}
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    {DEPTH_LABELS[n].label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {DEPTH_LABELS[n].description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={saveSettings}
          disabled={saving}
        >
          {saving ? '保存中…' : saved ? '✅ 保存しました' : '保存する'}
        </button>
      </div>

      <p style={{ textAlign: 'center', color: '#000', fontSize: 11, padding: '4px 0 12px' }}>
        v{process.env.NEXT_PUBLIC_VERSION} — {process.env.NEXT_PUBLIC_BUILD_TIME}
      </p>
    </div>
  )
}
