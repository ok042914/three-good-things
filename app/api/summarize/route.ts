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

    const totalEvents = allEventTitles.length
    const numberedFormat = allEventTitles
      .map((_, i) => {
        const num = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'][i] ?? `${i + 1}.`
        return `━━━━━━━━━━━━━━━━\n${num} （タイトル：出来事の内容を20文字以内で要約。入力そのままにせず簡潔に）\n━━━━━━━━━━━━━━━━\n（3〜5行の日記文）`
      })
      .join('\n\n')

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

ユーザーが今日記録した全${totalEvents}件のエピソードを、すべて日記文として整理してください。
1件も省略しないこと。日本語のみ。

【今日のエピソード】
${episodesText}${schedulesText}

【以下のフォーマットで出力してください】
【今日のよかったこと】
${formattedDate}

${numberedFormat}

✨ （今日の一言：30〜50字の励ましや気づき）`

    const response = await generateWithFallback({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      taskType: 'normal',
      allowPro: true,
    })

    const summary = (response.text ?? '').trim()

    return NextResponse.json({ summary, otherEvents: [] })
  } catch (error) {
    const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    console.error('summarize error:', msg)
    return NextResponse.json({ summary: '', otherEvents: [], error: msg }, { status: 500 })
  }
}
