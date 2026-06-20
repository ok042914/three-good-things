import { GoogleGenAI } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export async function POST(req: NextRequest) {
  try {
    const { chatLog } = await req.json()

    const conversationText = chatLog
      .map((m: { role: string; parts: string }) =>
        `${m.role === 'user' ? 'ユーザー' : 'コーチ'}: ${m.parts}`
      )
      .join('\n')

    const prompt = `以下の会話ログは、ユーザーが今日の出来事についてコーチと話したものです。
この会話から、後から読み返せる日記文（3〜5行）を日本語で書いてください。
体言止めでなく「〜だった」「〜と感じた」形式で、5W1Hが伝わるよう具体的に書くこと。
主語は「私」または省略で統一すること。

【会話ログ】
${conversationText}

【日記文のみ出力してください（前置き不要）】`

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })

    const summaryText = (response.text ?? '').trim()

    return NextResponse.json({ summaryText })
  } catch (error) {
    console.error('episode-summary error:', error)
    return NextResponse.json({ summaryText: '' }, { status: 500 })
  }
}
