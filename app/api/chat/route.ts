import { NextRequest, NextResponse } from 'next/server'
import { generateWithFallback, trimHistory } from '@/lib/gemini'

const SYSTEM_INSTRUCTION = `あなたは日記の記録を手伝うアシスタントです。
ユーザーが話した出来事を、後から読み返せる日記として残すことが目的です。

ルール:
- ユーザーの返答に短く応じる（1〜2文）
- 何があったか大まかに分かれば十分。全項目を埋めようとしない
- 情報が足りていれば質問しなくてよい。足りない場合だけ1つだけ聞く
- ユーザーが書いていない感情・評価・推測を付け加えない
- 過剰な感動表現・褒め言葉は不要
- 日本語のみで返答する
- 出来事の概要が把握できたと判断したら（目安: 2往復以上）、返答の末尾に [READY_TO_SAVE] を付ける
- ユーザーが「以上」「これで十分」など終わりを示したら、すぐに [READY_TO_SAVE] を付ける`

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
