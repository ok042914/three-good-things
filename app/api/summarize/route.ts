import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { episodes, date } = await req.json()

    const episodesText = episodes
      .map((ep: { seedText: string; summaryText: string }, i: number) =>
        `【エピソード${i + 1}】\nタイトル: ${ep.seedText}\n詳細: ${ep.summaryText || '（詳細なし）'}`
      )
      .join('\n\n')

    const formattedDate = new Date(date).toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
    })

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `あなたはポジティブ心理学を活用したジャーナリングコーチです。
ユーザーが今日記録したエピソードから、最もよかった3つを選び、
それぞれ5〜10行の日記文として書いてください。

条件:
- 体言止めでなく「〜だった」「〜と感じた」語り口
- 5W1H（いつ・どこで・誰が・何を・なぜ・どのように）が含まれること
- 自分で書いた日記と同等かそれ以上の具体性と感情の深さ
- エピソードが3件未満の場合は全件を使う
- 日本語のみ

【今日のエピソード】
${episodesText}

【以下のフォーマットで出力してください】
【今日の3つのよかったこと】
${formattedDate}

━━━━━━━━━━━━━━━━
① （タイトル）
━━━━━━━━━━━━━━━━
（5〜10行の日記文）

━━━━━━━━━━━━━━━━
② （タイトル）
━━━━━━━━━━━━━━━━
（5〜10行の日記文）

━━━━━━━━━━━━━━━━
③ （タイトル）
━━━━━━━━━━━━━━━━
（5〜10行の日記文）

✨ （今日の一言：30〜50字の励ましや気づき）`

    const result = await model.generateContent(prompt)
    const summary = result.response.text().trim()

    return NextResponse.json({ summary })
  } catch (error) {
    console.error('summarize error:', error)
    return NextResponse.json({ summary: '' }, { status: 500 })
  }
}
