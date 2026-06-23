import { NextRequest, NextResponse } from 'next/server'
import { generateWithFallback } from '@/lib/gemini'

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

    const prompt = `あなたは作家ではありません。
あなたの役割は、ユーザーの記憶を正確に整理し、日記として記録することです。

【必須ルール】
- ユーザーが書いていない感情を追加しない
- ユーザーが感じたことを推測しない
- 大げさな表現を使わない
- 感動的な脚色をしない
- ポエム調にしない
- 人生論を書かない
- 美しい文章にすることを優先しない
- ユーザーが使った表現をできるだけ残す

【出力方針】
- 事実を優先する
- 簡潔にまとめる（各エピソード3〜5行程度）
- 客観的に記録する
- 読み返した時に本人が違和感を感じない文章にする
- 「〜だった」「〜した」語り口で統一する

【禁止表現】（ユーザーが書いていない感情表現は使わない）
- 体中からパワーがみなぎった
- 無限の可能性を感じた
- 人生が豊かになった
- エネルギーに満ちあふれた
- 忘れられない感動となった
- 心が震えた
- 最高の一日だった
- （これらに類する誇張・脚色表現全般）

ユーザーが今日記録したエピソードから、最もよかった3つを選び、
それぞれ3〜5行の日記文として整理してください。
エピソードが3件未満の場合は全件を使う。日本語のみ。

【今日のエピソード】
${episodesText}${schedulesText}

【以下のフォーマットで出力してください】
【今日の3つのよかったこと】
${formattedDate}

━━━━━━━━━━━━━━━━
① （タイトル：出来事の内容を20文字以内で要約。入力そのままにせず簡潔に）
━━━━━━━━━━━━━━━━
（5〜10行の日記文）

━━━━━━━━━━━━━━━━
② （タイトル：出来事の内容を20文字以内で要約。入力そのままにせず簡潔に）
━━━━━━━━━━━━━━━━
（5〜10行の日記文）

━━━━━━━━━━━━━━━━
③ （タイトル：出来事の内容を20文字以内で要約。入力そのままにせず簡潔に）
━━━━━━━━━━━━━━━━
（5〜10行の日記文）

✨ （今日の一言：30〜50字の励ましや気づき）

次に、3つに選ばれなかったイベントを以下のブロックで出力してください。
選ばれたイベント以外のすべてを、以下のルールで記載してください。
- ユーザーが書いた内容をなるべくそのまま残す
- 事実を自然な文章に整理する（感情を創作しない、誇張しない、ポエム調にしない）
- 1件あたり最大100文字程度、2〜3文まで可（過度に短縮しない）
- 箇条書き表示のため、各件を1つの文字列として配列要素にする
選ばれなかったイベントが0件の場合は空の配列 [] を出力してください。

---OTHER_EVENTS_START---
["（イベント1）", "（イベント2）"]
---OTHER_EVENTS_END---

【参考】今回の全イベントタイトル一覧（選定の参考）:
${allEventTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}`

    const response = await generateWithFallback({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      taskType: 'complex',
    })

    const raw = (response.text ?? '').trim()

    const otherEventsMatch = raw.match(/---OTHER_EVENTS_START---\s*([\s\S]*?)\s*---OTHER_EVENTS_END---/)
    let otherEvents: string[] = []
    if (otherEventsMatch) {
      try {
        otherEvents = JSON.parse(otherEventsMatch[1].trim())
      } catch {
        otherEvents = []
      }
    }

    const summary = raw.replace(/---OTHER_EVENTS_START---[\s\S]*?---OTHER_EVENTS_END---/, '').trim()

    return NextResponse.json({ summary, otherEvents })
  } catch (error) {
    const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    console.error('summarize error:', msg)
    return NextResponse.json({ summary: '', otherEvents: [], error: msg }, { status: 500 })
  }
}
