'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { todayJST } from '@/lib/date'
import { useRouter, useSearchParams } from 'next/navigation'

type Message = { role: 'user' | 'model'; parts: string }

function ChatContent() {
  const searchParams = useSearchParams()
  const paramSeed = searchParams.get('seed') || ''
  const paramEpisodeId = searchParams.get('episodeId') || null
  const paramResume = searchParams.get('resume') === 'true'
  const paramDate = searchParams.get('date') || todayJST()
  const paramScheduleId = searchParams.get('scheduleId') || null

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [seedText, setSeedText] = useState(paramSeed)
  const [phase, setPhase] = useState<'seed' | 'chat'>('seed')
  const [loading, setLoading] = useState(false)
  const [readyToSave, setReadyToSave] = useState(false)
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [lastInput, setLastInput] = useState<string>('')
  const [depthLevel, setDepthLevel] = useState(3)
  const [needsProConfirmation, setNeedsProConfirmation] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    loadDepthLevel()
    if (paramResume && paramEpisodeId) {
      loadAndResumeChat()
    } else if (paramSeed) {
      startChatWithSeed(paramSeed)
    }
  }, [])

  async function loadDepthLevel() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('user_settings')
      .select('depth_level')
      .eq('user_id', user.id)
      .single()
    if (data) setDepthLevel(data.depth_level)
  }

  async function loadAndResumeChat() {
    setLoading(true)
    const { data } = await supabase
      .from('episodes')
      .select('seed_text, chat_log')
      .eq('id', paramEpisodeId)
      .single()

    if (data) {
      setSeedText(data.seed_text)
      setMessages(data.chat_log || [])
      setPhase('chat')
    }
    setLoading(false)
  }

  async function startChatWithSeed(seed: string, allowPro = false) {
    setPhase('chat')
    setLoading(true)
    setApiError(null)
    setNeedsProConfirmation(false)

    const firstMessage: Message = { role: 'user', parts: seed }
    setMessages([firstMessage])
    setLastInput(seed)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: [], message: seed, depthLevel, allowPro }),
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      if (data.needsProConfirmation) {
        setNeedsProConfirmation(true)
        return
      }
      setMessages(prev => [...prev, { role: 'model', parts: data.reply }])
      setReadyToSave(data.readyToSave)
      setApiError(null)
    } catch {
      setApiError('通信エラーが発生しました。時間をおいて再度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  async function saveMemo() {
    if (!seedText.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // 一言メモの場合は先頭20文字をtitleとして使用
    const title = seedText.trim().slice(0, 20)

    await supabase.from('episodes').insert({
      user_id: user.id,
      date: paramDate,
      seed_text: seedText.trim(),
      title,
      chat_log: [],
      summary_text: null,
    })
    router.push('/')
  }

  async function startChat() {
    if (!seedText.trim()) return
    startChatWithSeed(seedText.trim())
  }

  async function sendMessage(overrideInput?: string, allowPro = false) {
    const text = (overrideInput ?? input).trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', parts: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLastInput(text)
    setLoading(true)
    setApiError(null)
    setNeedsProConfirmation(false)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: messages, message: text, depthLevel, allowPro }),
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      if (data.needsProConfirmation) {
        setNeedsProConfirmation(true)
        // 追加したユーザーメッセージを取り消す
        setMessages(messages)
        setInput(text)
        return
      }
      setMessages(prev => [...prev, { role: 'model', parts: data.reply }])
      setReadyToSave(data.readyToSave)
      setApiError(null)
    } catch {
      setApiError('通信エラーが発生しました。時間をおいて再度お試しください。')
      setInput(text)
      setMessages(messages)
    } finally {
      setLoading(false)
    }
  }

  async function saveEpisode() {
    setSaving(true)

    const summaryRes = await fetch('/api/episode-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatLog: messages }),
    })
    const { summaryText, title: generatedTitle } = await summaryRes.json()

    // フォールバック: LLMがtitleを生成できなかった場合はseed_textの先頭20文字
    const title = generatedTitle || seedText.trim().slice(0, 20)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    if (paramEpisodeId) {
      await supabase.from('episodes').update({
        chat_log: messages,
        summary_text: summaryText,
        title,
      }).eq('id', paramEpisodeId)
    } else {
      await supabase.from('episodes').insert({
        user_id: user.id,
        date: paramDate,
        seed_text: seedText.trim(),
        title,
        chat_log: messages,
        summary_text: summaryText,
        schedule_id: paramScheduleId,
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
            {paramResume ? '会話を再開する' : paramEpisodeId ? 'メモから日記を作る' : paramScheduleId ? '予定の振り返りを記録する' : '出来事を記録する'}
          </div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            {paramResume ? '続きをAIと話しましょう' : paramEpisodeId ? 'AIが話を広げてくれます' : paramScheduleId ? '今日はどうでしたか？AIと話してみましょう' : 'メモだけ残すか、AIと話を広げるか選べます'}
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

            {needsProConfirmation && (
              <div style={{
                background: '#FFFBEB',
                border: '1px solid #F6E05E',
                borderRadius: 12,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
                <p style={{ margin: 0, fontSize: 13, color: '#744210', lineHeight: 1.6 }}>
                  通常モデルが混雑しています。高性能モデル（gemini-2.5-pro）で試しますか？<br />
                  <span style={{ fontSize: 12, opacity: 0.8 }}>※ 無料枠の消費が増えます</span>
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => {
                      setNeedsProConfirmation(false)
                      if (messages.length === 0) {
                        startChatWithSeed(lastInput, true)
                      } else {
                        sendMessage(lastInput, true)
                      }
                    }}
                    disabled={loading}
                    style={{
                      background: '#D97706',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      padding: '10px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      minHeight: 44,
                    }}
                  >
                    高性能モデルで試す
                  </button>
                  <button
                    onClick={() => setNeedsProConfirmation(false)}
                    style={{
                      background: 'transparent',
                      color: '#744210',
                      border: '1px solid #F6E05E',
                      borderRadius: 8,
                      padding: '10px 16px',
                      fontSize: 13,
                      cursor: 'pointer',
                      minHeight: 44,
                    }}
                  >
                    やめる
                  </button>
                </div>
              </div>
            )}

            {apiError && (
              <div style={{
                background: '#FFF5F5',
                border: '1px solid #FEB2B2',
                borderRadius: 12,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
                <p style={{ margin: 0, fontSize: 13, color: '#C53030', lineHeight: 1.6 }}>
                  {apiError}
                </p>
                <button
                  onClick={() => sendMessage(lastInput)}
                  disabled={loading}
                  style={{
                    background: loading ? '#FEB2B2' : '#C53030',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    minHeight: 44,
                    opacity: loading ? 0.6 : 1,
                    alignSelf: 'flex-start',
                  }}
                >
                  {loading ? '送信中…' : 'もう一度送信する'}
                </button>
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
                onClick={() => sendMessage()}
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

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        読み込み中…
      </div>
    }>
      <ChatContent />
    </Suspense>
  )
}
