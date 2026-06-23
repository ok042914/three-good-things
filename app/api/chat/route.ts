import { NextRequest, NextResponse } from 'next/server'
import { generateWithFallback, trimHistory } from '@/lib/gemini'

const SYSTEM_INSTRUCTION = `あなたは記録の整理を手伝うアシスタントです。
ユーザーが話す出来事について、後から読み返した時に状況が思い出せるよう
5W1H（いつ・どこで・誰が・何を・なぜ・どのように）の観点で会話を通じて事実を引き出してください。

ルール:
- 1ターンで質問は1つだけ
- ユーザーの言葉に短く応じてから質問する（過剰な感動表現は不要）
- ユーザーが書いていない感情や「すごい」「最高」などの評価を付け加えない
- 3往復以上経ちかつ5W1Hの情報が十分集まったと判断したら、返答の末尾に [READY_TO_SAVE] というタグを付けてください
- 日本語のみで返答する
- 返答は短めに（2〜3文以内）`

export async function POST(req: NextRequest) {
  try {
    const { history, message } = await req.json()

    const trimmed = trimHistory(history, 5)

    const contents = [
      ...trimmed.map((m: { role: string; parts: string }) => ({
        role: m.role as 'user' | 'model',
        parts: [{ text: m.parts }],
      })),
      { role: 'user' as const, parts: [{ text: message }] },
    ]

    const response = await generateWithFallback({
      contents,
      config: { systemInstruction: SYSTEM_INSTRUCTION },
      taskType: 'normal',
    })

    const rawReply = response.text ?? ''
    const readyToSave = rawReply.includes('[READY_TO_SAVE]')
    const reply = rawReply.replace('[READY_TO_SAVE]', '').trim()

    return NextResponse.json({ reply, readyToSave })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('chat error:', msg)
    return NextResponse.json(
      { reply: '', readyToSave: false, error: msg },
      { status: 500 }
    )
  }
}
