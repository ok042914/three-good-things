'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

type Message = { role: 'user' | 'model'; parts: string }

export default function ChatPage() {
  const searchParams = useSearchParams()
  const paramSeed = searchParams.get('seed') || ''
  const paramEpisodeId = searchParams.get('episodeId') || null

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [seedText, setSeedText] = useState(paramSeed)
  const [phase, setPhase] = useState<'seed' | 'chat'>('seed')
  const [loading, setLoading] = useState(false)
  const [readyToSave, setReadyToSave] = useState(false)
  const [saving, setSaving] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 一言メモから展開する場合、マウント時に自動でチャット開始
  useEffect(() => {
    if (paramSeed) {
      startChatWithSeed(paramSeed)
    }
  }, [])

  async function startChatWithSeed(seed: string) {
    setPhase('chat')
    setLoading(true)

    const firstMessage: Message = { role: 'user', parts: seed }
    setMessages([firstMessage])

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history: [], message: seed }),
    })
    const data = await res.json()
    setMessages(prev => [...prev, { role: 'model', parts: data.reply }])
    setReadyToSave(data.readyToSave)
    setLoading(false)
  }

  async function saveMemo() {
    if (!seedText.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const todayISO = new Date().toISOString().split('T')[0]
    await supabase.from('episodes').insert({
      user_id: user.id,
      date: todayISO,
      seed_text: seedText.trim(),
      chat_log: [],
      summary_text: null,
    })
    router.push('/')
  }

  async function startChat() {
    if (!seedText.trim()) return
    startChatWithSeed(seedText.trim())
  }

  async function sendMessage() {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', parts: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history: messages, message: input.trim() }),
    })
    const data = await res.json()
    setMessages(prev => [...prev, { role: 'model', parts: data.reply }])
    setReadyToSave(data.readyToSave)
    setLoading(false)
  }

  async function saveEpisode() {
    setSaving(true)

    const summaryRes = await fetch('/api/episode-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatLog: messages }),
    })
    const { summaryText } = await summaryRes.json()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    if (paramEpisodeId) {
      // 既存の一言メモを日記として更新
      await supabase.from('episodes').update({
        chat_log: messages,
        summary_text: summaryText,
      }).eq('id', paramEpisodeId)
    } else {
      const todayISO = new Date().toISOString().split('T')[0]
      await supabase.from('episodes').insert({
        user_id: user.id,
        date: todayISO,
        seed_text: seedText.trim(),
        chat_log: messages,
        summary_text: summaryText,
      })
    }

    router.push('/')
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
          style={{ background: 'none', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}
        >
          ←
        </button>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>
            {paramEpisodeId ? 'メモから日記を作る' : '出来事を記録する'}
          </div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            {paramEpisodeId ? 'AIが話を広げてくれます' : 'メモだけ残すか、AIと話を広げるか選べます'}
          </div>
        </div>
      </header>

      {phase === 'seed' ? (
        <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ background: '#FFF9F9' }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'var(--text-muted)' }}>
              今日の出来事やテーマを一言で入力してください。<br />
              そのまま保存するか、AIと話を広げて日記にするか選べます。
            </p>
          </div>
          <textarea
            placeholder="例：上司に仕事を褒められた、新しいカフェを見つけた…"
            value={seedText}
            onChange={e => setSeedText(e.target.value)}
            rows={3}
            autoFocus
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              className="btn-primary"
              onClick={startChat}
              disabled={!seedText.trim() || saving}
            >
              💬 AIと話を広げる →
            </button>
            <button
              className="btn-secondary"
              onClick={saveMemo}
              disabled={!seedText.trim() || saving}
            >
              {saving ? '保存中…' : '📝 一言メモとして保存する'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                {msg.role === 'model' && (
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--main)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, marginRight: 8, alignSelf: 'flex-end' }}>
                    🌟
                  </div>
                )}
                <div style={{
                  maxWidth: '78%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user' ? 'var(--main)' : 'white',
                  color: msg.role === 'user' ? 'white' : 'var(--text)',
                  fontSize: 14,
                  lineHeight: 1.7,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                }}>
                  {msg.parts}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--main)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🌟</div>
                <div style={{ background: 'white', borderRadius: '16px 16px 16px 4px', padding: '10px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>入力中…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={{ borderTop: '1px solid #E2E8F0', background: 'white', padding: 12 }}>
            {readyToSave ? (
              <button
                className="btn-primary"
                onClick={saveEpisode}
                disabled={saving}
                style={{ marginBottom: 10 }}
              >
                {saving ? '保存中…' : '✅ この内容で記録する'}
              </button>
            ) : (
              messages.length >= 2 && (
                <button
                  className="btn-secondary"
                  onClick={saveEpisode}
                  disabled={saving}
                  style={{ marginBottom: 10 }}
                >
                  {saving ? '保存中…' : '💾 途中で保存する'}
                </button>
              )
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea
                placeholder="返信する…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                rows={2}
                style={{ minHeight: 44, flex: 1 }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                style={{
                  background: 'var(--main)',
                  border: 'none',
                  borderRadius: 12,
                  color: 'white',
                  width: 44,
                  minHeight: 44,
                  cursor: 'pointer',
                  fontSize: 18,
                  flexShrink: 0,
                  opacity: (!input.trim() || loading) ? 0.5 : 1,
                }}
              >
                ↑
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
