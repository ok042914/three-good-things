import { GoogleGenAI } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export async function POST(req: NextRequest) {
  try {
    const { episodes, date, completedSchedules } = await req.json()

    const episodesText = episodes
      .map((ep: { seedText: string; summaryText: string }, i: number) =>
        `【エピソード${i + 1}】\nタイトル: ${ep.seedText}\n詳細: ${ep.summaryText || '（詳細なし）'}`
      )
      .join('\n\n')

    const schedulesText = (completedSchedules as string[] ?? []).length > 0
      ? `\n\n【完了した予定（出来事候補として扱う）】\n${(completedSchedules as string[]).map((s: string) => `・${s}`).join('\n')}`
      : ''

    const allEventTitles = [
      ...episodes.map((ep: { seedText: string }) => ep.seedText),
      ...(completedSchedules as string[] ?? []),
    ]

    const formattedDate = new Date(date).toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
    })

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
${episodesText}${schedulesText}

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

✨ （今日の一言：30〜50字の励ましや気づき）

次に、3つに選ばれなかったイベントを以下のブロックで出力してください。
選ばれたイベント以外のすべてを1行・30文字以内・元の意味を維持して簡潔に記載してください。
選ばれなかったイベントが0件の場合は空の配列 [] を出力してください。

---OTHER_EVENTS_START---
["（イベント1）", "（イベント2）"]
---OTHER_EVENTS_END---

【参考】今回の全イベントタイトル一覧（選定の参考）:
${allEventTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}`

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })

    const raw = (response.text ?? '').trim()

    // OTHER_EVENTSブロックを抽出
    const otherEventsMatch = raw.match(/---OTHER_EVENTS_START---\s*([\s\S]*?)\s*---OTHER_EVENTS_END---/)
    let otherEvents: string[] = []
    if (otherEventsMatch) {
      try {
        otherEvents = JSON.parse(otherEventsMatch[1].trim())
      } catch {
        otherEvents = []
      }
    }

    // summaryからOTHER_EVENTSブロックを除去
    const summary = raw.replace(/---OTHER_EVENTS_START---[\s\S]*?---OTHER_EVENTS_END---/, '').trim()

    return NextResponse.json({ summary, otherEvents })
  } catch (error) {
    console.error('summarize error:', error)
    return NextResponse.json({ summary: '', otherEvents: [] }, { status: 500 })
  }
}
