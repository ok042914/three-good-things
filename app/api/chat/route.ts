import { NextRequest, NextResponse } from 'next/server'
import { generateWithFallback, trimHistory, NeedsProConfirmationError } from '@/lib/gemini'

// depth_levelごとの設定
const DEPTH_CONFIG: Record<number, { minTurns: number; maxTurns: number; instruction: string }> = {
  1: {
    minTurns: 1,
    maxTurns: 2,
    instruction: '出来事の概要が分かれば（1往復以上）すぐに [READY_TO_SAVE] を付ける。質問は最小限にする。',
  },
  2: {
    minTurns: 2,
    maxTurns: 3,
    instruction: '出来事の概要が把握できたと判断したら（目安: 2往復以上）、[READY_TO_SAVE] を付ける。',
  },
  3: {
    minTurns: 2,
    maxTurns: 5,
    instruction: '出来事の概要が把握できたと判断したら（目安: 2往復以上）、[READY_TO_SAVE] を付ける。',
  },
  4: {
    minTurns: 3,
    maxTurns: 6,
    instruction: '出来事をより深く理解するため（目安: 3往復以上）、具体的なエピソードや感想をもう少し引き出してから [READY_TO_SAVE] を付ける。',
  },
  5: {
    minTurns: 5,
    maxTurns: 8,
    instruction: 'じっくり深掘りする（目安: 5往復以上）。出来事の背景・気持ち・気づきを多角的に引き出し、十分に掘り下げてから [READY_TO_SAVE] を付ける。',
  },
}

function filterThoughts(text: string): string {
  const lines = text.split('\n')
  const filtered = lines.filter(line => {
    const t = line.trim()
    if (!t) return false
    // 思考・メタ情報パターン
    if (/^THOUGHT:/i.test(t)) return false
    if (/^思考[:：]/i.test(t)) return false
    if (/^質問(の候補|候補)[:：]/i.test(t)) return false
    if (/^ルール[:：]?\s/.test(t)) return false
    if (/^候補[:：]/.test(t)) return false
    // 「〜と考えられます」「〜と判断しました」のような思考説明文
    if (/（考え|判断|検討|選択|思考|整理）/.test(t)) return false
    if (/\d+\.\s/.test(t) && /候補|選択肢|質問/.test(text)) return false
    return true
  })

  // 空行を圧縮して返す
  return filtered.join('\n').replace(/\n{2,}/g, '\n').trim()
}

function buildSystemInstruction(depthLevel: number): string {
  const config = DEPTH_CONFIG[depthLevel] ?? DEPTH_CONFIG[3]
  return `あなたは日記の記録を手伝うアシスタントです。
ユーザーが話した出来事を、後から読み返せる日記として残すことが目的です。

【出力形式の厳守】
- ユーザーへの返答文のみを出力する
- 思考過程・質問候補・判断理由・選択肢・検討内容を一切出力しない
- 「〜と考えられます」「〜と判断しました」「情報が揃いました」などの地の文禁止
- 番号付きリスト（1. 2. 3.）形式の候補出力禁止
- 出力はユーザーへの返答のみ。前置きも後書きも不要

ルール:
- ユーザーの言葉をそのまま繰り返さない（オウム返し禁止）
- 返答は1〜2文で簡潔にまとめる
- 必ず出来事を深掘りする質問を1つだけ聞く（「なぜ？」「具体的には？」「どんな気持ちだった？」「何が一番印象に残った？」など）
- 質問は相手の発言の中で最も興味深い・曖昧な部分を選んで掘り下げる
- ユーザーが書いていない感情・評価・推測を付け加えない
- 過剰な感動表現・褒め言葉は不要
- 情報が十分に揃ったと判断したら質問せずに [READY_TO_SAVE] を付ける
- 日本語のみで返答する
- ${config.instruction}
- ユーザーが「以上」「これで十分」など終わりを示したら、すぐに [READY_TO_SAVE] を付ける`
}

export async function POST(req: NextRequest) {
  try {
    const { history, message, depthLevel = 3, allowPro = false } = await req.json()

    const config = DEPTH_CONFIG[depthLevel] ?? DEPTH_CONFIG[3]
    const trimmed = trimHistory(history, config.maxTurns)
    const systemInstruction = buildSystemInstruction(depthLevel)

    const contents = [
      ...trimmed.map((m: { role: string; parts: string }) => ({
        role: m.role as 'user' | 'model',
        parts: [{ text: m.parts }],
      })),
      { role: 'user' as const, parts: [{ text: message }] },
    ]

    const response = await generateWithFallback({
      contents,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingBudget: 0 },
      },
      taskType: 'normal',
      allowPro,
    })

    const rawReply = response.text ?? ''
    const readyToSave = rawReply.includes('[READY_TO_SAVE]')
    const reply = filterThoughts(rawReply.replace('[READY_TO_SAVE]', ''))

    return NextResponse.json({ reply, readyToSave })
  } catch (error) {
    if (error instanceof NeedsProConfirmationError) {
      return NextResponse.json({ reply: '', readyToSave: false, needsProConfirmation: true })
    }
    const msg = error instanceof Error ? error.message : String(error)
    console.error('chat error:', msg)
    return NextResponse.json(
      { reply: '', readyToSave: false, error: msg },
      { status: 500 }
    )
  }
}
