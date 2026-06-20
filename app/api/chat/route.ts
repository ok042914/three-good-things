import { GoogleGenAI } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const SYSTEM_INSTRUCTION = `あなたはやさしいジャーナリングコーチです。
ユーザーが話す今日のよかった出来事を、後から読み返しても状況が伝わるよう
5W1H（いつ・どこで・誰が・何を・なぜ・どのように）の観点で自然な会話で掘り下げてください。

ルール:
- 1ターンで質問は1つだけ
- 共感を示してから質問する（例：「それはよかったですね！」）
- 3往復以上経ちかつ5W1Hの情報が十分集まったと判断したら、返答の末尾に [READY_TO_SAVE] というタグを付けてください
- 日本語のみで返答する
- 返答は短めに（3〜4文以内）`

export async function POST(req: NextRequest) {
  try {
    const { history, message } = await req.json()

    const contents = [
      ...history.map((m: { role: string; parts: string }) => ({
        role: m.role as 'user' | 'model',
        parts: [{ text: m.parts }],
      })),
      { role: 'user' as const, parts: [{ text: message }] },
    ]

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents,
      config: { systemInstruction: SYSTEM_INSTRUCTION },
    })

    const rawReply = response.text ?? ''
    const readyToSave = rawReply.includes('[READY_TO_SAVE]')
    const reply = rawReply.replace('[READY_TO_SAVE]', '').trim()

    return NextResponse.json({ reply, readyToSave })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('chat error:', msg)
    return NextResponse.json({ reply: '申し訳ありません、エラーが発生しました。', readyToSave: false }, { status: 500 })
  }
}
