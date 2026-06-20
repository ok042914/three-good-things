'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setMessage(error.message)
      } else {
        setMessage('確認メールを送りました。メールを確認してください。')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setMessage('メールアドレスまたはパスワードが違います')
      } else {
        router.push('/')
        router.refresh()
      }
    }
    setLoading(false)
  }

  return (
    <div style={{ padding: '40px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🌟</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--main)', margin: 0 }}>
          Three Good Things
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 6 }}>
          今日の3つのよかったことを記録しよう
        </p>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, textAlign: 'center' }}>
          {isSignUp ? '新規登録' : 'ログイン'}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="パスワード（6文字以上）"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
          />

          {message && (
            <p style={{
              fontSize: 13,
              color: message.includes('送りました') ? '#276749' : '#C53030',
              background: message.includes('送りました') ? '#E6FFED' : '#FFE5E5',
              padding: '8px 12px',
              borderRadius: 8,
              margin: 0,
            }}>
              {message}
            </p>
          )}

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? '処理中…' : (isSignUp ? '登録する' : 'ログイン')}
          </button>
        </form>

        <button
          onClick={() => { setIsSignUp(!isSignUp); setMessage('') }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--main)',
            fontSize: 14,
            cursor: 'pointer',
            width: '100%',
            textAlign: 'center',
            marginTop: 16,
            padding: 8,
          }}
        >
          {isSignUp ? 'すでにアカウントがある方はこちら' : '新規登録はこちら'}
        </button>
      </div>

      <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: 32 }}>
        v1.0.0 — 2026-06-20
      </p>
    </div>
  )
}
